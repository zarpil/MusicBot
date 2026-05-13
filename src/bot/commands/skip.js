'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getManager } = require('../../lavalink/manager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la canción actual'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);
 
    if (!player) return interaction.reply({ content: 'No hay ninguna reproducción activa.', flags: [MessageFlags.Ephemeral] });
 
    const guildData = db.getGuild(interaction.guildId);
    const isSetupChannel = guildData && guildData.setup_channel_id === interaction.channelId;

    await player.skip();
    return interaction.reply({ content: '⏭️ Canción saltada.', flags: isSetupChannel ? [MessageFlags.Ephemeral] : [] });
  },
};
