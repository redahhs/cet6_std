/* ===== CET-6 Immersive — Main Logic ===== */

const STORAGE_KEY = 'cet6_immersive_v3';
let state = { knownWords: [], notebook: [], currentIndex: 0, sortMode: 'default', theme: 'light', accent: 'indigo', streak: 0, todayLearned: 0, currentLetter: 'ALL' };
let allWords = [], displayWords = [], isAnimating = false, isDetailVisible = false;

/* ===== STATE ===== */
function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) state = { ...state, ...JSON.parse(saved) };
    } catch(e) {}
    applyTheme(state.theme, state.accent);
}

function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {} }

/* ===== THEME ===== */
function setTheme(t) { state.theme = t; applyTheme(t, state.accent); saveState(); }
function setAccent(a) { state.accent = a; applyTheme(state.theme, a); saveState(); }
function applyTheme(t, a) {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-accent', a);
    document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('active', b.dataset.themeVal === t));
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === a));
}

function resetAllData() {
    if (confirm('Reset all progress?')) { localStorage.removeItem(STORAGE_KEY); location.reload(); }
}

/* ===== SPEECH ===== */
function speak(word) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US'; u.rate = 0.9;
    window.speechSynthesis.speak(u);
}

/* ===== HOME ===== */
function initHome() {
    const h = new Date().getHours();
    document.getElementById('greetSub').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    document.getElementById('greetMain').innerHTML = `Level up your <span>English</span>`;
    document.getElementById('streakNum').textContent = state.streak || 0;
    document.getElementById('todayLearned').textContent = state.todayLearned || 0;
    document.getElementById('totalKnown').textContent = state.knownWords.length;
}

/* ===== VOCAB ===== */
async function loadWords() {
    try {
        const res = await fetch('./data/words.json');
        const data = await res.json();
        allWords = data.map(w => ({
            word: w.word,
            pos: w.translations?.[0]?.type || '',
            meaning: w.translations?.map(t => t.translation).join('；') || '',
            phrases: w.phrases || []
        }));
        buildAlphaNav();
        applySorting();
    } catch(e) { console.error(e); }
}

/* ===== A-Z NAVIGATION ===== */
function buildAlphaNav() {
    const nav = document.getElementById('alphaNav');
    if (!nav) return;
    const letters = new Set();
    allWords.forEach(w => { if (w.word && w.word[0]) letters.add(w.word[0].toUpperCase()); });
    const sorted = [...letters].sort();
    nav.innerHTML = `<button class="alpha-btn ${state.currentLetter === 'ALL' ? 'active' : ''}" data-letter="ALL" onclick="filterByLetter('ALL')">ALL</button>`;
    sorted.forEach(l => {
        const count = allWords.filter(w => w.word[0].toUpperCase() === l).length;
        nav.innerHTML += `<button class="alpha-btn ${state.currentLetter === l ? 'active' : ''}" data-letter="${l}" onclick="filterByLetter('${l}')">${l}<span style="font-size:9px;opacity:0.6;margin-left:2px">${count}</span></button>`;
    });
}

function filterByLetter(letter) {
    state.currentLetter = letter;
    document.querySelectorAll('.alpha-btn').forEach(b => b.classList.toggle('active', b.dataset.letter === letter));
    applySorting();
}

function applySorting() {
    let filtered = [...allWords];
    // Apply letter filter first
    if (state.currentLetter && state.currentLetter !== 'ALL') {
        filtered = filtered.filter(w => w.word[0].toUpperCase() === state.currentLetter);
    }
    // Then apply sort
    if (state.sortMode === 'random') {
        filtered = filtered.sort(() => Math.random() - 0.5);
    } else if (state.sortMode === 'az') {
        filtered = filtered.sort((a, b) => a.word.localeCompare(b.word));
    }
    displayWords = filtered;
    state.currentIndex = 0;
    renderCard();
}

function setSort(mode) {
    state.sortMode = mode;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === mode));
    applySorting();
}

