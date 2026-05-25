let dictMap = new Map();
let currentWord = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadDict();
  await loadArticle();
  setupPopover();
});

async function loadDict() {
  try {
    const res = await fetch('./data/words.json');
    const words = await res.json();
    words.forEach(w => dictMap.set(w.word.toLowerCase(), w));
  } catch (e) { console.error("Dict load failed", e); }
}

async function loadArticle() {
  try {
    const res = await fetch('./data/reading.json');
    const articles = await res.json();
    const article = articles[0]; // Load first article
    
    document.getElementById('article-title').textContent = article.title;
    document.getElementById('article-meta').textContent = `${article.author} · ${article.date}`;
    
    // Wrap words in spans
    const content = article.content.replace(/\b([a-zA-Z]+)\b/g, '<span class="tap-word" data-word="$1">$1</span>');
    document.getElementById('article-content').innerHTML = content;
  } catch (e) { console.error("Article load failed", e); }
}

function setupPopover() {
  const popover = document.getElementById('word-popover');
  const contentEl = document.getElementById('article-content');

  contentEl.addEventListener('click', (e) => {
    const target = e.target.closest('.tap-word');
    if (!target) { hidePopover(); return; }

    const wordStr = target.dataset.word.toLowerCase();
    const dictEntry = dictMap.get(wordStr);
    currentWord = dictEntry || { word: target.dataset.word, translations: [{ translation: 'No definition found' }] };

    // Highlight
    document.querySelectorAll('.tap-word.highlighted').forEach(el => el.classList.remove('highlighted'));
    target.classList.add('highlighted');

    // Populate
    document.getElementById('pop-word').textContent = currentWord.word;
    document.getElementById('pop-phonetic').textContent = ''; // Phonetic not in current JSON
    document.getElementById('pop-meaning').textContent = currentWord.translations.map(t => t.translation).join('；');
    
    document.getElementById('pop-audio').onclick = (ev) => { ev.stopPropagation(); playAudio(currentWord.word); };
    
    const saveBtn = document.getElementById('pop-save');
    const isSaved = Store.isWordSaved(currentWord.word);
    saveBtn.textContent = isSaved ? 'Saved ✓' : 'Save to Notebook';
    saveBtn.onclick = (ev) => {
      ev.stopPropagation();
      if (!Store.isWordSaved(currentWord.word)) {
        Store.saveWord(currentWord.word);
        saveBtn.textContent = 'Saved ✓';
        if (window.Haptics) Haptics.success();
      }
    };

    // Position
    const rect = target.getBoundingClientRect();
    const popWidth = 280;
    let left = rect.left + (rect.width / 2) - (popWidth / 2);
    let top = rect.top - popover.offsetHeight - 15 + window.scrollY;

    if (left < 16) left = 16;
    if (left + popWidth > window.innerWidth - 16) left = window.innerWidth - popWidth - 16;
    if (top < 16) top = rect.bottom + 15 + window.scrollY;

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    
    requestAnimationFrame(() => popover.classList.add('active'));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tap-word') && !e.target.closest('.word-popover')) hidePopover();
  });
}

function hidePopover() {
  document.getElementById('word-popover').classList.remove('active');
  document.querySelectorAll('.tap-word.highlighted').forEach(el => el.classList.remove('highlighted'));
}