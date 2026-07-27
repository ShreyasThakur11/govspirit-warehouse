/**
 * GovSpirit Theme controller.
 *
 * Owns the `data-theme` attribute, the persisted preference and the
 * THEME_CHANGED broadcast. Storage access is wrapped because localStorage
 * throws in Safari private browsing and under some `file://` configurations,
 * a theme toggle should never be able to break the whole application.
 */
(function initTheme(GovSpirit) {
  'use strict';

  const { EventBus, Events } = GovSpirit.require('EventBus', 'Events');

  const STORAGE_KEY = 'govspirit:theme';
  const VALID = ['dark', 'light'];

  let current = 'dark';

  function readStored() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return VALID.includes(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  function writeStored(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Preference simply will not persist. Not worth surfacing. */
    }
  }

  function systemPreference() {
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function apply(theme) {
    current = VALID.includes(theme) ? theme : 'dark';
    document.documentElement.setAttribute('data-theme', current);

    // Keep the mobile browser chrome in step with the app background.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', current === 'light' ? '#ffffff' : '#080a10');
  }

  function set(theme) {
    if (theme === current) return;
    apply(theme);
    writeStored(current);
    EventBus.emit(Events.THEME_CHANGED, current);
  }

  function toggle() {
    set(current === 'dark' ? 'light' : 'dark');
  }

  function get() {
    return current;
  }

  function isLight() {
    return current === 'light';
  }

  /** Read a themed CSS custom property so JS-drawn surfaces match the CSS. */
  function cssVar(name, fallback = '') {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name);
    return value ? value.trim() : fallback;
  }

  function init() {
    apply(readStored() || systemPreference());

    // Follow the OS only while the reader has not made an explicit choice.
    const mq = matchMedia('(prefers-color-scheme: light)');
    const onSystemChange = (event) => {
      if (readStored()) return;
      apply(event.matches ? 'light' : 'dark');
      EventBus.emit(Events.THEME_CHANGED, current);
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onSystemChange);
    else mq.addListener(onSystemChange);
  }

  GovSpirit.Theme = { init, get, set, toggle, isLight, cssVar };
})(window.GovSpirit);
