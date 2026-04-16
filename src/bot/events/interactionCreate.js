'use strict';

const { Events } = require('discord.js');
const { syncState } = require('../../utils/stateSync');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete() && !interaction.isButton()) return;

    if (interaction.isButton()) {
        const { getManager } = require('../../lavalink/manager');
        const manager = getManager();
        const player = manager.players.get(interaction.guildId);

        if (!player) return interaction.reply({ content: '❌ El reproductor no está activo.', ephemeral: true });

        const member = interaction.member;
        if (!member.voice.channelId || member.voice.channelId !== player.voiceChannelId) {
            return interaction.reply({ content: '❌ Debes estar en el mismo canal de voz que el bot para usar los controles.', ephemeral: true });
        }

        await interaction.deferUpdate();

        try {
            switch (interaction.customId) {
                case 'PLAYER_PAUSE_RESUME':
                    if (player.paused) await player.resume();
                    else await player.pause(true);
                    break;
                case 'PLAYER_SKIP':
                    await player.skip();
                    break;
                case 'PLAYER_STOP':
                    player.queue.tracks = [];
                    await player.stopPlaying();
                    break;
                case 'PLAYER_VOL_DOWN':
                    await player.setVolume(Math.max(0, player.volume - 10));
                    break;
                case 'PLAYER_VOL_UP':
                    await player.setVolume(Math.min(150, player.volume + 10));
                    break;
                case 'PLAYER_AUTOPLAY':
                    const nextAutoplay = !player.get('autoplay');
                    player.set('autoplay', nextAutoplay);
                    break;
            }
            
            // Sync across all platforms (Web and Discord Panel)
            syncState(client, player);
        } catch (err) {
            console.error('[InteractionCreate] Button error:', err);
        }
        return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    if (interaction.isAutocomplete()) {
      if (typeof command.autocomplete === 'function') {
        try {
          await command.autocomplete(interaction);
        } catch (err) {
          console.error(`[Bot] Error during autocomplete for ${interaction.commandName}:`, err);
        }
      }
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[Bot] Error executing ${interaction.commandName}:`, error);
      const reply = { content: 'There was an error while executing this command!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(console.error);
      } else {
        await interaction.reply(reply).catch(console.error);
      }
    }
  },
};
