/* ===== CET-6 Immersive — Main Logic ===== */

const STORAGE_KEY = 'cet6_immersive_v5';

// 修复 2: 分离 notebook（单词收藏）和 savedQuotes（Quote 收藏）
// 修复 1: 增加 lastStudyDate 用于 streak 计算
// Sprint 1: 新增 wordProgress, dailyActivity, achievements 等
// Sprint 2: 新增 goals, bookmarkedArticles, articleHistory
let state = {
    knownWords: [], notebook: [], savedQuotes: [], wordProgress: {},
    currentIndex: 0, sortMode: 'default', theme: 'light', accent: 'indigo',
    streak: 0, todayLearned: 0, currentLetter: 'ALL', lastStudyDate: null,
    dailyActivity: {}, achievements: {}, reviewCount: 0, triedSorts: [],
    goals: null, bookmarkedArticles: [], articleHistory: {},
    articlesRead: 0, vocabTestResult: null, version: 5
};

let allWords = [], displayWords = [], isAnimating = false, isDetailVisible = false;

// 修复 Medium-10: 缓存 wordMap 避免重复构建
let wordMapCache = {};

/* ===== STATE ===== */
function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const raw = JSON.parse(saved);
            // Sprint 1-7: 自动迁移到新结构
            state = migrateState(raw);
        }
    } catch(e) {}

    // 修复 Low-14: 新的一天重置 todayLearned
    const today = new Date().toISOString().split('T')[0];
    if (state.lastStudyDate !== today) {
        state.todayLearned = 0;
        // Sprint 2-6: 重置每日目标进度
        if (!state.goals) state.goals = { dailyNewWords: 20, dailyReviewWords: 30, weeklyArticles: 3, todayProgress: { new: 0, review: 0, articles: 0 } };
        state.goals.todayProgress = { new: 0, review: 0, articles: 0 };
    }

    applyTheme(state.theme, state.accent);
}

// 修复 4: LocalStorage 容量保护
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch(e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn('[CET6] Storage quota exceeded, trimming knownWords');
            if (state.knownWords.length > 2000) {
                state.knownWords = state.knownWords.slice(-2000);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch(e2) {
                    console.error('[CET6] Failed to save even after trimming', e2);
                }
            }
        }
    }
}

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
// 修复 1+3: Streak 计算 + 进度环更新
// Sprint 1: 集成热力图、成就、复习入口
function initHome() {
    const h = new Date().getHours();
    const greetEl = document.getElementById('greetSub');
    const mainEl = document.getElementById('greetMain');
    if (greetEl) greetEl.textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    if (mainEl) mainEl.innerHTML = `Level up your <span>English</span>`;

    const streakEl = document.getElementById('streakNum');
    const todayEl = document.getElementById('todayLearned');
    const knownEl = document.getElementById('totalKnown');
    if (streakEl) {
        streakEl.textContent = state.streak || 0;
        // 数字滚动动画
        animateNumber(streakEl, state.streak || 0);
    }
    if (todayEl) todayEl.textContent = state.todayLearned || 0;
    if (knownEl) knownEl.textContent = state.knownWords.length;

    // Phase 6: 填充新统计卡片
    const statKnown = document.getElementById('statKnown');
    const statToday = document.getElementById('statToday');
    const statStreak = document.getElementById('statStreak');
    const statAch = document.getElementById('statAch');
    if (statKnown) {
        statKnown.textContent = state.knownWords.length;
        animateNumber(statKnown, state.knownWords.length, 600);
    }
    if (statToday) {
        statToday.textContent = state.todayLearned || 0;
        animateNumber(statToday, state.todayLearned || 0, 500);
    }
    if (statStreak) {
        statStreak.textContent = state.streak || 0;
        animateNumber(statStreak, state.streak || 0, 700);
    }
    const achUnlocked = getUnlockedCount();
    if (statAch) {
        statAch.textContent = achUnlocked;
        animateNumber(statAch, achUnlocked, 800);
    }

    // 计算今日进度比例
    const dailyGoal = (state.goals && state.goals.dailyNewWords) || 20;
    const todayProgress = state.todayLearned || 0;
    const progressMeta = document.getElementById('progressMeta');
    if (progressMeta) progressMeta.textContent = `${todayProgress} / ${dailyGoal}`;

    // 修复 3: 更新进度环
    const total = allWords.length;
    const known = state.knownWords.length;
    const pct = total > 0 ? Math.min(100, Math.round((known / total) * 100)) : 0;
    const circumference = 2 * Math.PI * 42; // ~263.89
    const offset = circumference - (pct / 100) * circumference;
    const ringFill = document.getElementById('ringFill');
    const ringText = document.getElementById('ringText');
    if (ringFill) {
        ringFill.setAttribute('stroke-dasharray', circumference);
        ringFill.setAttribute('stroke-dashoffset', offset);
    }
    if (ringText) ringText.textContent = `${pct}%`;

    // Sprint 1-4: 渲染热力图
    renderHeatmap('homeHeatmap');

    // Sprint 1-5: 更新成就计数
    const achCountEl = document.getElementById('homeAchievementCount');
    if (achCountEl) achCountEl.textContent = `${achUnlocked}/${ACHIEVEMENTS.length}`;

    // Sprint 1-1: 显示今日复习数
    const reviewEl = document.getElementById('homeReviewCount');
    if (reviewEl) reviewEl.textContent = getTodayReviewWords().length;

    // Sprint 2-6: 渲染目标进度
    renderGoalsWidget('homeGoals');
}

