'use strict';

const { Router } = require('express');
const axios = require('axios');

const router = Router();

// Simple in-memory cache for lyrics
const lyricsCache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

/**
 * Parse LRC format into structured JSON
 * [00:12.34] Line text -> { time: 12.34, text: "Line text" }
 */
function parseLRC(lrc) {
    if (!lrc) return [];
    const lines = lrc.split('\n');
    const parsed = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    for (const line of lines) {
        const match = line.match(timeRegex);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const ms = parseInt(match[3]);
            
            // Handle both .ms (2 digits) and .ms (3 digits)
            const time = minutes * 60 + seconds + (ms / (match[3].length === 2 ? 100 : 1000));
            const text = line.replace(timeRegex, '').trim();
            if (text) {
                parsed.push({ time, text });
            }
        }
    }
    return parsed.sort((a, b) => a.time - b.time);
}

router.get('/', async (req, res) => {
    const { title, artist, duration } = req.query;

    if (!title || !artist) {
        return res.status(400).json({ error: 'Title and Artist are required' });
    }

    const cacheKey = `${artist}-${title}`.toLowerCase();
    const cached = lyricsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.json(cached.data);
    }

    try {
        console.log(`[Lyrics] Searching for: ${artist} - ${title}`);
        
        // Search LRCLIB
        // We use the 'get' endpoint with signature for best precision
        const response = await axios.get('https://lrclib.net/api/get', {
            params: {
                artist_name: artist,
                track_name: title,
                // album_name: album, // Optional
                duration: duration ? Math.round(duration / 1000) : undefined
            },
            timeout: 5000
        });

        const data = response.data;
        const result = {
            id: data.id,
            trackName: data.trackName,
            artistName: data.artistName,
            plainLyrics: data.plainLyrics,
            syncedLyrics: parseLRC(data.syncedLyrics),
            isInstrumental: !data.plainLyrics && !data.syncedLyrics
        };

        lyricsCache.set(cacheKey, {
            timestamp: Date.now(),
            data: result
        });

        res.json(result);
    } catch (err) {
        if (err.response?.status === 404) {
            console.log(`[Lyrics] Not found for: ${artist} - ${title}`);
            return res.status(404).json({ error: 'Lyrics not found' });
        }
        console.error('[Lyrics] Error fetching from LRCLIB:', err.message);
        res.status(500).json({ error: 'Error fetching lyrics' });
    }
});

module.exports = router;
