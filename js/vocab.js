let originalWordsData = [];
let wordsData = [];
let currentIndex = 0;
let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false;
let hasMoved = false; 
let isTouchInteraction = false; // 🌟 核心修复：隔离 Touch 和 Click 事件

document.addEventListener('DOMContentLoaded', async () => {
  await loadWords();
  setupControls();
  setupAlphaNav();
});

async function loadWords() {
  try {
    const res = await fetch('./data/words.json');
    const rawData = await res.json();
    originalWordsData = rawData.map(raw => ({
      id: raw.word,
      word: raw.word,
      pos: raw.translations?.[0]?.type || '',
      meaning: raw.translations?.map(t => t.translation).join('；') || '暂无释义',
      phrases: raw.phrases || []
    }));
    wordsData = [...originalWordsData];
    renderCards();
  } catch (e) { console.error("Failed to load words", e); }
}

// 🌟 A-Z 导航逻辑
function setupAlphaNav() {
  const nav = document.getElementById('alpha-nav');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(letter => {
    const btn = document.createElement('button');
    btn.className = 'alpha-btn';
    btn.dataset.letter = letter;
    btn.textContent = letter;
    btn.style.cssText = 'padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; background: rgba(255,255,255,0.05); color: var(--text-secondary); border: none;';
    btn.onclick = () => filterByLetter(letter);
    nav.appendChild(btn);
  });
  
  // ALL 按钮事件
  document.querySelector('[data-letter="ALL"]').onclick = () => filterByLetter('ALL');
}

function filterByLetter(letter) {
  document.querySelectorAll('.alpha-btn').forEach(btn => {
    btn.style.background = btn.dataset.letter === letter ? 'var(--accent)' : 'rgba(255,255,255,0.05)';
    btn.style.color = btn.dataset.letter === letter ? 'white' : 'var(--text-secondary)';
  });
  
  if (letter === 'ALL') {
    wordsData = [...originalWordsData];
  } else {
    wordsData = originalWordsData.filter(w => w.word.toLowerCase().startsWith(letter.toLowerCase()));
  }
  currentIndex = 0;
  renderCards();
}

function renderCards() {
  const container = document.getElementById('vocab-card-container');
  const emptyState = document.getElementById('vocab-empty-state');
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
    <span class="text-xs font-semibold text-[var(--accent)] tracking-widest uppercase mb-4">${word.pos}</span>
    <h2 class="text-5xl font-bold text-gradient font-serif-elegant mb-4 text-center">${word.word}</h2>
    <button class="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/80 active:scale-90 transition-transform mb-8" onclick="event.stopPropagation(); playAudio('${word.word}')">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
    </button>
    <p class="text-lg text-[var(--text-secondary)] text-center">${word.meaning}</p>
    <p class="absolute bottom-8 text-xs text-[var(--text-tertiary)]">Swipe or tap for details</p>
  `;

  // 🌟 核心修复：完美隔离 Touch 和 Click 事件，彻底解决弹窗失效
  card.addEventListener('touchstart', () => { isTouchInteraction = true; }, { passive: true });
  
  card.addEventListener('click', (e) => {
    if (isTouchInteraction) {
      e.preventDefault();
      isTouchInteraction = false;
      return; // 拦截触摸设备触发的 click 事件，防止重复弹窗
    }
    if (!hasMoved) openSheet(word);
  });

  attachTouchEvents(card);
  container.appendChild(card);
  updateProgress();
}

function updateProgress() {
  const total = wordsData.length;
  document.getElementById('vocab-progress-text').textContent = `${currentIndex} / ${total}`;
  document.getElementById('vocab-progress-bar').style.width = `${total > 0 ? (currentIndex / total) * 100 : 0}%`;
}

function attachTouchEvents(card) {
  card.addEventListener('touchstart', touchStart, { passive: true });
  card.addEventListener('touchmove', touchMove, { passive: false });
  card.addEventListener('touchend', touchEnd, { passive: true });
}

function getX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
function getY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

function touchStart(e) {
  isDragging = true; hasMoved = false; 
  startX = getX(e); startY = getY(e);
  card.classList.add('swiping');
  card.classList.remove('animate-card-enter'); 
}

function touchMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  currentX = getX(e) - startX; currentY = getY(e) - startY;
  if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) hasMoved = true;
  card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${currentX * 0.05}deg)`;
}

