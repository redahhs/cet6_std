let originalWordsData = [];
let wordsData = [];
let currentIndex = 0;
let currentSort = 'default';

let startX = 0, startY = 0, currentX = 0, currentY = 0;
let isDragging = false, hasMoved = false;
let activeCard = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadWords();
    setupControls();
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
        applySorting();
    } catch (e) {
        console.error("Failed to load words", e);
    }
}

// 🌟 排序核心逻辑
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
    updateSortUI();
}

window.changeSort = function(sortType) {
    if (currentSort === sortType) return;
    currentSort = sortType;
    if (window.Haptics) Haptics.light();
    applySorting();
}

function updateSortUI() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        if (btn.dataset.sort === currentSort) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function renderCards() {
    const container = document.getElementById('card-container');
    const emptyState = document.getElementById('empty-state');
    container.innerHTML = '';
    
    if (currentIndex >= wordsData.length) {
        emptyState.style.display = 'flex';
        updateProgress();
        return;
    }
    
    emptyState.style.display = 'none';
    const word = wordsData[currentIndex];
    
    const card = document.createElement('div');
    card.className = 'vocab-card';
    card.innerHTML = `
        <div class="pos">${word.pos}</div>
        <div class="word">${word.word}</div>
        <div class="meaning">${word.meaning}</div>
    `;
    
    activeCard = card;
    card.addEventListener('click', () => { if (!hasMoved) openSheet(word); });
    attachTouchEvents(card);
    container.appendChild(card);
    updateProgress();
}

function updateProgress() {
    document.getElementById('progress-text').textContent = `${currentIndex} / ${wordsData.length}`;
    const percent = wordsData.length > 0 ? (currentIndex / wordsData.length) * 100 : 0;
    document.getElementById('progress-fill').style.width = `${percent}%`;
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
    activeCard.style.transition = 'none';
}

function touchMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    currentX = getX(e) - startX; currentY = getY(e) - startY;
    if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) hasMoved = true;
    const rotate = currentX * 0.05;
    activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
    
    let leftOpacity = Math.max(0, -currentX / 100);
    let rightOpacity = Math.max(0, currentX / 100);
    activeCard.style.boxShadow = `
        inset 0 0 100px rgba(255, 69, 58, ${leftOpacity * 0.2}),
        inset 0 0 100px rgba(48, 209, 88, ${rightOpacity * 0.2})
    `;
}

function touchEnd() {
    if (!isDragging) return;
    isDragging = false;
    activeCard.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
    
    if (currentX > 100) flyOut('right');
    else if (currentX < -100) flyOut('left');
    else {
        activeCard.style.transform = '';
        activeCard.style.boxShadow = '';
    }
}

function flyOut(direction) {
    const word = wordsData[currentIndex];
    let mastery = direction === 'right' ? 3 : 0;
    
    activeCard.style.transform = `translate(${direction === 'right' ? 150 : -150}%, 0) rotate(${direction === 'right' ? 30 : -30}deg)`;
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
    document.getElementById('btn-forgot').addEventListener('click', () => activeCard && flyOut('left'));
    document.getElementById('btn-known').addEventListener('click', () => activeCard && flyOut('right'));
}

function openSheet(word) {
    const sheet = document.getElementById('sheet');
    const backdrop = document.getElementById('backdrop');
    const content = document.getElementById('sheet-content');
    
    content.innerHTML = `
        <h3>${word.word}</h3>
        <div class="pos">${word.pos}</div>
        <div class="label">Meaning</div>
        <div class="meaning">${word.meaning}</div>
        ${word.phrases.length > 0 ? `
            <div class="label">Phrases</div>
            ${word.phrases.map(p => `
                <div class="phrase-item">
                    <div class="en">${p.phrase}</div>
                    <div class="zh">${p.translation}</div>
                </div>
            `).join('')}
        ` : ''}
    `;
    
    sheet.classList.add('active');
    backdrop.classList.add('active');
    if (window.Haptics) Haptics.light();
}

window.closeSheet = function() {
    document.getElementById('sheet').classList.remove('active');
    document.getElementById('backdrop').classList.remove('active');
}