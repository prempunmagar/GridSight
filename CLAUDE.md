# CLAUDE.md

This file is read automatically by Claude Code when working in this repository. It's the working contract between human and AI for the GridSight project.

## Project

GridSight is the team's submission for the Geospatial Video Intelligence Hackathon (St. Louis, April 25–26, 2026), Track 02 (Energy Infrastructure Monitoring), Workflow 02 (Transmission Line Inspection). The system processes drone footage of high-voltage transmission lines and detects damaged insulators + vegetation encroachment, producing georeferenced findings with evidence clips and a Next.js dashboard.

**Current phase: Phase 1 — Foundations.** See `docs/02_BUILD_PLAN.md` for details. Update this line when the phase changes.

## Required reading

Before any non-trivial task, read:

1. **`docs/01_MASTER.md` Sections 1–5** — what GridSight is, scope, anomaly classes
2. **`docs/02_BUILD_PLAN.md` for the current phase** — what's being built right now and what defines "done"

Task-specific deep reads:
- Working on severity rules → `docs/05_DOMAIN_KNOWLEDGE.md` Section 5 is the literal spec
- Working on schemas / data shapes → `docs/03_REPO_STRUCTURE.md` Section 3 is the contract
- Working on footage, telemetry, or validation labels → `docs/04_DATA_BRIEF.md` + `docs/08_EXTERNAL_DATA_HANDOFF.md`
- Setting up AWS Bedrock → `docs/02_BUILD_PLAN.md` Phase 1 Task 1

The docs are deliberately calibrated. Skimming them costs time later.

## Working style — plan, approve, execute

This is the core rule:

1. **For any non-trivial task, propose a plan first.** Lay out the steps, the files that will be created or edited, the expected outcomes, and any decisions that will be made along the way. Pause and wait for explicit approval ("yes", "go", "looks good", or specific revisions).
2. **Once the plan is approved, execute it autonomously within the agreed scope.** Don't re-ask permission for sub-steps that are part of the plan. Move efficiently.
3. **If the plan needs to grow or change mid-execution, stop and surface the new decision.** Don't quietly expand scope. Better to interrupt and re-plan than to drift.

For trivial tasks (one-line fixes, edits I clearly just asked for, running a test, reading a file), just do them and tell me what you did.

## Will do without asking

- Read any file in the repo
- Run `pytest`, `npm run dev`, `npm run build`, lint/typecheck
- Create new files inside an approved plan's scope
- Edit files inside an approved plan's scope
- Read-only git operations (`git status`, `git diff`, `git log`, `git branch`)
- Search the web for documentation
- Write or refactor code within the approved scope

## Will always ask first

- **Anything that spends AWS credits** (Bedrock calls, S3 uploads). State expected cost if knowable.
- `git push`, `git reset --hard`, force-push, branch deletions, rebase
- Deleting any tracked file
- Modifying `docs/01_MASTER.md` Section 13 (Decisions Log)
- Adding a new dependency to `requirements.txt` or `package.json`
- Anything that crosses an anti-goal (see below)

## Anti-goals — non-negotiable

These come from `docs/01_MASTER.md` Section 4.2 and `docs/02_BUILD_PLAN.md`. Don't relitigate; don't slip past them under time pressure.

- No third anomaly class — just insulator damage + vegetation encroachment
- No swapping the dashboard framework — Next.js is locked
- No dropping intact-condition findings — pipeline records all assets; dashboard filters
- No API layer between Python pipeline and Next.js dashboard — static files only
- No 4K footage, no sub-meter GPS accuracy claims
- No authentication, multi-user, or persistence beyond a single demo session
- No live AWS calls during the live stage demo — pre-computed output only
- No starting Workflow 03 stretch until Decision Gate 3 conditions are met
- No relitigating decisions in `docs/01_MASTER.md` Section 13

If a request would conflict with one of these, surface it explicitly: *"This would conflict with anti-goal X — confirm or revise."*

## Decision Gates

Three explicit go/no-go moments in `docs/02_BUILD_PLAN.md`. Surface and get explicit approval before crossing any of them.

- **Gate 1 (end of Phase 1):** Bedrock auth working end-to-end. If not, escalate to organizers.
- **Gate 2 (end of Phase 3):** Marengo + Pegasus producing usable output, or document the fallback.
- **Gate 3 (Sunday morning, before Phase 5):** All four conditions met before attempting Workflow 03 stretch. Hard rule.

## House rules

- **The TypeScript schemas in `docs/03_REPO_STRUCTURE.md` Section 3 are the contract.** Pipeline writes JSON matching them; dashboard reads JSON matching them. Mismatches break things silently.
- **The severity rules in `docs/05_DOMAIN_KNOWLEDGE.md` Section 5 are authoritative.** Implement them literally; don't reinvent.
- **When a real decision happens** — one affecting scope, architecture, or interface — propose adding it to `docs/01_MASTER.md` Section 13. Don't absorb it silently.
- **When reality drifts from the plan, update the plan first.** Docs and code must agree.
- **Use canonical paths.** `data/curated/` for demo video, `data/telemetry/` for telemetry CSV, `data/validation/` for ground truth, `data/clips_working/` for working clip extraction, `app/public/clips/` for finalized dashboard clips, `out/` for canonical pipeline outputs. Don't invent new locations.
- **Doc numbering convention.** Existing docs are `01–05` and `08`. Slots `06_VALIDATION_REPORT.md` and `07_OPERATIONAL_IMPACT.md` are reserved for Phase 5 outputs. New planning docs use the next free number.

## Commit style

- Short imperative-mood subject line (`Add severity scoring rules`, `Fix telemetry timestamp lookup`)
- Body only when the change is non-obvious; explain the *why*, not the *what*
- One logical change per commit
- Run `pytest` (when tests exist) and any relevant typechecks before committing
- Don't commit AWS credentials, large media files, or anything matching `.gitignore`

## Pipeline / dashboard separation

The Python pipeline runs once and writes its output to disk. The Next.js dashboard reads those static files at startup. **There is no API layer.** This is a deliberate architectural choice (Decision D11) — don't propose adding a server.

The pipeline writes:
- `app/public/data/findings.json`
- `app/public/data/flight_path.json`
- `app/public/data/run_metadata.json`
- `app/public/clips/{finding_id}.mp4`

The dashboard imports these as static assets. No fetch calls to a backend. No live AWS calls.

## When stuck

- Ambiguous spec → ask. Better to clarify than guess.
- Conflicting docs → flag the conflict and propose a resolution. The conflict itself is signal.
- AWS quirks not covered by docs → web search, then capture the finding in the README's "Bedrock notes" or "TwelveLabs gotchas" section so the team doesn't re-discover it.
- Scope creep argument → point at the relevant anti-goal and pull the conversation back.

## Hackathon time pressure

The total clock is roughly 24 hours. Phase 1 (foundations) is the most expensive in time-per-progress and the most important to get right. Don't rush Phase 1 to "save time" — broken foundations cost more downstream than they save up front. Don't dawdle on polish in Phase 6 either; the demo video is the safety net for the live demo.

When in doubt about prioritization: **what would let us submit something working at 12:30 PM Sunday?** Optimize for that, not for the most complete version.
