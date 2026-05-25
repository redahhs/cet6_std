/**
 * Vocab Page Component
 * 组件化渲染，动画锁，状态驱动
 */

class VocabPage {
  constructor(root) {
    this.root = root;
    this.isAnimating = false; // 动画锁
    this.words = [];
    this.currentIndex = 0;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.isDragging = false;
    this.activeCard = null;
  }

  async mount() {
    await this.loadData();
    this.render();
    this.bindEvents();
  }

  unmount() {
    // Cleanup event listeners if needed
    window.AudioManager.stop();
  }

  async loadData() {
    try {
      const res = await fetch('./data/words.json');
      const data = await res.json();
      this.words = data.map(w => ({
        id: w.word,
        word: w.word,
        pos: w.translations?.[0]?.type || '',
        meaning: w.translations?.map(t => t.translation).join('；') || '',
        phrases: w.phrases || []
      }));
    } catch (e) {
      console.error('[Render Error] Failed to load words:', e);
    }
  }

  render() {
    this.root.innerHTML = `
      <header class="flex justify-between items-center px-6 pt-12 pb-4">
        <button id="btn-back" class="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div class="text-center">
          <h1 class="text-lg font-semibold">Focus Mode</h1>
          <p class="text-xs text-[var(--text-secondary)]" id="progress-text">0 / ${this.words.length}</p>
        </div>
        <div class="w-10"></div>
      </header>

      <div class="px-6 mb-4">
        <div class="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div id="progress-bar" class="h-full bg-[var(--accent)] rounded-full transition-all duration-500" style="width: 0%"></div>
        </div>
      </div>

      <main class="flex-1 relative px-6 flex items-center justify-center" id="card-container"></main>

      <footer class="px-6 pb-8 pt-4 flex justify-center gap-8 items-center" style="padding-bottom: max(24px, var(--safe-bottom));">
        <button id="btn-forgot" class="w-14 h-14 rounded-full bg-[var(--bg-secondary)] border border-red-500/20 flex items-center justify-center text-red-500 min-h-[44px] min-w-[44px]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <button id="btn-known" class="w-14 h-14 rounded-full bg-[var(--bg-secondary)] border border-green-500/20 flex items-center justify-center text-green-500 min-h-[44px] min-w-[44px]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
      </footer>
    `;

    this.renderCard();
    this.updateProgress();
  }

  createWordCard(word) {
    const card = document.createElement('div');
    card.className = 'vocab-card';
    card.innerHTML = `
      <span class="vocab-card__pos">${word.pos}</span>
      <h2 class="vocab-card__word">${word.word}</h2>
      <button class="vocab-card__audio" data-word="${word.word}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
      </button>
    `;
    return card;
  }

  renderCard() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';

    if (this.currentIndex >= this.words.length) {
      container.innerHTML = '<div class="text-center text-[var(--text-secondary)]"><p class="text-4xl mb-4">🎉</p><p class="text-xl font-semibold text-white">Session Complete</p></div>';
      return;
    }

    const word = this.words[this.currentIndex];
    this.activeCard = this.createWordCard(word);
    container.appendChild(this.activeCard);

    // Bind touch events to the new card
    this.activeCard.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    this.activeCard.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.activeCard.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    
    // Audio button
    this.activeCard.querySelector('.vocab-card__audio').addEventListener('click', (e) => {
      e.stopPropagation();
      window.AudioManager.play(word.word); // 使用 AudioManager
    });
  }

  updateProgress() {
    const total = this.words.length;
    document.getElementById('progress-text').textContent = `${this.currentIndex} / ${total}`;
    const percent = total > 0 ? (this.currentIndex / total) * 100 : 0;
    document.getElementById('progress-bar').style.width = `${percent}%`;
  }

  // --- Touch Physics & Animation Lock ---

  handleTouchStart(e) {
    if (this.isAnimating) return; // 动画锁
    this.isDragging = true;
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.activeCard.classList.add('vocab-card--swiping');
  }

  handleTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this.currentX = e.touches[0].clientX - this.startX;
    this.currentY = e.touches[0].clientY - this.startY;
    const rotate = this.currentX * 0.05;
    this.activeCard.style.transform = `translate(${this.currentX}px, ${this.currentY}px) rotate(${rotate}deg)`;
  }

  handleTouchEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.activeCard.classList.remove('vocab-card--swiping');

    const threshold = 100;
    if (this.currentX > threshold) {
      this.flyOut('right');
    } else if (this.currentX < -threshold) {
      this.flyOut('left');
    } else {
      this.activeCard.style.transform = '';
    }
    this.currentX = 0;
    this.currentY = 0;
  }

  flyOut(direction) {
    this.isAnimating = true; // 锁定动画
    const cls = direction === 'right' ? 'vocab-card--fly-right' : 'vocab-card--fly-left';
    this.activeCard.classList.add(cls);

    // Update State
    const word = this.words[this.currentIndex];
    const state = window.Store.getState();
    if (direction === 'right') {
      state.vocab.learned.push(word.id);
    }
    window.Store.setState({ vocab: { ...state.vocab, currentIndex: this.currentIndex + 1 } });

    setTimeout(() => {
      this.currentIndex++;
      this.renderCard();
      this.updateProgress();
      this.isAnimating = false; // 解锁
    }, 500);
  }

  bindEvents() {
    document.getElementById('btn-back').addEventListener('click', () => window.Router.navigate('/'));
    document.getElementById('btn-forgot').addEventListener('click', () => {
      if (!this.isAnimating && this.activeCard) this.flyOut('left');
    });
    document.getElementById('btn-known').addEventListener('click', () => {
      if (!this.isAnimating && this.activeCard) this.flyOut('right');
    });
  }
}

window.VocabPage = VocabPage;