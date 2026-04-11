'use strict';
require('dotenv').config();

const { initBot }        = require('./bot/index');
const { initApi }        = require('./api/index');
const { getManager }     = require('./lavalink/manager');
const { getWsServer }    = require('./api/ws/wsServer');
const db                 = require('./db/database');

// ── Serialise a Lavalink track into a plain object for JSON ──────────────────
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

// ── Serialise a full player state ────────────────────────────────────────────
function serializePlayer(player) {
  if (!player) return null;
  return {
    guildId:    player.guildId,
    playing:    player.playing,
    paused:     player.paused,
    volume:     player.volume,
    position:   player.position,
    autoplay:   player.get('autoplay') ?? false,
    current:    serializeTrack(player.queue.current),
    queue:      (player.queue.tracks || []).map(serializeTrack),
  };
}

async function main() {
  // ── 1. Database ──────────────────────────────────────────────────────────
  db.init();

  // ── 2. Discord bot ────────────────────────────────────────────────────────
  const client = await initBot();

  // ── 3. REST + WebSocket server ────────────────────────────────────────────
  await initApi(client);

  // ── 4. Bridge: Lavalink events → WebSocket broadcasts ────────────────────
  const manager = getManager();
  const ws      = getWsServer();

  manager.on('trackStart', (player, track) => {
    const payload = { type: 'TRACK_START', state: serializePlayer(player) };
    ws.broadcast(player.guildId, payload);

    // Update DB guild entry on new track
    db.upsertGuild(player.guildId, {
      volume:   player.volume,
      autoplay: player.get('autoplay') ? 1 : 0,
    });
  });

  manager.on('trackEnd', (player, track) => {
    player.set('lastTrack', track);
    ws.broadcast(player.guildId, { type: 'TRACK_END', state: serializePlayer(player) });
  });

  manager.on('playerPause', (player) => {
    ws.broadcast(player.guildId, { type: 'STATE_SYNC', state: serializePlayer(player) });
  });

  manager.on('playerResume', (player) => {
    ws.broadcast(player.guildId, { type: 'STATE_SYNC', state: serializePlayer(player) });
  });

  manager.on('queueEnd', async (player) => {
    ws.broadcast(player.guildId, { type: 'QUEUE_END', state: serializePlayer(player) });

    // ── Autoplay: queue is empty, find a related track ─────────────────────
    if (player.get('autoplay')) {
      const last = player.get('lastTrack');
      if (!last) return;
      try {
        const query  = `${last.info.author} - ${last.info.title}`;
        const result = await player.search({ query, source: 'youtube' }, 'autoplay');
        if (result.tracks && result.tracks.length > 1) {
          // Exclude exact same URI, pick randomly from top 5
          const candidates = result.tracks
            .filter(t => t.info.uri !== last.info.uri)
            .slice(0, 5);
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          if (pick) {
            await player.queue.add(pick);
            await player.play();
            ws.broadcast(player.guildId, {
              type: 'AUTOPLAY_QUEUED',
              track: serializeTrack(pick),
            });
          }
        }
      } catch (err) {
        console.error('[Autoplay] Error fetching next track:', err.message);
      }
    }
  });

  // Periodic position updates to connected web clients (every 5 s)
  setInterval(() => {
    for (const [guildId, player] of manager.players) {
      if (player.playing && !player.paused) {
        ws.broadcast(guildId, {
          type:     'POSITION_UPDATE',
          position: player.position,
          guildId,
        });
      }
    }
  }, 1000);

  console.log('[Main] MusicBot is fully operational 🎵');
}

main().catch(err => {
  console.error('[Main] Fatal error:', err);
  process.exit(1);
});
