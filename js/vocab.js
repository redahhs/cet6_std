let wordsData = [];
let originalWordsData = [];
let currentIndex = 0;
let currentSort = 'default';

// Touch variables
let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false, hasMoved = false;
let activeCard = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadWords();
  setupControls();
});

async function loadWords() {
  try {
    const res = await fetch('./data/words.json');
    const data = await res.json();
    originalWordsData = data;
    applySorting();
  } catch (e) {
    console.error("Failed to load words", e);
  }
}

function applySorting() {
  if (currentSort === 'random') {
    wordsData = [...originalWordsData].sort(() => Math.random() - 0.5);
  } else if (currentSort === 'az') {
    wordsData = [...originalWordsData].sort((a, b) => a.word.localeCompare(b.word));
  } else {
    wordsData = [...originalWordsData];
  }
  currentIndex = 0;
  renderCards();
  
  // Update UI
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === currentSort);
  });
}

window.setSortMode = function(mode) {
  currentSort = mode;
  applySorting();
  if (window.Haptics) Haptics.light();
};

function renderCards() {
  const container = document.getElementById('v-card-container');
  const emptyState = document.getElementById('v-empty-state');
  container.innerHTML = '';
  
  if (currentIndex >= wordsData.length) {
    emptyState.classList.remove('hidden');
    updateProgress();
    return;
  }
  emptyState.classList.add('hidden');

  const word = wordsData[currentIndex];
  const card = document.createElement('div');
  card.className = 'vocab-card glass-card absolute inset-0 flex flex-col items-center justify-center p-8 cursor-pointer animate-card-enter';
  card.dataset.id = word.id;
  
  // 获取释义
  const meaning = word.translations ? word.translations.map(t => t.translation).join('；') : '暂无释义';
  const pos = word.translations && word.translations[0] ? word.translations[0].type : '';

  card.innerHTML = `
    <span class="text-xs font-semibold text-[var(--accent)] tracking-widest uppercase mb-4">${pos}</span>
    <h2 class="text-5xl font-bold text-gradient font-serif-elegant mb-4 text-center">${word.word}</h2>
    <button class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/80 active:scale-90 transition-transform pulse-soft mb-8" onclick="event.stopPropagation(); playAudio('${word.word}')">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
    </button>
    <p class="text-lg text-[var(--text-secondary)] text-center mb-8">${meaning}</p>
    <p class="absolute bottom-8 text-xs text-[var(--text-tertiary)]">Swipe or tap for details</p>
  `;

  activeCard = card;
  card.addEventListener('click', () => {
    if (!hasMoved) openSheet(word);
  });
  
  attachTouchEvents(card);
  container.appendChild(card);
  updateProgress();
}

function updateProgress() {
  document.getElementById('v-progress-text').textContent = `${currentIndex} / ${wordsData.length}`;
}

function attachTouchEvents(card) {
  card.addEventListener('touchstart', touchStart, { passive: true });
  card.addEventListener('touchmove', touchMove, { passive: false });
  card.addEventListener('touchend', touchEnd, { passive: true });
  
  card.addEventListener('mousedown', touchStart);
  card.addEventListener('mousemove', touchMove);
  card.addEventListener('mouseup', touchEnd);
  card.addEventListener('mouseleave', touchEnd);
}

function getX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
function getY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

function touchStart(e) {
  isDragging = true;
  hasMoved = false;
  startX = getX(e);
  startY = getY(e);
  activeCard.classList.add('swiping');
}

function touchMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  currentX = getX(e) - startX;
  currentY = getY(e) - startY;
  
  if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) hasMoved = true;
  
  const rotate = currentX * 0.05;
  activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
  
  // Visual feedback
  let leftOpacity = Math.max(0, -currentX / 100);
  let rightOpacity = Math.max(0, currentX / 100);
  let upOpacity = Math.max(0, -currentY / 100);
  
  activeCard.style.boxShadow = `
    inset 0 0 100px rgba(239, 68, 68, ${leftOpacity * 0.2}),
    inset 0 0 100px rgba(34, 197, 94, ${rightOpacity * 0.2}),
    inset 0 0 100px rgba(234, 179, 8, ${upOpacity * 0.2})
  `;
}

