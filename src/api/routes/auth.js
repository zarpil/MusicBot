'use strict';

const { Router } = require('express');
const authStore = require('../../bot/utils/authStore');

const router = Router();

// ── POST /api/auth/login
// Exchanges a 6-digit PIN for a secure session token
router.post('/login', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'Falta el PIN' });
  }

  const result = authStore.exchangePinForToken(pin);
  if (!result) {
    return res.status(401).json({ error: 'PIN inválido o expirado' });
  }

  return res.json({
    token: result.token,
    user: result.user
  });
});

// ── GET /api/auth/me
// Returns current user info if token is valid
router.get('/me', (req, res) => {
  // Read token from headers (e.g. "Authorization: Bearer <token>")
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const token = authHeader.split(' ')[1];
  const user = authStore.getUserFromToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  return res.json(user);
});

module.exports = router;
