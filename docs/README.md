# Documentation

Start here.

## Reading order

If you are **new to the project**, read in this order:

1. [Architecture](architecture.md): what the pieces are and how data moves between them
2. [Data model](data-model.md): what a record looks like once it is inside
3. [Metrics](metrics.md): how each number on screen is produced

If you are **changing the code**:

4. [Development](development.md): setup, conventions, how to add a page or a metric
5. [Design system](design-system.md): tokens and component vocabulary
6. [Accessibility](accessibility.md): the standard the interface is held to

If you are **deploying it**:

7. [Deployment](deployment.md): GitHub Pages, self-hosting, air-gapped installs

## Presenting or teaching from this

[docs/presentation](presentation/) holds a slide deck covering the problem, the approach, the architecture and the results, plus speaker notes.

## The shape of the system in one diagram

```mermaid
flowchart LR
    subgraph Input
        A[Spreadsheet<br/>xlsx, xls, csv, tsv]
        B[Pasted text list]
        C[Demo generator]
    end

    subgraph Ingestion
        D[File reader<br/>RFC 4180 + SheetJS]
        E[Column mapper<br/>255 known variants]
        F[Validator<br/>17 rules]
        G[Transformer<br/>canonical records]
    end

    subgraph Analytics
        H[KPI engine]
        I[Classification<br/>ABC, XYZ, movement]
        J[Aging engine]
        K[Utilisation engine]
        L[Recommendation engine<br/>9 rules]
    end

    subgraph Output
        M[11 views]
        N[CSV, Excel, PDF]
    end

    A --> D --> E --> G
    B --> G
    C --> G
    G --> F
    G --> H --> I --> J --> K --> L
    L --> M --> N

    style Input fill:#0f6f6215,stroke:#0f6f62
    style Ingestion fill:#c07a2c15,stroke:#c07a2c
    style Analytics fill:#4a7fa515,stroke:#4a7fa5
    style Output fill:#5c8c4a15,stroke:#5c8c4a
```

Nothing in this diagram crosses a network boundary. Every box runs in the browser tab.

## Quick facts

|                                 |                                                |
| ------------------------------- | ---------------------------------------------- |
| Modules                         | 40 JavaScript files, 5 stylesheets             |
| Source size                     | 15,318 lines of JavaScript and CSS             |
| Build step                      | None                                           |
| Runtime dependencies            | Chart.js. Three more load only when you export |
| Views                           | 11                                             |
| Column name variants recognised | 255 across 11 target fields                    |
| Data quality rules              | 17                                             |
| Recommendation rules            | 9                                              |
| Reference SKUs                  | 30, each with 12 months of synthetic sales     |
| Lowest colour contrast ratio    | 4.82:1 against a 4.5:1 requirement             |

Every figure above is counted from the source by `scripts/` checks or by direct inspection, not estimated.
