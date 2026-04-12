'use strict';
const authStore = require('../../bot/utils/authStore');

/**
 * Express middleware to verify the Bearer token
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const token = authHeader.split(' ')[1];
  const user = authStore.getUserFromToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  // Attach user to request for downstream routes
  req.user = user;
  next();
}

module.exports = { requireAuth };
