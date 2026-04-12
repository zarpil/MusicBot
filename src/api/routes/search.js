'use strict';

const { Router } = require('express');
const axios      = require('axios');

const router = Router();

// Spotify token cache
let spotifyToken = null;
let spotifyTokenExpiresAt = 0;

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  if (spotifyToken && Date.now() < spotifyTokenExpiresAt) {
    return spotifyToken;
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        },
      }
    );

    spotifyToken = response.data.access_token;
    spotifyTokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;
    return spotifyToken;
  } catch (err) {
    console.error('[Spotify] Error fetching token:', err.message);
    return null;
  }
}

// GET /api/search?q=...&source=youtube|soundcloud|spotify
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const source = req.query.source || 'youtube';
  const limit  = parseInt(req.query.limit || '20', 10);
  const offset = parseInt(req.query.offset || '0', 10);

  if (!q) return res.status(400).json({ error: 'q is required' });

  const manager = req.app.locals.getManager();

  try {
    if (source === 'spotify') {
      const token = await getSpotifyToken();
      if (!token) return res.status(500).json({ error: 'Spotify API not configured' });

      const response = await axios.get('https://api.spotify.com/v1/search', {
        params: { q, type: 'track', limit, offset },
        headers: { Authorization: `Bearer ${token}` },
      });

      const tracks = response.data.tracks.items.map(t => ({
        sourceName: 'spotify',
        title: t.name,
        author: t.artists.map(a => a.name).join(', '),
        uri: t.external_urls.spotify,
        artworkUrl: t.album.images[0]?.url || null,
        duration: t.duration_ms,
        // We include a generic search query to help lavalink find it on YT later
        _searchQuery: `ytmsearch:${t.artists[0]?.name} ${t.name}`,
      }));

      return res.json({ loadType: 'search', tracks });
    }

    // Default to Lavalink search (ytsearch, ytmsearch, scsearch)
    let searchPrefix = `ytsearch[${limit}]`;
    if (source === 'youtube')    searchPrefix = `ytsearch[${limit}]`;
    if (source === 'soundcloud') searchPrefix = `scsearch[${limit}]`;

    // If it's a URL, no prefix
    const query = q.startsWith('http') ? q : `${searchPrefix}:${q}`;
    
    // We need a dummy requester, standard Lavalink-client usage
    if (!manager || !manager.nodeManager) {
      return res.status(500).json({ error: 'Lavalink Manager not initialized' });
    }

    const nodes = manager.nodeManager.nodes;
    if (!nodes || nodes.size === 0) {
      return res.status(500).json({ error: 'No Lavalink nodes connected' });
    }
    
    const node = [...nodes.values()][0];
    if (!node) return res.status(500).json({ error: 'No active Lavalink node' });

    console.log(`[API] Searching YouTube for: "${query}" using node: ${node.id}`);
    let result = null;
    
    try {
      result = await node.search(query, 'dashboard');
    } catch (err) {
      console.warn(`[API] First search attempt failed for "${query}": ${err.message}`);
    }

    // Intelligent Fallback: if ytsearch returns 0 OR fails with an error, try ytmsearch (better for servers)
    if (source === 'youtube' && (!result || !result.tracks || result.tracks.length === 0)) {
      console.warn(`[API] Search "${query}" resulted in error or empty results. Falling back to YouTube Music...`);
      const fallbackQuery = `ytmsearch:${q}`;
      try {
        result = await node.search(fallbackQuery, 'dashboard');
      } catch (fallbackErr) {
        console.error(`[API] Fallback search also failed:`, fallbackErr.message);
      }
    }

    if (!result || !result.tracks || result.tracks.length === 0) {
      console.warn(`[API] All search attempts failed for: "${q}"`);
      return res.json({ loadType: 'empty', tracks: [] });
    }

    const tracks = result.tracks.map(track => ({
      encoded: track.encoded,
      title: track.info.title,
      author: track.info.author,
      duration: track.info.duration,
      uri: track.info.uri,
      artworkUrl: track.info.artworkUrl,
      sourceName: track.info.sourceName,
    }));

    console.log(`[API] Search successful, found ${tracks.length} tracks`);
    res.json({ loadType: result.loadType, tracks: tracks.slice(0, limit) });
  } catch (err) {
    console.error(`[API] Search CRASH for "${req.query.q}":`, err);
    res.status(500).json({ error: 'Error interno al buscar la canción. Inténtalo de nuevo.' });
  }
});

module.exports = router;
