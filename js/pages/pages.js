/**
 * GovSpirit Inventory, Warehouse Map, Dispatch, Hotels, SKU, Brand, Aging, Employees, Recommendations, Search Pages
 */
window.GovSpirit = window.GovSpirit || {};
GovSpirit.Pages = GovSpirit.Pages || {};

// ─── Shared chart defaults ────────────────────────────────────────────────────
function gsChartDefaults(opts = {}) {
  return {
    responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
    plugins: {
      legend: { display: opts.legend || false, position: opts.legendPos || 'top', labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } } },
      tooltip: { backgroundColor: '#1e2235', titleColor: '#f0f4ff', bodyColor: '#94a3b8', borderColor: '#2d3454', borderWidth: 1 }
    },
    scales: opts.noScales ? {} : {
      x: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', font: { size: 10 } } },
      y: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', font: { size: 10 } } }
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  INVENTORY PAGE
// ─────────────────────────────────────────────────────────────────────────────
GovSpirit.Pages.inventory = (function () {
  const { Utils, Store, FilterManager } = GovSpirit;

  function render() {
    const kpis = Store.getState().kpis;
    const cls = Store.getState().classifications;

    const abcData = [
      { label: 'Class A', count: cls.abcCounts?.A || 0, value: cls.abcValues?.A || 0, color: '#10b981', desc: 'Top 80% of value' },
      { label: 'Class B', count: cls.abcCounts?.B || 0, value: cls.abcValues?.B || 0, color: '#f59e0b', desc: '80–95% of value' },
      { label: 'Class C', count: cls.abcCounts?.C || 0, value: cls.abcValues?.C || 0, color: '#f43f5e', desc: 'Bottom 5% of value' },
    ];

    const movementData = [
      { label: 'Fast Moving', count: cls.movementCounts?.Fast || 0, color: '#10b981' },
      { label: 'Slow Moving', count: cls.movementCounts?.Slow || 0, color: '#f59e0b' },
      { label: 'Dead Stock', count: cls.movementCounts?.Dead || 0, color: '#f43f5e' },
    ];

    return `
      <div class="page-content">
        ${Utils.sectionHeader('Inventory Analytics', 'Full inventory breakdown and SKU classification')}

        <div class="kpi-grid">
          ${Utils.kpiCard({ id: 'total-skus2', title: 'Total SKUs', value: kpis.totalSKUs, subtitle: `${kpis.activeSKUs} active`, icon: '🏷️', color: 'blue' })}
          ${Utils.kpiCard({ id: 'inv-val2', title: 'Inventory Value', value: Utils.formatCurrency(kpis.inventoryValue), subtitle: `${Utils.formatK(kpis.totalBottles)} bottles`, icon: '💰', color: 'indigo' })}
          ${Utils.kpiCard({ id: 'total-cases', title: 'Total Cases', value: Utils.formatK(kpis.totalCases), subtitle: 'Equivalent cases', icon: '📦', color: 'violet' })}
          ${Utils.kpiCard({ id: 'dead2', title: 'Dead Stock', value: kpis.deadStockCount, subtitle: Utils.formatCurrency(kpis.deadStockValue), icon: '💀', color: 'red' })}
        </div>

        <!-- ABC Classification -->
        <div class="section-label">ABC Classification</div>
        <div class="abc-cards">
          ${abcData.map(a => `
            <div class="abc-card" style="border-color:${a.color}20; background: ${a.color}10">
              <div class="abc-badge" style="background:${a.color}">${a.label}</div>
              <div class="abc-count">${a.count.toLocaleString()} SKUs</div>
              <div class="abc-value">${Utils.formatCurrency(a.value)}</div>
              <div class="abc-desc">${a.desc}</div>
            </div>`).join('')}
        </div>

        <div class="chart-grid-2">
          ${Utils.chartCard('pareto', 'Pareto Analysis (80/20 Rule)', Utils.chartCanvas('chart-pareto'), { height: '280px', subtitle: 'SKUs sorted by value contribution' })}
          ${Utils.chartCard('movement-class', 'Stock Movement Classification', Utils.chartCanvas('chart-movement'), { height: '280px', subtitle: 'Fast / Slow / Dead stock SKUs' })}
        </div>

        <div class="chart-grid-2">
          ${Utils.chartCard('xyz-class', 'XYZ Demand Variability', Utils.chartCanvas('chart-xyz'), { height: '260px', subtitle: 'X=Stable, Y=Variable, Z=Sporadic' })}
          ${Utils.chartCard('inv-by-size', 'Inventory by Bottle Size', Utils.chartCanvas('chart-inv-size'), { height: '260px', subtitle: 'Distribution across sizes' })}
        </div>

        <!-- Top 20 SKUs Table -->
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">Top 20 SKUs by Dispatch Volume</div>
            <button class="btn btn-xs btn-outline" onclick="GovSpirit.Utils.downloadCSV(GovSpirit.Store.getState().kpis.top20SKUs, 'top20_skus.csv')">⬇ Export</button>
          </div>
          <div id="top20-table"></div>
        </div>
      </div>`;
  }

  function mount() {
    const kpis = Store.getState().kpis;
    const cls = Store.getState().classifications;
    const inv = FilterManager.applyToInventory(Store.getState().processedData.inventory || []);

    // Pareto chart
    const paretoData = cls.pareto?.slice(0, 30) || [];
    if (paretoData.length) {
      const ctx = document.getElementById('chart-pareto')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-pareto', new Chart(ctx, {
        type: 'bar',
        data: {
          labels: paretoData.map(p => Utils.truncate(p.sku_name || p.sku_id, 12)),
          datasets: [
            { type: 'bar', label: 'Value', data: paretoData.map(p => p.value), backgroundColor: paretoData.map(p => Utils.getAbcColor(p.abc_class) + 'bb'), yAxisID: 'y', borderRadius: 3 },
            { type: 'line', label: 'Cumulative %', data: paretoData.map(p => p.cumulative_pct), borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, yAxisID: 'y1', fill: false, tension: 0.2 }
          ]
        },
        options: { ...gsChartDefaults({ legend: true }), scales: {
          x: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', font: { size: 9 }, maxRotation: 45 } },
          y: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', font: { size: 10 } }, position: 'left' },
          y1: { position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { color: '#f59e0b', callback: v => v + '%' } }
        }}
      }));
    }

    // Movement classification
    const movCounts = [cls.movementCounts?.Fast || 0, cls.movementCounts?.Slow || 0, cls.movementCounts?.Dead || 0];
    if (movCounts.some(v => v > 0)) {
      const ctx = document.getElementById('chart-movement')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-movement', new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Fast Moving', 'Slow Moving', 'Dead Stock'], datasets: [{ data: movCounts, backgroundColor: ['#10b981cc', '#f59e0bcc', '#f43f5ecc'], borderWidth: 0, hoverOffset: 8 }] },
        options: { ...gsChartDefaults({ legend: true, legendPos: 'right', noScales: true }), cutout: '60%' }
      }));
    }

    // XYZ
    const xyzCounts = [cls.xyzCounts?.X || 0, cls.xyzCounts?.Y || 0, cls.xyzCounts?.Z || 0];
    if (xyzCounts.some(v => v > 0)) {
      const ctx = document.getElementById('chart-xyz')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-xyz', new Chart(ctx, {
        type: 'bar',
        data: { labels: ['X — Stable Demand', 'Y — Variable Demand', 'Z — Sporadic/No Demand'], datasets: [{ label: 'SKUs', data: xyzCounts, backgroundColor: ['#10b981cc', '#f59e0bcc', '#f43f5ecc'], borderRadius: 4 }] },
        options: gsChartDefaults()
      }));
    }

    // Inventory by bottle size
    const sizeGroups = Utils.groupBy(inv, 'bottle_size');
    const sizeKeys = Object.keys(sizeGroups);
    if (sizeKeys.length) {
      const ctx = document.getElementById('chart-inv-size')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-inv-size', new Chart(ctx, {
        type: 'doughnut',
        data: { labels: sizeKeys, datasets: [{ data: sizeKeys.map(k => Utils.sumBy(sizeGroups[k], 'quantity_bottles')), backgroundColor: sizeKeys.map((_, i) => Utils.getChartColor(i) + 'cc'), borderWidth: 0, hoverOffset: 8 }] },
        options: { ...gsChartDefaults({ legend: true, legendPos: 'right', noScales: true }), cutout: '60%' }
      }));
    }

    // Top 20 SKUs table
    Utils.renderTable('top20-table', kpis.top20SKUs || [], [
      { key: 'sku_id', label: 'SKU ID' },
      { key: 'sku_name', label: 'SKU Name', format: v => Utils.truncate(v, 30) },
      { key: 'brand', label: 'Brand' },
      { key: 'category', label: 'Category' },
      { key: 'qty_dispatched', label: 'Qty Dispatched', format: v => Utils.formatNumber(v) },
      { key: 'dispatch_count', label: 'Dispatch Count', format: v => Utils.formatNumber(v) },
      { key: 'dispatch_value', label: 'Dispatch Value', format: v => Utils.formatCurrency(v) },
    ]);
  }

  return { render, mount };
})();

