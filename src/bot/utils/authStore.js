'use strict';
const crypto = require('crypto');

// Map: PIN (String) -> User Data (Object)
const pendingPins = new Map();

// Map: Token (String) -> User Data (Object)
const validSessions = new Map();

/**
 * Generate a 6 digit PIN linked to the user.
 * Expires after 5 minutes.
 */
function createPinForUser(user) {
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  pendingPins.set(pin, {
    id: user.id,
    username: user.username,
    avatar: user.displayAvatarURL ? user.displayAvatarURL() : null,
    createdAt: Date.now()
  });

  // Expire after 5 minutes
  setTimeout(() => {
    pendingPins.delete(pin);
  }, 5 * 60 * 1000);

  return pin;
}

/**
 * Validates a PIN. If valid, generates a session token and destroys the PIN.
 */
function exchangePinForToken(pin) {
  // Convert to string just in case
  const pinStr = String(pin).trim();
  const userData = pendingPins.get(pinStr);
  if (!userData) return null;

  pendingPins.delete(pinStr); // One-time use

  const token = crypto.randomUUID();
  // Persistent session in-memory (lasts until bot restart)
  validSessions.set(token, {
    ...userData,
    authenticatedAt: Date.now()
  });

  return { token, user: userData };
}

function getUserFromToken(token) {
  if (!token) return null;
  return validSessions.get(token);
}

module.exports = {
  createPinForUser,
  exchangePinForToken,
  getUserFromToken
};
