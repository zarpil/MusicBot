'use strict';

const { Router } = require('express');
const db         = require('../../db/database');

const router = Router();

// ── Playlists ─────────────────────────────────────────────────────────────────

// GET /api/playlists?guildId=xxx
router.get('/', (req, res) => {
  const guildId = req.query.guildId;
  if (!guildId) return res.status(400).json({ error: 'guildId is required' });

  try {
    const playlists = db.getPlaylists(guildId);
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/playlists
router.post('/', (req, res) => {
  const { guildId, name, description } = req.body;
  if (!guildId || !name) return res.status(400).json({ error: 'guildId and name are required' });

  try {
    db.upsertGuild(guildId); // Ensure guild exists
    const playlist = db.createPlaylist(guildId, name, description);
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/playlists/:id
router.delete('/:id', (req, res) => {
  try {
    db.deletePlaylist(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Playlist Tracks ───────────────────────────────────────────────────────────

// GET /api/playlists/:id/tracks
router.get('/:id/tracks', (req, res) => {
  try {
    const tracks = db.getPlaylistTracks(req.params.id);
    res.json(tracks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/playlists/:id/tracks
router.post('/:id/tracks', (req, res) => {
  const { track } = req.body;
  if (!track || !track.uri) return res.status(400).json({ error: 'track object with uri is required' });

  try {
    db.addTrackToPlaylist(req.params.id, track);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/playlists/tracks/:trackId
router.delete('/tracks/:trackId', (req, res) => {
  try {
    db.removeTrackFromPlaylist(req.params.trackId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
