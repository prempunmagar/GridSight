# GridSight — Operational Impact Brief

*Geospatial Video Intelligence Hackathon · Track 02 · Workflow 02 — Transmission Line Inspection*

---

## Headline

GridSight is a **triage layer** for transmission inspection. It ingests drone footage and per-second telemetry and surfaces georeferenced, severity-scored candidate findings for human review. Severity is anchored to **NERC FAC-003-4** Minimum Vegetation Clearance Distance and standard insulator failure modes, not heuristic anomaly scores. The system does not replace human judgment — it lets analysts review a focused list of flagged candidates instead of every minute of footage.

Drone-footage analysis throughput rises from ~25 miles/analyst-day to ~300 miles/analyst-day (≈**12×**, the conservative midpoint of the challenge brief's 10–20× range). On a 5,000-mile regional system with two inspection cycles per year, this produces **~$1.25M of quantified annual value** against ~$32–$62K of GridSight operating cost. A single avoided high-severity incident — at the brief's $1M–$100M+ per-incident range — covers a decade or more of operating cost.

---

## Annual value — illustrative 5,000-mile regional utility

**Stream 1 — Direct labor savings.** At 2 cycles/year and a fully-loaded analyst cost of ≈$150K/year (≈$680/day, US utility-engineer market), 10,000 annual review-miles drop from ≈400 analyst-days (~$272K) to ≈33 analyst-days (~$22K). **Direct savings: ~$250K/year.**

**Stream 2 — Newly enabled inspection coverage.** A 12× analyst throughput multiplier removes the analyst-capacity cap on inspection frequency. Moving from 2× to quarterly (4×) cycles on a 5,000-mile system unlocks 10,000 incremental review-miles/year. At the brief's $100/mile flight cost, this is **~$1.0M/year of newly actionable coverage** that current capacity can't support.

**Failure-prevention expected value.** Vegetation contact is the leading cause of transmission-line failures and the failure mode fatigued frame-by-frame review most often misses. If GridSight prevents one $5M-class incident every five years across this footprint — deliberately conservative against the brief's $1M–$100M+ range — that adds **~$1M/year in expected-value terms**, separate from the throughput streams above.

| Component | Annual value |
|---|---|
| Stream 1 — direct labor savings | ~$250K |
| Stream 2 — newly enabled coverage | ~$1.0M |
| **Combined direct annual value** | **~$1.25M** |
| Stream 3 — failure-prevention EV (additional, situational) | ~$1.0M |

---

## Deployment cost vs. current manual review

| Component | Estimate |
|---|---|
| Bedrock compute (Marengo 3.0 + Pegasus 1.2) | ~$0.50–$2.00 per mile of footage |
| Annual compute on 5,000-mile system at 4× cycles (20,000 review-miles) | ~$10K–$40K/year |
| Storage (evidence clips, findings JSON) | Negligible at scale |
| Integration (CSV / GeoJSON into work-order systems) | One-time engineering |
| **Net annual cost with GridSight** | **~$32K–$62K** |
| Current-state manual review baseline | ~$272K/year (400 analyst-days × $680) |

**That is an 86–96% reduction in direct review cost** at the most conservative read of the GridSight cost range.

---

## ROI and payback period

- **Conservative (direct labor savings only):** ~$210K–$240K/year saved → payback in **1–3 months**.
- **Full quantified model (labor + Stream 2 coverage):** ~$1.19M–$1.24M/year saved → payback in **under two weeks**.
- **Single avoided incident at the brief's low end ($1M):** covers **25–100 years** of GridSight compute cost.

---

## Regulatory readiness

Vegetation findings are scored against NERC FAC-003-4 MVCD thresholds by construction. The GeoJSON export schema includes the MVCD multiple as a property on every finding — directly consumable by a NERC compliance reporting workflow without additional translation.

---

## Detection consistency — the qualitative win

Human analysts are accurate but variable. Performance degrades over a shift, varies between reviewers, and depends on factors (lighting, fatigue, time pressure) that have nothing to do with the asset being inspected. GridSight applies the same NERC-anchored severity rules to mile 1 and mile 10,000.

GridSight is not a replacement for human judgment. It is a triage layer. Inspectors stop watching footage and start solving problems.

---

*NERC FAC-003-4 MVCD reference: 4.3 ft for 345 kV at sea level (the canonical demo configuration). Bedrock cost range derived from measured ~$0.30/min source video on the canonical run (see `docs/TECH.md` §7) with a conservative high-end allowance for re-indexing. Throughput multiplier is the conservative midpoint of the challenge brief's 10–20× range. Per-incident cost range, current-state throughput, and flight-cost figures from the Geospatial Video Intelligence Hackathon Track 02 challenge brief.*
