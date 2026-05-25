let originalWordsData = [];
let wordsData = [];
let currentIndex = 0;
let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false;
let hasMoved = false; 
let isTouchInteraction = false; // 🌟 核心修复：隔离 Touch 和 Click 事件

document.addEventListener('DOMContentLoaded', async () => {
  await loadWords();
  setupControls();
  setupSortButtons();
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

// 排序逻辑
let currentSort = 'default';

function applySorting() {
  if (currentSort === 'random') {
    wordsData = [...originalWordsData];
    for (let i = wordsData.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wordsData[i], wordsData[j]] = [wordsData[j], wordsData[i]];
    }
  } else if (currentSort === 'az') {
    wordsData = [...originalWordsData].sort((a, b) => a.word.localeCompare(b.word));
  } else {
    wordsData = [...originalWordsData];
  }
  currentIndex = 0;
  renderCards();
}

function setupSortButtons() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sort = btn.dataset.sort;
      if (sort === currentSort) return;
      currentSort = sort;
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applySorting();
    });
  });
}

// A-Z 导航逻辑
function setupAlphaNav() {
  const nav = document.getElementById('alpha-nav');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(letter => {
    const btn = document.createElement('button');
    btn.className = 'alpha-btn';
    btn.dataset.letter = letter;
    btn.textContent = letter;
    btn.style.cssText = 'padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; background: rgba(255,255,255,0.05); color: #86868b; border: none; flex-shrink: 0;';
    btn.onclick = () => filterByLetter(letter);
    nav.appendChild(btn);
  });
  
  // ALL 按钮事件
  document.querySelector('[data-letter="ALL"]').onclick = () => filterByLetter('ALL');
}