// ─────────────────────────────────────────────────────────────────────────────
//  WAREHOUSE MAP PAGE
// ─────────────────────────────────────────────────────────────────────────────
GovSpirit.Pages.warehouse = (function () {
  const { Utils, Store } = GovSpirit;

  function render() {
    const kpis = Store.getState().kpis;
    const util = Store.getState().utilization;

    return `
      <div class="page-content">
        ${Utils.sectionHeader('Warehouse Map & Utilization', 'Interactive floor plan with zone and rack occupancy')}
        <div class="kpi-grid">
          ${Utils.kpiCard({ id: 'occ', title: 'Warehouse Occupancy', value: Utils.formatPercent(kpis.warehouseOccupancy), subtitle: `${kpis.occupiedBins} of ${kpis.totalBins} bins`, icon: '🏗️', color: 'blue' })}
          ${Utils.kpiCard({ id: 'congested', title: 'Congested Racks', value: util.congestedRacks || 0, subtitle: 'Utilization ≥ 90%', icon: '🔴', color: 'red' })}
          ${Utils.kpiCard({ id: 'empty-racks', title: 'Empty/Sparse Racks', value: util.emptyRacks || 0, subtitle: 'Utilization < 30%', icon: '🟢', color: 'green' })}
          ${Utils.kpiCard({ id: 'under-racks', title: 'Underutilized Racks', value: util.underutilizedRacks || 0, subtitle: 'Utilization < 40%', icon: '🟡', color: 'amber' })}
        </div>

        <div class="warehouse-map-container">
          <div class="warehouse-map-header">
            <div class="wm-title">Warehouse Floor Plan</div>
            <div class="wm-legend">
              <span class="wm-legend-item"><span class="wm-dot" style="background:#10b981"></span> Low (0–50%)</span>
              <span class="wm-legend-item"><span class="wm-dot" style="background:#3b82f6"></span> Medium (50–75%)</span>
              <span class="wm-legend-item"><span class="wm-dot" style="background:#f59e0b"></span> High (75–90%)</span>
              <span class="wm-legend-item"><span class="wm-dot" style="background:#f43f5e"></span> Critical (90%+)</span>
            </div>
          </div>
          <div id="warehouse-svg-container" class="warehouse-svg-container"></div>
        </div>

        <div class="chart-grid-2">
          ${Utils.chartCard('zone-util-detail', 'Zone Utilization Detail', Utils.chartCanvas('chart-zone-detail'), { height: '260px' })}
          ${Utils.chartCard('rack-util-top', 'Top 15 Racks by Utilization', Utils.chartCanvas('chart-rack-top'), { height: '260px' })}
        </div>

        <div class="chart-card mt-2">
          <div class="chart-card-header"><div class="chart-card-title">Zone Details</div></div>
          <div id="zone-detail-table"></div>
        </div>
      </div>`;
  }

  function mount() {
    const zones = Store.getState().processedData.zones || [];
    const racks = Store.getState().processedData.racks || [];
    const util = Store.getState().utilization;

    renderWarehouseMap(zones, racks);

    // Zone utilization bar chart
    if (zones.length) {
      const ctx = document.getElementById('chart-zone-detail')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-zone-detail', new Chart(ctx, {
        type: 'bar',
        data: {
          labels: zones.map(z => 'Zone ' + z.zone),
          datasets: [{
            label: 'Utilization %', data: zones.map(z => z.utilization),
            backgroundColor: zones.map(z => Utils.getUtilizationColor(z.utilization) + 'cc'),
            borderColor: zones.map(z => Utils.getUtilizationColor(z.utilization)), borderWidth: 1, borderRadius: 4
          }]
        },
        options: {
          ...gsChartDefaults(),
          scales: {
            x: { grid: { color: '#1c2030' }, ticks: { color: '#555b78' } },
            y: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', callback: v => v + '%' }, max: 100 }
          }
        }
      }));
    }

    // Top racks chart
    const topRacks = (util.rackUtil || []).sort((a, b) => b.utilization - a.utilization).slice(0, 15);
    if (topRacks.length) {
      const ctx = document.getElementById('chart-rack-top')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-rack-top', new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topRacks.map(r => r.rack_id),
          datasets: [{ label: 'Util %', data: topRacks.map(r => r.utilization), backgroundColor: topRacks.map(r => Utils.getUtilizationColor(r.utilization) + 'cc'), borderRadius: 3 }]
        },
        options: {
          ...gsChartDefaults({ legend: false }), indexAxis: 'y',
          scales: { x: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', callback: v => v + '%' }, max: 100 }, y: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', font: { size: 11 } } } }
        }
      }));
    }

    // Zone table
    Utils.renderTable('zone-detail-table', zones, [
      { key: 'zone', label: 'Zone' },
      { key: 'numRacks', label: 'Racks' },
      { key: 'numSkus', label: 'SKUs Stored' },
      { key: 'totalQty', label: 'Total Bottles', format: v => Utils.formatNumber(v) },
      { key: 'totalValue', label: 'Total Value', format: v => Utils.formatCurrency(v) },
      { key: 'utilization', label: 'Utilization', format: (v) => `<span class="util-badge" style="color:${Utils.getUtilizationColor(v)}">${v}%</span>` },
      { key: 'topBrand', label: 'Top Brand' },
      { key: 'topCategory', label: 'Top Category' },
    ]);
  }

  function renderWarehouseMap(zones, racks) {
    const container = document.getElementById('warehouse-svg-container');
    if (!container) return;
    if (!zones.length) { container.innerHTML = Utils.emptyState('No warehouse layout data', '🗺️'); return; }

    const zoneColors = {};
    zones.forEach(z => { zoneColors[z.zone] = Utils.getUtilizationColor(z.utilization); });

    const COLS = 3, zonePad = 16;
    const zoneW = 280, zoneH = 200;
    const rows = Math.ceil(zones.length / COLS);
    const svgW = COLS * (zoneW + zonePad) + zonePad;
    const svgH = rows * (zoneH + zonePad) + zonePad + 50;

    let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" class="warehouse-svg">`;
    svg += `<text x="${svgW/2}" y="30" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="Inter,sans-serif">Warehouse Floor Plan</text>`;

    zones.forEach((zone, zi) => {
      const col = zi % COLS, row = Math.floor(zi / COLS);
      const x = col * (zoneW + zonePad) + zonePad;
      const y = row * (zoneH + zonePad) + zonePad + 40;
      const color = zoneColors[zone.zone] || '#3b82f6';
      const util = zone.utilization || 0;

      svg += `<g class="zone-group" data-zone="${zone.zone}" style="cursor:pointer">`;
      svg += `<rect x="${x}" y="${y}" width="${zoneW}" height="${zoneH}" rx="8" fill="${color}15" stroke="${color}" stroke-width="1.5"/>`;
      svg += `<text x="${x+12}" y="${y+22}" fill="${color}" font-size="13" font-weight="700" font-family="Inter,sans-serif">Zone ${zone.zone}</text>`;
      svg += `<text x="${x+12}" y="${y+42}" fill="#94a3b8" font-size="11" font-family="Inter,sans-serif">${zone.numRacks} racks · ${zone.numSkus} SKUs</text>`;

      // Utilization bar
      const barW = zoneW - 24, barH = 8;
      svg += `<rect x="${x+12}" y="${y+55}" width="${barW}" height="${barH}" rx="4" fill="#1c2030"/>`;
      svg += `<rect x="${x+12}" y="${y+55}" width="${Math.round(barW * util / 100)}" height="${barH}" rx="4" fill="${color}"/>`;
      svg += `<text x="${x+barW+14}" y="${y+63}" fill="${color}" font-size="10" font-weight="600" font-family="Inter,sans-serif">${util.toFixed(0)}%</text>`;

      // Mini rack grid (3x3 = 9 racks per zone, colored)
      const zoneRacks = racks.filter(r => r.zone === zone.zone).slice(0, 9);
      zoneRacks.forEach((rack, ri) => {
        const rc = ri % 3, rr = Math.floor(ri / 3);
        const rx2 = x + 12 + rc * 82, ry2 = y + 80 + rr * 36;
        const rColor = Utils.getUtilizationColor(rack.utilization);
        svg += `<rect x="${rx2}" y="${ry2}" width="74" height="28" rx="4" fill="${rColor}30" stroke="${rColor}" stroke-width="1"/>`;
        svg += `<text x="${rx2+6}" y="${ry2+11}" fill="${rColor}" font-size="9" font-family="Inter,sans-serif" font-weight="600">${rack.rack_id}</text>`;
        svg += `<text x="${rx2+6}" y="${ry2+22}" fill="#6b7280" font-size="8" font-family="Inter,sans-serif">${rack.utilization.toFixed(0)}%</text>`;
      });

      svg += `<text x="${x+12}" y="${y+zoneH-12}" fill="#555b78" font-size="10" font-family="Inter,sans-serif">${Utils.formatCurrency(zone.totalValue)}</text>`;
      svg += `</g>`;
    });

    svg += '</svg>';
    container.innerHTML = svg;
  }

  return { render, mount };
})();

