'use strict';

const { t } = require('../../utils/i18n');

/**
 * Checks if the bot is in a voice channel. If not, attempts to join the user's channel.
 * @param {import('lavalink-client').LavalinkManager} manager
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User} user
 */
async function ensurePlayer(manager, guild, user) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    const botVoiceChannelId = guild.members.me?.voice.channelId;

    if (botVoiceChannelId) {
        // El bot ya está en un canal de voz. Verificamos que el usuario esté en el mismo canal.
        if (!member || member.voice.channelId !== botVoiceChannelId) {
            throw new Error(t(guild.id, 'errors.sameVoiceChannel'));
        }

        let player = manager.players.get(guild.id);
        if (!player) {
            player = manager.createPlayer({
                guildId: guild.id,
                voiceChannelId: botVoiceChannelId,
                textChannelId: null,
                selfDeaf: true,
                selfMute: false,
                shardId: guild.shardId,
            });
            await player.connect();
        }
        return player;
    } else {
        // El bot no está en ningún canal de voz.
        if (!member || !member.voice.channelId) {
            throw new Error(t(guild.id, 'errors.mustBeInVoice'));
        }

        let player = manager.players.get(guild.id);
        if (!player) {
            player = manager.createPlayer({
                guildId: guild.id,
                voiceChannelId: member.voice.channelId,
                textChannelId: null,
                selfDeaf: true,
                selfMute: false,
                shardId: guild.shardId,
            });
        } else {
            // Actualizamos el canal de voz del player existente
            player.voiceChannelId = member.voice.channelId;
            if (player.options) {
                player.options.voiceChannelId = member.voice.channelId;
            }
        }

        await player.connect();
        console.log(`[VoiceUtils] Auto-joined ${user.username} in ${member.voice.channel.name}`);
        return player;
    }
}

module.exports = { ensurePlayer };
