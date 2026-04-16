'use strict';

const { Events } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const { ensurePlayer } = require('../utils/voiceUtils');
const db = require('../../db/database');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const guildData = db.getGuild(message.guildId);
        if (!guildData || guildData.setup_channel_id !== message.channelId) return;

        // Auto-delete user message to keep the channel clean
        if (message.deletable) {
            await message.delete().catch(() => {});
        }

        const query = message.content.trim();
        if (!query) return;

        try {
            const manager = getManager();
            const player = await ensurePlayer(manager, message.guild, message.author);
            
            let queryClean = query;
            if (!queryClean.startsWith('http')) queryClean = `ytsearch:${queryClean}`;

            const res = await player.search(queryClean, message.author);
            
            if (res.loadType === 'empty' || res.loadType === 'error') {
                const tempMsg = await message.channel.send(`❌ No se encontró nada para \`${query}\``);
                setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
                return;
            }

            if (res.loadType === 'playlist') {
                for (const track of res.tracks) {
                    await player.queue.add(track);
                }
            } else {
                await player.queue.add(res.tracks[0]);
            }

            if (!player.playing && !player.paused) {
                await player.play();
            }

            // The panel will be updated by the manager events (trackStart, etc)
        } catch (err) {
            console.error('[MessageCreate] Setup channel error:', err);
            const tempMsg = await message.channel.send(`❌ Error: ${err.message}`);
            setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
        }
    },
};