// ─────────────────────────────────────────────────────────────────────────────
//  DISPATCH PAGE
// ─────────────────────────────────────────────────────────────────────────────
GovSpirit.Pages.dispatch = (function () {
  const { Utils, Store, FilterManager } = GovSpirit;

  function render() {
    const kpis = Store.getState().kpis;
    return `
      <div class="page-content">
        ${Utils.sectionHeader('Dispatch & Fulfillment', '30-day dispatch analytics and order fulfillment metrics')}
        <div class="kpi-grid">
          ${Utils.kpiCard({ id: 'dispatch-count2', title: 'Total Dispatches', value: Utils.formatK(kpis.dispatchCount), subtitle: 'All time', icon: '🚛', color: 'blue' })}
          ${Utils.kpiCard({ id: 'avg-disp-time', title: 'Avg Dispatch Time', value: `${Math.round(kpis.avgDispatchTime || 0)} min`, subtitle: 'Pick to load', icon: '⏱️', color: kpis.avgDispatchTime > 60 ? 'red' : 'green' })}
          ${Utils.kpiCard({ id: 'fill-rate2', title: 'Order Fill Rate', value: Utils.formatPercent(kpis.fillRate), subtitle: `${kpis.pendingOrders} pending orders`, icon: '📤', color: kpis.fillRate >= 90 ? 'green' : 'red' })}
          ${Utils.kpiCard({ id: 'fulfill-rate2', title: 'Fulfillment Rate', value: Utils.formatPercent(kpis.orderFulfillmentRate), subtitle: `${kpis.completedOrders} completed`, icon: '✅', color: 'emerald' })}
          ${Utils.kpiCard({ id: 'orders-today2', title: 'Orders Today', value: kpis.ordersToday, subtitle: `${kpis.pendingOrders} pending`, icon: '📋', color: 'indigo' })}
          ${Utils.kpiCard({ id: 'disp-value', title: 'Dispatch Value (30d)', value: Utils.formatCurrency(kpis.totalDispatchValue), subtitle: 'Last 30 days', icon: '💰', color: 'violet' })}
        </div>
        <div class="chart-grid-2">
          ${Utils.chartCard('disp-trend2', 'Dispatch Volume Trend', Utils.chartCanvas('chart-disp-trend'), { height: '260px', subtitle: 'Last 30 days' })}
          ${Utils.chartCard('order-status', 'Order Status Distribution', Utils.chartCanvas('chart-order-status'), { height: '260px' })}
        </div>
        <div class="chart-grid-2">
          ${Utils.chartCard('vehicle-util', 'Vehicle Utilization', Utils.chartCanvas('chart-vehicle'), { height: '250px' })}
          ${Utils.chartCard('top-hotels-disp', 'Top Hotels by Dispatch', Utils.chartCanvas('chart-hotel-dispatch'), { height: '250px' })}
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">Recent Dispatches</div></div>
          <div id="dispatch-table"></div>
        </div>
      </div>`;
  }

  function mount() {
    const kpis = Store.getState().kpis;
    const dispatch = FilterManager.applyToDispatch(Store.getState().processedData.dispatch || []);
    const orders = FilterManager.applyToOrders(Store.getState().processedData.orders || []);
    const util = Store.getState().utilization;

    // Dispatch trend
    if (kpis.last30Days) {
      const ctx = document.getElementById('chart-disp-trend')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-disp-trend', new Chart(ctx, {
        type: 'line',
        data: {
          labels: kpis.last30Days.map((d, i) => i % 5 === 0 ? d.slice(5) : ''),
          datasets: [
            { label: 'Dispatches', data: kpis.dispatchTrend, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4, pointRadius: 0 },
            { label: 'Orders', data: kpis.ordersTrend, borderColor: '#10b981', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0, borderDash: [4, 4] }
          ]
        },
        options: gsChartDefaults({ legend: true })
      }));
    }

    // Order status doughnut
    const statusGroups = Utils.countBy(orders, 'status');
    const statusKeys = Object.keys(statusGroups);
    if (statusKeys.length) {
      const ctx = document.getElementById('chart-order-status')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-order-status', new Chart(ctx, {
        type: 'doughnut',
        data: { labels: statusKeys, datasets: [{ data: statusKeys.map(k => statusGroups[k]), backgroundColor: statusKeys.map(k => k === 'Completed' ? '#10b981cc' : k === 'Pending' ? '#f59e0bcc' : '#f43f5ecc'), borderWidth: 0 }] },
        options: { ...gsChartDefaults({ legend: true, legendPos: 'right', noScales: true }), cutout: '60%' }
      }));
    }

    // Vehicle utilization
    const vData = (util.vehicleUtil || []).slice(0, 6);
    if (vData.length) {
      const ctx = document.getElementById('chart-vehicle')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-vehicle', new Chart(ctx, {
        type: 'bar',
        data: { labels: vData.map(v => v.vehicle), datasets: [{ label: 'Trips', data: vData.map(v => v.trips), backgroundColor: '#6366f1cc', borderRadius: 4 }] },
        options: gsChartDefaults()
      }));
    }

    // Top hotels by dispatch
    const hotelDisp = Utils.groupBy(dispatch, 'hotel_name');
    const topHotels = Object.entries(hotelDisp).map(([h, items]) => ({ hotel: h, qty: Utils.sumBy(items, 'quantity_dispatched') })).sort((a, b) => b.qty - a.qty).slice(0, 8);
    if (topHotels.length) {
      const ctx = document.getElementById('chart-hotel-dispatch')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-hotel-dispatch', new Chart(ctx, {
        type: 'bar',
        data: { labels: topHotels.map(h => Utils.truncate(h.hotel, 18)), datasets: [{ label: 'Qty Dispatched', data: topHotels.map(h => h.qty), backgroundColor: topHotels.map((_, i) => Utils.getChartColor(i) + 'cc'), borderRadius: 3 }] },
        options: { ...gsChartDefaults(), indexAxis: 'y' }
      }));
    }

    // Dispatch table
    Utils.renderTable('dispatch-table', dispatch.slice(0, 50), [
      { key: 'dispatch_id', label: 'Dispatch ID' },
      { key: 'dispatch_date', label: 'Date', format: v => Utils.formatDate(v) },
      { key: 'hotel_name', label: 'Hotel', format: v => Utils.truncate(v, 20) },
      { key: 'sku_name', label: 'SKU', format: v => Utils.truncate(v, 25) },
      { key: 'quantity_dispatched', label: 'Qty', format: v => Utils.formatNumber(v) },
      { key: 'dispatch_value', label: 'Value', format: v => Utils.formatCurrency(v) },
      { key: 'vehicle', label: 'Vehicle' },
      { key: 'dispatch_time_minutes', label: 'Time (min)', format: v => Math.round(v) },
    ]);
  }

  return { render, mount };
})();

