/**
 * GovSpirit Brand and supplier analytics.
 */
(function initBrandSupplierPage(GovSpirit) {
  'use strict';

  const { Html, Format, Collections, Store, Components, Charts, FilterManager, Exporters } =
    GovSpirit.require(
      'Html',
      'Format',
      'Collections',
      'Store',
      'Components',
      'Charts',
      'FilterManager',
      'Exporters'
    );

  const { html } = Html;
  const { metricCard, chartPanel, panel, pageHeader, dataTable } = Components;

  function render() {
    const kpis = Store.kpis();
    const inventory = FilterManager.applyToInventory(Store.inventory());

    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Brand and supplier analytics',
          subtitle: 'Where the value sits and who supplies it',
          actions: html`<button
            type="button"
            class="btn btn-secondary btn-sm"
            id="btn-export-brands"
          >
            Export brands
          </button>`,
        })}

        <div class="metric-grid">
          ${metricCard({
            id: 'bs-brands',
            title: 'Distinct brands',
            value: Format.number(Collections.countDistinct(inventory, 'brand')),
            subtitle: 'Currently holding stock',
            icon: 'tag',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'bs-suppliers',
            title: 'Suppliers',
            value: Format.number(Collections.countDistinct(inventory, 'supplier')),
            subtitle: 'Named on inventory records',
            icon: 'factory',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'bs-top-brand',
            title: 'Largest brand by value',
            value: kpis.topBrands?.[0]?.brand || 'N/A',
            subtitle: kpis.topBrands?.[0] ? Format.currency(kpis.topBrands[0].value) : 'No data',
            icon: 'trendingUp',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'bs-categories',
            title: 'Categories',
            value: Format.number(Collections.countDistinct(inventory, 'category')),
            subtitle: 'Product families held',
            icon: 'layers',
            tone: 'accent',
          })}
        </div>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-brand-value',
            title: 'Brands by inventory value',
            subtitle: 'Capital held per brand',
            summary: (kpis.topBrands || [])
              .slice(0, 5)
              .map((b) => `${b.brand} ${Format.currency(b.value)}`)
              .join(', '),
            tall: true,
          })}
          ${chartPanel({
            id: 'chart-supplier-value',
            title: 'Suppliers by inventory value',
            subtitle: 'Exposure per supplier',
            summary: (kpis.topSuppliers || [])
              .slice(0, 5)
              .map((s) => `${s.supplier} ${Format.currency(s.value)}`)
              .join(', '),
            tall: true,
          })}
        </div>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-category-mix',
            title: 'Category mix',
            subtitle: 'Share of inventory value',
            summary: 'Doughnut chart of inventory value by category.',
          })}
          ${chartPanel({
            id: 'chart-brand-throughput',
            title: 'Brand throughput',
            subtitle: 'Bottles dispatched per brand',
            summary: 'Bar chart of dispatched volume by brand.',
          })}
        </div>

        ${panel({
          title: 'Brand performance',
          body: dataTable({
            rows: kpis.topBrands || [],
            caption: 'Inventory value, volume and SKU count by brand',
            columns: [
              { key: 'brand', label: 'Brand' },
              { key: 'skus', label: 'SKUs', numeric: true, format: (v) => Format.number(v) },
              { key: 'qty', label: 'Bottles', numeric: true, format: (v) => Format.number(v) },
              { key: 'value', label: 'Value', numeric: true, format: (v) => Format.currency(v) },
            ],
          }),
        })}
        ${panel({
          title: 'Supplier exposure',
          body: dataTable({
            rows: kpis.topSuppliers || [],
            caption: 'Inventory value, volume and SKU count by supplier',
            columns: [
              { key: 'supplier', label: 'Supplier' },
              { key: 'skus', label: 'SKUs', numeric: true, format: (v) => Format.number(v) },
              { key: 'qty', label: 'Bottles', numeric: true, format: (v) => Format.number(v) },
              { key: 'value', label: 'Value', numeric: true, format: (v) => Format.currency(v) },
            ],
          }),
        })}
      </div>
    `;
  }

  function mount() {
    const kpis = Store.kpis();
    const dispatch = FilterManager.applyToDispatch(Store.dispatch());

    const bar = (id, rows, labelKey, valueKey, label, horizontal) => {
      if (!rows.length) return;
      Charts.create(
        id,
        {
          type: 'bar',
          data: {
            labels: rows.map((r) => r[labelKey]),
            datasets: [
              {
                label,
                data: rows.map((r) => r[valueKey]),
                backgroundColor: rows.map((_, i) => Charts.alpha(Charts.color(i), 0.85)),
                borderRadius: 5,
              },
            ],
          },
        },
        { preset: { horizontal, currencyAxis: valueKey === 'value' }, label }
      );
    };

    bar(
      'chart-brand-value',
      (kpis.topBrands || []).slice(0, 10),
      'brand',
      'value',
      'Inventory value',
      true
    );
    bar(
      'chart-supplier-value',
      (kpis.topSuppliers || []).slice(0, 8),
      'supplier',
      'value',
      'Inventory value',
      true
    );

    const categories = kpis.topCategories || [];
    if (categories.length) {
      Charts.create(
        'chart-category-mix',
        {
          type: 'doughnut',
          data: {
            labels: categories.map((c) => c.category),
            datasets: [
              {
                data: categories.map((c) => c.value),
                backgroundColor: categories.map((_, i) => Charts.color(i)),
                borderWidth: 0,
                hoverOffset: 8,
              },
            ],
          },
          options: { cutout: '58%' },
        },
        {
          preset: { noScales: true, legend: true, legendPos: 'right' },
          label: 'Inventory value by category',
        }
      );
    }

    const throughput = Object.entries(Collections.groupBy(dispatch, 'brand'))
      .map(([brand, rows]) => ({ brand, qty: Collections.sumBy(rows, 'quantity_dispatched') }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    bar('chart-brand-throughput', throughput, 'brand', 'qty', 'Bottles dispatched', false);

    document.getElementById('btn-export-brands')?.addEventListener('click', () => {
      Exporters.downloadCSV(kpis.topBrands || [], 'brands');
    });
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.brandSupplier = { title: 'Brand & supplier', render, mount };
})(window.GovSpirit);
