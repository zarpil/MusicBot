'use strict';

const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;

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
