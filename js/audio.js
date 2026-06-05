/**
 * AudioController v4.0 — 单例音频管理器
 * ---------------------------------------------------------
 * 统一管理所有声音: HTML5 Audio + Web Speech API
 *
 * 核心设计:
 * 1. 全局单例 — 任何地方调用都是同一个实例
 * 2. 互斥播放 — 同一时间只允许一个音源
 * 3. 强制停止 — stopAll() 在每次视图切换前必须调用
 * 4. 生命周期 — visibilitychange / pagehide / blur 自动清理
 * 5. 移动端兼容 — AudioContext 解锁 + Safari 自动播放限制
 * 6. 错误捕获 — 所有 play() 调用包裹 try-catch
 * ---------------------------------------------------------
 */
(function (global) {
  'use strict';

  /* ===== 环境检测 ===== */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !global.MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isWebView = /; wv\)|WebView/.test(navigator.userAgent) || !!global.Capacitor;

  class AudioController {
    constructor() {
      /* --- 内部状态 --- */
      this._audio = null;           // 单例 HTML5 Audio 元素
      this._audioCtx = null;        // AudioContext (用于解锁)
      this._unlocked = false;       // 是否已解锁
      this._currentType = null;     // 'audio' | 'tts' | null
      this._currentSrc = null;      // 当前播放源 (URL 或 TTS 文本)
      this._isPlaying = false;      // 是否正在播放
      this._lastPlayTime = 0;       // 上次播放时间戳
      this._activeTimers = [];      // 追踪所有通过本控制器创建的 setTimeout

      /* --- 配置 --- */
      this.settings = {
        rate: 0.9,
        lang: 'en-US',
        volume: 1
      };

      this._init();
    }

    /* ============================================
       初始化
       ============================================ */

    _init() {
      // 创建单例 Audio 元素
      this._audio = new Audio();
      this._audio.preload = 'none';
      this._audio.autoplay = false;
      this._audio.crossOrigin = 'anonymous';

      // Audio 元素事件监听 (只绑定一次)
      this._audio.addEventListener('ended', () => this._onEnded());
      this._audio.addEventListener('error', (e) => this._onError(e));

      // 全局生命周期监听
      this._bindGlobalLifecycle();
    }

    /**
     * 全局生命周期绑定 — 页面隐藏/卸载时自动清理
     * 注意: 这里只绑定一次,不会重复绑定
     */
    _bindGlobalLifecycle() {
      // 页面可见性变化 (切后台 / 切前台)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.pauseAll();
      });

      // 页面卸载前
      global.addEventListener('pagehide', () => this.stopAll());

      // 窗口失焦 (移动端常见)
      global.addEventListener('blur', () => this.pauseAll());

      // Capacitor / WebView 生命周期
      if (global.Capacitor) {
        document.addEventListener('pause', () => this.pauseAll());
        document.addEventListener('resume', () => this.resumeAll());
      }
    }

    /* ============================================
       公开 API
       ============================================ */

    /**
     * 解锁 AudioContext (移动端 Safari/Chrome 自动播放限制)
     * 必须在用户交互 (touchstart/click) 后调用
     */
    unlock() {
      if (this._unlocked) return;
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (AC && !this._audioCtx) {
          this._audioCtx = new AC();
        }
        if (this._audioCtx && this._audioCtx.state === 'suspended') {
          this._audioCtx.resume().catch(() => {});
        }
        // 播放静音音频解锁
        const silent = this._audio;
        silent.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        silent.volume = 0;
        const p = silent.play();
        if (p && p.then) {
          p.then(() => {
            silent.pause();
            silent.currentTime = 0;
            this._unlocked = true;
          }).catch(() => {});
        } else {
          this._unlocked = true;
        }
      } catch (e) {
        console.warn('[AudioController] unlock failed:', e);
      }
    }

    /**
     * 播放音频文件 URL
     * @param {string} url — 音频文件地址
     * @param {object} options — { volume, rate, fallbackText, lang }
     * @returns {Promise<boolean>} — 是否成功
     */
    async play(url, options = {}) {
      if (!url) return false;

      // 互斥: 停止当前播放
      this._stopCurrent();

      this._currentType = 'audio';
      this._currentSrc = url;
      this._isPlaying = true;

      try {
        // 相同 URL 不重置 (支持快速重放)
        if (this._audio.src !== url) {
          this._audio.src = url;
          this._audio.load();
        } else {
          this._audio.currentTime = 0;
        }

        this._audio.volume = options.volume ?? this.settings.volume;
        this._audio.playbackRate = options.rate ?? 1;

        const playPromise = this._audio.play();
        if (playPromise && playPromise.then) {
          await playPromise;
        }
        this._lastPlayTime = Date.now();
        return true;
      } catch (e) {
        console.warn('[AudioController] play() failed:', e.message);
        this._isPlaying = false;
        // Fallback 到 Web Speech API
        if (options.fallbackText) {
          return this.speak(options.fallbackText, options.lang);
        }
        return false;
      }
    }

    /**
     * Web Speech API 播放 (TTS)
     * @param {string} text — 要朗读的文本
     * @param {string} lang — 语言代码 (默认 en-US)
     * @param {object} options — { rate, pitch, volume }
     * @returns {boolean} — 是否成功
     */
    speak(text, lang = 'en-US', options = {}) {
      if (!text || !('speechSynthesis' in global)) return false;

      // 互斥: 停止当前播放
      this._stopCurrent();

      this._currentType = 'tts';
      this._currentSrc = text;
      this._isPlaying = true;

      try {
        global.speechSynthesis.cancel();

        const voices = global.speechSynthesis.getVoices();
        const utt = new SpeechSynthesisUtterance(String(text));
        utt.lang = lang || this.settings.lang;
        utt.rate = options.rate ?? this.settings.rate;
        utt.pitch = options.pitch ?? 1;
        utt.volume = options.volume ?? this.settings.volume;

        // 选择最佳英文 voice
        if (voices.length > 0) {
          const preferred = voices.find(v =>
            v.name.includes('Samantha') ||
            v.name.includes('Google US English') ||
            v.name.includes('Microsoft Aria') ||
            (v.lang.startsWith('en') && v.localService)
          ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
          if (preferred) utt.voice = preferred;
        }

        utt.onend = () => this._onEnded();
        utt.onerror = (e) => {
          // 'interrupted' / 'canceled' 是正常的取消,不报错
          if (e.error && !['interrupted', 'canceled'].includes(e.error)) {
            console.warn('[AudioController] TTS error:', e.error);
          }
          this._onEnded();
        };

        global.speechSynthesis.speak(utt);
        this._lastPlayTime = Date.now();
        return true;
      } catch (e) {
        console.warn('[AudioController] speak() failed:', e.message);
        this._isPlaying = false;
        return false;
      }
    }

    /**
     * 暂停所有 (可见性切换时调用)
     */
    pauseAll() {
      if (!this._isPlaying) return;
      try {
        if (this._currentType === 'audio' && this._audio && !this._audio.paused) {
          this._audio.pause();
        }
        if (this._currentType === 'tts' && 'speechSynthesis' in global) {
          global.speechSynthesis.pause();
        }
      } catch (e) {
        console.warn('[AudioController] pauseAll failed:', e);
      }
    }

    /**
     * 恢复播放
     */
    resumeAll() {
      try {
        if (this._currentType === 'audio' && this._audio && this._audio.paused && this._audio.src) {
          this._audio.play().catch(() => {});
        }
        if (this._currentType === 'tts' && 'speechSynthesis' in global && global.speechSynthesis.paused) {
          global.speechSynthesis.resume();
        }
      } catch (e) {
        console.warn('[AudioController] resumeAll failed:', e);
      }
    }

    /**
     * 停止所有 (视图切换时必须调用)
     *
     * 关键: 这是唯一保证音频完全停止的方法
     * - HTML5 Audio: pause() + currentTime = 0
     * - Web Speech API: speechSynthesis.cancel()
     * - 清除所有追踪的定时器
     */
    stopAll() {
      this._stopCurrent();
      try {
        // HTML5 Audio 完全重置
        if (this._audio) {
          this._audio.pause();
          this._audio.currentTime = 0;
        }
        // Web Speech API 完全取消
        if ('speechSynthesis' in global) {
          global.speechSynthesis.cancel();
        }
      } catch (e) {
        console.warn('[AudioController] stopAll failed:', e);
      }

      // 清除所有追踪的定时器
      this._clearTrackedTimers();

      // 重置状态
      this._isPlaying = false;
      this._currentType = null;
      this._currentSrc = null;
    }

    /**
     * 设置 TTS 语速
     */
    setRate(rate) {
      this.settings.rate = Math.max(0.5, Math.min(2, rate));
    }

    /**
     * 获取当前状态 (调试用)
     */
    getStatus() {
      return {
        isPlaying: this._isPlaying,
        type: this._currentType,
        src: this._currentSrc,
        unlocked: this._unlocked,
        lastPlayTime: this._lastPlayTime,
        trackedTimers: this._activeTimers.length
      };
    }

    /**
     * 清理资源 (应用卸载时调用)
     */
    destroy() {
      this.stopAll();
      if (this._audio) {
        this._audio.src = '';
        this._audio.load();
        this._audio = null;
      }
      if (this._audioCtx) {
        this._audioCtx.close().catch(() => {});
        this._audioCtx = null;
      }
    }

    /* ============================================
       内部方法
       ============================================ */

    /**
     * 停止当前播放 (内部互斥,不重置状态)
     */
    _stopCurrent() {
      try {
        if (this._currentType === 'audio' && this._audio) {
          this._audio.pause();
        }
        if (this._currentType === 'tts' && 'speechSynthesis' in global) {
          global.speechSynthesis.cancel();
        }
      } catch (e) {
        // 静默处理
      }
    }

    _onEnded() {
      this._isPlaying = false;
      this._currentType = null;
      this._currentSrc = null;
    }

    _onError(e) {
      console.warn('[AudioController] audio error:', e);
      this._isPlaying = false;
    }

    /**
     * 清除所有追踪的定时器
     * (由 stopAll 调用,确保切页后无残留 setTimeout)
     */
    _clearTrackedTimers() {
      this._activeTimers.forEach(id => {
        clearTimeout(id);
        clearInterval(id);
      });
      this._activeTimers = [];
    }
  }

  /* ===== 全局单例导出 ===== */
  // 如果已存在 AudioManager (旧版),先销毁
  if (global.AudioManager && typeof global.AudioManager.destroy === 'function') {
    try { global.AudioManager.destroy(); } catch (e) {}
  }

  // 创建新单例
  global.AudioController = new AudioController();

  // 向后兼容: AudioManager 指向同一个实例
  global.AudioManager = global.AudioController;

  // 兼容旧 API
  global.playAudio = function (text, lang) {
    if (typeof text === 'string' && text.startsWith('http')) {
      return global.AudioController.play(text);
    }
    return global.AudioController.speak(text, lang);
  };

  // 暴露环境信息
  global.AudioEnv = { isIOS, isSafari, isAndroid, isWebView };

})(window);
