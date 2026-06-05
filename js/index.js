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

/* ===== HOME — Less but better ===== */
function initHome() {
    // Greeting based on time
    const h = new Date().getHours();
    const greetEl = document.getElementById('greetSub');
    const mainEl = document.getElementById('greetMain');
    if (greetEl) {
        const tod = h < 5 ? 'evening' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
        const timeOfDay = h < 5 ? 'GOOD NIGHT' : h < 12 ? 'GOOD MORNING' : h < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
        greetEl.textContent = timeOfDay;
        const name = state.userName || '';
        mainEl.textContent = name ? `Hello, ${name}.` : (tod === 'morning' ? 'Good morning.' : tod === 'afternoon' ? 'Good afternoon.' : 'Good evening.');
    }

    // 3 个轻量统计数字
    const knownMini = document.getElementById('statKnownMini');
    const streakMini = document.getElementById('statStreakMini');
    const reviewMini = document.getElementById('statReviewMini');

    if (knownMini) {
        knownMini.textContent = state.knownWords.length;
        animateNumber(knownMini, state.knownWords.length, 600);
    }
    if (streakMini) {
        streakMini.textContent = state.streak || 0;
        animateNumber(streakMini, state.streak || 0, 700);
    }
    if (reviewMini) {
        const reviewCount = getTodayReviewWords().length;
        reviewMini.textContent = reviewCount;
    }

    // CTA 文案 (动态)
    const ctaMeta = document.getElementById('ctaMeta');
    if (ctaMeta) {
        const reviewCount = getTodayReviewWords().length;
        if (reviewCount > 0) ctaMeta.textContent = `${reviewCount} words to review`;
        else ctaMeta.textContent = 'Start a new session';
    }

    // 加载今日 Daily Quote
    loadDailyQuoteHero();
}

/* Daily Quote Hero - 在首页展示 */
function loadDailyQuoteHero() {
    const hero = document.getElementById('homeQuoteHero');
    // 兼容: index.js 内 quotesData 优先, 否则读 quote.js 暴露的 window.allQuotes
    const quotes = (typeof quotesData !== 'undefined' && quotesData.length > 0)
        ? quotesData
        : (window.allQuotes || []);
    if (!hero || !quotes || quotes.length === 0) return;

    // 每日固定一条 (基于日期种子)
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const quoteIdx = seed % quotes.length;
    const q = quotes[quoteIdx];

    const textEl = document.getElementById('homeQuoteText');
    const authorEl = document.getElementById('homeQuoteAuthor');
    const timeEl = document.getElementById('homeQuoteTime');
    const bgEl = document.getElementById('homeQuoteBg');

    if (textEl) textEl.textContent = q.en || q.text || '';
    if (authorEl) authorEl.textContent = q.author ? `— ${q.author}` : '';

    // 时间信息
    if (timeEl) {
        const h = today.getHours();
        const m = today.getMinutes().toString().padStart(2, '0');
        timeEl.textContent = `${h.toString().padStart(2, '0')}:${m}`;
    }

    // 背景图 (低饱和 + 模糊)
    if (bgEl) {
        const imgUrl = q.bg || q.image || getDefaultQuoteImage(q);
        bgEl.style.backgroundImage = `url('${imgUrl}')`;
    }
}
window.loadDailyQuoteHero = loadDailyQuoteHero;

