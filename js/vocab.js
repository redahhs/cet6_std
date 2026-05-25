/**
 * Vocabulary Engine (Bug-Fixed Version)
 * 修复了滑动后误触弹窗、动画状态混乱的问题
 */

let wordsData = [];
let currentIndex = 0;
let startX = 0, startY = 0, currentX = 0, currentY = 0;
let isDragging = false;
let hasMoved = false; 
let isAnimating = false; // 🌟 新增：全局动画锁，防止动画期间误触

document.addEventListener('DOMContentLoaded', async () => {
  await loadWords();
  setupControls();
});

async function loadWords() {
  try {
    const res = await fetch('./data/words.json');
    const rawData = await res.json();
    wordsData = rawData.map(raw => ({
      id: raw.word,
      word: raw.word,
      pos: raw.translations?.[0]?.type || '',
      meaning: raw.translations?.map(t => t.translation).join('；') || '暂无释义',
      phrases: raw.phrases || []
    }));
    renderCards();
  } catch (e) {
    console.error("Failed to load words", e);
  }
}

function renderCards() {
  const container = document.getElementById('vocab-card-container');
  const emptyState = document.getElementById('vocab-empty-state');
  container.innerHTML = ''; 
  
  if (currentIndex >= wordsData.length) {
    emptyState.classList.remove('hidden');
    updateProgress();
    return;
  }
  emptyState.classList.add('hidden');

  const word = wordsData[currentIndex];
  const card = document.createElement('div');
  card.className = 'vocab-card glass-card absolute inset-0 flex flex-col items-center justify-center p-8 cursor-pointer';
  card.dataset.id = word.id;
  
  card.innerHTML = `
    <span class="text-xs font-semibold text-[#5e5ce6] tracking-widest uppercase mb-4">${word.pos}</span>
    <h2 class="text-5xl font-bold text-gradient font-serif-elegant mb-4 text-center">${word.word}</h2>
    <button class="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/80 active:scale-90 transition-transform pulse-soft mb-8" onclick="event.stopPropagation(); playAudio('${word.word}')">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
    </button>
    <p class="text-sm text-[var(--text-tertiary)]">Swipe or tap for details</p>
  `;

  // 🌟 修复：点击时检查 hasMoved 和 isAnimating
  card.addEventListener('click', (e) => {
    if (hasMoved || isAnimating) return; // 如果发生过滑动，或正在执行飞出动画，则拦截点击
    openSheet(word);
  });

  attachTouchEvents(card);
  container.appendChild(card);
  updateProgress();
}

function updateProgress() {
  const total = wordsData.length;
  document.getElementById('vocab-progress-text').textContent = `${currentIndex} / ${total}`;
  const percent = total > 0 ? (currentIndex / total) * 100 : 0;
  document.getElementById('vocab-progress-bar').style.width = `${percent}%`;
}

function attachTouchEvents(card) {
  card.addEventListener('touchstart', touchStart, { passive: true });
  card.addEventListener('touchmove', touchMove, { passive: false });
  card.addEventListener('touchend', touchEnd, { passive: true });
  
  // 桌面端兼容
  card.addEventListener('mousedown', touchStart);
  card.addEventListener('mousemove', touchMove);
  card.addEventListener('mouseup', touchEnd);
  card.addEventListener('mouseleave', touchEnd);
}

function getX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
function getY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

function touchStart(e) {
  if (isAnimating) return; // 动画期间禁止拖拽
  isDragging = true;
  hasMoved = false; // 重置滑动标志
  startX = getX(e);
  startY = getY(e);
  activeCard.classList.add('swiping');
}

function touchMove(e) {
  if (!isDragging) return;
  e.preventDefault(); 
  
  currentX = getX(e) - startX;
  currentY = getY(e) - startY;
  
  // 移动超过 10px 视为滑动
  if (Math.abs(currentX) > 10 || Math.abs(currentY) > 10) {
    hasMoved = true;
  }
  
  const rotate = currentX * 0.05;
  activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
  
  // 视觉反馈
  let leftOpacity = Math.max(0, -currentX / 100);
  let rightOpacity = Math.max(0, currentX / 100);
  let upOpacity = Math.max(0, -currentY / 100);
  
  activeCard.style.boxShadow = `
    inset 0 0 100px rgba(239, 68, 68, ${leftOpacity * 0.2}),
    inset 0 0 100px rgba(34, 197, 94, ${rightOpacity * 0.2}),
    inset 0 0 100px rgba(234, 179, 8, ${upOpacity * 0.2})
  `;
}

