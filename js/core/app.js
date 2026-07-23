/**
 * GovSpirit App Bootstrap — Navigation, routing, export, theme
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.App = (function () {
  const { Utils, Store, EventBus, Events, FilterManager, ReferenceData } = GovSpirit;

  const PAGES = {
    input:           { label: 'Import List',       icon: '📝', module: 'input',         group: 'onboard',   protected: false },
    executive:       { label: 'Executive Summary', icon: '📊', module: 'executive',     group: 'dashboards', protected: true },
    inventory:       { label: 'Inventory',         icon: '📦', module: 'inventory',     group: 'dashboards', protected: true },
    warehouse:       { label: 'Warehouse Map',     icon: '🗺️', module: 'warehouse',     group: 'dashboards', protected: true },
    dispatch:        { label: 'Dispatch',          icon: '🚛', module: 'dispatch',       group: 'dashboards', protected: true },
    hotels:          { label: 'Hotels',            icon: '🏨', module: 'hotels',         group: 'dashboards', protected: true },
    brandSupplier:   { label: 'Brand & Supplier',  icon: '🏭', module: 'brandSupplier',  group: 'analytics',  protected: true },
    stockAging:      { label: 'Stock Aging',       icon: '🕐', module: 'stockAging',     group: 'analytics',  protected: true },
    employees:       { label: 'Employees',         icon: '👤', module: 'employees',      group: 'analytics',  protected: true },
    recommendations: { label: 'AI Insights',       icon: '🤖', module: 'recommendations',group: 'insights',   protected: true },
    search:          { label: 'Search',            icon: '🔍', module: 'search',         group: 'tools',      protected: false },
  };

  let _currentPage = null;

  // ─── Navigate ─────────────────────────────────────────────────────────────

  function navigate(pageId) {
    if (!PAGES[pageId]) { console.warn('[App] Unknown page:', pageId); return; }
    const page = PAGES[pageId];

    // Redirect to upload if data not loaded and page is protected
    if (page.protected && !Store.getState().isDataLoaded) {
      navigate('upload');
      showToast('Please load data first', 'warning');
      return;
    }

    // Destroy all charts before unmounting
    Utils.destroyAllCharts();

    // Update state
    Store.setCurrentPage(pageId);
    _currentPage = pageId;

    // Render page
    const main = document.getElementById('main-content');
    if (!main) return;

    const module = GovSpirit.Pages[page.module];
    if (!module) { main.innerHTML = `<div class="empty-state">⚠️ Page "${page.module}" not found</div>`; return; }

    main.innerHTML = module.render();
    if (module.mount) setTimeout(() => module.mount(), 50);

    // Update nav highlight
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('nav-item-active', el.dataset.page === pageId);
    });

    // Update page title
    document.title = `${page.label} | GovSpirit`;

    // Scroll to top
    main.scrollTop = 0;
    EventBus.emit(Events.PAGE_CHANGED, { to: pageId });
  }

  // ─── Build Sidebar ────────────────────────────────────────────────────────

  function buildSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const groups = {
      onboard:    { label: '', pages: [] },
      dashboards: { label: 'DASHBOARDS', pages: [] },
      analytics:  { label: 'ANALYTICS', pages: [] },
      insights:   { label: 'INSIGHTS', pages: [] },
      tools:      { label: 'TOOLS', pages: [] },
    };

    Object.entries(PAGES).forEach(([id, page]) => {
      if (groups[page.group]) groups[page.group].pages.push({ id, ...page });
    });

    let navHTML = '';
    Object.entries(groups).forEach(([gKey, group]) => {
      if (!group.pages.length) return;
      if (group.label) navHTML += `<div class="nav-group-label">${group.label}</div>`;
      group.pages.forEach(page => {
        navHTML += `<a class="nav-item" data-page="${page.id}" href="#" title="${page.label}">
          <span class="nav-icon">${page.icon}</span>
          <span class="nav-label">${page.label}</span>
        </a>`;
      });
    });

    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="logo-icon">🏛️</div>
        <div class="logo-text">
          <div class="logo-title">GovSpirit</div>
          <div class="logo-sub">Warehouse Intelligence</div>
        </div>
      </div>
      <nav class="sidebar-nav">${navHTML}</nav>
      <div class="sidebar-footer">
        <div class="sidebar-version">v1.0.0 Enterprise</div>
      </div>`;

    sidebar.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); navigate(el.dataset.page); });
    });
  }

  // ─── Build Topbar ─────────────────────────────────────────────────────────

  function buildTopbar() {
    const topbar = document.getElementById('topbar');
    if (!topbar) return;

    topbar.innerHTML = `
      <div class="topbar-left">
        <button class="btn btn-icon" id="btn-sidebar-toggle" title="Toggle Sidebar">☰</button>
        <div class="topbar-search" id="topbar-search-wrap">
          <span class="topbar-search-icon">🔍</span>
          <input type="text" id="topbar-search" class="topbar-search-input" placeholder="Quick search..." />
        </div>
      </div>
      <div class="topbar-right">
        <button class="btn btn-outline btn-sm" id="btn-filters" title="Toggle Filters">
          🔽 Filters <span class="filter-count-badge" id="filter-count-badge" style="display:none"></span>
        </button>
        <div class="export-dropdown">
          <button class="btn btn-outline btn-sm" id="btn-export-toggle">⬇ Export ▾</button>
          <div class="export-menu" id="export-menu">
            <button class="export-item" id="exp-csv">📄 Export CSV</button>
            <button class="export-item" id="exp-excel">📊 Export Excel</button>
            <button class="export-item" id="exp-pdf">🖨️ Export PDF</button>
          </div>
        </div>
        <button class="btn btn-icon theme-toggle" id="btn-theme" title="Toggle Theme">🌙</button>
        <div class="topbar-data-badge" id="data-badge" style="display:none">
          <span class="data-badge-dot"></span><span id="data-badge-label">Data Loaded</span>
        </div>
      </div>`;

    bindTopbarEvents();
  }

  function bindTopbarEvents() {
    // Sidebar toggle
    document.getElementById('btn-sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('app').classList.toggle('sidebar-collapsed');
    });

    // Quick search
    const searchInput = document.getElementById('topbar-search');
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { navigate('search'); setTimeout(() => { const s = document.getElementById('search-global-input'); if (s) { s.value = e.target.value; s.dispatchEvent(new Event('input')); } }, 100); }
    });

    // Filters toggle
    document.getElementById('btn-filters')?.addEventListener('click', FilterManager.togglePanel);

    // Export menu toggle
    document.getElementById('btn-export-toggle')?.addEventListener('click', () => {
      document.getElementById('export-menu')?.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.export-dropdown')) document.getElementById('export-menu')?.classList.remove('show');
    });

    // Export actions
    document.getElementById('exp-csv')?.addEventListener('click', exportCurrentPageCSV);
    document.getElementById('exp-excel')?.addEventListener('click', exportCurrentPageExcel);
    document.getElementById('exp-pdf')?.addEventListener('click', () => Utils.exportPageToPDF());

    // Theme toggle
    document.getElementById('btn-theme')?.addEventListener('click', () => {
      const current = Store.getState().theme;
      const next = current === 'dark' ? 'light' : 'dark';
      Store.setTheme(next);
      document.getElementById('btn-theme').textContent = next === 'dark' ? '🌙' : '☀️';
    });
  }

  function exportCurrentPageCSV() {
    const state = Store.getState();
    const pageExports = {
      inventory: state.processedData.inventory,
      dispatch: state.processedData.dispatch,
      orders: state.processedData.orders,
      hotels: state.kpis.topHotels,
      brandSupplier: state.kpis.topBrands,
      stockAging: state.aging.deadStock,
      employees: state.rawData.employees,
      recommendations: state.recommendations,
    };
    const data = pageExports[_currentPage] || state.processedData.inventory;
    Utils.downloadCSV(data, `govspirit_${_currentPage || 'export'}.csv`);
    document.getElementById('export-menu')?.classList.remove('show');
  }

  function exportCurrentPageExcel() {
    const state = Store.getState();
    Utils.exportToExcel({
      Inventory: state.processedData.inventory?.slice(0, 1000) || [],
      Orders: state.processedData.orders?.slice(0, 1000) || [],
      Dispatch: state.processedData.dispatch?.slice(0, 1000) || [],
      KPIs: [state.kpis],
    }, 'govspirit_export.xlsx');
    document.getElementById('export-menu')?.classList.remove('show');
  }

  // ─── Data Loaded Handler ──────────────────────────────────────────────────

  function onDataLoaded() {
    const badge = document.getElementById('data-badge');
    const label = document.getElementById('data-badge-label');
    if (badge) badge.style.display = 'flex';
    const inv = Store.getState().processedData.inventory || [];
    if (label) label.textContent = `${inv.length.toLocaleString()} rows loaded`;
    FilterManager.renderFilterPanel();
    showToast('Analytics ready! Welcome to your warehouse dashboard.', 'success');
  }

  // ─── Toast Notifications ──────────────────────────────────────────────────

  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || (() => {
      const el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
      return el;
    })();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => { toast.classList.remove('toast-visible'); setTimeout(() => toast.remove(), 300); }, duration);
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    buildSidebar();
    buildTopbar();

    // Apply saved theme
    const theme = Store.getState().theme;
    document.getElementById('btn-theme').textContent = theme === 'dark' ? '🌙' : '☀️';

    // Event listeners
    EventBus.on(Events.DATA_LOADED, onDataLoaded);

    // Start on input page
    navigate('input');

    // Keyboard shortcut: Ctrl+K = search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); navigate('search'); }
    });

    console.log('[GovSpirit] Application initialized successfully');
    console.log('[GovSpirit] Type GovSpirit in console to access the API');
  }

  return { init, navigate, showToast, PAGES };
})();

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  GovSpirit.App.init();
});
