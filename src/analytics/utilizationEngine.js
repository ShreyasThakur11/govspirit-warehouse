/**
 * GovSpirit space and fleet utilisation.
 *
 * The previous version also produced an "hourly pressure" series built from
 * `Math.random()` and rendered it as if it were measured warehouse activity.
 * It has been removed rather than restyled: presenting random numbers as
 * operational data in a decision-support tool is a defect, not a feature.
 * If hourly analysis is wanted, it needs timestamped picks. See docs/roadmap.md.
 */
(function initUtilizationEngine(GovSpirit) {
  'use strict';

  const { Collections, Charts, Store } = GovSpirit.require('Collections', 'Charts', 'Store');

  const CRITICAL = 90;
  const HIGH = 75;
  const MEDIUM = 50;
  const SPARSE = 30;
  const UNDERUSED = 40;

  function statusFor(utilisation) {
    if (utilisation >= CRITICAL) return 'Critical';
    if (utilisation >= HIGH) return 'High';
    if (utilisation >= MEDIUM) return 'Medium';
    return 'Low';
  }

  function decorate(row) {
    return {
      ...row,
      status: statusFor(row.utilization),
      color: Charts.utilisationColor(row.utilization),
    };
  }

  function analyze() {
    const zones = Store.zones().map(decorate);
    const racks = Store.racks().map(decorate);
    const dispatch = Store.dispatch();

    const vehicleUtil = Object.entries(Collections.groupBy(dispatch, 'vehicle'))
      .filter(([vehicle]) => vehicle && vehicle !== '__unkeyed__')
      .map(([vehicle, trips]) => ({
        vehicle,
        trips: trips.length,
        totalQty: Collections.sumBy(trips, 'quantity_dispatched'),
        totalValue: Collections.sumBy(trips, 'dispatch_value'),
        avgLoad: Collections.roundTo(Collections.avgBy(trips, 'quantity_dispatched'), 1),
      }))
      .sort((a, b) => b.trips - a.trips);

    const utilization = {
      zoneUtil: zones,
      rackUtil: racks,
      congestedRacks: racks.filter((r) => r.utilization >= CRITICAL).length,
      sparseRacks: racks.filter((r) => r.utilization < SPARSE).length,
      underutilizedRacks: racks.filter((r) => r.utilization < UNDERUSED).length,
      vehicleUtil,
      topCongestedZones: zones
        .filter((z) => z.utilization >= HIGH)
        .sort((a, b) => b.utilization - a.utilization),
      underutilizedZones: zones
        .filter((z) => z.utilization < UNDERUSED)
        .sort((a, b) => a.utilization - b.utilization),
      /** True when no layout file was supplied, so capacities are estimates. */
      estimated: zones.some((z) => z.capacityEstimated),
    };

    Store.setUtilization(utilization);
    return utilization;
  }

  GovSpirit.UtilizationEngine = { analyze, statusFor, CRITICAL, HIGH, UNDERUSED };
})(window.GovSpirit);
