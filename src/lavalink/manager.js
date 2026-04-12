'use strict';

const { LavalinkManager } = require('lavalink-client');
const db = require('../db/database');

/** @type {LavalinkManager|null} */
let _manager = null;

/**
 * Build and return the singleton LavalinkManager.
 * Must call initManager(client) from bot ready event before using.
 */
function createManager(discordClient) {
  _manager = new LavalinkManager({
    nodes: [
      {
        id:            'main',
        host:          process.env.LAVALINK_HOST     || 'localhost',
        port:          parseInt(process.env.LAVALINK_PORT || '2333', 10),
        authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
        // Secure only if you put Lavalink behind HTTPS
        secure: false,
      },
    ],
    // Forward Discord gateway payloads to Lavalink
    sendToShard: (guildId, payload) => {
      const guild = discordClient.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    // Auto-move to next track when current ends
    autoSkip: true,
    client: {
      id:       process.env.DISCORD_CLIENT_ID,
      username: 'MusicBot',
    },
    playerOptions: {
      clientBasedPositionUpdateInterval: 100,
      applyVolumeAsFilter: true, // often better for consistent volume
      defaultSearchPlatform: 'ytsearch',
      volumeDecrementer: 0.75, // avoids clipping
    },
  });

  _manager.on('playerCreate', (player) => {
    const guild = db.getGuild(player.guildId);
    if (guild) {
      player.set('autoplay', !!guild.autoplay);
    }
  });

  // ── Node lifecycle logs ────────────────────────────────────────────────────
  _manager.nodeManager.on('connect', node => {
    console.log(`[Lavalink] Node "${node.id}" connected`);
  });

  _manager.nodeManager.on('disconnect', (node, reason) => {
    console.warn(`[Lavalink] Node "${node.id}" disconnected:`, reason);
  });

  _manager.nodeManager.on('error', (node, err) => {
    console.error(`[Lavalink] Node "${node.id}" error:`, err.message);
  });

  _manager.on('trackStart', (player, track) => {
    console.log(`[Lavalink] trackStart: ${track?.info?.title} in ${player.guildId}`);
  });
  
  _manager.on('trackEnd', async (player, track, payload) => {
    const reason = payload?.reason || 'unknown';
    console.log(`[Lavalink] trackEnd DEBUG: title="${track?.info?.title}", reason="${reason}", guild="${player.guildId}"`);
    
    // Autoplay / Radio logic
    const isAutoplay = player.get('autoplay');
    const queueLen = player.queue.tracks.length;
    
    console.log(`[Lavalink] trackEnd CHECK: isAutoplay=${isAutoplay}, queueLen=${queueLen}`);

    if (isAutoplay && queueLen === 0) {
      // We ignore 'replaced' if it's because of a new song, but if it's the LAST song and it ended, we want autoplay
      if (reason === 'replaced' && payload?.byPlayer) {
          console.log('[Lavalink] Autoplay: Ignorando porque fue reemplazado por otro track intencionalmente');
          return;
      }

      try {
        console.log(`[Lavalink] Autoplay: buscando sugerencia para "${track.info.title}" por "${track.info.author}"`);
        
        // Use a simpler query first to ensure we get results
        const queries = [
            `ytsearch:${track.info.title} ${track.info.author} official audio`,
            `ytmsearch:${track.info.title} ${track.info.author} radio`,
            `ytsearch:${track.info.author} mix`
        ];

        let nextTrack = null;

        for (const q of queries) {
            console.log(`[Lavalink] Autoplay: intentando búsqueda con: "${q}"`);
            const res = await player.search(q, 'Autoplay');
            if (res && res.tracks && res.tracks.length > 0) {
                // Try to find a track that isn't exactly the same one
                nextTrack = res.tracks.find(t => t.info.uri !== track.info.uri) || res.tracks[0];
                if (nextTrack) break;
            }
        }

        if (nextTrack) {
          console.log(`[Lavalink] Autoplay: Añadiendo "${nextTrack.info.title}"`);
          await player.queue.add(nextTrack);
          
          if (!player.playing) {
             console.log(`[Lavalink] Autoplay: Iniciando reproducción...`);
             await player.play();
          }
          
          // Broadcast to UI
          try {
            const ws = require('../api/ws/wsServer');
            if (ws && ws.broadcast) {
              ws.broadcast(player.guildId, { type: 'STATE_SYNC', state: ws.serializePlayer(player) });
            }
          } catch (err) {
            console.warn('[Lavalink] Autoplay WS Sync failed (circular dep or not ready)');
          }
        } else {
          console.warn('[Lavalink] Autoplay: No se han podido encontrar sugerencias tras varios intentos.');
        }
      } catch (err) {
        console.error('[Lavalink] Autoplay CRITICAL ERROR:', err);
      }
    } else {
       console.log(`[Lavalink] Autoplay NO disparado: cond=(${isAutoplay && queueLen === 0})`);
    }
  });
  
  _manager.on('trackStuck', (player, track, payload) => {
    console.log(`[Lavalink] trackStuck: ${track?.info?.title} in ${player.guildId}`);
  });
  
  _manager.on('trackError', (player, track, payload) => {
    console.log(`[Lavalink] trackError: ${track?.info?.title} in ${player.guildId}`, payload);
  });

  return _manager;
}

function getManager() {
  if (!_manager) throw new Error('LavalinkManager not initialised. Call createManager(client) first.');
  return _manager;
}

module.exports = { createManager, getManager };
