/**
 * Dashboard Engine
 * 渲染首页数据与每日一句
 */

document.addEventListener('DOMContentLoaded', () => {
  renderGreeting();
  renderStats();
  renderDailyQuote();
});

function renderGreeting() {
  const hours = new Date().getHours();
  let greeting = "Good Evening";
  if (hours < 12) greeting = "Good Morning";
  else if (hours < 18) greeting = "Good Afternoon";
  
  const greetingEl = document.getElementById('greeting-text');
  if(greetingEl) greetingEl.textContent = greeting;
  
  const date = new Date();
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  const dateEl = document.getElementById('date-text');
  if(dateEl) dateEl.textContent = date.toLocaleDateString('en-US', options);
}

function renderStats() {
  // 从 LocalStorage 读取学习进度
  const progress = window.Store ? Store.get(DB_KEYS.VOCAB_PROGRESS) : {};
  const values = Object.values(progress || {});
  
  const mastered = values.filter(v => v.mastery === 3).length;
  const fuzzy = values.filter(v => v.mastery === 1).length;
  
  // 计算连续打卡天数 (Streak)
  let streak = 0;
  const today = new Date().setHours(0,0,0,0);
  let checkDate = today;
  
  // 如果今天还没学，从昨天开始算
  const todayHasRecord = values.some(v => new Date(v.lastReview).setHours(0,0,0,0) === today);
  if (!todayHasRecord) checkDate -= 86400000;

  while(true) {
    const hasRecord = values.some(v => new Date(v.lastReview).setHours(0,0,0,0) === checkDate);
    if (hasRecord) {
      streak++;
      checkDate -= 86400000;
    } else {
      break;
    }
  }

  const streakEl = document.getElementById('stat-streak');
  const masteredEl = document.getElementById('stat-mastered');
  const fuzzyEl = document.getElementById('stat-fuzzy');

  if(streakEl) streakEl.textContent = streak;
  if(masteredEl) masteredEl.textContent = mastered;
  if(fuzzyEl) fuzzyEl.textContent = fuzzy;
}

async function renderDailyQuote() {
  try {
    // 尝试从 LocalStorage 获取每日一句缓存
    let quoteData = window.Store ? Store.get(DB_KEYS.DAILY_QUOTE) : null;
    const today = new Date().toISOString().split('T')[0];
    
    if (!quoteData || quoteData.date !== today) {
      // 如果没有缓存或不是今天的，尝试 fetch
      // 这里我们使用一个默认的 fallback，因为 GitHub Pages 可能没有配置 quotes.json
      quoteData = {
        date: today,
        data: {
          en: "The only way to do great work is to love what you do.",
          zh: "成就伟业的唯一途径，是热爱你所做的事。",
          author: "Steve Jobs"
        }
      };
      
      // 尝试 fetch (如果存在)
      try {
        const res = await fetch('./data/quotes.json');
        if(res.ok) {
          const quotes = await res.json();
          const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
          quoteData.data = randomQuote;
          if(window.Store) Store.set(DB_KEYS.DAILY_QUOTE, quoteData);
        }
      } catch (e) {
        console.warn("Quotes fetch failed, using fallback.");
      }
    }

    const enEl = document.getElementById('quote-en');
    const zhEl = document.getElementById('quote-zh');

    if(enEl) enEl.textContent = `"${quoteData.data.en}"`;
    if(zhEl) zhEl.textContent = `— ${quoteData.data.author || 'Steve Jobs'}`;

  } catch (e) {
    console.error("Quote render failed", e);
  }
}