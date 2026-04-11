'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getManager } = require('../../lavalink/manager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la canción actual'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);
 
    if (!player) return interaction.reply({ content: 'No hay ninguna reproducción activa.', ephemeral: true });
 
    await player.skip();
    return interaction.reply('⏭️ Canción saltada.');
  },
};
