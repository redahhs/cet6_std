let wordsData = [];
let currentIndex = 0;
let isDragging = false;
let hasMoved = false;
let startX = 0, startY = 0, currentX = 0, currentY = 0;
let activeCard = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadWords();
  setupControls();
});

async function loadWords() {
  const loadingEl = document.getElementById('v-loading');
  const emptyEl = document.getElementById('v-empty');
  
  try {
    const res = await fetch('./data/words.json');
    if (!res.ok) throw new Error('Network response was not ok');
    const rawData = await res.json();
    
    // 数据映射，适配你的 words.json 格式
    wordsData = rawData.map(item => ({
      id: item.word,
      word: item.word,
      pos: item.translations && item.translations[0] ? item.translations[0].type : '',
      meaning: item.translations ? item.translations.map(t => t.translation).join('；') : '暂无释义',
      phrases: item.phrases || []
    }));
    
    loadingEl.style.display = 'none';
    renderCards();
  } catch (e) {
    console.error('Failed to load words:', e);
    loadingEl.textContent = 'Failed to load words. Please check network.';
  }
}

function renderCards() {
  const area = document.getElementById('v-card-area');
  const emptyEl = document.getElementById('v-empty');
  
  // 清除旧卡片
  const oldCards = area.querySelectorAll('.v-card');
  oldCards.forEach(c => c.remove());
  
  if (currentIndex >= wordsData.length) {
    emptyEl.style.display = 'block';
    updateProgress();
    return;
  }
  
  emptyEl.style.display = 'none';
  const word = wordsData[currentIndex];
  
  const card = document.createElement('div');
  card.className = 'v-card';
  card.innerHTML = `
    <div style="font-size: 12px; font-weight: 600; color: #5e5ce6; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">${word.pos}</div>
    <div style="font-size: 42px; font-weight: 700; background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 16px;">${word.word}</div>
    <button onclick="event.stopPropagation(); playAudio('${word.word}')" style="width: 56px; height: 56px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: #f5f5f7; border: none; cursor: pointer; margin-bottom: 32px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
    </button>
    <div style="font-size: 14px; color: #86868b;">Swipe or tap for details</div>
  `;
  
  activeCard = card;
  card.addEventListener('click', () => {
    if (!hasMoved) openSheet(word);
  });
  attachTouchEvents(card);
  area.appendChild(card);
  updateProgress();
}

function updateProgress() {
  document.getElementById('v-progress-text').textContent = `${currentIndex} / ${wordsData.length}`;
  const percent = wordsData.length > 0 ? (currentIndex / wordsData.length) * 100 : 0;
  document.getElementById('v-progress-fill').style.width = `${percent}%`;
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
  activeCard.style.transition = 'none';
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
  activeCard.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s ease';
  
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
  
  if (direction === 'right') {
    activeCard.style.transform = 'translateX(150%) rotate(30deg)';
    activeCard.style.opacity = '0';
    mastery = 3;
  } else if (direction === 'left') {
    activeCard.style.transform = 'translateX(-150%) rotate(-30deg)';
    activeCard.style.opacity = '0';
    mastery = 0;
  } else if (direction === 'up') {
    activeCard.style.transform = 'translateY(-150%) scale(0.8)';
    activeCard.style.opacity = '0';
    mastery = 1;
  }
  
  const progress = Store.get(DB_KEYS.VOCAB_PROGRESS) || {};
  progress[word.id] = { mastery, lastReview: Date.now() };
  Store.set(DB_KEYS.VOCAB_PROGRESS, progress);
  
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
  const sheet = document.getElementById('v-sheet');
  const backdrop = document.getElementById('v-backdrop');
  const content = document.getElementById('v-sheet-content');
  const isSaved = Store.isWordSaved(word.id);
  
  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
      <div>
        <div style="font-size: 28px; font-weight: 700; color: #f5f5f7;">${word.word}</div>
        <div style="font-size: 14px; color: #86868b; margin-top: 4px;">${word.pos}</div>
      </div>
      <button onclick="toggleSave('${word.id}', this)" style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: ${isSaved ? '#5e5ce6' : '#86868b'}; border: none; cursor: pointer;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </button>
    </div>
    <div style="margin-bottom: 24px;">
      <div style="font-size: 12px; color: #86868b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Meaning</p>
      <div style="font-size: 16px; color: #f5f5f7;">${word.meaning}</div>
    </div>
    ${word.phrases.length > 0 ? `
    <div>
      <div style="font-size: 12px; color: #86868b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Phrases</div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${word.phrases.slice(0, 5).map(p => `
          <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px;">
            <div style="font-size: 15px; font-weight: 500; color: #f5f5f7;">${p.phrase}</div>
            <div style="font-size: 13px; color: #86868b; margin-top: 4px;">${p.translation}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;
  
  sheet.classList.add('open');
  backdrop.classList.add('open');
}

function closeSheet() {
  document.getElementById('v-sheet').classList.remove('open');
  document.getElementById('v-backdrop').classList.remove('open');
}

function toggleSave(wordId, btn) {
  if (Store.isWordSaved(wordId)) {
    Store.unsaveWord(wordId);
    btn.style.color = '#86868b';
    btn.querySelector('svg').setAttribute('fill', 'none');
  } else {
    Store.saveWord(wordId);
    btn.style.color = '#5e5ce6';
    btn.querySelector('svg').setAttribute('fill', 'currentColor');
  }
}