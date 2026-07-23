/**
 * GovSpirit Store — Reactive global state management
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.Store = (function () {
  const { EventBus, Events } = GovSpirit;

  const _state = {
    // Raw parsed data from files
    rawData: {
      inventory: [],
      skuMaster: [],
      orders: [],
      dispatch: [],
      warehouseLayout: [],
      goodsReceipt: [],
      stockMovement: [],
      suppliers: [],
      employees: [],
      vehicles: [],
      damage: [],
      cycleCount: [],
      returns: [],
    },

    // Processed/transformed data
    processedData: {
      inventory: [],
      orders: [],
      dispatch: [],
      skus: [],
      zones: [],
      racks: [],
    },

    // Computed KPIs
    kpis: {},

    // ABC/XYZ classification
    classifications: {},

    // Aging data
    aging: {},

    // Utilization metrics
    utilization: {},

    // Recommendations
    recommendations: [],

    // Active global filters
    filters: {
      dateRange: { from: null, to: null },
      zone: null,
      brand: null,
      supplier: null,
      hotel: null,
      category: null,
      bottleSize: null,
      alcoholType: null,
      sku: null,
      employee: null,
      shift: null,
      searchQuery: '',
    },

    // Column mappings from auto-mapper or user-confirmed
    columnMappings: {},

    // Detected file types and their mapping quality
    fileMetadata: {},

    // Validation warnings/errors
    validationWarnings: [],
    validationErrors: [],
    dataQualityScore: 0,

    // App state
    isDataLoaded: false,
    isProcessing: false,
    currentPage: 'upload',
    theme: localStorage.getItem('gs_theme') || 'dark',

    // Filter panel open state
    filterPanelOpen: false,

    // Available filter options (derived from data)
    filterOptions: {
      zones: [],
      brands: [],
      suppliers: [],
      hotels: [],
      categories: [],
      bottleSizes: [],
      alcoholTypes: [],
      skus: [],
      employees: [],
      shifts: [],
    },
  };

  // ─── Getters ──────────────────────────────────────────────────────────────

  function get(path) {
    return path.split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), _state);
  }

  function getState() {
    return _state;
  }

  // ─── Setters ──────────────────────────────────────────────────────────────

  function set(path, value) {
    const keys = path.split('.');
    let obj = _state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }

  function setRawData(type, data) {
    if (_state.rawData.hasOwnProperty(type)) {
      _state.rawData[type] = data;
    }
  }

  function setProcessedData(type, data) {
    if (_state.processedData.hasOwnProperty(type)) {
      _state.processedData[type] = data;
    }
  }

  function setKPIs(kpis) {
    _state.kpis = { ..._state.kpis, ...kpis };
    EventBus.emit(Events.KPIS_READY, _state.kpis);
  }

  function setFilter(key, value) {
    _state.filters[key] = value;
    EventBus.emit(Events.FILTERS_CHANGED, _state.filters);
  }

  function clearFilters() {
    Object.keys(_state.filters).forEach(k => {
      _state.filters[k] = (typeof _state.filters[k] === 'object' && !Array.isArray(_state.filters[k]))
        ? { from: null, to: null }
        : null;
    });
    _state.filters.searchQuery = '';
    EventBus.emit(Events.FILTERS_CHANGED, _state.filters);
  }

  function setTheme(theme) {
    _state.theme = theme;
    localStorage.setItem('gs_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    EventBus.emit(Events.THEME_CHANGED, theme);
  }

  function setDataLoaded(loaded) {
    _state.isDataLoaded = loaded;
  }

  function setProcessing(processing) {
    _state.isProcessing = processing;
  }

  function setCurrentPage(page) {
    const prev = _state.currentPage;
    _state.currentPage = page;
    EventBus.emit(Events.PAGE_CHANGED, { from: prev, to: page });
  }

  function setColumnMappings(mappings) {
    _state.columnMappings = { ...mappings };
    EventBus.emit(Events.MAPPING_CONFIRMED, mappings);
  }

  function setValidation(warnings, errors, score) {
    _state.validationWarnings = warnings || [];
    _state.validationErrors = errors || [];
    _state.dataQualityScore = score || 0;
    EventBus.emit(Events.VALIDATION_DONE, { warnings, errors, score });
  }

  function setFileMetadata(meta) {
    _state.fileMetadata = { ..._state.fileMetadata, ...meta };
  }

  function setRecommendations(recs) {
    _state.recommendations = recs;
    EventBus.emit(Events.RECOMMENDATIONS_READY, recs);
  }

  function setFilterOptions(options) {
    _state.filterOptions = { ..._state.filterOptions, ...options };
  }

  function setClassifications(cls) {
    _state.classifications = cls;
  }

  function setAging(aging) {
    _state.aging = aging;
  }

  function setUtilization(util) {
    _state.utilization = util;
  }

  function clearAllData() {
    Object.keys(_state.rawData).forEach(k => (_state.rawData[k] = []));
    Object.keys(_state.processedData).forEach(k => (_state.processedData[k] = []));
    _state.kpis = {};
    _state.recommendations = [];
    _state.classifications = {};
    _state.aging = {};
    _state.utilization = {};
    _state.validationWarnings = [];
    _state.validationErrors = [];
    _state.dataQualityScore = 0;
    _state.isDataLoaded = false;
    _state.fileMetadata = {};
    _state.filterOptions = { zones: [], brands: [], suppliers: [], hotels: [], categories: [], bottleSizes: [], alcoholTypes: [], skus: [], employees: [], shifts: [] };
    EventBus.emit(Events.DATA_CLEARED);
  }

  // ─── Filter Application ───────────────────────────────────────────────────

  function applyFilters(data, config = {}) {
    const f = _state.filters;
    let filtered = [...data];

    if (f.zone && config.zoneKey) filtered = filtered.filter(r => r[config.zoneKey] === f.zone);
    if (f.brand && config.brandKey) filtered = filtered.filter(r => r[config.brandKey] === f.brand);
    if (f.supplier && config.supplierKey) filtered = filtered.filter(r => r[config.supplierKey] === f.supplier);
    if (f.hotel && config.hotelKey) filtered = filtered.filter(r => r[config.hotelKey] === f.hotel);
    if (f.category && config.categoryKey) filtered = filtered.filter(r => r[config.categoryKey] === f.category);
    if (f.bottleSize && config.bottleSizeKey) filtered = filtered.filter(r => r[config.bottleSizeKey] === f.bottleSize);
    if (f.alcoholType && config.alcoholTypeKey) filtered = filtered.filter(r => r[config.alcoholTypeKey] === f.alcoholType);
    if (f.sku && config.skuKey) filtered = filtered.filter(r => r[config.skuKey] === f.sku);
    if (f.employee && config.employeeKey) filtered = filtered.filter(r => r[config.employeeKey] === f.employee);
    if (f.shift && config.shiftKey) filtered = filtered.filter(r => r[config.shiftKey] === f.shift);

    if (f.dateRange && (f.dateRange.from || f.dateRange.to) && config.dateKey) {
      const from = f.dateRange.from ? new Date(f.dateRange.from) : null;
      const to = f.dateRange.to ? new Date(f.dateRange.to) : null;
      filtered = filtered.filter(r => {
        const d = GovSpirit.Utils.parseDate(r[config.dateKey]);
        if (!d) return true;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    return filtered;
  }

  // ─── Initialize ───────────────────────────────────────────────────────────

  function init() {
    document.documentElement.setAttribute('data-theme', _state.theme);
  }

  init();

  return {
    get, getState,
    set, setRawData, setProcessedData, setKPIs, setFilter, clearFilters,
    setTheme, setDataLoaded, setProcessing, setCurrentPage,
    setColumnMappings, setValidation, setFileMetadata, setRecommendations,
    setFilterOptions, setClassifications, setAging, setUtilization,
    clearAllData, applyFilters
  };
})();