function touchEnd() {
  if (!isDragging) return;
  isDragging = false;
  activeCard.classList.remove('swiping');
  
  if (currentX > 100) flyOut('right');
  else if (currentX < -100) flyOut('left');
  else if (currentY < -100) flyOut('up');
  else {
    activeCard.style.transform = '';
    activeCard.style.boxShadow = '';
  }
}

function flyOut(direction) {
  const word = wordsData[currentIndex];
  let mastery = 0;
  
  if (direction === 'right') { activeCard.classList.add('fly-right'); mastery = 3; } 
  else if (direction === 'left') { activeCard.classList.add('fly-left'); mastery = 0; } 
  else if (direction === 'up') { activeCard.classList.add('fly-up'); mastery = 1; }

  const progress = Store.get(DB_KEYS.VOCAB_PROGRESS) || {};
  progress[word.id] = { mastery, lastReview: Date.now() };
  Store.set(DB_KEYS.VOCAB_PROGRESS, progress);
  
  if (window.Haptics) Haptics.medium();
  
  setTimeout(() => {
    currentIndex++;
    renderCards();
  }, 300);
}

function setupControls() {
  document.getElementById('btn-forgot').onclick = () => activeCard && flyOut('left');
  document.getElementById('btn-known').onclick = () => activeCard && flyOut('right');
  document.getElementById('btn-fuzzy').onclick = () => activeCard && flyOut('up');
}

function openSheet(word) {
  const sheet = document.getElementById('v-sheet');
  const backdrop = document.getElementById('v-backdrop');
  const content = document.getElementById('v-sheet-content');
  
  const isSaved = Store.isWordSaved(word.id);
  const meaning = word.translations ? word.translations.map(t => t.translation).join('；') : '暂无释义';
  const pos = word.translations && word.translations[0] ? word.translations[0].type : '';
  const phrases = word.phrases || [];

  content.innerHTML = `
    <div class="flex justify-between items-start mb-6">
      <div>
        <h3 class="text-3xl font-bold font-serif-elegant text-white">${word.word}</h3>
        <p class="text-[var(--text-secondary)] mt-1">${pos}</p>
      </div>
      <button onclick="toggleSave('${word.id}', this)" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ${isSaved ? 'text-[var(--accent)]' : 'text-white/40'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </button>
    </div>
    <div class="space-y-6">
      <div>
        <p class="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Meaning</p>
        <p class="text-lg text-white">${meaning}</p>
      </div>
      ${phrases.length > 0 ? `
      <div>
        <p class="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Phrases</p>
        <div class="space-y-2">
          ${phrases.slice(0, 5).map(p => `
            <div class="bg-white/5 p-3 rounded-xl">
              <p class="text-white font-medium">${p.phrase}</p>
              <p class="text-sm text-[var(--text-secondary)] mt-1">${p.translation}</p>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;
  
  sheet.classList.remove('translate-y-full');
  backdrop.classList.remove('hidden');
  setTimeout(() => backdrop.classList.add('opacity-100'), 10);
  if (window.Haptics) Haptics.light();
}

window.closeSheet = function() {
  document.getElementById('v-sheet').classList.add('translate-y-full');
  const backdrop = document.getElementById('v-backdrop');
  backdrop.classList.remove('opacity-100');
  setTimeout(() => backdrop.classList.add('hidden'), 300);
};

window.toggleSave = function(wordId, btn) {
  if (Store.isWordSaved(wordId)) {
    Store.unsaveWord(wordId);
    btn.classList.remove('text-[var(--accent)]');
    btn.classList.add('text-white/40');
    btn.querySelector('svg').setAttribute('fill', 'none');
  } else {
    Store.saveWord(wordId);
    btn.classList.add('text-[var(--accent)]');
    btn.classList.remove('text-white/40');
    btn.querySelector('svg').setAttribute('fill', 'currentColor');
    if (window.Haptics) Haptics.success();
  }
};