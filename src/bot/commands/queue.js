'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getManager } = require('../../lavalink/manager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Muestra la cola de música actual'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);
 
    if (!player) {
      return interaction.reply({ content: 'No hay nada sonando ahora mismo.', ephemeral: true });
    }
 
    const current = player.queue.current;
    if (!current) {
      return interaction.reply({ content: 'No hay nada sonando ahora mismo.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Cola Actual')
      .setColor('#1db954') // Verde Spotify
      .addFields(
        { name: 'Sonando ahora', value: `[${current.info.title}](${current.info.uri})` }
      );

    const tracks = player.queue.tracks;
    if (tracks.length > 0) {
      const upcoming = tracks.slice(0, 10).map((t, i) => `${i + 1}. [${t.info.title}](${t.info.uri})`).join('\n');
      embed.addFields({ name: 'Siguiente en la cola', value: upcoming });
      
      if (tracks.length > 10) {
        embed.setFooter({ text: `Y ${tracks.length - 10} canciones más...` });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },
};
