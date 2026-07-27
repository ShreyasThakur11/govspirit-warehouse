# Contributing

Thanks for looking. Bug reports, corrections and pull requests are all welcome.

## Before you start

Read [docs/architecture.md](../docs/architecture.md). Two constraints shape
everything and are not open to change without discussion:

1. **Nothing leaves the browser.** No backend, no telemetry, no upload. The
   audience cannot use a tool that transmits their stock position.
2. **No build step.** Classic scripts, so the folder still opens from a shared
   drive in five years. ES modules would break `file://` loading.

## Setup

```bash
npm install
npm start        # http://localhost:4173
npm run check    # lint, format, contrast, stylesheet coverage
```

## What a good pull request looks like

- One concern per pull request
- `npm run check` passes
- New or changed metrics are documented in [docs/metrics.md](../docs/metrics.md)
- New classes exist in `assets/css`, which `npm run check:classes` enforces
- New colours carry a measured contrast ratio, which `npm run check:contrast`
  enforces
- Manually verified at 320px and at 1280px

## Commit messages

Imperative subject under 72 characters, then bullets if there is more to say.

```
fix: parse day-first dates in slash format

Native Date() reads 01/02/2026 as 2 January. In India that string means
1 February, so every affected record was a month out.

- DMY branch added to Format.parseDate
- Falls back to month-first only when the day field exceeds 12
```

Prefixes: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, `chore`,
`ci`. Append `!` for a breaking change.

## Things that will be sent back

**A metric that invents its input.** If the source data is absent, return
`null`. Version 1 reported 98.5% inventory accuracy for depots that had never
uploaded a cycle count, and that figure then fed the health score. This is the
one rule with no exceptions.

**Unescaped interpolation.** All markup goes through the `html` tagged
template. `raw()` needs a comment explaining why it is safe.

**Emoji as iconography.** Add a path to `src/ui/icons.js` instead. The
reasoning is in [docs/design-system.md](../docs/design-system.md).

**Colour as the only signal.** Every status needs a word as well as a hue.

**A magic number in a condition.** Name it in a `THRESHOLDS` constant so it can
be found, discussed and changed.

## Reporting a bug

Open an issue with:

- What you did, what happened, what you expected
- Browser and version
- Whether it reproduces with the **sample depot**, which is seeded and therefore
  identical for everyone
- Any console output

A reproduction against the demo dataset is worth more than a description,
because the generator produces the same numbers on every machine.

Do not attach a real stock export. If the bug depends on the shape of your
file, describe the column headings and the row count instead.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).

## Licence

Contributions are accepted under the [MIT Licence](../LICENSE).
