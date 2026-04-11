'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Activa o desactiva el modo automático (reproducción continua)'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);

    if (!player) {
      return interaction.reply({ content: 'No hay ningún reproductor activo. Reproduce algo primero.', ephemeral: true });
    }

    const currentAutoplay = player.get('autoplay') || false;
    const newAutoplay = !currentAutoplay;
    
    player.set('autoplay', newAutoplay);
    db.upsertGuild(interaction.guildId, { autoplay: newAutoplay ? 1 : 0 });

    return interaction.reply(newAutoplay ? '🔁 Reproducción automática **ACTIVADA**.' : '🔁 Reproducción automática **DESACTIVADA**.');
  },
};
