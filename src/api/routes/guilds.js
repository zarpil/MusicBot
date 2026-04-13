'use strict';

const { Router } = require('express');
const router = Router();

// ── 5-minute membership cache: userId -> { guilds: [], fetchedAt: timestamp }
const membershipCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── GET /api/guilds
// Returns only guilds where BOTH the bot AND the authenticated user are members.
router.get('/', async (req, res) => {
  const client = req.app.locals.discord;
  const userId = req.user.id;

  // Check cache first
  const cached = membershipCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json(cached.guilds);
  }

  // Build filtered list by checking membership in each guild
  const userGuilds = [];
  for (const guild of client.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        userGuilds.push({
          id:          guild.id,
          name:        guild.name,
          icon:        guild.iconURL({ size: 64, extension: 'webp' }),
          memberCount: guild.memberCount,
        });
      }
    } catch {
      // Skip guilds where we can't check membership
    }
  }

  // Store in cache
  membershipCache.set(userId, { guilds: userGuilds, fetchedAt: Date.now() });

  res.json(userGuilds);
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
      // Requester could be a string (legacy/direct) or a user object
      let requesterInfo = null;
      if (track.requester) {
        if (typeof track.requester === 'object') {
          requesterInfo = {
            username: track.requester.username || track.requester.tag,
            avatar: track.requester.avatar || (track.requester.displayAvatarURL ? track.requester.displayAvatarURL({ size: 32 }) : null)
          };
        } else {
          requesterInfo = { username: track.requester, avatar: null };
        }
      }

      return {
        encoded:    track.encoded,
        title:      track.info.title,
        author:     track.info.author,
        duration:   track.info.duration,
        uri:        track.info.uri,
        artworkUrl: track.info.artworkUrl || null,
        sourceName: track.info.sourceName,
        isStream:   track.info.isStream,
        requester:  requesterInfo,
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
