'use strict';

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
const fs   = require('fs');
const { createManager } = require('../lavalink/manager');

/**
 * Initialise the Discord bot.
 * @returns {Promise<Client>}
 */
async function initBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.commands = new Collection();

  // Load commands
  const commandsPath = path.join(__dirname, 'commands');
  if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      }
    }
  }

  // Load events
  const eventsPath = path.join(__dirname, 'events');
  if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
      const event = require(path.join(eventsPath, file));
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
    }
  }

  const { getManager } = require('../lavalink/manager');
  client.on('raw', (d) => {
    try {
      getManager().sendRawData(d);
    } catch {}
  });

  createManager(client);
  await client.login(process.env.DISCORD_TOKEN);
  return client;
}

module.exports = { initBot };
