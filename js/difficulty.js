/* ===== Reading Difficulty — Flesch-Kincaid + CET-6 覆盖率 ===== */

const COMPLEX_PATTERNS = [
    /\b(which|where|whereas|although|nevertheless|furthermore|moreover|consequently|therefore|however|meanwhile)\b/gi,
    /\b(ing)\b/gi,
    /\b(ation|tion|sion|ment|ous|ive|ible|able|ity|ness)\b/gi,
    /\b(sub|inter|trans|pre|post|anti|dis|un|in|im|non)\w+/gi
];

// 统计音节（启发式：元音组数）
function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return 0;
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
}

// 评估文章难度
function assessDifficulty(text) {
    // 句子数（按 .!? 切分）
    const sentences = (text.match(/[.!?]+/g) || []).length || 1;
    // 单词数
    const words = (text.match(/[a-zA-Z]+/g) || []);
    const wordCount = words.length;
    if (wordCount === 0) return defaultResult();

    // 平均句长
    const avgSentenceLen = wordCount / sentences;

    // CET-6 词占比
    const cet6Count = words.filter(w => cet6WordSet.has(w.toLowerCase())).length;
    const cet6Ratio = cet6Count / wordCount;

    // 复杂结构数
    let complexCount = 0;
    COMPLEX_PATTERNS.forEach(p => {
        const matches = text.match(p) || [];
        complexCount += matches.length;
    });
    const complexDensity = complexCount / sentences;

    // 总音节数
    const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

    // Flesch-Kincaid Grade Level
    // 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
    const fkGrade = 0.39 * avgSentenceLen + 11.8 * (totalSyllables / wordCount) - 15.59;

    // Flesch Reading Ease（100 = 极易，0 = 极难）
    const fkEase = 206.835 - 1.015 * avgSentenceLen - 84.6 * (totalSyllables / wordCount);

    // 综合分数 1-5
    let score = 1;
    if (fkGrade >= 6) score = 2;
    if (fkGrade >= 9) score = 3;
    if (fkGrade >= 12) score = 4;
    if (fkGrade >= 15) score = 5;
    if (avgSentenceLen > 20) score = Math.min(5, score + 1);
    if (cet6Ratio > 0.15) score = Math.min(5, score + 1);

    return {
        score,
        fkGrade: Math.max(0, fkGrade).toFixed(1),
        fkEase: Math.max(0, Math.min(100, fkEase)).toFixed(0),
        wordCount,
        sentenceCount: sentences,
        avgSentenceLen: avgSentenceLen.toFixed(1),
        cet6Count,
        cet6Ratio: (cet6Ratio * 100).toFixed(1),
        complexDensity: complexDensity.toFixed(1),
        totalSyllables,
        estimatedMinutes: Math.max(1, Math.round(wordCount / 200))
    };
}

function defaultResult() {
    return { score: 1, fkGrade: '0', fkEase: '0', wordCount: 0, sentenceCount: 0, avgSentenceLen: '0', cet6Count: 0, cet6Ratio: '0', complexDensity: '0', totalSyllables: 0, estimatedMinutes: 0 };
}

function difficultyLabel(score) {
    return ['', 'Easy', 'Moderate', 'Standard', 'Hard', 'Expert'][score] || 'Unknown';
}

function difficultyStars(score) {
    return '★'.repeat(score) + '☆'.repeat(5 - score);
}

function renderDifficultyBadge(metrics) {
    return `<div class="difficulty-badge">
        <div class="difficulty-stars">${difficultyStars(metrics.score)}</div>
        <div class="difficulty-info">
            <span class="difficulty-label">${difficultyLabel(metrics.score)}</span>
            <span class="difficulty-meta">FK ${metrics.fkGrade} · ${metrics.wordCount} words · ~${metrics.estimatedMinutes} min</span>
        </div>
    </div>`;
}
