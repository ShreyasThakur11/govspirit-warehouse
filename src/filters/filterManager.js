/**
 * Global filter panel.
 *
 * Renders the filter controls, keeps the active chips in step, and owns the
 * per-dataset field maps that the store needs in order to apply a filter to a
 * table whose column names it does not know in advance.
 */
(function initFilterManager(GovSpirit) {
  'use strict';

  const { Html, Dom, Icons, Store, EventBus, Events } = GovSpirit.require(
    'Html',
    'Dom',
    'Icons',
    'Store',
    'EventBus',
    'Events'
  );
  const { html, raw, setHTML } = Html;

  /**
   * Which column each global filter applies to, per dataset. A filter with no
   * entry for a dataset simply does not apply to it, rather than matching
   * nothing and silently emptying the view.
   */
  const FIELD_MAPS = Object.freeze({
    inventory: {
      zone: 'zone',
      brand: 'brand',
      supplier: 'supplier',
      category: 'category',
      bottleSize: 'bottle_size',
      alcoholType: 'alcohol_type',
      sku: 'sku_id',
      date: 'last_received_date',
    },
    orders: {
      hotel: 'hotel_name',
      brand: 'brand',
      category: 'category',
      bottleSize: 'bottle_size',
      sku: 'sku_id',
      date: 'order_date',
    },
    dispatch: {
      hotel: 'hotel_name',
      brand: 'brand',
      category: 'category',
      sku: 'sku_id',
      date: 'dispatch_date',
    },
  });

  /** Controls offered in the panel, in reading order. */
  const CONTROLS = Object.freeze([
    { key: 'zone', label: 'Zone', options: 'zones' },
    { key: 'brand', label: 'Brand', options: 'brands' },
    { key: 'category', label: 'Category', options: 'categories' },
    { key: 'supplier', label: 'Supplier', options: 'suppliers' },
    { key: 'hotel', label: 'Customer', options: 'hotels' },
    { key: 'bottleSize', label: 'Bottle size', options: 'bottleSizes' },
    { key: 'alcoholType', label: 'Alcohol type', options: 'alcoholTypes' },
  ]);

  const panelElement = () => document.getElementById('filter-panel');

  function selectField(control, options, current) {
    const id = `filter-${control.key}`;
    return html`
      <div class="field">
        <label class="field-label" for="${id}">${control.label}</label>
        <select class="control-select" id="${id}" data-filter="${control.key}">
          <option value="">All</option>
          ${options.map(
            (option) =>
              html`<option value="${option}" ${option === current ? raw('selected') : ''}>
                ${option}
              </option>`
          )}
        </select>
      </div>
    `;
  }

  function render() {
    const panel = panelElement();
    if (!panel) return;

    const { filterOptions, filters } = Store.getState();
    const available = CONTROLS.filter((c) => (filterOptions[c.options] || []).length > 0);

    setHTML(
      panel,
      html`
        <div class="filter-clip">
          <div class="filter-body">
            <div class="filter-header">
              <h2 class="filter-heading" id="filter-panel-title">Filters</h2>
              <button type="button" class="btn btn-subtle btn-sm" id="btn-clear-filters">
                Clear all
              </button>
            </div>

            ${
              available.length === 0
                ? html`<p class="empty-body">Load a dataset to enable filtering.</p>`
                : html`
                    <div class="filter-grid">
                      ${available.map((control) =>
                        selectField(control, filterOptions[control.options], filters[control.key])
                      )}
                      <div class="field">
                        <label class="field-label" for="filter-date-from">Received from</label>
                        <input
                          type="date"
                          class="control"
                          id="filter-date-from"
                          value="${filters.dateRange.from || ''}"
                        />
                      </div>
                      <div class="field">
                        <label class="field-label" for="filter-date-to">Received to</label>
                        <input
                          type="date"
                          class="control"
                          id="filter-date-to"
                          value="${filters.dateRange.to || ''}"
                        />
                      </div>
                    </div>
                  `
            }

            <div class="filter-chips" id="filter-chips" role="status" aria-live="polite"></div>
          </div>
        </div>
      `
    );

    bindEvents(panel);
    renderChips();
  }

  function bindEvents(panel) {
    Dom.delegate(panel, '.control-select', 'change', (event, select) => {
      Store.setFilter(select.dataset.filter, select.value || null);
      renderChips();
    });

    const from = panel.querySelector('#filter-date-from');
    const to = panel.querySelector('#filter-date-to');
    const applyDates = () => {
      Store.setFilter('dateRange', { from: from?.value || null, to: to?.value || null });
      renderChips();
    };
    Dom.on(from, 'change', applyDates);
    Dom.on(to, 'change', applyDates);

    Dom.on(panel.querySelector('#btn-clear-filters'), 'click', () => {
      Store.clearFilters();
      render();
    });

    Dom.delegate(panel, '.chip-remove', 'click', (event, button) => {
      const key = button.dataset.key;
      if (key === 'dateRange') Store.setFilter('dateRange', { from: null, to: null });
      else Store.setFilter(key, null);
      render();
    });
  }

  function activeChips() {
    const { filters } = Store.getState();
    const chips = [];

    CONTROLS.forEach((control) => {
      const value = filters[control.key];
      if (value) chips.push({ key: control.key, label: control.label, value });
    });

    const { from, to } = filters.dateRange;
    if (from || to) {
      chips.push({
        key: 'dateRange',
        label: 'Received',
        value: `${from || 'any date'} to ${to || 'any date'}`,
      });
    }

    return chips;
  }

  function renderChips() {
    const container = document.getElementById('filter-chips');
    const chips = activeChips();

    if (container) {
      setHTML(
        container,
        chips.map(
          (chip) => html`
            <span class="chip">
              <span class="chip-text">${chip.label}: ${chip.value}</span>
              <button
                type="button"
                class="chip-remove"
                data-key="${chip.key}"
                aria-label="Remove the ${chip.label} filter"
              >
                ${Icons.render('close', { size: 12 })}
              </button>
            </span>
          `
        )
      );
    }

    const badge = document.getElementById('filter-count');
    if (badge) {
      badge.textContent = chips.length ? String(chips.length) : '';
      badge.hidden = chips.length === 0;
    }

    const button = document.getElementById('btn-filters');
    if (button) {
      button.classList.toggle('is-active', chips.length > 0);
      const icon = button.querySelector('.icon');
      if (icon) {
        icon.setAttribute(
          'aria-label',
          chips.length ? `Filters, ${chips.length} active` : 'Filters'
        );
      }
    }
  }

  const isOpen = () => Store.getState().filterPanelOpen;

  function setOpen(open) {
    const panel = panelElement();
    const button = document.getElementById('btn-filters');

    Store.setFilterPanelOpen(open);
    panel?.classList.toggle('is-open', open);
    // A collapsed panel keeps its controls in the DOM, so it has to be inert or
    // they remain in the tab order behind a zero-height container.
    panel?.toggleAttribute('inert', !open);
    button?.setAttribute('aria-expanded', String(open));

    if (open) Dom.nextFrame(() => panel?.querySelector('select, input')?.focus());
  }

  const toggle = () => setOpen(!isOpen());

  /* ── Dataset helpers used by page modules ─────────────────────────────── */

  const applyToInventory = (rows) => Store.applyFilters(rows, FIELD_MAPS.inventory);
  const applyToOrders = (rows) => Store.applyFilters(rows, FIELD_MAPS.orders);
  const applyToDispatch = (rows) => Store.applyFilters(rows, FIELD_MAPS.dispatch);

  EventBus.on(Events.DATA_LOADED, render);
  EventBus.on(Events.DATA_CLEARED, render);

  GovSpirit.FilterManager = {
    FIELD_MAPS,
    render,
    renderChips,
    toggle,
    setOpen,
    isOpen,
    activeChips,
    applyToInventory,
    applyToOrders,
    applyToDispatch,
  };
})(window.GovSpirit);
