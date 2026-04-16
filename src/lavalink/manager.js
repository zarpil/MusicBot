'use strict';

const { LavalinkManager } = require('lavalink-client');
const db = require('../db/database');
const { updateSetupPanel } = require('../bot/utils/setupPanel');
const { syncState } = require('../utils/stateSync');

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
    
    // Auto-sync across all platforms
    syncState(discordClient, player);

    // Update DB guild entry on new track
    db.upsertGuild(player.guildId, {
      volume: player.volume,
      autoplay: player.get('autoplay') ? 1 : 0,
    });

    // Record in history
    try {
      db.addHistoryEntry(player.guildId, track);
    } catch (err) {
      console.error('[History] Error recording track:', err.message);
    }
  });

  _manager.on('playerPause', (player) => {
    syncState(discordClient, player);
  });

  _manager.on('playerResume', (player) => {
    syncState(discordClient, player);
  });
  
  // Shared Autoplay Logic
  async function handleAutoplay(player, lastTrack) {
    if (!lastTrack) return;
    const isAutoplay = player.get('autoplay');
    const queueLen = player.queue.tracks.length;
    
    if (isAutoplay && queueLen === 0) {
      try {
        console.log(`[Lavalink] Autoplay: buscando sugerencia diferente a "${lastTrack.info.title}"`);
        
        // Track recently played titles to avoid loops (stored in player object)
        let playedTitles = player.get('playedTitles') || [];
        if (!playedTitles.includes(lastTrack.info.title)) {
            playedTitles.push(lastTrack.info.title);
            if (playedTitles.length > 20) playedTitles.shift(); // Keep last 20
            player.set('playedTitles', playedTitles);
        }

        const queries = [
            `ytmsearch:${lastTrack.info.author} related`, // Artist radio (best for variety)
            `ytsearch:${lastTrack.info.author} top music`,
            `ytsearch:similar tracks to ${lastTrack.info.title} ${lastTrack.info.author}`
        ];

        let nextTrack = null;
        for (const q of queries) {
            const res = await player.search(q, 'Autoplay');
            if (res && res.tracks && res.tracks.length > 0) {
                // FILTER: Ignore tracks with same URI, EXTREMELY similar titles, or already played
                const candidates = res.tracks.filter(t => {
                    const isSameUri = t.info.uri === lastTrack.info.uri;
                    const isAlreadyPlayed = playedTitles.some(title => t.info.title.toLowerCase().includes(title.toLowerCase()));
                    const isSameSongVersion = t.info.title.toLowerCase().includes(lastTrack.info.title.toLowerCase()) || 
                                           lastTrack.info.title.toLowerCase().includes(t.info.title.toLowerCase());
                    return !isSameUri && !isAlreadyPlayed && !isSameSongVersion;
                });

                if (candidates.length > 0) {
                    // Random pick from top 5 candidates for more diversity
                    nextTrack = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
                    break;
                }
            }
        }

        // Fallback: if all filters fail, pick a random track from first search to at least have music
        if (!nextTrack) {
            console.log('[Lavalink] Autoplay: No se encontraron candidatos únicos, usando fallback...');
            const fallbackRes = await player.search(`ytsearch:${lastTrack.info.author} mix`, 'Autoplay');
            if (fallbackRes.tracks.length > 0) {
                nextTrack = fallbackRes.tracks.find(t => t.info.uri !== lastTrack.info.uri) || fallbackRes.tracks[0];
            }
        }

        if (nextTrack) {
          // RACE CONDITION FIX: Re-check queue length before adding
          // If the user added a song while we were searching YouTube, we should abort Autoplay
          if (player.queue.tracks.length > 0) {
            console.log(`[Lavalink] Autoplay: Abortando porque el usuario añadió una canción durante la búsqueda.`);
            return;
          }

          console.log(`[Lavalink] Autoplay: Añadiendo "${nextTrack.info.title}"`);
          await player.queue.add(nextTrack);
          
          if (!player.playing) await player.play();
          
          // syncState will be called by trackStart event if it actually starts playing
          // but we also call it here to sync the new queue instantly
          syncState(discordClient, player);
        }
      } catch (err) {
        console.error('[Lavalink] Autoplay Error:', err);
      }
    }
  }

  _manager.on('trackEnd', async (player, track, payload) => {
    const reason = payload?.reason || 'unknown';
    console.log(`[Lavalink] trackEnd DEBUG: title="${track?.info?.title}", reason="${reason}"`);
    
    if (reason === 'replaced' && payload?.byPlayer) return;
    
    // 2-second cooldown to prevent double-triggers from multiple events (trackEnd + queueEnd)
    const now = Date.now();
    const lastTrigger = player.get('lastAutoplayTrigger') || 0;
    if (now - lastTrigger < 2000) return; 
    player.set('lastAutoplayTrigger', now);
    
    await handleAutoplay(player, track);
    syncState(discordClient, player);
  });

  _manager.on('queueEnd', async (player, track, payload) => {
    console.log(`[Lavalink] queueEnd DEBUG in ${player.guildId}`);
    
    const now = Date.now();
    const lastTrigger = player.get('lastAutoplayTrigger') || 0;
    if (now - lastTrigger < 2000) return; 
    player.set('lastAutoplayTrigger', now);

    await handleAutoplay(player, track);
    syncState(discordClient, player);
  });

  _manager.on('playerDestroy', (player) => {
    updateSetupPanel(discordClient, player.guildId, null);
    // WS broadcast for destroy
    try {
        const ws = require('../api/ws/wsServer');
        ws.broadcast(player.guildId, { type: 'STATE_SYNC', state: null });
    } catch {}
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
