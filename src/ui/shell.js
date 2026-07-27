/**
 * Application shell: sidebar, topbar and the mobile drawer.
 *
 * Below 1024px the sidebar is a modal drawer, so it carries everything a modal
 * needs: a scrim, a focus trap, Escape to close, `inert` on the background,
 * and focus returned to the trigger when it closes.
 */
(function initShell(GovSpirit) {
  'use strict';

  const {
    Html,
    Dom,
    Icons,
    Store,
    Theme,
    Router,
    Components,
    FilterManager,
    Exporters,
    EventBus,
    Events,
    Format,
  } = GovSpirit.require(
    'Html',
    'Dom',
    'Icons',
    'Store',
    'Theme',
    'Router',
    'Components',
    'FilterManager',
    'Exporters',
    'EventBus',
    'Events',
    'Format'
  );

  const { html, setHTML } = Html;

  const REPO_URL = 'https://github.com/ShreyasThakur11/govspirit-warehouse';

  let releaseFocusTrap = null;

  /* ══════════════════════════════════════════════════════════════════════
     SIDEBAR
     ══════════════════════════════════════════════════════════════════ */

  function buildSidebar() {
    const sidebar = Dom.byId('sidebar');
    if (!sidebar) return;

    const dataLoaded = Store.getState().isDataLoaded;

    const sections = Router.GROUPS.map((group) => {
      const pages = Object.entries(Router.PAGES).filter(([, page]) => page.group === group.id);
      if (!pages.length) return '';

      return html`
        ${group.label ? html`<h2 class="nav-section">${group.label}</h2>` : ''}
        ${pages.map(([id, page]) => {
          const locked = page.requiresData && !dataLoaded;
          return html`
            <button
              type="button"
              class="nav-item"
              data-page="${id}"
              ${locked ? Html.raw('aria-disabled="true"') : ''}
            >
              ${Icons.render(page.icon, { size: 18 })}
              <span class="nav-label">${page.label}</span>
              ${locked ? Icons.render('lock', { size: 13, label: 'Requires data' }) : ''}
            </button>
          `;
        })}
      `;
    });

    setHTML(
      sidebar,
      html`
        <div class="sidebar-brand">
          ${Icons.brandMark(26)}
          <span class="brand-text">
            <span class="brand-name">GovSpirit</span>
            <span class="brand-tagline">Excise depot analytics</span>
          </span>
        </div>

        <nav class="sidebar-nav" aria-label="Sections">${sections}</nav>

        <div class="sidebar-footer">
          <span>Version ${GovSpirit.VERSION}</span>
          <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">
            Source ${Icons.render('externalLink', { size: 12 })}
            <span class="visually-hidden">code on GitHub, opens in a new tab</span>
          </a>
        </div>
      `
    );

    Dom.delegate(sidebar, '.nav-item', 'click', (event, button) => {
      if (button.getAttribute('aria-disabled') === 'true') {
        Components.toast('Load a dataset first to open that view.', 'warning');
        return;
      }
      Router.navigate(button.dataset.page);
      if (Dom.isDrawerLayout()) closeDrawer();
    });

    updateActiveNav(Router.current());
    // buildSidebar replaces the subtree, so the inert state must be re-applied.
    syncDrawerInert();
  }

  function updateActiveNav(pageId) {
    Dom.qsa('#sidebar .nav-item').forEach((item) => {
      if (item.dataset.page === pageId) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     DRAWER
     ══════════════════════════════════════════════════════════════════ */

  const isDrawerOpen = () => document.body.classList.contains('nav-open');

  /**
   * Keep the closed drawer out of the tab order and the accessibility tree.
   *
   * The stylesheet sets `visibility: hidden` on the closed drawer, but that
   * value arrives through a transition, and a transition does not settle while
   * the tab is backgrounded or if it is interrupted. Relying on it alone leaves
   * eleven off-screen navigation buttons focusable. `inert` applies
   * synchronously, so it is the actual guarantee.
   */
  function syncDrawerInert() {
    const sidebar = Dom.byId('sidebar');
    if (!sidebar) return;
    const shouldBeInert = Dom.isDrawerLayout() && !isDrawerOpen();
    sidebar.toggleAttribute('inert', shouldBeInert);
    // Belt and braces for browsers without `inert` support.
    if (shouldBeInert) sidebar.setAttribute('aria-hidden', 'true');
    else sidebar.removeAttribute('aria-hidden');
  }

  function openDrawer() {
    if (!Dom.isDrawerLayout() || isDrawerOpen()) return;
    const sidebar = Dom.byId('sidebar');

    document.body.classList.add('nav-open');
    Dom.byId('btn-nav-toggle')?.setAttribute('aria-expanded', 'true');
    sidebar?.setAttribute('role', 'dialog');
    sidebar?.setAttribute('aria-modal', 'true');
    sidebar?.setAttribute('aria-label', 'Sections');

    // Hide the covered application from assistive technology.
    Dom.byId('main-wrapper')?.setAttribute('inert', '');
    syncDrawerInert();
    releaseFocusTrap = Dom.trapFocus(sidebar);
  }

  function closeDrawer() {
    if (!isDrawerOpen()) return;
    const sidebar = Dom.byId('sidebar');

    document.body.classList.remove('nav-open');
    Dom.byId('btn-nav-toggle')?.setAttribute('aria-expanded', 'false');
    sidebar?.removeAttribute('role');
    sidebar?.removeAttribute('aria-modal');
    Dom.byId('main-wrapper')?.removeAttribute('inert');
    syncDrawerInert();

    releaseFocusTrap?.();
    releaseFocusTrap = null;
  }

  function toggleNav() {
    if (Dom.isDrawerLayout()) {
      if (isDrawerOpen()) closeDrawer();
      else openDrawer();
      return;
    }
    // On a wide screen the same control collapses the rail to icons.
    const app = Dom.byId('app');
    const collapsed = app.classList.toggle('is-rail');
    Dom.byId('btn-nav-toggle')?.setAttribute('aria-expanded', String(!collapsed));
  }

  /* ══════════════════════════════════════════════════════════════════════
     TOPBAR
     ══════════════════════════════════════════════════════════════════ */

  function buildTopbar() {
    const topbar = Dom.byId('topbar');
    if (!topbar) return;

    setHTML(
      topbar,
      html`
        <div class="topbar-start">
          <button
            type="button"
            class="btn btn-icon"
            id="btn-nav-toggle"
            aria-expanded="false"
            aria-controls="sidebar"
          >
            ${Icons.render('menu', { size: 20, label: 'Sections' })}
          </button>

          <span class="topbar-brand">
            ${Icons.brandMark(22)}
            <span class="topbar-brand-name">GovSpirit</span>
          </span>

          <div class="topbar-search">
            ${Icons.render('search', { size: 15 })}
            <label class="visually-hidden" for="topbar-search">Search warehouse data</label>
            <input type="search" id="topbar-search" placeholder="Search" autocomplete="off" />
          </div>
        </div>

        <div class="topbar-end">
          <button type="button" class="btn btn-icon" id="btn-open-search" hidden>
            ${Icons.render('search', { size: 19, label: 'Search' })}
          </button>

          <button
            type="button"
            class="btn btn-icon"
            id="btn-filters"
            aria-expanded="false"
            aria-controls="filter-panel"
          >
            ${Icons.render('filter', { size: 18, label: 'Filters' })}
            <span class="count-badge" id="filter-count" hidden></span>
          </button>

          <div class="dropdown">
            <button
              type="button"
              class="btn btn-icon"
              id="btn-export"
              aria-haspopup="menu"
              aria-expanded="false"
              aria-controls="export-menu"
            >
              ${Icons.render('download', { size: 18, label: 'Export' })}
            </button>
            <div class="dropdown-menu" id="export-menu" role="menu" hidden>
              <button type="button" class="dropdown-item" role="menuitem" data-export="csv">
                ${Icons.render('fileSpreadsheet', { size: 16 })} Current view as CSV
              </button>
              <button type="button" class="dropdown-item" role="menuitem" data-export="excel">
                ${Icons.render('boxes', { size: 16 })} Full Excel workbook
              </button>
              <button type="button" class="dropdown-item" role="menuitem" data-export="pdf">
                ${Icons.render('print', { size: 16 })} Page snapshot as PDF
              </button>
            </div>
          </div>

          <button type="button" class="btn btn-icon" id="btn-theme">
            <span id="theme-icon-slot">${Icons.render('moon', { size: 18 })}</span>
            <span class="visually-hidden" id="theme-label">Switch to light theme</span>
          </button>

          <p class="data-pill" id="data-pill" hidden>
            <span class="data-pill-dot" aria-hidden="true"></span>
            <span class="pill-text" id="data-pill-text"></span>
          </p>
        </div>
      `
    );

    bindTopbar();
    syncThemeControl();
  }

  function bindTopbar() {
    Dom.on(Dom.byId('btn-nav-toggle'), 'click', toggleNav);
    Dom.on(Dom.byId('sidebar-scrim'), 'click', closeDrawer);
    Dom.on(Dom.byId('btn-filters'), 'click', FilterManager.toggle);
    Dom.on(Dom.byId('btn-open-search'), 'click', () => Router.navigate('search'));
    Dom.on(Dom.byId('btn-theme'), 'click', () => {
      Theme.toggle();
      syncThemeControl();
    });

    Dom.on(Dom.byId('topbar-search'), 'keydown', (event) => {
      if (event.key !== 'Enter') return;
      const query = event.target.value.trim();
      if (!query) return;
      Router.navigate('search', { context: { query } });
      event.target.value = '';
    });

    /* ── Export menu ────────────────────────────────────────────────── */

    const exportButton = Dom.byId('btn-export');
    const exportMenu = Dom.byId('export-menu');

    const setMenuOpen = (open) => {
      if (!exportMenu || !exportButton) return;
      exportMenu.hidden = !open;
      exportButton.setAttribute('aria-expanded', String(open));
      if (open) Dom.nextFrame(() => exportMenu.querySelector('.dropdown-item')?.focus());
    };

    Dom.on(exportButton, 'click', () => setMenuOpen(exportMenu.hidden));

    Dom.on(document, 'click', (event) => {
      if (exportMenu && !exportMenu.hidden && !event.target.closest('.dropdown')) {
        setMenuOpen(false);
      }
    });

    Dom.delegate(exportMenu, '.dropdown-item', 'click', (event, item) => {
      setMenuOpen(false);
      exportButton?.focus();
      runExport(item.dataset.export);
    });

    /* ── Escape closes the topmost transient surface ────────────────── */

    Dom.on(document, 'keydown', (event) => {
      if (event.key !== 'Escape') return;

      if (exportMenu && !exportMenu.hidden) {
        setMenuOpen(false);
        exportButton?.focus();
        return;
      }
      if (isDrawerOpen()) {
        closeDrawer();
        return;
      }
      if (FilterManager.isOpen()) {
        FilterManager.setOpen(false);
        Dom.byId('btn-filters')?.focus();
      }
    });

    /* ── Shortcuts ──────────────────────────────────────────────────── */

    Dom.on(document, 'keydown', (event) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        Router.navigate('search');
        return;
      }
      if (!typing && event.key === '/') {
        event.preventDefault();
        Router.navigate('search');
      }
    });

    /* ── Delegated navigation from anywhere on the page ─────────────── */

    Dom.delegate(document.body, '[data-navigate]', 'click', (event, element) => {
      event.preventDefault();
      Router.navigate(element.dataset.navigate);
    });
  }

  function syncThemeControl() {
    const light = Theme.isLight();
    const slot = Dom.byId('theme-icon-slot');
    const label = Dom.byId('theme-label');
    if (slot) setHTML(slot, Icons.render(light ? 'sun' : 'moon', { size: 18 }));
    if (label) label.textContent = light ? 'Switch to dark theme' : 'Switch to light theme';
  }

  /* ══════════════════════════════════════════════════════════════════════
     EXPORT
     ══════════════════════════════════════════════════════════════════ */

  /** What "export the current view" means, per route. */
  function currentViewRows() {
    const state = Store.getState();
    const page = Router.current();

    const byPage = {
      executive: state.processedData.inventory,
      inventory: state.classifications.items,
      warehouse: state.processedData.zones,
      dispatch: state.processedData.dispatch,
      hotels: state.kpis.topHotels,
      brandSupplier: state.kpis.topBrands,
      stockAging: state.aging.deadStock,
      employees: state.rawData.employees,
      recommendations: state.recommendations,
    };

    return { rows: byPage[page] || state.processedData.inventory || [], name: page || 'export' };
  }

  function runExport(kind) {
    if (!Store.getState().isDataLoaded) {
      Components.toast('Load a dataset before exporting.', 'warning');
      return;
    }

    if (kind === 'csv') {
      const { rows, name } = currentViewRows();
      Exporters.downloadCSV(rows, name);
      return;
    }

    if (kind === 'excel') {
      const state = Store.getState();
      Exporters.downloadExcel(
        {
          Inventory: state.processedData.inventory,
          Orders: state.processedData.orders,
          Dispatch: state.processedData.dispatch,
          Zones: state.processedData.zones,
          Classification: state.classifications.items || [],
          Recommendations: (state.recommendations || []).map((item) => ({
            id: item.id,
            priority: item.priorityLabel,
            category: item.category,
            title: item.title,
          })),
        },
        'workbook'
      );
      return;
    }

    if (kind === 'pdf') {
      Exporters.downloadPDF('main-content', Router.current() || 'dashboard');
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     STATE SYNC
     ══════════════════════════════════════════════════════════════════ */

  function onDataLoaded() {
    const pill = Dom.byId('data-pill');
    const text = Dom.byId('data-pill-text');
    if (pill) pill.hidden = false;
    if (text) text.textContent = `${Format.number(Store.inventory().length)} lines`;

    buildSidebar();
    FilterManager.render();
  }

  function onDataCleared() {
    const pill = Dom.byId('data-pill');
    if (pill) pill.hidden = true;
    buildSidebar();
  }

  /**
   * Keep the shell coherent when the viewport crosses the drawer breakpoint
   * during a session, for instance when an iPad is rotated with the menu open.
   */
  function onViewportChange() {
    if (Dom.isDrawerLayout()) {
      Dom.byId('app')?.classList.remove('is-rail');
    } else {
      closeDrawer();
      Dom.byId('main-wrapper')?.removeAttribute('inert');
    }

    // The inline search disappears below 900px, so offer a control that opens
    // the full search page instead.
    const openSearch = Dom.byId('btn-open-search');
    if (openSearch) openSearch.hidden = !Dom.isDrawerLayout();

    syncDrawerInert();
  }

  function init() {
    buildSidebar();
    buildTopbar();

    EventBus.on(Events.DATA_LOADED, onDataLoaded);
    EventBus.on(Events.DATA_CLEARED, onDataCleared);
    EventBus.on(Events.PAGE_CHANGED, ({ page }) => updateActiveNav(page));
    EventBus.on(Events.VIEWPORT_CHANGED, onViewportChange);
    EventBus.on(Events.THEME_CHANGED, syncThemeControl);

    // The filter panel starts closed and inert so its controls are not tabbable.
    FilterManager.setOpen(false);
    onViewportChange();
  }

  GovSpirit.Shell = { init, buildSidebar, openDrawer, closeDrawer, toggleNav, updateActiveNav };
})(window.GovSpirit);
