'use strict';

const { serializePlayer } = require('./playerSerializers');
const { updateSetupPanel } = require('../bot/utils/setupPanel');

/**
 * Synchronizes the player state across all platforms (Discord & Web).
 * @param {import('discord.js').Client} client The Discord client.
 * @param {import('lavalink-client').Player} player The Lavalink player.
 */
async function syncState(client, player) {
    if (!player) return;

    // 1. Update Discord Setup Panel (if configured)
    try {
        await updateSetupPanel(client, player.guildId, player);
    } catch (err) {
        console.error(`[StateSync] Error updating Discord panel:`, err.message);
    }

    // 2. Broadcast to Web Dashboard
    try {
        const ws = require('../api/ws/wsServer');
        if (ws && ws.broadcast) {
            ws.broadcast(player.guildId, { 
                type: 'STATE_SYNC', 
                state: serializePlayer(player) 
            });
        }
    } catch (err) {
        console.error(`[StateSync] Error broadcasting to Web:`, err.message);
    }
}

module.exports = { syncState };
