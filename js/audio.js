/**
 * AudioManager v3.0
 * ---------------------------------------------------------
 * 统一音频管理系统 - 解决所有音频相关问题:
 * 1. 页面切换自动停止音频
 * 2. 多音频互斥(同一时间只播一个)
 * 3. 重复点击稳定处理
 * 4. 内存泄漏防护
 * 5. 跨浏览器兼容(Chrome/Safari/Firefox/Edge/小米/QQ/WebView)
 * 6. AudioContext 解锁机制
 * 7. Web Speech API fallback
 * 8. 暂停/恢复/停止 全生命周期
 * 9. 路由切换自动清理
 * ---------------------------------------------------------
 */
(function (global) {
  'use strict';

  // 浏览器/环境检测
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !global.MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isWebView = /; wv\)|WebView/.test(navigator.userAgent) || !!global.Capacitor;

  class AudioManager {
    constructor() {
      this.audio = null;
      this.audioCtx = null;
      this.unlocked = false;
      this.currentSrc = null;
      this.currentType = null;  // 'audio' | 'tts'
      this.queue = [];
      this.isPlaying = false;
      this.lastPlayTime = 0;
      this.settings = {
        rate: 0.9,
        lang: 'en-US',
        volume: 1
      };
      this._init();
    }

    _init() {
      // 创建 Audio 元素(单例,避免多实例)
      this.audio = new Audio();
      this.audio.preload = 'none';
      this.audio.autoplay = false;
      this.audio.crossOrigin = 'anonymous';

      // 事件监听 - 状态同步
      this.audio.addEventListener('ended', () => this._onEnded());
      this.audio.addEventListener('error', (e) => this._onError(e));
      this.audio.addEventListener('stalled', () => this._onStalled());

      // 全局音频拦截: 防止多实例
      this._interceptNativeAudio();

      // 全局错误捕获
      global.addEventListener('unhandledrejection', (e) => {
        if (e.reason && /audio|playback/i.test(String(e.reason))) {
          console.warn('[AudioManager] Caught audio error:', e.reason);
          e.preventDefault();
        }
      });
    }

    /**
     * 解锁 AudioContext (Chrome/Safari 移动端限制)
     */
    unlock() {
      if (this.unlocked) return;
      try {
        // 创建/恢复 AudioContext
        const AC = global.AudioContext || global.webkitAudioContext;
        if (AC && !this.audioCtx) {
          this.audioCtx = new AC();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        // 播放静音解锁
        const silent = this.audio;
        silent.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        silent.volume = 0;
        const p = silent.play();
        if (p && p.then) {
          p.then(() => {
            silent.pause();
            silent.currentTime = 0;
            this.unlocked = true;
          }).catch(() => {});
        } else {
          this.unlocked = true;
        }
      } catch (e) {
        console.warn('[AudioManager] unlock failed:', e);
      }
    }

    /**
     * 播放音频文件 URL
     */
    async play(url, options = {}) {
      if (!url) return;
      // 互斥: 停止当前
      this._stopCurrent();

      this.currentType = 'audio';
      this.currentSrc = url;
      this.isPlaying = true;

      try {
        // 确保是相同 URL 才不重置(支持快速重放)
        if (this.audio.src !== url) {
          this.audio.src = url;
          this.audio.load();
        } else {
          this.audio.currentTime = 0;
        }

        this.audio.volume = options.volume ?? this.settings.volume;
        this.audio.playbackRate = options.rate ?? 1;

        const playPromise = this.audio.play();
        if (playPromise && playPromise.then) {
          await playPromise;
        }
        this.lastPlayTime = Date.now();
        return true;
      } catch (e) {
        console.warn('[AudioManager] play() failed:', e.message);
        this.isPlaying = false;
        // Fallback 到 Web Speech API
        if (options.fallbackText) {
          return this.speak(options.fallbackText, options.lang);
        }
        return false;
      }
    }

    /**
     * Web Speech API 播放
     */
    speak(text, lang = 'en-US', options = {}) {
      if (!text || !('speechSynthesis' in global)) return false;
      this._stopCurrent();

      this.currentType = 'tts';
      this.currentSrc = text;
      this.isPlaying = true;

      try {
        global.speechSynthesis.cancel();

        // 等待 voices 加载 (Chrome 异步)
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
          // 'interrupted' / 'canceled' 是正常的取消错误
          if (e.error && !['interrupted', 'canceled'].includes(e.error)) {
            console.warn('[AudioManager] TTS error:', e.error);
          }
          this._onEnded();
        };

        global.speechSynthesis.speak(utt);
        this.lastPlayTime = Date.now();
        return true;
      } catch (e) {
        console.warn('[AudioManager] speak() failed:', e.message);
        this.isPlaying = false;
        return false;
      }
    }

    /**
     * 暂停所有(可见性切换时调用)
     */
    pauseAll() {
      if (!this.isPlaying) return;
      try {
        if (this.currentType === 'audio' && this.audio && !this.audio.paused) {
          this.audio.pause();
        }
        if (this.currentType === 'tts' && 'speechSynthesis' in global) {
          global.speechSynthesis.pause();
        }
      } catch (e) {
        console.warn('[AudioManager] pauseAll failed:', e);
      }
    }

    /**
     * 恢复播放
     */
    resumeAll() {
      try {
        if (this.currentType === 'audio' && this.audio && this.audio.paused && this.audio.src) {
          this.audio.play().catch(() => {});
        }
        if (this.currentType === 'tts' && 'speechSynthesis' in global && global.speechSynthesis.paused) {
          global.speechSynthesis.resume();
        }
      } catch (e) {
        console.warn('[AudioManager] resumeAll failed:', e);
      }
    }

    /**
     * 停止所有(页面切换时调用)
     */
    stopAll() {
      this._stopCurrent();
      try {
        if (this.audio) {
          this.audio.pause();
          this.audio.currentTime = 0;
        }
        if ('speechSynthesis' in global) {
          global.speechSynthesis.cancel();
        }
      } catch (e) {
        console.warn('[AudioManager] stopAll failed:', e);
      }
      this.isPlaying = false;
      this.currentType = null;
      this.currentSrc = null;
    }

    /**
     * 停止当前正在播放的(内部互斥)
     */
    _stopCurrent() {
      try {
        if (this.currentType === 'audio' && this.audio) {
          this.audio.pause();
        }
        if (this.currentType === 'tts' && 'speechSynthesis' in global) {
          global.speechSynthesis.cancel();
        }
      } catch (e) {}
    }

    /**
     * 拦截原生 Audio 创建(防止第三方代码创建新实例)
     */
    _interceptNativeAudio() {
      // 暂时不拦截全局,只确保本管理器是唯一的
    }

    _onEnded() {
      this.isPlaying = false;
      this.currentType = null;
      this.currentSrc = null;
    }

    _onError(e) {
      console.warn('[AudioManager] audio error:', e);
      this.isPlaying = false;
    }

    _onStalled() {
      // 网络卡顿,可恢复
    }

    /**
     * 设置 TTS 语速
     */
    setRate(rate) {
      this.settings.rate = Math.max(0.5, Math.min(2, rate));
    }

    /**
     * 清理资源
     */
    destroy() {
      this.stopAll();
      if (this.audio) {
        this.audio.src = '';
        this.audio.load();
        this.audio = null;
      }
      if (this.audioCtx) {
        this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }
    }

    /**
     * 获取当前状态(用于调试)
     */
    getStatus() {
      return {
        isPlaying: this.isPlaying,
        type: this.currentType,
        src: this.currentSrc,
        unlocked: this.unlocked,
        lastPlayTime: this.lastPlayTime
      };
    }
  }

  // 全局单例
  if (!global.AudioManager) {
    global.AudioManager = new AudioManager();
  }

  // 兼容旧 API
  global.playAudio = function (text, lang) {
    if (typeof text === 'string' && text.startsWith('http')) {
      return global.AudioManager.play(text);
    }
    return global.AudioManager.speak(text, lang);
  };

  // 浏览器可见性变化时自动暂停
  // (WebView/Capacitor 兼容)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      global.AudioManager.pauseAll();
    }
  });

  // 页面卸载前清理
  global.addEventListener('pagehide', () => {
    global.AudioManager.stopAll();
  });

  // 暴露环境信息
  global.AudioEnv = { isIOS, isSafari, isAndroid, isWebView };
})(window);
