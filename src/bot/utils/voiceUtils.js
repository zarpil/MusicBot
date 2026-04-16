'use strict';

/**
 * Checks if the bot is in a voice channel. If not, attempts to join the user's channel.
 * @param {import('lavalink-client').LavalinkManager} manager
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User} user
 */
async function ensurePlayer(manager, guild, user) {
    let player = manager.players.get(guild.id);

    if (!player) {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member || !member.voice.channel) {
            throw new Error('Debes estar en un canal de voz para reproducir música');
        }

        player = manager.createPlayer({
            guildId: guild.id,
            voiceChannelId: member.voice.channel.id,
            textChannelId: null,
            selfDeaf: true,
            selfMute: false,
            shardId: guild.shardId,
        });

        await player.connect();
        console.log(`[VoiceUtils] Auto-joined ${user.username} in ${member.voice.channel.name}`);
    }

    return player;
}

module.exports = { ensurePlayer };