function touchEnd(e) {
  if (!isDragging) return;
  isDragging = false;
  activeCard.classList.remove('swiping');

  const threshold = 80;
  let flyDirection = null;

  if (currentX > threshold) flyDirection = 'right';
  else if (currentX < -threshold) flyDirection = 'left';
  else if (currentY < -threshold) flyDirection = 'up';

  if (flyDirection) {
    flyOut(flyDirection);
    hasMoved = true; // 🌟 保持为 true，防止 touchend 后浏览器自动触发的 click 事件打开弹窗
  } else {
    // 没达到飞出阈值，弹回原位，重置 hasMoved 允许下次点击
    activeCard.style.transform = '';
    activeCard.style.boxShadow = '';
    hasMoved = false; 
  }
  currentX = 0;
  currentY = 0;
}

function flyOut(direction) {
  if (isAnimating) return;
  isAnimating = true; // 🌟 锁定动画，防止连续触发
  
  const word = wordsData[currentIndex];
  let mastery = 0;
  
  if (direction === 'right') { 
    activeCard.style.transform = 'translate(150%, 0) rotate(30deg)';
    activeCard.style.opacity = '0';
    mastery = 3; 
  } else if (direction === 'left') { 
    activeCard.style.transform = 'translate(-150%, 0) rotate(-30deg)';
    activeCard.style.opacity = '0';
    mastery = 0; 
  } else if (direction === 'up') { 
    activeCard.style.transform = 'translate(0, -150%) scale(0.8)';
    activeCard.style.opacity = '0';
    mastery = 1; 
  }

  // 保存进度
  if (window.Store && window.DB_KEYS) {
    const progress = Store.get(DB_KEYS.VOCAB_PROGRESS) || {};
    progress[word.id] = { mastery, lastReview: Date.now() };
    Store.set(DB_KEYS.VOCAB_PROGRESS, progress);
  }

  if (window.Haptics) Haptics.medium();

  // 动画结束后渲染新卡片并解锁
  setTimeout(() => {
    currentIndex++;
    renderCards();
    isAnimating = false; // 🌟 解锁
  }, 300);
}

function setupControls() {
  document.getElementById('vocab-btn-forgot').addEventListener('click', () => {
    if (!isAnimating && activeCard) flyOut('left');
  });
  document.getElementById('vocab-btn-known').addEventListener('click', () => {
    if (!isAnimating && activeCard) flyOut('right');
  });
  document.getElementById('vocab-btn-fuzzy').addEventListener('click', () => {
    if (!isAnimating && activeCard) flyOut('up');
  });
}

function openSheet(word) {
  const sheet = document.getElementById('vocab-sheet');
  const backdrop = document.getElementById('vocab-backdrop');
  const content = document.getElementById('vocab-sheet-content');
  
  const isSaved = window.Store && window.DB_KEYS ? Store.isWordSaved(word.id) : false;

  content.innerHTML = `
    <div class="flex justify-between items-start mb-6">
      <div>
        <h3 class="text-3xl font-bold font-serif-elegant text-white">${word.word}</h3>
        <p class="text-[var(--text-secondary)] mt-1">${word.pos}</p>
      </div>
      <button onclick="toggleSave('${word.id}', this)" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ${isSaved ? 'text-[#5e5ce6]' : 'text-white/40'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </button>
    </div>
    <div class="space-y-6">
      <div>
        <p class="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Meaning</p>
        <p class="text-lg text-white">${word.meaning}</p>
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
  
  sheet.classList.add('open');
  backdrop.classList.remove('hidden');
  setTimeout(() => backdrop.classList.add('opacity-100'), 10);
  if (window.Haptics) Haptics.light();
}

window.closeSheet = function() {
  document.getElementById('vocab-sheet').classList.remove('open');
  const backdrop = document.getElementById('vocab-backdrop');
  backdrop.classList.remove('opacity-100');
  setTimeout(() => backdrop.classList.add('hidden'), 300);
};

window.toggleSave = function(wordId, btn) {
  if (!window.Store || !window.DB_KEYS) return;
  if (Store.isWordSaved(wordId)) {
    Store.unsaveWord(wordId);
    btn.classList.remove('text-[#5e5ce6]');
    btn.classList.add('text-white/40');
    btn.querySelector('svg').setAttribute('fill', 'none');
  } else {
    Store.saveWord(wordId);
    btn.classList.add('text-[#5e5ce6]');
    btn.classList.remove('text-white/40');
    btn.querySelector('svg').setAttribute('fill', 'currentColor');
    if (window.Haptics) Haptics.success();
  }
};