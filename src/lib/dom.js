/**
 * GovSpirit DOM helpers, viewport queries and focus management.
 */
(function initDom(GovSpirit) {
  'use strict';

  const { EventBus, Events } = GovSpirit.require('EventBus', 'Events');

  /* ── Queries ──────────────────────────────────────────────────────────── */

  const byId = (id) => document.getElementById(id);
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /**
   * Attach a listener, returning a disposer. Guards against a null target so
   * page code does not need `?.` at every call site.
   */
  function on(target, type, handler, options) {
    if (!target) return () => {};
    target.addEventListener(type, handler, options);
    return () => target.removeEventListener(type, handler, options);
  }

  /**
   * Event delegation. Cheaper than binding N listeners after every re-render,
   * and it survives the innerHTML replacement that page navigation performs.
   */
  function delegate(root, selector, type, handler) {
    return on(root, type, (event) => {
      const match = event.target.closest(selector);
      if (match && root.contains(match)) handler(event, match);
    });
  }

  function setBusy(element, busy) {
    if (!element) return;
    element.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  /* ── Timing ───────────────────────────────────────────────────────────── */

  function debounce(fn, delay = 250) {
    let timer = null;
    const debounced = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
  }

  /**
   * Run `callback` after the browser has had a chance to lay out.
   *
   * requestAnimationFrame is the right tool when the page is visible, but it
   * never fires in a background tab. Any work scheduled through bare rAF,
   * mounting a page's charts, finishing an import, would therefore hang
   * indefinitely for anyone who opened the app with a middle-click or
   * "open link in new tab". Falling back to a macrotask keeps that working.
   *
   * @param {() => void} callback
   */
  function nextFrame(callback) {
    if (document.visibilityState === 'hidden') {
      setTimeout(callback, 0);
      return;
    }

    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      callback();
    };

    requestAnimationFrame(run);
    // Safety net for the moment a tab is backgrounded between the call and the
    // frame that would have serviced it.
    setTimeout(run, 250);
  }

  function throttle(fn, limit = 150) {
    let last = 0;
    let trailing = null;
    return (...args) => {
      const now = Date.now();
      const remaining = limit - (now - last);
      if (remaining <= 0) {
        clearTimeout(trailing);
        last = now;
        fn(...args);
      } else if (!trailing) {
        trailing = setTimeout(() => {
          last = Date.now();
          trailing = null;
          fn(...args);
        }, remaining);
      }
    };
  }

  /* ── Viewport ─────────────────────────────────────────────────────────── */

  // Kept in sync with the breakpoints in assets/css/03-layout.css.
  const BREAKPOINTS = Object.freeze({
    xs: 400,
    sm: 480,
    md: 640,
    lg: 768,
    xl: 1024,
    xxl: 1280,
  });

  const mqDrawer = matchMedia(`(max-width: ${BREAKPOINTS.xl - 0.02}px)`);
  const mqPhone = matchMedia(`(max-width: ${BREAKPOINTS.md - 0.02}px)`);
  const mqReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mqCoarse = matchMedia('(pointer: coarse)');

  /** True when the sidebar is rendered as an off-canvas drawer. */
  const isDrawerLayout = () => mqDrawer.matches;
  const isPhone = () => mqPhone.matches;
  const prefersReducedMotion = () => mqReducedMotion.matches;
  const isTouch = () => mqCoarse.matches;

  /** Re-broadcast layout-class changes so pages can re-render charts once. */
  [mqDrawer, mqPhone].forEach((mq) => {
    const listener = () =>
      EventBus.emit(Events.VIEWPORT_CHANGED, {
        drawer: mqDrawer.matches,
        phone: mqPhone.matches,
      });
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', listener);
    else mq.addListener(listener); // Safari < 14
  });

  /** Honour reduced-motion when scrolling programmatically. */
  function scrollIntoView(element, options = {}) {
    if (!element) return;
    element.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
      ...options,
    });
  }

  /* ── Focus management ─────────────────────────────────────────────────── */

  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function focusableWithin(container) {
    if (!container) return [];
    return qsa(FOCUSABLE, container).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }

  /**
   * Trap Tab focus inside a container, required for the mobile navigation
   * drawer, which is a modal surface once open. Returns a release function
   * that also restores focus to wherever it came from.
   */
  function trapFocus(container, { initialFocus } = {}) {
    if (!container) return () => {};
    const previouslyFocused = document.activeElement;

    const handleKeydown = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusableWithin(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeydown, true);

    const target = initialFocus || focusableWithin(container)[0];
    // Defer so the element is laid out (and therefore focusable) first.
    nextFrame(() => target?.focus());

    return function release({ restoreFocus = true } = {}) {
      document.removeEventListener('keydown', handleKeydown, true);
      if (restoreFocus && previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }

  /**
   * Move screen-reader focus to a freshly rendered page region without adding
   * it to the tab order permanently.
   */
  function focusRegion(element) {
    if (!element) return;
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
  }

  GovSpirit.Dom = {
    byId,
    qs,
    qsa,
    on,
    delegate,
    setBusy,
    debounce,
    throttle,
    nextFrame,
    BREAKPOINTS,
    isDrawerLayout,
    isPhone,
    prefersReducedMotion,
    isTouch,
    scrollIntoView,
    focusableWithin,
    trapFocus,
    focusRegion,
  };
})(window.GovSpirit);
