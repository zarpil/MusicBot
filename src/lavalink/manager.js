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
    console.log(`[Lavalink] trackEnd: ${track?.info?.title} in ${player.guildId} reason: ${payload?.reason}`);
    
    // Autoplay / Radio logic
    const isAutoplay = player.get('autoplay');
    console.log(`[Lavalink] Autoplay state for ${player.guildId}: ${isAutoplay}, queue length: ${player.queue.tracks.length}`);

    if (isAutoplay && player.queue.tracks.length === 0 && (payload?.reason === 'finished' || payload?.reason === 'stopped')) {
      try {
        console.log(`[Lavalink] Autoplay: buscando canción relacionada para "${track.info.title}"...`);
        
        // Try YouTube Music search first, then regular YouTube search
        let query = `ytmsearch:${track.info.title} ${track.info.author} related`;
        let res = await player.search(query, track.requester || 'Autoplay');
        
        if (!res || !res.tracks || res.tracks.length === 0) {
          console.log(`[Lavalink] Autoplay: no ytmsearch results, trying regular ytsearch...`);
          query = `ytsearch:${track.info.title} ${track.info.author} related music`;
          res = await player.search(query, track.requester || 'Autoplay');
        }

        if (res && res.tracks && res.tracks.length > 0) {
          // Find a track that isn't the one that just finished
          const nextTrack = res.tracks.find(t => t.info.uri !== track.info.uri) || res.tracks[0];
          
          console.log(`[Lavalink] Autoplay: añadiendo "${nextTrack.info.title}" a la cola`);
          await player.queue.add(nextTrack);
          
          if (!player.playing && !player.paused) {
            console.log(`[Lavalink] Autoplay: iniciando reproducción de pista automática`);
            await player.play();
          }
          
          // Broadcast update to web clients
          try {
            const ws = require('../api/ws/wsServer');
            if (ws && ws.broadcast) {
              ws.broadcast(player.guildId, { type: 'STATE_SYNC', state: ws.serializePlayer(player) });
            }
          } catch (e) {
            console.warn('[Lavalink] Autoplay skip broadcast: wsServer not ready');
          }
        } else {
          console.warn(`[Lavalink] Autoplay: No se encontraron canciones relacionadas para "${track.info.title}"`);
        }
      } catch (err) {
        console.error('[Lavalink] Autoplay error:', err);
      }
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
