// ... (保留原有加载逻辑) ...

function renderCurrentTab(tab) {
  // ... (保留原有空状态逻辑) ...
  
  if (tab === 'words') {
    const savedIds = Store.get(DB_KEYS.SAVED_WORDS) || [];
    const savedWords = allWords.filter(w => savedIds.includes(w.id));
    const listEl = document.getElementById('list-words');
    
    if (savedWords.length === 0) {
       // ... empty state ...
    } else {
      emptyState.classList.add('hidden');
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
  } 
  // ... (Quotes tab 同理) ...
}

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
        Haptics.light();
      } else {
        content.style.transform = 'translateX(0)'; // Snap close
      }
    });
  });
}