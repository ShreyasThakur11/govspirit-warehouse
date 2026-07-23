/**
 * GovSpirit Filter Manager
 * Global filter state and cross-filtering logic
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.FilterManager = (function () {
  const { Utils, Store, EventBus, Events } = GovSpirit;

  // ─── Render Filter Panel ──────────────────────────────────────────────────

  function renderFilterPanel() {
    const opts = Store.getState().filterOptions;
    const filters = Store.getState().filters;

    function sel(id, key, options, label) {
      const current = filters[key] || '';
      const optHtml = ['<option value="">All ' + label + '</option>',
        ...options.map(o => `<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`)
      ].join('');
      return `<div class="filter-group">
        <label class="filter-label">${label}</label>
        <select class="filter-select" id="filter-${id}" data-filter="${key}">${optHtml}</select>
      </div>`;
    }

    const html = `
      <div class="filter-panel-inner">
        <div class="filter-panel-header">
          <span class="filter-panel-title">🔽 Global Filters</span>
          <button class="btn btn-xs btn-ghost" id="btn-clear-filters">Clear All</button>
        </div>
        <div class="filter-grid">
          ${sel('zone', 'zone', opts.zones, 'Zone')}
          ${sel('brand', 'brand', opts.brands, 'Brand')}
          ${sel('supplier', 'supplier', opts.suppliers, 'Supplier')}
          ${sel('hotel', 'hotel', opts.hotels, 'Hotel')}
          ${sel('category', 'category', opts.categories, 'Category')}
          ${sel('bottle-size', 'bottleSize', opts.bottleSizes, 'Bottle Size')}
          ${sel('alcohol-type', 'alcoholType', opts.alcoholTypes, 'Alcohol Type')}
          <div class="filter-group filter-date-group">
            <label class="filter-label">Date From</label>
            <input type="date" class="filter-input" id="filter-date-from" data-filter="dateFrom" value="${filters.dateRange?.from || ''}">
          </div>
          <div class="filter-group filter-date-group">
            <label class="filter-label">Date To</label>
            <input type="date" class="filter-input" id="filter-date-to" data-filter="dateTo" value="${filters.dateRange?.to || ''}">
          </div>
        </div>
        <div class="filter-active-tags" id="filter-tags"></div>
      </div>`;

    const panel = document.getElementById('filter-panel');
    if (panel) { panel.innerHTML = html; bindFilterEvents(panel); }
  }

  function bindFilterEvents(panel) {
    // Dropdowns
    panel.querySelectorAll('.filter-select').forEach(el => {
      el.addEventListener('change', (e) => {
        Store.setFilter(e.target.dataset.filter, e.target.value || null);
        updateFilterTags();
      });
    });

    // Date inputs
    const dateFrom = panel.querySelector('#filter-date-from');
    const dateTo = panel.querySelector('#filter-date-to');
    if (dateFrom) dateFrom.addEventListener('change', () => {
      Store.setFilter('dateRange', { from: dateFrom.value || null, to: dateTo?.value || null });
      updateFilterTags();
    });
    if (dateTo) dateTo.addEventListener('change', () => {
      Store.setFilter('dateRange', { from: dateFrom?.value || null, to: dateTo.value || null });
      updateFilterTags();
    });

    // Clear all
    const clearBtn = document.getElementById('btn-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      Store.clearFilters();
      renderFilterPanel();
    });

    updateFilterTags();
  }

  function updateFilterTags() {
    const filters = Store.getState().filters;
    const tags = [];
    const skipKeys = ['searchQuery', 'dateRange'];
    Object.entries(filters).forEach(([k, v]) => {
      if (skipKeys.includes(k)) return;
      if (v && v !== null) tags.push({ key: k, value: v });
    });
    if (filters.dateRange?.from || filters.dateRange?.to) {
      tags.push({ key: 'date', value: `${filters.dateRange.from || '*'} → ${filters.dateRange.to || '*'}` });
    }

    const tagsContainer = document.getElementById('filter-tags');
    if (tagsContainer) {
      tagsContainer.innerHTML = tags.map(t =>
        `<span class="filter-tag">${t.value} <button class="tag-remove" data-key="${t.key}">×</button></span>`
      ).join('');
      tagsContainer.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.key;
          if (key === 'date') Store.setFilter('dateRange', { from: null, to: null });
          else Store.setFilter(key, null);
          renderFilterPanel();
        });
      });
    }

    // Update filter count badge
    const badge = document.getElementById('filter-count-badge');
    if (badge) {
      badge.textContent = tags.length || '';
      badge.style.display = tags.length ? 'inline-flex' : 'none';
    }
  }

  // ─── Apply Filters to Data ────────────────────────────────────────────────

  function applyToInventory(inv) {
    return Store.applyFilters(inv, {
      zoneKey: 'zone', brandKey: 'brand', supplierKey: 'supplier',
      categoryKey: 'category', bottleSizeKey: 'bottle_size', alcoholTypeKey: 'alcohol_type',
      skuKey: 'sku_id', dateKey: 'last_received_date',
    });
  }

  function applyToOrders(orders) {
    return Store.applyFilters(orders, {
      hotelKey: 'hotel_name', brandKey: 'brand', categoryKey: 'category',
      bottleSizeKey: 'bottle_size', dateKey: 'order_date',
    });
  }

  function applyToDispatch(dispatch) {
    return Store.applyFilters(dispatch, {
      hotelKey: 'hotel_name', brandKey: 'brand', categoryKey: 'category', dateKey: 'dispatch_date',
    });
  }

  // ─── Toggle Filter Panel ──────────────────────────────────────────────────

  function togglePanel() {
    const panel = document.getElementById('filter-panel');
    const isOpen = Store.getState().filterPanelOpen;
    Store.set('filterPanelOpen', !isOpen);
    if (panel) panel.classList.toggle('filter-panel-open', !isOpen);
    const btn = document.getElementById('btn-filters');
    if (btn) btn.classList.toggle('active', !isOpen);
  }

  // ─── Initialize ───────────────────────────────────────────────────────────

  function init() {
    EventBus.on(Events.DATA_LOADED, renderFilterPanel);
  }

  init();

  return { renderFilterPanel, applyToInventory, applyToOrders, applyToDispatch, togglePanel, updateFilterTags };
})();
