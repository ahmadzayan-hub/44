# ADR-002: RailMind platform scope evolution

Status: **proposed**

## Context

The current RailMind Product Authority defines a focused asset-maintenance decision product and explicitly assigns contract compliance to VERTEX and monthly management review to Annual Plan. The new owner-contractor concept requires a shared operating environment that combines asset, maintenance, contract, finance and reporting intelligence.

Expanding RailMind by simply copying every domain into one codebase would violate the portfolio governance rule and create another monolithic system of record.

## Decision

Evolve RailMind into a **decision and orchestration platform over bounded domains**, while keeping authoritative ownership separate.

RailMind may:

* connect to Maximo and finance sources read-only
* consume approved contract/KPI definitions through a contract port
* compute deterministic maintenance metrics when RailMind is the defined calculation authority
* compose cross-domain exceptions and report packages
* host the Agent OS, evidence model, human approval and decision memory

RailMind must not:

* become the master asset register
* become the finance ledger
* silently redefine contract obligations
* duplicate another canonical product's ownership without an explicit portfolio decision
* perform safety-critical rail control

## Consequence

The UI can look like one integrated platform to the user while the architecture remains a system of systems. This gives the desired owner-contractor experience without destroying source-of-truth discipline.

## Portfolio action required

Before merging contract compliance or Annual Plan ownership into RailMind, make a separate canonical portfolio decision: Keep, Merge, or Retire the overlapping capability. Until then, RailMind integrates through ports and does not claim ownership.
