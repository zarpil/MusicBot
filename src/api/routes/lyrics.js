'use strict';

const { Router } = require('express');
const axios = require('axios');

const router = Router();

// Simple in-memory cache for lyrics
const lyricsCache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

/**
 * Normalizes a string for comparison (lowercase, no symbols, no spaces)
 */
function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if two strings are similar enough
 */
function isSimilar(s1, s2) {
    const n1 = normalize(s1);
    const n2 = normalize(s2);
    return n1.includes(n2) || n2.includes(n1);
}

/**
 * Clean track title and artist names from common YouTube/Spotify clutter
 */
function cleanName(text) {
    if (!text) return '';
    // Special case: if it contains " - ", try to extract the title part
    if (text.includes(' - ')) {
        const parts = text.split(' - ');
        // Usually the second part is the track name
        text = parts[parts.length - 1];
    }

    return text
        .replace(/^\d+[\.\-\s]+/, '') // Remove leading numbers (e.g., "10. ", "01 - ")
        .replace(/\b(prod\.?|produced by|prod de|producción de)\b.*$/gi, '') // Remove everything from "Prod" onwards
        .replace(/\(Official Video.*?\)/gi, '')
        .replace(/\(Video Oficial.*?\)/gi, '')
        .replace(/\bVIDEOCLIP\b/gi, '')
        .replace(/\(Official Audio.*?\)/gi, '')
        .replace(/\(Lyric Video.*?\)/gi, '')
        .replace(/\(Lyrics.*?\)/gi, '')
        .replace(/\[Official Video.*?\]/gi, '')
        .replace(/\[Lyric Video.*?\]/gi, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
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
 * Perform the actual request to LRCLIB with multiple fallback strategies
 */
async function getLyricsFromLRCLIB(artist, title, durationMs) {
    const durationSec = durationMs ? Math.round(durationMs / 1000) : null;
    const cleanTitle = cleanName(title);
    const cleanArtist = cleanName(artist);
    
    // Strategy 1: Strict Get
    try {
        const res = await axios.get('https://lrclib.net/api/get', {
            params: { artist_name: cleanArtist, track_name: cleanTitle, duration: durationSec || undefined },
            timeout: 3000
        });
        if (res.data) return res.data;
    } catch (e) {}

    // Strategy 2: Global Search with different patterns
    const searchPatterns = [
        `${cleanArtist} ${cleanTitle}`,               // "Nadal015 Street Shark"
        cleanTitle,                                    // "Street Shark"
        `${cleanArtist} ${cleanTitle.replace(/\s/g, '')}` // "Nadal015 Streetshark" (Handle joined words)
    ];

    for (const query of searchPatterns) {
        try {
            const searchRes = await axios.get('https://lrclib.net/api/search', {
                params: { q: query },
                timeout: 4000
            });

            if (searchRes.data && searchRes.data.length > 0) {
                // Find best match in results
                let bestMatch = null;
                for (const item of searchRes.data) {
                    const artistMatch = isSimilar(item.artistName, cleanArtist);
                    const titleMatch = isSimilar(item.trackName, cleanTitle) || isSimilar(item.trackName, cleanTitle.replace(/\s/g, ''));
                    const durationDiff = durationSec ? Math.abs(item.duration - durationSec) : 0;

                    // If it's a strong match (Artist and Title similar enough and within duration range)
                    if (titleMatch && (artistMatch || durationDiff < 10)) {
                        bestMatch = item;
                        break;
                    }
                }
                
                if (bestMatch) {
                    // Fetch full data for the best match using ID
                    const detailRes = await axios.get(`https://lrclib.net/api/get/${bestMatch.id}`);
                    return detailRes.data;
                }
            }
        } catch (e) {}
    }

    // Strategy 4: Reverse Search (Title only, then filter by artist)
    try {
        const searchRes = await axios.get('https://lrclib.net/api/search', {
            params: { q: cleanTitle },
            timeout: 4000
        });

        if (searchRes.data && searchRes.data.length > 0) {
            const bestMatch = searchRes.data.find(item => 
                isSimilar(item.artistName, cleanArtist) && 
                (isSimilar(item.trackName, cleanTitle) || (durationSec && Math.abs(item.duration - durationSec) < 15))
            );
            if (bestMatch) {
                const detailRes = await axios.get(`https://lrclib.net/api/get/${bestMatch.id}`);
                return detailRes.data;
            }
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

    console.log(`[Lyrics] Advanced Hunter lookup for: ${artist} - ${title}`);
    
    const data = await getLyricsFromLRCLIB(artist, title, duration ? parseInt(duration) : null);

    if (!data) {
        console.log(`[Lyrics] Fail to hunt lyrics for: ${title}`);
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
