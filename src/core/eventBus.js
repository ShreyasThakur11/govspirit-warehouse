/**
 * GovSpirit EventBus: minimal publish and subscribe.
 *
 * Handlers are isolated: one throwing listener never prevents the rest from
 * running, and the failure is reported rather than swallowed.
 */
(function initEventBus(GovSpirit) {
  'use strict';

  const listeners = new Map();

  function on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`[EventBus] Handler for "${event}" must be a function.`);
    }
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    // Returning the unsubscribe function makes cleanup a one-liner at call sites.
    return () => off(event, handler);
  }

  function off(event, handler) {
    listeners.get(event)?.delete(handler);
  }

  function once(event, handler) {
    const wrapped = (payload) => {
      off(event, wrapped);
      handler(payload);
    };
    return on(event, wrapped);
  }

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set || set.size === 0) return;
    // Iterate a copy so a handler that unsubscribes mid-dispatch is safe.
    [...set].forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Listener for "${event}" threw:`, err);
      }
    });
  }

  function clear(event) {
    if (event) listeners.delete(event);
    else listeners.clear();
  }

  GovSpirit.EventBus = { on, off, once, emit, clear };

  /** Canonical event names. Using constants keeps typos from going unnoticed. */
  GovSpirit.Events = Object.freeze({
    DATA_LOADED: 'data:loaded',
    DATA_CLEARED: 'data:cleared',
    FILTERS_CHANGED: 'filters:changed',
    PAGE_CHANGED: 'page:changed',
    THEME_CHANGED: 'theme:changed',
    KPIS_READY: 'kpis:ready',
    RECOMMENDATIONS_READY: 'recommendations:ready',
    VALIDATION_DONE: 'validation:done',
    VIEWPORT_CHANGED: 'viewport:changed',
  });
})(window.GovSpirit);
