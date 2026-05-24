// Notebook - Swipe to Delete Implementation

(function() {
  'use strict';
  
  let currentTab = 'words';
  let allWords = [];
  let allQuotes = [];
  
  // Load data on init
  Promise.all([
    fetch('./data/words.json').then(r => r.json()),
    fetch('./data/quotes.json').then(r => r.json())
  ]).then(([words, quotes]) => {
    allWords = words;
    allQuotes = quotes;
    renderCurrentTab('words');
  });

  // Switch tab function
  window.switchTab = function(tab) {
    currentTab = tab;
    document.getElementById('tab-words').className = 
      `flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
        tab === 'words' 
          ? 'bg-[var(--accent)] text-white' 
          : 'text-[var(--text-secondary)]'
      }`;
    document.getElementById('tab-quotes').className = 
      `flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
        tab === 'quotes' 
          ? 'bg-[var(--accent)] text-white' 
          : 'text-[var(--text-secondary)]'
      }`;
    document.getElementById('list-words').classList.toggle('hidden', tab !== 'words');
    document.getElementById('list-quotes').classList.toggle('hidden', tab !== 'quotes');
    renderCurrentTab(tab);
  };

  // Render current tab content
  function renderCurrentTab(tab) {
    const emptyState = document.getElementById('empty-state');
    
    if (tab === 'words') {
      const savedIds = Store.get(DB_KEYS.SAVED_WORDS) || [];
      const savedWords = allWords.filter(w => savedIds.includes(w.id));
      const listEl = document.getElementById('list-words');
      
      if (savedWords.length === 0) {
        emptyState.classList.remove('hidden');
        listEl.classList.add('hidden');
      } else {
        emptyState.classList.add('hidden');
        listEl.classList.remove('hidden');
        listEl.innerHTML = savedWords.map(w => `
          <div class="swipe-container mb-3 stagger-item" data-id="${w.id}">
            <div class="swipe-actions" onclick="removeWord('${w.id}')">Delete</div>
            <div class="swipe-content glass-card !bg-[var(--bg-secondary)] p-4 flex items-center justify-between" onclick="playAudio('${w.word}')">
              <div class="flex-1">
                <h3 class="font-bold text-lg">${w.word}</h3>
                <p class="text-sm text-[var(--text-secondary)]">${w.meaning}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[var(--text-tertiary)]"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        `).join('');
        
        initSwipeGestures();
      }
    } else if (tab === 'quotes') {
      const savedIds = Store.get(DB_KEYS.SAVED_QUOTES) || [];
      const savedQuotes = allQuotes.filter(q => savedIds.includes(q.id));
      const listEl = document.getElementById('list-quotes');
      
      if (savedQuotes.length === 0) {
        emptyState.classList.remove('hidden');
        listEl.classList.add('hidden');
      } else {
        emptyState.classList.add('hidden');
        listEl.classList.remove('hidden');
        listEl.innerHTML = savedQuotes.map(q => `
          <div class="swipe-container mb-3 stagger-item" data-id="${q.id}">
            <div class="swipe-actions" onclick="removeQuote('${q.id}')">Delete</div>
            <div class="swipe-content glass-card !bg-[var(--bg-secondary)] p-4" onclick="viewQuote('${q.id}')">
              <p class="text-base leading-relaxed mb-2 font-serif-elegant">"${q.en}"</p>
              <p class="text-sm text-[var(--text-secondary)]">${q.zh}</p>
              <p class="text-xs text-[var(--text-tertiary)] mt-3">— ${q.author}</p>
            </div>
          </div>
        `).join('');
        
        initSwipeGestures();
      }
    }
  }

  // Initialize swipe gestures
  function initSwipeGestures() {
    document.querySelectorAll('.swipe-container').forEach(container => {
      const content = container.querySelector('.swipe-content');
      let startX = 0, currentX = 0, isSwiping = false;

      content.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isSwiping = true;
        content.style.transition = 'none';
      }, { passive: true });

      content.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        currentX = e.touches[0].clientX - startX;
        if (currentX > 0) currentX = 0; // Prevent swiping right
        if (currentX < -80) currentX = -80; // Cap at 80px
        content.style.transform = `translateX(${currentX}px)`;
      }, { passive: true });

      content.addEventListener('touchend', () => {
        isSwiping = false;
        content.style.transition = 'transform 0.3s var(--ease-spring)';
        if (currentX < -40) {
          content.style.transform = 'translateX(-80px)'; // Snap open
          if (window.Haptics) Haptics.light();
        } else {
          content.style.transform = 'translateX(0)'; // Snap close
        }
      });
    });
  }

  // Remove word
  window.removeWord = function(id) {
    const savedIds = Store.get(DB_KEYS.SAVED_WORDS) || [];
    const newIds = savedIds.filter(wid => wid !== id);
    Store.set(DB_KEYS.SAVED_WORDS, newIds);
    
    // Animate removal
    const container = document.querySelector(`.swipe-container[data-id="${id}"]`);
    if (container) {
      container.style.transition = 'all 0.3s var(--ease-spring)';
      container.style.opacity = '0';
      container.style.transform = 'translateX(-100%)';
      setTimeout(() => {
        renderCurrentTab(currentTab);
      }, 300);
    }
    
    if (window.Haptics) Haptics.medium();
  };

  // Remove quote
  window.removeQuote = function(id) {
    const savedIds = Store.get(DB_KEYS.SAVED_QUOTES) || [];
    const newIds = savedIds.filter(qid => qid !== id);
    Store.set(DB_KEYS.SAVED_QUOTES, newIds);
    
    // Animate removal
    const container = document.querySelector(`.swipe-container[data-id="${id}"]`);
    if (container) {
      container.style.transition = 'all 0.3s var(--ease-spring)';
      container.style.opacity = '0';
      container.style.transform = 'translateX(-100%)';
      setTimeout(() => {
        renderCurrentTab(currentTab);
      }, 300);
    }
    
    if (window.Haptics) Haptics.medium();
  };

  // Play audio for word
  window.playAudio = function(word) {
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
      if (window.Haptics) Haptics.light();
    }
  };

  // View quote (optional: show full screen)
  window.viewQuote = function(id) {
    const quote = allQuotes.find(q => q.id === id);
    if (quote) {
      // Could navigate to quote.html or show modal
      console.log('View quote:', quote);
    }
  };
})();
