/**
 * Vocabulary Engine (Single Card Focus Mode)
 * 彻底移除重影，打造极致沉浸感
 */

let wordsData = [];
let currentIndex = 0;
let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false;
let activeCard = null;
let hasMoved = false; 

document.addEventListener('DOMContentLoaded', async () => {
  await loadWords();
  renderCards();
  setupControls();
});

async function loadWords() {
  try {
    const res = await fetch('./data/words.json');
    wordsData = await res.json();
  } catch (e) {
    console.error("Failed to load words", e);
  }
}

function renderCards() {
  const container = document.getElementById('card-container');
  const emptyState = document.getElementById('empty-state');
  
  container.innerHTML = ''; 
  
  if (currentIndex >= wordsData.length) {
    emptyState.classList.remove('hidden');
    updateProgress();
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  // 🌟 核心修复：只渲染当前这一张卡片，彻底杜绝重影！
  const word = wordsData[currentIndex];
  const card = document.createElement('div');
  
  // 添加入场动画类名
  card.className = 'vocab-card glass-card absolute inset-0 flex flex-col items-center justify-center p-8 cursor-pointer z-20 animate-card-enter';
  card.dataset.id = word.id;
  
  card.innerHTML = `
    <span class="text-xs font-semibold text-[#5e5ce6] tracking-widest uppercase mb-4">${word.pos}</span>
    <h2 class="text-5xl font-bold text-gradient font-serif-elegant mb-3 text-center">${word.word}</h2>
    <p class="text-lg text-gray-400 mb-8">${word.phonetic}</p>
    <button class="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/80 active:scale-90 transition-transform pulse-soft" onclick="event.stopPropagation(); playAudio('${word.word}')">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
    </button>
    <p class="absolute bottom-8 text-xs text-gray-500">Swipe or tap for details</p>
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
  const total = wordsData.length;
  const current = currentIndex;
  document.getElementById('progress-text').textContent = `${current} / ${total}`;
  const percent = total > 0 ? (current / total) * 100 : 0;
  document.getElementById('progress-bar').style.width = `${percent}%`;
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
  // 移除入场动画，防止与拖拽冲突
  activeCard.classList.remove('animate-card-enter'); 
}

function touchMove(e) {
  if (!isDragging) return;
  e.preventDefault(); 
  
  currentX = getX(e) - startX;
  currentY = getY(e) - startY;
  
  if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) {
    hasMoved = true;
  }
  
  const rotate = currentX * 0.05;
  activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
  updateOverlay();
}

function touchEnd() {
  if (!isDragging) return;
  isDragging = false;
  activeCard.classList.remove('swiping');

  const threshold = 100;
  
  if (currentX > threshold) flyOut('right'); 
  else if (currentX < -threshold) flyOut('left'); 
  else if (currentY < -threshold) flyOut('up'); 
  else {
    activeCard.style.transform = '';
    clearOverlays();
  }
  
  currentX = 0;
  currentY = 0;
}

function updateOverlay() {
  let leftOpacity = Math.max(0, -currentX / 100);
  let rightOpacity = Math.max(0, currentX / 100);
  let upOpacity = Math.max(0, -currentY / 100);

  activeCard.style.boxShadow = `
    inset 0 0 100px rgba(239, 68, 68, ${leftOpacity * 0.2}),
    inset 0 0 100px rgba(34, 197, 94, ${rightOpacity * 0.2}),
    inset 0 0 100px rgba(234, 179, 8, ${upOpacity * 0.2})
  `;
}

function clearOverlays() {
  if(activeCard) activeCard.style.boxShadow = '';
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
  document.getElementById('btn-forgot').addEventListener('click', () => activeCard && flyOut('left'));
  document.getElementById('btn-known').addEventListener('click', () => activeCard && flyOut('right'));
  document.getElementById('btn-fuzzy').addEventListener('click', () => activeCard && flyOut('up'));
}

function openSheet(word) {
  const sheet = document.getElementById('detail-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  const content = document.getElementById('sheet-content');
  const isSaved = Store.isWordSaved(word.id);

  content.innerHTML = `
    <div class="flex justify-between items-start mb-6">
      <div>
        <h3 class="text-3xl font-bold font-serif-elegant">${word.word}</h3>
        <p class="text-gray-400 mt-1">${word.phonetic} · ${word.pos}</p>
      </div>
      <button onclick="toggleSave('${word.id}', this)" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ${isSaved ? 'text-[#5e5ce6]' : 'text-white/40'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </button>
    </div>
    <div class="space-y-6">
      <div>
        <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Meaning</p>
        <p class="text-lg text-white">${word.meaning}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Example</p>
        <p class="text-base text-gray-300 leading-relaxed italic">"${word.example}"</p>
        <button onclick="playAudio('${word.example}')" class="mt-2 text-xs text-[#5e5ce6] flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg> Play Sentence
        </button>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Collocations</p>
        <div class="flex flex-wrap gap-2">
          ${word.collocations.map(c => `<span class="px-3 py-1 rounded-full bg-white/5 text-sm text-gray-300">${c}</span>`).join('')}
        </div>
      </div>
    </div>
  `;

  sheet.classList.add('open');
  backdrop.classList.remove('hidden');
  setTimeout(() => backdrop.classList.add('opacity-100'), 10);
  if (window.Haptics) Haptics.light();
}

function closeSheet() {
  document.getElementById('detail-sheet').classList.remove('open');
  const backdrop = document.getElementById('sheet-backdrop');
  backdrop.classList.remove('opacity-100');
  setTimeout(() => backdrop.classList.add('hidden'), 300);
}

function toggleSave(wordId, btn) {
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
}