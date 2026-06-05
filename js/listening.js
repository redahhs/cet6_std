/* ===== Listening Mode — 听音辨词 ===== */

let listeningState = {
    currentWord: null,
    options: [],
    score: 0,
    total: 0,
    active: false
};

function startListeningMode() {
    if (displayWords.length < 4) {
        showToast('Need at least 4 words to start', 'error');
        return;
    }
    listeningState.score = 0;
    listeningState.total = 0;
    listeningState.active = true;
    nextListeningRound();
}

function nextListeningRound() {
    if (!listeningState.active) return; // 切页后失效
    if (listeningState.total >= 10) {
        finishListeningMode();
        return;
    }
    // 随机选目标词
    const target = displayWords[Math.floor(Math.random() * displayWords.length)];
    // 选 3 个干扰项
    const distractors = [];
    while (distractors.length < 3) {
        const w = displayWords[Math.floor(Math.random() * displayWords.length)];
        if (w.word !== target.word && !distractors.find(d => d.word === w.word)) {
            distractors.push(w);
        }
    }
    // 打乱顺序
    listeningState.options = [target, ...distractors].sort(() => Math.random() - 0.5);
    listeningState.currentWord = target;
    listeningState.total += 1;

    renderListeningCard();
    // 自动播放发音
    setTimeout(() => speak(target.word), 300);
}

function renderListeningCard() {
    const container = document.getElementById('cardContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="listening-mode">
            <div class="listening-progress">${listeningState.score} / ${listeningState.total}</div>
            <button class="listening-speak" onclick="speak('${escapeHtml(listeningState.currentWord.word)}')">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
            </button>
            <p class="listening-hint">Tap to replay</p>
            <div class="listening-options">
                ${listeningState.options.map((opt, i) => `
                    <button class="listening-option" data-word="${escapeHtml(opt.word)}" onclick="checkListeningAnswer('${escapeHtml(opt.word)}')">
                        ${escapeHtml(opt.word)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function checkListeningAnswer(answer) {
    const correct = answer === listeningState.currentWord.word;
    const btns = document.querySelectorAll('.listening-option');
    btns.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.word === listeningState.currentWord.word) btn.classList.add('correct');
        else if (btn.dataset.word === answer) btn.classList.add('wrong');
    });

    if (correct) {
        listeningState.score += 1;
        onCorrect(listeningState.currentWord.word);
        showToast('✓ Correct!', 'success', 1200);
    } else {
        onWrong(listeningState.currentWord.word);
        showToast(`✗ Answer: ${listeningState.currentWord.word}`, 'error', 1800);
    }

    setTimeout(() => nextListeningRound(), 1500);
}

function finishListeningMode() {
    listeningState.active = false;
    const container = document.getElementById('cardContainer');
    if (container) {
        container.innerHTML = `<div style="text-align:center;padding:40px">
            <h3>Listening Test Complete!</h3>
            <p style="font-size:1.1rem;margin-top:12px;color:var(--accent);font-weight:700">${listeningState.score} / ${listeningState.total}</p>
            <button class="cta-btn" style="margin-top:24px" onclick="startListeningMode()">Try Again</button>
            <button class="action-btn" style="margin-top:12px" onclick="exitListeningMode()">Exit</button>
        </div>`;
    }
    if (typeof showToast === 'function') showToast(`Listening: ${listeningState.score}/${listeningState.total}`, 'info');
    state.reviewCount = (state.reviewCount || 0) + listeningState.total;
    saveState();
    if (typeof checkAchievements === 'function') checkAchievements();
}

function exitListeningMode() {
    listeningState.active = false;
    renderCard();
}

/* 切页时清理 - 防止 setTimeout 继续触发 */
function teardownListeningMode() {
    listeningState.active = false;
    listeningState.currentWord = null;
    // 取消 TTS
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}
window.teardownListeningMode = teardownListeningMode;
