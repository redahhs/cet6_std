document.addEventListener('DOMContentLoaded', () => {
  initSettings();
});

function initSettings() {
  const settings = Store.get(DB_KEYS.SETTINGS) || { ttsSpeed: 0.9 };
  const slider = document.getElementById('speed-slider');
  const valText = document.getElementById('speed-val');

  slider.value = settings.ttsSpeed;
  valText.textContent = `${settings.ttsSpeed}x`;

  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    valText.textContent = `${val}x`;
    settings.ttsSpeed = val;
    Store.set(DB_KEYS.SETTINGS, settings);
  });
}

function clearData() {
  if (confirm('Are you sure you want to clear all learning progress and saved items? This cannot be undone.')) {
    localStorage.clear();
    alert('All data cleared.');
    location.reload();
  }
}

function exportData() {
  const data = {
    progress: Store.get(DB_KEYS.VOCAB_PROGRESS),
    savedWords: Store.get(DB_KEYS.SAVED_WORDS),
    savedQuotes: Store.get('cet6_saved_quotes')
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cet6-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}