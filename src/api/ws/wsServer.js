'use strict';

const WebSocket = require('ws');

/** guild ID → Set<WebSocket> */
const rooms = new Map();

/** @type {WebSocket.Server|null} */
let _wss = null;

/**
 * Attach a WebSocket server to an existing HTTP server.
 * @param {import('http').Server} httpServer
 * @param {import('../lavalink/manager').getManager} getManager
 */
function initWsServer(httpServer, getManager) {
  _wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  const authStore = require('../../bot/utils/authStore');

  _wss.on('connection', (ws, req) => {
    const url     = new URL(req.url, `http://${req.headers.host}`);
    const guildId = url.searchParams.get('guildId');
    const token   = url.searchParams.get('token');

    if (!guildId) {
      ws.close(1008, 'guildId required');
      return;
    }

    const user = authStore.getUserFromToken(token);
    if (!user) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    // ── Subscribe client to this guild's room ────────────────────────────────
    if (!rooms.has(guildId)) rooms.set(guildId, new Set());
    rooms.get(guildId).add(ws);

    console.log(`[WS] Client joined guild ${guildId} (${rooms.get(guildId).size} clients)`);

    // ── Send current player state on connect ─────────────────────────────────
    try {
      const manager = getManager();
      const player  = manager.players.get(guildId);
      if (player) {
        send(ws, {
          type:  'STATE_SYNC',
          state: serializePlayer(player),
        });
      }
    } catch (_) {
      // manager may not be ready yet
    }

    // ── Handle incoming commands from web client ──────────────────────────────
    ws.on('message', async raw => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      try {
        const manager = getManager();
        const player  = manager.players.get(guildId);

        console.log(`[WS] Commando recibido de ${guildId}: ${msg.type}`, msg.payload || '');

        switch (msg.type) {
          case 'PAUSE':
            if (player) {
              await player.pause(true);
              broadcast(guildId, { type: 'STATE_SYNC', state: serializePlayer(player) });
            }
            break;

          case 'RESUME':
            if (player) {
              await player.resume();
              broadcast(guildId, { type: 'STATE_SYNC', state: serializePlayer(player) });
            }
            break;

          case 'SKIP':
            if (player) await player.skip();
            break;

          case 'STOP':
            if (player) {
              player.queue.tracks = [];
              await player.stopPlaying();
            }
            break;

          case 'SEEK':
            if (player && typeof msg.position === 'number') {
              await player.seek(msg.position);
            }
            break;

          case 'VOLUME':
            if (player && typeof msg.volume === 'number') {
              await player.setVolume(Math.min(100, Math.max(0, msg.volume)));
              broadcast(guildId, { type: 'STATE_SYNC', state: serializePlayer(player) });
            }
            break;

          case 'TOGGLE_AUTOPLAY':
            if (player) {
              player.set('autoplay', !player.get('autoplay'));
              broadcast(guildId, {
                type:     'STATE_SYNC',
                state:    serializePlayer(player),
              });
            }
            break;

          case 'ENQUEUE':
            if (player && msg.track) {
              try {
                const query = msg.track.uri || msg.track._searchQuery || `${msg.track.author} - ${msg.track.title}`;
                console.log(`[WS] Resolviendo pista para encolar: ${query}`);
                let res = null;
                try {
                  res = await player.search(query, 'dashboard');
                } catch (err) {
                  console.warn(`[WS] First resolve attempt failed for "${query}": ${err.message}`);
                }
                
                let trackToLoad = (res && res.tracks && res.tracks.length > 0) ? res.tracks[0] : null;

                // Fallback for YouTube: if direct resolve fails OR errors out, try ytmsearch
                if (!trackToLoad && (query.includes('youtube.com') || query.includes('youtu.be') || query.startsWith('ytsearch'))) {
                   // Clean up query if it has prefix
                   const q = query.replace('ytsearch:', '');
                   const videoId = q.match(/(?:v=|ext\/|embed\/|youtu.be\/)([^&?#/]+)/)?.[1];
                   const searchTerms = videoId || q;

                   console.warn(`[WS] Direct YT resolve failed/errored. Trying ytmsearch fallback for: ${searchTerms}`);
                   try {
                     const fallbackRes = await player.search(`ytmsearch:${searchTerms}`, 'dashboard');
                     if (fallbackRes && fallbackRes.tracks && fallbackRes.tracks.length > 0) {
                        trackToLoad = fallbackRes.tracks[0];
                     }
                   } catch (fallbackErr) {
                     console.error(`[WS] Fallback resolve also failed:`, fallbackErr.message);
                   }
                }

                if (trackToLoad) {
                  await player.queue.add(trackToLoad);
                  send(ws, { type: 'SUCCESS', message: `Añadido: ${trackToLoad.info.title}` });
                  // Only start playing if nothing is currently in the player
                  if (!player.queue.current) {
                    await player.play();
                  }
                  broadcast(guildId, {
                    type: 'STATE_SYNC',
                    state: serializePlayer(player),
                  });
                } else {
                  console.warn(`[WS] No se pudo resolver la pista: ${query} (loadType: ${res?.loadType})`);
                  send(ws, { type: 'ERROR', message: 'No se pudo encontrar la pista de audio o está bloqueada' });
                }
              } catch (err) {
                console.error('[WS] Enqueue error:', err);
                send(ws, { type: 'ERROR', message: 'Error al procesar la pista' });
              }
            }
            break;

          case 'REMOVE_TRACK':
            if (player && typeof msg.index === 'number') {
              player.queue.tracks.splice(msg.index, 1);
              broadcast(guildId, {
                type:  'QUEUE_UPDATE',
                queue: player.queue.tracks.map(serializeTrack),
              });
            }
            break;

          case 'MOVE_TRACK':
            if (player && typeof msg.fromIndex === 'number' && typeof msg.toIndex === 'number') {
              const tracks = player.queue.tracks;
              const [moved] = tracks.splice(msg.fromIndex, 1);
              tracks.splice(msg.toIndex, 0, moved);
              
              broadcast(guildId, {
                type:  'QUEUE_UPDATE',
                queue: tracks.map(serializeTrack),
              });
            }
            break;

          case 'JUMP_TO_TRACK':
            if (player && typeof msg.index === 'number') {
              const tracks = player.queue.tracks;
              if (msg.index >= 0 && msg.index < tracks.length) {
                const [target] = tracks.splice(msg.index, 1);
                tracks.unshift(target);
                await player.skip();
                
                broadcast(guildId, {
                  type: 'STATE_SYNC',
                  state: serializePlayer(player),
                });
              }
            }
            break;

          default:
            break;
        }
      } catch (err) {
        send(ws, { type: 'ERROR', message: err.message });
      }
    });

    ws.on('close', () => {
      rooms.get(guildId)?.delete(ws);
      if (rooms.get(guildId)?.size === 0) rooms.delete(guildId);
    });

    ws.on('error', err => {
      console.error('[WS] Client error:', err.message);
    });
  });

  console.log('[WS] WebSocket server listening on /ws');
  return _wss;
}

/** Broadcast a message to all clients subscribed to a guild. */
function broadcast(guildId, payload) {
  const room = rooms.get(guildId);
  if (!room || room.size === 0) return;
  const data = JSON.stringify(payload);
  for (const ws of room) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function getWsServer() {
  if (!_wss) throw new Error('WS server not initialised');
  return { broadcast, rooms };
}

// ── Serialisation helpers (duplicated from index.js to avoid circular dep) ────
function serializeTrack(track) {
  if (!track) return null;
  return {
    encoded:    track.encoded,
    title:      track.info.title,
    author:     track.info.author,
    duration:   track.info.duration,
    uri:        track.info.uri,
    artworkUrl: track.info.artworkUrl || null,
    sourceName: track.info.sourceName,
    isStream:   track.info.isStream,
  };
}

function serializePlayer(player) {
  if (!player) return null;
  return {
    guildId:  player.guildId,
    playing:  player.playing,
    paused:   player.paused,
    volume:   player.volume,
    position: player.position,
    autoplay: player.get('autoplay') ?? false,
    current:  serializeTrack(player.queue.current),
    queue:    (player.queue.tracks || []).map(serializeTrack),
  };
}

module.exports = { initWsServer, broadcast, getWsServer };