function getDefaultQuoteImage(quote) {
    // 基于 quote id 选一张稳定图片
    const idx = (quote.id || 0) % 5;
    const images = [
        'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=70',  // 书房
        'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=70',  // 笔记本
        'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=70',  // 校园
        'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=70',  // 复古书桌
        'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=800&q=70'   // 山间小路
    ];
    return images[idx] || images[0];
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
    // 使用本地日期（与 todayISO 一致），避免 UTC 跨日问题
    const today = todayISO();
    if (state.lastStudyDate === today) {
        // 今天已经记录过，只增加今日计数
        state.todayLearned = (state.todayLearned || 0) + 1;
        saveState();
        return;
    }

    if (state.lastStudyDate) {
        const last = new Date(state.lastStudyDate + 'T00:00:00');
        const now = new Date(today + 'T00:00:00');
        const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

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
        container.innerHTML = '<div style="text-align:center;color:var(--text-2);padding:40px"><h3>No words found</h3><p style="font-size:0.85rem;margin-top:8px">Try a different letter filter</p></div>';
        controls.classList.remove('active');
        return;
    }
    if (state.currentIndex >= displayWords.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-2);padding:40px"><h3>All caught up!</h3></div>';
        controls.classList.remove('active');
        return;
    }
    const w = displayWords[state.currentIndex];
    const isSaved = state.notebook.includes(w.word);
    const card = document.createElement('div');
    card.className = 'word-card';
    // 使用 data 属性存储单词,供事件委托读取
    card.dataset.word = w.word;
    card.dataset.saved = isSaved ? '1' : '0';
    card.innerHTML = `
        <div class="word-card-top-spacer" aria-hidden="true"></div>
        <div class="word-en">${escapeHtml(w.word)}</div>
        <div class="word-meta">
            <div class="word-phonetic">${escapeHtml(w.pos)}</div>
            <button class="speak-btn" data-action="speak" data-word="${escapeHtml(w.word)}" aria-label="Listen to pronunciation"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg></button>
            <button class="save-btn ${isSaved ? 'saved' : ''}" data-action="save" data-word="${escapeHtml(w.word)}" aria-label="${isSaved ? 'Remove from' : 'Add to'} notebook"><svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
        </div>
        <div class="word-pos">${escapeHtml(w.pos)}</div>
        <div class="word-cn">${escapeHtml(w.meaning)}</div>
        <div class="word-example">"${escapeHtml(w.phrases.length > 0 ? w.phrases[0].phrase : '')}"</div>
        <div class="tap-hint">Tap to reveal</div>
        <div class="word-card-bottom-spacer" aria-hidden="true"></div>
    `;
    // 不再为 card / speak-btn / save-btn 单独 addEventListener
    // 所有事件由 _initCardEventDelegation 的委托监听器处理
    container.appendChild(card);
}

/* ===== 事件委托: WordCard 按钮绑定 ===== */
/**
 * 核心设计:
 * - 只在 cardContainer 上绑定一次 click 监听器
 * - 通过 event.target.closest() 判断点击目标
 * - 使用 data-action 属性区分操作类型
 * - 彻底避免 renderCard 时重复 addEventListener
 *
 * 操作类型:
 * - data-action="speak" → 朗读单词
 * - data-action="save"   → 收藏/取消收藏
 * - 无 data-action       → 翻转卡片 (show-detail)
 */
let _cardDelegationBound = false; // 防止重复绑定

function _initCardEventDelegation() {
    if (_cardDelegationBound) return;
    _cardDelegationBound = true;

    const container = document.getElementById('cardContainer');
    if (!container) return;

    container.addEventListener('click', (e) => {
        // 1. 检查是否点击了 speak 按钮
        const speakBtn = e.target.closest('[data-action="speak"]');
        if (speakBtn) {
            e.stopPropagation();
            const word = speakBtn.dataset.word;
            if (word) speak(word);
            return;
        }

        // 2. 检查是否点击了 save 按钮
        const saveBtn = e.target.closest('[data-action="save"]');
        if (saveBtn) {
            e.stopPropagation();
            const word = saveBtn.dataset.word;
            if (word) toggleNotebook(word);
            return;
        }

        // 3. 检查是否点击了卡片本身 (翻转)
        const card = e.target.closest('.word-card');
        if (card && !isDetailVisible && !isAnimating) {
            card.classList.add('show-detail');
            const controls = document.getElementById('controls');
            if (controls) controls.classList.add('active');
            isDetailVisible = true;
        }
    });
}

/* ===== 事件委托: Forgot/Know 按钮 ===== */
/**
 * Forgot/Know 按钮在 #controls 容器内,是固定的 DOM 元素
 * 只需绑定一次,不需要在每次 renderCard 时重复绑定
 */
