/* ===== Goals — 学习目标 + 进度追踪 ===== */

const DEFAULT_GOALS = {
    dailyNewWords: 20,
    dailyReviewWords: 30,
    weeklyArticles: 3,
    monthlyMastery: 100,
    todayProgress: { new: 0, review: 0, articles: 0 }
};

function getGoals() {
    if (!state.goals) state.goals = { ...DEFAULT_GOALS };
    if (!state.goals.todayProgress) state.goals.todayProgress = { new: 0, review: 0, articles: 0 };
    return state.goals;
}

function resetDailyProgress() {
    const goals = getGoals();
    goals.todayProgress = { new: 0, review: 0, articles: 0 };
    saveState();
}

function trackNewWord() {
    const goals = getGoals();
    goals.todayProgress.new = (goals.todayProgress.new || 0) + 1;
    saveState();
}

function trackReview() {
    const goals = getGoals();
    goals.todayProgress.review = (goals.todayProgress.review || 0) + 1;
    saveState();
}

function trackArticle() {
    const goals = getGoals();
    goals.todayProgress.articles = (goals.todayProgress.articles || 0) + 1;
    saveState();
}

function getGoalsProgress() {
    const goals = getGoals();
    const tp = goals.todayProgress;
    return {
        newPct: Math.min(100, Math.round((tp.new / goals.dailyNewWords) * 100)),
        reviewPct: Math.min(100, Math.round((tp.review / goals.dailyReviewWords) * 100)),
        articlesPct: Math.min(100, Math.round((tp.articles / goals.weeklyArticles / 7) * 100)),
        overallPct: Math.min(100, Math.round((
            Math.min(tp.new / goals.dailyNewWords, 1) * 0.4 +
            Math.min(tp.review / goals.dailyReviewWords, 1) * 0.3 +
            Math.min(tp.articles / (goals.weeklyArticles / 7), 1) * 0.3
        ) * 100)),
        newCurrent: tp.new || 0,
        reviewCurrent: tp.review || 0,
        articlesCurrent: tp.articles || 0,
        goals
    };
}

function renderGoalsWidget(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const p = getGoalsProgress();

    container.innerHTML = `
        <div class="goals-widget">
            <div class="goals-header">
                <div>
                    <div class="goals-title">🎯 Today's Goals</div>
                    <div class="goals-overall">${p.overallPct}% complete</div>
                </div>
                <button class="goals-edit-btn" onclick="openGoalsSettings()">⚙️</button>
            </div>
            <div class="goal-bar">
                <div class="goal-bar-label">
                    <span>📘 New words</span>
                    <span><b>${p.newCurrent}</b> / ${p.goals.dailyNewWords}</span>
                </div>
                <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${p.newPct}%;background:var(--accent)"></div></div>
            </div>
            <div class="goal-bar">
                <div class="goal-bar-label">
                    <span>🔄 Reviews</span>
                    <span><b>${p.reviewCurrent}</b> / ${p.goals.dailyReviewWords}</span>
                </div>
                <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${p.reviewPct}%;background:#10B981"></div></div>
            </div>
            <div class="goal-bar">
                <div class="goal-bar-label">
                    <span>📖 Articles</span>
                    <span><b>${p.articlesCurrent}</b> / ${Math.max(1, Math.round(p.goals.weeklyArticles / 7))}</span>
                </div>
                <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${p.articlesPct}%;background:#F59E0B"></div></div>
            </div>
            ${p.overallPct >= 100 ? '<div class="goal-completed">🎉 All goals completed today!</div>' : ''}
        </div>
    `;
}

function openGoalsSettings() {
    const goals = getGoals();
    const html = `
        <div class="goals-settings">
            <h2>🎯 Daily Goals</h2>
            <div class="goal-input-group">
                <label>Daily new words</label>
                <div class="goal-input-control">
                    <button onclick="adjustGoal('dailyNewWords', -5)">−</button>
                    <span id="goalNew">${goals.dailyNewWords}</span>
                    <button onclick="adjustGoal('dailyNewWords', 5)">+</button>
                </div>
            </div>
            <div class="goal-input-group">
                <label>Daily review words</label>
                <div class="goal-input-control">
                    <button onclick="adjustGoal('dailyReviewWords', -5)">−</button>
                    <span id="goalReview">${goals.dailyReviewWords}</span>
                    <button onclick="adjustGoal('dailyReviewWords', 5)">+</button>
                </div>
            </div>
            <div class="goal-input-group">
                <label>Weekly articles</label>
                <div class="goal-input-control">
                    <button onclick="adjustGoal('weeklyArticles', -1)">−</button>
                    <span id="goalArticles">${goals.weeklyArticles}</span>
                    <button onclick="adjustGoal('weeklyArticles', 1)">+</button>
                </div>
            </div>
            <div class="goal-input-group">
                <label>Monthly mastery target</label>
                <div class="goal-input-control">
                    <button onclick="adjustGoal('monthlyMastery', -10)">−</button>
                    <span id="goalMastery">${goals.monthlyMastery}</span>
                    <button onclick="adjustGoal('monthlyMastery', 10)">+</button>
                </div>
            </div>
            <button class="cta-btn" style="margin-top:24px;width:100%" onclick="closeGoalsSettings()">Done</button>
        </div>
    `;
    showCustomModal(html);
}

function adjustGoal(key, delta) {
    const goals = getGoals();
    goals[key] = Math.max(1, (goals[key] || 0) + delta);
    saveState();
    const map = { dailyNewWords: 'goalNew', dailyReviewWords: 'goalReview', weeklyArticles: 'goalArticles', monthlyMastery: 'goalMastery' };
    const el = document.getElementById(map[key]);
    if (el) el.textContent = goals[key];
    renderGoalsWidget('homeGoals');
}

function closeGoalsSettings() {
    const modal = document.getElementById('customModal');
    if (modal) modal.classList.remove('active');
}

function showCustomModal(html) {
    let modal = document.getElementById('customModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customModal';
        modal.className = 'quote-modal';
        modal.innerHTML = `<div class="quote-modal-content" onclick="event.stopPropagation()" style="max-width:360px"><div class="modal-body" style="margin-top:0;padding:24px" id="customModalBody"></div><button class="modal-close" onclick="closeCustomModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
        modal.onclick = (e) => { if (e.target === modal) closeCustomModal(); };
        document.body.appendChild(modal);
    }
    document.getElementById('customModalBody').innerHTML = html;
    modal.classList.add('active');
}

function closeCustomModal() {
    const modal = document.getElementById('customModal');
    if (modal) modal.classList.remove('active');
}
