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
        .setColor(0xeb40a9) // Tussi Pink
        .setImage('https://i.imgur.com/JughdYl.jpeg');

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
        embed.setFooter({ text: `Estado: ${status} | Volumen: ${player.volume}% | Autoplay: ${autoplay} | Tussi Music | By @p0u` });
    } else {
        embed.setDescription('No hay nada sonando ahora mismo.\n\nEscribe el **nombre de una canción** o una **URL** aquí abajo para empezar a reproducir.')
            .setFooter({ text: 'Tussi Music | By @p0u' });
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
            .setDisabled(!player),
        new ButtonBuilder()
            .setCustomId('PLAYER_WEB')
            .setEmoji('🌐')
            .setLabel('Web')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
}

const lastUpdate = new Map();
const pendingUpdate = new Map();

async function updateSetupPanel(client, guildId, player) {
    const guildData = db.getGuild(guildId);
    if (!guildData || !guildData.setup_channel_id || !guildData.setup_message_id) return;

    const now = Date.now();
    const cooldown = 2500; // 2.5 seconds throttle

    // If there's a pending update, cancel it; we'll schedule a newer one
    if (pendingUpdate.has(guildId)) {
        clearTimeout(pendingUpdate.get(guildId));
        pendingUpdate.delete(guildId);
    }

    const last = lastUpdate.get(guildId) || 0;
    const diff = now - last;

    if (diff < cooldown) {
        // We are within the cooldown. Schedule a "final" update for when the cooldown expires.
        const delay = cooldown - diff;
        const timer = setTimeout(() => {
            updateSetupPanel(client, guildId, player);
            pendingUpdate.delete(guildId);
        }, delay);
        pendingUpdate.set(guildId, timer);
        return;
    }

    // Passed cooldown, we can update now
    lastUpdate.set(guildId, now);

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
        // If we hit a rate limit (429), reset cooldown to try later
        if (err.status === 429) {
            console.warn(`[SetupPanel] Rate limited on guild ${guildId}, retrying in 5s...`);
            lastUpdate.set(guildId, Date.now() + 5000); 
        } else {
            console.error(`[SetupPanel] Error updating panel for guild ${guildId}:`, err);
        }
    }
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

module.exports = { getSetupEmbed, getSetupButtons, updateSetupPanel };
