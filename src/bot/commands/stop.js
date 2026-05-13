'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getManager } = require('../../lavalink/manager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la música y limpia la cola'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);
 
    if (!player) return interaction.reply({ content: 'No hay ninguna reproducción activa.', flags: [MessageFlags.Ephemeral] });
 
    const guildData = db.getGuild(interaction.guildId);
    const isSetupChannel = guildData && guildData.setup_channel_id === interaction.channelId;

    player.queue.tracks = [];
    await player.stopPlaying();
    return interaction.reply({ content: '🛑 Reproducción detenida y cola vaciada.', flags: isSetupChannel ? [MessageFlags.Ephemeral] : [] });
  },
};
