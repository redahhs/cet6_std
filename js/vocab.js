let originalWordsData = [];
let wordsData = [];
let currentIndex = 0;
let currentSort = 'default';

let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false;
let hasMoved = false; // 🌟 核心修复：防止滑动后误触 click 弹窗
let activeCard = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadWords();
  setupControls();
  setupSortButtons();
});

async function loadWords() {
  try {
    const res = await fetch('./data/words.json');
    const rawData = await res.json();
    originalWordsData = rawData.map(w => ({
      id: w.word,
      word: w.word,
      pos: w.translations?.[0]?.type || 'n.',
      meaning: w.translations?.map(t => t.translation).join('；') || '暂无释义',
      phrases: w.phrases || []
    }));
    applySorting();
  } catch (e) {
    console.error('Load words failed', e);
  }
}

// 🌟 排序逻辑
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
      if (window.Haptics) Haptics.light();
    });
  });
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
  card.style.cssText = `
    position:absolute; inset:0; background:rgba(28,28,30,0.85); backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,0.08); border-radius:24px; display:flex; flex-direction:column;
    align-items:center; justify-content:center; padding:32px; text-align:center; touch-action:none;
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
  
  // 🌟 核心修复：点击事件拦截
  card.addEventListener('click', (e) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return; // 只要发生过滑动，就绝对不弹窗
    }
    openSheet(word);
  });

  card.querySelector('.vocab-audio-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.playAudio) playAudio(word.word);
  });

  attachTouchEvents(card);
  container.appendChild(card);
  updateProgress();
}

function updateProgress() {
  document.getElementById('vocab-progress-text').textContent = `${currentIndex} / ${wordsData.length}`;
  const percent = wordsData.length > 0 ? (currentIndex / wordsData.length) * 100 : 0;
  document.getElementById('vocab-progress-bar').style.width = `${percent}%`;
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
  hasMoved = false; // 重置移动状态
  startX = getX(e); startY = getY(e);
}

function touchMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  currentX = getX(e) - startX; currentY = getY(e) - startY;
  
  // 🌟 核心修复：只要移动超过 5px，就标记为滑动
  if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) hasMoved = true;
  
  const rotate = currentX * 0.05;
  activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
}

function touchEnd() {
  if (!isDragging) return;
  isDragging = false;
  
  if (currentX > 100) flyOut('right');
  else if (currentX < -100) flyOut('left');
  else if (currentY < -100) flyOut('up');
  else {
    activeCard.style.transform = ''; // 弹回原位
  }
}

function flyOut(direction) {
  const word = wordsData[currentIndex];
  let mastery = 0;
  if (direction === 'right') { mastery = 3; activeCard.style.transform = 'translate(150%, 0) rotate(30deg)'; } 
  else if (direction === 'left') { mastery = 0; activeCard.style.transform = 'translate(-150%, 0) rotate(-30deg)'; } 
  else if (direction === 'up') { mastery = 1; activeCard.style.transform = 'translate(0, -150%) scale(0.8)'; }
  
  activeCard.style.opacity = '0';
  
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
  const sheet = document.getElementById('vocab-sheet');
  const backdrop = document.getElementById('vocab-backdrop');
  const content = document.getElementById('vocab-sheet-content');
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
  document.getElementById('vocab-sheet').style.transform = 'translateY(100%)';
  const backdrop = document.getElementById('vocab-backdrop');
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