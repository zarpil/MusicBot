'use strict';

const { Router } = require('express');
const router = Router();

// ── GET /api/guilds
// Returns all guilds the bot is in
router.get('/', (req, res) => {
  const client = req.app.locals.discord;
  const guilds = client.guilds.cache.map(g => ({
    id:   g.id,
    name: g.name,
    icon: g.iconURL({ size: 64, extension: 'webp' }),
    memberCount: g.memberCount,
  }));
  res.json(guilds);
});

// ── GET /api/guilds/:id/player
// Returns current player state for a guild
router.get('/:id/player', (req, res) => {
  try {
    const manager = req.app.locals.getManager();
    const player  = manager.players.get(req.params.id);

    if (!player) {
      return res.json({ active: false });
    }

    function serializeTrack(track) {
      if (!track) return null;
      return {
        encoded:    track.encoded,
        title:      track.info.title,
        author:     track.info.author,
        duration:   track.info.duration,
        uri:        track.info.uri,
        artworkUrl: track.info.artworkUrl || null,
        sourceName: track.info.sourceName,
        isStream:   track.info.isStream,
      };
    }

    return res.json({
      active:   true,
      guildId:  player.guildId,
      playing:  player.playing,
      paused:   player.paused,
      volume:   player.volume,
      position: player.position,
      autoplay: player.get('autoplay') ?? false,
      current:  serializeTrack(player.queue.current),
      queue:    (player.queue.tracks || []).map(serializeTrack),
    });
  } catch (err) {
    // Manager might not be ready
    return res.json({ active: false, error: err.message });
  }
});

module.exports = router;