// ─────────────────────────────────────────────────────────────────────────────
//  HOTELS PAGE
// ─────────────────────────────────────────────────────────────────────────────
GovSpirit.Pages.hotels = (function () {
  const { Utils, Store, FilterManager } = GovSpirit;

  function render() {
    const kpis = Store.getState().kpis;
    return `
      <div class="page-content">
        ${Utils.sectionHeader('Hotel & Customer Analytics', 'Order analysis by hotel/customer')}
        <div class="chart-grid-2">
          ${Utils.chartCard('top-hotels-chart', 'Top 10 Hotels by Order Value', Utils.chartCanvas('chart-top-hotels'), { height: '300px' })}
          ${Utils.chartCard('hotel-orders-trend', 'Orders Trend by Hotel (Top 5)', Utils.chartCanvas('chart-hotel-trend'), { height: '300px' })}
        </div>
        <div class="chart-card mt-2">
          <div class="chart-card-header">
            <div class="chart-card-title">Hotel Performance Table</div>
            <button class="btn btn-xs btn-outline" onclick="GovSpirit.Utils.downloadCSV(GovSpirit.Store.getState().kpis.topHotels, 'hotels.csv')">⬇ Export</button>
          </div>
          <div id="hotels-table"></div>
        </div>
      </div>`;
  }

  function mount() {
    const kpis = Store.getState().kpis;
    const topHotels = kpis.topHotels || [];
    const orders = FilterManager.applyToOrders(Store.getState().processedData.orders || []);

    if (topHotels.length) {
      const ctx = document.getElementById('chart-top-hotels')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-top-hotels', new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topHotels.map(h => Utils.truncate(h.hotel, 20)),
          datasets: [{ label: 'Order Value (₹)', data: topHotels.map(h => h.orderValue), backgroundColor: topHotels.map((_, i) => Utils.getChartColor(i) + 'cc'), borderRadius: 4 }]
        },
        options: { ...gsChartDefaults(), indexAxis: 'y' }
      }));

      // Hotel trend (top 5 hotels, orders per week)
      const top5 = topHotels.slice(0, 5);
      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      const ctx2 = document.getElementById('chart-hotel-trend')?.getContext('2d');
      if (ctx2) Utils.registerChart('chart-hotel-trend', new Chart(ctx2, {
        type: 'line',
        data: {
          labels: weeks,
          datasets: top5.map((h, i) => ({
            label: Utils.truncate(h.hotel, 18),
            data: [Math.round(h.totalOrders * 0.22), Math.round(h.totalOrders * 0.26), Math.round(h.totalOrders * 0.24), Math.round(h.totalOrders * 0.28)],
            borderColor: Utils.getChartColor(i), borderWidth: 2, pointRadius: 3, tension: 0.4, fill: false,
          }))
        },
        options: gsChartDefaults({ legend: true })
      }));
    }

    Utils.renderTable('hotels-table', topHotels, [
      { key: 'hotel', label: 'Hotel', format: v => Utils.truncate(v, 30) },
      { key: 'totalOrders', label: 'Total Orders', format: v => Utils.formatNumber(v) },
      { key: 'orderValue', label: 'Order Value', format: v => Utils.formatCurrency(v) },
      { key: 'qtyOrdered', label: 'Qty Ordered', format: v => Utils.formatNumber(v) },
    ]);
  }

  return { render, mount };
})();

