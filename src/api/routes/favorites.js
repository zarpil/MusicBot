'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../../db/database');

/**
 * GET /api/favorites
 * Returns the favorites for the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = db.getUserFavorites(userId);
    res.json(favorites);
  } catch (err) {
    console.error('[API] Error grabbing favorites:', err);
    res.status(500).json({ error: 'Failed to Load favorites' });
  }
});

/**
 * POST /api/favorites
 * Checks if a track is favorited for the authenticated user.
 */
router.get('/check', (req, res) => {
  try {
    const userId = req.user.id;
    const { uri } = req.query;
    if (!uri) return res.status(400).json({ error: 'Missing track uri' });
    
    const isFav = db.isFavorite(userId, uri);
    res.json({ isFavorite: isFav });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/favorites
 * Adds a track to favorites.
 */
router.post('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { track } = req.body;
    
    if (!track || !track.uri) {
      return res.status(400).json({ error: 'Invalid track data' });
    }
    
    db.addFavorite(userId, track);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Error adding favorite:', err);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

/**
 * DELETE /api/favorites
 * Removes a track from favorites.
 */
router.delete('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { uri } = req.body;
    
    if (!uri) {
      return res.status(400).json({ error: 'Missing track uri' });
    }
    
    db.removeFavorite(userId, uri);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Error removing favorite:', err);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

module.exports = router;
