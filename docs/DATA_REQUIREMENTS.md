# RailMind Data Requirements

Status: **P0 data contract**

The first objective is not to ingest everything. It is to identify the minimum trusted data required to answer management questions and reproduce each number with evidence.

## 1. Source-of-truth map

| Domain | Authoritative source | RailMind treatment |
|---|---|---|
| Asset register | IBM Maximo | Read; reference canonical asset IDs |
| Work orders / failures | IBM Maximo | Read; normalize only fields required for analytics |
| PM / job plans | IBM Maximo | Read |
| Meter / inspection / condition data | Maximo or condition systems | Read |
| Inventory / spares | Maximo / inventory system | Read when required by use case |
| Invoice / workflow | Maximo Finance / finance system | Read |
| Contract terms | approved contract repository | Read approved clauses and KPI definitions |
| RailMind decisions | RailMind | Own assessments, recommendations, reviews and outcomes |

## 2. Asset master minimum fields

* canonical asset ID / asset number
* parent asset and hierarchy
* system / subsystem / asset class
* location / line / station / depot / section
* status
* manufacturer / model
* commissioning date when available
* criticality or consequence class
* responsible maintenance discipline

## 3. Work-order and failure fields

* work-order ID
* asset ID
* work type: PM / CM / inspection / other
* status and priority
* reported / target / actual start / completion timestamps
* failure, problem, cause and remedy codes
* downtime / service impact where available
* labour hours
* material / actual cost where available
* repeat-failure linkage or enough fields to derive it

## 4. PM fields

* PM ID
* asset ID
* frequency and unit
* last completed date
* next due date
* compliance / deferment status
* linked job plan where required

## 5. Condition and inspection fields

* asset ID
* signal / inspection name
* reading or result
* unit
* observation timestamp
* baseline / limit / alarm threshold when authoritative
* quality status

## 6. Finance fields

For the first reporting use case:

* invoice ID
* contract ID
* vendor / contractor ID
* invoice date
* gross / approved amount
* currency
* status
* workflow stage
* approval / rejection date
* variation or deduction reference where applicable

No bank data, personal payment credentials or unnecessary finance fields belong in P0.

## 7. Contract and KPI fields

Each KPI must have a machine-readable definition before AI narration is allowed:

* KPI ID and name
* contract ID
* exact formula and formula version
* unit
* period / reporting cadence
* inclusion and exclusion rules
* threshold / target
* direction: higher is better, lower is better or exact target
* source fields required
* evidence rules
* owner and contractor review roles
* applicable clause reference
* penalty / incentive rule only when formally approved and testable

## 8. P0 KPI set

Start with five decision-useful measures:

1. Availability
2. Failure count / service-affecting failures
3. MTBF
4. MTTR
5. Maintenance backlog, with PM compliance as the next candidate

The exact formulas must be confirmed against the applicable contract and RMD definitions. Do not copy generic formulas into production.

## 9. Provenance requirement

Every ingested fact should be carried with:

* source system
* source entity type
* source record ID
* observed timestamp
* ingestion timestamp
* data quality state
* optional source URI
* optional snapshot hash for audit

## 10. Refresh policy: right-time intelligence

| Data | Initial refresh target |
|---|---|
| work orders / failures | 15 min to daily, depending on Maximo integration capability and decision need |
| asset master | daily or event-based |
| PM status | daily |
| condition alarms | event / near-real-time only where operationally useful |
| KPI aggregates | recompute after relevant source refresh |
| invoices / workflow | daily or workflow event |
| obsolescence | monthly / quarterly unless a material event occurs |
| formal monthly report | generated from locked period data |

## 11. Data quality gates

A KPI or report section must be marked provisional when required source data is missing, stale, contradictory or unreconciled. AI must not hide a data-quality problem behind fluent narrative.
