/**
 * Vocabulary Engine (Production-Grade Refactor)
 * 架构师注：采用 IIFE 模块模式，彻底杜绝全局变量污染与事件重复绑定。
 */
const VocabModule = (() => {
  let wordsData = [];
  let currentIndex = 0;
  let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false;
  let activeCard = null;
  let hasMoved = false; 
  
  // 防重复绑定控制器
  let abortController = null;
  const els = {}; // 缓存 DOM 元素，避免重复查询

  function init() {
    // 1. 缓存 DOM
    els.container = document.getElementById('vocab-card-container');
    els.emptyState = document.getElementById('vocab-empty-state');
    els.progressText = document.getElementById('vocab-progress-text');
    els.progressBar = document.getElementById('vocab-progress-bar');
    els.sheet = document.getElementById('vocab-detail-sheet');
    els.sheetContent = document.getElementById('vocab-sheet-content');
    els.backdrop = document.getElementById('vocab-sheet-backdrop');
    els.footer = document.querySelector('.vocab-footer');

    // 2. 重置状态 (Fix 1: 防止 bfcache 导致的状态残留)
    currentIndex = 0;
    if (els.container) els.container.innerHTML = '';

    // 3. 事件委托绑定 Footer (Fix 2: 防止重复绑定)
    if (els.footer && !els.footer.dataset.bound) {
      els.footer.addEventListener('click', handleFooterClick);
      els.footer.dataset.bound = 'true';
    }
    
    // Backdrop 点击关闭
    if (els.backdrop && !els.backdrop.dataset.bound) {
      els.backdrop.addEventListener('click', closeSheet);
      els.backdrop.dataset.bound = 'true';
    }

    // 4. 加载数据并渲染
    loadWords();

    // 5. 生命周期监听
    setupLifecycle();
  }

  function setupLifecycle() {
    // Fix 3: 页面隐藏时强制重置 Audio 状态
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    });

    // Fix 1: bfcache (往返缓存) 恢复时重新初始化
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) init();
    });
  }

  async function loadWords() {
    try {
      const res = await fetch('./data/words.json');
      wordsData = await res.json();
      renderCards();
    } catch (e) {
      console.error("Failed to load words", e);
    }
  }

  function renderCards() {
    els.container.innerHTML = ''; 
    
    if (currentIndex >= wordsData.length) {
      els.emptyState.classList.remove('hidden');
      updateProgress();
      return;
    } else {
      els.emptyState.classList.add('hidden');
    }

    const word = wordsData[currentIndex];
    const card = document.createElement('div');
    
    // Fix 8: 组件 class 命名隔离
    card.className = 'vocab-card glass-card absolute inset-0 flex flex-col items-center justify-center p-8 cursor-pointer animate-card-enter';
    card.style.zIndex = 'var(--z-card)';
    card.dataset.id = word.id;
    
    card.innerHTML = `
      <span class="text-xs font-semibold text-[#5e5ce6] tracking-widest uppercase mb-4">${word.pos}</span>
      <h2 class="text-5xl font-bold text-gradient font-serif-elegant mb-3 text-center">${word.word}</h2>
      <p class="text-lg text-gray-400 mb-8">${word.phonetic}</p>
      <button class="vocab-audio-btn w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/80 active:scale-90 transition-transform pulse-soft" data-word="${word.word}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
      </button>
      <p class="absolute bottom-8 text-xs text-gray-500">Swipe or tap for details</p>
    `;

    activeCard = card;
    
    // Fix 2: 使用 AbortController 彻底防止重复绑定
    if (abortController) abortController.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.vocab-audio-btn')) {
        e.stopPropagation();
        playAudio(word.word);
        return;
      }
      if (!hasMoved) openSheet(word);
    }, { signal });

    attachTouchEvents(card, signal);
    els.container.appendChild(card);
    updateProgress();
  }

  function updateProgress() {
    const total = wordsData.length;
    els.progressText.textContent = `${currentIndex} / ${total}`;
    const percent = total > 0 ? (currentIndex / total) * 100 : 0;
    els.progressBar.style.width = `${percent}%`;
  }

  function attachTouchEvents(card, signal) {
    card.addEventListener('touchstart', touchStart, { passive: true, signal });
    card.addEventListener('touchmove', touchMove, { passive: false, signal });
    card.addEventListener('touchend', touchEnd, { passive: true, signal });
    
    card.addEventListener('mousedown', touchStart, { signal });
    card.addEventListener('mousemove', touchMove, { signal });
    card.addEventListener('mouseup', touchEnd, { signal });
    card.addEventListener('mouseleave', touchEnd, { signal });
  }

  function getX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
  function getY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

  function touchStart(e) {
    isDragging = true;
    hasMoved = false; 
    startX = getX(e);
    startY = getY(e);
    activeCard.classList.add('swiping');
    activeCard.classList.remove('animate-card-enter'); 
  }

  function touchMove(e) {
    if (!isDragging) return;
    e.preventDefault(); 
    currentX = getX(e) - startX;
    currentY = getY(e) - startY;
    if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) hasMoved = true;
    
    // Fix 7: 仅使用 transform，防止掉帧
    const rotate = currentX * 0.05;
    activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
    updateOverlay();
  }

  function touchEnd() {
    if (!isDragging) return;
    isDragging = false;
    activeCard.classList.remove('swiping');
    const threshold = 100;
    
    if (currentX > threshold) flyOut('right'); 
    else if (currentX < -threshold) flyOut('left'); 
    else if (currentY < -threshold) flyOut('up'); 
    else {
      activeCard.style.transform = '';
      clearOverlays();
    }
    currentX = 0; currentY = 0;
  }

  function updateOverlay() {
    let leftOpacity = Math.max(0, -currentX / 100);
    let rightOpacity = Math.max(0, currentX / 100);
    let upOpacity = Math.max(0, -currentY / 100);
    activeCard.style.boxShadow = `
      inset 0 0 100px rgba(239, 68, 68, ${leftOpacity * 0.2}),
      inset 0 0 100px rgba(34, 197, 94, ${rightOpacity * 0.2}),
      inset 0 0 100px rgba(234, 179, 8, ${upOpacity * 0.2})
    `;
  }

  function clearOverlays() { if(activeCard) activeCard.style.boxShadow = ''; }

  function flyOut(direction) {
    const word = wordsData[currentIndex];
    let mastery = 0;
    if (direction === 'right') { activeCard.classList.add('fly-right'); mastery = 3; } 
    else if (direction === 'left') { activeCard.classList.add('fly-left'); mastery = 0; } 
    else if (direction === 'up') { activeCard.classList.add('fly-up'); mastery = 1; }

    const progress = Store.get(DB_KEYS.VOCAB_PROGRESS) || {};
    progress[word.id] = { mastery, lastReview: Date.now() };
    Store.set(DB_KEYS.VOCAB_PROGRESS, progress);
    if (window.Haptics) Haptics.medium();

    setTimeout(() => {
      currentIndex++;
      renderCards();
    }, 300);
  }

  function handleFooterClick(e) {
    const btn = e.target.closest('button');
    if (!btn || !activeCard) return;
    if (btn.id === 'vocab-btn-forgot') flyOut('left');
    else if (btn.id === 'vocab-btn-known') flyOut('right');
    else if (btn.id === 'vocab-btn-fuzzy') flyOut('up');
  }

  function openSheet(word) {
    const isSaved = Store.isWordSaved(word.id);
    els.sheetContent.innerHTML = `
      <div class="flex justify-between items-start mb-6">
        <div>
          <h3 class="text-3xl font-bold font-serif-elegant">${word.word}</h3>
          <p class="text-gray-400 mt-1">${word.phonetic} · ${word.pos}</p>
        </div>
        <button id="vocab-sheet-save-btn" data-id="${word.id}" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ${isSaved ? 'text-[#5e5ce6]' : 'text-white/40'}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        </button>
      </div>
      <div class="space-y-6">
        <div>
          <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Meaning</p>
          <p class="text-lg text-white">${word.meaning}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Example</p>
          <p class="text-base text-gray-300 leading-relaxed italic">"${word.example}"</p>
          <button class="vocab-sheet-audio-btn mt-2 text-xs text-[#5e5ce6] flex items-center gap-1" data-sentence="${word.example}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg> Play Sentence
          </button>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Collocations</p>
          <div class="flex flex-wrap gap-2">
            ${word.collocations.map(c => `<span class="px-3 py-1 rounded-full bg-white/5 text-sm text-gray-300">${c}</span>`).join('')}
          </div>
        </div>
      </div>
    `;

    // 事件委托绑定 Sheet 内部按钮
    els.sheetContent.onclick = (e) => {
      const saveBtn = e.target.closest('#vocab-sheet-save-btn');
      const audioBtn = e.target.closest('.vocab-sheet-audio-btn');
      if (saveBtn) toggleSave(saveBtn.dataset.id, saveBtn);
      if (audioBtn) playAudio(audioBtn.dataset.sentence);
    };

    els.sheet.classList.add('open');
    els.backdrop.classList.remove('hidden');
    setTimeout(() => els.backdrop.classList.add('opacity-100'), 10);
    if (window.Haptics) Haptics.light();
  }

  function closeSheet() {
    els.sheet.classList.remove('open');
    els.backdrop.classList.remove('opacity-100');
    setTimeout(() => els.backdrop.classList.add('hidden'), 300);
  }

  function toggleSave(wordId, btn) {
    if (Store.isWordSaved(wordId)) {
      Store.unsaveWord(wordId);
      btn.classList.remove('text-[#5e5ce6]');
      btn.classList.add('text-white/40');
      btn.querySelector('svg').setAttribute('fill', 'none');
    } else {
      Store.saveWord(wordId);
      btn.classList.add('text-[#5e5ce6]');
      btn.classList.remove('text-white/40');
      btn.querySelector('svg').setAttribute('fill', 'currentColor');
      if (window.Haptics) Haptics.success();
    }
  }

  // 暴露公共 API
  return { init, closeSheet };
})();

// 启动模块
document.addEventListener('DOMContentLoaded', VocabModule.init);