/**
 * GovSpirit Recommendation Engine
 * Rule-based AI recommendations from warehouse analytics data
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.RecommendationEngine = (function () {
  const { Utils, Store } = GovSpirit;

  const PRIORITIES = { CRITICAL: { label: 'Critical', color: '#f43f5e', icon: '🚨' }, HIGH: { label: 'High', color: '#f97316', icon: '⚠️' }, MEDIUM: { label: 'Medium', color: '#f59e0b', icon: '💡' }, LOW: { label: 'Low', color: '#3b82f6', icon: 'ℹ️' } };

  function generate() {
    const state = Store.getState();
    const inv = state.processedData.inventory || [];
    const dispatch = state.processedData.dispatch || [];
    const orders = state.processedData.orders || [];
    const zones = state.processedData.zones || [];
    const racks = state.processedData.racks || [];
    const kpis = state.kpis || {};
    const classifications = state.classifications || {};
    const aging = state.aging || {};
    const utilization = state.utilization || {};

    const recommendations = [];

    // ─── Rule 1: Fast Movers in Poor Locations ────────────────────────────

    const skuDispatchCount = {};
    dispatch.forEach(d => {
      if (d.sku_id) skuDispatchCount[d.sku_id] = (skuDispatchCount[d.sku_id] || 0) + d.quantity_dispatched;
    });
    const totalDispatched = Object.values(skuDispatchCount).reduce((s, v) => s + v, 0);

    // Find top 5 dispatched SKUs not in A or B zone
    const fastMoversInBadZones = inv
      .filter(r => {
        const share = skuDispatchCount[r.sku_id] ? skuDispatchCount[r.sku_id] / totalDispatched : 0;
        return share > 0.05 && !['A', 'B'].includes(r.zone);
      })
      .map(r => ({ ...r, dispatch_share: skuDispatchCount[r.sku_id] / totalDispatched }))
      .sort((a, b) => b.dispatch_share - a.dispatch_share)
      .slice(0, 3);

    fastMoversInBadZones.forEach(item => {
      const nearestZone = 'A';
      const nearestRack = zones.find(z => z.zone === nearestZone && z.utilization < 80);
      const travelReduction = Math.round(20 + item.dispatch_share * 200);
      recommendations.push({
        id: Utils.generateId('rec'),
        type: 'relocation',
        priority: 'HIGH',
        title: `Relocate Fast-Mover: ${Utils.truncate(item.sku_name, 25)}`,
        description: `${item.sku_name} accounts for **${(item.dispatch_share * 100).toFixed(1)}%** of all dispatches but is stored in Zone ${item.zone} (${item.rack_id}), far from the loading dock.`,
        impact: `Estimated picker travel reduction: **~${travelReduction}%**. Reducing travel time by ${Math.round(travelReduction * 0.3)} minutes per order cycle.`,
        action: `Move SKU **${item.sku_id}** from Rack **${item.rack_id}** → Zone A (front-of-warehouse, near loading dock).`,
        metrics: [
          { label: 'Dispatch Share', value: Utils.formatPercent(item.dispatch_share * 100), icon: '📤' },
          { label: 'Current Zone', value: item.zone + ' — ' + item.rack_id, icon: '📍' },
          { label: 'Travel Reduction', value: travelReduction + '%', icon: '🚶' },
        ],
        createdAt: new Date().toISOString(),
        category: 'Slotting',
        sku_id: item.sku_id,
      });
    });

    // ─── Rule 2: Congested Racks next to Empty Racks ─────────────────────

    if (utilization.rackUtil) {
      const congestedRacks = utilization.rackUtil.filter(r => r.utilization >= 90);
      const emptyRacks = utilization.rackUtil.filter(r => r.utilization < 30);

      if (congestedRacks.length > 0 && emptyRacks.length > 0) {
        congestedRacks.slice(0, 2).forEach(cr => {
          const nearEmptyRack = emptyRacks.find(er => Math.abs(er.zone?.charCodeAt(0) - cr.zone?.charCodeAt(0)) <= 1);
          const targetRack = nearEmptyRack || emptyRacks[0];
          if (!targetRack) return;

          recommendations.push({
            id: Utils.generateId('rec'),
            type: 'rebalancing',
            priority: 'HIGH',
            title: `Rebalance Rack Inventory: ${cr.rack_id}`,
            description: `Rack **${cr.rack_id}** (Zone ${cr.zone}) is at **${cr.utilization.toFixed(0)}% capacity** while Rack **${targetRack.rack_id}** (Zone ${targetRack.zone}) is only at **${targetRack.utilization.toFixed(0)}%** capacity.`,
            impact: `Moving stock will reduce congestion risk, improve picker access, and lower the risk of forklift accidents. Estimated handling improvement: 15-25%.`,
            action: `Transfer ~${Math.round(cr.numSkus * 0.3)} SKUs from Rack **${cr.rack_id}** → Rack **${targetRack.rack_id}** to achieve ~75% balanced utilization.`,
            metrics: [
              { label: 'Congested Rack', value: cr.rack_id + ' (' + cr.utilization.toFixed(0) + '%)', icon: '🔴' },
              { label: 'Target Rack', value: targetRack.rack_id + ' (' + targetRack.utilization.toFixed(0) + '%)', icon: '🟢' },
              { label: 'SKUs to Move', value: Math.round(cr.numSkus * 0.3), icon: '📦' },
            ],
            createdAt: new Date().toISOString(),
            category: 'Rebalancing',
          });
        });
      }
    }

    // ─── Rule 3: Zone Congestion ──────────────────────────────────────────

    if (utilization.zoneUtil) {
      const overloadedZones = utilization.zoneUtil.filter(z => z.utilization >= 85);
      const underZones = utilization.zoneUtil.filter(z => z.utilization < 45);

      if (overloadedZones.length > 0 && underZones.length > 0) {
        overloadedZones.slice(0, 2).forEach(oz => {
          const targetZone = underZones[0];
          recommendations.push({
            id: Utils.generateId('rec'),
            type: 'zone_rebalancing',
            priority: 'MEDIUM',
            title: `Zone Congestion Alert: Zone ${oz.zone}`,
            description: `Zone **${oz.zone}** has utilization at **${oz.utilization}%**, creating picker congestion and safety risks. Zone **${targetZone.zone}** has significant spare capacity at **${targetZone.utilization}%**.`,
            impact: `Redistributing medium-demand SKUs would reduce congestion by ~30%, improve picker safety, and reduce pick time by 10-15%.`,
            action: `Move medium-velocity SKUs (B-class) from Zone **${oz.zone}** → Zone **${targetZone.zone}** to balance warehouse load.`,
            metrics: [
              { label: 'Zone ' + oz.zone + ' Util', value: oz.utilization + '%', icon: '🔴' },
              { label: 'Zone ' + targetZone.zone + ' Util', value: targetZone.utilization + '%', icon: '🟢' },
              { label: 'Congestion Risk', value: oz.utilization >= 90 ? 'Critical' : 'High', icon: '⚠️' },
            ],
            createdAt: new Date().toISOString(),
            category: 'Zone Management',
          });
        });
      }
    }

    // ─── Rule 4: Dead Stock Alert ─────────────────────────────────────────

    if (aging.deadStock && aging.deadStock.length > 0) {
      const deadCount = aging.deadStock.length;
      const deadValue = Utils.sumBy(aging.deadStock, 'total_value');
      const priority = deadValue > 500000 ? 'CRITICAL' : deadCount > 10 ? 'HIGH' : 'MEDIUM';

      recommendations.push({
        id: Utils.generateId('rec'),
        type: 'dead_stock',
        priority,
        title: `Dead Stock Exceeds Threshold — ${deadCount} SKUs`,
        description: `**${deadCount} SKUs** (${Utils.formatCurrency(deadValue)} value) have had zero dispatch activity for **90+ days**. This is occupying prime warehouse space and represents tied-up capital.`,
        impact: `Clearing dead stock would free ${deadCount} bin locations and recover ${Utils.formatCurrency(deadValue)} in capital. Recommend management review and write-off or redistribution.`,
        action: `1. Flag dead stock list for management review.\n2. Consider returning to central warehouse.\n3. Investigate if demand exists in other locations.\n4. Initiate write-off process for items >180 days.`,
        metrics: [
          { label: 'Dead SKUs', value: deadCount, icon: '💀' },
          { label: 'Dead Value', value: Utils.formatCurrency(deadValue), icon: '💰' },
          { label: 'Space Occupied', value: deadCount + ' bins', icon: '📦' },
        ],
        createdAt: new Date().toISOString(),
        category: 'Inventory Management',
        affectedSkus: aging.deadStock.slice(0, 5).map(s => s.sku_name),
      });
    }

    // ─── Rule 5: Low Fill Rate Alert ─────────────────────────────────────

    if (kpis.fillRate < 85) {
      recommendations.push({
        id: Utils.generateId('rec'),
        type: 'fill_rate',
        priority: kpis.fillRate < 70 ? 'CRITICAL' : 'HIGH',
        title: `Order Fill Rate Below Target: ${kpis.fillRate.toFixed(1)}%`,
        description: `The current order fill rate is **${kpis.fillRate.toFixed(1)}%**, below the recommended threshold of 85%. This means hotels are receiving incomplete orders, leading to dissatisfaction.`,
        impact: `Improving fill rate by 10% would improve hotel satisfaction, reduce reorder frequency, and increase dispatch revenue by an estimated 8-12%.`,
        action: `1. Review pending orders for stockout SKUs.\n2. Request government replenishment for low-stock A-class SKUs.\n3. Enable partial dispatch for urgent orders.\n4. Set safety stock levels for top 20 hotels.`,
        metrics: [
          { label: 'Current Fill Rate', value: kpis.fillRate + '%', icon: '📊' },
          { label: 'Target', value: '95%', icon: '🎯' },
          { label: 'Unfulfilled Orders', value: kpis.pendingOrders, icon: '⏳' },
        ],
        createdAt: new Date().toISOString(),
        category: 'Order Fulfillment',
      });
    }

    // ─── Rule 6: Inventory Concentration Risk ─────────────────────────────

    if (kpis.stockConcentration > 60) {
      recommendations.push({
        id: Utils.generateId('rec'),
        type: 'concentration',
        priority: 'MEDIUM',
        title: `High Inventory Concentration Risk`,
        description: `**${kpis.stockConcentration.toFixed(0)}%** of total inventory value is concentrated in the top 10% of SKUs. Any stockout in these items would severely impact operations.`,
        impact: `Diversifying safety stock and improving visibility of high-value SKUs would reduce business risk and improve order fulfillment stability.`,
        action: `1. Establish minimum safety stock levels for top 10% SKUs.\n2. Set priority replenishment alerts.\n3. Distribute concentrated SKUs across multiple rack locations for redundancy.`,
        metrics: [
          { label: 'Concentration', value: kpis.stockConcentration + '% in top 10% SKUs', icon: '⚠️' },
          { label: 'Inventory Value', value: Utils.formatCurrency(kpis.inventoryValue), icon: '💰' },
        ],
        createdAt: new Date().toISOString(),
        category: 'Risk Management',
      });
    }

    // ─── Rule 7: Dispatch Bottleneck ──────────────────────────────────────

    if (kpis.avgDispatchTime > 60) {
      recommendations.push({
        id: Utils.generateId('rec'),
        type: 'dispatch_efficiency',
        priority: 'HIGH',
        title: `Dispatch Time Above Target: ${kpis.avgDispatchTime.toFixed(0)} minutes`,
        description: `Average dispatch time is **${kpis.avgDispatchTime.toFixed(0)} minutes**, well above the target of 45 minutes. This is causing delivery delays and reducing warehouse throughput.`,
        impact: `Reducing dispatch time to 45 minutes could increase daily dispatch capacity by 25-30%, enabling more hotel orders to be processed per shift.`,
        action: `1. Review picking routes — implement zone-based batch picking.\n2. Pre-stage frequent hotel orders.\n3. Implement pick-to-light for top 20 SKUs.\n4. Ensure vehicle scheduling aligns with peak dispatch windows.`,
        metrics: [
          { label: 'Avg Dispatch Time', value: kpis.avgDispatchTime.toFixed(0) + ' min', icon: '⏱️' },
          { label: 'Target', value: '45 min', icon: '🎯' },
          { label: 'Daily Dispatches', value: kpis.last7DispatchCount, icon: '🚛' },
        ],
        createdAt: new Date().toISOString(),
        category: 'Dispatch Efficiency',
      });
    }

    // ─── Rule 8: High Damage Rate ─────────────────────────────────────────

    if (kpis.totalDamaged > 20) {
      recommendations.push({
        id: Utils.generateId('rec'),
        type: 'damage_prevention',
        priority: 'MEDIUM',
        title: `Elevated Damage Level — ${kpis.totalDamaged} Units`,
        description: `**${kpis.totalDamaged} units** (value: ${Utils.formatCurrency(kpis.damageValue)}) have been recorded as damaged. Review storage conditions and handling procedures.`,
        impact: `Reducing damage by 50% would save ${Utils.formatCurrency(kpis.damageValue * 0.5)} annually and improve inventory accuracy.`,
        action: `1. Audit storage conditions in most damaged zones.\n2. Retrain staff on handling glass products.\n3. Add protective padding to bottom racks.\n4. Review forklift speed limits in congested zones.`,
        metrics: [
          { label: 'Damaged Units', value: kpis.totalDamaged, icon: '💔' },
          { label: 'Damage Value', value: Utils.formatCurrency(kpis.damageValue), icon: '💸' },
        ],
        createdAt: new Date().toISOString(),
        category: 'Quality Control',
      });
    }

    // Sort by priority
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Add priority metadata
    recommendations.forEach(r => {
      const p = PRIORITIES[r.priority];
      r.priorityLabel = p.label;
      r.priorityColor = p.color;
      r.priorityIcon = p.icon;
    });

    Store.setRecommendations(recommendations);
    return recommendations;
  }

  return { generate, PRIORITIES };
})();
