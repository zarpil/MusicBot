'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db/database');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription('Change the language / Cambia el idioma')
    .addStringOption(option =>
      option.setName('lang')
        .setDescription('es / en')
        .setRequired(true)
        .addChoices(
          { name: 'Español', value: 'es' },
          { name: 'English', value: 'en' }
        )
    ),
  async execute(interaction) {
    // Check for administrator permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: t(interaction.guildId, 'commands.language.noPermission'),
        flags: [MessageFlags.Ephemeral]
      });
    }

    const lang = interaction.options.getString('lang');
    if (lang !== 'es' && lang !== 'en') {
      return interaction.reply({
        content: t(interaction.guildId, 'commands.language.invalidLanguage'),
        flags: [MessageFlags.Ephemeral]
      });
    }

    db.setLanguage(interaction.guildId, lang);

    const guildData = db.getGuild(interaction.guildId);
    const isSetupChannel = guildData && guildData.setup_channel_id === interaction.channelId;

    return interaction.reply({
      content: t(interaction.guildId, 'commands.language.success', { lang: lang === 'es' ? 'Español' : 'English' }),
      flags: isSetupChannel ? [MessageFlags.Ephemeral] : []
    });
  },
};
