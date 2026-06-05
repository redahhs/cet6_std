/* ===== Achievements — 成就系统 ===== */

const ACHIEVEMENTS = [
    { id: "first_word", name: "First Step", icon: "🌱", desc: "Learn your first word", condition: s => s.knownWords.length >= 1 },
    { id: "vocab_10", name: "Getting Started", icon: "📘", desc: "Learn 10 words", condition: s => s.knownWords.length >= 10 },
    { id: "vocab_100", name: "Century", icon: "💯", desc: "Learn 100 words", condition: s => s.knownWords.length >= 100 },
    { id: "vocab_500", name: "Half Grand", icon: "🏆", desc: "Learn 500 words", condition: s => s.knownWords.length >= 500 },
    { id: "vocab_5500", name: "CET-6 Master", icon: "👑", desc: "Master all CET-6 vocabulary", condition: s => s.knownWords.length >= 5500 },
    { id: "streak_3", name: "Consistent", icon: "🔥", desc: "3-day streak", condition: s => (s.streak || 0) >= 3 },
    { id: "streak_7", name: "Week Warrior", icon: "🔥", desc: "7-day streak", condition: s => (s.streak || 0) >= 7 },
    { id: "streak_30", name: "Monthly Master", icon: "⚡", desc: "30-day streak", condition: s => (s.streak || 0) >= 30 },
    { id: "notebook_10", name: "Collector", icon: "📚", desc: "Save 10 words to notebook", condition: s => (s.notebook?.length || 0) >= 10 },
    { id: "all_sorts", name: "Flexible Learner", icon: "🔀", desc: "Try all sort modes", condition: s => s.triedSorts && s.triedSorts.length >= 3 },
    { id: "first_review", name: "Memory Master", icon: "🧠", desc: "Complete your first review", condition: s => s.reviewCount >= 1 }
];

function checkAchievements() {
    if (!state.achievements) state.achievements = {};
    ACHIEVEMENTS.forEach(a => {
        if (!state.achievements[a.id]?.unlocked && a.condition(state)) {
            unlockAchievement(a);
        }
    });
}

function unlockAchievement(a) {
    state.achievements[a.id] = { unlocked: true, date: todayISO() };
    showToast(`${a.icon} Achievement Unlocked: ${a.name}`, 'success');
    if (typeof playAchievementSound === 'function') playAchievementSound();
    saveState();
}

function getUnlockedCount() {
    if (!state.achievements) return 0;
    return Object.values(state.achievements).filter(a => a.unlocked).length;
}

/* 渲染到 Settings 页面的简化成就墙 */
function renderSettingsAchievements() {
    const container = document.getElementById('settingsAchievements');
    const countEl = document.getElementById('settingsAchCount');
    if (!container) return;

    if (!ACHIEVEMENTS.length) {
        container.innerHTML = '<div class="achievement-mini-empty">No achievements available</div>';
        return;
    }

    const unlockedCount = getUnlockedCount();
    if (countEl) countEl.textContent = `${unlockedCount}/${ACHIEVEMENTS.length}`;

    container.innerHTML = ACHIEVEMENTS.map(a => {
        const unlocked = state.achievements?.[a.id]?.unlocked;
        return `
            <div class="achievement-mini-item ${unlocked ? '' : 'locked'}" title="${a.desc}" aria-label="${a.name}">
                <div aria-hidden="true">${a.icon}</div>
                <div class="ach-name">${a.name}</div>
            </div>
        `;
    }).join('');
}
window.renderSettingsAchievements = renderSettingsAchievements;
