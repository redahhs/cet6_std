let quotes = [];
let currentQuote = null;
let isSaved = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadQuotes();
  setupDailyQuote();
  setupBackgroundInteraction();
});

async function loadQuotes() {
  try {
    const res = await fetch('./data/quotes.json');
    quotes = await res.json();
  } catch (e) {
    console.error("Failed to load quotes", e);
  }
}

function setupDailyQuote() {
  // 基于日期的伪随机，保证同一天看到同一句
  const today = new Date().toISOString().split('T')[0];
  const seed = today.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const index = seed % quotes.length;
  
  currentQuote = quotes[index];
  renderQuote(currentQuote);
  checkSavedStatus();
}

function renderQuote(q) {
  const bg = document.getElementById('quoteBg');
  bg.style.backgroundImage = `url(${q.bg})`;
  
  document.getElementById('quoteEn').textContent = `"${q.en}"`;
  document.getElementById('quoteZh').textContent = q.zh;
  document.getElementById('quoteAuthor').textContent = `— ${q.author}`;
  
  // 触发 Ken Burns 缓慢放大动效
  bg.classList.remove('zoomed');
  setTimeout(() => bg.classList.add('zoomed'), 100);
}

function setupBackgroundInteraction() {
  const content = document.getElementById('quote-content');
  content.addEventListener('click', (e) => {
    // 如果点击的是按钮，不触发背景交互
    if (e.target.closest('.action-btn') || e.target.closest('.action-icon')) return;
    
    const bg = document.getElementById('quoteBg');
    bg.classList.toggle('zoomed');
  });
}

function nextQuote() {
  let newIndex = Math.floor(Math.random() * quotes.length);
  while (newIndex === quotes.indexOf(currentQuote) && quotes.length > 1) {
    newIndex = Math.floor(Math.random() * quotes.length);
  }
  currentQuote = quotes[newIndex];
  renderQuote(currentQuote);
  checkSavedStatus();
}

function checkSavedStatus() {
  isSaved = Store.isQuoteSaved ? Store.isQuoteSaved(currentQuote.id) : false;
  updateSaveUI();
}

function toggleSave() {
  if (!currentQuote) return;
  if (isSaved) {
    Store.unsaveQuote ? Store.unsaveQuote(currentQuote.id) : null;
    isSaved = false;
  } else {
    Store.saveQuote ? Store.saveQuote(currentQuote.id) : null;
    isSaved = true;
  }
  updateSaveUI();
  if (window.Haptics) Haptics.light();
}

function updateSaveUI() {
  const btn = document.getElementById('btnSave');
  const text = document.getElementById('saveText');
  if (isSaved) {
    btn.classList.add('saved');
    text.textContent = 'Saved';
  } else {
    btn.classList.remove('saved');
    text.textContent = 'Save';
  }
}

function playQuote() {
  if (currentQuote && window.playAudio) {
    playAudio(currentQuote.en);
  }
}