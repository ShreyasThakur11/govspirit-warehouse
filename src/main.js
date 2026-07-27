/**
 * Application bootstrap. Loads last.
 */
(function initApp(GovSpirit) {
  'use strict';

  const { Theme, Icons, Shell, Router, Components } = GovSpirit.require(
    'Theme',
    'Icons',
    'Shell',
    'Router',
    'Components'
  );

  /**
   * Dismiss the boot screen once the application is genuinely interactive.
   *
   * The previous build removed it on a fixed 1200ms timer, so a fast machine
   * sat looking at a progress bar it did not need while a slow one showed the
   * chrome before the first view had rendered.
   */
  function dismissBootScreen() {
    const screen = document.getElementById('boot-screen');
    if (!screen) return;

    screen.classList.add('is-leaving');
    const remove = () => screen.remove();
    screen.addEventListener('transitionend', remove, { once: true });
    // transitionend never fires under prefers-reduced-motion, so guarantee it.
    setTimeout(remove, 500);
  }

  function installErrorHandlers() {
    window.addEventListener('error', (event) => {
      console.error('[GovSpirit] Uncaught error:', event.error || event.message);
      Components.toast('Something went wrong. Open the browser console for details.', 'error');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[GovSpirit] Unhandled promise rejection:', event.reason);
      Components.toast('A background task failed. Open the console for details.', 'error');
    });
  }

  function reportStartupFailure() {
    const main = document.getElementById('main-content');
    if (!main) return;
    main.innerHTML =
      '<div class="page-content"><div class="error-state" role="alert">' +
      '<p class="error-title">GovSpirit could not start</p>' +
      '<p class="error-body">Reload the page. If the problem persists, open the browser ' +
      'console and report the error on the project issue tracker.</p></div></div>';
  }

  function start() {
    try {
      Icons.mountSprite();
      Theme.init();
      Shell.init();
      Router.init();
      installErrorHandlers();
    } catch (error) {
      console.error('[GovSpirit] Startup failed:', error);
      reportStartupFailure();
    } finally {
      dismissBootScreen();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(window.GovSpirit);