// 数字滚动动画
function animateNumber(el, target, duration = 600) {
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    if (start === target) return;
    const startTime = performance.now();
    const animate = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out-quart
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = Math.round(start + (target - start) * eased);
        el.textContent = current;
        if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
}

// 修复 1: Streak 计算逻辑
function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (state.lastStudyDate === today) {
        // 今天已经记录过，只增加今日计数
        state.todayLearned = (state.todayLearned || 0) + 1;
        saveState();
        return;
    }

    if (state.lastStudyDate) {
        const last = new Date(state.lastStudyDate);
        const now = new Date(today);
        const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            state.streak = (state.streak || 0) + 1;  // 连续一天
        } else if (diffDays > 1) {
            state.streak = 1;  // 中断了，重置为 1
        }
    } else {
        state.streak = 1;  // 第一次学习
    }

    state.lastStudyDate = today;
    state.todayLearned = (state.todayLearned || 0) + 1;
    saveState();
}

/* ===== VOCAB ===== */
async function loadWords() {
    try {
        const res = await fetch('./data/words.json');
        const data = await res.json();
        allWords = data.map(w => ({
            word: w.word,
            pos: w.translations?.[0]?.type || '',
            meaning: w.translations?.map(t => t.translation).join('\uFF1B') || '',
            phrases: w.phrases || []
        }));
        // 修复 Medium-10: 构建 wordMap 缓存
        wordMapCache = {};
        allWords.forEach(w => { wordMapCache[w.word] = w; });
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

    nav.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = `alpha-btn ${state.currentLetter === 'ALL' ? 'active' : ''}`;
    allBtn.dataset.letter = 'ALL';
    allBtn.textContent = 'ALL';
    allBtn.onclick = () => filterByLetter('ALL');
    nav.appendChild(allBtn);

    sorted.forEach(l => {
        const count = allWords.filter(w => w.word[0].toUpperCase() === l).length;
        const btn = document.createElement('button');
        btn.className = `alpha-btn ${state.currentLetter === l ? 'active' : ''}`;
        btn.dataset.letter = l;
        btn.onclick = () => filterByLetter(l);
        btn.innerHTML = `${l}<span style="font-size:9px;opacity:0.6;margin-left:2px">${count}</span>`;
        nav.appendChild(btn);
    });
}

function filterByLetter(letter) {
    state.currentLetter = letter;
    document.querySelectorAll('.alpha-btn').forEach(b => b.classList.toggle('active', b.dataset.letter === letter));
    applySorting();
}

function applySorting() {
    let filtered = [...allWords];
    if (state.currentLetter && state.currentLetter !== 'ALL') {
        filtered = filtered.filter(w => w.word[0].toUpperCase() === state.currentLetter);
    }
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
    if (!state.triedSorts) state.triedSorts = [];
    if (!state.triedSorts.includes(mode)) {
        state.triedSorts.push(mode);
    }
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === mode));
    const alphaNav = document.getElementById('alphaNav');
    if (alphaNav) {
        if (mode === 'az') {
            alphaNav.style.display = 'flex';
        } else {
            alphaNav.style.display = 'none';
            state.currentLetter = 'ALL';
            document.querySelectorAll('.alpha-btn').forEach(b => b.classList.toggle('active', b.dataset.letter === 'ALL'));
        }
    }
    applySorting();
    checkAchievements();
}

