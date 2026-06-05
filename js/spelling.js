/* ===== Spelling Mode — 拼写测试 ===== */

let spellingState = {
    currentWord: null,
    score: 0,
    total: 0,
    attempts: 0,
    active: false
};

function startSpellingMode() {
    if (displayWords.length === 0) {
        showToast('No words available', 'error');
        return;
    }
    spellingState.score = 0;
    spellingState.total = 0;
    spellingState.active = true;
    nextSpellingRound();
}

function nextSpellingRound() {
    if (!spellingState.active) return; // 切页后失效
    if (spellingState.total >= 10) {
        finishSpellingMode();
        return;
    }
    spellingState.currentWord = displayWords[Math.floor(Math.random() * displayWords.length)];
    spellingState.total += 1;
    spellingState.attempts = 0;
    renderSpellingCard();
}

function renderSpellingCard() {
    const container = document.getElementById('cardContainer');
    if (!container) return;

    const w = spellingState.currentWord;
    const hint = w.word[0] + '_'.repeat(Math.max(w.word.length - 2, 0)) + (w.word.length > 1 ? w.word[w.word.length - 1] : '');

    container.innerHTML = `
        <div class="spelling-mode">
            <div class="spelling-progress">${spellingState.score} / ${spellingState.total}</div>
            <div class="spelling-meaning">${escapeHtml(w.meaning)}</div>
            <div class="spelling-hint">${escapeHtml(hint)}</div>
            <input type="text" class="spelling-input" id="spellingInput" placeholder="Type the word..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            <button class="spelling-submit" onclick="checkSpelling()">Check</button>
            <button class="spelling-skip" onclick="skipSpelling()">Skip →</button>
        </div>
    `;

    const input = document.getElementById('spellingInput');
    if (input) {
        input.focus();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') checkSpelling();
        });
    }
}

function checkSpelling() {
    const input = document.getElementById('spellingInput');
    if (!input) return;
    const answer = input.value.trim().toLowerCase();
    const target = spellingState.currentWord.word.toLowerCase();
    const correct = answer === target;

    if (correct) {
        spellingState.score += 1;
        onCorrect(spellingState.currentWord.word);
        showToast('✓ Correct!', 'success', 1200);
        setTimeout(() => nextSpellingRound(), 1000);
    } else {
        spellingState.attempts += 1;
        onWrong(spellingState.currentWord.word);
        if (spellingState.attempts >= 2) {
            showToast(`Correct: ${spellingState.currentWord.word}`, 'error', 2000);
            setTimeout(() => nextSpellingRound(), 2200);
        } else {
            showToast('Try again', 'error', 1500);
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
        }
    }
}

function skipSpelling() {
    onWrong(spellingState.currentWord.word);
    showToast(`Skipped: ${spellingState.currentWord.word}`, 'info', 1500);
    setTimeout(() => nextSpellingRound(), 1600);
}

function finishSpellingMode() {
    spellingState.active = false;
    const container = document.getElementById('cardContainer');
    if (container) {
        container.innerHTML = `<div style="text-align:center;padding:40px">
            <h3>Spelling Test Complete!</h3>
            <p style="font-size:1.1rem;margin-top:12px;color:var(--accent);font-weight:700">${spellingState.score} / ${spellingState.total}</p>
            <button class="cta-btn" style="margin-top:24px" onclick="startSpellingMode()">Try Again</button>
            <button class="action-btn" style="margin-top:12px" onclick="exitSpellingMode()">Exit</button>
        </div>`;
    }
    if (typeof showToast === 'function') showToast(`Spelling: ${spellingState.score}/${spellingState.total}`, 'info');
    state.reviewCount = (state.reviewCount || 0) + spellingState.total;
    saveState();
    if (typeof checkAchievements === 'function') checkAchievements();
}

function exitSpellingMode() {
    spellingState.active = false;
    renderCard();
}

/* 切页时清理 - input + setTimeout 全部释放 */
function teardownSpellingMode() {
    spellingState.active = false;
    spellingState.currentWord = null;
    // input 在 DOM 销毁时自动释放,无需手动 removeEventListener
    // 但需要让所有 setTimeout 失效 — 用 active 标记位
}
window.teardownSpellingMode = teardownSpellingMode;
