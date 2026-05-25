/**
 * Home Dashboard Logic
 * 动态计算数据，渲染高级感 Widget
 */

document.addEventListener('DOMContentLoaded', async () => {
  setGreeting();
  updateStats();
  await renderDailyWord();
});

function setGreeting() {
  const now = new Date();
  const hours = now.getHours();
  let greeting = "Good Evening";
  if (hours < 12) greeting = "Good Morning";
  else if (hours < 18) greeting = "Good Afternoon";
  
  document.getElementById('greeting-text').textContent = greeting;
  
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('greeting-date').textContent = now.toLocaleDateString('en-US', options);
}

function updateStats() {
  const progress = Store.get(DB_KEYS.VOCAB_PROGRESS) || {};
  const values = Object.values(progress);
  
  const mastered = values.filter(v => v.mastery === 3).length;
  const fuzzy = values.filter(v => v.mastery === 1).length;
  
  // 计算连续打卡天数 (简单模拟算法)
  let streak = 0;
  const today = new Date().setHours(0,0,0,0);
  let checkDate = today;
  
  // 如果今天还没学，从昨天开始算
  const todayHasRecord = values.some(v => new Date(v.lastReview).setHours(0,0,0,0) === today);
  if (!todayHasRecord) {
    checkDate -= 86400000; 
  }

  while(true) {
    const hasRecord = values.some(v => new Date(v.lastReview).setHours(0,0,0,0) === checkDate);
    if (hasRecord) {
      streak++;
      checkDate -= 86400000;
    } else {
      break;
    }
  }

  document.getElementById('stat-streak').textContent = streak;
  document.getElementById('stat-mastered').textContent = mastered;
  document.getElementById('stat-fuzzy').textContent = fuzzy;
}

async function renderDailyWord() {
  try {
    const res = await fetch('./data/words.json');
    const rawData = await res.json();
    
    // 每天基于日期生成一个固定的随机种子，保证同一天刷新看到的是同一个词
    const today = new Date().toISOString().split('T')[0];
    const seed = today.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const word = rawData[seed % rawData.length];

    document.getElementById('preview-word').textContent = word.word;
    
    // 拼接释义
    const meaning = word.translations?.map(t => t.translation).join('；') || '';
    document.getElementById('preview-meaning').textContent = meaning;

    // 渲染短语搭配
    const phrasesContainer = document.getElementById('preview-phrases');
    phrasesContainer.innerHTML = '';
    if (word.phrases && word.phrases.length > 0) {
      // 最多展示3个
      word.phrases.slice(0, 3).forEach(p => {
        const tag = document.createElement('span');
        tag.className = 'px-2 py-1 rounded-md bg-white/5 text-xs text-[var(--text-secondary)]';
        tag.textContent = p.phrase;
        phrasesContainer.appendChild(tag);
      });
    }

  } catch (e) {
    console.error("Failed to load daily word", e);
  }
}