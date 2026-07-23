/**
 * GovSpirit Executive Summary Page
 */
window.GovSpirit = window.GovSpirit || {};
GovSpirit.Pages = GovSpirit.Pages || {};

GovSpirit.Pages.executive = (function () {
  const { Utils, Store, FilterManager } = GovSpirit;

  function getOriginalName(fieldId, fallback) {
    const mappings = Store.getState().columnMappings || {};
    const header = Object.keys(mappings).find(k => mappings[k].fieldId === fieldId && mappings[k].fieldId !== '__skip__');
    return header ? header : fallback;
  }

  function render() {
    const kpis = Store.getState().kpis;
    const recs = Store.getState().recommendations;
    const inv = FilterManager.applyToInventory(Store.getState().processedData.inventory || []);
    const orders = FilterManager.applyToOrders(Store.getState().processedData.orders || []);

    const health = kpis.warehouseHealthScore || 0;
    const healthColor = health >= 80 ? '#10b981' : health >= 60 ? '#f59e0b' : '#f43f5e';
    const healthLabel = health >= 80 ? 'Excellent' : health >= 60 ? 'Good' : 'Needs Attention';

    const brandName = getOriginalName('brand', 'Brand');
    const categoryName = getOriginalName('category', 'Category');
    const zoneName = getOriginalName('zone', 'Zone');
    const skuName = getOriginalName('sku_id', 'SKU');

    return `
      <div class="page-content">
        ${Utils.sectionHeader('Executive Summary', 'Real-time warehouse operations overview',
          `<button class="btn btn-outline btn-sm" onclick="GovSpirit.App.navigate('recommendations')">🤖 ${recs.length} Recommendations</button>`
        )}

        <!-- Health Score Banner -->
        <div class="health-banner" style="--health-color:${healthColor}">
          <div class="health-score-ring">
            <svg viewBox="0 0 100 100" class="health-ring-svg">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" stroke-width="8"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="${healthColor}" stroke-width="8"
                stroke-dasharray="${2.64 * health} 264" stroke-linecap="round" transform="rotate(-90 50 50)"/>
            </svg>
            <div class="health-score-label">
              <div class="health-score-val" style="color:${healthColor}">${health.toFixed(0)}</div>
              <div class="health-score-sub">/ 100</div>
            </div>
          </div>
          <div class="health-info">
            <div class="health-title">Warehouse Health Score</div>
            <div class="health-status" style="color:${healthColor}">${healthLabel}</div>
            <div class="health-components">
              <span class="hc-item">📊 Inventory Accuracy: ${kpis.inventoryAccuracy?.toFixed(1) || '—'}%</span>
              <span class="hc-item">📦 Fill Rate: ${kpis.fillRate?.toFixed(1) || '—'}%</span>
              <span class="hc-item">🏗️ Utilization: ${kpis.storageUtilization?.toFixed(1) || '—'}%</span>
            </div>
          </div>
          <div class="health-alerts">
            ${recs.filter(r => r.priority === 'CRITICAL').length > 0
              ? `<div class="health-alert critical">🚨 ${recs.filter(r => r.priority === 'CRITICAL').length} Critical Issues</div>` : ''}
            ${recs.filter(r => r.priority === 'HIGH').length > 0
              ? `<div class="health-alert high">⚠️ ${recs.filter(r => r.priority === 'HIGH').length} High Priority Actions</div>` : ''}
            ${recs.filter(r => r.priority === 'MEDIUM').length > 0
              ? `<div class="health-alert medium">💡 ${recs.filter(r => r.priority === 'MEDIUM').length} Opportunities</div>` : ''}
          </div>
        </div>

        <!-- KPI Row 1 -->
        <div class="kpi-grid">
          ${Utils.kpiCard({ id: 'inv-value', title: 'Inventory Value', value: Utils.formatCurrency(kpis.inventoryValue), subtitle: `${Utils.formatK(kpis.totalBottles)} bottles across ${kpis.totalSKUs} ${skuName}s`, icon: '💰', color: 'blue', sparkData: kpis.valueTrend })}
          ${Utils.kpiCard({ id: 'utilization', title: 'Storage Utilization', value: Utils.formatPercent(kpis.storageUtilization), subtitle: `${Utils.formatK(kpis.occupiedBins)} of ${Utils.formatK(kpis.totalBins)} bins occupied`, icon: '🏗️', color: kpis.storageUtilization > 85 ? 'red' : kpis.storageUtilization > 65 ? 'amber' : 'green' })}
          ${Utils.kpiCard({ id: 'fill-rate', title: 'Order Fill Rate', value: Utils.formatPercent(kpis.fillRate), subtitle: `${Utils.formatK(kpis.fulfilledLines)} of ${Utils.formatK(kpis.totalOrderLines)} lines fulfilled`, icon: '📤', color: kpis.fillRate >= 90 ? 'green' : kpis.fillRate >= 75 ? 'amber' : 'red', sparkData: kpis.dispatchTrend })}
          ${Utils.kpiCard({ id: 'orders-today', title: 'Orders Today', value: kpis.ordersToday, subtitle: `${kpis.pendingOrders} pending · ${kpis.completedOrders} completed`, icon: '📋', color: 'indigo' })}
          ${Utils.kpiCard({ id: 'inv-accuracy', title: 'Inventory Accuracy', value: Utils.formatPercent(kpis.inventoryAccuracy), subtitle: 'From latest cycle count', icon: '🎯', color: kpis.inventoryAccuracy >= 98 ? 'green' : 'amber' })}
          ${Utils.kpiCard({ id: 'dead-stock', title: 'Dead Stock Items', value: kpis.deadStockCount, subtitle: `Value: ${Utils.formatCurrency(kpis.deadStockValue)}`, icon: '💀', color: kpis.deadStockCount > 10 ? 'red' : 'amber' })}
        </div>

        <!-- Charts Row -->
        <div class="chart-grid-3">
          ${Utils.chartCard('dispatch-trend', '30-Day Dispatch Trend', Utils.chartCanvas('chart-dispatch-trend'), { subtitle: 'Daily dispatch volume', height: '240px' })}
          ${Utils.chartCard('category-breakdown', `Inventory by ${categoryName}`, Utils.chartCanvas('chart-category'), { subtitle: 'By value', height: '240px' })}
          ${Utils.chartCard('zone-util-exec', `${zoneName} Utilization`, Utils.chartCanvas('chart-zone-exec'), { subtitle: 'Current occupancy %', height: '240px' })}
        </div>

        <!-- Insights & Top Hotels -->
        <div class="chart-grid-2">
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-title">🔥 Top Insights</div>
            </div>
            <div class="insights-list" id="exec-insights">
              ${generateInsightsHTML(kpis, recs)}
            </div>
          </div>
          ${Utils.chartCard('top-brands-exec', `Top ${brandName} by Value`, Utils.chartCanvas('chart-top-brands'), { subtitle: 'Inventory value ranking', height: '240px' })}
        </div>

        <!-- Sparkline Row -->
        <div class="kpi-grid">
          ${Utils.kpiCard({ id: 'dispatch-count', title: 'Dispatches (30d)', value: Utils.formatK(kpis.last30DispatchCount), subtitle: 'Last 30 days', icon: '🚛', color: 'violet', sparkData: kpis.dispatchTrend })}
          ${Utils.kpiCard({ id: 'total-skus', title: `Total ${skuName}s`, value: kpis.totalSKUs, subtitle: `${kpis.activeSKUs} active · ${kpis.inactiveSKUs} inactive`, icon: '🏷️', color: 'blue' })}
          ${Utils.kpiCard({ id: 'avg-storage', title: 'Avg Storage Days', value: `${Math.round(kpis.avgStorageDays)} days`, subtitle: `Average dwell time per ${skuName}`, icon: '📅', color: 'amber' })}
          ${Utils.kpiCard({ id: 'dispatch-time', title: 'Avg Dispatch Time', value: `${Math.round(kpis.avgDispatchTime)} min`, subtitle: 'From pick to load', icon: '⏱️', color: kpis.avgDispatchTime > 60 ? 'red' : 'green' })}
          ${Utils.kpiCard({ id: 'turnover', title: 'Inventory Turnover', value: kpis.inventoryTurnover?.toFixed(2) + 'x', subtitle: 'Annual turns', icon: '🔄', color: 'cyan' })}
          ${Utils.kpiCard({ id: 'damage-value', title: 'Damage Value', value: Utils.formatCurrency(kpis.damageValue), subtitle: `${kpis.totalDamaged} units damaged`, icon: '💔', color: 'rose' })}
        </div>
      </div>`;
  }

  function generateInsightsHTML(kpis, recs) {
    const insights = [];
    if (kpis.deadStockCount > 0) insights.push({ type: 'warning', icon: '💀', title: 'Dead Stock Alert', body: `${kpis.deadStockCount} SKUs with no movement in 90+ days (${Utils.formatCurrency(kpis.deadStockValue)} at risk)` });
    if (kpis.storageUtilization > 80) insights.push({ type: 'critical', icon: '🔴', title: 'High Storage Utilization', body: `Warehouse at ${kpis.storageUtilization?.toFixed(0)}% capacity — redistribution recommended` });
    if (kpis.fillRate < 90) insights.push({ type: 'warning', icon: '📉', title: 'Fill Rate Below Target', body: `Current ${kpis.fillRate?.toFixed(1)}% vs 95% target — ${kpis.pendingOrders} orders pending` });
    if (kpis.avgDispatchTime > 60) insights.push({ type: 'warning', icon: '⏱️', title: 'Slow Dispatch Cycle', body: `Average dispatch time ${Math.round(kpis.avgDispatchTime)} minutes — zone optimization needed` });
    if (recs.length > 0) insights.push({ type: 'info', icon: '🤖', title: 'AI Recommendations Ready', body: `${recs.length} data-driven recommendations available to improve operations` });
    if (kpis.inventoryAccuracy >= 98) insights.push({ type: 'success', icon: '✅', title: 'Excellent Inventory Accuracy', body: `${kpis.inventoryAccuracy?.toFixed(1)}% accuracy — warehouse controls are working well` });

    return insights.map(i => `
      <div class="insight-item insight-${i.type}">
        <span class="insight-item-icon">${i.icon}</span>
        <div><div class="insight-item-title">${i.title}</div><div class="insight-item-body">${i.body}</div></div>
      </div>`).join('') || Utils.emptyState('No insights yet', '💡');
  }

  function mount() {
    const kpis = Store.getState().kpis;
    const inv = FilterManager.applyToInventory(Store.getState().processedData.inventory || []);
    const dispatch = FilterManager.applyToDispatch(Store.getState().processedData.dispatch || []);
    const zones = Store.getState().processedData.zones || [];

    // Sparklines
    if (kpis.valueTrend) Utils.createSparkline('spark-inv-value', kpis.valueTrend, '#3b82f6');
    if (kpis.fillRate) Utils.createSparkline('spark-fill-rate', kpis.dispatchTrend, '#10b981');
    if (kpis.dispatchTrend) Utils.createSparkline('spark-dispatch-count', kpis.dispatchTrend, '#8b5cf6');

    // Dispatch trend chart
    if (kpis.last30Days) {
      const ctx = document.getElementById('chart-dispatch-trend')?.getContext('2d');
      if (ctx) {
        const chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: kpis.last30Days.map((d, i) => i % 5 === 0 ? d.slice(5) : ''),
            datasets: [{
              label: 'Dispatches',
              data: kpis.dispatchTrend,
              borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)',
              borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0,
            }, {
              label: 'Orders',
              data: kpis.ordersTrend,
              borderColor: '#10b981', backgroundColor: 'transparent',
              borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0,
              borderDash: [4, 4],
            }]
          },
          options: chartDefaults({ legend: true })
        });
        Utils.registerChart('chart-dispatch-trend', chart);
      }
    }

    // Category breakdown donut
    const catData = kpis.topCategories || [];
    if (catData.length) {
      const ctx = document.getElementById('chart-category')?.getContext('2d');
      if (ctx) {
        const chart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: catData.map(c => c.category),
            datasets: [{ data: catData.map(c => c.value), backgroundColor: catData.map((_, i) => Utils.getChartColor(i)), borderWidth: 2, borderColor: 'transparent', hoverOffset: 8 }]
          },
          options: {
            ...chartDefaults({ legend: true }),
            cutout: '65%',
            plugins: { ...chartDefaults().plugins, legend: { display: true, position: 'right', labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } } } }
          }
        });
        Utils.registerChart('chart-category', chart);
      }
    }

    // Zone utilization bar chart
    if (zones.length) {
      const zoneName = getOriginalName('zone', 'Zone');
      const ctx = document.getElementById('chart-zone-exec')?.getContext('2d');
      if (ctx) {
        const chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: zones.map(z => zoneName + ' ' + z.zone),
            datasets: [{
              label: 'Utilization %',
              data: zones.map(z => z.utilization),
              backgroundColor: zones.map(z => Utils.getUtilizationColor(z.utilization) + 'cc'),
              borderColor: zones.map(z => Utils.getUtilizationColor(z.utilization)),
              borderWidth: 1, borderRadius: 4,
            }]
          },
          options: chartDefaults()
        });
        Utils.registerChart('chart-zone-exec', chart);
      }
    }

    // Top brands chart
    const brandData = kpis.topBrands?.slice(0, 8) || [];
    if (brandData.length) {
      const ctx = document.getElementById('chart-top-brands')?.getContext('2d');
      if (ctx) {
        const chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: brandData.map(b => Utils.truncate(b.brand, 15)),
            datasets: [{ label: 'Value (₹)', data: brandData.map(b => b.value), backgroundColor: brandData.map((_, i) => Utils.getChartColor(i) + 'cc'), borderColor: 'transparent', borderRadius: 4 }]
          },
          options: { ...chartDefaults(), indexAxis: 'y' }
        });
        Utils.registerChart('chart-top-brands', chart);
      }
    }
  }

  function chartDefaults(opts = {}) {
    return {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: opts.legend || false, labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: '#1e2235', titleColor: '#f0f4ff', bodyColor: '#94a3b8', borderColor: '#2d3454', borderWidth: 1 }
      },
      scales: opts.noScales ? {} : {
        x: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', font: { size: 10 } } },
        y: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', font: { size: 10 } } }
      }
    };
  }

  return { render, mount };
})();
