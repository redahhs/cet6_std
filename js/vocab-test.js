/* ===== Vocab Test — 自适应词汇量测试 ===== */

// 难度分层：按词频/出现位置推断难易度（mock：基于单词长度 + 是否含特殊词缀）
function classifyDifficulty(word) {
    if (!word) return 1;
    let score = 1;
    if (word.length >= 9) score += 2;
    else if (word.length >= 7) score += 1;
    if (/ation$|ment$|ous$|ive$|ible$|able$/.test(word)) score += 1;
    if (/^(pre|inter|trans|sub|anti|dis)/.test(word)) score += 1;
    return Math.min(5, Math.max(1, score));
}

// 自适应测试状态
let testState = {
    active: false,
    questions: [],
    current: 0,
    answers: [],
    ability: 0,         // 0-1 估计能力
    difficulty: 3,      // 当前题目难度
    correctStreak: 0,
    wrongStreak: 0
};

function startVocabTest() {
    if (allWords.length < 8) {
        showToast('Word list too short', 'error');
        return;
    }
    testState = {
        active: true, questions: [], current: 0, answers: [],
        ability: 0, difficulty: 3, correctStreak: 0, wrongStreak: 0
    };
    nextTestQuestion();
    renderVocabTest();
    openVocabTestModal();
}

function nextTestQuestion() {
    if (testState.questions.length >= 20) return finishVocabTest();
    // 抽取目标词（按当前难度）
    const candidates = allWords.filter(w => classifyDifficulty(w.word) === testState.difficulty);
    if (candidates.length < 4) {
        testState.difficulty = Math.max(1, testState.difficulty - 1);
        return nextTestQuestion();
    }
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    // 3 个干扰项（其他难度的词）
    const distractors = [];
    const others = allWords.filter(w => w.word !== target.word);
    while (distractors.length < 3 && others.length > 0) {
        const idx = Math.floor(Math.random() * others.length);
        distractors.push(others.splice(idx, 1)[0]);
    }
    const options = [target, ...distractors].sort(() => Math.random() - 0.5);
    testState.questions.push({ target, options, answer: options.findIndex(o => o.word === target.word) });
}

function renderVocabTest() {
    const container = document.getElementById('vocabTestContent');
    if (!container) return;
    const q = testState.questions[testState.current];
    if (!q) return;

    container.innerHTML = `
        <div class="vocab-test-progress">${testState.current + 1} / 20 · Level ${testState.difficulty}</div>
        <div class="vocab-test-word">${escapeHtml(q.target.word)}</div>
        <div class="vocab-test-prompt">What does this word mean?</div>
        <div class="vocab-test-options">
            ${q.options.map((opt, i) => `
                <button class="vocab-test-option" data-idx="${i}" onclick="answerVocabTest(${i})">
                    <span class="opt-letter">${'ABCD'[i]}</span>
                    <span class="opt-meaning">${escapeHtml(opt.meaning.split('；')[0])}</span>
                </button>
            `).join('')}
        </div>
    `;
}

function answerVocabTest(choiceIdx) {
    const q = testState.questions[testState.current];
    const correct = choiceIdx === q.answer;

    testState.answers.push({ q: testState.current, correct, difficulty: testState.difficulty });

    // 自适应调整：3 连续对升难度，2 连续错降难度
    if (correct) {
        testState.correctStreak += 1;
        testState.wrongStreak = 0;
        if (testState.correctStreak >= 3 && testState.difficulty < 5) {
            testState.difficulty += 1;
            testState.correctStreak = 0;
        }
    } else {
        testState.wrongStreak += 1;
        testState.correctStreak = 0;
        if (testState.wrongStreak >= 2 && testState.difficulty > 1) {
            testState.difficulty -= 1;
            testState.wrongStreak = 0;
        }
    }

    // UI 反馈
    const opts = document.querySelectorAll('.vocab-test-option');
    opts.forEach((btn, i) => {
        btn.disabled = true;
        if (i === q.answer) btn.classList.add('correct');
        else if (i === choiceIdx) btn.classList.add('wrong');
    });

    setTimeout(() => {
        testState.current += 1;
        if (testState.current >= 20) {
            finishVocabTest();
        } else {
            nextTestQuestion();
            renderVocabTest();
        }
    }, 900);
}

function finishVocabTest() {
    testState.active = false;
    const correctCount = testState.answers.filter(a => a.correct).length;
    const accuracy = correctCount / testState.answers.length;

    // 词汇量估算：
    // 基础 = 5500（CET-6 词库量） * 难度加权
    // 难度 5 答对 = 3500-5500 词
    // 难度 4 = 2500-4500
    // 难度 3 = 1500-3000
    // 难度 2 = 800-2000
    // 难度 1 = 500-1200
    const maxDifficultyReached = Math.max(...testState.answers.map(a => a.difficulty));
    let baseEstimate = 0;
    if (maxDifficultyReached === 5) baseEstimate = 5000;
    else if (maxDifficultyReached === 4) baseEstimate = 3500;
    else if (maxDifficultyReached === 3) baseEstimate = 2200;
    else if (maxDifficultyReached === 2) baseEstimate = 1200;
    else baseEstimate = 600;

    const adjustment = (accuracy - 0.5) * 1500;
    const estimate = Math.max(0, Math.round(baseEstimate + adjustment));
    const range = `~${Math.max(0, estimate - 300)} - ${estimate + 500}`;

    // 等级判定
    let level = 'Beginner';
    if (estimate >= 4500) level = 'CET-6 Master';
    else if (estimate >= 3500) level = 'Advanced';
    else if (estimate >= 2500) level = 'Upper-Intermediate';
    else if (estimate >= 1500) level = 'Intermediate';
    else if (estimate >= 800) level = 'Elementary';

    const container = document.getElementById('vocabTestContent');
    if (container) {
        container.innerHTML = `
            <div class="vocab-test-result">
                <div class="vocab-test-emoji">🎓</div>
                <h2>Your Vocabulary Size</h2>
                <div class="vocab-test-number">${estimate}</div>
                <div class="vocab-test-range">Range: ${range} words</div>
                <div class="vocab-test-level">${level}</div>
                <div class="vocab-test-stats">
                    <div><b>${correctCount}</b>/${testState.answers.length} correct</div>
                    <div>Accuracy: <b>${Math.round(accuracy * 100)}%</b></div>
                </div>
                <div class="vocab-test-bars">
                    ${[1,2,3,4,5].map(d => {
                        const ans = testState.answers.filter(a => a.difficulty === d);
                        const acc = ans.length ? Math.round(ans.filter(a => a.correct).length / ans.length * 100) : 0;
                        return `<div class="vocab-test-bar">
                            <span class="bar-label">Level ${d}</span>
                            <div class="bar-track"><div class="bar-fill" style="width:${acc}%"></div></div>
                            <span class="bar-num">${acc}%</span>
                        </div>`;
                    }).join('')}
                </div>
                <button class="cta-btn" style="margin-top:24px" onclick="closeVocabTestModal()">Done</button>
            </div>
        `;
    }
    // 保存结果
    state.vocabTestResult = { estimate, range, level, accuracy, date: Date.now() };
    saveState();
}

function openVocabTestModal() {
    const modal = document.getElementById('vocabTestModal');
    if (modal) modal.classList.add('active');
}

function closeVocabTestModal() {
    const modal = document.getElementById('vocabTestModal');
    if (modal) modal.classList.remove('active');
    testState.active = false;
}
