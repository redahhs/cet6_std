/* ===== Reading Quiz + Bookmark/History ===== */

let quizState = { active: false, current: 0, answers: [], questions: [] };

function startReadingQuiz(articleId) {
    const article = readingArticles.find(a => a.id === articleId);
    if (!article || !article.questions || article.questions.length === 0) {
        showToast('No questions available', 'error');
        return;
    }
    quizState = { active: true, current: 0, answers: [], questions: article.questions };
    renderQuiz();
    openQuizModal();
}

function renderQuiz() {
    const container = document.getElementById('quizContent');
    if (!container) return;
    const q = quizState.questions[quizState.current];
    if (!q) return finishQuiz();

    container.innerHTML = `
        <div class="quiz-progress">${quizState.current + 1} / ${quizState.questions.length}</div>
        <div class="quiz-question">${escapeHtml(q.question)}</div>
        <div class="quiz-options">
            ${q.options.map((opt, i) => `
                <button class="quiz-option" data-idx="${i}" onclick="answerQuiz(${i})">
                    <span class="opt-letter">${'ABCD'[i]}</span>
                    <span>${escapeHtml(opt)}</span>
                </button>
            `).join('')}
        </div>
    `;
}

function answerQuiz(choiceIdx) {
    const q = quizState.questions[quizState.current];
    const correct = choiceIdx === q.answer;
    quizState.answers.push({ q: quizState.current, choice: choiceIdx, correct });

    const opts = document.querySelectorAll('.quiz-option');
    opts.forEach((btn, i) => {
        btn.disabled = true;
        if (i === q.answer) btn.classList.add('correct');
        else if (i === choiceIdx) btn.classList.add('wrong');
    });

    setTimeout(() => {
        quizState.current += 1;
        if (quizState.current >= quizState.questions.length) finishQuiz();
        else renderQuiz();
    }, 1200);
}

function finishQuiz() {
    const correctCount = quizState.answers.filter(a => a.correct).length;
    const total = quizState.questions.length;
    const accuracy = Math.round(correctCount / total * 100);

    const container = document.getElementById('quizContent');
    if (container) {
        container.innerHTML = `
            <div class="quiz-result">
                <div class="quiz-result-emoji">${accuracy >= 80 ? '🏆' : accuracy >= 60 ? '📚' : '💪'}</div>
                <h2>Quiz Complete!</h2>
                <div class="quiz-result-score">${correctCount} / ${total}</div>
                <div class="quiz-result-acc">${accuracy}% accuracy</div>
                <div class="quiz-review">
                    ${quizState.questions.map((q, i) => {
                        const a = quizState.answers[i];
                        return `<div class="quiz-review-item ${a?.correct ? 'correct' : 'wrong'}">
                            <div class="quiz-review-q">${i+1}. ${escapeHtml(q.question)}</div>
                            <div class="quiz-review-ans">Your answer: <b>${escapeHtml(q.options[a?.choice ?? 0])}</b> ${a?.correct ? '✓' : '✗'}</div>
                            ${!a?.correct ? `<div class="quiz-review-correct">Correct: <b>${escapeHtml(q.options[q.answer])}</b></div>` : ''}
                            ${q.explanation ? `<div class="quiz-review-expl">${escapeHtml(q.explanation)}</div>` : ''}
                        </div>`;
                    }).join('')}
                </div>
                <button class="cta-btn" style="margin-top:24px" onclick="closeQuizModal()">Done</button>
            </div>
        `;
    }
    quizState.active = false;
}

function openQuizModal() {
    const modal = document.getElementById('quizModal');
    if (modal) modal.classList.add('active');
}

function closeQuizModal() {
    const modal = document.getElementById('quizModal');
    if (modal) modal.classList.remove('active');
}

/* ===== 收藏 + 阅读历史 ===== */
function toggleArticleBookmark(articleId) {
    if (!state.bookmarkedArticles) state.bookmarkedArticles = [];
    if (state.bookmarkedArticles.includes(articleId)) {
        state.bookmarkedArticles = state.bookmarkedArticles.filter(id => id !== articleId);
        showToast('Removed from bookmarks', 'info');
    } else {
        state.bookmarkedArticles.push(articleId);
        showToast('⭐ Bookmarked!', 'success');
    }
    saveState();
    renderArticleList();
}

function isArticleBookmarked(articleId) {
    return state.bookmarkedArticles?.includes(articleId) || false;
}

function recordArticleRead(articleId) {
    if (!state.articleHistory) state.articleHistory = {};
    const h = state.articleHistory[articleId] || { readCount: 0, lastReadAt: null, duration: 0, scrollProgress: 0 };
    h.readCount += 1;
    h.lastReadAt = Date.now();
    state.articleHistory[articleId] = h;
    state.articlesRead = (state.articlesRead || 0) + 1;
    saveState();
    checkAchievements();
}

function updateArticleProgress(articleId, progress, duration) {
    if (!state.articleHistory) state.articleHistory = {};
    const h = state.articleHistory[articleId] || { readCount: 0, lastReadAt: null, duration: 0, scrollProgress: 0 };
    h.scrollProgress = Math.max(h.scrollProgress || 0, progress);
    h.duration = (h.duration || 0) + duration;
    h.lastReadAt = Date.now();
    state.articleHistory[articleId] = h;
    saveState();
}

function getReadingHistory() {
    if (!state.articleHistory) return [];
    return Object.entries(state.articleHistory)
        .map(([id, data]) => ({ id, ...data }))
        .filter(h => h.lastReadAt)
        .sort((a, b) => b.lastReadAt - a.lastReadAt)
        .slice(0, 10);
}
