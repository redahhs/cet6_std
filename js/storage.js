/**
 * CET6 Storage Manager v2
 * Features: Schema versioning, automatic migration, namespace isolation
 */

const DB_VERSION = 2; // Increment this when changing data structure
const DB_PREFIX = 'cet6_v2_';

const DB_KEYS = {
  VOCAB_PROGRESS: 'vocab_progress', 
  SAVED_WORDS: 'saved_words',       
  DAILY_QUOTE: 'daily_quote_cache', 
  SAVED_QUOTES: 'saved_quotes',
  SETTINGS: 'settings',
  META: 'meta' // Stores version and timestamps
};

class StorageManager {
  constructor() {
    this._checkMigration();
  }

  _checkMigration() {
    const meta = this.get(DB_KEYS.META) || { version: 1 };
    if (meta.version < DB_VERSION) {
      this._migrate(meta.version);
      this.set(DB_KEYS.META, { version: DB_VERSION, lastUpdated: Date.now() });
    }
  }

  _migrate(fromVersion) {
    console.log(`🔄 Migrating storage from v${fromVersion} to v${DB_VERSION}`);
    
    // Example: Migration from v1 to v2
    if (fromVersion < 2) {
      // In v1, keys were hardcoded strings without prefix. 
      // We move them to the new prefixed namespace.
      const oldKeys = {
        'cet6_vocab_progress': DB_KEYS.VOCAB_PROGRESS,
        'cet6_saved_words': DB_KEYS.SAVED_WORDS,
        'cet6_daily_quote_cache': DB_KEYS.DAILY_QUOTE,
        'cet6_saved_quotes': DB_KEYS.SAVED_QUOTES,
        'cet6_settings': DB_KEYS.SETTINGS
      };

      Object.entries(oldKeys).forEach(([oldKey, newKey]) => {
        const oldData = localStorage.getItem(oldKey);
        if (oldData) {
          localStorage.setItem(DB_PREFIX + newKey, oldData);
          localStorage.removeItem(oldKey); // Clean up old key
        }
      });
    }
  }

  _getKey(key) {
    return DB_PREFIX + key;
  }

  get(key) {
    try {
      const item = localStorage.getItem(this._getKey(key));
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error(`Storage read error [${key}]:`, e);
      return null;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(this._getKey(key), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Storage write error [${key}]:`, e);
      // Handle QuotaExceededError
      if (e.name === 'QuotaExceededError') {
        alert('Storage is full. Please clear some data in Settings.');
      }
      return false;
    }
  }

  remove(key) {
    localStorage.removeItem(this._getKey(key));
  }

  clearAll() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(DB_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  // --- Domain Specific Helpers ---

  saveWord(wordId) {
    const saved = this.get(DB_KEYS.SAVED_WORDS) || [];
    if (!saved.includes(wordId)) {
      saved.push(wordId);
      this.set(DB_KEYS.SAVED_WORDS, saved);
    }
  }

  unsaveWord(wordId) {
    let saved = this.get(DB_KEYS.SAVED_WORDS) || [];
    saved = saved.filter(id => id !== wordId);
    this.set(DB_KEYS.SAVED_WORDS, saved);
  }

  isWordSaved(wordId) {
    const saved = this.get(DB_KEYS.SAVED_WORDS) || [];
    return saved.includes(wordId);
  }
}

// Initialize and expose globally
window.Store = new StorageManager();
window.DB_KEYS = DB_KEYS;