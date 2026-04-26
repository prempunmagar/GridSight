# GridSight — Operational Impact Brief

> Automated visual anomaly detection for high-voltage transmission inspection.
> One-page summary of operational value for utility operators.

---

## The problem operators face today

The U.S. grid includes ~200,000 miles of high-voltage transmission. Each line requires periodic visual inspection for insulator damage, vegetation encroachment, and structural anomalies. Current practice relies on manual frame-by-frame review of drone or helicopter footage — a single analyst processes **20–30 miles of footage per day**. Inspection flights themselves cost **$50–$150 per mile**; analyst review is the bottleneck that determines how often a system can actually be inspected.

A single transmission-related failure can cost **$1M–$100M+** in incident response, equipment replacement, and outage liability — and the most common contributor (vegetation contact) is exactly the failure mode that fatigued frame-by-frame review is most likely to miss.

## What GridSight changes

GridSight ingests the two standard outputs of any drone inspection — video and telemetry — and produces a prioritized, georeferenced findings list. Severity is anchored to **NERC FAC-003-4** clearance distances and standard insulator failure modes, so each finding maps to a regulatory or maintenance threshold rather than a generic "anomaly score." The system is voltage-class agnostic; the demo uses **345 kV (MVCD = 4.3 ft)** but the same pipeline applies to 230 kV, 500 kV, or 765 kV with a single configuration change.

| Metric | Current state | With GridSight | Improvement |
|---|---|---|---|
| Footage review throughput | 25 miles/analyst-day | ~300 miles/analyst-day | **~12×** |
| Time from flight to findings | Days to weeks | ~6 minutes per 13 minutes of footage | Same-day turnaround |
| Severity calibration | Analyst judgment | NERC FAC-003 / failure-mode anchored | Consistent across reviewers |
| Coverage of inspected mileage | Limited by analyst hours | Full — humans focused on flagged findings | — |

> Throughput multiplier is a conservative midpoint of the 10–20× range cited by the challenge brief and is consistent with our measured Bedrock end-to-end runtime (~28 sec per minute of source video; see `docs/TECH.md` §6).

## Annual value — illustrative 5,000-mile regional utility

Reference deployment: 5,000 miles of transmission across a regional utility's footprint (matches the scale of the demo corridor's operator class). Two value streams, both grounded in the challenge brief's own cost numbers.

### Stream 1 — Direct labor savings

At 2 inspection cycles/year, fully-loaded analyst cost ~$150K/year (~$680/day):

| Line item | Current state | With GridSight |
|---|---|---|
| Annual review-miles | 10,000 | 10,000 |
| Analyst-days required | ~400 | ~33 |
| Annual analyst cost | ~$272,000 | ~$22,000 |
| **Direct labor savings** | — | **~$250,000/year** |

### Stream 2 — Newly enabled inspection coverage

Operators today inspect on cycles dictated by analyst capacity, not asset risk. A 12× throughput improvement makes higher-frequency inspection economically viable — moving from 2× to quarterly (4×) inspection on a 5,000-mile system unlocks 10,000 incremental review-miles per year.

At the brief's flight-cost figure of $100/mile (midpoint of the $50–$150 range), this is **~$1.0M/year of newly actionable inspection coverage** that operators currently capture only intermittently because analyst capacity can't keep up.

This isn't theoretical capacity — it's the gap between flight cost (which utilities pay anyway, on a longer cycle) and review cost (which currently caps inspection frequency).

### Combined annual value

| Component | Annual value |
|---|---|
| Direct labor savings | ~$250,000 |
| Newly enabled coverage | ~$1,000,000 |
| **Total quantified value** | **~$1.25M/year** |
| Failure-prevention expected value | Multiplier (situational) |

For a single avoided high-severity incident — at the brief's $1M–$100M+ per-incident range — failure prevention alone pays for years of GridSight operation.

## Deployment cost

Inspection drones at corridor-following altitudes typically cover ~1 mile in 3 minutes of footage at 22 mph cruise. At our measured Bedrock cost of ~$0.30 per minute of source video (Marengo indexing + 7 query embeddings + ~14 Pegasus describes + storage; see `docs/TECH.md` §6):

| Cost component | Estimate |
|---|---|
| Bedrock compute (Marengo + Pegasus per mile of footage) | ~$0.90 / mile |
| Annual compute on 5,000-mile, 4× cycle deployment | ~$18,000 / year |
| Storage (evidence clips, findings JSON) | Negligible at scale |
| Integration (CSV/GeoJSON into work-order systems) | One-time engineering |

## Payback

Direct labor savings alone (~$250K/year) against ~$18K/year of Bedrock compute is a **payback of under one month**. Including the full quantified value model (newly enabled coverage + failure prevention), payback is functionally immediate — the first prevented incident covers a decade of compute cost.

## Detection consistency — the qualitative win

Human analysts are accurate but variable. Performance degrades over a shift, varies between analysts, and depends on factors (lighting, fatigue, time pressure) that have nothing to do with the asset being inspected. An automated system applies the same severity rules to mile 1 and mile 10,000.

GridSight is not a replacement for human judgment — it is a triage layer. Inspectors stop watching footage and start solving problems.

---

---

*NERC FAC-003-4 MVCD reference: 4.3 ft for 345 kV at sea level – 500 ft altitude (the canonical demo configuration). Per-incident cost range, current-state throughput, and flight-cost numbers from the Geospatial Video Intelligence Hackathon Track 02 challenge brief. Workflow 03 multi-source correlation extension was not shipped per the decision rule in `01_MASTER.md` §13.*
