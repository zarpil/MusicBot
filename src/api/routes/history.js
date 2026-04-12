'use strict';

const { Router } = require('express');
const router = Router();
const db     = require('../../db/database');

// ── GET /api/guilds/:id/history
router.get('/:id', (req, res) => {
  try {
    const history = db.getHistory(req.params.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
