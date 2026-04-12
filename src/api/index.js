'use strict';

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const path       = require('path');

const { initWsServer } = require('./ws/wsServer');
const { getManager }   = require('../lavalink/manager');

const guildsRouter    = require('./routes/guilds');
const playlistsRouter = require('./routes/playlists');
const searchRouter    = require('./routes/search');
const authRouter      = require('./routes/auth');
const historyRouter   = require('./routes/history');
const { requireAuth } = require('./middleware/auth');

/**
 * Initialise the Express + WebSocket API server.
 * @param {import('discord.js').Client} discordClient
 */
async function initApi(discordClient) {
  const app  = express();
  const PORT = parseInt(process.env.API_PORT || '3001', 10);

  // ── Middleware ─────────────────────────────────────────────────────────────
  app.use(cors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }));
  app.use(express.json());

  // Attach Discord client + Lavalink manager so routes can access them
  app.locals.discord = discordClient;
  app.locals.getManager = getManager;

  // ── API Routes ─────────────────────────────────────────────────────────────
  app.use('/api/auth',      authRouter);
  app.use('/api/guilds',    requireAuth, guildsRouter);
  app.use('/api/playlists', requireAuth, playlistsRouter);
  app.use('/api/history',   requireAuth, historyRouter);
  app.use('/api/search',    requireAuth, searchRouter);

  // Health check
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // ── Static Web Dashboard (production build) ────────────────────────────────
  const webDist = path.join(__dirname, '../../web/dist');
  if (require('fs').existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  // ── HTTP + WebSocket server ────────────────────────────────────────────────
  const httpServer = http.createServer(app);
  initWsServer(httpServer, getManager);

  await new Promise(resolve => httpServer.listen(PORT, resolve));
  console.log(`[API] REST + WebSocket server running on http://localhost:${PORT}`);

  return httpServer;
}

module.exports = { initApi };
