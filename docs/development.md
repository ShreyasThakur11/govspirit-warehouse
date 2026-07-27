# Development

[Documentation index](README.md)

## Setup

```bash
git clone https://github.com/ShreyasThakur11/govspirit-warehouse.git
cd govspirit-warehouse
npm install     # tooling only, the application has no runtime dependencies
```

Open `index.html` directly, or serve it:

```bash
npm start       # http://localhost:4173
```

Opening the file directly works because the application uses classic scripts
rather than ES modules. Keep it that way: switching to modules would break
`file://` loading, which is how a depot without a web server would run this.

## Before you push

```bash
npm run check
```

Four gates:

| Command                  | Checks                                          |
| ------------------------ | ----------------------------------------------- |
| `npm run lint`           | ESLint, configured for the IIFE namespace style |
| `npm run format:check`   | Prettier                                        |
| `npm run check:contrast` | 16 colour pairings against WCAG 2.2 AA          |
| `npm run check:classes`  | Every class in the markup is defined in CSS     |

CI runs the same four. Nothing else is required to pass, and nothing that
passes locally should fail there.

## Conventions

**Modules.** One responsibility per file. An IIFE that attaches to
`GovSpirit`, declaring its dependencies through `GovSpirit.require()` so a
load-order mistake throws immediately rather than surfacing as `undefined`
three calls later.

```js
(function initThing(GovSpirit) {
  'use strict';
  const { Store, Format } = GovSpirit.require('Store', 'Format');
  // ...
  GovSpirit.Thing = { publicApi };
})(window.GovSpirit);
```

**Markup.** Always through the `html` tagged template. It escapes every
interpolation. If you need `raw()`, that is a decision worth explaining in a
comment.

**Naming.** `camelCase` for JavaScript, `kebab-case` for CSS classes and file
names in `assets/`. Class names describe the thing, not its appearance:
`.metric-card`, not `.big-blue-box`.

**Comments.** Explain the reason, not the mechanism. A comment earns its place
by recording something the code cannot: why a threshold is 2% rather than 5%,
why a value is parsed day-first, why `inert` is applied when CSS already hides
the element.

**Commit messages.** Imperative subject under 72 characters, then bullets.
State what changed and why it mattered.

## Adding a page

Four steps.

**1. Create `src/pages/yourPage.js`:**

```js
(function initYourPage(GovSpirit) {
  'use strict';
  const { Html, Store, Components } = GovSpirit.require('Html', 'Store', 'Components');
  const { html } = Html;

  function render() {
    return html`
      <div class="page-content">
        ${Components.pageHeader({ title: 'Your page', subtitle: 'What it answers' })}
        ${Components.panel({ title: 'A section', body: html`<p>Content</p>` })}
      </div>
    `;
  }

  function mount() {
    // Bind events and create charts here. The container is laid out by now.
  }

  function unmount() {
    // Release anything mount() acquired. Charts are destroyed for you.
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.yourPage = { title: 'Your page', render, mount, unmount };
})(window.GovSpirit);
```

**2. Register it** in `PAGES` in `src/core/router.js`, with an icon key from
`Icons.PATHS` and a group.

**3. Add the script tag** to `index.html`, in the views block.

**4. Run `npm run check`.** The stylesheet coverage check will tell you if you
invented a class that does not exist.

## Adding a metric

Compute it in `src/analytics/kpiEngine.js`, inside the section it belongs to,
and return `null` when its input is absent:

```js
const countedLines = cycleCount.length;
const inventoryAccuracy =
  countedLines > 0 ? Collections.percentageOf(matchedLines, countedLines) : null;
```

Then document it in [metrics.md](metrics.md) with its formula and its data
requirement, and render it with `Components.metricCard`, which shows `N/A` for
`null` on its own.

**Do not substitute a default.** A metric that invents its own input is the
single worst failure this application can have, and version 1 had three of
them.

## Adding a recommendation rule

In `src/analytics/recommendationEngine.js`:

1. Add the threshold to the `THRESHOLDS` constant. Never inline a number into
   a condition.
2. Add an `add({ ... })` block with `type`, `priority`, `category`, `title`,
   `description`, `impact`, `action` and `metrics`.
3. Write `action` as numbered steps a warehouse supervisor could actually
   carry out this week.
4. Document it in the table in [metrics.md](metrics.md).

If the rule quotes an improvement range, label it as an industry rule of thumb.
Do not present it as a prediction derived from the operator's data.

## Adding a colour

1. Add the token to the correct theme block in `assets/css/01-tokens.css`.
2. If it will carry text, add the measured ratio as a comment and add the
   pairing to the `PAIRS` list in `scripts/check-contrast.mjs`.
3. Run `npm run check:contrast`. It will tell you if your ratio is wrong.

## Adding an icon

Add a 24 by 24 path to `PATHS` in `src/ui/icons.js`. Match the existing
geometry: 1.75 stroke, round caps and joins, no fill. Then use it:

```js
Icons.render('yourIcon', { size: 18 }); // decorative
Icons.render('yourIcon', { size: 18, label: 'Description' }); // the only label
```

No emoji. The reasoning is in [design-system.md](design-system.md).

## Debugging

The namespace is exposed, so the console is a usable tool:

```js
GovSpirit.Store.getState(); // everything currently loaded
GovSpirit.Store.kpis(); // computed metrics
GovSpirit.Router.navigate('search'); // jump to a view
GovSpirit.DemoData.generate(); // a fresh seeded dataset
GovSpirit.Charts.palette(); // series colours as resolved from CSS
```

The demo generator is seeded, so the same dataset appears every time. That is
what makes a bug report reproducible. Pass a different seed to vary it:

```js
GovSpirit.DemoData.generate({ seed: 42 });
```

## Testing

There are no unit tests yet. This is a known gap, recorded in
[the roadmap](roadmap.md).

`src/lib/` was separated from `src/ui/` specifically so that they can be added
without a DOM: everything in `lib/` is a pure function of its arguments. That
is the sensible place to start.

Manual checks currently used for a release:

1. Open the sample depot, walk all eleven views, confirm no console errors
2. Repeat at 320, 375, 768, 1024 and 1280 pixels wide
3. Toggle the theme on a chart-heavy view and confirm the charts follow
4. Tab through the import page from the skip link to the end
5. Open the drawer below 1024px and confirm Escape closes it and returns focus
6. Export CSV, Excel and PDF
