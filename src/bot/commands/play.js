'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');
const authStore = require('../utils/authStore');
const { syncState } = require('../../utils/stateSync');
const { t } = require('../../utils/i18n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción o lista desde YouTube, SoundCloud o Spotify')
    .addStringOption(option =>
      option.setName('buscar')
        .setDescription('Nombre de la canción o enlace (URL)')
        .setRequired(false)
    ),
  async execute(interaction) {
    let query = interaction.options.getString('buscar') || interaction.options.getString('query');

    const guildData = db.getGuild(interaction.guildId);
    const isSetupChannel = guildData && guildData.setup_channel_id === interaction.channelId;

    // Make the response private if asking for PIN or if in the setup channel
    if (!query || isSetupChannel) {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    } else {
      await interaction.deferReply();
    }

    const member = interaction.member;
    if (!member.voice.channelId) {
      return interaction.editReply(t(interaction.guildId, 'errors.mustBeInVoice'));
    }

    const manager = getManager();
    let queryClean = query;
    if (queryClean && !queryClean.startsWith('http')) {
      // Default to YouTube Music with authenticated OAuth client
      queryClean = `ytmsearch:${queryClean}`;
    }

    // Create or get player
    const player = manager.createPlayer({
      guildId: interaction.guildId,
      voiceChannelId: member.voice.channelId,
      textChannelId: interaction.channelId,
      selfDeaf: true,
    });

    if (player.state !== 'CONNECTED') await player.connect();

    // Fetch initial volume from db
    const guildDb = db.getGuild(interaction.guildId);
    if (guildDb) {
      player.setVolume(guildDb.volume);
      player.set('autoplay', guildDb.autoplay === 1);
    }

    // If no query, this is a dashboard login request
    if (!queryClean) {
      const pin = authStore.createPinForUser(interaction.user);
      // Construct public URL, fallback to default or request host if we could inject it (we can't easily here)
      const domain = process.env.PUBLIC_URL || 'https://tussi.zarpil.dev'; 
      return interaction.editReply(
        t(interaction.guildId, 'commands.play.webAccessTitle') + '\n\n' +
        t(interaction.guildId, 'commands.play.webAccessDesc', { domain, pin })
      );
    }

    try {
      console.log(`[Bot] Buscando: ${queryClean}`);
      
      const nodes = manager.nodeManager.nodes;
      if (nodes.size === 0) return interaction.editReply(t(interaction.guildId, 'errors.noLavalinkNodes'));
      const node = [...nodes.values()][0];
      
      let res = await node.search(queryClean, interaction.user);

      // If initial search had no results and it wasn't a direct URL, fallback to Spotify/YouTube
      if ((res.loadType === 'empty' || res.loadType === 'error') && !query.startsWith('http')) {
        console.log(`[Bot] Fallback buscando en Spotify: spsearch:${query}`);
        res = await node.search(`spsearch:${query}`, interaction.user);
      }

      console.log(`[Bot] Resultado: ${res.loadType} (${res.tracks?.length || 0} pistas)`);

      if (res.loadType === 'empty') {
        return interaction.editReply(t(interaction.guildId, 'errors.noResults', { query: queryClean }));
      }

      if (res.loadType === 'error') {
        return interaction.editReply(t(interaction.guildId, 'errors.searchError'));
      }

      if (res.loadType === 'playlist') {
        for (const track of res.tracks) {
          await player.queue.add(track);
        }
        if (!player.playing) {
          await player.play({ track: res.tracks[0] });
        }
        return interaction.editReply(t(interaction.guildId, 'commands.play.playlistAdded', { title: res.playlist.title, count: res.tracks.length }));
      }

      // If 'search' or 'track'
      const track = res.tracks[0];
      await player.queue.add(track);

      if (!player.queue.current) {
        await player.play();
      }

      syncState(interaction.client, player);

      return interaction.editReply(t(interaction.guildId, 'commands.play.enqueued', { title: track.info.title }));

    } catch (err) {
      console.error(err);
      return interaction.editReply(t(interaction.guildId, 'errors.playError'));
    }
  },
};