function renderCard() {
    const container = document.getElementById('cardContainer');
    const controls = document.getElementById('controls');
    if (!container || !controls) return;

    container.innerHTML = '';
    if (displayWords.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-2);padding:40px"><div style="font-size:3.5rem;margin-bottom:16px">\uD83D\uDCEE</div><h3>No words found</h3><p style="font-size:0.85rem;margin-top:8px">Try a different letter filter</p></div>';
        controls.classList.remove('active');
        return;
    }
    if (state.currentIndex >= displayWords.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-2);padding:40px"><div style="font-size:3.5rem;margin-bottom:16px">\uD83C\uDF89</div><h3>All caught up!</h3></div>';
        controls.classList.remove('active');
        return;
    }
    const w = displayWords[state.currentIndex];
    const isSaved = state.notebook.includes(w.word);
    const card = document.createElement('div');
    card.className = 'word-card';
    card.innerHTML = `
        <div class="word-en">${escapeHtml(w.word)}</div>
        <div class="word-meta">
            <div class="word-phonetic">${escapeHtml(w.pos)}</div>
            <button class="speak-btn" aria-label="Listen to pronunciation"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg></button>
            <button class="save-btn ${isSaved ? 'saved' : ''}" aria-label="${isSaved ? 'Remove from' : 'Add to'} notebook"><svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
        </div>
        <div class="word-pos">${escapeHtml(w.pos)}</div>
        <div class="word-cn">${escapeHtml(w.meaning)}</div>
        <div class="word-example">"${escapeHtml(w.phrases.length > 0 ? w.phrases[0].phrase : '')}"</div>
        <div class="tap-hint">Tap to reveal</div>
    `;
    card.addEventListener('click', () => { if (!isDetailVisible && !isAnimating) { card.classList.add('show-detail'); controls.classList.add('active'); isDetailVisible = true; } });

    // 绑定 speak 和 toggleNotebook 按钮事件
    const speakBtn = card.querySelector('.speak-btn');
    if (speakBtn) speakBtn.addEventListener('click', (e) => { e.stopPropagation(); speak(w.word); });
    const saveBtn = card.querySelector('.save-btn');
    if (saveBtn) saveBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleNotebook(w.word); });

    container.appendChild(card);
}

// 工具函数：HTML 转义
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 修复 5: 动画期间切换 Tab 安全检查
function handleSwipe(isKnown) {
    if (isAnimating || !isDetailVisible) return;
    isAnimating = true;
    const card = document.querySelector('.word-card');
    if (!card) { isAnimating = false; return; }

    card.classList.add(isKnown ? 'anim-r' : 'anim-l');

    if (isKnown) {
        const w = displayWords[state.currentIndex].word;
        if (!state.knownWords.includes(w)) state.knownWords.push(w);
        // 修复 1: 更新 streak
        updateStreak();
        // Sprint 1-1: SRS 算法调度下次复习
        onCorrect(w);
        // Sprint 1-4: 记录每日活动
        recordDailyActivity(1);
        // Sprint 2-6: 追踪目标
        if (state._inReviewMode) trackReview();
        else trackNewWord();
    } else {
        const w = displayWords[state.currentIndex].word;
        // Sprint 1-1: 答错进入下一轮复习
        onWrong(w);
    }

    setTimeout(() => {
        // 安全检查：确认 vocab 页面仍然可见
        const vocabPage = document.getElementById('page-vocab');
        if (!vocabPage || !vocabPage.classList.contains('active')) {
            isAnimating = false;
            isDetailVisible = false;
            return;
        }

        state.currentIndex++;
        saveState();
        isDetailVisible = false;
        isAnimating = false;
        const controls = document.getElementById('controls');
        if (controls) controls.classList.remove('active');
        renderCard();
        // 更新首页进度
        initHome();
        // Sprint 1-5: 检查成就
        checkAchievements();
    }, 350);
}

