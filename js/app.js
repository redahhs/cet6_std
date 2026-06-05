/**
 * Core App Controller (PWA + Capacitor Ready)
 * v4.0 - 解决首屏白屏,统一音频管理,生命周期监听
 */
(function () {
  'use strict';

  // 立即执行,不等待 DOMContentLoaded
  initPWA();
  bindGlobalLifecycle();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  function onReady() {
    initGlobalUI();
    initAudioSystem();
    initIOSFixes();
    initViewTransitions();
    bindHaptics();
    hideSkeleton();
  }

  function hideSkeleton() {
    // 等待首屏主要内容就绪后淡出骨架
    const skel = document.getElementById('appSkeleton');
    if (!skel) return;
    // 至少显示 200ms,避免闪烁
    setTimeout(() => {
      skel.classList.add('fade-out');
      setTimeout(() => skel.remove(), 500);
    }, 200);
  }

  function initPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then(reg => console.log('✅ SW registered:', reg.scope))
        .catch(err => console.warn('⚠️ SW failed:', err));
    }
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = './manifest.json';
      document.head.appendChild(link);
    }
  }

  function initGlobalUI() {
    // 主题已经在 <head> 内联脚本初始化,这里同步其他属性
    const path = window.location.pathname;
    const currentPage = path.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const href = item.getAttribute('href');
      if (href === currentPage || path.endsWith(href)) {
        item.classList.add('active');
      }
    });
  }

  /**
   * 全局生命周期监听 - 解决音频后台播放问题
   * 兼容 Chrome Android / Safari / WebView / 小米浏览器
   */
  function bindGlobalLifecycle() {
    // 页面隐藏时停止所有音频
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && window.AudioController) {
        window.AudioController.pauseAll();
      }
    });

    // 页面卸载/隐藏时清理
    window.addEventListener('pagehide', () => {
      if (window.AudioController) window.AudioController.stopAll();
    });

    // 移动端特有事件
    window.addEventListener('blur', () => {
      if (window.AudioController) window.AudioController.pauseAll();
    });

    // Capacitor / WebView 生命周期
    if (window.Capacitor) {
      document.addEventListener('pause', () => {
        if (window.AudioController) window.AudioController.pauseAll();
      });
      document.addEventListener('resume', () => {
        if (window.AudioController) window.AudioController.resumeAll();
      });
    }
  }

  function initAudioSystem() {
    // 首次用户交互后解锁 AudioContext (Chrome/Safari 限制)
    const unlock = () => {
      if (window.AudioController && typeof window.AudioController.unlock === 'function') {
        window.AudioController.unlock();
      }
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
    document.addEventListener('touchstart', unlock, { once: true, passive: true });
    document.addEventListener('click', unlock, { once: true });
  }

  function initIOSFixes() {
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isStandalone && isIOS) {
      document.body.classList.add('is-ios-standalone');
    }
    if (isStandalone) {
      document.addEventListener('click', (e) => {
        const target = e.target.closest('a');
        if (target && target.href && !target.href.startsWith('javascript:') && !target.href.startsWith(window.location.origin)) {
          e.preventDefault();
          window.open(target.href, '_blank');
        }
      });
    }
  }

  function initViewTransitions() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link || !link.href || link.target === '_blank' || e.metaKey || e.ctrlKey) return;

      // 已经由 inline handler 接管 (SPA 切换 / 模态),不再干预
      if (e.defaultPrevented || link.dataset.spa === 'true' || link.hasAttribute('data-no-reload')) return;

      try {
        const url = new URL(link.href);
        if (url.origin !== window.location.origin) return;
      } catch (err) { return; }
      e.preventDefault();

      // 切换前停止音频
      if (window.AudioController) window.AudioController.stopAll();

      if (document.startViewTransition) {
        document.startViewTransition(() => { window.location.href = link.href; });
      } else {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.18s ease';
        setTimeout(() => { window.location.href = link.href; }, 180);
      }
    });
  }

  function bindHaptics() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, .nav-item, .glass-card, .tap-word');
      if (target && window.Haptics) {
        if (target.classList.contains('nav-item')) Haptics.light();
        else if (target.tagName === 'BUTTON') Haptics.medium();
        else Haptics.light();
      }
    });
  }
})();

// 兼容旧代码,保留 window.playAudio
window.playAudio = function (text, lang = 'en-US') {
  if (!window.AudioController) return;
  window.AudioController.speak(text, lang);
};