# Changelog

Notable changes to this project. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Sample depot on the import page: one button loads the dataset and opens the
  dashboard, and four more open the view that best shows a given feature
- Downloadable sample file written with the headers a depot prints, so the
  column mapper can be tried without anyone supplying a file of their own
- Smoke test coverage for the sample: every header must resolve to its intended
  field at high confidence, and a write, re-read and pipeline round trip must
  preserve both the row count and the bottle count
- Smoke test check for clipped text anywhere in the sidebar or topbar

### Fixed

- Inventory rows were de-duplicated on SKU plus bin even when the file carried
  no bin column. `bin_id` falls back to the rack in that case, so a product held
  in several places in one rack collapsed to a single line and the rest of the
  stock vanished from every total. On the sample file this understated the
  holding by 4,141 bottles
- Navigating twice inside one frame let the first page run its deferred
  `mount()` against the second page's DOM. Chart.js was left holding detached
  canvases and threw from its own resize loop, which surfaced as a cluster of
  uncaught `ownerDocument` errors with nothing nearby to explain them
- The sidebar tagline overflowed its container instead of fitting, because a
  flex child defaults to `min-width: auto`
- Every route change left a focus ring on the page heading. The router focuses
  it so screen readers announce the new view, and Chromium counts that as
  focus-visible

### Changed

- Community and planning documents moved out of the repository root, into
  `.github/` and `docs/`
- eslint 10, and the pinned GitHub Actions raised to their current majors

## [2.0.0] - 2026-07-26

A rebuild. Version 1 worked as a prototype but carried faults that made it
unsafe to extend.

### Fixed

- `navigate('upload')` pointed at a page that was never registered or loaded,
  so every "load data first" redirect was a dead end
- `parseCSV` returned `{type, score, label}` while `parseFile` returned
  `{detectedType, detectedLabel, detectionScore}`, so every CSV upload reported
  an undefined file type
- Import wrote `price_per_bottle` while the transformer read `unit_price`,
  silently zeroing every unit price and the valuation chain behind it
- The same mismatch existed between `capacity` and `capacity_bottles`, and
  between `current_qty` and `occupied_bottles`, in layout data
- Day keys were built with `toISOString().slice(0, 10)`, shifting every record
  by a day for readers east of UTC, which is the entire target audience
- Slash dates were parsed month-first, making `01/02/2026` 2 January rather
  than 1 February
- CSV parsing used `split(',')`, corrupting any quoted comma, quoted newline or
  CRLF file
- `sortBy` subtracted operands unconditionally, producing `NaN` and arbitrary
  order on every text column
- Eight CSS declarations used an invalid `var(--token)20` alpha syntax and were
  silently dropped, leaving the active nav item, filter chips and search
  highlights with no background

### Changed

- Metrics without supporting data return `N/A` instead of a plausible constant.
  Inventory accuracy previously reported 98.5%, picks per hour 15 and pick
  accuracy 97% with no source file, and those values then fed the health score
- The health score drops components that have no data and renormalises the
  remaining weights, reporting how many contributed
- The customer trend chart is computed from order dates. It previously
  multiplied each customer's order count by the fixed factors 0.22, 0.26, 0.24
  and 0.28
- Order history projected from reference velocity is labelled as projected
  wherever it appears
- The slotting recommendation threshold moved from 5% to 2% of dispatched
  volume. At 5% it was unreachable for a catalogue of about 90 SKUs and had
  never fired
- Demo data is seeded, so the same dataset appears on every run
- Demo stock is slotted by velocity across all zones rather than filling bins
  sequentially, which had put every SKU into zones A and B

### Added

- Escaping tagged template for all markup. Spreadsheet values previously
  reached `innerHTML` unescaped
- Formula-injection protection on CSV export
- Subresource Integrity digests on all four CDN dependencies
- Hash routing, so a view can be bookmarked and the Back button works
- WCAG 2.2 AA conformance work: focus management, landmarks, live regions,
  keyboard-reachable scroll containers, target sizes, `inert` on the closed
  drawer
- `scripts/check-contrast.mjs`, which recomputes all 16 colour pairings from
  the stylesheet and fails on drift. Four documented ratios were wrong when it
  first ran
- `scripts/check-classes.mjs`, which asserts every class in the markup exists
  in CSS. It found 146 orphans, including the import page tab strip
- A 50-glyph SVG icon set, replacing 146 emoji
- `404.html` with inlined styles
- Full documentation set under `docs/`

### Removed

- `js/pages/upload.js`, 257 lines that were never loaded by `index.html`
- `js/ingestion/columnMapper.js`, a second mapper used only by that dead page
- An "hourly pressure" series generated with `Math.random()` and presented as
  measured warehouse activity
- A duplicate Levenshtein implementation
- All 146 emoji

### Performance

- SheetJS, jsPDF and html2canvas, about 1.4 MB combined, load on first use
  rather than on every visit. Chart.js alone remains up front
- The webfont no longer blocks first paint
- Theme changes update live charts in place instead of re-rendering the page
- The boot screen clears when the application is interactive rather than after
  a fixed 1200ms timer

### Security

- `requestAnimationFrame` used for work scheduling was replaced with a
  scheduler that falls back to a macrotask. rAF never fires in a background
  tab, so opening the application with a middle-click left charts unmounted and
  the import button stuck on "Processing"

## [1.0.0] - 2026

Initial release.
