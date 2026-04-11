'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const { getWsServer } = require('../../api/ws/wsServer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa o reanuda la reproducción actual'),
  async execute(interaction) {
    const manager = getManager();
    const player = manager.players.get(interaction.guildId);
 
    if (!player) return interaction.reply({ content: 'No hay ninguna reproducción activa.', ephemeral: true });
 
    const newPausedState = !player.paused;
    await player.pause(newPausedState);
 
    const ws = getWsServer();
    // Re-serialize manually here, or the frontend will sync it up on the next interval
    // but just in case:
    ws.broadcast(interaction.guildId, {
      type: 'STATE_SYNC',
      state: {
         guildId: player.guildId,
         playing: player.playing,
         paused: player.paused,
         volume: player.volume,
         position: player.position,
         autoplay: player.get('autoplay') ?? false,
      }
    });
 
    return interaction.reply(newPausedState ? '⏸️ Pausado.' : '▶️ Reanudado.');
  },
};