let _controlsBound = false;

function _initControlsDelegation() {
    if (_controlsBound) return;
    _controlsBound = true;

    const controls = document.getElementById('controls');
    if (!controls) return;

    controls.addEventListener('click', (e) => {
        const forgotBtn = e.target.closest('.btn-forgot');
        const knownBtn = e.target.closest('.btn-known');

        if (forgotBtn) {
            handleSwipe(false);
        } else if (knownBtn) {
            handleSwipe(true);
        }
    });
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
            if (res.ok) {
                quotesData = await res.json();
                // 同步到全局,供 Home Hero 使用
                window.allQuotes = quotesData;
                // 触发 Home Hero 更新(数据已就绪)
                if (typeof window.loadDailyQuoteHero === 'function') {
                    window.loadDailyQuoteHero();
                }
            }
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
    // 同步收藏按钮状态
    const collectBtn = document.getElementById('collectBtn');
    if (collectBtn) collectBtn.classList.toggle('collected', state.savedQuotes.includes(currentQuote.id));

    // 日期 + 学习状态文案 (仪式感)
    const dateEl = document.getElementById('quoteDate');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
    }
    const statusEl = document.getElementById('quoteStatus');
    if (statusEl) {
        const h = new Date().getHours();
        statusEl.textContent = h < 5 ? 'Late Night Reflection' : h < 12 ? 'Morning Inspiration' : h < 18 ? 'Afternoon Focus' : 'Evening Calm';
    }
}

