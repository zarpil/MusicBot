'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Activa o desactiva el modo automático (reproducción continua)'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);

    if (!player) {
      return interaction.reply({
        content: t(interaction.guildId, 'errors.noActivePlayerAutoplay'),
        flags: [MessageFlags.Ephemeral]
      });
    }

    const currentAutoplay = player.get('autoplay') || false;
    const newAutoplay = !currentAutoplay;
    
    player.set('autoplay', newAutoplay);
    db.upsertGuild(interaction.guildId, { autoplay: newAutoplay ? 1 : 0 });

    const guildData = db.getGuild(interaction.guildId);
    const isSetupChannel = guildData && guildData.setup_channel_id === interaction.channelId;

    return interaction.reply({ 
      content: newAutoplay 
        ? t(interaction.guildId, 'commands.autoplay.enabled') 
        : t(interaction.guildId, 'commands.autoplay.disabled'), 
      flags: isSetupChannel ? [MessageFlags.Ephemeral] : [] 
    });
  },
};
