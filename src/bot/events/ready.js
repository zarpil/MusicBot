'use strict';

const { Events } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);

    // Initialise LavalinkManager now that Discord client is ready
    const manager = getManager();
    manager.init(client.user.id);
    console.log('[Bot] LavalinkManager initialised');

    // Sync guilds to DB on startup and refresh setup panels
    const { updateSetupPanel } = require('../utils/setupPanel');
    for (const [id, guild] of client.guilds.cache) {
      db.upsertGuild(id, { name: guild.name });
      
      // Reset setup panel to "Idle" state on start
      updateSetupPanel(client, id, null);
    }
  },
};
