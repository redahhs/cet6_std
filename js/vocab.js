let originalWordsData = [];
let wordsData = [];
let currentIndex = 0;
let sortMode = 'default'; // 'default', 'random', 'az'

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
    const rawData = await res.json();
    originalWordsData = [...rawData]; // Save original order
    applySorting();
  } catch (e) {
    console.error("Failed to load words", e);
  }
}

function applySorting() {
  if (sortMode === 'random') {
    // Fisher-Yates Shuffle
    wordsData = [...originalWordsData];
    for (let i = wordsData.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wordsData[i], wordsData[j]] = [wordsData[j], wordsData[i]];
    }
  } else if (sortMode === 'az') {
    wordsData = [...originalWordsData].sort((a, b) => a.word.localeCompare(b.word));
  } else {
    wordsData = [...originalWordsData];
  }
  
  currentIndex = 0;
  renderCards();
  updateSortUI();
}

window.setSortMode = function(mode) {
  if (sortMode === mode) return;
  sortMode = mode;
  applySorting();
  if (window.Haptics) Haptics.light();
};

function updateSortUI() {
  document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`sort-${sortMode}`).classList.add('active');
}

function renderCards() {
  const container = document.getElementById('v-card-container');
  const emptyState = document.getElementById('v-empty-state');
  container.innerHTML = '';
  
  if (currentIndex >= wordsData.length) {
    emptyState.classList.remove('hidden');
    updateProgress();
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  const word = wordsData[currentIndex];
  const card = document.createElement('div');
  card.className = 'vocab-card glass-card absolute inset-0 flex flex-col items-center justify-center p-8 cursor-pointer animate-card-enter';
  card.dataset.id = word.id;
  
  card.innerHTML = `
    <span class="text-xs font-semibold text-[var(--accent)] tracking-widest uppercase mb-4">${word.pos || 'n.'}</span>
    <h2 class="text-5xl font-bold text-gradient font-serif-elegant mb-4 text-center">${word.word}</h2>
    <button class="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/80 active:scale-90 transition-transform pulse-soft mb-8" onclick="event.stopPropagation(); playAudio('${word.word}')">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
    </button>
    <p class="absolute bottom-8 text-xs text-[var(--text-tertiary)]">Swipe or tap for details</p>
  `;

  activeCard = card;
  card.addEventListener('click', () => { if (!hasMoved) openSheet(word); });
  attachTouchEvents(card);
  container.appendChild(card);
  updateProgress();
}

function updateProgress() {
  const total = wordsData.length;
  document.getElementById('v-progress-text').textContent = `${currentIndex} / ${total}`;
  const percent = total > 0 ? (currentIndex / total) * 100 : 0;
  document.getElementById('v-progress-bar').style.width = `${percent}%`;
}

// --- Touch Physics (Same as before) ---
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
  isDragging = true; hasMoved = false;
  startX = getX(e); startY = getY(e);
  activeCard.classList.add('swiping');
}

function touchMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  currentX = getX(e) - startX; currentY = getY(e) - startY;
  if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) hasMoved = true;
  const rotate = currentX * 0.05;
  activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
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
  }
  currentX = 0; currentY = 0;
}

function flyOut(dir) {
  const word = wordsData[currentIndex];
  let mastery = dir === 'right' ? 3 : (dir === 'up' ? 1 : 0);
  
  activeCard.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
  activeCard.style.transform = `translate(${dir === 'right' ? 150 : dir === 'left' ? -150 : 0}%, ${dir === 'up' ? -150 : 0}%) rotate(${dir === 'right' ? 30 : dir === 'left' ? -30 : 0}deg)`;
  activeCard.style.opacity = '0';
  
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
  
  content.innerHTML = `
    <div class="flex justify-between items-start mb-6">
      <div>
        <h3 class="text-3xl font-bold font-serif-elegant text-white">${word.word}</h3>
        <p class="text-[var(--text-secondary)] mt-1">${word.pos || 'n.'}</p>
      </div>
      <button onclick="toggleSave('${word.id}', this)" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ${isSaved ? 'text-[var(--accent)]' : 'text-white/40'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </button>
    </div>
    <div class="space-y-6">
      <div>
        <p class="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Meaning</p>
        <p class="text-lg text-white">${word.translations?.[0]?.translation || 'No definition'}</p>
      </div>
      ${word.phrases && word.phrases.length > 0 ? `
      <div>
        <p class="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Phrases</p>
        <div class="space-y-2">
          ${word.phrases.slice(0, 5).map(p => `
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