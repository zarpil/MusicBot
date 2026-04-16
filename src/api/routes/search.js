'use strict';

const { Router } = require('express');
const axios      = require('axios');

const router = Router();

// ── Spotify token cache ──────────────────────────────────────────────────────
let spotifyToken = null;
let spotifyTokenExpiresAt = 0;

// ── Spotify results cache (30s TTL to avoid rate limits in Dev Mode) ─────────
const spotifyCache = new Map();
const SPOTIFY_CACHE_TTL_MS = 30_000;

function getCachedSpotify(key) {
  const entry = spotifyCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    spotifyCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedSpotify(key, data) {
  spotifyCache.set(key, { data, expiresAt: Date.now() + SPOTIFY_CACHE_TTL_MS });
  // Cleanup old entries to avoid memory leak
  if (spotifyCache.size > 100) {
    const firstKey = spotifyCache.keys().next().value;
    spotifyCache.delete(firstKey);
  }
}

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[Spotify] Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env');
    return null;
  }

  if (spotifyToken && Date.now() < spotifyTokenExpiresAt) {
    return spotifyToken;
  }

  try {
    console.log('[Spotify] Fetching new access token...');
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        },
      }
    );

    if (response.data && response.data.access_token) {
      spotifyToken = response.data.access_token;
      spotifyTokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;
      console.log('[Spotify] Token refreshed successfully');
      return spotifyToken;
    }
    
    console.error('[Spotify] No access token in response:', response.data);
    return null;
  } catch (err) {
    console.error('[Spotify] Error fetching token:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      console.error('[Spotify] Authentication failed. Check your Client ID and Client Secret.');
    }
    return null;
  }
}

// GET /api/search?q=...&source=youtube|soundcloud|spotify
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const source = req.query.source || 'youtube';
  
  let limit = parseInt(req.query.limit, 10);
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 50) limit = 50;
  
  let offset = parseInt(req.query.offset, 10);
  if (isNaN(offset) || offset < 0) offset = 0;

  if (!q) return res.status(400).json({ error: 'q is required' });

  const manager = req.app.locals.getManager();

  try {
    if (source === 'spotify') {
      // ── Strategy 1: Use LavaSrc via Lavalink (resolves Spotify natively with ISRC matching)
      const nodes = manager?.nodeManager?.nodes;
      const node = nodes && nodes.size > 0 ? [...nodes.values()][0] : null;

      if (node) {
        // If it's a Spotify URL (track, playlist, album), resolve it directly via LavaSrc
        const isSpotifyUrl = q.includes('spotify.com') || q.startsWith('spotify:');
        const lavalinkQuery = isSpotifyUrl ? q : `spsearch:${q}`;
        
        const cacheKey = `lavasrc:${lavalinkQuery}`;
        const cached = getCachedSpotify(cacheKey);
        if (cached) {
          console.log(`[Spotify] Cache hit for "${q}"`);
          return res.json({ loadType: 'search', tracks: cached });
        }

        try {
          console.log(`[Spotify/LavaSrc] Searching: ${lavalinkQuery}`);
          const result = await node.search(lavalinkQuery, 'dashboard');
          
          if (result && result.tracks && result.tracks.length > 0) {
            const tracks = result.tracks.map(t => ({
              encoded: t.encoded,
              sourceName: t.info.sourceName,
              title: t.info.title,
              author: t.info.author,
              uri: t.info.uri,
              artworkUrl: t.info.artworkUrl,
              duration: t.info.duration,
            }));

            setCachedSpotify(cacheKey, tracks);
            
            // For playlist/album loads, return all tracks
            if (result.loadType === 'playlist') {
              const listName = result.playlist?.name || result.playlist?.title || 'Lista de Spotify';
              return res.json({ loadType: 'playlist', tracks, playlistName: listName });
            }
            return res.json({ loadType: 'search', tracks });
          }
        } catch (lavasrcErr) {
          console.warn(`[Spotify/LavaSrc] Failed, falling back to direct API: ${lavasrcErr.message}`);
        }
      }

      // ── Strategy 2: Direct Spotify API fallback (when LavaSrc not available)
      const token = await getSpotifyToken();
      if (!token) return res.status(500).json({ error: 'Spotify API not configured' });

      // Clamp params within Spotify's allowed ranges
      // NOTE: Spotify's Feb 2026 update caps limit to 10 for Development Mode apps
      const spotifyLimit  = Math.min(10, Math.max(1, Number(limit) || 10));
      const spotifyOffset = Math.min(950, Math.max(0, Number(offset) || 0));
      
      // Check cache before hitting the API
      const cacheKey = `${q}:${spotifyLimit}:${spotifyOffset}`;
      const cached = getCachedSpotify(cacheKey);
      if (cached) {
        console.log(`[Spotify] Cache hit for "${q}"`);
        return res.json({ loadType: 'search', tracks: cached });
      }

      // Build URL manually - avoid Axios serialization issues
      const spotifyParams = new URLSearchParams();
      spotifyParams.set('q', q);
      spotifyParams.set('type', 'track');
      spotifyParams.set('limit', spotifyLimit);
      spotifyParams.set('offset', spotifyOffset);
      
      const spotifyUrl = `https://api.spotify.com/v1/search?${spotifyParams.toString()}`;
      console.log(`[Spotify] Direct API fallback: ${spotifyUrl}`);

      const response = await axios.get(spotifyUrl, {
        headers: { 
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      const tracks = response.data.tracks.items.map(t => ({
        sourceName: 'spotify',
        title: t.name,
        author: t.artists.map(a => a.name).join(', '),
        uri: t.external_urls.spotify,
        artworkUrl: t.album.images[0]?.url || null,
        duration: t.duration_ms,
        _searchQuery: `ytmsearch:${t.artists[0]?.name} ${t.name}`,
      }));

      setCachedSpotify(cacheKey, tracks);
      return res.json({ loadType: 'search', tracks });
    }


    // Default to Lavalink search (ytsearch, ytmsearch, scsearch)
    let searchPrefix = 'ytsearch';
    if (source === 'youtube') searchPrefix = 'ytsearch'; // Use standard ytsearch for more results
    if (source === 'soundcloud') searchPrefix = 'scsearch';

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
    const spotifyStatus = err.response?.status;
    if (err.response?.data?.error) {
      console.error('[Spotify] API Error Details:', JSON.stringify(err.response.data.error, null, 2));
    }
    console.error(`[API] Search CRASH for "${req.query.q}":`, err.message);
    
    if (spotifyStatus === 429) {
      return res.status(429).json({ error: 'Spotify rate limit alcanzado. Por favor espera unos segundos.' });
    }
    
    res.status(500).json({ error: 'Error interno al buscar. Revisa la consola del servidor.' });

  }
});

module.exports = router;
