'use strict';

const { Events } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');

module.exports = {
  name: Events.GuildCreate,
  execute(guild) {
    db.upsertGuild(guild.id, { name: guild.name });
    console.log(`[Bot] Joined guild: ${guild.name} (${guild.id})`);
  },
};
