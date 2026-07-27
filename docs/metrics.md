# Metrics

[Documentation index](README.md)

Every figure the application displays, what it is computed from, and what it
does when that input is missing.

## The rule

**A metric with no evidence returns `N/A`.**

The previous version returned 98.5% inventory accuracy when no cycle count had
ever been uploaded, 15 picks per hour with no workforce file, and 97% pick
accuracy from nowhere at all. Those three invented figures then fed the
warehouse health score, so a depot that had supplied nothing but a stock list
scored well. A dashboard that supplies its own inputs is worse than no
dashboard, because it is confidently wrong.

Source: [`src/analytics/kpiEngine.js`](../src/analytics/kpiEngine.js)

---

## Inventory

| Metric          | Formula                                                              | Requires               |
| --------------- | -------------------------------------------------------------------- | ---------------------- |
| Total SKUs      | Distinct `sku_id` in inventory                                       | Inventory              |
| Active SKUs     | Distinct `sku_id` where `is_active` is Yes and quantity above zero   | Inventory              |
| Total bottles   | Sum of `quantity_bottles`                                            | Inventory              |
| Inventory value | Sum of `total_value`, itself `quantity × unit_price` when not stated | Inventory with a price |
| Case equivalent | Total bottles divided by 12                                          | Inventory              |
| Average dwell   | Mean of `days_in_stock`                                              | Inventory with dates   |

### Dead stock

A line is dead when nothing has left it for 90 days.

```
if last_dispatched_date exists:  dead = days since that date > 90
otherwise:                       dead = days_in_stock > 90
```

The last-dispatch date is authoritative where present. Dwell time is the
fallback, because a line received 200 days ago that shipped last week is not
dead, and treating it as dead would send an operator to move perfectly healthy
stock.

---

## Orders and fulfilment

### Fill rate

```
fill rate = order lines shipped complete / total order lines × 100
```

Measured on **lines, not orders**. A customer who asked for five products and
received four has had one line fail, and that is the number that matters
operationally. Counting whole orders would hide it.

A line counts as complete only when `quantity_fulfilled >= quantity_ordered`.
Partial shipment is not fulfilment.

### Order completion rate

```
completed orders / (completed + pending) × 100
```

Distinct order identifiers, not lines. Cancelled orders are excluded from both
sides rather than counted as failures.

---

## Storage

### Utilisation

```
storage utilisation = total bottles / total zone capacity × 100
```

Capacity comes from the warehouse layout file when one is supplied. Without
one it is **estimated** at 100 bottles per observed bin, and the figure is
flagged as estimated everywhere it appears, including in the recommendation
text. An estimate presented as a measurement is the same failure as an
invented metric.

### Bin occupancy

```
occupied bins / total bins × 100
```

Falls back to counting distinct `bin_id` values in the inventory when no
layout file exists.

### Inventory accuracy

```
cycle count lines where status is Matched / total counted lines × 100
```

**Returns `N/A` without a cycle count file.** There is no substitute for a
physical count, and inferring one would defeat the purpose of the measure.

---

## Turnover

```
turnover = (dispatch value over the last 30 days × 365 / 30) / inventory value
```

An annualised approximation. Without opening and closing balances a true
turnover cannot be computed, so the assumption is stated rather than hidden.
The previous implementation divided by `inventoryValue / 2 || 1`, which had no
stated basis at all.

Returns `N/A` when either input is zero.

---

## Classification

### ABC, by value

SKUs are ranked by inventory value and assigned on cumulative share:

| Class | Cumulative share of total value |
| ----- | ------------------------------- |
| A     | Up to 80%                       |
| B     | 80% to 95%                      |
| C     | Above 95%                       |

### XYZ, by demand variability

Coefficient of variation of monthly dispatch quantity:

```
CoV = standard deviation of monthly dispatch / mean monthly dispatch
```

| Class | CoV                              | Meaning             |
| ----- | -------------------------------- | ------------------- |
| X     | 0.5 or below                     | Stable, plannable   |
| Y     | 0.5 to 1.0                       | Variable            |
| Z     | Above 1.0, or too little history | Sporadic or unknown |

**Fewer than three observed months returns Z with a stated reason** rather than
a computed figure. Variability across two data points is not variability.

### Movement, by dispatch frequency

Distinct days on which a SKU was dispatched:

| Class | Distinct dispatch days |
| ----- | ---------------------- |
| Fast  | 15 or more             |
| Slow  | 5 to 14                |
| Dead  | Under 5                |

---

## Warehouse health score

A weighted mean of five components:

| Component          | Weight | Source                            |
| ------------------ | ------ | --------------------------------- |
| Inventory accuracy | 0.25   | Cycle count file                  |
| Fill rate          | 0.25   | Orders                            |
| Storage balance    | 0.20   | `100 - abs(utilisation - 75) × 2` |
| Dead stock         | 0.15   | `100 - dead share × 2`            |
| Pick accuracy      | 0.15   | Employee file                     |

**Components with no data are dropped and the remaining weights are
renormalised.** The interface reports how many of the five contributed, so a
score of 75 from two components is never mistaken for a score of 75 from five.

Storage balance targets 75% utilisation. Deviation in either direction costs
points: an empty warehouse is as much a problem as a full one, just a different
problem.

---

## Concentration

```
value held by the top 10% of lines / total inventory value × 100
```

Above 60% the concentration recommendation fires. High concentration means a
single stockout or loss event has an outsized effect.

---

## Trends

Thirty daily buckets, keyed by **local calendar date**.

The previous implementation used `toISOString().slice(0, 10)`, which converts
to UTC first. For a reader in India at UTC+5:30 that shifted every record
before 05:30 into the previous day, silently, on every chart. Day keys are now
built from `getFullYear`, `getMonth` and `getDate`, which cannot drift.

---

## Recommendation thresholds

Nine rules, in [`src/analytics/recommendationEngine.js`](../src/analytics/recommendationEngine.js).
Each threshold is a named constant, not a number buried in a condition.

| Rule                | Fires when                                                    | Priority                                         |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Slotting            | A SKU above 2% of dispatched volume sits outside zones A or B | High                                             |
| Rack rebalancing    | A rack at 90% or above exists alongside one below 30%         | High                                             |
| Zone congestion     | A zone at 85% or above exists alongside one below 45%         | Medium                                           |
| Dead stock          | Any line unmoved for 90 days                                  | Critical above ₹5 lakh, otherwise High or Medium |
| Fill rate           | Below 85%                                                     | Critical below 70%, otherwise High               |
| Concentration       | Top decile holds above 60% of value                           | Medium                                           |
| Dispatch time       | Mean cycle above 60 minutes                                   | High                                             |
| Damage              | Above 20 units on the register                                | Medium                                           |
| Missing cycle count | No count file supplied                                        | Low                                              |

The slotting threshold was 5% until it was measured against a real catalogue.
With around 90 SKUs the mean share is roughly 1%, so 5% was unreachable and the
rule had never once fired. It is now 2%.

Where a rule quotes an improvement range, that range is presented as an
industry rule of thumb and labelled as such. It is not a prediction derived
from your data.

---

## Projected data

Uploading a stock list alone gives no order history, so the trend and
fulfilment views would be empty. The application therefore projects an order
history from the reference sales curve.

This is modelling, and it is labelled as modelling:

- `Store.dataSource` records that the history was projected
- Every dashboard shows a standing notice explaining which figures are affected
- The notice states what to upload to replace the projection with real history

Inventory is never projected. What you uploaded is what is reported.
