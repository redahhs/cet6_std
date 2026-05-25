/**
 * Store & LocalStorage Manager
 * 统一状态管理，支持版本控制与持久化
 */

const APP_STORAGE_KEY = "cet6_app_state_v2";
const APP_VERSION = 2;

const defaultState = {
  version: APP_VERSION,
  vocab: {
    currentIndex: 0,
    favorites: [],
    learned: [],
    reviewQueue: []
  },
  settings: {
    theme: "dark",
    autoPlayAudio: true,
    ttsSpeed: 0.9
  },
  progress: {
    todayWords: 0,
    totalLearned: 0,
    streak: 12 // Mock data
  }
};

class Store {
  constructor() {
    this.state = this._loadState();
    this.listeners = new Set();
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(APP_STORAGE_KEY);
      if (!raw) return { ...defaultState };
      
      const parsed = JSON.parse(raw);
      // 版本控制：如果版本不匹配，重置或迁移
      if (parsed.version !== APP_VERSION) {
        console.warn('[Storage] Version mismatch, resetting state.');
        return { ...defaultState };
      }
      return parsed;
    } catch (e) {
      console.error('[Storage Error] Failed to parse state:', e);
      return { ...defaultState };
    }
  }

  getState() {
    return this.state;
  }

  setState(updater) {
    const newState = typeof updater === 'function' ? updater(this.state) : updater;
    this.state = { ...this.state, ...newState, version: APP_VERSION };
    this._persist();
    this._notify();
  }

  _persist() {
    try {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('[Storage Error] Failed to persist state:', e);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    this.listeners.forEach(listener => listener(this.state));
  }
}

window.Store = new Store();