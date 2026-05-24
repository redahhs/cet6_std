/**
 * Core App Controller (v2)
 * Added: iOS Standalone mode fixes, Splash screen handling
 */

document.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initGlobalUI();
  initIOSFixes();
});

// ... (保留之前的 initPWA 和 initGlobalUI 代码) ...

function initIOSFixes() {
  // 1. Detect iOS Standalone Mode (Added to Home Screen)
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isStandalone && isIOS) {
    document.body.classList.add('is-ios-standalone');
    
    // Fix top padding for iOS status bar in standalone mode
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
      // iOS status bar is roughly 44px-59px depending on notch. 
      // We use CSS env() in theme.css, but add a class for specific JS tweaks if needed.
      appContainer.style.paddingTop = 'max(3rem, env(safe-area-inset-top, 44px))';
    }
  }

  // 2. Prevent rubber-band scrolling on iOS body
  document.body.addEventListener('touchmove', function (e) {
    if (e.target.tagName === 'BODY' || e.target.tagName === 'HTML') {
      // Allow scrolling inside scrollable containers, prevent on body
      if (!e.target.closest('.overflow-y-auto') && !e.target.closest('.article-content')) {
         // e.preventDefault(); // Uncomment if severe rubber-banding occurs, but can break internal scrolls
      }
    }
  }, { passive: false });

  // 3. Handle internal navigation in standalone mode (prevent opening in Safari)
  if (isStandalone) {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a');
      if (target && target.href && target.href.startsWith(window.location.origin)) {
        // Internal link, let it handle normally (SPA feel)
      } else if (target && target.href && !target.href.startsWith('javascript:')) {
        // External link, force open in Safari
        e.preventDefault();
        window.open(target.href, '_blank');
      }
    });
  }
}