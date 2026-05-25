let allWords = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadAllWords();
  renderWords();
});

async function loadAllWords() {
  try {
    const res = await fetch('./data/words.json');
    allWords = await res.json();
  } catch (e) { console.error(e); }
}

function renderWords() {
  const savedIds = Store.get(DB_KEYS.SAVED_WORDS) || [];
  const savedWords = allWords.filter(w => savedIds.includes(w.word));
  const listEl = document.getElementById('list-words');
  const emptyState = document.getElementById('empty-state');
  
  if (savedWords.length === 0) {
    listEl.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  listEl.innerHTML = savedWords.map(w => `
    <div class="swipe-container" data-id="${w.word}">
      <div class="swipe-actions" onclick="removeWord('${w.word}')">Delete</div>
      <div class="swipe-content" onclick="playAudio('${w.word}')">
        <h3 class="font-bold text-lg text-white">${w.word}</h3>
        <p class="text-sm text-[#86868b] mt-1">${w.translations.map(t => t.translation).join('；')}</p>
      </div>
    </div>
  `).join('');
  
  initSwipeGestures();
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
      if (currentX > 0) currentX = 0;
      if (currentX < -80) currentX = -80;
      content.style.transform = `translateX(${currentX}px)`;
    }, { passive: true });

    content.addEventListener('touchend', () => {
      isSwiping = false;
      content.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
      if (currentX < -40) {
        content.style.transform = 'translateX(-80px)';
        if (window.Haptics) Haptics.light();
      } else {
        content.style.transform = 'translateX(0)';
      }
    });
  });
}

function removeWord(word) {
  Store.unsaveWord(word);
  renderWords();
  if (window.Haptics) Haptics.medium();
}