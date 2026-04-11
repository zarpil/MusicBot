'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Cambia el volumen del reproductor')
    .addIntegerOption(option => 
      option.setName('nivel')
        .setDescription('Nivel de volumen (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),
  async execute(interaction) {
    const level = interaction.options.getInteger('nivel');
    
    // Save to db regardless if player exists right now
    db.upsertGuild(interaction.guildId, { volume: level });

    const manager = getManager();
    const player = manager.players.get(interaction.guildId);

    if (player) {
      await player.setVolume(level);
    }

    return interaction.reply(`🔊 Volumen establecido al **${level}%**.`);
  },
};
