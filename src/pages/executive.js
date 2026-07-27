/**
 * GovSpirit Executive summary.
 */
(function initExecutivePage(GovSpirit) {
  'use strict';

  const { Html, Icons, Format, Store, Components, Charts } = GovSpirit.require(
    'Html',
    'Icons',
    'Format',
    'Store',
    'Components',
    'Charts'
  );

  const { html, styleAttr } = Html;
  const { metricCard, chartPanel, panel, pageHeader, finding, emptyState } = Components;

  const RING_CIRCUMFERENCE = 2 * Math.PI * 42;

  function healthTone(score) {
    if (score === null) return { color: 'var(--text-muted)', label: 'Not enough data' };
    if (score >= 80) return { color: 'var(--success-fg)', label: 'Healthy' };
    if (score >= 60) return { color: 'var(--warning-fg)', label: 'Watch closely' };
    return { color: 'var(--danger-fg)', label: 'Needs attention' };
  }

  /** Standing notice when order history was projected rather than supplied. */
  function provenanceNotice() {
    const source = Store.getState().dataSource || '';
    if (!source.includes('projected')) return '';
    return html`
      <div class="notice mb-3">
        ${Icons.render('ruler', { size: 18 })}
        <div>
          <p class="notice-title">Order history is projected, not measured</p>
          <p class="notice-body">
            Your file supplied stock on hand. Order, dispatch and fulfilment figures below are
            modelled from the 12-month reference sales curve so the trends have something to plot.
            Upload an orders or dispatch export to replace them with real history.
          </p>
        </div>
      </div>
    `;
  }

  function healthBanner(kpis, recommendations) {
    const score = kpis.warehouseHealthScore;
    const tone = healthTone(score);
    const dash = score === null ? 0 : (score / 100) * RING_CIRCUMFERENCE;

    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0 };
    recommendations.forEach((rec) => {
      if (counts[rec.priority] !== undefined) counts[rec.priority] += 1;
    });

    const component = (label, value, suffix = '%') =>
      html`<li class="health-input">
        ${label}: ${value === null ? 'no data' : `${value}${suffix}`}
      </li>`;

    return html`
      <section class="health-panel" aria-labelledby="health-heading">
        <div class="health-dial">
          <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" stroke-width="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="${tone.color}"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray="${dash} ${RING_CIRCUMFERENCE}"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div class="health-readout">
            <span class="health-score" ${styleAttr({ color: tone.color })}>
              ${score === null ? 'N/A' : Math.round(score)}
            </span>
            <span class="health-scale">of 100</span>
          </div>
        </div>

        <div>
          <h2 class="health-title" id="health-heading">Warehouse health score</h2>
          <p class="health-verdict" ${styleAttr({ color: tone.color })}>${tone.label}</p>
          <ul class="health-inputs">
            ${component('Inventory accuracy', kpis.inventoryAccuracy)}
            ${component('Fill rate', kpis.fillRate)}
            ${component('Storage utilisation', kpis.storageUtilization)}
            ${component('Pick accuracy', kpis.avgPickAccuracy)}
          </ul>
          ${
            score !== null && kpis.healthComponents?.length < 5
              ? html`<p class="notice-body mt-2">
                  Scored on ${kpis.healthComponents.length} of 5 components; the rest have no
                  supporting data.
                </p>`
              : ''
          }
        </div>

        <div class="health-alerts">
          ${
            counts.CRITICAL
              ? html`<p class="health-alert health-alert--critical">
                  ${Icons.render('alertOctagon', { size: 15 })} ${counts.CRITICAL} critical
                </p>`
              : ''
          }
          ${
            counts.HIGH
              ? html`<p class="health-alert health-alert--high">
                  ${Icons.render('alertTriangle', { size: 15 })} ${counts.HIGH} high priority
                </p>`
              : ''
          }
          ${
            counts.MEDIUM
              ? html`<p class="health-alert health-alert--medium">
                  ${Icons.render('lightbulb', { size: 15 })} ${counts.MEDIUM} opportunities
                </p>`
              : ''
          }
        </div>
      </section>
    `;
  }

  function insights(kpis, recommendations) {
    const rows = [];

    if (kpis.deadStockCount > 0) {
      rows.push({
        tone: 'warning',
        icon: 'archiveX',
        title: 'Dead stock is tying up space',
        body: `${Format.number(kpis.deadStockCount)} lines with no movement in 90 days, worth ${Format.currency(kpis.deadStockValue)}.`,
      });
    }
    if (kpis.storageUtilization !== null && kpis.storageUtilization > 80) {
      rows.push({
        tone: 'critical',
        icon: 'gauge',
        title: 'Storage is running tight',
        body: `Warehouse is at ${Format.percent(kpis.storageUtilization)} of capacity${
          kpis.storageUtilizationEstimated ? ' (capacity estimated, no layout file supplied)' : ''
        }.`,
      });
    }
    if (kpis.fillRate !== null && kpis.fillRate < 90) {
      rows.push({
        tone: 'warning',
        icon: 'barChart',
        title: 'Fill rate below target',
        body: `${Format.percent(kpis.fillRate)} of lines shipped complete, with ${Format.number(kpis.pendingOrders)} orders still open.`,
      });
    }
    if (kpis.avgDispatchTime !== null && kpis.avgDispatchTime > 60) {
      rows.push({
        tone: 'warning',
        icon: 'timer',
        title: 'Dispatch cycle is slow',
        body: `Averaging ${Format.minutes(kpis.avgDispatchTime)} from pick to load.`,
      });
    }
    if (kpis.inventoryAccuracy === null) {
      rows.push({
        tone: 'info',
        icon: 'hash',
        title: 'No cycle count on file',
        body: 'Inventory accuracy cannot be reported until a physical count is uploaded.',
      });
    } else if (kpis.inventoryAccuracy >= 98) {
      rows.push({
        tone: 'success',
        icon: 'checkCircle',
        title: 'Inventory accuracy is strong',
        body: `${Format.percent(kpis.inventoryAccuracy)} of counted lines matched the system.`,
      });
    }
    if (recommendations.length) {
      rows.push({
        tone: 'info',
        icon: 'lightbulb',
        title: 'Recommendations ready',
        body: `${recommendations.length} prioritised actions are waiting on the recommendations page.`,
      });
    }

    if (!rows.length) {
      return emptyState({
        title: 'Nothing needs attention',
        body: 'No thresholds were breached in this dataset.',
        icon: 'checkCircle',
      });
    }

    return html`<ul class="finding-list">
      ${rows.map(finding)}
    </ul>`;
  }

  function render() {
    const state = Store.getState();
    const kpis = state.kpis;
    const recommendations = state.recommendations;

    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Executive summary',
          subtitle: `Warehouse operations at a glance${state.dataSource ? ` · ${state.dataSource}` : ''}`,
          actions: html`
            <button type="button" class="btn btn-secondary btn-sm" data-navigate="recommendations">
              ${Icons.render('lightbulb', { size: 15 })} ${recommendations.length} recommendations
            </button>
          `,
        })}
        ${provenanceNotice()} ${healthBanner(kpis, recommendations)}

        <div class="metric-grid">
          ${metricCard({
            id: 'inv-value',
            title: 'Inventory value',
            value: Format.currency(kpis.inventoryValue),
            subtitle: `${Format.compact(kpis.totalBottles)} bottles across ${Format.number(kpis.totalSKUs)} SKUs`,
            icon: 'banknote',
            tone: 'accent',
            spark: kpis.valueTrend,
          })}
          ${metricCard({
            id: 'utilisation',
            title: 'Storage utilisation',
            value: Format.percent(kpis.storageUtilization),
            subtitle: kpis.storageUtilizationEstimated
              ? 'Capacity estimated from observed racks'
              : `${Format.compact(kpis.occupiedBins)} of ${Format.compact(kpis.totalBins)} bins in use`,
            icon: 'warehouse',
            tone:
              kpis.storageUtilization > 85
                ? 'red'
                : kpis.storageUtilization > 65
                  ? 'amber'
                  : 'green',
          })}
          ${metricCard({
            id: 'fill-rate',
            title: 'Order fill rate',
            value: Format.percent(kpis.fillRate),
            subtitle: `${Format.compact(kpis.fulfilledLines)} of ${Format.compact(kpis.totalOrderLines)} lines complete`,
            icon: 'truck',
            tone: kpis.fillRate >= 90 ? 'green' : kpis.fillRate >= 75 ? 'amber' : 'red',
            spark: kpis.dispatchTrend,
          })}
          ${metricCard({
            id: 'orders-today',
            title: 'Orders today',
            value: Format.number(kpis.ordersToday),
            subtitle: `${Format.number(kpis.pendingOrders)} open · ${Format.number(kpis.completedOrders)} completed`,
            icon: 'listChecks',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'accuracy',
            title: 'Inventory accuracy',
            value: Format.percent(kpis.inventoryAccuracy),
            subtitle: kpis.cycleCountLines
              ? `From ${Format.number(kpis.cycleCountLines)} counted lines`
              : 'No cycle count uploaded',
            icon: 'target',
            tone:
              kpis.inventoryAccuracy === null
                ? 'indigo'
                : kpis.inventoryAccuracy >= 98
                  ? 'green'
                  : 'amber',
          })}
          ${metricCard({
            id: 'dead-stock',
            title: 'Dead stock lines',
            value: Format.number(kpis.deadStockCount),
            subtitle: `${Format.currency(kpis.deadStockValue)} of capital held`,
            icon: 'archiveX',
            tone: kpis.deadStockCount > 10 ? 'critical' : 'caution',
          })}
        </div>

        <div class="panel-grid-3">
          ${chartPanel({
            id: 'chart-dispatch-trend',
            title: '30-day activity',
            subtitle: 'Daily dispatches against orders received',
            summary: `Dispatch volume over the last 30 days, peaking at ${Math.max(0, ...(kpis.dispatchTrend || [0]))} in a day.`,
          })}
          ${chartPanel({
            id: 'chart-category',
            title: 'Inventory by category',
            subtitle: 'Share of held value',
            summary: (kpis.topCategories || [])
              .slice(0, 5)
              .map((c) => `${c.category} ${Format.currency(c.value)}`)
              .join(', '),
          })}
          ${chartPanel({
            id: 'chart-zone-exec',
            title: 'Zone utilisation',
            subtitle: 'Occupancy against capacity',
            summary: (Store.zones() || [])
              .map((z) => `Zone ${z.zone} ${z.utilization}%`)
              .join(', '),
          })}
        </div>

        <div class="panel-grid-2">
          ${panel({
            title: 'What needs attention',
            subtitle: 'Derived from the thresholds in the recommendation rules',
            body: insights(kpis, recommendations),
          })}
          ${chartPanel({
            id: 'chart-top-brands',
            title: 'Top brands by value',
            subtitle: 'Inventory value held per brand',
            summary: (kpis.topBrands || [])
              .slice(0, 5)
              .map((b) => `${b.brand} ${Format.currency(b.value)}`)
              .join(', '),
          })}
        </div>

        <div class="metric-grid">
          ${metricCard({
            id: 'dispatch-30',
            title: 'Dispatches (30 days)',
            value: Format.compact(kpis.last30DispatchCount),
            subtitle: Format.currency(kpis.last30DispatchValue),
            icon: 'truck',
            tone: 'accent',
            spark: kpis.dispatchTrend,
          })}
          ${metricCard({
            id: 'total-skus',
            title: 'Total SKUs',
            value: Format.number(kpis.totalSKUs),
            subtitle: `${Format.number(kpis.activeSKUs)} active · ${Format.number(kpis.inactiveSKUs)} idle`,
            icon: 'tag',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'avg-age',
            title: 'Average dwell time',
            value: kpis.avgStorageDays === null ? 'N/A' : `${Math.round(kpis.avgStorageDays)} days`,
            subtitle: 'Mean days held per line',
            icon: 'calendar',
            tone: 'caution',
          })}
          ${metricCard({
            id: 'dispatch-time',
            title: 'Dispatch cycle',
            value: Format.minutes(kpis.avgDispatchTime),
            subtitle: 'Pick to load, target 45 min',
            icon: 'timer',
            tone: kpis.avgDispatchTime > 60 ? 'red' : 'green',
          })}
          ${metricCard({
            id: 'turnover',
            title: 'Inventory turnover',
            value: kpis.inventoryTurnover === null ? 'N/A' : `${kpis.inventoryTurnover}×`,
            subtitle: 'Annualised from 30-day dispatch value',
            icon: 'refresh',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'damage',
            title: 'Damage recorded',
            value: Format.currency(kpis.damageValue),
            subtitle: `${Format.number(kpis.totalDamaged)} units on the register`,
            icon: 'alertOctagon',
            tone: 'critical',
          })}
        </div>
      </div>
    `;
  }

  function mount() {
    const kpis = Store.kpis();
    const zones = Store.zones();

    ['inv-value', 'fill-rate', 'dispatch-30'].forEach((id) => {
      const series = id === 'inv-value' ? kpis.valueTrend : kpis.dispatchTrend;
      const colour = id === 'inv-value' ? '#3b82f6' : id === 'fill-rate' ? '#10b981' : '#8b5cf6';
      Charts.sparkline(`spark-${id}`, series, colour);
    });

    if (kpis.trendDays?.length) {
      Charts.create(
        'chart-dispatch-trend',
        {
          type: 'line',
          data: {
            labels: kpis.trendDays.map(Format.shortDayLabel),
            datasets: [
              {
                label: 'Dispatches',
                data: kpis.dispatchTrend,
                borderColor: '#6366f1',
                backgroundColor: Charts.alpha('#6366f1', 0.16),
                borderWidth: 2,
                fill: true,
                tension: 0.35,
                pointRadius: 0,
                pointHitRadius: 12,
              },
              {
                label: 'Order lines',
                data: kpis.ordersTrend,
                borderColor: '#10b981',
                borderWidth: 2,
                borderDash: [5, 4],
                fill: false,
                tension: 0.35,
                pointRadius: 0,
                pointHitRadius: 12,
              },
            ],
          },
        },
        { preset: { legend: true }, label: '30-day dispatch and order trend' }
      );
    }

    const categories = kpis.topCategories || [];
    if (categories.length) {
      Charts.create(
        'chart-category',
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
          options: { cutout: '62%' },
        },
        {
          preset: { noScales: true, legend: true, legendPos: 'right' },
          label: 'Inventory value by category',
        }
      );
    }

    if (zones.length) {
      Charts.create(
        'chart-zone-exec',
        {
          type: 'bar',
          data: {
            labels: zones.map((z) => `Zone ${z.zone}`),
            datasets: [
              {
                label: 'Utilisation',
                data: zones.map((z) => z.utilization),
                backgroundColor: zones.map((z) =>
                  Charts.alpha(Charts.utilisationColor(z.utilization), 0.85)
                ),
                borderRadius: 5,
              },
            ],
          },
        },
        { preset: { percentAxis: true }, label: 'Utilisation percentage by zone' }
      );
    }

    const brands = (kpis.topBrands || []).slice(0, 8);
    if (brands.length) {
      Charts.create(
        'chart-top-brands',
        {
          type: 'bar',
          data: {
            labels: brands.map((b) => b.brand),
            datasets: [
              {
                label: 'Inventory value',
                data: brands.map((b) => b.value),
                backgroundColor: brands.map((_, i) => Charts.alpha(Charts.color(i), 0.85)),
                borderRadius: 5,
              },
            ],
          },
        },
        { preset: { horizontal: true, currencyAxis: true }, label: 'Inventory value by brand' }
      );
    }
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.executive = { title: 'Executive summary', render, mount };
})(window.GovSpirit);
