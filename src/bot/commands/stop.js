'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la música y limpia la cola'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);
 
    if (!player) {
      return interaction.reply({
        content: t(interaction.guildId, 'errors.noPlayer'),
        flags: [MessageFlags.Ephemeral]
      });
    }
 
    const guildData = db.getGuild(interaction.guildId);
    const isSetupChannel = guildData && guildData.setup_channel_id === interaction.channelId;

    player.queue.tracks = [];
    await player.stopPlaying();
    return interaction.reply({
      content: t(interaction.guildId, 'commands.stop.stopped'),
      flags: isSetupChannel ? [MessageFlags.Ephemeral] : []
    });
  },
};
