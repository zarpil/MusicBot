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
    
    // 1. Artist-specific cleaning (YouTube "Topic" channels)
    text = text.replace(/\s*-\s*Topic\s*$/gi, '');

    // 2. Extra metadata removal (Hashtags, Social Credits)
    text = text
        .replace(/#\w+/g, '') // Remove hashtags like #drill #official
        .replace(/@\w+/g, '') // Remove user handles
        .replace(/\b(shot\.?|directed|dir\.?|produced|prod\.?|by|edit|music|video)\s+by\b.*$/gi, '') // Remove visual/social credits
        .replace(/\b(official\s+video|official\s+audio|official\s+lyric\s+video|video\s+oficial|videoclip)\b/gi, '');

    // 3. Extract title if format is "Artist - Title" (common in YT titles)
    if (text.includes(' - ')) {
        const parts = text.split(' - ');
        text = parts[parts.length - 1];
    }

    // 4. Common music cleanups
    return text
        .replace(/^\d+[\.\-\s]+/, '') // Leading track numbers
        .replace(/\(.*?\)/g, '')      // Text in parentheses
        .replace(/\[.*?\]/g, '')      // Text in brackets
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
 * Perform the actual request to LRCLIB with multiple fallback and scoring strategies
 */
async function getLyricsFromLRCLIB(artist, title, durationMs) {
    const durationSec = durationMs ? Math.round(durationMs / 1000) : null;
    let cleanArtist = cleanName(artist);
    let cleanTitle = cleanName(title);
    
    // Metadata split check: If the title contains the artist (e.g., "Kase.O - Mazas y Catapultas")
    if (title.includes(' - ') && !artist.includes(' - ')) {
        const parts = title.split(' - ');
        const artistInTitle = cleanName(parts[0]);
        const titleInTitle = cleanName(parts[1]);
        if (isSimilar(artistInTitle, cleanArtist)) {
            cleanTitle = titleInTitle;
        }
    }

    const axiosConfig = {
        headers: { 'User-Agent': 'TussiMusicBot/3.0 (PrecisionHunterV3)' },
        timeout: 4000
    };

    // Strategy 1: Strict Get (High precision)
    try {
        console.log(`[Lyrics/Hunter] Attempt 1 (Strict): "${cleanArtist}" - "${cleanTitle}" (${durationSec}s)`);
        const res = await axios.get('https://lrclib.net/api/get', {
            ...axiosConfig,
            params: { artist_name: cleanArtist, track_name: cleanTitle, duration: durationSec || undefined }
        });
        if (res.data) {
            console.log(`[Lyrics/Hunter] ✅ Strict Match Found!`);
            return res.data;
        }
    } catch (e) {}

    // Strategy 2: Sequential Deep Search with Critical Scoring
    const searchPatterns = [
        `${cleanArtist} ${cleanTitle}`,
        cleanTitle
    ];

    let bestCandidate = null;
    let highestScore = 0;

    for (const query of searchPatterns) {
        try {
            console.log(`[Lyrics/Hunter] Searching: "${query}"...`);
            const searchRes = await axios.get('https://lrclib.net/api/search', {
                ...axiosConfig,
                params: { q: query }
            });

            const tracks = searchRes.data || [];
            for (const item of tracks) {
                let score = 0;
                const normArtist = normalize(item.artistName);
                const normCleanArtist = normalize(cleanArtist);
                const normTitle = normalize(item.trackName);
                const normCleanTitle = normalize(cleanTitle);

                // Artist score (Max 50)
                if (normArtist === normCleanArtist) {
                    score += 50;
                } else if (isSimilar(normArtist, normCleanArtist) || normCleanArtist.includes(normArtist) || normArtist.includes(normCleanArtist)) {
                    score += 35;
                } else {
                    // Massive penalty for completely different artists
                    score -= 100;
                }

                // Title score (Max 50)
                if (normTitle === normCleanTitle) {
                    score += 50;
                } else if (isSimilar(normTitle, normCleanTitle)) {
                    score += 30;
                }

                // Duration score (Max 20)
                if (durationSec) {
                    const diff = Math.abs(item.duration - durationSec);
                    if (diff <= 2) score += 20;
                    else if (diff <= 8) score += 10;
                    else if (diff > 30) score -= 30; // Significant penalty for wrong duration
                }

                if (score > highestScore) {
                    highestScore = score;
                    bestCandidate = item;
                }
            }

            // Early exit for perfect match
            if (highestScore >= 100) {
                console.log(`[Lyrics/Hunter] ✅ Perfect match found. Stopping.`);
                break;
            }
        } catch (e) {
            console.error(`[Lyrics/Hunter] Search error:`, e.message);
        }
    }

    if (bestCandidate && highestScore >= 45) {
        console.log(`[Lyrics/Hunter] ✅ Picked: ${bestCandidate.trackName} - ${bestCandidate.artistName} (Score: ${highestScore})`);
        return bestCandidate;
    }

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
