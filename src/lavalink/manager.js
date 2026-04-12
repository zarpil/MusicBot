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
    if (isAutoplay && player.queue.tracks.length === 0 && payload?.reason !== 'replaced') {
      try {
        console.log(`[Lavalink] Autoplay: buscando canción relacionada para "${track.info.title}"...`);
        
        // Use the previous track's title and author to find something related
        const query = `ytmsearch:${track.info.title} ${track.info.author} related`;
        const res = await player.search(query, track.requester || 'Autoplay');
        
        if (res.tracks.length > 0) {
          // Add the first result (typically the most related)
          const nextTrack = res.tracks[0];
          await player.queue.add(nextTrack);
          console.log(`[Lavalink] Autoplay: añadiendo "${nextTrack.info.title}"`);
          
          if (!player.playing) await player.play();
          
          // Broadcast update to web clients if possible
          try {
            const { broadcast, serializePlayer } = require('../api/ws/wsServer');
            broadcast(player.guildId, { type: 'STATE_SYNC', state: serializePlayer(player) });
          } catch (e) { /* wsServer might not be available yet */ }
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