// ─────────────────────────────────────────────────────────────────────────────
//  BRAND & SUPPLIER PAGE
// ─────────────────────────────────────────────────────────────────────────────
GovSpirit.Pages.brandSupplier = (function () {
  const { Utils, Store, FilterManager } = GovSpirit;

  function render() {
    const kpis = Store.getState().kpis;
    return `
      <div class="page-content">
        ${Utils.sectionHeader('Brand & Supplier Analytics', 'Performance analysis by brand and supplier')}
        <div class="chart-grid-2">
          ${Utils.chartCard('brand-chart', 'Top Brands by Inventory Value', Utils.chartCanvas('chart-brand'), { height: '300px' })}
          ${Utils.chartCard('supplier-chart', 'Top Suppliers by Value', Utils.chartCanvas('chart-supplier'), { height: '300px' })}
        </div>
        <div class="chart-grid-2">
          ${Utils.chartCard('category-sunburst', 'Category Breakdown', Utils.chartCanvas('chart-cat-detail'), { height: '280px' })}
          ${Utils.chartCard('brand-qty', 'Brand Dispatch Volume', Utils.chartCanvas('chart-brand-qty'), { height: '280px' })}
        </div>
        <div class="chart-card mt-2">
          <div class="chart-card-header"><div class="chart-card-title">Brand Performance Table</div></div>
          <div id="brand-table"></div>
        </div>
      </div>`;
  }

  function mount() {
    const kpis = Store.getState().kpis;
    const inv = FilterManager.applyToInventory(Store.getState().processedData.inventory || []);
    const dispatch = FilterManager.applyToDispatch(Store.getState().processedData.dispatch || []);

    const brands = kpis.topBrands?.slice(0, 10) || [];
    if (brands.length) {
      const ctx = document.getElementById('chart-brand')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-brand', new Chart(ctx, {
        type: 'bar',
        data: { labels: brands.map(b => Utils.truncate(b.brand, 15)), datasets: [{ label: 'Value', data: brands.map(b => b.value), backgroundColor: brands.map((_, i) => Utils.getChartColor(i) + 'cc'), borderRadius: 4 }] },
        options: gsChartDefaults()
      }));
    }

    const suppliers = kpis.topSuppliers?.slice(0, 8) || [];
    if (suppliers.length) {
      const ctx = document.getElementById('chart-supplier')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-supplier', new Chart(ctx, {
        type: 'bar',
        data: { labels: suppliers.map(s => Utils.truncate(s.supplier, 20)), datasets: [{ label: 'Value', data: suppliers.map(s => s.value), backgroundColor: suppliers.map((_, i) => Utils.getChartColor(i + 3) + 'cc'), borderRadius: 4 }] },
        options: { ...gsChartDefaults(), indexAxis: 'y' }
      }));
    }

    const cats = kpis.topCategories || [];
    if (cats.length) {
      const ctx = document.getElementById('chart-cat-detail')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-cat-detail', new Chart(ctx, {
        type: 'doughnut',
        data: { labels: cats.map(c => c.category), datasets: [{ data: cats.map(c => c.value), backgroundColor: cats.map((_, i) => Utils.getChartColor(i) + 'cc'), borderWidth: 0, hoverOffset: 8 }] },
        options: { ...gsChartDefaults({ legend: true, legendPos: 'right', noScales: true }), cutout: '55%' }
      }));
    }

    // Brand dispatch volume
    const brandDispatch = Utils.groupBy(dispatch, 'brand');
    const brandDispData = Object.entries(brandDispatch).map(([b, items]) => ({ brand: b, qty: Utils.sumBy(items, 'quantity_dispatched') })).sort((a, b) => b.qty - a.qty).slice(0, 10);
    if (brandDispData.length) {
      const ctx = document.getElementById('chart-brand-qty')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-brand-qty', new Chart(ctx, {
        type: 'bar',
        data: { labels: brandDispData.map(b => Utils.truncate(b.brand, 15)), datasets: [{ label: 'Qty Dispatched', data: brandDispData.map(b => b.qty), backgroundColor: '#8b5cf6cc', borderRadius: 4 }] },
        options: gsChartDefaults()
      }));
    }

    Utils.renderTable('brand-table', brands, [
      { key: 'brand', label: 'Brand' },
      { key: 'skus', label: 'SKUs', format: v => Utils.formatNumber(v) },
      { key: 'qty', label: 'Bottles', format: v => Utils.formatNumber(v) },
      { key: 'value', label: 'Inventory Value', format: v => Utils.formatCurrency(v) },
    ]);
  }

  return { render, mount };
})();

