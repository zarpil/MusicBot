'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db/database');

/**
 * Generates the professional music panel embed.
 * @param {import('lavalink-client').Player|null} player 
 */
function getSetupEmbed(player) {
    const embed = new EmbedBuilder()
        .setTitle('🎵 REPRODUCTOR DE MÚSICA')
        .setColor(player?.playing ? 0x2f3136 : 0x2b2d31);

    if (player && player.queue.current) {
        const track = player.queue.current;
        embed.setDescription(`🚀 **Sonando ahora:**\n[${track.info.title}](${track.info.uri})`)
            .setThumbnail(track.info.artworkUrl || 'https://i.imgur.com/8n9v9X9.png')
            .addFields(
                { name: '👤 Autor', value: `\`${track.info.author}\``, inline: true },
                { name: '🕒 Duración', value: `\`${track.info.isStream ? 'EN DIRECTO' : formatDuration(track.info.duration)}\``, inline: true },
                { name: '📥 Solicitado por', value: `${track.requester?.username || track.requester || 'Anónimo'}`, inline: true }
            );

        if (player.queue.tracks.length > 0) {
            const nextTracks = player.queue.tracks.slice(0, 5)
                .map((t, i) => `**${i + 1}.** ${t.info.title.substring(0, 40)}...`)
                .join('\n');
            embed.addFields({ name: '📜 Siguientes en la cola', value: nextTracks });
        }
        
        const status = player.paused ? '⏸️ PAUSADO' : '▶️ SONANDO';
        const autoplay = player.get('autoplay') ? '✅ ON' : '❌ OFF';
        embed.setFooter({ text: `Estado: ${status} | Volumen: ${player.volume}% | Autoplay: ${autoplay}` });
    } else {
        embed.setDescription('No hay nada sonando ahora mismo.\n\nEscribe el **nombre de una canción** o una **URL** aquí abajo para empezar a reproducir.')
            .setImage('https://i.imgur.com/B7y7vXn.png') // A placeholder professional music banner
            .setFooter({ text: 'Sistema de música premium | Tussi Music' });
    }

    return embed;
}

/**
 * Generates the control buttons.
 * @param {import('lavalink-client').Player|null} player 
 */
function getSetupButtons(player) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('PLAYER_PAUSE_RESUME')
            .setEmoji(player?.paused ? '▶️' : '⏸️')
            .setStyle(player?.paused ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!player),
        new ButtonBuilder()
            .setCustomId('PLAYER_SKIP')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!player || player.queue.tracks.length === 0),
        new ButtonBuilder()
            .setCustomId('PLAYER_STOP')
            .setEmoji('⏹️')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!player),
        new ButtonBuilder()
            .setCustomId('PLAYER_AUTOPLAY')
            .setEmoji('🔄')
            .setLabel('Radio')
            .setStyle(player?.get('autoplay') ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!player)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('PLAYER_VOL_DOWN')
            .setEmoji('🔉')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!player),
        new ButtonBuilder()
            .setCustomId('PLAYER_VOL_UP')
            .setEmoji('🔊')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!player)
    );

    return [row1, row2];
}

async function updateSetupPanel(client, guildId, player) {
    const guildData = db.getGuild(guildId);
    if (!guildData || !guildData.setup_channel_id || !guildData.setup_message_id) return;

    try {
        const channel = await client.channels.fetch(guildData.setup_channel_id).catch(() => null);
        if (!channel) return;

        const message = await channel.messages.fetch(guildData.setup_message_id).catch(() => null);
        if (!message) return;

        await message.edit({
            embeds: [getSetupEmbed(player)],
            components: getSetupButtons(player)
        });
    } catch (err) {
        console.error(`[SetupPanel] Error updating panel for guild ${guildId}:`, err);
    }
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

module.exports = { getSetupEmbed, getSetupButtons, updateSetupPanel };
