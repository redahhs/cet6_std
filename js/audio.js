/**
 * AudioManager
 * 全局单例，自动中断旧音频，捕获异常
 */

class AudioManager {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.isReady = false;
  }

  async play(url) {
    if (!url) return;
    
    try {
      // 自动中断旧音频
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.src = url;
      
      // 移动端 autoplay 限制处理
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (e) {
      console.error('[Audio Error] Playback failed:', e);
      // Fallback to Web Speech API if audio fails
      this._speakFallback(url);
    }
  }

  _speakFallback(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = window.Store.getState().settings.ttsSpeed || 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
}

window.AudioManager = new AudioManager();