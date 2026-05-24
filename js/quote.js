/**
 * Daily Quote Engine
 * Handles immersive background, typography, and interactions
 */

let currentQuote = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadQuote();
});

async function loadQuote() {
  try {
    // Check cache first for daily consistency
    const cached = Store.get(DB_KEYS.DAILY_QUOTE);
    const today = new Date().toISOString().split('T')[0];
    
    if (cached && cached.date === today) {
      currentQuote = cached.data;
    } else {
      const res = await fetch('./data/quotes.json');
      const quotes = await res.json();
      // Pick a random quote for the day
      currentQuote = quotes[Math.floor(Math.random() * quotes.length)];
      Store.set(DB_KEYS.DAILY_QUOTE, { date: today, data: currentQuote });
    }
    
    renderQuote();
  } catch (e) {
    console.error("Failed to load quote", e);
  }
}

function renderQuote() {
  if (!currentQuote) return;

  // Set Background
  const bgEl = document.getElementById('bg-image');
  bgEl.style.backgroundImage = `url('${currentQuote.bg}')`;
  
  // Preload image for smooth transition
  const img = new Image();
  img.src = currentQuote.bg;
  img.onload = () => {
    bgEl.classList.remove('scale-105');
    bgEl.classList.add('scale-100');
  };

  // Set Text
  document.getElementById('quote-en').textContent = `"${currentQuote.en}"`;
  document.getElementById('quote-zh').textContent = currentQuote.zh;
  document.getElementById('quote-author').textContent = `— ${currentQuote.author}`;

  // Update Save Button State
  updateSaveButton();
}

function playQuote() {
  if (currentQuote) {
    playAudio(currentQuote.en);
  }
}

function toggleSaveQuote() {
  if (!currentQuote) return;
  
  const savedQuotes = Store.get('cet6_saved_quotes') || [];
  const index = savedQuotes.findIndex(q => q.id === currentQuote.id);
  
  if (index > -1) {
    savedQuotes.splice(index, 1);
  } else {
    savedQuotes.push(currentQuote);
  }
  
  Store.set('cet6_saved_quotes', savedQuotes);
  updateSaveButton();
  
  // Haptic feedback simulation (visual)
  const btn = document.getElementById('btn-save-quote');
  btn.classList.add('scale-110');
  setTimeout(() => btn.classList.remove('scale-110'), 200);
}

function updateSaveButton() {
  const savedQuotes = Store.get('cet6_saved_quotes') || [];
  const isSaved = savedQuotes.some(q => q.id === currentQuote.id);
  const icon = document.getElementById('icon-heart');
  
  if (isSaved) {
    icon.setAttribute('fill', 'currentColor');
    icon.classList.add('text-red-500');
  } else {
    icon.setAttribute('fill', 'none');
    icon.classList.remove('text-red-500');
  }
}

function shareQuote() {
  if (navigator.share && currentQuote) {
    navigator.share({
      title: 'Daily Inspiration',
      text: `${currentQuote.en}\n\n${currentQuote.zh}\n\n— ${currentQuote.author}`,
    }).catch(console.error);
  } else {
    // Fallback: Copy to clipboard
    const text = `${currentQuote.en}\n${currentQuote.zh}`;
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard');
    });
  }
}