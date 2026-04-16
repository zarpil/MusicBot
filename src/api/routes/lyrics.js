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
 * Perform the actual request to LRCLIB with multiple fallback and scoring strategies
 */
async function getLyricsFromLRCLIB(artist, title, durationMs) {
    const durationSec = durationMs ? Math.round(durationMs / 1000) : null;
    let cleanArtist = cleanName(artist);
    let cleanTitle = cleanName(title);
    
    const axiosConfig = {
        headers: { 'User-Agent': 'TussiMusicBot/2.0 (HighPrecisionHunter)' },
        timeout: 4000
    };

    // Strategy: Remove redundant artist name from title
    if (cleanTitle.toLowerCase().includes(cleanArtist.toLowerCase())) {
        const regex = new RegExp(cleanArtist.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        cleanTitle = cleanTitle.replace(regex, '').trim();
        cleanTitle = cleanTitle.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').trim();
        if (!cleanTitle) cleanTitle = cleanName(title);
    }
    
    // Strategy 1: Strict Get (Sequential because it's fast and highly precise)
    try {
        console.log(`[Lyrics/Hunter] Attempt 1 (Strict): "${cleanArtist}" - "${cleanTitle}" (${durationSec}s)`);
        const res = await axios.get('https://lrclib.net/api/get', {
            ...axiosConfig,
            params: { artist_name: cleanArtist, track_name: cleanTitle, duration: durationSec || undefined }
        });
        if (res.data) {
            console.log(`[Lyrics/Hunter] ✅ Strict Match Found: ${res.data.trackName} - ${res.data.artistName}`);
            return res.data;
        }
    } catch (e) {}

    // Strategy 2: Parallel Search with Scoring
    const searchPatterns = [
        `${cleanArtist} ${cleanTitle}`,
        cleanTitle,
        `${cleanArtist} ${cleanTitle.replace(/\s/g, '')}`
    ];

    try {
        console.log(`[Lyrics/Hunter] Attempt 2 (Parallel Search): Queries: [${searchPatterns.join(', ')}]`);
        // execute all search queries in parallel
        const searchPromises = searchPatterns.map(query => 
            axios.get('https://lrclib.net/api/search', {
                ...axiosConfig,
                params: { q: query }
            }).catch(() => ({ data: [] }))
        );

        const results = await Promise.all(searchPromises);
        let bestCandidate = null;
        let highestScore = 0;

        // Flatten all results from different search patterns
        const allTracks = results.flatMap(r => r.data || []);
        console.log(`[Lyrics/Hunter] Found ${allTracks.length} candidates in total. Scoring...`);

        for (const item of allTracks) {
            let score = 0;
            const normArtist = normalize(item.artistName);
            const normCleanArtist = normalize(cleanArtist);
            const normTitle = normalize(item.trackName);
            const normCleanTitle = normalize(cleanTitle);

            // Artist score
            if (normArtist === normCleanArtist) score += 50;
            else if (isSimilar(normArtist, normCleanArtist)) score += 20;

            // Title score
            if (normTitle === normCleanTitle) score += 50;
            else if (isSimilar(normTitle, normCleanTitle)) score += 20;

            // Duration score
            if (durationSec) {
                const diff = Math.abs(item.duration - durationSec);
                if (diff <= 2) score += 20;
                else if (diff <= 10) score += 10;
                else if (diff <= 20) score += 5;
            }

            // Penalty
            if (normTitle === normCleanTitle && normArtist !== normCleanArtist && !isSimilar(normArtist, normCleanArtist)) {
                score -= 30;
            }

            if (score > highestScore) {
                highestScore = score;
                bestCandidate = item;
            }
        }

        if (bestCandidate && highestScore > 40) {
            console.log(`[Lyrics/Hunter] ✅ Best Match Picked: ${bestCandidate.trackName} - ${bestCandidate.artistName} (Score: ${highestScore})`);
            return bestCandidate;
        }
    } catch (e) {
        console.error('[Lyrics/Hunter] ❌ Parallel search error:', e.message);
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
