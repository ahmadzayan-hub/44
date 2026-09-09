# Portfolio Intelligence Workspace

## Purpose

The **Portfolio Intelligence** workspace provides a local, read-only view of the sanitised portfolio dataset inside the RailMind Control Tower. It is designed to support portfolio-level discussion without exposing organisation identifiers, internal unit identifiers, vendor names, source-system references, contract references, or initiative titles.

## Included analysis

The workspace shows four interactive analysis views. Users can filter all views by portfolio, business area, and award status. The budget chart compares total estimated cost, approved budget for 2026, and recorded expenditure. The expenditure distribution chart provides a business-area drilldown. The award-status chart distinguishes records marked **Not Awarded** from records where a delivery party is identified. The funding outlook displays the values available in the sanitised dataset and does not create future forecasts.

## Exploratory 2026 predictive forecast

The workspace also provides an **exploratory, schedule-adjusted forecast of additional expenditure through 31 December 2026**. It uses the observed distribution of cumulative-spend pace across eligible awarded initiatives. For each observed record, pace equals cumulative expenditure as a proportion of total estimated cost, divided by schedule progress at the as-of date. The forecast presents the 25th percentile, median, and 75th percentile pace scenarios as **P25**, **P50**, and **P75**.

The forecast as-of date is **9 September 2026**, and the horizon is **31 December 2026**. The calibration cohort contains 10 awarded initiatives with recorded expenditure and at least 10% schedule progress. It excludes unawarded initiatives, completed initiatives, zero-spend initiatives, and items without valid schedule data. The P50 scenario is the central planning reference; the P25 and P75 scenarios provide a range rather than a confidence interval.

### Interactive scenario explorer

The scenario explorer provides a selectable **P25, P50 and P75** view across the generalised business areas. The displayed bar represents the selected scenario, the pale envelope represents the full P25–P75 range, and the white marker identifies the P50 reference point. Selecting a business area opens a focused detail panel with its three scenario values, the forecast range, and its gross approved-allocation comparison. The controls respect the existing portfolio, business-area and award-status filters.

> The source workbook contains cumulative expenditure and execution dates, but no monthly or quarterly expenditure history. Therefore, this is **not a time-series forecast**, a committed budget, a cash forecast, or a contractual entitlement. It is a transparent planning indicator that must be reconciled against approved cashflow, commitments, actual progress, and finance controls before decision use.

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

The integrated workspace was visually checked in the Control Tower. The new navigation item opens the embedded portfolio dashboard, and the initial view displays 30 initiatives, 365M total estimated cost, 72.8M expenditure, and a 19.9% spend rate at presentation rounding. The portfolio filter was also tested: the Capital selection updates the embedded dashboard to 28 initiatives, 339.8M total estimated cost, 68M expenditure, and a 20.0% spend rate. The forecast view was visually checked with both the full portfolio and Capital selection. At the full portfolio view, the P25, P50 and P75 additional-expenditure scenarios are 11.7M, 15.1M and 35.5M respectively. For Capital, they are 9.6M, 12.4M and 30.0M. The embedded version was also reopened through the Control Tower navigation and displayed the forecast-enabled dashboard correctly. The scenario explorer was tested in the P75 view, which reordered the business areas by the faster-pace forecast and updated the aggregate detail panel to 35.5M. Selecting Business Area-03 then updated the detail panel to its P75 forecast of 7.3M, while retaining the P25 and P50 reference values and gross allocation comparison. Automated checks verify the embedded totals, the generalised identifier boundary, the no-external-dependency design, the deterministic forecast rules, and the existing Agent OS test suite.
