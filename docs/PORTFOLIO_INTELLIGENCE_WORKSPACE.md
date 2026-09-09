# Portfolio Intelligence Workspace

## Purpose

The **Portfolio Intelligence** workspace provides a local, read-only view of the sanitised portfolio dataset inside the RailMind Control Tower. It is designed to support portfolio-level discussion without exposing organisation identifiers, internal unit identifiers, vendor names, source-system references, contract references, or initiative titles.

## Included analysis

The workspace shows four interactive analysis views. Users can filter all views by portfolio, business area, and award status. The budget chart compares total estimated cost, approved budget for 2026, and recorded expenditure. The expenditure distribution chart provides a business-area drilldown. The award-status chart distinguishes records marked **Not Awarded** from records where a delivery party is identified. The funding outlook displays the values available in the sanitised dataset and does not create future forecasts.

## Data and governance boundary

The workspace embeds only aggregate cells containing the portfolio, general business area, general award status, initiative count, total estimated cost, expenditure, and approved 2026 budget. It does not embed individual source rows or source identifiers. No data is fetched at runtime, and the interface performs no external write. Award status is a procurement-reference indicator only. It does not represent contract completion, delivery progress, readiness, or operational status.

## Baseline metrics

| Metric | Sanitised portfolio total |
|---|---:|
| Aggregated initiatives | 30 |
| Total estimated cost | 364,969,387.46 |
| Recorded expenditure | 72,805,360.17 |
| Spend rate | 19.9% |
| Approved budget for 2026 | 122,403,998.62 |
| Awarded or delivery party identified | 20 initiatives |
| Not awarded | 10 initiatives |

## Validation

The integrated workspace was visually checked in the Control Tower. The new navigation item opens the embedded portfolio dashboard, and the initial view displays 30 initiatives, 365M total estimated cost, 72.8M expenditure, and a 19.9% spend rate at presentation rounding. The portfolio filter was also tested: the Capital selection updates the embedded dashboard to 28 initiatives, 339.8M total estimated cost, 68M expenditure, and a 20.0% spend rate. Automated checks verify the embedded totals, the generalised identifier boundary, the no-external-dependency design, and the existing Agent OS test suite.
