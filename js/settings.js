document.addEventListener('DOMContentLoaded', () => {
  initSettings();
});

function initSettings() {
  const settings = Store.get(DB_KEYS.SETTINGS) || { ttsSpeed: 0.9 };
  const slider = document.getElementById('speed-slider');
  const valText = document.getElementById('speed-val');

  if (slider) slider.value = settings.ttsSpeed;
  if (valText) valText.textContent = `${settings.ttsSpeed}x`;

  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      valText.textContent = `${val}x`;
      settings.ttsSpeed = val;
      Store.set(DB_KEYS.SETTINGS, settings);
    });
  }

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const currentTheme = localStorage.getItem('cet6_theme') || 'dark';
    themeToggle.checked = currentTheme === 'dark';

    themeToggle.addEventListener('change', (e) => {
      const newTheme = e.target.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('cet6_theme', newTheme);
    });
  }

  // 渲染成就到 Settings 页面
  if (typeof renderSettingsAchievements === 'function') {
    renderSettingsAchievements();
  }
}

function clearData() {
  if (confirm('Are you sure you want to clear all learning progress and saved items? This cannot be undone.')) {
    Store.clearAll();
    alert('All data cleared.');
    location.reload();
  }
}

function exportData() {
  const data = {
    progress: Store.get(DB_KEYS.VOCAB_PROGRESS),
    savedWords: Store.get(DB_KEYS.SAVED_WORDS),
    savedQuotes: Store.get(DB_KEYS.SAVED_QUOTES)
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cet6-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* 导出进度 - 全量数据(供 Settings 页面按钮调用) */
function exportProgress() {
  const data = {
    version: '5.0',
    exportDate: new Date().toISOString(),
    knownWords: state.knownWords,
    notebook: state.notebook,
    streak: state.streak,
    achievements: state.achievements,
    goals: state.goals,
    wordProgress: state.wordProgress
  };
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cet6-progress-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('Progress exported', 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast('Export failed', 'error');
  }
}
window.exportProgress = exportProgress;

/* 清除缓存 */
async function clearCache() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if (typeof showToast === 'function') showToast('Cache cleared', 'success');
    // 重新注册 SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then(reg => console.log('SW re-registered'))
        .catch(err => console.warn('SW failed', err));
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Clear failed', 'error');
  }
}
window.clearCache = clearCache;