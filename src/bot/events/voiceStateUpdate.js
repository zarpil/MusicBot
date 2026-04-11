'use strict';

const { Events } = require('discord.js');
const { getManager } = require('../../lavalink/manager');

module.exports = {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    // ── Handle Raw Voice State Update for Lavalink ────────────────────────────
    // Not needed since we pass `sendToShard` in LavalinkManager.
    // However, if we need custom leave logic when everyone leaves:
    
    if (oldState.channelId && !newState.channelId) {
      // Someone left the channel
      const manager = getManager();
      const player = manager.players.get(oldState.guild.id);
      
      if (player && player.voiceChannelId === oldState.channelId) {
        // If bot is alone
        const channel = oldState.guild.channels.cache.get(oldState.channelId);
        if (channel && channel.members.filter(m => !m.user.bot).size === 0) {
          // Everyone left, maybe auto disconnect after some time or immediately
          player.stop();
          player.destroy();
          console.log(`[Bot] Left voice channel in ${oldState.guild.id} because it was empty.`);
        }
      }
    }
  },
};
