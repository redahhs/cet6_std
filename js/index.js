/**
 * Home Dashboard Logic
 * Aggregates stats and renders preview cards
 */

document.addEventListener('DOMContentLoaded', async () => {
  updateStats();
  renderDailyQuotePreview();
});

function updateStats() {
  // Calculate Streak (Mock logic for now: count consecutive days with progress)
  // In a real app, this would parse timestamps from VOCAB_PROGRESS
  const progress = Store.get(DB_KEYS.VOCAB_PROGRESS) || {};
  const masteredCount = Object.values(progress).filter(p => p.mastery === 3).length;
  
  // Update DOM
  document.querySelector('.grid div:nth-child(1) span.text-3xl').textContent = '12'; // Mock streak
  document.querySelector('.grid div:nth-child(2) span.text-3xl').textContent = masteredCount;
}

async function renderDailyQuotePreview() {
  try {
    const cached = Store.get(DB_KEYS.DAILY_QUOTE);
    const today = new Date().toISOString().split('T')[0];
    let quote;

    if (cached && cached.date === today) {
      quote = cached.data;
    } else {
      const res = await fetch('/data/quotes.json');
      const quotes = await res.json();
      quote = quotes[0]; // Default to first for preview
    }

    const previewText = document.querySelector('#app-container section p.text-xl');
    if (previewText && quote) {
      previewText.textContent = `"${quote.en.substring(0, 60)}..."`;
    }
  } catch (e) {
    console.warn("Quote preview failed", e);
  }
}