/* ===== Dictionary — 本地+API 混合查词 ===== */

const DICT_CACHE_KEY = 'cet6_dict_cache';
const dictCache = (() => {
    try { return JSON.parse(localStorage.getItem(DICT_CACHE_KEY) || '{}'); }
    catch(e) { return {}; }
})();

function saveDictCache() {
    try { localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(dictCache)); }
    catch(e) {}
}

// 查词：先本地，再 API
async function lookupWord(word) {
    const lower = word.toLowerCase();
    // 1. 本地缓存
    if (dictCache[lower]) return dictCache[lower];

    // 2. CET-6 词库
    const cet6Entry = wordMapCache && wordMapCache[lower];
    if (cet6Entry) {
        const result = {
            word: cet6Entry.word,
            phonetic: cet6Entry.pos || '',
            meaning: cet6Entry.meaning,
            source: 'cet6',
            phrases: cet6Entry.phrases || []
        };
        dictCache[lower] = result;
        saveDictCache();
        return result;
    }

    // 3. Free Dictionary API
    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lower)}`);
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        const entry = data[0];
        const result = {
            word: entry.word,
            phonetic: entry.phonetic || (entry.phonetics?.find(p => p.text)?.text) || '',
            meanings: (entry.meanings || []).map(m => ({
                pos: m.partOfSpeech,
                defs: (m.definitions || []).slice(0, 2).map(d => d.definition),
                example: (m.definitions?.[0]?.example) || ''
            })),
            source: 'api'
        };
        dictCache[lower] = result;
        saveDictCache();
        return result;
    } catch(e) {
        return { word, source: 'none', meaning: 'Definition not found' };
    }
}

// 显示单词详情底部 sheet
async function showWordDetail(word) {
    const sheet = document.getElementById('wordSheet');
    const content = document.getElementById('wordSheetContent');
    if (!sheet || !content) return;

    content.innerHTML = '<div style="text-align:center;padding:32px"><div class="loading-spinner"></div><p style="margin-top:12px;color:var(--text-2)">Looking up...</p></div>';
    sheet.classList.add('open');
    document.getElementById('wordSheetBackdrop')?.classList.add('active', 'opacity-100');

    const info = await lookupWord(word);

    let html = `<div class="word-sheet-header">
        <div class="word-sheet-word">${escapeHtml(info.word)}</div>
        ${info.phonetic ? `<div class="word-sheet-phonetic">${escapeHtml(info.phonetic)}</div>` : ''}
    </div>`;

    if (info.source === 'cet6') {
        html += `<div class="word-sheet-meaning">${escapeHtml(info.meaning)}</div>`;
        if (info.phrases && info.phrases.length) {
            html += `<div class="word-sheet-section-title">Examples</div>`;
            html += '<ul class="word-sheet-phrases">' + info.phrases.slice(0, 3).map(p =>
                `<li><b>${escapeHtml(p.phrase)}</b> — ${escapeHtml(p.translation || '')}</li>`
            ).join('') + '</ul>';
        }
    } else if (info.meanings) {
        info.meanings.forEach(m => {
            html += `<div class="word-sheet-pos">${escapeHtml(m.pos)}</div>`;
            m.defs.forEach(d => {
                html += `<div class="word-sheet-def">${escapeHtml(d)}</div>`;
            });
            if (m.example) {
                html += `<div class="word-sheet-example">"${escapeHtml(m.example)}"</div>`;
            }
        });
    } else {
        html += `<div class="word-sheet-def">${escapeHtml(info.meaning || 'No definition')}</div>`;
    }

    html += `<div class="word-sheet-actions">
        <button class="action-btn" onclick="speak('${escapeHtml(word)}')">🔊 Listen</button>
        <button class="action-btn" onclick="toggleNotebook('${escapeHtml(word)}'); showToast('Saved!', 'success')">⭐ Save</button>
    </div>`;

    content.innerHTML = html;
}

window.closeWordSheet = function() {
    const sheet = document.getElementById('wordSheet');
    const backdrop = document.getElementById('wordSheetBackdrop');
    if (sheet) sheet.classList.remove('open');
    if (backdrop) {
        backdrop.classList.remove('opacity-100');
        setTimeout(() => backdrop.classList.add('hidden'), 300);
    }
};