function toggleNotebook(word) {
    if (state.notebook.includes(word)) state.notebook = state.notebook.filter(w => w !== word);
    else state.notebook.push(word);
    saveState();
    renderCard();
    renderNotebook();
    checkAchievements();
}

/* ===== NOTEBOOK (Settings) ===== */
// 修复 Medium-10: 使用缓存的 wordMapCache
function renderNotebook() {
    const list = document.getElementById('notebookList');
    const empty = document.getElementById('notebookEmpty');
    const countEl = document.getElementById('notebookCount');
    const toolbar = document.getElementById('notebookToolbar');
    const searchInput = document.getElementById('notebookSearch');
    if (!list || !empty) return;

    let validNotebook = state.notebook.filter(w => wordMapCache[w]);

    if (countEl) countEl.textContent = validNotebook.length > 0 ? `(${validNotebook.length})` : '';
    if (toolbar) toolbar.style.display = validNotebook.length > 0 ? '' : 'none';

    if (validNotebook.length === 0) {
        empty.style.display = '';
        list.innerHTML = '';
        return;
    }
    empty.style.display = 'none';

    const query = (searchInput?.value || '').toLowerCase().trim();
    if (query) {
        validNotebook = validNotebook.filter(w => {
            const info = wordMapCache[w];
            return w.toLowerCase().includes(query) || (info.meaning && info.meaning.toLowerCase().includes(query));
        });
    }

    validNotebook.sort((a, b) => a.localeCompare(b));

    if (validNotebook.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:var(--text-3);padding:20px 0;font-size:0.85rem">No matches found</div>';
        return;
    }

    list.innerHTML = validNotebook.map(word => {
        const info = wordMapCache[word];
        return `<div class="notebook-item">
            <div class="notebook-item-main">
                <div class="notebook-word">${escapeHtml(word)}</div>
                <div class="notebook-meaning">${escapeHtml(info.meaning)}</div>
            </div>
            <div class="notebook-actions">
                <button class="notebook-btn btn-speak" aria-label="Listen to pronunciation"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg></button>
                <button class="notebook-btn btn-remove" aria-label="Remove from notebook"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
        </div>`;
    }).join('');

    // 绑定 notebook 按钮事件
    list.querySelectorAll('.btn-speak').forEach(btn => {
        const wordEl = btn.closest('.notebook-item').querySelector('.notebook-word');
        btn.onclick = () => speak(wordEl.textContent);
    });
    list.querySelectorAll('.btn-remove').forEach(btn => {
        const wordEl = btn.closest('.notebook-item').querySelector('.notebook-word');
        btn.onclick = () => removeFromNotebook(wordEl.textContent);
    });
}

function clearNotebook() {
    if (!confirm('Clear all saved words?')) return;
    state.notebook = [];
    saveState();
    renderNotebook();
    renderCard();
}

function removeFromNotebook(word) {
    state.notebook = state.notebook.filter(w => w !== word);
    saveState();
    renderNotebook();
    renderCard();
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
    const card = document.getElementById('quoteCard');
    if (card && currentQuote) {
        card.classList.add('quote-exit');
        await new Promise(r => setTimeout(r, 320));
        currentQuote = quotesData[Math.floor(Math.random() * quotesData.length)];
        renderQuote();
        card.classList.remove('quote-exit');
        void card.offsetWidth;
        card.classList.add('quote-enter');
        setTimeout(() => card.classList.remove('quote-enter'), 500);
    } else {
        currentQuote = quotesData[Math.floor(Math.random() * quotesData.length)];
        renderQuote();
    }
}

