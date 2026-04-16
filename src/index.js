'use strict';
require('dotenv').config();

const { initBot } = require('./bot/index');
const { initApi } = require('./api/index');
const { getManager } = require('./lavalink/manager');
const { getWsServer } = require('./api/ws/wsServer');
const db = require('./db/database');

async function main() {
  // ── 1. Database ──────────────────────────────────────────────────────────
  db.init();

  // ── 1.5 Diagnostic ──
  console.log(`[Diagnostic] YOUTUBE_REFRESH_TOKEN detectado: ${process.env.YOUTUBE_REFRESH_TOKEN ? 'SI' : 'NO'}`);

  // ── 2. Discord bot ────────────────────────────────────────────────────────
  const client = await initBot();

  // ── 3. REST + WebSocket server ────────────────────────────────────────────
  await initApi(client);

  // ── 4. Bridge: Periodic position updates ──────────────────────────────────
  const manager = getManager();
  const ws = getWsServer();

  setInterval(() => {
    for (const [guildId, player] of manager.players) {
      if (player.playing && !player.paused) {
        ws.broadcast(guildId, {
          type: 'POSITION_UPDATE',
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