function renderCard() {
    const container = document.getElementById('cardContainer');
    const controls = document.getElementById('controls');
    container.innerHTML = '';
    if (displayWords.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-2);padding:40px"><div style="font-size:3.5rem;margin-bottom:16px">📭</div><h3>No words found</h3><p style="font-size:0.85rem;margin-top:8px">Try a different letter filter</p></div>';
        controls.classList.remove('active'); return;
    }
    if (state.currentIndex >= displayWords.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-2);padding:40px"><div style="font-size:3.5rem;margin-bottom:16px">🎉</div><h3>All caught up!</h3></div>';
        controls.classList.remove('active'); return;
    }
    const w = displayWords[state.currentIndex];
    const isSaved = state.notebook.includes(w.word);
    const card = document.createElement('div');
    card.className = 'word-card';
    card.innerHTML = `
        <div class="word-en">${w.word}</div>
        <div class="word-meta">
            <div class="word-phonetic">${w.pos}</div>
            <button class="speak-btn" onclick="event.stopPropagation(); speak('${w.word}')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg></button>
            <button class="save-btn ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation(); toggleNotebook('${w.word}')"><svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
        </div>
        <div class="word-pos">${w.pos}</div>
        <div class="word-cn">${w.meaning}</div>
        <div class="word-example">"${w.phrases.length > 0 ? w.phrases[0].phrase : ''}"</div>
        <div class="tap-hint">Tap to reveal</div>
    `;
    card.addEventListener('click', () => { if (!isDetailVisible && !isAnimating) { card.classList.add('show-detail'); controls.classList.add('active'); isDetailVisible = true; } });
    container.appendChild(card);
}

function handleSwipe(isKnown) {
    if (isAnimating || !isDetailVisible) return;
    isAnimating = true;
    document.querySelector('.word-card').classList.add(isKnown ? 'anim-r' : 'anim-l');
    if (isKnown) {
        const w = displayWords[state.currentIndex].word;
        if (!state.knownWords.includes(w)) state.knownWords.push(w);
    }
    setTimeout(() => {
        state.currentIndex++;
        saveState(); isDetailVisible = false; isAnimating = false;
        document.getElementById('controls').classList.remove('active');
        renderCard();
    }, 350);
}

function toggleNotebook(word) {
    if (state.notebook.includes(word)) state.notebook = state.notebook.filter(w => w !== word);
    else state.notebook.push(word);
    saveState(); renderCard(); renderNotebook();
}

/* ===== NOTEBOOK (Settings) ===== */
function renderNotebook() {
    const list = document.getElementById('notebookList');
    const empty = document.getElementById('notebookEmpty');
    if (!list || !empty) return;

    // Filter notebook to only show words that exist in allWords
    const wordMap = {};
    allWords.forEach(w => { wordMap[w.word] = w; });

    const validNotebook = state.notebook.filter(w => wordMap[w]);

    if (validNotebook.length === 0) {
        empty.style.display = '';
        list.innerHTML = '';
        return;
    }
    empty.style.display = 'none';

    list.innerHTML = validNotebook.map(word => {
        const info = wordMap[word];
        return `<div class="notebook-item">
            <div>
                <div class="notebook-word">${word}</div>
                <div class="notebook-meaning">${info.meaning}</div>
            </div>
            <div class="notebook-actions">
                <button class="notebook-btn btn-speak" onclick="speak('${word}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg></button>
                <button class="notebook-btn btn-remove" onclick="removeFromNotebook('${word}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
        </div>`;
    }).join('');
}

function removeFromNotebook(word) {
    state.notebook = state.notebook.filter(w => w !== word);
    saveState(); renderNotebook(); renderCard();
}

/* ===== QUOTE ===== */
let quotesData = [];
let currentQuote = null;

async function loadRandomQuote() {
    if (quotesData.length === 0) {
        try {
            const res = await fetch('./data/quotes.json');
            if (res.ok) quotesData = await res.json();
        } catch(e) {}
    }
    if (quotesData.length === 0) return;
    currentQuote = quotesData[Math.floor(Math.random() * quotesData.length)];
    renderQuote();
}

function renderQuote() {
    if (!currentQuote) return;
    document.getElementById('qBg').style.backgroundImage = `url(${currentQuote.bg})`;
    document.getElementById('qEn').textContent = `"${currentQuote.en}"`;
    document.getElementById('qCn').textContent = currentQuote.zh;
    document.getElementById('qSrc').textContent = `— ${currentQuote.author}`;
}

function toggleCollect() {
    if (!currentQuote) return;
    const qid = currentQuote.id;
    if (state.notebook.includes(qid)) state.notebook = state.notebook.filter(x => x !== qid);
    else state.notebook.push(qid);
    saveState();
    document.getElementById('collectBtn').classList.toggle('collected');
}

function speakQuote() {
    if (!window.speechSynthesis || !currentQuote) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(currentQuote.en);
    u.lang = 'en-US'; u.rate = 0.85;
    window.speechSynthesis.speak(u);
}

/* ===== QUOTE MODAL ===== */
function openQuoteModal() {
    if (!currentQuote) return;
    const modal = document.getElementById('quoteModal');
    document.getElementById('modalImg').src = currentQuote.bg;
    document.getElementById('modalQuote').textContent = `"${currentQuote.en}"`;
    document.getElementById('modalCn').textContent = currentQuote.zh;
    document.getElementById('modalAuthor').textContent = `— ${currentQuote.author}`;
    document.getElementById('modalLocText').textContent = currentQuote.location || 'Unknown';
    document.getElementById('modalPhotoByText').textContent = currentQuote.photoBy ? `Photo by ${currentQuote.photoBy}` : '';
    // Show/hide meta items
    document.getElementById('modalLocation').style.display = currentQuote.location ? '' : 'none';
    document.getElementById('modalPhotoBy').style.display = currentQuote.photoBy ? '' : 'none';
    // Trigger animation
    requestAnimationFrame(() => { modal.classList.add('active'); });
    document.body.style.overflow = 'hidden';
}

function closeQuoteModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('quoteModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

/* ===== READING ===== */
let readingArticles = [];
let cet6WordSet = new Set();
let cet6WordMap = {};

async function loadReadingModule() {
    allWords.forEach(w => {
        const lower = w.word.toLowerCase();
        cet6WordSet.add(lower);
        cet6WordMap[lower] = w.meaning;
    });

    try {
        const res = await fetch('./data/reading.json');
        readingArticles = await res.json();
    } catch(e) {
        console.error('Failed to load reading data', e);
        return;
    }

    try {
        const wikiRes = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/Artificial_intelligence');
        if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            if (wikiData.extract && !readingArticles.find(a => a.id === 'wiki-ai')) {
                readingArticles.unshift({
                    id: 'wiki-ai',
                    title: wikiData.title || 'Artificial Intelligence',
                    author: 'Wikipedia',
                    date: 'Live',
                    content: wikiData.extract
                });
            }
        }
    } catch(e) {}

    renderArticleList();
}

function countCet6Words(text) {
    const words = text.toLowerCase().match(/[a-z]+/g) || [];
    const found = new Set();
    words.forEach(w => { if (cet6WordSet.has(w)) found.add(w); });
    return found;
}

function renderArticleList() {
    const list = document.getElementById('articleList');
    let totalCet6 = 0;
    let totalWords = 0;

    list.innerHTML = readingArticles.map(article => {
        const cet6Found = countCet6Words(article.content);
        totalCet6 += cet6Found.size;
        totalWords += (article.content.match(/[a-z]+/gi) || []).length;
        return `<div class="article-card" onclick="openArticleDetail('${article.id}')">
            <h3>${article.title}</h3>
            <div class="meta"><span>${article.author}</span><span>${article.date}</span></div>
            <div class="preview">${article.content}</div>
            <div class="cet6-count">${cet6Found.size} CET-6 words</div>
        </div>`;
    }).join('');

    document.getElementById('readingTotal').textContent = readingArticles.length;
    document.getElementById('readingWords').textContent = totalCet6;
    document.getElementById('readingCoverage').textContent = totalWords > 0 ? Math.round(totalCet6 / totalWords * 100) + '%' : '0%';
}

function openArticleDetail(id) {
    const article = readingArticles.find(a => a.id === id);
    if (!article) return;

    document.getElementById('detailTitle').textContent = article.title;
    document.getElementById('detailMeta').innerHTML = `<span>${article.author}</span><span>${article.date}</span>`;

    const html = highlightCet6Words(article.content);
    document.getElementById('detailBody').innerHTML = html;

    document.getElementById('reading-list-view').style.display = 'none';
    document.getElementById('articleDetail').classList.add('active');
}

function closeArticleDetail() {
    document.getElementById('articleDetail').classList.remove('active');
    document.getElementById('reading-list-view').style.display = '';
}

function highlightCet6Words(text) {
    return text.replace(/([a-zA-Z]+)/g, (match) => {
        const lower = match.toLowerCase();
        if (cet6WordSet.has(lower)) {
            const meaning = cet6WordMap[lower] || '';
            return `<span class="cet6-word" onclick="event.stopPropagation(); this.classList.toggle('show-tip')">${match}<span class="tooltip">${lower}${meaning ? ': ' + meaning : ''}</span></span>`;
        }
        return match;
    });
}

/* ===== TAB SWITCHING ===== */
function switchTab(tabName, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.getElementById(`page-${tabName}`).classList.add('active');
    if (el) el.classList.add('active');
    else {
        const tabs = document.querySelectorAll('.tab-item');
        const tabMap = { home: 0, vocab: 1, reading: 2, quote: 3, settings: 4 };
        if (tabMap[tabName] !== undefined) tabs[tabMap[tabName]].classList.add('active');
    }
    if (tabName === 'home') initHome();
    if (tabName === 'settings') renderNotebook();
}

/* ===== INIT ===== */
const urlParams = new URLSearchParams(window.location.search);
const tabParam = urlParams.get('tab');
if (tabParam && ['home', 'vocab', 'reading', 'quote', 'settings'].includes(tabParam)) {
    switchTab(tabParam);
}

loadState(); initHome(); loadWords(); loadRandomQuote(); loadReadingModule();
