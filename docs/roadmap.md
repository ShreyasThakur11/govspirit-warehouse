# Roadmap

What is worth building next, and why. Ordered by value to a depot, not by ease.

Nothing here is dated. This is a public project without a delivery commitment.

## Next

**Unit tests for `src/lib/` and `src/analytics/`.** The most visible gap. The
library layer was deliberately separated from the UI layer so its functions are
pure and testable without a DOM. Date parsing, the CSV parser, the mapper
scoring and the KPI formulas are the highest-value targets: every one of them
has already produced a real defect.

**axe-core in CI.** Contrast and stylesheet coverage are checked
programmatically. Structural accessibility is checked by inspection, which does
not scale.

**Screen reader verification.** NVDA, JAWS and VoiceOver behave differently
enough that correct semantics are not the same as a good experience. This needs
a person, not a script.

## Worth doing

**Hourly activity analysis.** The previous version fabricated this with
`Math.random()` and it was removed. Doing it properly needs timestamped picks,
which most depot exports do not currently carry. Worth revisiting if a source
of pick timestamps appears.

**Multi-period comparison.** Every figure is a snapshot. "Down 12% on last
month" is more actionable than an absolute number, and needs either two
uploaded files or a stored previous position.

**Replenishment suggestions.** The reference dataset already holds monthly
sales velocity, so a reorder point and quantity are computable for any SKU that
matches it. Blocked on lead-time data, which is currently only in the supplier
file when a supplier file exists.

**Print stylesheet refinement.** Printing works and pages break sensibly, but
the output has not been reviewed by anyone who files these reports.

**Real bin-level slotting.** Zone-level advice is useful. Bin-level advice
needs travel distances, which needs a coordinate system in the layout file.

## Considered and rejected

**A backend.** Would make multi-user access, saved history and scheduled
reports possible. It would also make the tool unusable for its audience, who
cannot send stock positions to a third-party service. Not a trade worth making.

**A framework and a build step.** Would give components, a router and a test
harness for free. It would also mean the folder no longer opens from a shared
drive without a toolchain, and that a dependency tree needs maintaining for a
project that currently has one runtime dependency.

**Machine learning for demand forecasting.** The rules currently applied are
ones a warehouse manager can check by hand and disagree with. That is a
feature. A model that cannot explain itself to an excise officer is worse than
a threshold they can argue about.

**A mobile application.** The web application already works to 320px. A native
shell would add a distribution problem without adding capability.

## Contributions

If you want to work on something here, open an issue first so effort is not
duplicated. See [CONTRIBUTING.md](../.github/CONTRIBUTING.md).
