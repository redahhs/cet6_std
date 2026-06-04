/* ===== Heatmap — 学习热力图 ===== */

function recordDailyActivity(count = 1) {
    if (!state.dailyActivity) state.dailyActivity = {};
    const today = todayISO();
    state.dailyActivity[today] = (state.dailyActivity[today] || 0) + count;
    saveState();
}

function renderHeatmap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = state.dailyActivity || {};
    const today = new Date();
    const days = 91;  // 13 周
    const cells = [];

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const count = data[key] || 0;
        let level = 0;
        if (count > 0) level = 1;
        if (count >= 5) level = 2;
        if (count >= 15) level = 3;
        if (count >= 30) level = 4;
        cells.push({ date: key, count, level });
    }

    // 按周分组（7 天一行）
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }

    container.innerHTML = `
        <div class="heatmap">
            <div class="heatmap-grid">
                ${weeks.map(week => `
                    <div class="heatmap-col">
                        ${week.map(cell => `
                            <div class="heatmap-cell level-${cell.level}" title="${cell.date}: ${cell.count} words"></div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
            <div class="heatmap-legend">
                <span>Less</span>
                <div class="heatmap-cell level-0"></div>
                <div class="heatmap-cell level-1"></div>
                <div class="heatmap-cell level-2"></div>
                <div class="heatmap-cell level-3"></div>
                <div class="heatmap-cell level-4"></div>
                <span>More</span>
            </div>
        </div>
    `;
}
