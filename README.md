# GovSpirit

Warehouse analytics for state excise depots. Open a stock spreadsheet, get KPIs, a storage plan and a ranked list of things to fix.

Everything runs in the browser. No upload, no server, no account.

**[Open the application](https://shreyasthakur11.github.io/govspirit-warehouse/)** · [Documentation](docs/) · [Slides](docs/presentation/)

[![CI](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/ci.yml/badge.svg)](https://github.com/ShreyasThakur11/govspirit-warehouse/actions/workflows/ci.yml)
[![WCAG 2.2 AA](https://img.shields.io/badge/WCAG%202.2-AA-0f6f62)](docs/accessibility.md)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## Try it

Open the [hosted version](https://shreyasthakur11.github.io/govspirit-warehouse/) and choose **Open the sample dashboard**. Nothing to install, nothing to prepare.

There is also a sample file to download. It carries the headers a depot prints rather than the names this tool uses, so uploading it shows the column mapping doing real work.

## What it does

| Step    | Detail                                                                        |
| ------- | ----------------------------------------------------------------------------- |
| Read    | Excel, CSV, TSV, multi-sheet workbooks, or a pasted text list                 |
| Map     | Matches your column names against 255 known variants, with a confidence score |
| Check   | 17 data quality rules, each naming the affected spreadsheet rows              |
| Analyse | Valuation, ABC and XYZ classes, dead stock, zone utilisation, fill rate       |
| Advise  | 9 rules producing ranked actions against a stated threshold                   |
| Export  | CSV, Excel workbook, or a PDF of the current view                             |

## What the numbers mean

A metric with no supporting data reports `N/A` rather than a plausible default. Modelled figures say so, and every page carrying one shows a standing notice.

[docs/metrics.md](docs/metrics.md) gives the formula and data requirement for each figure.

## Privacy

Files are read with the browser's `FileReader` API and held in memory for the session. There is no backend to send them to. Closing the tab discards everything.

## Run it locally

```bash
git clone https://github.com/ShreyasThakur11/govspirit-warehouse.git
```

Open `index.html`. There is no build step, and that is deliberate: a depot can keep this folder on a shared drive and it will still open in five years without a toolchain.

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

## Contributing

```bash
npm install
npm run check
```

[CONTRIBUTING.md](.github/CONTRIBUTING.md) for conventions. [SECURITY.md](.github/SECURITY.md) to report a vulnerability.

## Licence

[MIT](LICENSE). The reference dataset is synthetic and bears no relation to any real depot.
