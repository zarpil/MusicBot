'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getManager } = require('../../lavalink/manager');
const db = require('../../db/database');
const authStore = require('../utils/authStore');

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

    // Make the response private if asking for PIN, public if queuing music
    if (!query) {
      await interaction.deferReply({ ephemeral: true });
    } else {
      await interaction.deferReply();
    }

    const member = interaction.member;
    if (!member.voice.channelId) {
      return interaction.editReply('¡Debes estar en un canal de voz para reproducir música!');
    }

    const manager = getManager();
    let queryClean = query;
    if (queryClean && !queryClean.startsWith('http')) queryClean = `ytsearch:${queryClean}`;

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
        `🔐 **Acceso al Panel Web**\n\n` +
        `El bot se ha unido a tu canal. Para controlar la música desde tu navegador, entra a:\n` +
        `**${domain}**\n\n` +
        `Tu código PIN secreto de 6 dígitos es: \`${pin}\`\n` +
        `*(Este código expira en 5 minutos)*`
      );
    }

    try {
      console.log(`[Bot] Buscando: ${queryClean}`);
      
      const nodes = manager.nodeManager.nodes;
      if (nodes.size === 0) return interaction.editReply('❌ No hay nodos de Lavalink conectados.');
      const node = [...nodes.values()][0];
      
      const res = await node.search(queryClean, interaction.user);
      console.log(`[Bot] Resultado: ${res.loadType} (${res.tracks?.length || 0} pistas)`);

      if (res.loadType === 'empty') {
        return interaction.editReply(`No se han encontrado resultados para \`${queryClean}\`.`);
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
