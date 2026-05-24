let articles = [];
let currentArticle = null;
let localDict = {};

document.addEventListener('DOMContentLoaded', async () => {
  await loadDict();
  await loadArticles();
  setupPopover();
});

async function loadDict() {
  try {
    const res = await fetch('/data/words.json');
    const words = await res.json();
    words.forEach(w => localDict[w.word.toLowerCase()] = w);
  } catch (e) { console.error("Dict load failed", e); }
}

async function loadArticles() {
  try {
    const res = await fetch('/data/reading.json');
    articles = await res.json();
    renderList();
    // Auto open first article for demo
    if (articles.length > 0) openArticle(articles[0].id);
  } catch (e) { console.error("Articles load failed", e); }
}

function renderList() {
  const listEl = document.getElementById('article-list');
  listEl.innerHTML = articles.map(a => `
    <div class="glass-card p-5 cursor-pointer active:scale-[0.98] transition-transform" onclick="openArticle('${a.id}')">
      <h3 class="font-serif-elegant text-xl font-bold mb-2">${a.title}</h3>
      <p class="text-sm text-[var(--text-secondary)] line-clamp-2">${a.content.substring(0, 100)}...</p>
    </div>
  `).join('');
}

function openArticle(id) {
  currentArticle = articles.find(a => a.id === id);
  if (!currentArticle) return;

  document.getElementById('list-view').classList.add('hidden');
  document.getElementById('article-view').classList.remove('hidden');
  
  document.getElementById('article-title').textContent = currentArticle.title;
  document.getElementById('article-author').textContent = currentArticle.author;
  document.getElementById('article-date').textContent = currentArticle.date;
  
  // Process text to make words clickable
  const processedContent = processText(currentArticle.content);
  document.getElementById('article-content').innerHTML = `<p>${processedContent}</p>`;
  
  // Scroll to top
  window.scrollTo(0, 0);
}

function processText(text) {
  // Wrap English words in spans, ignore punctuation
  return text.replace(/\b([a-zA-Z]+)\b/g, '<span class="tap-word" data-word="$1">$1</span>');
}

function setupPopover() {
  const popover = document.getElementById('word-popover');
  const contentEl = document.getElementById('article-content');

  contentEl.addEventListener('click', (e) => {
    const target = e.target.closest('.tap-word');
    if (!target) {
      hidePopover();
      return;
    }

    const word = target.dataset.word.toLowerCase();
    const dictEntry = localDict[word];

    // Highlight word
    document.querySelectorAll('.tap-word.highlighted').forEach(el => el.classList.remove('highlighted'));
    target.classList.add('highlighted');

    // Populate popover
    document.getElementById('pop-word').textContent = dictEntry ? dictEntry.word : word;
    document.getElementById('pop-phonetic').textContent = dictEntry ? dictEntry.phonetic : '';
    document.getElementById('pop-meaning').textContent = dictEntry ? dictEntry.meaning : 'No definition found in local dictionary.';
    
    // Audio button
    document.getElementById('pop-audio').onclick = () => playAudio(dictEntry ? dictEntry.word : word);
    
    // Save button
    const saveBtn = document.getElementById('pop-save');
    if (dictEntry) {
      saveBtn.classList.remove('hidden');
      const isSaved = Store.isWordSaved(dictEntry.id);
      saveBtn.textContent = isSaved ? 'Saved ✓' : 'Save to Notebook';
      saveBtn.onclick = () => {
        if (!Store.isWordSaved(dictEntry.id)) {
          Store.saveWord(dictEntry.id);
          saveBtn.textContent = 'Saved ✓';
        }
      };
    } else {
      saveBtn.classList.add('hidden');
    }

    // Position popover
    const rect = target.getBoundingClientRect();
    const popWidth = 280;
    let left = rect.left + (rect.width / 2) - (popWidth / 2);
    let top = rect.top - popover.offsetHeight - 15;

    // Boundary checks
    if (left < 16) left = 16;
    if (left + popWidth > window.innerWidth - 16) left = window.innerWidth - popWidth - 16;
    if (top < 16) top = rect.bottom + 15; // Show below if no space above

    popover.style.left = `${left}px`;
    popover.style.top = `${top + window.scrollY}px`;
    
    requestAnimationFrame(() => popover.classList.add('active'));
  });

  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tap-word') && !e.target.closest('.word-popover')) {
      hidePopover();
    }
  });
}

function hidePopover() {
  document.getElementById('word-popover').classList.remove('active');
  document.querySelectorAll('.tap-word.highlighted').forEach(el => el.classList.remove('highlighted'));
}