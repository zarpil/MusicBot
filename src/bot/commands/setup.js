'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, OverwriteType } = require('discord.js');
const { getSetupEmbed, getSetupButtons } = require('../utils/setupPanel');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Crea o reinicia el canal dedicado de control de música')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const guild = interaction.guild;
    const manager = getManager();
    const player = manager.players.get(guildId);

    // 1. Create text channel
    let channel = null;
    try {
        channel = await guild.channels.create({
            name: '🎵-tussi-musica',
            type: ChannelType.GuildText,
            topic: 'Controla la música del bot escribiendo aquí abajo o usando los botones.',
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                }
            ],
        });
    } catch (err) {
        console.error('[Setup] Error creating channel:', err);
        return interaction.editReply('❌ No he podido crear el canal. Revisa mis permisos.');
    }

    // 2. Send the initial panel
    const embed = getSetupEmbed(player);
    const buttons = getSetupButtons(player);

    const message = await channel.send({
        embeds: [embed],
        components: buttons
    });

    // 3. Save to DB
    db.setSetupInfo(guildId, channel.id, message.id);

    return interaction.editReply(`✅ Canal de música configurado con éxito: ${channel}`);
  },
};
