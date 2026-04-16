'use strict';

const { Router } = require('express');
const axios = require('axios');

const router = Router();

// Simple in-memory cache for lyrics
const lyricsCache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

/**
 * Clean track title and artist names from common YouTube/Spotify clutter
 */
function cleanName(text) {
    if (!text) return '';
    return text
        .replace(/\(Official Video.*?\)/gi, '')
        .replace(/\(Video Oficial.*?\)/gi, '')
        .replace(/\bVIDEOCLIP\b/gi, '')
        .replace(/\(Official Audio.*?\)/gi, '')
        .replace(/\(Lyric Video.*?\)/gi, '')
        .replace(/\(Lyrics.*?\)/gi, '')
        .replace(/\[Official Video.*?\]/gi, '')
        .replace(/\[Lyric Video.*?\]/gi, '')
        .replace(/\(.*?\)/g, '') // Remove any other parentheses
        .replace(/\[.*?\]/g, '') // Remove any brackets
        .replace(/\bfeat\..*?\b/gi, '')
        .replace(/\bft\..*?\b/gi, '')
        .replace(/ - Remastered\b/gi, '')
        .replace(/ - HD\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Parse LRC format into structured JSON
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
            
            const time = minutes * 60 + seconds + (ms / (match[3].length === 2 ? 100 : 1000));
            const text = line.replace(timeRegex, '').trim();
            if (text) {
                parsed.push({ time, text });
            }
        }
    }
    return parsed.sort((a, b) => a.time - b.time);
}

/**
 * Perform the actual request to LRCLIB
 */
async function getLyricsFromLRCLIB(artist, title, durationMs) {
    const durationSec = durationMs ? Math.round(durationMs / 1000) : null;
    
    // Strategy 1: Strict Get (Best for sync)
    try {
        const res = await axios.get('https://lrclib.net/api/get', {
            params: {
                artist_name: artist,
                track_name: title,
                duration: durationSec || undefined
            },
            timeout: 3000
        });
        if (res.data) return res.data;
    } catch (e) {}

    // Strategy 2: Clean and Search
    const cleanTitle = cleanName(title);
    const cleanArtist = cleanName(artist);
    
    // Try Get again with cleaned names
    if (cleanTitle !== title || cleanArtist !== artist) {
        try {
            const res = await axios.get('https://lrclib.net/api/get', {
                params: {
                    artist_name: cleanArtist,
                    track_name: cleanTitle,
                    duration: durationSec || undefined
                },
                timeout: 3000
            });
            if (res.data) return res.data;
        } catch (e) {}
    }

    // Strategy 3: Global Search Fallback
    try {
        const query = `${cleanArtist} ${cleanTitle}`.trim();
        const searchRes = await axios.get('https://lrclib.net/api/search', {
            params: { q: query },
            timeout: 4000
        });

        if (searchRes.data && searchRes.data.length > 0) {
            // Find the best duration match (±10s)
            if (durationSec) {
                const bestMatch = searchRes.data.find(item => 
                    Math.abs(item.duration - durationSec) <= 10 && item.syncedLyrics
                ) || searchRes.data[0];
                return bestMatch;
            }
            return searchRes.data[0];
        }
    } catch (e) {}

    return null;
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

    console.log(`[Lyrics] High-precision lookup for: ${artist} - ${title}`);
    
    const data = await getLyricsFromLRCLIB(artist, title, duration ? parseInt(duration) : null);

    if (!data) {
        console.log(`[Lyrics] Still not found after fallback for: ${title}`);
        return res.status(404).json({ error: 'Lyrics not found' });
    }

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
});

module.exports = router;
