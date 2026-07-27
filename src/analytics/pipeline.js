/**
 * GovSpirit analytics pipeline.
 *
 * One entry point that every data source funnels through, so the import page,
 * the paste page and the demo loader cannot drift out of step with each other.
 * Previously each caller re-listed the engines by hand and one of them was
 * already missing a step.
 */
(function initPipeline(GovSpirit) {
  'use strict';

  const {
    DataTransformer,
    KpiEngine,
    ClassificationEngine,
    AgingEngine,
    UtilizationEngine,
    RecommendationEngine,
    Store,
    EventBus,
    Events,
  } = GovSpirit.require(
    'DataTransformer',
    'KpiEngine',
    'ClassificationEngine',
    'AgingEngine',
    'UtilizationEngine',
    'RecommendationEngine',
    'Store',
    'EventBus',
    'Events'
  );

  /** Ordered stages. Each depends on the state left by the previous one. */
  const STAGES = [
    { name: 'Normalising records', run: () => DataTransformer.transformAll(Store.rawData()) },
    { name: 'Computing KPIs', run: () => KpiEngine.calculate() },
    { name: 'Classifying stock', run: () => ClassificationEngine.classify() },
    { name: 'Analysing stock age', run: () => AgingEngine.analyze() },
    { name: 'Measuring utilisation', run: () => UtilizationEngine.analyze() },
    { name: 'Generating recommendations', run: () => RecommendationEngine.generate() },
  ];

  /**
   * Run every stage against whatever is currently in the raw store.
   *
   * @param {object} [options]
   * @param {string} [options.source] label describing where the data came from
   * @param {(stage: {name: string, index: number, total: number}) => void} [options.onStage]
   * @returns {{ok: boolean, error?: Error, stage?: string}}
   */
  function run({ source = 'Imported data', onStage } = {}) {
    Store.setProcessing(true);

    try {
      STAGES.forEach((stage, index) => {
        if (typeof onStage === 'function') {
          onStage({ name: stage.name, index, total: STAGES.length });
        }
        stage.run();
      });

      Store.setDataLoaded(true, source);
      Store.setProcessing(false);
      EventBus.emit(Events.DATA_LOADED, { source, rows: Store.inventory().length });
      return { ok: true };
    } catch (err) {
      Store.setProcessing(false);
      Store.setDataLoaded(false);
      console.error('[Pipeline] Analytics run failed:', err);
      return { ok: false, error: err, stage: err.stage };
    }
  }

  /** Re-run only the derived analytics, leaving raw and normalised data alone. */
  function recompute() {
    try {
      KpiEngine.calculate();
      ClassificationEngine.classify();
      AgingEngine.analyze();
      UtilizationEngine.analyze();
      RecommendationEngine.generate();
      return { ok: true };
    } catch (err) {
      console.error('[Pipeline] Recompute failed:', err);
      return { ok: false, error: err };
    }
  }

  GovSpirit.Pipeline = { run, recompute, STAGES };
})(window.GovSpirit);
