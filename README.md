# GovSpirit

Warehouse analytics for state excise depots. Open a stock spreadsheet, get KPIs, a storage plan and a ranked list of things to fix.

Everything runs in the browser. No upload, no server, no account.

[Open the application](https://shreyasthakur11.github.io/govspirit-warehouse/) · [Documentation](docs/) · [Architecture](docs/architecture.md)

[![CI](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/ci.yml/badge.svg)](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/ci.yml)
[![Pages](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/deploy.yml/badge.svg)](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f6f62.svg)](LICENSE)

---

## The problem

A depot manager has stock data. It is in a spreadsheet, the column headings are whatever the last clerk typed, and answering "which lines have not moved in three months" means an afternoon with a pivot table.

The data is also sensitive. Uploading a state's stock position to a third-party analytics service is usually not an option, and often not permitted.

## What it does

Read a file, then report on it.

| Step    | Detail                                                                         |
| ------- | ------------------------------------------------------------------------------ |
| Read    | `.xlsx`, `.xls`, `.csv`, `.tsv`, multi-sheet workbooks, or a pasted text list  |
| Map     | Matches your column names against 255 known variants and shows its confidence  |
| Check   | 17 data quality rules, each reporting affected row numbers                     |
| Analyse | Valuation, ABC and XYZ classification, dead stock, zone utilisation, fill rate |
| Advise  | Nine rules that produce specific, ranked actions against a stated threshold    |
| Export  | CSV, Excel workbook, or a PDF of the current view                              |

## Try it

**Hosted:** [shreyasthakur11.github.io/govspirit-warehouse](https://shreyasthakur11.github.io/govspirit-warehouse/), then choose **Demo data**.

**Local:** clone and open `index.html`. There is no build step.

```bash
git clone https://github.com/ShreyasThakur11/govspirit-warehouse.git
```

To serve it over HTTP instead:

```bash
npm start
```

## Where the data goes

Nowhere. Files are read with the browser's `FileReader` API and held in memory for the session. There is no backend to send them to. Closing the tab discards everything.

The only requests the page makes are for the webfont and the charting library, both pinned with Subresource Integrity digests. The spreadsheet and PDF libraries are fetched only if you use an export.

## What the numbers mean

A metric with no supporting data reports `N/A` rather than a plausible default. Without a cycle count file, inventory accuracy is blank, and the health score is computed from the components that do have evidence with the count of those components shown.

Where figures are modelled rather than measured, the interface says so. A stock list on its own produces a projected order history so the trend views have something to draw, and every page carrying that data shows a standing notice.

[docs/metrics.md](docs/metrics.md) gives the formula and the data requirement for each figure.

## Accessibility

Built to WCAG 2.2 Level AA.

- Every text colour pairing is measured, not estimated. `npm run check:contrast` recomputes all 16 from the stylesheet on each CI run and fails if a documented ratio drifts. The lowest ratio in the palette is 4.82:1 against a 4.5:1 requirement.
- Full keyboard operation. The navigation drawer is a real modal with a focus trap, Escape to close, and `inert` applied to the content behind it.
- Charts carry a text description. Tables use row headers, and their scroll containers are focusable.
- Text scales with the browser font setting, because sizes are in `rem` rather than pixels.
- Honours `prefers-reduced-motion` and `prefers-contrast`.

[docs/accessibility.md](docs/accessibility.md) lists each criterion and how it is met.

## Documentation

| Document                               | Contents                                                    |
| -------------------------------------- | ----------------------------------------------------------- |
| [Architecture](docs/architecture.md)   | Module layout, data flow, rendering model, design decisions |
| [Data model](docs/data-model.md)       | Canonical field names, accepted aliases, validation rules   |
| [Metrics](docs/metrics.md)             | Every KPI: formula, inputs, and behaviour without them      |
| [Design system](docs/design-system.md) | Tokens, palette derivation, component vocabulary            |
| [Accessibility](docs/accessibility.md) | WCAG 2.2 AA conformance notes                               |
| [Development](docs/development.md)     | Setup, conventions, adding a page or a metric               |
| [Deployment](docs/deployment.md)       | GitHub Pages and self-hosting                               |

A slide deck covering the same ground is in [docs/presentation](docs/presentation/).

## Built with

Vanilla JavaScript, no framework and no build step. [Chart.js](https://www.chartjs.org/) draws the charts, [SheetJS](https://sheetjs.com/) reads the spreadsheets, [jsPDF](https://github.com/parallax/jsPDF) and [html2canvas](https://html2canvas.hertzen.com/) handle PDF export.

The absence of a build step is deliberate. A depot can keep a copy of this folder on a shared drive and it will still open in five years without a toolchain.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup and conventions. [SECURITY.md](SECURITY.md) covers reporting a vulnerability.

```bash
npm install
npm run check    # lint, format, contrast and stylesheet coverage
```

## Licence

[MIT](LICENSE). The reference sales dataset is synthetic and bears no relation to any real depot's trading position.
