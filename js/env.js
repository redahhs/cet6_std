/**
 * Capacitor / WebView 兼容层 v1.0
 * ---------------------------------------------------------
 * 在 Capacitor / Android WebView / iOS WKWebView 中
 * 提供统一的能力接口,使 JS 代码无需修改即可工作
 *
 * 功能:
 * - 检测运行环境 (Capacitor / Web / PWA)
 * - 状态栏沉浸式
 * - 屏幕方向锁定
 * - 物理返回键处理
 * - 切后台音频暂停
 * - 唤醒锁 (Wakelock)
 * - 触觉反馈 (Haptics)
 * - 分享/复制 API 包装
 * - 启动画面控制
 * ---------------------------------------------------------
 */
(function (global) {
  'use strict';

  const isCapacitor = !!global.Capacitor;
  const isStandalone = global.matchMedia('(display-mode: standalone)').matches
    || global.navigator.standalone === true
    || isCapacitor;

  const env = {
    isCapacitor,
    isStandalone,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !global.MSStream,
    isAndroid: /Android/i.test(navigator.userAgent),
    platform: isCapacitor ? global.Capacitor.getPlatform?.() : 'web',
    version: isCapacitor ? global.Capacitor.getVersion?.() || 'web' : 'web'
  };

  global.AppEnv = env;

  // -------- 状态栏沉浸 --------
  async function setupStatusBar() {
    if (!isCapacitor || !global.Capacitor.Plugins?.StatusBar) return;
    try {
      const SB = global.Capacitor.Plugins.StatusBar;
      if (env.isIOS) {
        await SB.setOverlaysWebView({ overlay: true });
        await SB.setStyle({ style: 'DARK' });
        await SB.setBackgroundColor({ color: '#00000000' });
      } else {
        await SB.setOverlaysWebView({ overlay: false });
        await SB.setBackgroundColor({ color: '#0B0E14' });
        await SB.setStyle({ style: 'DARK' });
      }
    } catch (e) {
      console.warn('[Env] StatusBar setup failed:', e);
    }
  }

  // -------- 屏幕方向 --------
  async function lockPortrait() {
    if (!isCapacitor || !global.Capacitor.Plugins?.ScreenOrientation) return;
    try {
      await global.Capacitor.Plugins.ScreenOrientation.lock({ orientation: 'portrait' });
    } catch (e) {}
  }

  // -------- 触觉反馈 (统一封装) --------
  const Haptics = {
    light() {
      if (global.navigator.vibrate) global.navigator.vibrate(10);
      else if (isCapacitor && global.Capacitor.Plugins?.Haptics) {
        global.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' }).catch(() => {});
      }
    },
    medium() {
      if (global.navigator.vibrate) global.navigator.vibrate(20);
      else if (isCapacitor && global.Capacitor.Plugins?.Haptics) {
        global.Capacitor.Plugins.Haptics.impact({ style: 'MEDIUM' }).catch(() => {});
      }
    },
    heavy() {
      if (global.navigator.vibrate) global.navigator.vibrate(30);
      else if (isCapacitor && global.Capacitor.Plugins?.Haptics) {
        global.Capacitor.Plugins.Haptics.impact({ style: 'HEAVY' }).catch(() => {});
      }
    },
    success() {
      if (isCapacitor && global.Capacitor.Plugins?.Haptics) {
        global.Capacitor.Plugins.Haptics.notification({ type: 'SUCCESS' }).catch(() => {});
      } else if (global.navigator.vibrate) {
        global.navigator.vibrate([10, 50, 10]);
      }
    },
    error() {
      if (isCapacitor && global.Capacitor.Plugins?.Haptics) {
        global.Capacitor.Plugins.Haptics.notification({ type: 'ERROR' }).catch(() => {});
      } else if (global.navigator.vibrate) {
        global.navigator.vibrate([30, 50, 30]);
      }
    }
  };
  global.Haptics = Haptics;

  // -------- 分享 / 复制 (统一封装) --------
  const Share = {
    async share(data) {
      if (isCapacitor && global.Capacitor.Plugins?.Share) {
        try {
          await global.Capacitor.Plugins.Share.share(data);
          return true;
        } catch (e) { return false; }
      }
      if (global.navigator.share) {
        try {
          await global.navigator.share(data);
          return true;
        } catch (e) { return false; }
      }
      // Fallback: 复制到剪贴板
      return Clipboard.copy(data.text || data.url || '');
    }
  };
  global.AppShare = Share;

  const Clipboard = {
    async copy(text) {
      try {
        if (isCapacitor && global.Capacitor.Plugins?.Clipboard) {
          await global.Capacitor.Plugins.Clipboard.write({ string: text });
          return true;
        }
        if (global.navigator.clipboard) {
          await global.navigator.clipboard.writeText(text);
          return true;
        }
        // 降级
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch (e) {
        return false;
      }
    }
  };
  global.AppClipboard = Clipboard;

  // -------- 唤醒锁 (Wakelock) --------
  let wakeLock = null;
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        return true;
      } catch (e) { return false; }
    }
    return false;
  }
  async function releaseWakeLock() {
    if (wakeLock) {
      try { await wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }
  global.AppWakeLock = { request: requestWakeLock, release: releaseWakeLock };

  // -------- 网络状态 --------
  const Net = {
    online: navigator.onLine,
    onChange(cb) {
      const handler = () => { Net.online = navigator.onLine; cb(Net.online); };
      global.addEventListener('online', handler);
      global.addEventListener('offline', handler);
    }
  };
  global.AppNet = Net;

  // -------- 启动 Capacitor 相关 --------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    if (isCapacitor) {
      await setupStatusBar();
      await lockPortrait();
    }
  }

  // -------- 物理返回键 (Android) --------
  if (isCapacitor) {
    document.addEventListener('backbutton', () => {
      // 优先: 关闭弹窗
      const modal = document.querySelector('.modal.active, .quote-modal.active, [data-modal].active');
      if (modal) {
        modal.classList.remove('active');
        return;
      }
      // 其次: 切回上一个 Tab
      const history = global.AppHistory || [];
      if (history.length > 1) {
        history.pop();
        const prev = history[history.length - 1];
        if (prev && global.switchTab) global.switchTab(prev, null);
        return;
      }
      // 最后: 退出 App
      if (global.Capacitor.Plugins?.App) {
        global.Capacitor.Plugins.App.exitApp();
      }
    });
  }

  // 暴露到全局
  global.AppEnv = env;
  global.AppHistory = global.AppHistory || [];
})(window);
