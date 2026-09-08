# RailMind P0 Pilot

Goal: prove that a governed real-time/right-time data flow can replace a material part of manual monthly reporting without creating a second system of record.

## Pilot boundary

One maintenance contract or one clearly bounded asset/system scope.

Five initial measures:

* Availability
* Failure count / service-affecting failures
* MTBF
* MTTR
* Maintenance backlog

One monthly report package and one executive exception view.

## Phase 0: authority and data contract, Week 1

* confirm exact KPI definitions and contract clauses
* map Maximo fields to the canonical RailMind data contract
* identify finance/invoice fields required
* define owner/contractor review roles
* define source refresh intervals
* create synthetic/anonymized sample dataset

Exit: every KPI can be reproduced manually from the mapped source fields.

## Phase 1: deterministic data and KPI layer, Weeks 2 to 3

* Maximo read adapter against sample/exported data first
* ingestion provenance
* data-quality checks
* deterministic KPI calculations
* unit tests for formula versions

Exit: same inputs always produce the same metrics; no LLM required.

## Phase 2: Control Tower and exception model, Weeks 4 to 5

* KPI cards and trends
* ranked exception centre
* drill-down from KPI to source evidence
* owner/contractor status and review state

Exit: a manager can identify what needs attention without reading the full report.

## Phase 3: Agent OS and reporting, Weeks 6 to 8

* local model gateway
* grounded Reporting Agent
* Maintenance KPI Agent
* Executive Briefing Agent
* assumptions and evidence visible in every output
* human approval workflow

Exit: monthly narrative is drafted from approved KPIs and exceptions and can be traced to evidence.

## Phase 4: comparison and value case, Weeks 9 to 12

Run one reporting cycle in parallel:

* traditional reporting process
* RailMind-enabled reporting process

Measure:

* preparation hours
* review/reconciliation hours
* number of manual files touched
* number of emails/letters used for routine reporting
* KPI disputes
* data-quality issues detected before submission
* report cycle time
* time from exception to management attention
* reviewer confidence and acceptance rate

## Scale decision

Scale only if RailMind demonstrates measurable reduction in reporting/reconciliation effort while improving traceability, decision latency and data confidence.
