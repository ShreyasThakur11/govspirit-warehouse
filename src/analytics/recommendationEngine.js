/**
 * GovSpirit recommendation engine.
 *
 * Deterministic, rule-based advice derived from the computed analytics. It is
 * described in the UI as "rule-based", not as machine learning, because that
 * is what it is: a set of thresholds an operations manager could check by
 * hand, applied consistently and ranked by priority.
 *
 * Every rule states the observation, the expected effect and a concrete
 * action. Where a rule quotes an improvement range, that range is presented as
 * an industry rule of thumb rather than a prediction from this dataset.
 */
(function initRecommendationEngine(GovSpirit) {
  'use strict';

  const { Format, Collections, Store } = GovSpirit.require('Format', 'Collections', 'Store');

  const PRIORITIES = Object.freeze({
    CRITICAL: { label: 'Critical', color: '#f43f5e', icon: 'alertOctagon', rank: 0 },
    HIGH: { label: 'High', color: '#f97316', icon: 'alertTriangle', rank: 1 },
    MEDIUM: { label: 'Medium', color: '#f59e0b', icon: 'lightbulb', rank: 2 },
    LOW: { label: 'Low', color: '#3b82f6', icon: 'info', rank: 3 },
  });

  const THRESHOLDS = Object.freeze({
    // Share of total dispatched volume that makes a SKU worth slotting near
    // the dock. With a catalogue of ~90 lines the average share is ~1%, so 5%
    // (the previous value) was unreachable and the rule never fired.
    fastMoverShare: 0.02,
    congestedRack: 90,
    sparseRack: 30,
    overloadedZone: 85,
    spareZone: 45,
    fillRateTarget: 85,
    concentrationRisk: 60,
    dispatchMinutesTarget: 60,
    damagedUnits: 20,
    deadStockValueCritical: 500000,
  });

  let sequence = 0;
  const nextId = () => {
    sequence += 1;
    return `REC-${String(sequence).padStart(3, '0')}`;
  };

  function generate() {
    sequence = 0;

    const state = Store.getState();
    const inventory = state.processedData.inventory;
    const dispatch = state.processedData.dispatch;
    const kpis = state.kpis || {};
    const aging = state.aging || {};
    const utilization = state.utilization || {};

    const recommendations = [];
    const add = (rec) => recommendations.push({ ...rec, id: nextId() });

    /* ── 1. Fast movers stored far from the dock ────────────────────────── */

    const dispatchedBySku = Object.create(null);
    dispatch.forEach((row) => {
      if (!row.sku_id) return;
      dispatchedBySku[row.sku_id] = (dispatchedBySku[row.sku_id] || 0) + row.quantity_dispatched;
    });
    const totalDispatched = Object.values(dispatchedBySku).reduce((sum, v) => sum + v, 0);

    if (totalDispatched > 0) {
      const misplaced = inventory
        .filter((row) => {
          const share = Collections.safeDivide(
            dispatchedBySku[row.sku_id] || 0,
            totalDispatched,
            0
          );
          return share > THRESHOLDS.fastMoverShare && !['A', 'B'].includes(row.zone);
        })
        .map((row) => ({
          ...row,
          share: Collections.safeDivide(dispatchedBySku[row.sku_id], totalDispatched, 0),
        }))
        .sort((a, b) => b.share - a.share)
        .slice(0, 3);

      misplaced.forEach((item) => {
        add({
          type: 'slotting',
          priority: 'HIGH',
          category: 'Slotting',
          title: `Relocate fast mover: ${item.sku_name}`,
          description:
            `**${item.sku_name}** accounts for **${Format.percent(item.share * 100)}** of all ` +
            `dispatched volume but is stored in Zone ${item.zone} (${item.rack_id}), away from ` +
            'the loading dock.',
          impact:
            'Moving high-frequency picks close to the dispatch bay is the single highest-return ' +
            'slotting change available. Warehouses typically recover 15–30% of picker walking ' +
            'time from this alone.',
          action:
            `1. Confirm Zone A has free bins near the dock.\n` +
            `2. Move SKU ${item.sku_id} from rack ${item.rack_id} to a Zone A face location.\n` +
            `3. Update the bin master so pick lists reflect the new slot.`,
          metrics: [
            { label: 'Dispatch share', value: Format.percent(item.share * 100), icon: 'truck' },
            {
              label: 'Current location',
              value: `Zone ${item.zone} · ${item.rack_id}`,
              icon: 'mapPin',
            },
            {
              label: 'On hand',
              value: `${Format.number(item.quantity_bottles)} bottles`,
              icon: 'package',
            },
          ],
          skuId: item.sku_id,
        });
      });
    }

    /* ── 2. Congested racks beside sparse ones ──────────────────────────── */

    const racks = utilization.rackUtil || [];
    const congested = racks.filter((r) => r.utilization >= THRESHOLDS.congestedRack);
    const sparse = racks.filter((r) => r.utilization < THRESHOLDS.sparseRack);

    if (congested.length && sparse.length) {
      congested.slice(0, 2).forEach((rack) => {
        // Prefer a spare rack in the same or an adjacent zone so the move is short.
        const nearby =
          sparse.find((r) => r.zone === rack.zone) ||
          sparse.find(
            (r) => Math.abs((r.zone || '').charCodeAt(0) - (rack.zone || '').charCodeAt(0)) <= 1
          ) ||
          sparse[0];
        if (!nearby) return;

        const skusToMove = Math.max(1, Math.round(rack.numSkus * 0.3));
        add({
          type: 'rebalancing',
          priority: 'HIGH',
          category: 'Rebalancing',
          title: `Rebalance rack ${rack.rack_id}`,
          description:
            `Rack **${rack.rack_id}** (Zone ${rack.zone}) is at **${Format.percent(rack.utilization)}** ` +
            `of capacity while rack **${nearby.rack_id}** (Zone ${nearby.zone}) sits at ` +
            `**${Format.percent(nearby.utilization)}**.`,
          impact:
            'Rack congestion slows picking, blocks aisle access and raises the risk of handling ' +
            'damage. Levelling towards roughly 75% restores working clearance.',
          action:
            `1. Identify the ${skusToMove} slowest-moving SKUs currently in ${rack.rack_id}.\n` +
            `2. Transfer them to ${nearby.rack_id}.\n` +
            `3. Re-run this dashboard to confirm both racks land near 75%.`,
          metrics: [
            {
              label: 'Congested rack',
              value: `${rack.rack_id} · ${Format.percent(rack.utilization)}`,
              icon: 'gauge',
            },
            {
              label: 'Target rack',
              value: `${nearby.rack_id} · ${Format.percent(nearby.utilization)}`,
              icon: 'checkCircle',
            },
            { label: 'SKUs to move', value: Format.number(skusToMove), icon: 'package' },
          ],
        });
      });
    }

    /* ── 3. Zone-level congestion ───────────────────────────────────────── */

    const zones = utilization.zoneUtil || [];
    const overloadedZones = zones.filter((z) => z.utilization >= THRESHOLDS.overloadedZone);
    const spareZones = zones.filter((z) => z.utilization < THRESHOLDS.spareZone);

    if (overloadedZones.length && spareZones.length) {
      overloadedZones.slice(0, 2).forEach((zone) => {
        const target = spareZones[0];
        add({
          type: 'zone_rebalancing',
          priority: 'MEDIUM',
          category: 'Zone management',
          title: `Zone ${zone.zone} is running hot`,
          description:
            `Zone **${zone.zone}** is at **${Format.percent(zone.utilization)}** utilisation. ` +
            `Zone **${target.zone}** has spare capacity at **${Format.percent(target.utilization)}**.` +
            `${
              utilization.estimated
                ? ' Capacity is estimated because no warehouse layout file was supplied.'
                : ''
            }`,
          impact:
            'Balancing zone load reduces aisle congestion at shift peaks and gives receiving ' +
            'somewhere to put the next inbound consignment.',
          action:
            `1. Select medium-velocity (B-class) SKUs in Zone ${zone.zone}.\n` +
            `2. Relocate them to Zone ${target.zone}.\n` +
            `3. Leave A-class stock where it is. Proximity to the dock outweighs balance.`,
          metrics: [
            { label: `Zone ${zone.zone}`, value: Format.percent(zone.utilization), icon: 'gauge' },
            {
              label: `Zone ${target.zone}`,
              value: Format.percent(target.utilization),
              icon: 'checkCircle',
            },
            { label: 'SKUs in zone', value: Format.number(zone.numSkus), icon: 'tag' },
          ],
        });
      });
    }

    /* ── 4. Dead stock ──────────────────────────────────────────────────── */

    const deadCount = aging.deadStockTotal || 0;
    if (deadCount > 0) {
      const deadValue = aging.totalDeadValue || 0;
      add({
        type: 'dead_stock',
        priority:
          deadValue > THRESHOLDS.deadStockValueCritical
            ? 'CRITICAL'
            : deadCount > 10
              ? 'HIGH'
              : 'MEDIUM',
        category: 'Inventory management',
        title: `${Format.number(deadCount)} lines have not moved in 90 days`,
        description:
          `**${Format.number(deadCount)}** inventory lines worth **${Format.currency(deadValue)}** ` +
          'have had no dispatch activity for 90 days or more. They are occupying pickable space ' +
          'and tying up working capital.',
        impact:
          `Clearing this stock frees ${Format.number(deadCount)} bin locations and releases ` +
          `${Format.currency(deadValue)} of capital for lines that are actually selling.`,
        action:
          '1. Export the dead stock list and circulate it for management review.\n' +
          '2. Check whether demand exists at another depot before writing anything off.\n' +
          '3. Move confirmed dead stock out of prime zones into back shelving.\n' +
          '4. Begin the write-off process for anything beyond 180 days.',
        metrics: [
          { label: 'Dead lines', value: Format.number(deadCount), icon: 'archiveX' },
          { label: 'Capital tied up', value: Format.currency(deadValue), icon: 'banknote' },
          { label: 'Bins occupied', value: Format.number(deadCount), icon: 'package' },
        ],
      });
    }

    /* ── 5. Fill rate ───────────────────────────────────────────────────── */

    if (
      kpis.fillRate !== null &&
      kpis.fillRate !== undefined &&
      kpis.fillRate < THRESHOLDS.fillRateTarget
    ) {
      add({
        type: 'fill_rate',
        priority: kpis.fillRate < 70 ? 'CRITICAL' : 'HIGH',
        category: 'Order fulfilment',
        title: `Order fill rate is ${Format.percent(kpis.fillRate)}`,
        description:
          `Only **${Format.percent(kpis.fillRate)}** of order lines were fulfilled in full, against ` +
          `a working target of ${THRESHOLDS.fillRateTarget}%. ` +
          `**${Format.number(kpis.pendingOrders)}** orders are still open.`,
        impact:
          'Short-shipped lines generate re-orders, additional dispatch runs and avoidable ' +
          'complaints from licensees. Fill rate is the metric hotels judge the depot on.',
        action:
          '1. Review open orders and list the SKUs causing the shortfall.\n' +
          '2. Raise replenishment for any A-class SKU that stocked out.\n' +
          '3. Set minimum safety stock for the ten highest-volume customers.\n' +
          '4. Allow partial dispatch where the licensee has agreed to it.',
        metrics: [
          { label: 'Current fill rate', value: Format.percent(kpis.fillRate), icon: 'barChart' },
          { label: 'Target', value: `${THRESHOLDS.fillRateTarget}%`, icon: 'target' },
          { label: 'Open orders', value: Format.number(kpis.pendingOrders), icon: 'timer' },
        ],
      });
    }

    /* ── 6. Concentration risk ──────────────────────────────────────────── */

    if (
      kpis.stockConcentration !== null &&
      kpis.stockConcentration > THRESHOLDS.concentrationRisk
    ) {
      add({
        type: 'concentration',
        priority: 'MEDIUM',
        category: 'Risk management',
        title: 'Inventory value is heavily concentrated',
        description:
          `**${Format.percent(kpis.stockConcentration)}** of total inventory value sits in the top ` +
          '10% of lines. A stockout or loss event in any of them has an outsized effect.',
        impact:
          'Spreading concentrated stock across multiple locations limits the damage from a single ' +
          'incident and makes replenishment planning more predictable.',
        action:
          '1. Set explicit minimum stock levels for the top decile by value.\n' +
          '2. Enable replenishment alerts against those levels.\n' +
          '3. Split the highest-value lines across at least two racks.',
        metrics: [
          {
            label: 'Top-decile share',
            value: Format.percent(kpis.stockConcentration),
            icon: 'alertTriangle',
          },
          {
            label: 'Inventory value',
            value: Format.currency(kpis.inventoryValue),
            icon: 'banknote',
          },
        ],
      });
    }

    /* ── 7. Dispatch cycle time ─────────────────────────────────────────── */

    if (kpis.avgDispatchTime !== null && kpis.avgDispatchTime > THRESHOLDS.dispatchMinutesTarget) {
      add({
        type: 'dispatch_efficiency',
        priority: 'HIGH',
        category: 'Dispatch efficiency',
        title: `Dispatch cycle averages ${Format.minutes(kpis.avgDispatchTime)}`,
        description:
          `The mean pick-to-load time is **${Format.minutes(kpis.avgDispatchTime)}**, above the ` +
          `${THRESHOLDS.dispatchMinutesTarget}-minute working target. Throughput per shift is ` +
          'capped by this figure.',
        impact:
          'Bringing the cycle down to 45 minutes would raise the number of consignments a shift ' +
          'can clear without adding staff or vehicles.',
        action:
          '1. Batch-pick orders by zone instead of picking order by order.\n' +
          '2. Pre-stage the standing weekly orders from the largest customers.\n' +
          '3. Check that vehicle arrival windows line up with the pick schedule.\n' +
          '4. Re-slot the top 20 SKUs into the shortest pick path.',
        metrics: [
          { label: 'Average cycle', value: Format.minutes(kpis.avgDispatchTime), icon: 'timer' },
          { label: 'Target', value: '45 min', icon: 'target' },
          {
            label: 'Dispatches (7d)',
            value: Format.number(kpis.last7DispatchCount),
            icon: 'truck',
          },
        ],
      });
    }

    /* ── 8. Damage ──────────────────────────────────────────────────────── */

    if (kpis.totalDamaged > THRESHOLDS.damagedUnits) {
      add({
        type: 'damage_prevention',
        priority: 'MEDIUM',
        category: 'Quality control',
        title: `${Format.number(kpis.totalDamaged)} units recorded as damaged`,
        description:
          `**${Format.number(kpis.totalDamaged)} units**, valued at ` +
          `**${Format.currency(kpis.damageValue)}**, are on the damage register.`,
        impact:
          `Halving the breakage rate would retain roughly ` +
          `${Format.currency(kpis.damageValue * 0.5)} and reduce the reconciliation workload.`,
        action:
          '1. Break the damage register down by zone and identify the worst area.\n' +
          '2. Refresh glass-handling training for the shift involved.\n' +
          '3. Add edge protection to the lowest rack level where impacts occur.\n' +
          '4. Review forklift speed limits in the congested aisles.',
        metrics: [
          { label: 'Damaged units', value: Format.number(kpis.totalDamaged), icon: 'alertOctagon' },
          { label: 'Value', value: Format.currency(kpis.damageValue), icon: 'banknote' },
        ],
      });
    }

    /* ── 9. Missing cycle counts ────────────────────────────────────────── */

    if (!kpis.cycleCountLines) {
      add({
        type: 'data_gap',
        priority: 'LOW',
        category: 'Data quality',
        title: 'No cycle count data supplied',
        description:
          'Inventory accuracy cannot be reported because no physical count file was uploaded. ' +
          'The health score is calculated from the remaining components only.',
        impact:
          'Cycle counting is the only way to know whether the book stock in this dashboard ' +
          'matches what is on the shelf.',
        action:
          '1. Export a bin list for a sample of racks.\n' +
          '2. Count them physically and record system versus actual quantity.\n' +
          '3. Upload the result as a cycle count file and re-run the analysis.',
        metrics: [{ label: 'Counted lines', value: '0', icon: 'hash' }],
      });
    }

    /* ── Rank and decorate ──────────────────────────────────────────────── */

    recommendations.sort((a, b) => PRIORITIES[a.priority].rank - PRIORITIES[b.priority].rank);
    recommendations.forEach((rec) => {
      const meta = PRIORITIES[rec.priority];
      rec.priorityLabel = meta.label;
      rec.priorityColor = meta.color;
      rec.priorityIcon = meta.icon;
    });

    Store.setRecommendations(recommendations);
    return recommendations;
  }

  GovSpirit.RecommendationEngine = { generate, PRIORITIES, THRESHOLDS };
})(window.GovSpirit);
