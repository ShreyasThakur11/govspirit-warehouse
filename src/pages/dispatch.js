/**
 * GovSpirit Dispatch and fulfilment.
 */
(function initDispatchPage(GovSpirit) {
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

  const STATUS_COLOURS = {
    Completed: '#10b981',
    Delivered: '#10b981',
    Pending: '#f59e0b',
    Processing: '#3b82f6',
    Cancelled: '#f43f5e',
  };

  function render() {
    const kpis = Store.kpis();

    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Dispatch and fulfilment',
          subtitle: 'Outbound throughput, cycle time and order completion',
          actions: html`<button
            type="button"
            class="btn btn-secondary btn-sm"
            id="btn-export-dispatch"
          >
            Export dispatches
          </button>`,
        })}

        <div class="metric-grid">
          ${metricCard({
            id: 'dsp-total',
            title: 'Total dispatches',
            value: Format.compact(kpis.dispatchCount),
            subtitle: `${Format.compact(kpis.totalDispatchedBottles)} bottles shipped`,
            icon: 'truck',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'dsp-time',
            title: 'Average cycle',
            value: Format.minutes(kpis.avgDispatchTime),
            subtitle: 'Pick to load, target 45 min',
            icon: 'timer',
            tone: kpis.avgDispatchTime > 60 ? 'red' : 'green',
          })}
          ${metricCard({
            id: 'dsp-fill',
            title: 'Fill rate',
            value: Format.percent(kpis.fillRate),
            subtitle: `${Format.number(kpis.pendingOrders)} orders still open`,
            icon: 'truck',
            tone: kpis.fillRate >= 90 ? 'positive' : 'critical',
          })}
          ${metricCard({
            id: 'dsp-complete',
            title: 'Order completion',
            value: Format.percent(kpis.orderFulfilmentRate),
            subtitle: `${Format.number(kpis.completedOrders)} completed`,
            icon: 'checkCircle',
            tone: 'positive',
          })}
          ${metricCard({
            id: 'dsp-today',
            title: 'Orders today',
            value: Format.number(kpis.ordersToday),
            subtitle: `${Format.number(kpis.pendingOrders)} pending`,
            icon: 'listChecks',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'dsp-value',
            title: 'Dispatch value (30d)',
            value: Format.currency(kpis.last30DispatchValue),
            subtitle: `${Format.number(kpis.last30DispatchCount)} consignments`,
            icon: 'banknote',
            tone: 'accent',
          })}
        </div>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-dispatch-volume',
            title: 'Dispatch volume',
            subtitle: 'Last 30 days, dispatches against order lines',
            summary: 'Line chart comparing daily dispatches with order lines received.',
          })}
          ${chartPanel({
            id: 'chart-order-status',
            title: 'Order status mix',
            subtitle: 'Share of lines by current status',
            summary: 'Doughnut chart of order line status.',
          })}
        </div>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-vehicle',
            title: 'Vehicle workload',
            subtitle: 'Trips per vehicle',
            summary: 'Bar chart of trips completed per vehicle.',
          })}
          ${chartPanel({
            id: 'chart-hotel-dispatch',
            title: 'Largest destinations',
            subtitle: 'Bottles dispatched per customer',
            summary: 'Bar chart of dispatched volume by customer.',
          })}
        </div>

        ${panel({
          title: 'Recent dispatches',
          body: dataTable({
            rows: FilterManager.applyToDispatch(Store.dispatch())
              .slice()
              .sort(
                (a, b) => (b.dispatch_date?.getTime() || 0) - (a.dispatch_date?.getTime() || 0)
              ),
            caption: 'Most recent dispatch records',
            maxRows: 60,
            columns: [
              { key: 'dispatch_id', label: 'Dispatch' },
              { key: 'dispatch_date', label: 'Date', format: (v) => Format.formatDate(v) },
              { key: 'hotel_name', label: 'Destination' },
              { key: 'sku_name', label: 'SKU' },
              {
                key: 'quantity_dispatched',
                label: 'Bottles',
                numeric: true,
                format: (v) => Format.number(v),
              },
              {
                key: 'dispatch_value',
                label: 'Value',
                numeric: true,
                format: (v) => Format.currency(v),
              },
              { key: 'vehicle', label: 'Vehicle' },
              {
                key: 'dispatch_time_minutes',
                label: 'Cycle',
                numeric: true,
                format: (v) => Format.minutes(v),
              },
            ],
          }),
        })}
      </div>
    `;
  }

  function mount() {
    const kpis = Store.kpis();
    const dispatch = FilterManager.applyToDispatch(Store.dispatch());
    const orders = FilterManager.applyToOrders(Store.orders());
    const utilization = Store.getState().utilization;

    if (kpis.trendDays?.length) {
      Charts.create(
        'chart-dispatch-volume',
        {
          type: 'line',
          data: {
            labels: kpis.trendDays.map(Format.shortDayLabel),
            datasets: [
              {
                label: 'Dispatches',
                data: kpis.dispatchTrend,
                borderColor: '#6366f1',
                backgroundColor: Charts.alpha('#6366f1', 0.14),
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
        { preset: { legend: true }, label: 'Daily dispatch and order volume' }
      );
    }

    const statusCounts = Collections.countBy(orders, 'status');
    const statuses = Object.keys(statusCounts);
    if (statuses.length) {
      Charts.create(
        'chart-order-status',
        {
          type: 'doughnut',
          data: {
            labels: statuses,
            datasets: [
              {
                data: statuses.map((s) => statusCounts[s]),
                backgroundColor: statuses.map((s, i) => STATUS_COLOURS[s] || Charts.color(i)),
                borderWidth: 0,
                hoverOffset: 8,
              },
            ],
          },
          options: { cutout: '60%' },
        },
        {
          preset: { noScales: true, legend: true, legendPos: 'right' },
          label: 'Order status split',
        }
      );
    }

    const vehicles = (utilization.vehicleUtil || []).slice(0, 8);
    if (vehicles.length) {
      Charts.create(
        'chart-vehicle',
        {
          type: 'bar',
          data: {
            labels: vehicles.map((v) => v.vehicle),
            datasets: [
              {
                label: 'Trips',
                data: vehicles.map((v) => v.trips),
                backgroundColor: Charts.alpha('#6366f1', 0.85),
                borderRadius: 5,
              },
            ],
          },
        },
        { label: 'Trips completed per vehicle' }
      );
    }

    const byHotel = Object.entries(Collections.groupBy(dispatch, 'hotel_name'))
      .map(([hotel, rows]) => ({ hotel, qty: Collections.sumBy(rows, 'quantity_dispatched') }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    if (byHotel.length) {
      Charts.create(
        'chart-hotel-dispatch',
        {
          type: 'bar',
          data: {
            labels: byHotel.map((h) => h.hotel),
            datasets: [
              {
                label: 'Bottles dispatched',
                data: byHotel.map((h) => h.qty),
                backgroundColor: byHotel.map((_, i) => Charts.alpha(Charts.color(i), 0.85)),
                borderRadius: 4,
              },
            ],
          },
        },
        { preset: { horizontal: true }, label: 'Bottles dispatched by destination' }
      );
    }

    document.getElementById('btn-export-dispatch')?.addEventListener('click', () => {
      Exporters.downloadCSV(dispatch, 'dispatch');
    });
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.dispatch = { title: 'Dispatch', render, mount };
})(window.GovSpirit);
