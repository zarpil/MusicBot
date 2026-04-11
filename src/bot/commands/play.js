'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción o lista desde YouTube, SoundCloud o Spotify')
    .addStringOption(option =>
      option.setName('buscar')
        .setDescription('Nombre de la canción o enlace (URL)')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const member = interaction.member;
    if (!member.voice.channelId) {
      return interaction.editReply('¡Debes estar en un canal de voz para reproducir música!');
    }

    const manager = getManager();
    let query = interaction.options.getString('buscar') || interaction.options.getString('query');
 
    if (!query) {
      return interaction.editReply('❌ ¡Debes especificar una canción o un enlace!');
    }
 
    if (!query.startsWith('http')) query = `ytsearch:${query}`;

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

    try {
      console.log(`[Bot] Buscando: ${query}`);
      
      const nodes = manager.nodeManager.nodes;
      if (nodes.size === 0) return interaction.editReply('❌ No hay nodos de Lavalink conectados.');
      const node = [...nodes.values()][0];
      
      const res = await node.search(query, interaction.user);
      console.log(`[Bot] Resultado: ${res.loadType} (${res.tracks?.length || 0} pistas)`);

      if (res.loadType === 'empty') {
        return interaction.editReply(`No se han encontrado resultados para \`${query}\`.`);
      }

      if (res.loadType === 'error') {
        return interaction.editReply('Ha ocurrido un error al buscar la canción.');
      }

      if (res.loadType === 'playlist') {
        for (const track of res.tracks) {
          await player.queue.add(track);
        }
        if (!player.playing) {
          await player.play({ track: res.tracks[0] });
        }
        return interaction.editReply(`✅ Añadida la lista **${res.playlist.title}** (${res.tracks.length} canciones).`);
      }

      // If 'search' or 'track'
      const track = res.tracks[0];
      await player.queue.add(track);

      if (!player.queue.current) {
        await player.play();
      }

      return interaction.editReply(`✅ En cola: **${track.info.title}**`);

    } catch (err) {
      console.error(err);
      return interaction.editReply('Ha ocurrido un error al intentar reproducir la canción.');
    }
  },
};
