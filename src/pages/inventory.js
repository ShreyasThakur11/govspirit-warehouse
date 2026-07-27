/**
 * GovSpirit Inventory analytics: ABC, XYZ, movement class and Pareto.
 */
(function initInventoryPage(GovSpirit) {
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

  const { html, styleAttr } = Html;
  const { metricCard, chartPanel, panel, pageHeader, dataTable } = Components;

  const ABC_META = [
    { key: 'A', label: 'Class A', color: '#10b981', desc: 'Top 80% of inventory value' },
    { key: 'B', label: 'Class B', color: '#f59e0b', desc: 'Next 15% of value' },
    { key: 'C', label: 'Class C', color: '#f43f5e', desc: 'Final 5% of value' },
  ];

  function render() {
    const kpis = Store.kpis();
    const classifications = Store.getState().classifications;

    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Inventory analytics',
          subtitle: 'Value concentration, demand stability and movement classification',
          actions: html`
            <button type="button" class="btn btn-secondary btn-sm" id="btn-export-classification">
              Export classification
            </button>
          `,
        })}

        <div class="metric-grid">
          ${metricCard({
            id: 'inv-skus',
            title: 'Total SKUs',
            value: Format.number(kpis.totalSKUs),
            subtitle: `${Format.number(kpis.activeSKUs)} holding stock`,
            icon: 'tag',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'inv-value2',
            title: 'Inventory value',
            value: Format.currency(kpis.inventoryValue),
            subtitle: `${Format.compact(kpis.totalBottles)} bottles`,
            icon: 'banknote',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'inv-cases',
            title: 'Case equivalent',
            value: Format.compact(kpis.totalCases),
            subtitle: 'At 12 bottles per case',
            icon: 'package',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'inv-concentration',
            title: 'Value concentration',
            value: Format.percent(kpis.stockConcentration),
            subtitle: 'Share held by the top 10% of lines',
            icon: 'alertTriangle',
            tone: kpis.stockConcentration > 60 ? 'critical' : 'caution',
          })}
        </div>

        <h2 class="section-heading">ABC classification</h2>
        <div class="class-grid">
          ${ABC_META.map(
            (meta) => html`
              <article class="class-card" ${styleAttr({ '--class-colour': meta.color })}>
                <p class="class-name">${meta.label}</p>
                <p class="class-count">
                  ${Format.number(classifications.abcCounts?.[meta.key] || 0)} SKUs
                </p>
                <p class="class-value">
                  ${Format.currency(classifications.abcValues?.[meta.key] || 0)}
                </p>
                <p class="class-definition">${meta.desc}</p>
              </article>
            `
          )}
        </div>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-pareto',
            title: 'Pareto analysis',
            subtitle: 'SKUs ranked by value, with cumulative share',
            summary: 'Bar chart of SKU value with a cumulative percentage line.',
            tall: true,
          })}
          ${chartPanel({
            id: 'chart-movement',
            title: 'Movement classification',
            subtitle: 'Fast, slow and dead SKUs by dispatch frequency',
            summary: `Fast ${classifications.movementCounts?.Fast || 0}, slow ${classifications.movementCounts?.Slow || 0}, dead ${classifications.movementCounts?.Dead || 0}.`,
            tall: true,
          })}
        </div>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-xyz',
            title: 'XYZ demand variability',
            subtitle: 'X stable · Y variable · Z sporadic or unknown',
            summary: `X ${classifications.xyzCounts?.X || 0}, Y ${classifications.xyzCounts?.Y || 0}, Z ${classifications.xyzCounts?.Z || 0}.`,
          })}
          ${chartPanel({
            id: 'chart-size-mix',
            title: 'Stock by bottle size',
            subtitle: 'Bottles held per pack size',
            summary: 'Distribution of held bottles across pack sizes.',
          })}
        </div>

        ${panel({
          title: 'Most dispatched SKUs',
          subtitle: 'Ranked by bottles shipped over the loaded period',
          actions: html`<button
            type="button"
            class="btn btn-sm btn-secondary"
            id="btn-export-top-skus"
          >
            Export
          </button>`,
          body: dataTable({
            rows: kpis.topSKUs || [],
            caption: 'Top SKUs by dispatched volume',
            columns: [
              { key: 'sku_name', label: 'SKU' },
              { key: 'brand', label: 'Brand' },
              { key: 'category', label: 'Category' },
              {
                key: 'qty_dispatched',
                label: 'Bottles out',
                numeric: true,
                format: (v) => Format.number(v),
              },
              {
                key: 'dispatch_count',
                label: 'Dispatches',
                numeric: true,
                format: (v) => Format.number(v),
              },
              {
                key: 'dispatch_value',
                label: 'Value',
                numeric: true,
                format: (v) => Format.currency(v),
              },
            ],
          }),
        })}
      </div>
    `;
  }

  function mount() {
    const kpis = Store.kpis();
    const classifications = Store.getState().classifications;
    const inventory = FilterManager.applyToInventory(Store.inventory());

    const pareto = classifications.pareto || [];
    if (pareto.length) {
      Charts.create(
        'chart-pareto',
        {
          data: {
            labels: pareto.map((p) => p.sku_name || p.sku_id),
            datasets: [
              {
                type: 'bar',
                label: 'Inventory value',
                data: pareto.map((p) => p.value),
                backgroundColor: pareto.map((p) => Charts.alpha(Charts.abcColor(p.abc_class), 0.8)),
                borderRadius: 3,
                yAxisID: 'y',
                order: 2,
              },
              {
                type: 'line',
                label: 'Cumulative share',
                data: pareto.map((p) => p.cumulative_pct),
                borderColor: '#f59e0b',
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 12,
                tension: 0.2,
                yAxisID: 'y1',
                order: 1,
              },
            ],
          },
          options: {
            scales: {
              y1: {
                position: 'right',
                min: 0,
                max: 100,
                grid: { drawOnChartArea: false },
                border: { display: false },
                ticks: { callback: (v) => `${v}%` },
              },
            },
          },
        },
        { preset: { legend: true, currencyAxis: true }, label: 'Pareto chart of SKU value' }
      );
    }

    const movement = classifications.movementCounts || {};
    if (movement.Fast || movement.Slow || movement.Dead) {
      Charts.create(
        'chart-movement',
        {
          type: 'doughnut',
          data: {
            labels: ['Fast moving', 'Slow moving', 'Dead'],
            datasets: [
              {
                data: [movement.Fast || 0, movement.Slow || 0, movement.Dead || 0],
                backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
                borderWidth: 0,
                hoverOffset: 8,
              },
            ],
          },
          options: { cutout: '60%' },
        },
        {
          preset: { noScales: true, legend: true, legendPos: 'right' },
          label: 'Movement classification split',
        }
      );
    }

    const xyz = classifications.xyzCounts || {};
    Charts.create(
      'chart-xyz',
      {
        type: 'bar',
        data: {
          labels: ['X stable', 'Y variable', 'Z sporadic'],
          datasets: [
            {
              label: 'SKUs',
              data: [xyz.X || 0, xyz.Y || 0, xyz.Z || 0],
              backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
              borderRadius: 5,
            },
          ],
        },
      },
      { label: 'SKU count by demand variability class' }
    );

    const bySize = Collections.groupBy(inventory, 'bottle_size');
    const sizes = Object.keys(bySize);
    if (sizes.length) {
      Charts.create(
        'chart-size-mix',
        {
          type: 'doughnut',
          data: {
            labels: sizes,
            datasets: [
              {
                data: sizes.map((size) => Collections.sumBy(bySize[size], 'quantity_bottles')),
                backgroundColor: sizes.map((_, i) => Charts.color(i)),
                borderWidth: 0,
                hoverOffset: 8,
              },
            ],
          },
          options: { cutout: '60%' },
        },
        {
          preset: { noScales: true, legend: true, legendPos: 'right' },
          label: 'Bottles held by pack size',
        }
      );
    }

    document.getElementById('btn-export-classification')?.addEventListener('click', () => {
      Exporters.downloadCSV(classifications.items || [], 'sku-classification');
    });
    document.getElementById('btn-export-top-skus')?.addEventListener('click', () => {
      Exporters.downloadCSV(kpis.topSKUs || [], 'top-skus');
    });
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.inventory = { title: 'Inventory', render, mount };
})(window.GovSpirit);
