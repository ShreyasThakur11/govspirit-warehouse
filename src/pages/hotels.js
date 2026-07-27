/**
 * GovSpirit Hotel and customer analytics.
 *
 * The weekly trend here is computed from actual order dates. The previous
 * version drew a four-point line by multiplying each hotel's total order count
 * by the fixed factors 0.22, 0.26, 0.24 and 0.28, a shape that looked like
 * data but carried none, and would have shown the same seasonal wobble for
 * every customer in every warehouse in the country.
 */
(function initHotelsPage(GovSpirit) {
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

  const WEEKS = 8;

  /** Ascending list of week-start day keys covering the trailing WEEKS weeks. */
  function weekBuckets() {
    const buckets = [];
    for (let i = WEEKS - 1; i >= 0; i -= 1) {
      const start = Format.daysAgo(i * 7 + 6);
      const end = Format.daysAgo(i * 7);
      buckets.push({ start, end, label: Format.shortDayLabel(Format.dayKey(start)) });
    }
    return buckets;
  }

  function render() {
    const kpis = Store.kpis();
    const orders = FilterManager.applyToOrders(Store.orders());
    const customers = Collections.countDistinct(orders, 'hotel_name');
    const totalValue = Collections.sumBy(orders, 'order_value');

    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Hotel and customer analytics',
          subtitle: 'Who orders what, how much, and how reliably they are served',
          actions: html`<button
            type="button"
            class="btn btn-secondary btn-sm"
            id="btn-export-hotels"
          >
            Export customers
          </button>`,
        })}

        <div class="metric-grid">
          ${metricCard({
            id: 'htl-count',
            title: 'Active customers',
            value: Format.number(customers),
            subtitle: 'Placed at least one order',
            icon: 'building',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'htl-value',
            title: 'Total order value',
            value: Format.currency(totalValue),
            subtitle: `${Format.compact(orders.length)} order lines`,
            icon: 'banknote',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'htl-top',
            title: 'Largest customer',
            value: kpis.topHotels?.[0]?.hotel || 'N/A',
            subtitle: kpis.topHotels?.[0]
              ? Format.currency(kpis.topHotels[0].orderValue)
              : 'No orders loaded',
            icon: 'trendingUp',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'htl-fill',
            title: 'Average fill rate',
            value: Format.percent(kpis.fillRate),
            subtitle: 'Lines shipped complete',
            icon: 'truck',
            tone: kpis.fillRate >= 90 ? 'positive' : 'caution',
          })}
        </div>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-top-hotels',
            title: 'Top customers by value',
            subtitle: 'Total order value over the loaded period',
            summary: (kpis.topHotels || [])
              .slice(0, 5)
              .map((h) => `${h.hotel} ${Format.currency(h.orderValue)}`)
              .join(', '),
            tall: true,
          })}
          ${chartPanel({
            id: 'chart-hotel-trend',
            title: 'Weekly order lines',
            subtitle: `Top five customers over the last ${WEEKS} weeks`,
            summary: 'Line chart of weekly order lines per customer.',
            tall: true,
          })}
        </div>

        ${panel({
          title: 'Customer performance',
          body: dataTable({
            rows: kpis.topHotels || [],
            caption: 'Order volume, value and fill rate by customer',
            columns: [
              { key: 'hotel', label: 'Customer' },
              {
                key: 'totalOrders',
                label: 'Orders',
                numeric: true,
                format: (v) => Format.number(v),
              },
              {
                key: 'qtyOrdered',
                label: 'Bottles ordered',
                numeric: true,
                format: (v) => Format.number(v),
              },
              {
                key: 'orderValue',
                label: 'Order value',
                numeric: true,
                format: (v) => Format.currency(v),
              },
              {
                key: 'fillRate',
                label: 'Fill rate',
                numeric: true,
                format: (v) =>
                  Components.status(
                    Format.percent(v),
                    v >= 90 ? 'success' : v >= 75 ? 'warning' : 'danger'
                  ),
              },
            ],
          }),
        })}
      </div>
    `;
  }

  function mount() {
    const kpis = Store.kpis();
    const orders = FilterManager.applyToOrders(Store.orders());
    const top = (kpis.topHotels || []).slice(0, 10);

    if (top.length) {
      Charts.create(
        'chart-top-hotels',
        {
          type: 'bar',
          data: {
            labels: top.map((h) => h.hotel),
            datasets: [
              {
                label: 'Order value',
                data: top.map((h) => h.orderValue),
                backgroundColor: top.map((_, i) => Charts.alpha(Charts.color(i), 0.85)),
                borderRadius: 5,
              },
            ],
          },
        },
        { preset: { horizontal: true, currencyAxis: true }, label: 'Order value by customer' }
      );
    }

    const buckets = weekBuckets();
    const topFive = top.slice(0, 5);

    if (topFive.length && orders.length) {
      const datasets = topFive.map((entry, index) => {
        const customerOrders = orders.filter((o) => o.hotel_name === entry.hotel);
        const data = buckets.map(
          (bucket) =>
            customerOrders.filter(
              (o) => o.order_date && o.order_date >= bucket.start && o.order_date <= bucket.end
            ).length
        );
        return {
          label: entry.hotel,
          data,
          borderColor: Charts.color(index),
          backgroundColor: Charts.alpha(Charts.color(index), 0.1),
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 3,
          pointHitRadius: 12,
          fill: false,
        };
      });

      Charts.create(
        'chart-hotel-trend',
        {
          type: 'line',
          data: { labels: buckets.map((b) => `w/c ${b.label}`), datasets },
        },
        { preset: { legend: true }, label: 'Weekly order lines by customer' }
      );
    }

    document.getElementById('btn-export-hotels')?.addEventListener('click', () => {
      Exporters.downloadCSV(kpis.topHotels || [], 'customers');
    });
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.hotels = { title: 'Hotels', render, mount };
})(window.GovSpirit);
