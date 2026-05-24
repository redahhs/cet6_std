/**
 * Core App Controller (Final Version)
 * Features: View Transitions, Haptics binding, iOS fixes
 */

document.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initGlobalUI();
  initIOSFixes();
  initViewTransitions();
  bindHaptics();
});

// PWA Service Worker Registration
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(reg => {
        console.log('✅ Service Worker registered:', reg.scope);
      })
      .catch(err => {
        console.error('❌ Service Worker registration failed:', err);
      });
  }
}

// ... (保留之前的 initGlobalUI, initIOSFixes 代码) ...

function initViewTransitions() {
  // Intercept internal links for smooth page transitions
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    
    // Ignore external links, anchors, and modified clicks (cmd+click)
    if (!link || !link.href || link.target === '_blank' || e.metaKey || e.ctrlKey) return;
    
    const url = new URL(link.href);
    if (url.origin !== window.location.origin) return;

    e.preventDefault();
    
    // Use View Transitions API if supported (Chrome/Edge/Android)
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        window.location.href = link.href;
      });
    } else {
      // Fallback for Safari/iOS: Simple CSS fade
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.2s ease';
      setTimeout(() => {
        window.location.href = link.href;
      }, 200);
    }
  });

  // Fade in on page load (Fallback for Safari)
  document.body.style.opacity = '1';
}

function bindHaptics() {
  // Auto-bind haptics to interactive elements
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .nav-item, .glass-card, .tap-word');
    if (target) {
      if (target.classList.contains('nav-item')) {
        Haptics.light();
      } else if (target.tagName === 'BUTTON') {
        Haptics.medium();
      } else {
        Haptics.light();
      }
    }
  });
}