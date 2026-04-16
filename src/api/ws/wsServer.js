'use strict';

const WebSocket = require('ws');
const db = require('../../db/database');
const { serializePlayer, serializeTrack } = require('../../utils/playerSerializers');
const { ensurePlayer } = require('../../bot/utils/voiceUtils');
const { toggleFilter } = require('../../lavalink/filterPresets');
const { getManager } = require('../../lavalink/manager');
const { syncState } = require('../../utils/stateSync');

/** guild ID → Set<WebSocket> */
const rooms = new Map();

/** @type {WebSocket.Server|null} */
let _wss = null;

/**
 * Attach a WebSocket server to an existing HTTP server.
 * @param {import('http').Server} httpServer
 * @param {import('../lavalink/manager').getManager} getManager
 * @param {import('discord.js').Client} discordClient
 */
function initWsServer(httpServer, getManager, discordClient) {
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
              syncState(discordClient, player);
            }
            break;

          case 'RESUME':
            if (player) {
              await player.resume();
              syncState(discordClient, player);
            }
            break;

          case 'SKIP':
            if (player) {
                await player.skip();
                syncState(discordClient, player);
            }
            break;

          case 'STOP':
            if (player) {
              player.queue.tracks = [];
              await player.stopPlaying();
              syncState(discordClient, player);
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
              syncState(discordClient, player);
            }
            break;

          case 'TOGGLE_AUTOPLAY':
            if (player) {
              const newState = !player.get('autoplay');
              player.set('autoplay', newState);
              db.setAutoplay(guildId, newState); // Persist in DB
              syncState(discordClient, player);
            }
            break;

          case 'TOGGLE_FILTER':
            if (player && msg.filterName) {
              await toggleFilter(player, msg.filterName);
              syncState(discordClient, player);
            }
            break;

          case 'ENQUEUE':
            if (msg.track) {
              try {
                const manager = getManager();
                let player = manager.players.get(guildId);

                // If player doesn't exist, try to auto-join the user
                if (!player) {
                  player = await ensurePlayer(manager, discordClient.guilds.cache.get(guildId), user);
                }

                if (!player) throw new Error('No se pudo crear el reproductor');

                const query = msg.track.uri || msg.track._searchQuery || `${msg.track.author} - ${msg.track.title}`;
                console.log(`[WS] Resolviendo pista para encolar: ${query}`);
                const requester = {
                  username: user.username,
                  id: user.id,
                  avatar: user.avatar
                };

                let res = null;
                try {
                  res = await player.search(query, requester);
                } catch (err) {
                  console.warn(`[WS] First resolve attempt failed for "${query}": ${err.message}`);
                }
                
                let trackToLoad = (res && res.tracks && res.tracks.length > 0) ? res.tracks[0] : null;

                // Special fallback for Spotify: if it's a Spotify link and direct resolve fails, 
                // search for metadata on YouTube
                if (!trackToLoad && (query.includes('spotify.com') || query.includes('spotify:'))) {
                  const metadataQuery = `ytmsearch:${msg.track.author} ${msg.track.title}`;
                  console.warn(`[WS] Spotify resolve failed. Falling back to metadata search: ${metadataQuery}`);
                  try {
                    const fallbackRes = await player.search(metadataQuery, requester);
                    if (fallbackRes && fallbackRes.tracks && fallbackRes.tracks.length > 0) {
                      trackToLoad = fallbackRes.tracks[0];
                    }
                  } catch (fallbackErr) {
                    console.error(`[WS] Spotify fallback also failed:`, fallbackErr.message);
                  }
                }

                // Fallback for YouTube: if direct resolve fails OR errors out, try ytmsearch
                if (!trackToLoad && (query.includes('youtube.com') || query.includes('youtu.be') || query.startsWith('ytsearch'))) {
                   const q = query.replace('ytsearch:', '');
                   const videoId = q.match(/(?:v=|ext\/|embed\/|youtu.be\/)([^&?#/]+)/)?.[1];
                   const searchTerms = videoId || q;

                   console.warn(`[WS] Direct YT resolve failed/errored. Trying ytmsearch fallback for: ${searchTerms}`);
                    try {
                      const fallbackRes = await player.search(`ytmsearch:${searchTerms}`, requester);
                      if (fallbackRes && fallbackRes.tracks && fallbackRes.tracks.length > 0) {
                         trackToLoad = fallbackRes.tracks[0];
                      }
                    } catch (fallbackErr) {
                      console.error(`[WS] Fallback resolve also failed:`, fallbackErr.message);
                    }
                }

                if (res && res.loadType === 'playlist') {
                  const tracks = res.tracks || [];
                  for (const t of tracks) {
                    await player.queue.add(t);
                  }
                  const listName = res.playlist?.name || res.playlist?.title || 'Lista de reproducción';
                  send(ws, { type: 'SUCCESS', message: `Añadida lista: ${listName} (${tracks.length} canciones)` });
                } else if (trackToLoad) {
                  await player.queue.add(trackToLoad);
                  
                  // MANUAL PRIORITY: If we just added a manual track and the queue only 
                  // contains this track + 1 autoplay track, move the manual one to the front.
                  if (player.queue.tracks.length === 2) {
                    const firstTrack = player.queue.tracks[0];
                    // Check if the first track was added by Autoplay
                    const isFirstAutoplay = firstTrack.requester === 'Autoplay' || 
                                           (typeof firstTrack.requester === 'object' && firstTrack.requester.username === 'Autoplay');
                    
                    if (isFirstAutoplay) {
                      console.log('[WS] Manual Priority: Moviendo canción del usuario al puesto N1');
                      const tracks = player.queue.tracks;
                      const [manualTrack] = tracks.splice(1, 1);
                      tracks.unshift(manualTrack);
                    }
                  }

                  send(ws, { type: 'SUCCESS', message: `Añadido: ${trackToLoad.info.title}` });
                } else {
                  console.warn(`[WS] No se pudo resolver la pista: ${msg.track?.title}`);
                  send(ws, { type: 'ERROR', message: 'No se pudo encontrar la pista de audio o está bloqueada' });
                  return;
                }

                // Only start playing if nothing was playing
                if (!player.queue.current) {
                  await player.play();
                }

                syncState(discordClient, player);
              } catch (err) {
                console.error('[WS] Enqueue error:', err);
                send(ws, { type: 'ERROR', message: 'Error al procesar la pista' });
              }
            } else {
              send(ws, { type: 'ERROR', message: 'El bot no está en un canal de voz o la pista es inválida' });
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

          case 'CLEAR_QUEUE':
            if (player) {
              player.queue.tracks = [];
              broadcast(guildId, {
                type:  'QUEUE_UPDATE',
                queue: [],
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

module.exports = { initWsServer, broadcast, getWsServer };
