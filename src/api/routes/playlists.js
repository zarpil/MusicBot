'use strict';

const { Router } = require('express');
const router = Router();
const db     = require('../../db/database');

// ── GET /api/playlists/:guildId
router.get('/:guildId', (req, res) => {
  try {
    const playlists = db.getPlaylists(req.params.guildId);
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/playlists/details/:id
router.get('/details/:id', (req, res) => {
  try {
    const playlist = db.getPlaylist(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    
    const tracks = db.getPlaylistTracks(req.params.id);
    res.json({ ...playlist, tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/playlists
router.post('/', (req, res) => {
  try {
    const { guildId, name, description, tracks } = req.body;
    const user = req.user; // From requireAuth middleware

    if (!guildId || !name) return res.status(400).json({ error: 'guildId and name are required' });

    const creator = {
      id: user.id,
      name: user.username,
      avatar: user.avatar
    };

    const playlist = db.createPlaylist(guildId, name, description || '', creator);

    // If tracks provided, add them
    if (tracks && Array.isArray(tracks)) {
      for (const t of tracks) {
        db.addTrackToPlaylist(playlist.id, t);
      }
    }

    res.status(201).json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/playlists/:id
router.delete('/:id', (req, res) => {
  try {
    const playlist = db.getPlaylist(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    // Validate creator (User from JWT vs Playlist creator_id)
    if (playlist.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el creador puede borrar esta lista' });
    }

    db.deletePlaylist(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/playlists/:id/tracks
router.post('/:id/tracks', (req, res) => {
    try {
      const playlist = db.getPlaylist(req.params.id);
      if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  
      if (playlist.creator_id !== req.user.id) {
        return res.status(403).json({ error: 'Solo el creador puede editar esta lista' });
      }
  
      const { track } = req.body;
      db.addTrackToPlaylist(req.params.id, track);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/playlists/:id/tracks/:trackId
router.delete('/:id/tracks/:trackId', (req, res) => {
    try {
      const playlist = db.getPlaylist(req.params.id);
      if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  
      if (playlist.creator_id !== req.user.id) {
        return res.status(403).json({ error: 'Solo el creador puede editar esta lista' });
      }
  
      db.removeTrackFromPlaylist(req.params.trackId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/playlists/:id/reorder
router.put('/:id/reorder', (req, res) => {
    try {
      const playlist = db.getPlaylist(req.params.id);
      if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  
      if (playlist.creator_id !== req.user.id) {
        return res.status(403).json({ error: 'Solo el creador puede editar esta lista' });
      }
  
      const { trackIds } = req.body;
      if (!trackIds || !Array.isArray(trackIds)) {
        return res.status(400).json({ error: 'trackIds array is required' });
      }
  
      db.reorderPlaylistTracks(req.params.id, trackIds);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

module.exports = router;
