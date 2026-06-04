/* ===== SRS v2 — 智能复习系统（艾宾浩斯 + 时间戳 + 难度因子） ===== */

// 间隔表（毫秒）：5min, 30min, 12h, 1d, 2d, 4d, 7d, 15d
const SRS_INTERVALS = [
    5 * 60 * 1000,
    30 * 60 * 1000,
    12 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
    2 * 24 * 60 * 60 * 1000,
    4 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    15 * 24 * 60 * 60 * 1000
];

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

function nowMs() { return Date.now(); }

function initWordProgress(word) {
    return {
        word,
        nextReview: nowMs(),
        interval: SRS_INTERVALS[0],
        repetition: 0,
        easeFactor: DEFAULT_EASE,
        lastReview: null,
        totalReviews: 0,
        correctReviews: 0,
        lapseCount: 0
    };
}

// 答对：提升 repetition，按当前 repetition 计算下一 interval，更新 easeFactor
function onCorrect(word) {
    if (!state.wordProgress[word]) state.wordProgress[word] = initWordProgress(word);
    const p = state.wordProgress[word];
    p.repetition = Math.min(p.repetition + 1, SRS_INTERVALS.length - 1);
    p.interval = SRS_INTERVALS[p.repetition];
    p.nextReview = nowMs() + p.interval;
    p.lastReview = nowMs();
    p.totalReviews += 1;
    p.correctReviews += 1;
    // easeFactor 上升
    p.easeFactor = Math.min(2.8, p.easeFactor + 0.1);
}

// 答错：重置 repetition 到 0（或降到上一个），缩短 interval，降低 easeFactor
function onWrong(word) {
    if (!state.wordProgress[word]) state.wordProgress[word] = initWordProgress(word);
    const p = state.wordProgress[word];
    p.repetition = 0;
    p.interval = SRS_INTERVALS[0];  // 5 分钟后再来
    p.nextReview = nowMs() + p.interval;
    p.lastReview = nowMs();
    p.totalReviews += 1;
    p.lapseCount += 1;
    p.easeFactor = Math.max(MIN_EASE, p.easeFactor - 0.2);
}

function getTodayReviewWords() {
    const t = nowMs();
    return allWords.filter(w => {
        const p = state.wordProgress[w.word];
        return p && p.nextReview <= t;
    });
}

// 估算掌握度：综合 repetition / easeFactor / 正确率
function getMastery(word) {
    const p = state.wordProgress[word];
    if (!p || p.totalReviews === 0) return 0;
    const repScore = p.repetition / (SRS_INTERVALS.length - 1);
    const easeScore = (p.easeFactor - MIN_EASE) / (2.8 - MIN_EASE);
    const accScore = p.correctReviews / p.totalReviews;
    return Math.min(1, (repScore * 0.5 + easeScore * 0.2 + accScore * 0.3));
}

// 距离下次复习的人性化描述
function nextReviewLabel(word) {
    const p = state.wordProgress[word];
    if (!p) return 'new';
    const diff = p.nextReview - nowMs();
    if (diff <= 0) return 'due now';
    const min = Math.round(diff / 60000);
    if (min < 60) return `${min}m`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h`;
    return `${Math.round(hr / 24)}d`;
}
