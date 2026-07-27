/**
 * GovSpirit Stock aging, dead stock, damage and returns.
 */
(function initStockAgingPage(GovSpirit) {
  'use strict';

  const { Html, Format, Store, Components, Charts, Exporters } = GovSpirit.require(
    'Html',
    'Format',
    'Store',
    'Components',
    'Charts',
    'Exporters'
  );

  const { html } = Html;
  const { metricCard, chartPanel, panel, pageHeader, dataTable } = Components;

  function render() {
    const kpis = Store.kpis();
    const aging = Store.getState().aging;

    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Stock aging and losses',
          subtitle: 'Dwell time, dead stock, breakage and returns',
          actions: html`<button type="button" class="btn btn-danger btn-sm" id="btn-export-dead">
            Export dead stock
          </button>`,
        })}

        <div class="metric-grid">
          ${metricCard({
            id: 'age-dead',
            title: 'Dead stock lines',
            value: Format.number(aging.deadStockTotal || 0),
            subtitle: Format.currency(aging.totalDeadValue || 0),
            icon: 'archiveX',
            tone: 'critical',
          })}
          ${metricCard({
            id: 'age-avg',
            title: 'Average dwell',
            value: kpis.avgStorageDays === null ? 'N/A' : `${Math.round(kpis.avgStorageDays)} days`,
            subtitle: 'Across every line held',
            icon: 'calendar',
            tone: 'caution',
          })}
          ${metricCard({
            id: 'age-damage',
            title: 'Damaged units',
            value: Format.number(kpis.totalDamaged),
            subtitle: Format.currency(kpis.damageValue),
            icon: 'alertOctagon',
            tone: 'critical',
          })}
          ${metricCard({
            id: 'age-returns',
            title: 'Returned units',
            value: Format.number(kpis.totalReturned),
            subtitle: Format.currency(kpis.returnValue),
            icon: 'rotateBack',
            tone: 'caution',
          })}
        </div>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-aging',
            title: 'Aging distribution',
            subtitle: 'Lines grouped by days held',
            summary: (aging.agingBuckets || [])
              .map((b) => `${b.range} days: ${b.count} lines`)
              .join(', '),
          })}
          ${chartPanel({
            id: 'chart-dead-brand',
            title: 'Dead stock by brand',
            subtitle: 'Where the stalled capital sits',
            summary: 'Bar chart of dead stock value by brand.',
          })}
        </div>

        ${panel({
          title: 'Dead stock, 90 days without movement',
          subtitle: 'Sorted oldest first',
          body: dataTable({
            rows: aging.deadStock || [],
            caption: 'Inventory lines with no dispatch activity for 90 days or more',
            maxRows: 80,
            columns: [
              { key: 'sku_name', label: 'SKU' },
              { key: 'brand', label: 'Brand' },
              { key: 'zone', label: 'Zone' },
              { key: 'rack_id', label: 'Rack' },
              {
                key: 'quantity_bottles',
                label: 'Bottles',
                numeric: true,
                format: (v) => Format.number(v),
              },
              {
                key: 'total_value',
                label: 'Value',
                numeric: true,
                format: (v) => Format.currency(v),
              },
              {
                key: 'days_in_stock',
                label: 'Days held',
                numeric: true,
                format: (v) =>
                  html`<span style="color:var(--danger-fg);font-weight:700">${v}</span>`,
              },
              {
                key: 'risk',
                label: 'Risk',
                format: (v) => Components.status(v, v === 'High' ? 'danger' : 'warning'),
              },
            ],
          }),
        })}

        <div class="panel-grid-2 mt-2">
          ${panel({
            title: 'Damage register',
            body: dataTable({
              rows: aging.damage || [],
              caption: 'Recorded breakage and damage events',
              maxRows: 40,
              emptyTitle: 'No damage register uploaded',
              columns: [
                { key: 'damage_date', label: 'Date', format: (v) => Format.formatDate(v) },
                { key: 'sku_name', label: 'SKU' },
                {
                  key: 'quantity_damaged',
                  label: 'Units',
                  numeric: true,
                  format: (v) => Format.number(v),
                },
                {
                  key: 'damage_value',
                  label: 'Value',
                  numeric: true,
                  format: (v) => Format.currency(v),
                },
                { key: 'cause', label: 'Cause' },
              ],
            }),
          })}
          ${panel({
            title: 'Returns log',
            body: dataTable({
              rows: aging.returns || [],
              caption: 'Stock returned by customers',
              maxRows: 40,
              emptyTitle: 'No returns data uploaded',
              columns: [
                { key: 'return_date', label: 'Date', format: (v) => Format.formatDate(v) },
                { key: 'hotel_name', label: 'Customer' },
                { key: 'sku_name', label: 'SKU' },
                {
                  key: 'quantity_returned',
                  label: 'Units',
                  numeric: true,
                  format: (v) => Format.number(v),
                },
                { key: 'reason', label: 'Reason' },
              ],
            }),
          })}
        </div>
      </div>
    `;
  }

  function mount() {
    const aging = Store.getState().aging;

    const buckets = aging.agingBuckets || [];
    if (buckets.length) {
      Charts.create(
        'chart-aging',
        {
          type: 'bar',
          data: {
            labels: buckets.map((b) => `${b.range} days`),
            datasets: [
              {
                label: 'Inventory lines',
                data: buckets.map((b) => b.count),
                backgroundColor: buckets.map((b) => Charts.alpha(b.tone, 0.85)),
                borderRadius: 5,
              },
            ],
          },
        },
        { label: 'Inventory lines grouped by days held' }
      );
    }

    const deadByBrand = (aging.deadStockByBrand || []).slice(0, 10);
    if (deadByBrand.length) {
      Charts.create(
        'chart-dead-brand',
        {
          type: 'bar',
          data: {
            labels: deadByBrand.map((b) => b.brand),
            datasets: [
              {
                label: 'Dead stock value',
                data: deadByBrand.map((b) => b.value),
                backgroundColor: Charts.alpha('#f43f5e', 0.85),
                borderRadius: 4,
              },
            ],
          },
        },
        { preset: { horizontal: true, currencyAxis: true }, label: 'Dead stock value by brand' }
      );
    }

    document.getElementById('btn-export-dead')?.addEventListener('click', () => {
      Exporters.downloadCSV(aging.deadStock || [], 'dead-stock');
    });
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.stockAging = { title: 'Stock aging', render, mount };
})(window.GovSpirit);