function renderQuote() {
    if (!currentQuote) return;
    document.getElementById('qBg').style.backgroundImage = `url(${currentQuote.bg})`;
    document.getElementById('qEn').textContent = `"${currentQuote.en}"`;
    document.getElementById('qCn').textContent = currentQuote.zh;
    document.getElementById('qSrc').textContent = `\u2014 ${currentQuote.author}`;
    // 修复 2: 同步收藏按钮状态
    const collectBtn = document.getElementById('collectBtn');
    if (collectBtn) collectBtn.classList.toggle('collected', state.savedQuotes.includes(currentQuote.id));
}

// 修复 2: 使用 savedQuotes 代替 notebook 存储 Quote 收藏
function toggleCollect() {
    if (!currentQuote) return;
    const qid = currentQuote.id;
    if (!state.savedQuotes) state.savedQuotes = [];
    if (state.savedQuotes.includes(qid)) {
        state.savedQuotes = state.savedQuotes.filter(x => x !== qid);
    } else {
        state.savedQuotes.push(qid);
    }
    saveState();
    document.getElementById('collectBtn').classList.toggle('collected', state.savedQuotes.includes(qid));
}

function speakQuote() {
    if (!window.speechSynthesis || !currentQuote) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(currentQuote.en);
    u.lang = 'en-US'; u.rate = 0.85;
    window.speechSynthesis.speak(u);
}

/* ===== QUOTE MODAL ===== */
window.openQuoteModal = function openQuoteModal() {
    if (!currentQuote) return;
    const modal = document.getElementById('quoteModal');
    if (!modal) return;
    document.getElementById('modalImg').src = currentQuote.bg;
    document.getElementById('modalQuote').textContent = `"${currentQuote.en}"`;
    document.getElementById('modalCn').textContent = currentQuote.zh;
    document.getElementById('modalAuthor').textContent = `\u2014 ${currentQuote.author}`;
    document.getElementById('modalLocText').textContent = currentQuote.location || 'Unknown';
    document.getElementById('modalPhotoByText').textContent = currentQuote.photoBy ? `Photo by ${currentQuote.photoBy}` : '';
    document.getElementById('modalLocation').style.display = currentQuote.location ? '' : 'none';
    document.getElementById('modalPhotoBy').style.display = currentQuote.photoBy ? '' : 'none';
    requestAnimationFrame(() => { modal.classList.add('active'); });
    document.body.style.overflow = 'hidden';
};

window.closeQuoteModal = function closeQuoteModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('quoteModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
};

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

    // 文章封面图标
    const coverIcons = ['📚', '🔬', '🌍', '💡', '🎨', '🚀', '🌱', '⚡', '🏛️', '🎭', '🔮', '🌟'];

    list.innerHTML = readingArticles.map((article, idx) => {
        const cet6Found = countCet6Words(article.content);
        totalCet6 += cet6Found.size;
        totalWords += (article.content.match(/[a-z]+/gi) || []).length;
        // Sprint 2-3: 评估难度
        const metrics = assessDifficulty(article.content);
        // Sprint 2-5: 检查收藏状态
        const bookmarked = isArticleBookmarked(article.id);

        const icon = coverIcons[idx % coverIcons.length];
        const difficultyClass = metrics.score <= 2 ? 'difficulty-easy' : metrics.score <= 3 ? 'difficulty-medium' : 'difficulty-hard';
        const difficultyLabel = metrics.score <= 2 ? 'Easy' : metrics.score <= 3 ? 'Medium' : 'Hard';
        const stars = '★'.repeat(metrics.score) + '☆'.repeat(5 - metrics.score);

        return `<article class="article-card" data-article-id="${escapeHtml(article.id)}" role="button" tabindex="0" aria-label="Read article: ${escapeHtml(article.title)}">
            <div class="article-cover">
                <div class="article-cover-pattern"></div>
                <div class="article-cover-icon" aria-hidden="true">${icon}</div>
            </div>
            <div class="article-body">
                <div class="article-card-header">
                    <h3>${escapeHtml(article.title)}</h3>
                    <button class="article-bookmark ${bookmarked ? 'bookmarked' : ''}" data-id="${escapeHtml(article.id)}" onclick="event.stopPropagation(); toggleArticleBookmark('${escapeHtml(article.id)}')" aria-label="${bookmarked ? 'Remove bookmark' : 'Add bookmark'}">${bookmarked ? '⭐' : '☆'}</button>
                </div>
                <div class="article-tags">
                    <span class="article-tag cet6">${cet6Found.size} CET-6</span>
                    <span class="article-tag ${difficultyClass}">${difficultyLabel} ${stars}</span>
                </div>
                <div class="meta">
                    <span>${escapeHtml(article.author || 'Unknown')}</span>
                    <span class="meta-dot"></span>
                    <span>${escapeHtml(article.date || '—')}</span>
                </div>
                <div class="preview">${escapeHtml(article.content)}</div>
            </div>
            <div class="article-card-footer">
                <span class="article-words">${metrics.wordCount} words · ${metrics.estimatedMinutes} min</span>
                <span>Tap to read →</span>
            </div>
        </article>`;
    }).join('');

    document.getElementById('readingTotal').textContent = readingArticles.length;
    document.getElementById('readingWords').textContent = totalCet6;
    document.getElementById('readingCoverage').textContent = totalWords > 0 ? Math.round(totalCet6 / totalWords * 100) + '%' : '0%';

    // 事件委托
    list.querySelectorAll('.article-card').forEach(card => {
        const onActivate = () => openArticleDetail(card.dataset.articleId);
        card.onclick = onActivate;
        card.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
            }
        };
    });
}

