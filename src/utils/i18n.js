'use strict';

const db = require('../db/database');
const es = require('../locales/es.json');
const en = require('../locales/en.json');

const locales = { es, en };

/**
 * Translates a key based on the guild's language preference.
 * @param {string|null} guildId - The Discord Guild ID.
 * @param {string} key - Dot-notation path to the key (e.g. "errors.mustBeInVoice").
 * @param {Record<string, string|number>} [replacements] - Object with replacements.
 * @returns {string} The translated string.
 */
function t(guildId, key, replacements = {}) {
  let lang = 'es'; // default language
  
  if (guildId) {
    try {
      const guildData = db.getGuild(guildId);
      if (guildData && guildData.language) {
        lang = guildData.language;
      }
    } catch (err) {
      console.error('[i18n] Error loading guild language:', err);
    }
  }

  // Fallback to Spanish if the language file is not loaded
  const locale = locales[lang] || locales.es;

  // Resolve dot-notation path
  const value = key.split('.').reduce((obj, segment) => obj && obj[segment], locale);

  if (typeof value !== 'string') {
    // If not found in the selected language, fall back to Spanish
    const fallbackValue = key.split('.').reduce((obj, segment) => obj && obj[segment], locales.es);
    if (typeof fallbackValue === 'string') {
      return replaceVars(fallbackValue, replacements);
    }
    return key;
  }

  return replaceVars(value, replacements);
}

function replaceVars(str, replacements) {
  let result = str;
  for (const [k, v] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{${k}}`, 'g'), String(v));
  }
  return result;
}

module.exports = { t };