function touchEnd() {
  if (!isDragging) return;
  isDragging = false;
  card.classList.remove('swiping');
  
  if (currentX > 100) flyOut('right');
  else if (currentX < -100) flyOut('left');
  else if (currentY < -100) flyOut('up');
  else {
    card.style.transform = '';
    // 🌟 核心修复：如果是点击（未滑动），直接打开弹窗
    if (!hasMoved) openSheet(wordsData[currentIndex]);
  }
  currentX = 0; currentY = 0;
}

function flyOut(direction) {
  const word = wordsData[currentIndex];
  let mastery = direction === 'right' ? 3 : (direction === 'up' ? 1 : 0);
  card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
  card.style.transform = `translate(${direction === 'right' ? 150 : direction === 'left' ? -150 : 0}%, ${direction === 'up' ? -150 : 0}%) rotate(${direction === 'right' ? 30 : direction === 'left' ? -30 : 0}deg)`;
  card.style.opacity = '0';
  
  const progress = Store.get(DB_KEYS.VOCAB_PROGRESS) || {};
  progress[word.id] = { mastery, lastReview: Date.now() };
  Store.set(DB_KEYS.VOCAB_PROGRESS, progress);
  
  setTimeout(() => { currentIndex++; renderCards(); }, 300);
}

function setupControls() {
  document.getElementById('vocab-btn-forgot').onclick = () => activeCard && flyOut('left');
  document.getElementById('vocab-btn-known').onclick = () => activeCard && flyOut('right');
  document.getElementById('vocab-btn-fuzzy').onclick = () => activeCard && flyOut('up');
}

function openSheet(word) {
  const sheet = document.getElementById('vocab-detail-sheet');
  const backdrop = document.getElementById('vocab-sheet-backdrop');
  const content = document.getElementById('vocab-sheet-content');
  const isSaved = Store.isWordSaved(word.id);

  content.innerHTML = `
    <div class="flex justify-between items-start mb-6">
      <div>
        <h3 class="text-3xl font-bold font-serif-elegant text-white">${word.word}</h3>
        <p class="text-[var(--text-secondary)] mt-1">${word.pos}</p>
      </div>
      <button onclick="toggleSave('${word.id}', this)" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ${isSaved ? 'text-[var(--accent)]' : 'text-white/40'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </button>
    </div>
    <div class="space-y-6">
      <div>
        <p class="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Meaning</p>
        <p class="text-lg text-white">${word.meaning}</p>
      </div>
      ${word.phrases.length > 0 ? `
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
  
  sheet.classList.add('open');
  backdrop.classList.remove('hidden');
  setTimeout(() => backdrop.classList.add('opacity-100'), 10);
}

window.closeSheet = function() {
  document.getElementById('vocab-detail-sheet').classList.remove('open');
  document.getElementById('vocab-sheet-backdrop').classList.remove('opacity-100');
  setTimeout(() => document.getElementById('vocab-sheet-backdrop').classList.add('hidden'), 300);
};

window.toggleSave = function(wordId, btn) {
  if (Store.isWordSaved(wordId)) {
    Store.unsaveWord(wordId);
    btn.classList.remove('text-[var(--accent)]'); btn.classList.add('text-white/40');
    btn.querySelector('svg').setAttribute('fill', 'none');
  } else {
    Store.saveWord(wordId);
    btn.classList.add('text-[var(--accent)]'); btn.classList.remove('text-white/40');
    btn.querySelector('svg').setAttribute('fill', 'currentColor');
  }
};