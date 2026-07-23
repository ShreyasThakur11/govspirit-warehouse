/**
 * GovSpirit EventBus — Lightweight Pub/Sub
 * Enables decoupled communication between modules.
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.EventBus = (function () {
  const _events = {};

  function on(event, callback) {
    if (!_events[event]) _events[event] = [];
    _events[event].push(callback);
  }

  function off(event, callback) {
    if (!_events[event]) return;
    _events[event] = _events[event].filter(cb => cb !== callback);
  }

  function emit(event, data) {
    if (!_events[event]) return;
    _events[event].forEach(cb => {
      try { cb(data); } catch (err) { console.error(`[EventBus] Error in "${event}" handler:`, err); }
    });
  }

  function once(event, callback) {
    const wrapper = (data) => { callback(data); off(event, wrapper); };
    on(event, wrapper);
  }

  function clear(event) {
    if (event) delete _events[event];
    else Object.keys(_events).forEach(k => delete _events[k]);
  }

  return { on, off, emit, once, clear };
})();

// Predefined event constants
GovSpirit.Events = {
  DATA_LOADED:        'data:loaded',
  DATA_CLEARED:       'data:cleared',
  FILTERS_CHANGED:    'filters:changed',
  PAGE_CHANGED:       'page:changed',
  THEME_CHANGED:      'theme:changed',
  KPIS_READY:         'kpis:ready',
  RECOMMENDATIONS_READY: 'recommendations:ready',
  SEARCH_TRIGGERED:   'search:triggered',
  EXPORT_TRIGGERED:   'export:triggered',
  MAPPING_CONFIRMED:  'mapping:confirmed',
  VALIDATION_DONE:    'validation:done',
  CHART_RESIZE:       'chart:resize',
};
