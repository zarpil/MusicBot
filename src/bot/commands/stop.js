'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getManager } = require('../../lavalink/manager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la música y limpia la cola'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);
 
    if (!player) return interaction.reply({ content: 'No hay ninguna reproducción activa.', ephemeral: true });
 
    player.queue.tracks = [];
    await player.stopPlaying();
    return interaction.reply('🛑 Reproducción detenida y cola vaciada.');
  },
};