function openArticleDetail(id) {
    const article = readingArticles.find(a => a.id === id);
    if (!article) return;

    document.getElementById('detailTitle').textContent = article.title;
    document.getElementById('detailMeta').innerHTML = `<span>${escapeHtml(article.author)}</span><span>${escapeHtml(article.date)}</span>`;

    const html = highlightCet6Words(article.content);
    document.getElementById('detailBody').innerHTML = html;

    // Sprint 2-3: 难度评估
    const metrics = assessDifficulty(article.content);
    const diffEl = document.getElementById('detailDifficulty');
    if (diffEl) diffEl.innerHTML = renderDifficultyBadge(metrics);

    // Sprint 2-4: 阅读理解题按钮
    const quizBtn = document.getElementById('detailQuizBtn');
    if (quizBtn) {
        if (article.questions && article.questions.length > 0) {
            quizBtn.style.display = '';
            quizBtn.onclick = () => startReadingQuiz(id);
        } else {
            quizBtn.style.display = 'none';
        }
    }

    document.getElementById('reading-list-view').style.display = 'none';
    document.getElementById('articleDetail').classList.add('active');

    // Sprint 2-5: 记录阅读
    recordArticleRead(id);
    trackArticle();
    // 启动阅读计时
    if (window._articleTimer) clearInterval(window._articleTimer);
    const start = Date.now();
    window._articleTimer = setInterval(() => {
        const progress = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
        updateArticleProgress(id, progress, 1);
    }, 1000);
    window._articleStart = start;
}

function closeArticleDetail() {
    document.getElementById('articleDetail').classList.remove('active');
    document.getElementById('reading-list-view').style.display = '';
    if (window._articleTimer) {
        clearInterval(window._articleTimer);
        window._articleTimer = null;
    }
}

