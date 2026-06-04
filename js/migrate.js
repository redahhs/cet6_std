/* ===== Migration — 数据结构自动迁移 ===== */

const STATE_VERSION = 5;  // 当前数据结构版本

// 工具函数：获取本地 ISO 日期 (YYYY-MM-DD)
function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 暴露为全局函数，确保其他模块可访问
window.todayISO = todayISO;

function migrateState(rawState) {
    if (!rawState) return getDefaultState();
    let s = rawState;
    const ver = s.version || 3;

    // v3 → v4: 拆分 knownWords → wordProgress，新增 dailyActivity / achievements / reviewCount
    if (ver < 4) {
        s.wordProgress = s.wordProgress || {};
        // 旧 knownWords 中的单词都进入复习队列
        (s.knownWords || []).forEach(w => {
            if (!s.wordProgress[w]) {
                s.wordProgress[w] = {
                    stage: 1,
                    nextReview: todayISO(),
                    lastReviewed: null,
                    easeFactor: 2.5,
                    reviewCount: 0,
                    correctCount: 0,
                    errorCount: 0
                };
            }
        });
        // 分离旧 notebook 中可能混入的 Quote ID（v3.1 之前的 bug 修复）
        s.savedQuotes = s.savedQuotes || [];
        s.notebook = (s.notebook || []).filter(w => /^[a-zA-Z]/.test(w));
        s.dailyActivity = s.dailyActivity || {};
        s.achievements = s.achievements || {};
        s.reviewCount = s.reviewCount || 0;
        s.triedSorts = s.triedSorts || [];
        s.version = 4;
    }

    // v4 → v5: SRS 时间戳化 + 新增 goals / bookmarkedArticles / articleHistory / vocabTestResult
    if (ver < 5) {
        // 旧 wordProgress（stage/nextReview为日期）转新时间戳格式
        const newWP = {};
        Object.entries(s.wordProgress || {}).forEach(([w, p]) => {
            // 旧 nextReview 可能是 "2026-05-30" 字符串
            let nextTs;
            if (typeof p.nextReview === 'string') {
                nextTs = new Date(p.nextReview).getTime();
            } else if (typeof p.nextReview === 'number') {
                nextTs = p.nextReview;
            } else {
                nextTs = Date.now();
            }
            newWP[w] = {
                word: w,
                nextReview: nextTs,
                interval: [0, 5*60*1000, 30*60*1000, 12*3600*1000, 86400000, 2*86400000, 4*86400000, 7*86400000, 15*86400000][Math.min(p.stage || 0, 8)] || 300000,
                repetition: Math.min(p.stage || 0, 7),
                easeFactor: p.easeFactor || 2.5,
                lastReview: p.lastReviewed ? new Date(p.lastReviewed).getTime() : null,
                totalReviews: p.reviewCount || 0,
                correctReviews: p.correctCount || 0,
                lapseCount: p.errorCount || 0
            };
        });
        s.wordProgress = newWP;
        s.goals = s.goals || null;
        s.bookmarkedArticles = s.bookmarkedArticles || [];
        s.articleHistory = s.articleHistory || {};
        s.articlesRead = s.articlesRead || 0;
        s.vocabTestResult = s.vocabTestResult || null;
        s.version = 5;
    }
    return s;
}

function getDefaultState() {
    return {
        knownWords: [],
        notebook: [],
        savedQuotes: [],
        wordProgress: {},
        currentIndex: 0,
        sortMode: 'default',
        theme: 'light',
        accent: 'indigo',
        streak: 0,
        todayLearned: 0,
        currentLetter: 'ALL',
        lastStudyDate: null,
        dailyActivity: {},
        achievements: {},
        reviewCount: 0,
        triedSorts: [],
        goals: null,
        bookmarkedArticles: [],
        articleHistory: {},
        articlesRead: 0,
        vocabTestResult: null,
        version: STATE_VERSION
    };
}