function filterByLetter(letter) {
  document.querySelectorAll('.alpha-btn').forEach(btn => {
    btn.style.background = btn.dataset.letter === letter ? '#5e5ce6' : 'rgba(255,255,255,0.05)';
    btn.style.color = btn.dataset.letter === letter ? 'white' : '#86868b';
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
    emptyState.style.display = 'block';
    updateProgress();
    return;
  }
  emptyState.style.display = 'none';

  const word = wordsData[currentIndex];
  const card = document.createElement('div');
  card.className = 'vocab-card';
  card.dataset.id = word.id;
  card.style.cssText = `
    position:absolute; inset:0; background:rgba(28,28,30,0.85); backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,0.08); border-radius:24px; display:flex; flex-direction:column;
    align-items:center; justify-content:center; padding:32px; text-align:center; touch-action:none;
    user-select:none; will-change:transform,opacity;
    transition:transform 0.4s cubic-bezier(0.25,1,0.5,1),opacity 0.4s ease;
  `;
  
  card.innerHTML = `
    <span style="font-size:12px;font-weight:600;color:#5e5ce6;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;">${word.pos}</span>
    <h2 style="font-size:42px;font-weight:700;background:linear-gradient(135deg,#fff,#a1a1aa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:16px;">${word.word}</h2>
    <button class="vocab-audio-btn" style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.05);border:none;color:#fff;margin-bottom:32px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
    </button>
    <p style="font-size:12px;color:#86868b;">Swipe or tap for details</p>
  `;

  activeCard = card;

  // 音频按钮事件
  card.querySelector('.vocab-audio-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.playAudio) window.playAudio(word.word);
  });

  // 点击事件：仅桌面端（非触摸）直接触发
  card.addEventListener('click', (e) => {
    if (isTouchInteraction) {
      isTouchInteraction = false;
      return;
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
  isTouchInteraction = true;
  startX = getX(e); startY = getY(e);
}

function touchMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  currentX = getX(e) - startX; currentY = getY(e) - startY;
  if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) hasMoved = true;
  if (activeCard) activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${currentX * 0.05}deg)`;
}

function touchEnd() {
  if (!isDragging) return;
  isDragging = false;
  
  if (currentX > 100) flyOut('right');
  else if (currentX < -100) flyOut('left');
  else if (currentY < -100) flyOut('up');
  else {
    if (activeCard) activeCard.style.transform = '';
    // 触摸点击弹窗由 click 事件处理（isTouchInteraction 标记已设置，click 中会放行）
    if (!hasMoved) openSheet(wordsData[currentIndex]);
  }
  currentX = 0; currentY = 0;
}

function flyOut(direction) {
  const word = wordsData[currentIndex];
  let mastery = direction === 'right' ? 3 : (direction === 'up' ? 1 : 0);
  if (activeCard) {
    activeCard.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    activeCard.style.transform = `translate(${direction === 'right' ? 150 : direction === 'left' ? -150 : 0}%, ${direction === 'up' ? -150 : 0}%) rotate(${direction === 'right' ? 30 : direction === 'left' ? -30 : 0}deg)`;
    activeCard.style.opacity = '0';
  }
  
  if (window.Store && window.DB_KEYS) {
    const progress = Store.get(DB_KEYS.VOCAB_PROGRESS) || {};
    progress[word.id] = { mastery, lastReview: Date.now() };
    Store.set(DB_KEYS.VOCAB_PROGRESS, progress);
  }
  
  setTimeout(() => { currentIndex++; renderCards(); }, 300);
}

function setupControls() {
  document.getElementById('vocab-btn-forgot').onclick = () => activeCard && flyOut('left');
  document.getElementById('vocab-btn-known').onclick = () => activeCard && flyOut('right');
  document.getElementById('vocab-btn-fuzzy').onclick = () => activeCard && flyOut('up');
}

function openSheet(word) {
  const sheet = document.getElementById('v-sheet');
  const backdrop = document.getElementById('v-backdrop');
  const content = document.getElementById('v-sheet-content');
  if (!sheet || !backdrop || !content) return;
  const isSaved = window.Store && window.DB_KEYS ? Store.isWordSaved(word.id) : false;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div>
        <h3 style="font-size:28px;font-weight:700;margin:0;">${word.word}</h3>
        <p style="color:#86868b;margin:4px 0 0;">${word.pos}</p>
      </div>
      <button onclick="toggleSave('${word.id}', this)" style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.05);border:none;color:${isSaved ? '#5e5ce6' : '#86868b'};">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </button>
    </div>
    <div style="margin-bottom:24px;">
      <p style="font-size:12px;color:#86868b;margin-bottom:8px;">MEANING</p>
      <p style="font-size:16px;margin:0;">${word.meaning}</p>
    </div>
    ${word.phrases.length > 0 ? `
      <div>
        <p style="font-size:12px;color:#86868b;margin-bottom:12px;">PHRASES</p>
        ${word.phrases.map(p => `
          <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:12px;margin-bottom:8px;">
            <p style="margin:0 0 4px;font-weight:500;">${p.phrase}</p>
            <p style="margin:0;font-size:13px;color:#86868b;">${p.translation}</p>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  sheet.style.transform = 'translateY(0)';
  backdrop.style.opacity = '1';
  backdrop.style.pointerEvents = 'auto';
}

window.closeSheet = function() {
  const sheet = document.getElementById('v-sheet');
  const backdrop = document.getElementById('v-backdrop');
  if (!sheet || !backdrop) return;
  sheet.style.transform = 'translateY(100%)';
  backdrop.style.opacity = '0';
  backdrop.style.pointerEvents = 'none';
};

window.toggleSave = function(wordId, btn) {
  if (!window.Store || !window.DB_KEYS) return;
  if (Store.isWordSaved(wordId)) {
    Store.unsaveWord(wordId);
    btn.style.color = '#86868b';
    btn.querySelector('svg').setAttribute('fill', 'none');
  } else {
    Store.saveWord(wordId);
    btn.style.color = '#5e5ce6';
    btn.querySelector('svg').setAttribute('fill', 'currentColor');
  }
};