// ─────────────────────────────────────────────────────────────────────────────
//  STOCK AGING PAGE
// ─────────────────────────────────────────────────────────────────────────────
GovSpirit.Pages.stockAging = (function () {
  const { Utils, Store } = GovSpirit;

  function render() {
    const aging = Store.getState().aging;
    const kpis = Store.getState().kpis;
    return `
      <div class="page-content">
        ${Utils.sectionHeader('Stock Aging & Dead Stock', 'Aging analysis, damage register, and return tracking')}
        <div class="kpi-grid">
          ${Utils.kpiCard({ id: 'dead3', title: 'Dead Stock SKUs', value: kpis.deadStockCount, subtitle: Utils.formatCurrency(kpis.deadStockValue), icon: '💀', color: 'red' })}
          ${Utils.kpiCard({ id: 'avg-age', title: 'Avg Storage Days', value: Math.round(kpis.avgStorageDays) + 'd', subtitle: 'Across all SKUs', icon: '📅', color: 'amber' })}
          ${Utils.kpiCard({ id: 'damaged3', title: 'Damaged Units', value: kpis.totalDamaged, subtitle: Utils.formatCurrency(kpis.damageValue), icon: '💔', color: 'rose' })}
          ${Utils.kpiCard({ id: 'returned3', title: 'Returned Units', value: kpis.totalReturned, subtitle: Utils.formatCurrency(kpis.returnValue), icon: '↩️', color: 'orange' })}
        </div>
        <div class="chart-grid-2">
          ${Utils.chartCard('aging-buckets', 'Aging Distribution', Utils.chartCanvas('chart-aging'), { height: '260px', subtitle: 'SKUs by days in stock' })}
          ${Utils.chartCard('dead-by-brand', 'Dead Stock by Brand', Utils.chartCanvas('chart-dead-brand'), { height: '260px' })}
        </div>
        <div class="chart-card mt-2">
          <div class="chart-card-header">
            <div class="chart-card-title">💀 Dead Stock List (90+ days, no movement)</div>
            <button class="btn btn-xs btn-danger" onclick="GovSpirit.Utils.downloadCSV(GovSpirit.Store.getState().aging.deadStock, 'dead_stock.csv')">⬇ Export</button>
          </div>
          <div id="dead-stock-table"></div>
        </div>
        <div class="chart-grid-2 mt-2">
          <div class="chart-card">
            <div class="chart-card-header"><div class="chart-card-title">💔 Damage Register</div></div>
            <div id="damage-table"></div>
          </div>
          <div class="chart-card">
            <div class="chart-card-header"><div class="chart-card-title">↩️ Returns Log</div></div>
            <div id="returns-table"></div>
          </div>
        </div>
      </div>`;
  }

  function mount() {
    const aging = Store.getState().aging;

    // Aging buckets
    const buckets = aging.agingBuckets || [];
    if (buckets.length) {
      const ctx = document.getElementById('chart-aging')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-aging', new Chart(ctx, {
        type: 'bar',
        data: {
          labels: buckets.map(b => b.range + ' days'),
          datasets: [
            { label: 'SKUs', data: buckets.map(b => b.count), backgroundColor: ['#10b981cc', '#3b82f6cc', '#f59e0bcc', '#f43f5ecc'], borderRadius: 4 }
          ]
        },
        options: gsChartDefaults()
      }));
    }

    // Dead stock by brand
    const deadBrand = aging.deadStockByBrand?.slice(0, 8) || [];
    if (deadBrand.length) {
      const ctx = document.getElementById('chart-dead-brand')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-dead-brand', new Chart(ctx, {
        type: 'bar',
        data: { labels: deadBrand.map(b => Utils.truncate(b.brand, 15)), datasets: [{ label: 'Dead SKUs', data: deadBrand.map(b => b.count), backgroundColor: '#f43f5ecc', borderRadius: 4 }] },
        options: gsChartDefaults()
      }));
    }

    Utils.renderTable('dead-stock-table', aging.deadStock || [], [
      { key: 'sku_id', label: 'SKU ID' },
      { key: 'sku_name', label: 'SKU', format: v => Utils.truncate(v, 30) },
      { key: 'brand', label: 'Brand' },
      { key: 'zone', label: 'Zone' },
      { key: 'rack_id', label: 'Rack' },
      { key: 'quantity_bottles', label: 'Qty', format: v => Utils.formatNumber(v) },
      { key: 'total_value', label: 'Value', format: v => Utils.formatCurrency(v) },
      { key: 'days_in_stock', label: 'Age (days)', format: v => `<span style="color:#f43f5e">${v}</span>` },
      { key: 'risk', label: 'Risk', format: v => `<span class="badge ${v === 'High' ? 'badge-danger' : 'badge-warning'}">${v}</span>` },
    ]);

    Utils.renderTable('damage-table', aging.damage || [], [
      { key: 'damage_id', label: 'ID' },
      { key: 'damage_date', label: 'Date', format: v => Utils.formatDate(v) },
      { key: 'sku_name', label: 'SKU', format: v => Utils.truncate(v, 22) },
      { key: 'quantity_damaged', label: 'Qty' },
      { key: 'damage_value', label: 'Value', format: v => Utils.formatCurrency(v) },
      { key: 'cause', label: 'Cause' },
      { key: 'status', label: 'Status', format: v => `<span class="badge ${Utils.getStatusBadgeClass(v)}">${v}</span>` },
    ]);

    Utils.renderTable('returns-table', aging.returns || [], [
      { key: 'return_id', label: 'ID' },
      { key: 'return_date', label: 'Date', format: v => Utils.formatDate(v) },
      { key: 'hotel_name', label: 'Hotel', format: v => Utils.truncate(v, 18) },
      { key: 'sku_name', label: 'SKU', format: v => Utils.truncate(v, 22) },
      { key: 'quantity_returned', label: 'Qty' },
      { key: 'return_value', label: 'Value', format: v => Utils.formatCurrency(v) },
      { key: 'reason', label: 'Reason', format: v => Utils.truncate(v, 25) },
    ]);
  }

  return { render, mount };
})();

