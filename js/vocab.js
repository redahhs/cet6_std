let wordsData = [];
let currentIndex = 0;
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
    
    // 完美映射真实数据格式
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
    document.getElementById('v-stack').innerHTML = '<div class="v-empty"><div class="icon">⚠️</div><p>Failed to load words.json</p></div>';
  }
}

function renderCards() {
  const stack = document.getElementById('v-stack');
  stack.innerHTML = '';
  
  if (currentIndex >= wordsData.length) {
    stack.innerHTML = '<div class="v-empty"><div class="icon">🎉</div><p>Session Complete.<br>Take a breath.</p></div>';
    updateProgress();
    return;
  }

  const word = wordsData[currentIndex];
  const card = document.createElement('div');
  card.className = 'v-card';
  card.innerHTML = `
    <div class="v-pos">${word.pos}</div>
    <h2 class="v-word">${word.word}</h2>
    <p class="v-meaning">${word.meaning}</p>
    <div class="v-hint">Tap for phrases</div>
  `;
  
  activeCard = card;
  card.addEventListener('click', () => { if(!hasMoved) openSheet(word); });
  attachTouchEvents(card);
  stack.appendChild(card);
  updateProgress();
}

function updateProgress() {
  const total = wordsData.length;
  document.getElementById('v-progress-text').textContent = `${currentIndex} / ${total}`;
  document.getElementById('v-progress-fill').style.width = `${(currentIndex / total) * 100}%`;
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
  isDragging = true; hasMoved = false;
  startX = getX(e); startY = getY(e);
  activeCard.classList.add('swiping');
}

function touchMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  currentX = getX(e) - startX; currentY = getY(e) - startY;
  if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) hasMoved = true;
  activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${currentX * 0.05}deg)`;
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
  
  setTimeout(() => { currentIndex++; renderCards(); }, 300);
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
  
  let phrasesHTML = word.phrases.length ? word.phrases.map(p => `
    <div class="phrase">
      <p>${p.phrase}</p>
      <p class="zh">${p.translation}</p>
    </div>
  `).join('') : '<p style="color:#48484a">No phrases available.</p>';

  content.innerHTML = `
    <h3>${word.word}</h3>
    <p class="pos">${word.pos} · ${word.meaning}</p>
    <div class="section-title">Phrases & Collocations</div>
    ${phrasesHTML}
  `;
  
  sheet.classList.add('open');
  backdrop.classList.add('open');
}

function closeSheet() {
  document.getElementById('v-sheet').classList.remove('open');
  document.getElementById('v-backdrop').classList.remove('open');
}