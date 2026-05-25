/**
 * Core App Controller (Final Fixed Version)
 */
document.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initGlobalUI();
  initIOSFixes();
  initViewTransitions();
  bindHaptics();
});

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
  const savedTheme = localStorage.getItem('cet6_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

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

function initIOSFixes() {
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isStandalone && isIOS) {
    document.body.classList.add('is-ios-standalone');
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.paddingTop = 'max(3rem, env(safe-area-inset-top, 44px))';
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
    try {
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) return;
    } catch (err) { return; }
    e.preventDefault();
    if (document.startViewTransition) {
      document.startViewTransition(() => { window.location.href = link.href; });
    } else {
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.2s ease';
      setTimeout(() => { window.location.href = link.href; }, 200);
    }
  });
  document.body.style.opacity = '1';
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

window.playAudio = function(text, lang = 'en-US') {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  const settings = window.Store ? Store.get(DB_KEYS.SETTINGS) : null;
  utterance.rate = settings?.ttsSpeed || 0.9;
  utterance.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google US English'));
  if (preferredVoice) utterance.voice = preferredVoice;
  window.speechSynthesis.speak(utterance);
};
if ('speechSynthesis' in window) window.speechSynthesis.getVoices();