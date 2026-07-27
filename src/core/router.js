/**
 * GovSpirit Router.
 *
 * Hash-based routing so a view can be bookmarked, shared and reached with the
 * browser Back button. The previous build kept the current page in a private
 * variable, so refreshing always dropped the operator back at the import
 * screen and Back left the application entirely.
 *
 * Each page module is `{ title, render(), mount?(context), unmount?() }`.
 */
(function initRouter(GovSpirit) {
  'use strict';

  const { Html, Dom, Store, Charts, EventBus, Events } = GovSpirit.require(
    'Html',
    'Dom',
    'Store',
    'Charts',
    'EventBus',
    'Events'
  );

  /**
   * Page registry. `requiresData` pages redirect to the import screen until a
   * dataset has been loaded.
   */
  const PAGES = Object.freeze({
    import: { label: 'Import data', icon: 'import', group: 'start', requiresData: false },
    executive: {
      label: 'Executive summary',
      icon: 'dashboard',
      group: 'dashboards',
      requiresData: true,
    },
    inventory: { label: 'Inventory', icon: 'package', group: 'dashboards', requiresData: true },
    warehouse: {
      label: 'Warehouse map',
      icon: 'warehouse',
      group: 'dashboards',
      requiresData: true,
    },
    dispatch: { label: 'Dispatch', icon: 'truck', group: 'dashboards', requiresData: true },
    hotels: { label: 'Customers', icon: 'building', group: 'dashboards', requiresData: true },
    brandSupplier: {
      label: 'Brands and suppliers',
      icon: 'factory',
      group: 'analysis',
      requiresData: true,
    },
    stockAging: { label: 'Stock aging', icon: 'clock', group: 'analysis', requiresData: true },
    employees: { label: 'Workforce', icon: 'users', group: 'analysis', requiresData: true },
    recommendations: {
      label: 'Recommendations',
      icon: 'lightbulb',
      group: 'insights',
      requiresData: true,
    },
    search: { label: 'Search', icon: 'search', group: 'tools', requiresData: true },
  });

  const GROUPS = Object.freeze([
    { id: 'start', label: '' },
    { id: 'dashboards', label: 'Dashboards' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'insights', label: 'Insights' },
    { id: 'tools', label: 'Tools' },
  ]);

  const DEFAULT_PAGE = 'import';
  const BASE_TITLE = 'GovSpirit';

  let currentPage = null;
  let currentModule = null;
  let suppressHashHandling = false;

  const isKnown = (pageId) => Object.prototype.hasOwnProperty.call(PAGES, pageId);

  function pageFromHash() {
    const raw = window.location.hash.replace(/^#\/?/, '').trim();
    return isKnown(raw) ? raw : null;
  }

  function accessiblePage(pageId) {
    if (!isKnown(pageId)) return DEFAULT_PAGE;
    if (PAGES[pageId].requiresData && !Store.getState().isDataLoaded) return DEFAULT_PAGE;
    return pageId;
  }

  /**
   * Render a page into the main region.
   *
   * @param {string} pageId
   * @param {object} [options]
   * @param {object} [options.context]      passed through to the page's mount()
   * @param {boolean} [options.replaceHash] update the hash without a history entry
   * @param {boolean} [options.silent]      do not warn when redirecting
   */
  function navigate(pageId, { context = {}, replaceHash = false, silent = false } = {}) {
    const target = accessiblePage(pageId);

    if (target !== pageId && !silent) {
      GovSpirit.Components?.toast('Load a dataset first to open that view.', 'warning');
    }

    const main = Dom.byId('main-content');
    const module = GovSpirit.Pages?.[target];

    if (!main) return;
    if (!module) {
      console.error(`[Router] No page module registered for "${target}".`);
      Html.setHTML(
        main,
        GovSpirit.Components.errorState({
          title: 'Page unavailable',
          message: `The view "${target}" could not be loaded. Reload the page to recover.`,
        })
      );
      return;
    }

    // Tear the previous page down before replacing the DOM it is bound to.
    try {
      currentModule?.unmount?.();
    } catch (err) {
      console.error(`[Router] unmount() failed for "${currentPage}":`, err);
    }
    Charts.destroyAll();

    currentPage = target;
    currentModule = module;
    Store.setCurrentPage(target);

    Dom.setBusy(main, true);
    try {
      Html.setHTML(main, module.render(context));
    } catch (err) {
      console.error(`[Router] render() failed for "${target}":`, err);
      Html.setHTML(
        main,
        GovSpirit.Components.errorState({
          title: 'This view could not be rendered',
          message: err.message,
        })
      );
      Dom.setBusy(main, false);
      return;
    }

    main.scrollTop = 0;
    document.title = `${PAGES[target].label} · ${BASE_TITLE}`;

    // Mount after paint so charts measure a laid-out container.
    Dom.nextFrame(() => {
      try {
        module.mount?.(context);
      } catch (err) {
        console.error(`[Router] mount() failed for "${target}":`, err);
        GovSpirit.Components?.toast(
          'Part of this view failed to load. Check the console for details.',
          'error'
        );
      } finally {
        Dom.setBusy(main, false);
      }
    });

    // Move screen-reader focus to the new heading so the change is announced.
    const heading = main.querySelector('h1');
    if (heading) Dom.focusRegion(heading);

    syncHash(target, replaceHash);
    EventBus.emit(Events.PAGE_CHANGED, { page: target });
  }

  function syncHash(pageId, replace) {
    const desired = `#/${pageId}`;
    if (window.location.hash === desired) return;

    suppressHashHandling = true;
    if (replace) {
      history.replaceState(null, '', desired);
    } else {
      history.pushState(null, '', desired);
    }
    // Release on the next task; pushState does not fire hashchange, but a
    // rapid user-driven hash edit could otherwise be swallowed.
    setTimeout(() => {
      suppressHashHandling = false;
    }, 0);
  }

  function handleHashChange() {
    if (suppressHashHandling) return;
    const requested = pageFromHash() || DEFAULT_PAGE;
    if (requested !== currentPage) navigate(requested, { replaceHash: true, silent: true });
  }

  /** Re-render the current page in place, preserving the route. */
  function refresh() {
    if (currentPage) navigate(currentPage, { replaceHash: true, silent: true });
  }

  function init() {
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    // Filters change what every dashboard shows, so re-render on change,
    // debounced, because dragging a date picker fires repeatedly.
    const refreshOnFilters = Dom.debounce(() => {
      if (currentPage && currentPage !== 'import') refresh();
    }, 220);
    EventBus.on(Events.FILTERS_CHANGED, refreshOnFilters);

    // Charts are laid out in JS; a breakpoint crossing needs a re-measure.
    const refreshOnViewport = Dom.debounce(() => {
      if (currentPage && currentPage !== 'import') refresh();
    }, 320);
    EventBus.on(Events.VIEWPORT_CHANGED, refreshOnViewport);

    navigate(pageFromHash() || DEFAULT_PAGE, { replaceHash: true, silent: true });
  }

  GovSpirit.Router = {
    PAGES,
    GROUPS,
    DEFAULT_PAGE,
    BASE_TITLE,
    init,
    navigate,
    refresh,
    current: () => currentPage,
  };
})(window.GovSpirit);