// 修复 6: 安全处理 HTML 内容，不破坏已有标签
// Sprint 1-6: 点击非 CET-6 单词也支持即点即查
function highlightCet6Words(text) {
    // 如果文本不含 HTML 标签，直接正则替换
    if (!text.includes('<') && !text.includes('>')) {
        return text.replace(/([a-zA-Z]+)/g, (match) => {
            const lower = match.toLowerCase();
            if (cet6WordSet.has(lower)) {
                const meaning = cet6WordMap[lower] || '';
                const escapedMatch = escapeHtml(match);
                return `<span class="cet6-word" data-word="${lower}">${escapedMatch}<span class="tooltip">${lower}${meaning ? ': ' + escapeHtml(meaning) : ''}</span></span>`;
            }
            // 非 CET-6 单词：可点击触发查词
            return `<span class="clickable-word" data-word="${lower}">${escapeHtml(match)}</span>`;
        });
    }

    // 含 HTML 的情况：使用 DOMParser 安全处理
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div class="reading-content">${text}</div>`, 'text/html');

    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const fragment = document.createDocumentFragment();
            const parts = node.textContent.split(/([a-zA-Z]+)/g);
            parts.forEach(part => {
                if (/^[a-zA-Z]+$/.test(part)) {
                    const lower = part.toLowerCase();
                    if (cet6WordSet.has(lower)) {
                        const span = document.createElement('span');
                        span.className = 'cet6-word';
                        span.dataset.word = lower;
                        span.textContent = part;
                        span.onclick = (e) => { e.stopPropagation(); span.classList.toggle('show-tip'); };
                        const meaning = cet6WordMap[lower] || '';
                        if (meaning) {
                            const tip = document.createElement('span');
                            tip.className = 'tooltip';
                            tip.textContent = `${lower}: ${meaning}`;
                            span.appendChild(tip);
                        }
                        fragment.appendChild(span);
                    } else if (lower.length > 2) {
                        // 短词不查
                        const span = document.createElement('span');
                        span.className = 'clickable-word';
                        span.dataset.word = lower;
                        span.textContent = part;
                        span.onclick = (e) => { e.stopPropagation(); showWordDetail(lower); };
                        fragment.appendChild(span);
                    } else {
                        fragment.appendChild(document.createTextNode(part));
                    }
                } else if (part) {
                    fragment.appendChild(document.createTextNode(part));
                }
            });
            return fragment;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const clone = document.createElement(node.tagName);
            for (const attr of node.attributes) {
                clone.setAttribute(attr.name, attr.value);
            }
            node.childNodes.forEach(child => {
                const processed = processNode(child);
                if (processed instanceof DocumentFragment) {
                    clone.appendChild(processed);
                } else {
                    clone.appendChild(processed);
                }
            });
            return clone;
        }

        return node.cloneNode(true);
    }

    const wrapper = doc.body.firstChild;
    return Array.from(wrapper.childNodes).map(child => {
        const result = processNode(child);
        const container = document.createElement('div');
        if (result instanceof DocumentFragment) {
            container.appendChild(result);
        } else {
            container.appendChild(result);
        }
        return container.innerHTML;
    }).join('');
}

/* ===== TAB SWITCHING ===== */
function switchTab(tabName, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    const targetPage = document.getElementById(`page-${tabName}`);
    if (targetPage) targetPage.classList.add('active');
    if (el) {
        el.classList.add('active');
    } else {
        const tabs = document.querySelectorAll('.tab-item');
        const tabMap = { home: 0, vocab: 1, reading: 2, quote: 3, settings: 4 };
        if (tabMap[tabName] !== undefined && tabs[tabMap[tabName]]) tabs[tabMap[tabName]].classList.add('active');
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

/* ===== SPRINT 1 HELPERS ===== */
function setVocabMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    if (mode === 'card') renderCard();
}

function startReview() {
    const reviewWords = getTodayReviewWords();
    if (reviewWords.length === 0) {
        showToast('No words to review today!', 'info');
        return;
    }
    displayWords = reviewWords;
    state.currentIndex = 0;
    switchTab('vocab');
    setTimeout(() => renderCard(), 100);
    showToast(`📚 ${reviewWords.length} words to review`, 'info');
    // 标记进入复习模式
    state._inReviewMode = true;
}

function renderAchievementWall() {
    const wall = document.getElementById('achievementWall');
    if (!wall) return;
    wall.innerHTML = ACHIEVEMENTS.map(a => {
        const unlocked = state.achievements?.[a.id]?.unlocked;
        return `<div class="achievement-tile ${unlocked ? 'unlocked' : 'locked'}" title="${a.desc}">
            <div class="achievement-icon">${unlocked ? a.icon : '🔒'}</div>
            <div class="achievement-name">${a.name}</div>
            <div class="achievement-desc">${a.desc}</div>
        </div>`;
    }).join('');
    document.getElementById('achievementModal').classList.add('active');
}

loadState(); initHome(); loadWords(); loadRandomQuote(); loadReadingModule();
