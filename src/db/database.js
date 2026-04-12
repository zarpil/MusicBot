'use strict';

const BetterSqlite3 = require('better-sqlite3');
const path          = require('path');
const fs            = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/musicbot.db');

/** @type {BetterSqlite3.Database} */
let _db;

function getDb() {
  if (!_db) throw new Error('Database not initialised. Call db.init() first.');
  return _db;
}

// ── Initialise schema ─────────────────────────────────────────────────────────
function init() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new BetterSqlite3(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS guilds (
      id        TEXT PRIMARY KEY,
      name      TEXT,
      volume    INTEGER NOT NULL DEFAULT 80,
      autoplay  INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT DEFAULT '',
      creator_id      TEXT,
      creator_name    TEXT,
      creator_avatar  TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guild_id) REFERENCES guilds(id)
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      title       TEXT NOT NULL,
      author      TEXT,
      uri         TEXT NOT NULL,
      duration    INTEGER DEFAULT 0,
      artwork_url TEXT,
      source_name TEXT,
      position    INTEGER DEFAULT 0,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      title           TEXT NOT NULL,
      author          TEXT,
      uri             TEXT NOT NULL,
      duration        INTEGER DEFAULT 0,
      artwork_url     TEXT,
      source_name     TEXT,
      requester_name  TEXT,
      requester_avatar TEXT,
      played_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    );
  `);

  // ── Database Migrations ───────────────────────────────────────────────────
  // Ensure playlists table has the new creator columns for existing databases
  const columns = _db.prepare("PRAGMA table_info(playlists)").all();
  const hasCreatorId = columns.some(c => c.name === 'creator_id');
  
  if (!hasCreatorId) {
    console.log('[DB] Migrating playlists table...');
    _db.exec(`
      ALTER TABLE playlists ADD COLUMN creator_id TEXT;
      ALTER TABLE playlists ADD COLUMN creator_name TEXT;
      ALTER TABLE playlists ADD COLUMN creator_avatar TEXT;
    `);
  }

  console.log('[DB] SQLite database ready at', DB_PATH);
}

// ── Guild helpers ─────────────────────────────────────────────────────────────
function upsertGuild(id, { name = null, volume = 80, autoplay = 0 } = {}) {
  return getDb().prepare(`
    INSERT INTO guilds (id, name, volume, autoplay)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name     = COALESCE(excluded.name, name),
      volume   = excluded.volume,
      autoplay = excluded.autoplay
  `).run(id, name, volume, autoplay);
}

function getGuild(id) {
  return getDb().prepare('SELECT * FROM guilds WHERE id = ?').get(id);
}

function setAutoplay(id, enabled) {
  return getDb().prepare('UPDATE guilds SET autoplay = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

// ── Playlist helpers ──────────────────────────────────────────────────────────
function getPlaylists(guildId) {
  return getDb().prepare(`
    SELECT p.*, COUNT(pt.id) AS track_count
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
    WHERE p.guild_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(guildId);
}

function getPlaylist(id) {
  return getDb().prepare('SELECT * FROM playlists WHERE id = ?').get(id);
}

function createPlaylist(guildId, name, description = '', creator = {}) {
  const info = getDb().prepare(`
    INSERT INTO playlists (guild_id, name, description, creator_id, creator_name, creator_avatar) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(guildId, name, description, creator.id, creator.name, creator.avatar);
  return getPlaylist(info.lastInsertRowid);
}

function updatePlaylist(id, { name, description }) {
  return getDb().prepare(`
    UPDATE playlists SET name = COALESCE(?, name), description = COALESCE(?, description)
    WHERE id = ?
  `).run(name, description, id);
}

function deletePlaylist(id) {
  return getDb().prepare('DELETE FROM playlists WHERE id = ?').run(id);
}

// ── Playlist track helpers ────────────────────────────────────────────────────
function getPlaylistTracks(playlistId) {
  return getDb().prepare(`
    SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC
  `).all(playlistId);
}

function addTrackToPlaylist(playlistId, track) {
  // Get next position
  const row = getDb().prepare(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM playlist_tracks WHERE playlist_id = ?'
  ).get(playlistId);

  return getDb().prepare(`
    INSERT INTO playlist_tracks (playlist_id, title, author, uri, duration, artwork_url, source_name, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    playlistId,
    track.title,
    track.author || '',
    track.uri,
    track.duration || 0,
    track.artworkUrl || null,
    track.sourceName || 'youtube',
    row.next,
  );
}

function removeTrackFromPlaylist(trackId) {
  return getDb().prepare('DELETE FROM playlist_tracks WHERE id = ?').run(trackId);
}

// ── History helpers ───────────────────────────────────────────────────────────
function addHistoryEntry(guildId, track) {
  return getDb().prepare(`
    INSERT INTO history (guild_id, title, author, uri, duration, artwork_url, source_name, requester_name, requester_avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    guildId,
    track.info.title,
    track.info.author || '',
    track.info.uri,
    track.info.duration || 0,
    track.info.artworkUrl || null,
    track.info.sourceName || 'youtube',
    track.requester?.username || null,
    track.requester?.avatar || null
  );
}

function getHistory(guildId, limit = 50) {
  return getDb().prepare(`
    SELECT * FROM history WHERE guild_id = ? ORDER BY played_at DESC LIMIT ?
  `).all(guildId, limit);
}

module.exports = {
  init,
  getDb,
  upsertGuild,
  getGuild,
  setAutoplay,
  getPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  getPlaylistTracks,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  addHistoryEntry,
  getHistory,
};
