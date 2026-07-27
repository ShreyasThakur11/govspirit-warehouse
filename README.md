# GovSpirit

Warehouse analytics for state excise depots. Open a stock spreadsheet, get KPIs, a storage plan and a ranked list of things to fix.

Everything runs in the browser. No upload, no server, no account.

**[Open the application](https://shreyasthakur11.github.io/govspirit-warehouse/)** · [Documentation](docs/) · [Slides](docs/presentation/)

[![CI](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/ci.yml/badge.svg)](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/ci.yml)
[![Deploy](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/deploy.yml/badge.svg)](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/deploy.yml)
[![WCAG 2.2 AA](https://img.shields.io/badge/WCAG%202.2-AA-0f6f62)](docs/accessibility.md)
[![Build step](https://img.shields.io/badge/build%20step-none-0f6f62)](docs/architecture.md)
[![Data leaves the browser](https://img.shields.io/badge/data%20leaves%20the%20browser-never-c07a2c)](#privacy)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## What it does

| Step    | Detail                                                                        |
| ------- | ----------------------------------------------------------------------------- |
| Read    | Excel, CSV, TSV, multi-sheet workbooks, or a pasted text list                 |
| Map     | Matches your column names against 255 known variants, with a confidence score |
| Check   | 17 data quality rules, each naming the affected spreadsheet rows              |
| Analyse | Valuation, ABC and XYZ classes, dead stock, zone utilisation, fill rate       |
| Advise  | 9 rules producing ranked actions against a stated threshold                   |
| Export  | CSV, Excel workbook, or a PDF of the current view                             |

## Try it

Open the [hosted version](https://shreyasthakur11.github.io/govspirit-warehouse/) and choose **Demo data**. The generator is seeded, so everyone sees the same warehouse.

Locally, clone and open `index.html`. There is no build step.

```bash
git clone https://github.com/ShreyasThakur11/govspirit-warehouse.git
```

## Privacy

Files are read with the browser's `FileReader` API and held in memory for the session. There is no backend to send them to. Closing the tab discards everything.

The page fetches only a webfont and the charting library, both pinned with Subresource Integrity digests. Spreadsheet and PDF libraries load only if you export.

## What the numbers mean

A metric with no supporting data reports `N/A` rather than a plausible default. Without a cycle count file, inventory accuracy is blank and the health score is computed from the components that do have evidence, with that count shown.

Modelled figures say so. A stock list alone produces a projected order history, and every page carrying it shows a standing notice.

[docs/metrics.md](docs/metrics.md) gives the formula and data requirement for each figure.

## Documentation

|                                        |                                                      |
| -------------------------------------- | ---------------------------------------------------- |
| [Architecture](docs/architecture.md)   | Module layout, data flow, design decisions           |
| [Data model](docs/data-model.md)       | Canonical fields, accepted aliases, validation rules |
| [Metrics](docs/metrics.md)             | Every KPI: formula, inputs, behaviour without them   |
| [Design system](docs/design-system.md) | Tokens, palette derivation, component vocabulary     |
| [Accessibility](docs/accessibility.md) | WCAG 2.2 AA conformance, and the gaps                |
| [Development](docs/development.md)     | Setup, conventions, adding a page or a metric        |
| [Deployment](docs/deployment.md)       | GitHub Pages, self-hosting, air-gapped installs      |
| [Slides](docs/presentation/)           | An 11 slide deck with speaker notes                  |

## Built with

Vanilla JavaScript. No framework, no build step. [Chart.js](https://www.chartjs.org/) draws the charts; [SheetJS](https://sheetjs.com/), [jsPDF](https://github.com/parallax/jsPDF) and [html2canvas](https://html2canvas.hertzen.com/) load on demand for import and export.

The absence of a build step is deliberate. A depot can keep this folder on a shared drive and it will still open in five years without a toolchain.

## Contributing

```bash
npm install
npm run check    # lint, format, contrast, stylesheet coverage, shipping completeness
```

[CONTRIBUTING.md](CONTRIBUTING.md) for conventions. [SECURITY.md](SECURITY.md) to report a vulnerability.

## Licence

[MIT](LICENSE). The reference sales dataset is synthetic and bears no relation to any real depot.
