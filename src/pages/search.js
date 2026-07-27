/**
 * GovSpirit Global search.
 *
 * Matching is token-AND across a precomputed corpus. Results are announced
 * through a live region and rendered with escaped highlighting: the previous
 * implementation injected matched substrings of user data straight into
 * innerHTML, so a SKU name containing markup executed on every keystroke.
 */
(function initSearchPage(GovSpirit) {
  'use strict';

  const { Html, Icons, Format, Collections, Store, Components, Dom } = GovSpirit.require(
    'Html',
    'Icons',
    'Format',
    'Collections',
    'Store',
    'Components',
    'Dom'
  );

  const { html, setHTML, highlight } = Html;
  const { pageHeader, emptyState } = Components;

  const MAX_RESULTS = 60;

  let corpus = [];
  let disposers = [];

  function buildCorpus() {
    const inventory = Store.inventory();
    const orders = Store.orders();
    const dispatch = Store.dispatch();

    const entries = [];

    inventory.forEach((row) => {
      entries.push({
        type: 'Inventory',
        icon: 'package',
        label: row.sku_name || row.sku_id,
        detail: `${row.brand} · ${row.bottle_size} · Zone ${row.zone} · rack ${row.rack_id} · ${Format.number(row.quantity_bottles)} bottles`,
        page: 'inventory',
      });
    });

    // One entry per customer, aggregated, rather than one per order line.
    Object.entries(Collections.groupBy(orders, 'hotel_name')).forEach(([hotel, lines]) => {
      if (!hotel || hotel === '__unkeyed__') return;
      entries.push({
        type: 'Customer',
        icon: 'building',
        label: hotel,
        detail: `${Collections.countDistinct(lines, 'order_id')} orders · ${Format.currency(
          Collections.sumBy(lines, 'order_value')
        )} · ${Format.number(Collections.sumBy(lines, 'quantity_ordered'))} bottles ordered`,
        page: 'hotels',
      });
    });

    dispatch.slice(0, 4000).forEach((row) => {
      entries.push({
        type: 'Dispatch',
        icon: 'truck',
        label: row.dispatch_id,
        detail: `${row.hotel_name} · ${row.sku_name} · ${Format.formatDate(row.dispatch_date)}`,
        page: 'dispatch',
      });
    });

    // Precompute the lowercase haystack once; filtering then costs no allocation.
    return entries.map((entry) => ({
      ...entry,
      haystack: `${entry.label} ${entry.detail} ${entry.type}`.toLowerCase(),
    }));
  }

  function render() {
    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Search',
          subtitle: 'Across inventory, customers and dispatch records',
        })}

        <div class="search-field">
          ${Icons.render('search', { size: 19 })}
          <label class="visually-hidden" for="search-input">Search warehouse data</label>
          <input
            type="search"
            id="search-input"
            placeholder="SKU, brand, customer, rack, dispatch reference…"
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div id="search-status" class="visually-hidden" role="status" aria-live="polite"></div>
        <div id="search-results" class="search-results">
          ${emptyState({
            title: 'Start typing to search',
            body: 'Every loaded record is searchable. Results update as you type.',
            icon: 'search',
          })}
        </div>
      </div>
    `;
  }

  function runSearch(query) {
    const container = Dom.byId('search-results');
    const status = Dom.byId('search-status');
    const trimmed = query.trim();

    if (!trimmed) {
      setHTML(
        container,
        emptyState({
          title: 'Start typing to search',
          body: 'Every loaded record is searchable. Results update as you type.',
          icon: 'search',
        })
      );
      if (status) status.textContent = '';
      return;
    }

    const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = [];
    for (const entry of corpus) {
      if (tokens.every((token) => entry.haystack.includes(token))) {
        matches.push(entry);
        if (matches.length >= MAX_RESULTS) break;
      }
    }

    if (status) {
      status.textContent = matches.length
        ? `${matches.length}${matches.length === MAX_RESULTS ? ' or more' : ''} results for ${trimmed}`
        : `No results for ${trimmed}`;
    }

    if (!matches.length) {
      setHTML(
        container,
        emptyState({
          title: `No matches for “${trimmed}”`,
          body: 'Try a shorter term, or check that the relevant dataset was loaded.',
          icon: 'search',
        })
      );
      return;
    }

    setHTML(
      container,
      html`
        <p class="search-count">
          ${matches.length}${matches.length === MAX_RESULTS ? '+' : ''} results
        </p>
        ${matches.map(
          (entry) => html`
            <button type="button" class="search-result" data-navigate="${entry.page}">
              ${Icons.render(entry.icon, { size: 18 })}
              <span class="search-result-body">
                <span class="search-result-label">${highlight(entry.label, trimmed)}</span>
                <span class="search-result-detail">${highlight(entry.detail, trimmed)}</span>
              </span>
              <span class="search-result-kind">${entry.type}</span>
            </button>
          `
        )}
      `
    );
  }

  function mount(context = {}) {
    corpus = buildCorpus();

    const input = Dom.byId('search-input');
    if (!input) return;

    const search = Dom.debounce((value) => runSearch(value), 180);
    disposers.push(Dom.on(input, 'input', (event) => search(event.target.value)));
    disposers.push(
      Dom.on(input, 'keydown', (event) => {
        if (event.key === 'Escape') {
          input.value = '';
          runSearch('');
        }
      })
    );

    // A term handed over from the topbar shortcut runs immediately.
    if (context.query) {
      input.value = context.query;
      runSearch(context.query);
    }

    // Avoid stealing focus on touch devices, where it forces the keyboard open.
    if (!Dom.isTouch()) input.focus();
  }

  function unmount() {
    disposers.forEach((dispose) => dispose());
    disposers = [];
    corpus = [];
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.search = { title: 'Search', render, mount, unmount };
})(window.GovSpirit);
