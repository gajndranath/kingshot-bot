/**
 * Simple In-Memory Cache for Translations
 * Format: { "messageId_languageCode": "Translated Text" }
 */
const cache = new Map();

module.exports = {
  get: (messageId, locale) => {
    return cache.get(`${messageId}_${locale}`);
  },
  set: (messageId, locale, translatedText) => {
    cache.set(`${messageId}_${locale}`, translatedText);
    // Auto-cleanup if cache gets too large (prevent memory leaks)
    if (cache.size > 10000) {
      const keys = Array.from(cache.keys()).slice(0, 5000);
      keys.forEach(k => cache.delete(k));
    }
  }
};
