/**
 * GovSpirit Warehouse map and space utilisation.
 *
 * The floor plan is generated SVG. Its column count adapts to the container
 * width, so on a phone it becomes a single column of zone cards rather than a
 * 900px-wide diagram in a horizontal scroller.
 */
(function initWarehousePage(GovSpirit) {
  'use strict';

  const { Html, Icons, Format, Store, Components, Charts, Dom, EventBus, Events } =
    GovSpirit.require(
      'Html',
      'Icons',
      'Format',
      'Store',
      'Components',
      'Charts',
      'Dom',
      'EventBus',
      'Events'
    );

  const { html, escape } = Html;
  const { metricCard, chartPanel, panel, pageHeader, dataTable, emptyState } = Components;

  const LEGEND = [
    { color: '#10b981', label: 'Low, under 50%' },
    { color: '#3b82f6', label: 'Medium, 50 to 75%' },
    { color: '#f59e0b', label: 'High, 75 to 90%' },
    { color: '#f43f5e', label: 'Critical, over 90%' },
  ];

  let unsubscribeViewport = null;

  function render() {
    const kpis = Store.kpis();
    const utilization = Store.getState().utilization;

    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Warehouse map and utilisation',
          subtitle: 'Zone and rack occupancy across the floor',
        })}
        ${
          utilization.estimated
            ? html`<div class="notice mb-3">
                ${Icons.render('ruler', { size: 18 })}
                <div>
                  <p class="notice-title">Capacity is estimated</p>
                  <p class="notice-body">
                    No warehouse layout file was supplied, so bin capacity is estimated at 100
                    bottles per observed bin. Upload a layout export listing zone, rack, bin and
                    capacity to replace these estimates with measured figures.
                  </p>
                </div>
              </div>`
            : ''
        }

        <div class="metric-grid">
          ${metricCard({
            id: 'wh-occupancy',
            title: 'Bin occupancy',
            value: Format.percent(kpis.warehouseOccupancy),
            subtitle: `${Format.number(kpis.occupiedBins)} of ${Format.number(kpis.totalBins)} bins`,
            icon: 'warehouse',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'wh-congested',
            title: 'Congested racks',
            value: Format.number(utilization.congestedRacks || 0),
            subtitle: 'At or above 90% capacity',
            icon: 'gauge',
            tone: 'critical',
          })}
          ${metricCard({
            id: 'wh-sparse',
            title: 'Sparse racks',
            value: Format.number(utilization.sparseRacks || 0),
            subtitle: 'Below 30% capacity',
            icon: 'checkCircle',
            tone: 'positive',
          })}
          ${metricCard({
            id: 'wh-blocked',
            title: 'Blocked bins',
            value: Format.number(kpis.blockedBins || 0),
            subtitle: 'Out of service in the layout file',
            icon: 'alertTriangle',
            tone: 'caution',
          })}
        </div>

        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">Floor plan</h2>
            <ul class="map-legend">
              ${LEGEND.map(
                (item) => html`
                  <li>
                    <span class="legend-swatch" style="background:${item.color}"></span>
                    ${item.label}
                  </li>
                `
              )}
            </ul>
          </div>
          <div class="floor-plan" id="warehouse-map"></div>
        </section>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-zone-detail',
            title: 'Utilisation by zone',
            subtitle: 'Percentage of capacity in use',
            summary: Store.zones()
              .map((z) => `Zone ${z.zone} ${z.utilization}%`)
              .join(', '),
          })}
          ${chartPanel({
            id: 'chart-rack-top',
            title: 'Fullest racks',
            subtitle: 'The 15 racks closest to capacity',
            summary: 'Horizontal bar chart of rack utilisation.',
          })}
        </div>

        ${panel({
          title: 'Zone detail',
          body: dataTable({
            rows: Store.zones(),
            caption: 'Capacity and contents of each warehouse zone',
            columns: [
              { key: 'zone', label: 'Zone', format: (v) => `Zone ${v}` },
              { key: 'numRacks', label: 'Racks', numeric: true },
              { key: 'numSkus', label: 'SKUs', numeric: true },
              {
                key: 'totalQty',
                label: 'Bottles',
                numeric: true,
                format: (v) => Format.number(v),
              },
              {
                key: 'totalValue',
                label: 'Value',
                numeric: true,
                format: (v) => Format.currency(v),
              },
              {
                key: 'utilization',
                label: 'Utilisation',
                numeric: true,
                format: (v) =>
                  html`<span style="color:${Charts.utilisationColor(v)};font-weight:700"
                    >${Format.percent(v)}</span
                  >`,
              },
              { key: 'topBrand', label: 'Top brand' },
              { key: 'topCategory', label: 'Top category' },
            ],
          }),
        })}
      </div>
    `;
  }

  /** Build the floor plan at a column count suited to the available width. */
  function renderMap() {
    const container = Dom.byId('warehouse-map');
    if (!container) return;

    const zones = Store.zones();
    const racks = Store.racks();

    if (!zones.length) {
      Html.setHTML(
        container,
        emptyState({
          title: 'No layout to draw',
          body: 'Zone information could not be derived from the loaded data.',
          icon: 'warehouse',
        })
      );
      return;
    }

    const width = container.clientWidth || 900;
    const columns = width < 520 ? 1 : width < 900 ? 2 : 3;

    const cellW = 300;
    const cellH = 210;
    const gap = 16;
    const rows = Math.ceil(zones.length / columns);
    const svgW = columns * cellW + (columns - 1) * gap;
    const svgH = rows * cellH + (rows - 1) * gap;

    const parts = [
      `<svg  viewBox="0 0 ${svgW} ${svgH}" role="img" ` +
        `aria-label="Warehouse floor plan showing ${zones.length} zones and their utilisation" ` +
        'xmlns="http://www.w3.org/2000/svg">',
    ];

    zones.forEach((zone, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = col * (cellW + gap);
      const y = row * (cellH + gap);
      const colour = Charts.utilisationColor(zone.utilization);
      const barWidth = cellW - 96;

      parts.push(`<g>`);
      parts.push(
        `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="10" ` +
          `fill="${colour}14" stroke="${colour}" stroke-width="1.5"/>`
      );
      parts.push(
        `<text x="${x + 14}" y="${y + 26}" fill="${colour}" font-size="14" font-weight="700" ` +
          `font-family="Inter, sans-serif">Zone ${escape(zone.zone)}</text>`
      );
      parts.push(
        `<text x="${x + 14}" y="${y + 46}" fill="currentColor" opacity="0.75" font-size="11" ` +
          `font-family="Inter, sans-serif">${zone.numRacks} racks · ${zone.numSkus} SKUs</text>`
      );

      // Utilisation bar
      parts.push(
        `<rect x="${x + 14}" y="${y + 58}" width="${barWidth}" height="8" rx="4" fill="currentColor" opacity="0.12"/>`
      );
      parts.push(
        `<rect x="${x + 14}" y="${y + 58}" width="${Math.round((barWidth * zone.utilization) / 100)}" ` +
          `height="8" rx="4" fill="${colour}"/>`
      );
      parts.push(
        `<text x="${x + barWidth + 22}" y="${y + 66}" fill="${colour}" font-size="11" ` +
          `font-weight="700" font-family="Inter, sans-serif">${zone.utilization.toFixed(0)}%</text>`
      );

      // Rack tiles, capped so the card never overflows its box
      const zoneRacks = racks.filter((rack) => rack.zone === zone.zone).slice(0, 9);
      zoneRacks.forEach((rack, rackIndex) => {
        const rc = rackIndex % 3;
        const rr = Math.floor(rackIndex / 3);
        const rx = x + 14 + rc * ((cellW - 28) / 3);
        const ry = y + 84 + rr * 38;
        const rackColour = Charts.utilisationColor(rack.utilization);
        const tileW = (cellW - 28) / 3 - 8;

        parts.push(
          `<rect x="${rx}" y="${ry}" width="${tileW}" height="30" rx="5" ` +
            `fill="${rackColour}26" stroke="${rackColour}" stroke-width="1"/>`
        );
        parts.push(
          `<text x="${rx + 7}" y="${ry + 13}" fill="${rackColour}" font-size="10" font-weight="600" ` +
            `font-family="Inter, sans-serif">${escape(rack.rack_id)}</text>`
        );
        parts.push(
          `<text x="${rx + 7}" y="${ry + 25}" fill="currentColor" opacity="0.7" font-size="9" ` +
            `font-family="Inter, sans-serif">${rack.utilization.toFixed(0)}%</text>`
        );
      });

      parts.push(
        `<text x="${x + 14}" y="${y + cellH - 14}" fill="currentColor" opacity="0.6" font-size="10" ` +
          `font-family="Inter, sans-serif">${escape(Format.currency(zone.totalValue))}</text>`
      );
      parts.push('</g>');
    });

    parts.push('</svg>');
    container.innerHTML = parts.join('');
    container.style.color = 'var(--text-secondary)';
  }

  function mount() {
    renderMap();

    const zones = Store.zones();
    const utilization = Store.getState().utilization;

    if (zones.length) {
      Charts.create(
        'chart-zone-detail',
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

    const topRacks = [...(utilization.rackUtil || [])]
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 15);

    if (topRacks.length) {
      Charts.create(
        'chart-rack-top',
        {
          type: 'bar',
          data: {
            labels: topRacks.map((r) => r.rack_id),
            datasets: [
              {
                label: 'Utilisation',
                data: topRacks.map((r) => r.utilization),
                backgroundColor: topRacks.map((r) =>
                  Charts.alpha(Charts.utilisationColor(r.utilization), 0.85)
                ),
                borderRadius: 4,
              },
            ],
          },
        },
        { preset: { horizontal: true, percentAxis: true }, label: 'Fullest racks by utilisation' }
      );
    }

    // The SVG is laid out in JS, so it has to be rebuilt when the box resizes.
    unsubscribeViewport = EventBus.on(Events.VIEWPORT_CHANGED, renderMap);
    const onResize = Dom.debounce(renderMap, 200);
    window.addEventListener('resize', onResize);
    unsubscribeViewport = ((previous) => () => {
      previous();
      window.removeEventListener('resize', onResize);
    })(unsubscribeViewport);
  }

  function unmount() {
    if (unsubscribeViewport) {
      unsubscribeViewport();
      unsubscribeViewport = null;
    }
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.warehouse = { title: 'Warehouse map', render, mount, unmount };
})(window.GovSpirit);
