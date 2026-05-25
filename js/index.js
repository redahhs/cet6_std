document.addEventListener('DOMContentLoaded', async () => {
  setGreeting();
  updateStats();
  await renderDailyFocus();
});

function setGreeting() {
  const now = new Date();
  const hours = now.getHours();
  let greeting = "Good Evening";
  if (hours < 12) greeting = "Good Morning";
  else if (hours < 18) greeting = "Good Afternoon";
  
  document.getElementById('greeting-text').textContent = greeting;
  document.getElementById('date-text').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function updateStats() {
  const progress = Store.get(DB_KEYS.VOCAB_PROGRESS) || {};
  const values = Object.values(progress);
  
  const mastered = values.filter(v => v.mastery === 3).length;
  const fuzzy = values.filter(v => v.mastery === 1).length;
  
  // Mock streak for now
  document.getElementById('stat-streak').textContent = '12'; 
  document.getElementById('stat-mastered').textContent = mastered;
  document.getElementById('stat-fuzzy').textContent = fuzzy;
}

async function renderDailyFocus() {
  try {
    const res = await fetch('./data/words.json');
    const rawData = await res.json();
    
    // Pick a random word based on the day
    const today = new Date().toISOString().split('T')[0];
    const seed = today.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const word = rawData[seed % rawData.length];
    
    document.getElementById('focus-word').textContent = word.word;
    document.getElementById('focus-meaning').textContent = word.translations?.map(t => t.translation).join('；') || '';
  } catch (e) {
    console.error("Failed to load daily focus", e);
  }
}

// Global Audio Helper
window.playAudio = function(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
};