// 修复 2: 使用 savedQuotes 代替 notebook 存储 Quote 收藏
function toggleCollect() {
    if (!currentQuote) return;
    const qid = currentQuote.id;
    if (!state.savedQuotes) state.savedQuotes = [];
    if (state.savedQuotes.includes(qid)) {
        state.savedQuotes = state.savedQuotes.filter(x => x !== qid);
        if (typeof showToast === 'function') showToast('Removed from saved', 'info');
    } else {
        state.savedQuotes.push(qid);
        if (typeof showToast === 'function') showToast('Saved', 'success');
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

/* 分享 Quote (Web Share API + fallback) */
function shareQuote() {
    if (!currentQuote) return;
    const text = `"${currentQuote.en}"\n\n— ${currentQuote.author}\n\n${currentQuote.zh || ''}\n\n— via CET-6 Immersive`;
    if (navigator.share) {
        navigator.share({
            title: 'Daily Quote',
            text: text,
            url: window.location.href
        }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            if (typeof showToast === 'function') showToast('Copied to clipboard', 'success');
        });
    } else {
        if (typeof showToast === 'function') showToast('Share not supported', 'error');
    }
}
window.shareQuote = shareQuote;

/* 复制 Quote */
function copyQuote() {
    if (!currentQuote) return;
    const text = `"${currentQuote.en}" — ${currentQuote.author}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            if (typeof showToast === 'function') showToast('Copied', 'success');
        }).catch(() => {
            if (typeof showToast === 'function') showToast('Copy failed', 'error');
        });
    } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            if (typeof showToast === 'function') showToast('Copied', 'success');
        } catch {
            if (typeof showToast === 'function') showToast('Copy failed', 'error');
        }
        document.body.removeChild(ta);
    }
}
window.copyQuote = copyQuote;

/* 自动刷新 - 每天第一次进入时随机展示 */
function autoRefreshQuote() {
    if (!quotesData || quotesData.length === 0) return;
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const idx = seed % quotesData.length;
    if (currentQuote && currentQuote.id === quotesData[idx].id) return; // 今日同一条,不重复切换
    currentQuote = quotesData[idx];
    renderQuote();
}
window.autoRefreshQuote = autoRefreshQuote;

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

    // 修复：避免维基百科网络超时阻塞 UI 渲染，使用 AbortController + 短超时
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const wikiRes = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/Artificial_intelligence', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
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
    } catch(e) {
        // 静默失败：维基百科不可用不影响核心功能
    }

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

    list.innerHTML = readingArticles.map((article, idx) => {
        const cet6Found = countCet6Words(article.content);
        totalCet6 += cet6Found.size;
        totalWords += (article.content.match(/[a-z]+/gi) || []).length;
        // Sprint 2-3: 评估难度
        const metrics = assessDifficulty(article.content);
        // Sprint 2-5: 检查收藏状态
        const bookmarked = isArticleBookmarked(article.id);

        const difficultyClass = metrics.score <= 2 ? 'difficulty-easy' : metrics.score <= 3 ? 'difficulty-medium' : 'difficulty-hard';
        const difficultyLabel = metrics.score <= 2 ? 'Easy' : metrics.score <= 3 ? 'Medium' : 'Hard';
        // 使用首字母缩写代替 emoji / 星级
        const initials = getArticleInitials(article.title);
        const progress = bookmarked ? 100 : (article.id ? Math.abs(hashCode(article.id) % 60) + 20 : 30);

        return `<article class="article-card" data-article-id="${escapeHtml(article.id)}" role="button" tabindex="0" aria-label="Read article: ${escapeHtml(article.title)}">
            <div class="article-body">
                <div class="article-card-header">
                    <div class="article-mark" aria-hidden="true">${initials}</div>
                    <div class="article-card-info">
                        <h3>${escapeHtml(article.title)}</h3>
                        <div class="article-tags">
                            <span class="article-tag ${difficultyClass}">${difficultyLabel}</span>
                            <span class="article-tag time">${metrics.estimatedMinutes} min</span>
                            <span class="article-tag cet6">${cet6Found.size} CET-6</span>
                        </div>
                    </div>
                    <button class="article-bookmark ${bookmarked ? 'bookmarked' : ''}" data-id="${escapeHtml(article.id)}" onclick="event.stopPropagation(); toggleArticleBookmark('${escapeHtml(article.id)}')" aria-label="${bookmarked ? 'Remove bookmark' : 'Add bookmark'}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                </div>
                <p class="article-preview">${escapeHtml((article.content || '').slice(0, 140))}…</p>
                <div class="article-card-footer">
                    <span class="article-author">${escapeHtml(article.author || 'Unknown')}</span>
                    <div class="article-progress" aria-label="Reading progress">
                        <div class="article-progress-bar" style="width:${progress}%"></div>
                    </div>
                </div>
            </div>
        </article>`;
    }).join('');

    document.getElementById('readingTotal')?.replaceChildren(document.createTextNode(readingArticles.length));
    document.getElementById('readingWords')?.replaceChildren(document.createTextNode(totalCet6));
    document.getElementById('readingCoverage')?.replaceChildren(document.createTextNode(totalWords > 0 ? Math.round(totalCet6 / totalWords * 100) + '%' : '0%'));

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

/* 文章标题首字母缩写 (替代 emoji) */
function getArticleInitials(title) {
    if (!title) return '·';
    const cleaned = title.replace(/[^\w\s]/g, ' ').trim();
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '·';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return h;
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

/* ===== VIEW LIFECYCLE MANAGER ===== */
/**
 * 视图生命周期管理器
 *
 * 核心设计:
 * 1. 每个视图注册 onLeave (离开清理) 和 onEnter (进入初始化) 钩子
 * 2. switchTab 在切换时自动调用 onLeave → stopAll → onEnter
 * 3. onLeave 负责: 清除定时器、移除事件监听、重置局部状态
 * 4. onEnter 负责: 初始化视图、加载数据、绑定事件
 *
 * 注册方式: ViewLifecycle.register('vocab', { onLeave, onEnter })
 */
const ViewLifecycle = {
    _registry: {},
    _currentView: 'home',

    /**
     * 注册视图生命周期钩子
     * @param {string} viewName — 视图名称 (与 page-${viewName} 对应)
     * @param {object} hooks — { onLeave?: Function, onEnter?: Function }
     */
    register(viewName, hooks) {
        this._registry[viewName] = {
            onLeave: hooks.onLeave || null,
            onEnter: hooks.onEnter || null
        };
    },

    /**
     * 切换视图 (替代原 switchTab)
     * 执行顺序: onLeave(旧) → stopAll → 切换 DOM → onEnter(新)
     */
    switchTo(targetView, el) {
        if (targetView === this._currentView) return; // 防止重复切换

        const prevView = this._currentView;

        // 1. 执行旧视图的 onLeave (清理)
        this._callOnLeave(prevView);

        // 2. 强制停止所有音频 (单例管理器)
        if (window.AudioController) window.AudioController.stopAll();

        // 3. 切换 DOM 可见性
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

        const targetPage = document.getElementById(`page-${targetView}`);
        if (targetPage) targetPage.classList.add('active');

        if (el) {
            el.classList.add('active');
        } else {
            const tabs = document.querySelectorAll('.tab-item');
            const tabMap = { home: 0, vocab: 1, reading: 2, quote: 3, settings: 4 };
            if (tabMap[targetView] !== undefined && tabs[tabMap[targetView]]) {
                tabs[tabMap[targetView]].classList.add('active');
            }
        }

        // 4. 执行新视图的 onEnter (初始化)
        this._callOnEnter(targetView);

        // 5. 更新当前视图
        this._currentView = targetView;
    },

    /**
     * 调用视图的 onLeave 钩子
     */
    _callOnLeave(viewName) {
        const hooks = this._registry[viewName];
        if (hooks && hooks.onLeave) {
            try {
                hooks.onLeave();
            } catch (e) {
                console.warn(`[ViewLifecycle] onLeave("${viewName}") error:`, e);
            }
        }
    },

    /**
     * 调用视图的 onEnter 钩子
     */
    _callOnEnter(viewName) {
        const hooks = this._registry[viewName];
        if (hooks && hooks.onEnter) {
            try {
                hooks.onEnter();
            } catch (e) {
                console.warn(`[ViewLifecycle] onEnter("${viewName}") error:`, e);
            }
        }
    },

    /**
     * 获取当前视图名
     */
    getCurrentView() {
        return this._currentView;
    }
};
window.ViewLifecycle = ViewLifecycle;

/* ===== 注册各视图的生命周期钩子 ===== */

// HOME
ViewLifecycle.register('home', {
    onEnter() { initHome(); },
    onLeave() { /* Home 无需清理 */ }
});

// VOCAB
ViewLifecycle.register('vocab', {
    onEnter() { /* Vocab 在 loadWords 后自动渲染 */ },
    onLeave() {
        // 清理 Listening 模式
        if (typeof teardownListeningMode === 'function') teardownListeningMode();
        // 清理 Spelling 模式
        if (typeof teardownSpellingMode === 'function') teardownSpellingMode();
        // 重置卡片动画状态
        isAnimating = false;
        isDetailVisible = false;
    }
});

// READING
ViewLifecycle.register('reading', {
    onEnter() { /* Reading 在 loadReadingModule 后自动渲染 */ },
    onLeave() {
        // 清理文章详情计时器
        if (window._articleTimer) {
            clearInterval(window._articleTimer);
            window._articleTimer = null;
        }
    }
});

// QUOTE
ViewLifecycle.register('quote', {
    onEnter() {
        // 进入 Quote 页: 自动按当日种子加载
        if (typeof window.autoRefreshQuote === 'function') {
            window.autoRefreshQuote();
        }
    },
    onLeave() { /* Quote 无需特殊清理,音频由 stopAll 处理 */ }
});

// SETTINGS
ViewLifecycle.register('settings', {
    onEnter() {
        renderNotebook();
        if (typeof renderSettingsAchievements === 'function') {
            renderSettingsAchievements();
        }
    },
    onLeave() { /* Settings 无需清理 */ }
});

/* ===== TAB SWITCHING (兼容旧 API) ===== */
function switchTab(tabName, el) {
    ViewLifecycle.switchTo(tabName, el);
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

// 初始化事件委托 (只绑定一次,防止重复绑定)
_initCardEventDelegation();
_initControlsDelegation();