// ─────────────────────────────────────────────────────────────────────────────
//  EMPLOYEES PAGE
// ─────────────────────────────────────────────────────────────────────────────
GovSpirit.Pages.employees = (function () {
  const { Utils, Store } = GovSpirit;

  function render() {
    const kpis = Store.getState().kpis;
    return `
      <div class="page-content">
        ${Utils.sectionHeader('Employee Productivity', 'Workforce performance and shift analytics')}
        <div class="kpi-grid">
          ${Utils.kpiCard({ id: 'emp-picks', title: 'Avg Picks/Hour', value: kpis.avgPicksPerHour, subtitle: 'Across all pickers', icon: '⚡', color: 'blue' })}
          ${Utils.kpiCard({ id: 'emp-accuracy', title: 'Avg Pick Accuracy', value: Utils.formatPercent(kpis.avgAccuracy), subtitle: 'Employee average', icon: '🎯', color: 'green' })}
        </div>
        <div class="chart-grid-2">
          ${Utils.chartCard('emp-productivity', 'Picks per Hour by Employee', Utils.chartCanvas('chart-emp-picks'), { height: '280px' })}
          ${Utils.chartCard('emp-accuracy-chart', 'Pick Accuracy by Employee', Utils.chartCanvas('chart-emp-acc'), { height: '280px' })}
        </div>
        <div class="chart-card mt-2">
          <div class="chart-card-header"><div class="chart-card-title">Employee Performance Table</div></div>
          <div id="employees-table"></div>
        </div>
      </div>`;
  }

  function mount() {
    const employees = Store.getState().rawData.employees || [];
    const pickers = employees.filter(e => e.role === 'Picker' || e.role === 'Packer');

    if (pickers.length) {
      const ctx = document.getElementById('chart-emp-picks')?.getContext('2d');
      if (ctx) Utils.registerChart('chart-emp-picks', new Chart(ctx, {
        type: 'bar',
        data: { labels: pickers.map(e => e.employee_name.split(' ')[0]), datasets: [{ label: 'Picks/Hour', data: pickers.map(e => e.picks_per_hour || 0), backgroundColor: pickers.map((_, i) => Utils.getChartColor(i) + 'cc'), borderRadius: 4 }] },
        options: gsChartDefaults()
      }));

      const ctx2 = document.getElementById('chart-emp-acc')?.getContext('2d');
      if (ctx2) Utils.registerChart('chart-emp-acc', new Chart(ctx2, {
        type: 'bar',
        data: { labels: pickers.map(e => e.employee_name.split(' ')[0]), datasets: [{ label: 'Accuracy %', data: pickers.map(e => e.accuracy_rate || 0), backgroundColor: '#10b981cc', borderRadius: 4 }] },
        options: { ...gsChartDefaults(), scales: { x: { grid: { color: '#1c2030' }, ticks: { color: '#555b78' } }, y: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', callback: v => v + '%' }, min: 90, max: 100 } } }
      }));
    }

    Utils.renderTable('employees-table', employees, [
      { key: 'employee_id', label: 'ID' },
      { key: 'employee_name', label: 'Name' },
      { key: 'role', label: 'Role', format: v => `<span class="badge badge-info">${v}</span>` },
      { key: 'shift', label: 'Shift' },
      { key: 'picks_per_hour', label: 'Picks/Hr', format: v => parseFloat(v).toFixed(1) },
      { key: 'accuracy_rate', label: 'Accuracy', format: v => Utils.formatPercent(v) },
      { key: 'orders_completed', label: 'Orders Done', format: v => Utils.formatNumber(v) },
      { key: 'performance_score', label: 'Score', format: v => `<span style="color:${parseFloat(v) >= 90 ? '#10b981' : parseFloat(v) >= 75 ? '#f59e0b' : '#f43f5e'}">${parseFloat(v).toFixed(0)}</span>` },
    ]);
  }

  return { render, mount };
})();

// ─────────────────────────────────────────────────────────────────────────────
//  RECOMMENDATIONS PAGE
// ─────────────────────────────────────────────────────────────────────────────
GovSpirit.Pages.recommendations = (function () {
  const { Utils, Store } = GovSpirit;

  function render() {
    const recs = Store.getState().recommendations;
    const priorityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    recs.forEach(r => { priorityCounts[r.priority] = (priorityCounts[r.priority] || 0) + 1; });

    return `
      <div class="page-content">
        ${Utils.sectionHeader('AI Recommendations', 'Data-driven insights and actionable recommendations')}
        <div class="rec-summary-bar">
          <div class="rec-summary-item rec-critical"><span class="rec-count">${priorityCounts.CRITICAL}</span><span>Critical</span></div>
          <div class="rec-summary-item rec-high"><span class="rec-count">${priorityCounts.HIGH}</span><span>High</span></div>
          <div class="rec-summary-item rec-medium"><span class="rec-count">${priorityCounts.MEDIUM}</span><span>Medium</span></div>
          <div class="rec-summary-item rec-low"><span class="rec-count">${priorityCounts.LOW}</span><span>Low</span></div>
        </div>
        <div class="rec-list" id="rec-list">
          ${recs.length ? recs.map(rec => renderRecCard(rec)).join('') : Utils.emptyState('No recommendations generated', '🤖')}
        </div>
      </div>`;
  }

  function renderRecCard(rec) {
    const metrics = (rec.metrics || []).map(m => `
      <div class="rec-metric">
        <div class="rec-metric-icon">${m.icon}</div>
        <div><div class="rec-metric-val">${m.value}</div><div class="rec-metric-lbl">${m.label}</div></div>
      </div>`).join('');

    const desc = rec.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    const impact = rec.impact.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const action = rec.action.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

    return `
      <div class="rec-card rec-priority-${rec.priority.toLowerCase()}">
        <div class="rec-card-header">
          <div class="rec-priority-badge" style="background:${rec.priorityColor}20;color:${rec.priorityColor}">
            ${rec.priorityIcon} ${rec.priorityLabel}
          </div>
          <div class="rec-category-badge">${rec.category}</div>
        </div>
        <div class="rec-card-title">${rec.title}</div>
        <div class="rec-metrics">${metrics}</div>
        <div class="rec-section">
          <div class="rec-section-label">📋 Situation</div>
          <div class="rec-section-text">${desc}</div>
        </div>
        <div class="rec-section">
          <div class="rec-section-label">📈 Expected Impact</div>
          <div class="rec-section-text">${impact}</div>
        </div>
        <div class="rec-section rec-action-section">
          <div class="rec-section-label">✅ Recommended Action</div>
          <div class="rec-section-text">${action}</div>
        </div>
        <div class="rec-card-footer">
          <span class="rec-timestamp">Generated: ${Utils.formatDate(rec.createdAt)}</span>
          <span class="rec-id">${rec.id}</span>
        </div>
      </div>`;
  }

  function mount() { /* No charts needed */ }

  return { render, mount };
})();

// ─────────────────────────────────────────────────────────────────────────────
//  SEARCH PAGE
// ─────────────────────────────────────────────────────────────────────────────
GovSpirit.Pages.search = (function () {
  const { Utils, Store } = GovSpirit;

  function render() {
    return `
      <div class="page-content">
        ${Utils.sectionHeader('Global Search', 'Search across inventory, orders, SKUs, hotels, racks')}
        <div class="search-bar-large">
          <span class="search-bar-icon">🔍</span>
          <input type="text" id="search-global-input" class="search-bar-input" placeholder="Search SKU, brand, hotel, rack, supplier...">
        </div>
        <div id="search-results" class="search-results-container">
          <div class="search-placeholder">Start typing to search across all warehouse data</div>
        </div>
      </div>`;
  }

  function mount() {
    const inv = Store.getState().processedData.inventory || [];
    const orders = Store.getState().processedData.orders || [];
    const dispatch = Store.getState().processedData.dispatch || [];

    // Build search corpus
    const corpus = [
      ...inv.map(r => ({ type: 'Inventory', icon: '📦', label: r.sku_name, sub: `${r.brand} · ${r.zone} · ${r.rack_id}`, data: r })),
      ...Utils.unique(orders, 'hotel_name').map(r => ({ type: 'Hotel', icon: '🏨', label: r.hotel_name, sub: `${r.quantity_ordered} bottles ordered`, data: r })),
      ...dispatch.map(r => ({ type: 'Dispatch', icon: '🚛', label: r.dispatch_id, sub: `${r.hotel_name} · ${r.sku_name}`, data: r })),
    ];

    const input = document.getElementById('search-global-input');
    input?.addEventListener('input', Utils.debounce((e) => {
      const query = e.target.value.trim();
      if (!query) { document.getElementById('search-results').innerHTML = '<div class="search-placeholder">Start typing to search across all warehouse data</div>'; return; }

      const results = corpus.filter(item => {
        const haystack = (item.label + ' ' + item.sub).toLowerCase();
        return query.toLowerCase().split(' ').every(word => haystack.includes(word));
      }).slice(0, 50);

      const container = document.getElementById('search-results');
      if (!results.length) { container.innerHTML = Utils.emptyState('No results found for "' + query + '"', '🔍'); return; }
      container.innerHTML = `
        <div class="search-count">${results.length} results for "${query}"</div>
        ${results.map(r => `
          <div class="search-result-item">
            <span class="search-result-icon">${r.icon}</span>
            <div>
              <div class="search-result-label">${highlight(r.label, query)}</div>
              <div class="search-result-sub">${highlight(r.sub, query)}</div>
            </div>
            <span class="search-result-type">${r.type}</span>
          </div>`).join('')}`;
    }, 200));

    input?.focus();
  }

  function highlight(text, query) {
    if (!text || !query) return text || '';
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).replace(re, '<mark>$1</mark>');
  }

  return { render, mount };
})();
