'use strict';

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Muestra la cola de música actual'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);
 
    if (!player) {
      return interaction.reply({
        content: t(interaction.guildId, 'commands.queue.empty'),
        flags: [MessageFlags.Ephemeral]
      });
    }
 
    const current = player.queue.current;
    if (!current) {
      return interaction.reply({
        content: t(interaction.guildId, 'commands.queue.empty'),
        flags: [MessageFlags.Ephemeral]
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(t(interaction.guildId, 'commands.queue.title', { guildName: interaction.guild.name }))
      .setColor('#1db954') // Verde Spotify
      .addFields(
        { name: t(interaction.guildId, 'commands.queue.nowPlaying'), value: `[${current.info.title}](${current.info.uri})` }
      );

    const tracks = player.queue.tracks;
    if (tracks.length > 0) {
      const upcoming = tracks.slice(0, 10).map((t, i) => `${i + 1}. [${t.info.title}](${t.info.uri})`).join('\n');
      embed.addFields({ name: t(interaction.guildId, 'commands.queue.upNext'), value: upcoming });
      
      if (tracks.length > 10) {
        embed.setFooter({
          text: t(interaction.guildId, 'commands.queue.moreSongs', { count: tracks.length - 10 })
        });
      }
    }

    const guildData = db.getGuild(interaction.guildId);
    const isSetupChannel = guildData && guildData.setup_channel_id === interaction.channelId;

    await interaction.reply({ embeds: [embed], flags: isSetupChannel ? [MessageFlags.Ephemeral] : [] });
  },
};
