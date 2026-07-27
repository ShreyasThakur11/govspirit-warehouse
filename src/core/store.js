/**
 * GovSpirit Store: the single source of truth for loaded data and filters.
 *
 * Design notes
 * ------------
 * `getState()` returns a frozen shallow copy. Nested collections are shared by
 * reference (copying tens of thousands of inventory rows on every read would
 * be absurd), but the top level cannot be reassigned from outside, which was
 * previously possible and made state corruption a one-typo affair.
 *
 * Mutation happens only through the named setters below, each of which emits
 * the relevant event so the UI stays in sync without polling.
 */
(function initStore(GovSpirit) {
  'use strict';

  const { EventBus, Events, Format } = GovSpirit.require('EventBus', 'Events', 'Format');

  /** Dataset buckets recognised by the ingestion layer. */
  const RAW_DATASETS = Object.freeze([
    'inventory',
    'skuMaster',
    'orders',
    'dispatch',
    'warehouseLayout',
    'goodsReceipt',
    'stockMovement',
    'suppliers',
    'employees',
    'vehicles',
    'damage',
    'cycleCount',
    'returns',
  ]);

  const PROCESSED_DATASETS = Object.freeze(['inventory', 'orders', 'dispatch', 'zones', 'racks']);

  const FILTER_KEYS = Object.freeze([
    'zone',
    'brand',
    'supplier',
    'hotel',
    'category',
    'bottleSize',
    'alcoholType',
    'sku',
  ]);

  const FILTER_OPTION_KEYS = Object.freeze([
    'zones',
    'brands',
    'suppliers',
    'hotels',
    'categories',
    'bottleSizes',
    'alcoholTypes',
    'skus',
  ]);

  const emptyRecord = (keys, value) =>
    keys.reduce((acc, key) => {
      acc[key] = typeof value === 'function' ? value() : value;
      return acc;
    }, {});

  function createInitialState() {
    return {
      rawData: emptyRecord(RAW_DATASETS, () => []),
      processedData: emptyRecord(PROCESSED_DATASETS, () => []),
      kpis: {},
      classifications: {},
      aging: {},
      utilization: {},
      recommendations: [],
      columnMappings: {},
      validation: { warnings: [], errors: [], score: 0 },
      filters: { ...emptyRecord(FILTER_KEYS, null), dateRange: { from: null, to: null } },
      filterOptions: emptyRecord(FILTER_OPTION_KEYS, () => []),
      filterPanelOpen: false,
      isDataLoaded: false,
      isProcessing: false,
      currentPage: null,
      /** Where the loaded data came from. Shown in the UI and export headers. */
      dataSource: null,
    };
  }

  let state = createInitialState();

  /* ── Reads ────────────────────────────────────────────────────────────── */

  function getState() {
    return Object.freeze({ ...state });
  }

  const inventory = () => state.processedData.inventory;
  const orders = () => state.processedData.orders;
  const dispatch = () => state.processedData.dispatch;
  const zones = () => state.processedData.zones;
  const racks = () => state.processedData.racks;
  const kpis = () => state.kpis;
  const rawData = () => state.rawData;

  /* ── Writes ───────────────────────────────────────────────────────────── */

  function setRawData(dataset, rows) {
    if (!RAW_DATASETS.includes(dataset)) {
      console.warn(`[Store] Ignoring unknown raw dataset "${dataset}".`);
      return;
    }
    state.rawData[dataset] = Array.isArray(rows) ? rows : [];
  }

  function setProcessedData(dataset, rows) {
    if (!PROCESSED_DATASETS.includes(dataset)) {
      console.warn(`[Store] Ignoring unknown processed dataset "${dataset}".`);
      return;
    }
    state.processedData[dataset] = Array.isArray(rows) ? rows : [];
  }

  function setKPIs(next) {
    state.kpis = { ...next };
    EventBus.emit(Events.KPIS_READY, state.kpis);
  }

  function setClassifications(next) {
    state.classifications = next || {};
  }

  function setAging(next) {
    state.aging = next || {};
  }

  function setUtilization(next) {
    state.utilization = next || {};
  }

  function setRecommendations(next) {
    state.recommendations = Array.isArray(next) ? next : [];
    EventBus.emit(Events.RECOMMENDATIONS_READY, state.recommendations);
  }

  function setColumnMappings(mappings) {
    state.columnMappings = { ...(mappings || {}) };
  }

  function setValidation({ warnings = [], errors = [], score = 0 } = {}) {
    state.validation = { warnings, errors, score };
    EventBus.emit(Events.VALIDATION_DONE, state.validation);
  }

  function setFilterOptions(options) {
    state.filterOptions = { ...state.filterOptions, ...(options || {}) };
  }

  function setDataLoaded(loaded, source) {
    state.isDataLoaded = Boolean(loaded);
    if (source !== undefined) state.dataSource = source;
  }

  function setProcessing(processing) {
    state.isProcessing = Boolean(processing);
  }

  function setCurrentPage(pageId) {
    state.currentPage = pageId;
  }

  function setFilterPanelOpen(open) {
    state.filterPanelOpen = Boolean(open);
  }

  function setFilter(key, value) {
    if (key === 'dateRange') {
      state.filters.dateRange = {
        from: value?.from || null,
        to: value?.to || null,
      };
    } else if (FILTER_KEYS.includes(key)) {
      state.filters[key] = value || null;
    } else {
      console.warn(`[Store] Ignoring unknown filter "${key}".`);
      return;
    }
    EventBus.emit(Events.FILTERS_CHANGED, { ...state.filters });
  }

  /**
   * Reset every filter. The previous implementation inferred the reset value
   * from `typeof`, which meant adding any non-string filter silently broke it.
   * Explicit is better.
   */
  function clearFilters() {
    state.filters = { ...emptyRecord(FILTER_KEYS, null), dateRange: { from: null, to: null } };
    EventBus.emit(Events.FILTERS_CHANGED, { ...state.filters });
  }

  function activeFilterCount() {
    const named = FILTER_KEYS.filter((key) => Boolean(state.filters[key])).length;
    const dated = state.filters.dateRange.from || state.filters.dateRange.to ? 1 : 0;
    return named + dated;
  }

  function clearAllData() {
    const { currentPage } = state;
    state = createInitialState();
    state.currentPage = currentPage;
    EventBus.emit(Events.DATA_CLEARED);
  }

  /* ── Filtering ────────────────────────────────────────────────────────── */

  /**
   * Apply the active global filters to a dataset.
   *
   * `fieldMap` maps a filter name to the column that filter applies to for
   * this particular dataset. Inventory calls its customer column nothing at
   * all, orders call it `hotel_name`, and so on. Filters with no mapping are
   * skipped rather than silently matching nothing.
   *
   * @param {object[]} rows
   * @param {Record<string, string>} fieldMap
   */
  function applyFilters(rows, fieldMap = {}) {
    const filters = state.filters;
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const predicates = [];

    FILTER_KEYS.forEach((filterKey) => {
      const wanted = filters[filterKey];
      const column = fieldMap[filterKey];
      if (!wanted || !column) return;
      predicates.push((row) => String(row[column] ?? '') === String(wanted));
    });

    const dateColumn = fieldMap.date;
    const { from, to } = filters.dateRange;
    if (dateColumn && (from || to)) {
      const fromDate = from ? Format.parseDate(from) : null;
      const toDate = to ? Format.parseDate(to) : null;
      // Include the whole of the "to" day rather than cutting it off at 00:00.
      if (toDate) toDate.setHours(23, 59, 59, 999);

      predicates.push((row) => {
        const value = Format.parseDate(row[dateColumn]);
        if (!value) return true; // never hide a row for lacking a date
        if (fromDate && value < fromDate) return false;
        if (toDate && value > toDate) return false;
        return true;
      });
    }

    if (predicates.length === 0) return rows;
    return rows.filter((row) => predicates.every((predicate) => predicate(row)));
  }

  GovSpirit.Store = {
    RAW_DATASETS,
    PROCESSED_DATASETS,
    FILTER_KEYS,
    getState,
    inventory,
    orders,
    dispatch,
    zones,
    racks,
    kpis,
    rawData,
    setRawData,
    setProcessedData,
    setKPIs,
    setClassifications,
    setAging,
    setUtilization,
    setRecommendations,
    setColumnMappings,
    setValidation,
    setFilterOptions,
    setDataLoaded,
    setProcessing,
    setCurrentPage,
    setFilterPanelOpen,
    setFilter,
    clearFilters,
    activeFilterCount,
    clearAllData,
    applyFilters,
  };
})(window.GovSpirit);
