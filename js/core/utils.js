/**
 * GovSpirit Utils — Shared utility functions
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.Utils = (function () {

  // ─── Number Formatting ────────────────────────────────────────────────────

  function formatNumber(n, decimals = 0) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function formatCurrency(n, symbol = '₹') {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e7) return symbol + (n / 1e7).toFixed(2) + ' Cr';
    if (abs >= 1e5) return symbol + (n / 1e5).toFixed(2) + ' L';
    return symbol + formatNumber(n, 2);
  }

  function formatPercent(n, decimals = 1) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toFixed(decimals) + '%';
  }

  function formatK(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
  }

  // ─── Date Utilities ───────────────────────────────────────────────────────

  function parseDate(val) {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val) ? null : val;
    // Excel serial number
    if (typeof val === 'number' && val > 10000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      return isNaN(d) ? null : d;
    }
    const d = new Date(val);
    return isNaN(d) ? null : d;
  }

  function formatDate(val, opts = {}) {
    const d = parseDate(val);
    if (!d) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...opts });
  }

  function daysBetween(a, b) {
    const da = parseDate(a), db = parseDate(b || new Date());
    if (!da || !db) return null;
    return Math.floor((db - da) / (1000 * 60 * 60 * 24));
  }

  function today() { return new Date(); }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  function getLast30Days() {
    return Array.from({ length: 30 }, (_, i) => {
      const d = daysAgo(29 - i);
      return d.toISOString().slice(0, 10);
    });
  }

  function getMonthLabel(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return '';
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }

  // ─── Array/Object Utilities ───────────────────────────────────────────────

  function groupBy(arr, keyFn) {
    const map = {};
    arr.forEach(item => {
      const k = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
      const key = k ?? '__undefined__';
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }

  function sumBy(arr, key) {
    return arr.reduce((s, item) => s + (parseFloat(item[key]) || 0), 0);
  }

  function avgBy(arr, key) {
    if (!arr.length) return 0;
    return sumBy(arr, key) / arr.length;
  }

  function maxBy(arr, key) {
    if (!arr.length) return null;
    return arr.reduce((m, item) => (item[key] > m[key] ? item : m));
  }

  function minBy(arr, key) {
    if (!arr.length) return null;
    return arr.reduce((m, item) => (item[key] < m[key] ? item : m));
  }

  function sortBy(arr, key, dir = 'desc') {
    return [...arr].sort((a, b) => {
      const va = a[key] ?? 0, vb = b[key] ?? 0;
      return dir === 'desc' ? vb - va : va - vb;
    });
  }

  function topN(arr, key, n) {
    return sortBy(arr, key, 'desc').slice(0, n);
  }

  function unique(arr, key) {
    const seen = new Set();
    return arr.filter(item => {
      const v = key ? item[key] : item;
      if (seen.has(v)) return false;
      seen.add(v); return true;
    });
  }

  function countBy(arr, keyFn) {
    const map = {};
    arr.forEach(item => {
      const k = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }

  function flatMap(arr, fn) {
    return arr.reduce((acc, item) => acc.concat(fn(item)), []);
  }

  function chunk(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result;
  }

  function percentile(sortedArr, p) {
    if (!sortedArr.length) return 0;
    const idx = (p / 100) * (sortedArr.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
  }

  // ─── String Utilities ─────────────────────────────────────────────────────

  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function titleCase(s) {
    if (!s) return '';
    return s.replace(/\w\S*/g, w => capitalize(w));
  }

  function slugify(s) {
    return s.toString().toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
  }

  function truncate(s, n = 30) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  function similarity(a, b) {
    const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
    return 1 - dist / Math.max(a.length, b.length, 1);
  }

  // ─── Color Utilities ──────────────────────────────────────────────────────

  const CHART_COLORS = [
    '#6366f1','#3b82f6','#10b981','#f59e0b','#f43f5e',
    '#8b5cf6','#06b6d4','#84cc16','#ec4899','#14b8a6',
    '#f97316','#a855f7','#0ea5e9','#22c55e','#eab308'
  ];

  function getChartColor(idx) {
    return CHART_COLORS[idx % CHART_COLORS.length];
  }

  function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null;
  }

  function interpolateColor(color1, color2, t) {
    const c1 = hexToRgb(color1), c2 = hexToRgb(color2);
    if (!c1 || !c2) return color1;
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  function getUtilizationColor(pct) {
    if (pct >= 90) return '#f43f5e';
    if (pct >= 75) return '#f59e0b';
    if (pct >= 50) return '#3b82f6';
    return '#10b981';
  }

  function getStatusBadgeClass(status) {
    const s = (status || '').toLowerCase();
    if (['completed','fulfilled','active','good'].includes(s)) return 'badge-success';
    if (['pending','processing','medium'].includes(s)) return 'badge-warning';
    if (['failed','cancelled','dead','critical'].includes(s)) return 'badge-danger';
    if (['inactive','slow','low'].includes(s)) return 'badge-muted';
    return 'badge-info';
  }

  function getAbcColor(cls) {
    const c = { A: '#10b981', B: '#f59e0b', C: '#f43f5e' };
    return c[cls] || '#94a3b8';
  }

  // ─── DOM Utilities ────────────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }
  function qs(sel, parent = document) { return parent.querySelector(sel); }
  function qsa(sel, parent = document) { return [...parent.querySelectorAll(sel)]; }

  function setHTML(id, html) {
    const e = el(id);
    if (e) e.innerHTML = html;
  }

  function show(id) { const e = el(id); if (e) e.style.display = ''; }
  function hide(id) { const e = el(id); if (e) e.style.display = 'none'; }

  function addClass(id, cls) { const e = el(id); if (e) e.classList.add(cls); }
  function removeClass(id, cls) { const e = el(id); if (e) e.classList.remove(cls); }
  function toggleClass(id, cls) { const e = el(id); if (e) e.classList.toggle(cls); }

  function animateCount(el, target, duration = 1000) {
    const start = 0;
    const startTime = performance.now();
    function update(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      el.textContent = formatNumber(current);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  function throttle(fn, limit = 100) {
    let lastTime = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastTime >= limit) { lastTime = now; fn(...args); }
    };
  }

  // ─── Export Utilities ─────────────────────────────────────────────────────

  function downloadCSV(data, filename = 'export.csv') {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadJSON(data, filename = 'export.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPageToPDF() {
    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
      alert('PDF export libraries not loaded. Please check your internet connection.');
      return;
    }
    const content = document.getElementById('main-content');
    const canvas = await html2canvas(content, { backgroundColor: '#0a0c12', scale: 1.5 });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save('govspirit-export.pdf');
  }

  function exportToExcel(sheets, filename = 'govspirit-export.xlsx') {
    if (typeof XLSX === 'undefined') { alert('Excel export library not loaded.'); return; }
    const wb = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([name, data]) => {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    });
    XLSX.writeFile(wb, filename);
  }

  // ─── Validation Helpers ───────────────────────────────────────────────────

  function isValidDate(val) { const d = parseDate(val); return d !== null; }
  function isPositiveNumber(val) { return !isNaN(val) && parseFloat(val) >= 0; }
  function isNonEmpty(val) { return val !== null && val !== undefined && String(val).trim() !== ''; }

  // ─── Math Utilities ───────────────────────────────────────────────────────

  function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

  function linearScale(val, domainMin, domainMax, rangeMin, rangeMax) {
    if (domainMax === domainMin) return rangeMin;
    return rangeMin + ((val - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
  }

  function roundTo(n, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(n * factor) / factor;
  }

  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  // ─── Chart Registry ───────────────────────────────────────────────────────

  const _chartRegistry = {};

  function registerChart(id, instance) {
    if (_chartRegistry[id]) {
      try { _chartRegistry[id].destroy(); } catch(e) {}
    }
    _chartRegistry[id] = instance;
  }

  function destroyChart(id) {
    if (_chartRegistry[id]) {
      try { _chartRegistry[id].destroy(); } catch(e) {}
      delete _chartRegistry[id];
    }
  }

  function destroyAllCharts() {
    Object.keys(_chartRegistry).forEach(id => destroyChart(id));
  }

  // ─── Sparkline Utility ────────────────────────────────────────────────────

  function createSparkline(canvasId, data, color = '#6366f1') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data || data.length < 2) return;
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{ data, borderColor: color, borderWidth: 2, pointRadius: 0, fill: true,
          backgroundColor: hexToRgb(color) ? `rgba(${Object.values(hexToRgb(color)).join(',')},0.15)` : 'transparent',
          tension: 0.4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 800 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
    registerChart(canvasId, chart);
    return chart;
  }

  // ─── Table Rendering ──────────────────────────────────────────────────────

  function renderTable(containerId, data, columns, opts = {}) {
    const container = document.getElementById(containerId);
    if (!container || !data) return;
    const { maxRows = 100, sortable = true, searchable = false } = opts;

    const rows = data.slice(0, maxRows);
    const thead = columns.map(c => `<th>${c.label}</th>`).join('');
    const tbody = rows.map(row =>
      `<tr>${columns.map(c => {
        const val = row[c.key];
        const formatted = c.format ? c.format(val, row) : (val ?? '—');
        return `<td>${formatted}</td>`;
      }).join('')}</tr>`
    ).join('');

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>`;
  }

  // ─── KPI Card Rendering ───────────────────────────────────────────────────

  function kpiCard({ id, title, value, subtitle, icon, color = 'blue', trend, trendLabel, sparkData }) {
    const trendHTML = trend !== undefined ? `
      <div class="kpi-trend ${trend >= 0 ? 'trend-up' : 'trend-down'}">
        <span class="trend-icon">${trend >= 0 ? '↑' : '↓'}</span>
        <span>${Math.abs(trend).toFixed(1)}% ${trendLabel || ''}</span>
      </div>` : '';
    const sparkHTML = sparkData ? `<canvas id="spark-${id}" class="sparkline" height="40"></canvas>` : '';
    return `
      <div class="kpi-card kpi-${color}" id="kpi-${id}">
        <div class="kpi-header">
          <div class="kpi-icon kpi-icon-${color}">${icon || '📊'}</div>
          <div class="kpi-meta">
            <div class="kpi-title">${title}</div>
            ${trendHTML}
          </div>
        </div>
        <div class="kpi-value">${value}</div>
        ${subtitle ? `<div class="kpi-subtitle">${subtitle}</div>` : ''}
        ${sparkHTML}
      </div>`;
  }

  // ─── Section Header ───────────────────────────────────────────────────────

  function sectionHeader(title, subtitle = '', actions = '') {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">${title}</h2>
          ${subtitle ? `<p class="section-subtitle">${subtitle}</p>` : ''}
        </div>
        ${actions ? `<div class="section-actions">${actions}</div>` : ''}
      </div>`;
  }

  function chartCard(id, title, content, opts = {}) {
    const { height = '280px', subtitle = '', actions = '' } = opts;
    return `
      <div class="chart-card" id="card-${id}">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">${title}</div>
            ${subtitle ? `<div class="chart-card-subtitle">${subtitle}</div>` : ''}
          </div>
          ${actions ? `<div class="chart-actions">${actions}</div>` : ''}
        </div>
        <div class="chart-body" style="height:${height}">${content}</div>
      </div>`;
  }

  function chartCanvas(id, height = '260px') {
    return `<canvas id="${id}" style="max-height:${height}"></canvas>`;
  }

  // ─── Alert/Insight Cards ──────────────────────────────────────────────────

  function insightCard({ type = 'info', icon, title, body, action }) {
    return `
      <div class="insight-card insight-${type}">
        <div class="insight-icon">${icon || '💡'}</div>
        <div class="insight-body">
          <div class="insight-title">${title}</div>
          <div class="insight-text">${body}</div>
          ${action ? `<button class="btn btn-xs btn-outline mt-1" onclick="${action.fn}">${action.label}</button>` : ''}
        </div>
      </div>`;
  }

  // ─── Empty State ──────────────────────────────────────────────────────────

  function emptyState(message = 'No data available', icon = '📭') {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${message}</p></div>`;
  }

  return {
    formatNumber, formatCurrency, formatPercent, formatK,
    parseDate, formatDate, daysBetween, today, daysAgo, getLast30Days, getMonthLabel,
    groupBy, sumBy, avgBy, maxBy, minBy, sortBy, topN, unique, countBy, flatMap, chunk, percentile,
    capitalize, titleCase, slugify, truncate, levenshtein, similarity,
    CHART_COLORS, getChartColor, hexToRgb, interpolateColor, getUtilizationColor, getStatusBadgeClass, getAbcColor,
    el, qs, qsa, setHTML, show, hide, addClass, removeClass, toggleClass, animateCount, debounce, throttle,
    downloadCSV, downloadJSON, exportPageToPDF, exportToExcel,
    isValidDate, isPositiveNumber, isNonEmpty,
    clamp, linearScale, roundTo, generateId,
    registerChart, destroyChart, destroyAllCharts, createSparkline,
    renderTable, kpiCard, sectionHeader, chartCard, chartCanvas, insightCard, emptyState
  };
})();
