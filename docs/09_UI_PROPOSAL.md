# GridSight — Dashboard UI/UX Proposal

> **Status:** Proposal, Saturday April 25, 2026.
> **Companion docs:** `01_MASTER.md` (project source of truth), `02_BUILD_PLAN.md` (execution playbook), `03_REPO_STRUCTURE.md` (where the dashboard code lives).
>
> This document specifies the dashboard's interaction model, layout, and visual system. It is the design intent for `app/`. Implementation happens after the backend pipeline is producing real `findings.json` data.

---

## How to use this document

This proposal is the design source-of-truth for the GridSight dashboard. It is deliberately not a mockup — building visual artifacts before the data shape is locked is a known trap. The team will implement the design in React + Tailwind + react-leaflet once the pipeline is producing canonical output.

The doc has six sections:

1. **Design philosophy** — the principles that drive every smaller decision.
2. **Layout** — three-zone structure, panel dimensions, responsive behavior.
3. **Component-by-component spec** — header, findings list, map, detail panel, timeline strip.
4. **Design system** — color tokens, typography, spacing, motion.
5. **Interaction model** — click flows, state changes, edge cases.
6. **Cut list** — what to drop first if time runs short.

References to the `findings.json` schema, severity tiers, and architectural decisions live in `01_MASTER.md`. This document does not duplicate them — it specifies how they're rendered.

---

## 1. Design Philosophy

GridSight is **an operations console, not a video gallery.** The TwelveLabs reference demos (Compliance Intelligence, Nashville) treat video as the subject of the interface. We invert that. The corridor and its findings are the subject; video is the evidence that backs each finding. Every pixel should help an inspector answer one question: *where is the next problem and what do I do about it?*

Three principles drive every smaller decision:

1. **Severity is the organizing principle.** Not chronology, not category. Critical findings dominate visually; healthy assets recede. Color does heavy lifting; layout reinforces hierarchy.
2. **Spatial-temporal grounding is our advantage.** Both reference demos lack continuous corridor context — Nashville pins discrete cameras on a map, Compliance Intelligence has no spatial layer at all. GridSight always shows the inspection path and the findings on it together. Use this shamelessly.
3. **Evidence is one click away.** Inspectors verify findings visually before dispatching crews. The 15-second clip and its spatial-temporal context must be reachable with a single click from any finding, with no loading state.

A fourth, smaller principle for visual identity: **technical, not consumer.** No gradients, no glass effects, no marketing-page CTAs. The design vocabulary is closer to Datadog or Grafana than to a SaaS landing page. Judges should believe a real utility's operations team could use this.

---

## 2. Layout

Single-page application, no nav tabs. 1440px design width, responsive down to 1280px. Below 1280px the dashboard is not supported — this is a hackathon, not a mobile app.

The page has three zones plus a header and a footer strip:

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER (64px, fixed)                                                 │
│  GridSight │ Ameren MO 345kV │ 7m · 16 findings · 3 critical │ ⤓ ▾ │
├──────────────────┬───────────────────────────────────┬──────────────┤
│  FINDINGS LIST   │                                   │  DETAIL      │
│  (380px)         │            MAP VIEW               │  PANEL       │
│                  │                                   │  (420px)     │
│  Filter chips    │  • Inspection-path polyline       │              │
│  Sort dropdown   │  • Severity-coded finding pins    │  [drawer     │
│                  │  • Pulse on selected pin          │   slides in  │
│  Finding cards   │                                   │   on click]  │
│  (scroll)        │  Layer ▾  ⊕ ⊖  Fit corridor       │              │
│                  │                                   │              │
├──────────────────┴───────────────────────────────────┴──────────────┤
│  TIMELINE STRIP (56px) — severity heatmap of the run                  │
└──────────────────────────────────────────────────────────────────────┘
```

The detail panel is hidden by default so the map breathes; it slides in from the right when a finding is selected. The map width grows to fill the freed space when the panel is closed.

### Why three zones, not two

The reference demos use two-panel layouts (Nashville: video + map; Compliance Intelligence: analysis + video). Two panels force a binary choice — show the data or show the evidence. Three zones let us show the inventory (left), the spatial overview (center), and the focused evidence (right) simultaneously. An inspector working through 16 findings doesn't want to lose the corridor view every time they click a row.

### Responsive behavior

At ≥1440px, all three zones render at full width. At 1280–1439px, the findings list narrows from 380px to 320px and the detail panel narrows from 420px to 380px. Card content reflows; nothing is hidden.

---

## 3. Component-by-component Spec

### 3.1 Header

Fixed, 64px tall, full width. Three clusters left-to-right.

**Left cluster:** wordmark — "GridSight" in 24px Inter Semibold, no logo competing for attention. The wordmark is the home link (clicking it deselects any open finding and recenters the map).

**Center cluster:** corridor identity in mono. Two lines, tight leading:
```
Ameren MO 345 kV         (12px JetBrains Mono, text.secondary)
7 min · 16 findings · 3 critical    (11px mono, "3 critical" colored severity.critical)
```
The "3 critical" count in red picks up the eye immediately on page load. If the actual run produces zero critical findings, the count is omitted entirely (not "0 critical" — that reads as the system finding nothing concerning, which is a bad first impression even when it's accurate).

**Right cluster:** Export dropdown (CSV / GeoJSON / PDF Report), settings gear (placeholder for the demo, no actual settings to adjust), "HACKATHON DEMO" badge in muted text at the far right edge.

### 3.2 Findings List (left rail, 380px)

Scrollable column. Sticky filter and sort controls at the top.

**Filter chips row** at the top of the list:
```
All 16  ●Critical 3  ●High 5  ●Moderate 6  ●Low 2
```
Each chip is a pill with the severity color dot, label, and count. Active filter chip has a filled background; inactive chips are outlined. Counts live-update when toggled. Chips are not mutually exclusive — multiple severities can be active at once.

**Sort dropdown** below the chips: "Severity (high → low)" default, with options "Timestamp", "Confidence", "Class". Single-select.

**Show intact assets toggle** below the sort. Off by default. When on, surfaces the `intact` / `no_action` findings (per Decision D9 in `01_MASTER.md`) so judges can see Marengo's full output, not just the actionable subset. The toggle is small and lives below the primary controls — it's an honesty surface, not a primary feature.

**Finding card** (one per finding):

```
┌─ ● ─────────────────────────────────────┐
│   CRITICAL                              │
│   Shattered porcelain disk              │
│   suspension tower, outer cross-arm     │
│                                         │
│   02:14 · 38.6712°N, 90.7156°W · 345 kV │
│   FAC-003 §R2                    ●●● hi │
└─────────────────────────────────────────┘
```

Anatomy:
- **4px severity bar** on the left edge — the eye reads color before text
- **Severity label** in small caps, semibold, severity-colored (e.g., `CRITICAL` in `severity.critical`)
- **One-line title** generated from Pegasus's structured output: short, specific, scannable
- **Two-line context line** in mono: timestamp · GPS · voltage class
- **NERC citation chip** in the bottom-left if the finding has a regulatory anchor: `FAC-003 §R2` in 10px mono inside a soft chip
- **Confidence dots** in the bottom-right: ●●● (high), ●●○ (medium), ●○○ (low). Visual, instant. Hover reveals the underlying numbers (Marengo similarity, Pegasus confidence)

Hover state: card lifts 2px with a soft shadow (no color change — color is reserved for severity). Click state: card highlights with a thin accent.brand outline, the corresponding pin pulses on the map, and the detail panel slides in.

Density target: at default zoom, ~4 cards visible above the fold in the left rail. Scrolling reveals the rest.

### 3.3 Map View (center)

The map fills the remaining horizontal space between the findings list and the detail panel. Leaflet base layer.

**Default tile layer:** CartoDB Positron (light, low-saturation streets). Light tiles read as "engineering tool"; dark satellite reads as "security theater." Toggle in the top-right corner of the map for Light / Streets / Satellite. Default stays Light unless the team finds the contrast for pins is too low at runtime.

**Inspection-path polyline:**
- Drawn from the corridor waypoints
- Color: `accent.brand` (#0369A1) at 60% opacity
- Width: 3px
- The path is rendered as a single static polyline. It does not animate. (See the conversation history that arrived at this decision; an earlier proposal had the path animate to follow video playback. This was simplified.)

**Finding pins:**
- 28px diameter
- Color-coded by severity using the severity color tokens
- Small class glyph inside the pin: insulator icon for Class A, leaf icon for Class B
- Subtle drop shadow so pins read clearly against any tile color
- Pins are clickable; hover reveals a small tooltip with the title and timestamp

**Selected pin** has a pulse animation: a concentric ring expands outward over 1.6s, fading from 40% opacity to 0%, then loops. The pulse uses the same severity color as the pin.

**Critical findings** get a 50m-radius halo circle in `severity.critical` at 10% fill, no stroke. This visualizes "the area around this finding that needs immediate attention" and reads as authoritative without being alarmist. Halos render only for critical-tier findings — adding them to all severities would clutter the map.

**Map controls:**
- Zoom +/− in the top-left (Leaflet default position, restyled to match the design system)
- "Fit corridor" button below the zoom controls — resets the viewport to fit the polyline plus all pins with 40px padding
- Layer toggle in the top-right (Light / Streets / Satellite)

No other controls. No drawing tools, no measurement tools, no search box. Restraint is the design.

### 3.4 Detail Panel (right rail, 420px, slides in)

Hidden by default. Opens with a 240ms slide-in from the right when a finding is selected. The map width contracts smoothly to make room.

**Panel header** (sticky, 56px tall):
- Severity pill on the left (`CRITICAL`, full word, severity-colored background)
- Class chip next to it (`Insulator damage`)
- Close button (×) on the right

**Content order, top to bottom:**

1. **Hero clip** — the 15-second evidence clip. Native `<video>` element with default controls. Auto-plays muted on panel open; user can unmute via standard video controls. The clip is pre-extracted and served from `app/public/clips/{finding_id}.mp4` — no loading state, no spinner.

2. **Spatial-temporal mini-card** — a three-column grid in mono font, dense:
   ```
   02:14         38.6712°N         AGL 42 m
                 90.7156°W         Heading 287°
   ```
   The values come from the telemetry lookup at the finding's timestamp. They are static; the panel does not animate them. The presence of altitude and heading specifically is the production-compatibility tell — these are exactly the fields a real DJI SRT export carries.

3. **What we saw** — Pegasus's prose paragraph, rendered as body text. 2–4 sentences. This is the same text Pegasus generated as part of its structured output; surfacing the prose alongside the structured fields below mirrors the pattern judges have already seen in the TwelveLabs reference demos. Example:
   > A porcelain insulator string on the outer cross-arm of a 345 kV suspension tower shows a clearly missing disk in the middle of the string. Surrounding hardware appears intact. Tower is part of a standard lattice steel configuration with twin-bundle conductors.

4. **Severity reasoning** — short, rules-anchored explanation with a regulatory citation chip:
   > **Critical** — Per NERC reference, missing porcelain disk indicates loss of mechanical and dielectric integrity. Immediate inspection required.
   >
   > `FAC-003 §R2.1`

5. **Component details** — structured fields from Pegasus's parsed JSON, two-column compact layout:
   ```
   Component type      Insulator string (porcelain)
   Condition           Damaged
   Specific defects    Missing disk, mid-string
   Voltage class       345 kV
   ```
   When a field is null or not applicable, omit the row entirely. Don't render `Vegetation distance: —` for an insulator finding.

6. **Confidence breakdown** — three small horizontal progress bars stacked vertically:
   ```
   Marengo similarity   ████████████░░░  0.84
   Pegasus confidence   high
   Combined             ████████████░░░  high
   ```
   Hover the section reveals a tooltip explaining how the combined indicator is derived (per Section 10.3 of `01_MASTER.md`).

7. **Maintenance Context tab** — *hidden when empty*. Renders only when `maintenance_context !== null` in the finding's JSON record. If Workflow 03 ships, this tab shows the correlated maintenance history; if it doesn't, the tab is never rendered. Forward-compat substrate per the conversation that locked the design.

8. **Actions footer** — three buttons, sticky to the bottom of the panel:
   - **Generate work order** (primary, dark/black background) — triggers the PDF report download for this single finding
   - **Mark reviewed** (outlined) — flips the finding's `reviewed_at` timestamp; visual state on the corresponding finding card changes to a muted appearance
   - **Flag for re-inspection** (outlined) — adds a `needs_human_review` flag

Actions are ornamental for the demo — none have to persist state across sessions. They render plausible operator workflows, which is what judges score.

### 3.5 Timeline Strip (footer, 56px)

Below the map, full width. A horizontal "severity heatmap" of the run.

**Visual structure:** the video timeline rendered as a 56px-tall colored strip, with one column per second of footage. Each column's color is the severity of the most severe finding active at that second; columns with no findings are `surface.subtle`. A scrubber (8px-tall handle) sits above the strip and indicates the currently selected finding's timestamp.

**Interaction:**
- Click any point on the strip → the closest finding (within ±5 seconds) is selected; map pans, detail panel opens, evidence clip seeks to that timestamp
- Hover any point → tooltip shows the closest finding's title and timestamp
- The scrubber reflects the selected finding's timestamp — when the user clicks a finding card or pin, the scrubber jumps

**Why include this:**
- Compresses the entire 7-minute run into one glance
- Makes severity distribution visually obvious — a strip with three red columns reads very differently from one with twelve
- Looks like a Datadog or observability dashboard, which is the visual register we want judges in
- Neither reference demo has anything like this

**Why this is worth the build cost:** it's the second-highest-impact element after the detail panel itself. It's the visual that makes the dashboard feel scientific rather than consumer-facing. Per the conversation, this stays in scope.

---

## 4. Design System

### 4.1 Color tokens

| Token | Hex | Use |
|---|---|---|
| `severity.critical` | `#DC2626` | Critical pins, severity bars, severity pills |
| `severity.high` | `#EA580C` | High-tier elements |
| `severity.moderate` | `#D97706` | Moderate-tier elements |
| `severity.low` | `#475569` | Low-tier elements (deliberately desaturated) |
| `severity.intact` | `#16A34A` (muted) | Intact-asset toggle on, no-action chips |
| `surface.canvas` | `#FAFAFA` | Page background |
| `surface.panel` | `#FFFFFF` | Cards, panels, dropdowns |
| `surface.subtle` | `#F1F5F9` | Hover, mini-card backgrounds, empty timeline columns |
| `border.default` | `#E2E8F0` | All borders |
| `text.primary` | `#0F172A` | Headings, primary copy |
| `text.secondary` | `#475569` | Metadata, labels, secondary copy |
| `text.tertiary` | `#94A3B8` | Disabled states, hints, very-low-importance text |
| `accent.brand` | `#0369A1` | Inspection-path polyline, focus rings, selected-card outline |

No gradients. No box-shadow effects beyond the subtle hover-lift drop shadow. No glass / blur effects. The visual identity is technical, not consumer.

A note on the severity palette: critical → high → moderate goes red → orange-red → orange-yellow, which preserves color-warmth as a signal of urgency. Low is desaturated slate-gray rather than yellow-green so it reads as "fine, ignore" rather than competing for attention. This is intentional — five fully-saturated severity colors all fighting for the eye is the failure mode in most enterprise dashboards.

### 4.2 Typography

| Family | Use |
|---|---|
| **Inter** (variable weight) | All UI labels, body copy, headings, button text |
| **JetBrains Mono** | Timestamps, GPS coordinates, NERC citation IDs, voltage class, structured data values |

Sizes: 11px (mono small), 12px (label), 14px (body), 16px (emphasis), 20px (panel headings), 24px (header wordmark). Line-height: 1.4 for density (tighter than typical web body copy, which uses 1.6).

Mono usage is a deliberate signal: when a value comes from a precise data source (a timestamp, a coordinate, a regulatory ID), it appears in mono. This trains the user to read mono as "exact value from the system" rather than "label written by a human."

### 4.3 Spacing

8px base grid. Specific values that recur:
- 12px — gutter between cards in the findings list
- 16px — panel padding (interior margin of cards, the detail panel)
- 24px — gap between major sections within the detail panel
- 32px — gap between the three top-level zones (left rail / map / right panel)

### 4.4 Motion

Restrained throughout. Three motion primitives, no others:

| Element | Duration | Easing |
|---|---|---|
| Detail panel slide-in/out | 240 ms | `cubic-bezier(0.2, 0, 0, 1)` (decelerate) |
| Pin pulse (selected finding) | 1600 ms loop | linear opacity, ease-out scale |
| Hover lift on cards | 120 ms | ease-out |

No bouncy springs, no parallax effects, no decorative entrance animations on page load. Enterprise software, not a marketing site.

---

## 5. Interaction Model

### 5.1 Default page state

On initial page load:
- Detail panel is closed
- Map is fitted to the corridor with all pins visible
- Findings list is sorted by severity, "All" filter active
- Timeline strip shows the full run
- No finding is selected

The first thing a judge sees is the inventory + overview. No modal, no welcome screen, no onboarding tour. The dashboard is competent on first frame.

### 5.2 Finding selection — three entry points

A finding can be selected from three places, and all three trigger the same state change:

1. Clicking a finding card in the left rail
2. Clicking a pin on the map
3. Clicking a column on the timeline strip (selects the closest finding)

When a finding is selected:
- The corresponding pin starts pulsing on the map (and existing pulse on a previously-selected pin stops)
- The map pans to center the pin if it's outside the current viewport (with a 240ms ease-out animation); zoom level is preserved unless the pin is more than 1km from current center
- The detail panel slides in from the right (or, if already open, its content swaps with a 120ms cross-fade)
- The corresponding finding card in the left rail gets the selected outline and scrolls into view if it's outside the rail's visible area
- The timeline strip's scrubber jumps to the finding's timestamp

### 5.3 Filter and sort interactions

Severity filter chips are non-mutually-exclusive. Clicking "Critical" toggles only critical visibility; clicking "High" while "Critical" is active makes both visible. Clicking "All" resets to all-on. The map updates simultaneously — pins hide and reveal in sync with the list.

When a filter would hide the currently-selected finding, the detail panel stays open. The corresponding pin and card disappear from view, but the user can still see the evidence and metadata. Closing the detail panel and reopening another finding works normally.

Sort changes only reorder the left rail; map and detail panel are unaffected.

### 5.4 Empty and error states

These are unlikely in the canonical demo but worth specifying so the implementation doesn't crash:

- **Zero findings of any kind** (validation gone wrong): the findings list shows "No findings to display" with a faded note. The map shows the polyline only. The timeline strip is uniformly `surface.subtle`. Don't crash.
- **Zero findings after filtering**: the list shows "No findings match these filters — adjust filters above." The map hides all pins. The timeline strip dims uniformly.
- **Evidence clip fails to load**: the detail panel shows the spatial mini-card and Pegasus prose, but the video region shows "Evidence clip unavailable" with a small icon. All other content renders normally.

### 5.5 What does not happen

A few things the design deliberately omits:

- **No tooltips on every element.** Tooltips appear on the timeline strip and on confidence dots; nowhere else. Excessive hover-state explanations make a dashboard feel like training material.
- **No modal dialogs.** All interactions happen in-place. The detail panel is a sidebar, not a modal — it doesn't trap focus and doesn't grey out the rest of the UI.
- **No notifications, toasts, or status banners.** The dashboard's job is to display data, not to chat with the user.
- **No live API calls.** Per Decision D11 in `01_MASTER.md`, the dashboard reads pre-computed JSON. There is no loading state, no refresh button, no "last updated" timestamp. The dashboard is a static read of one canonical pipeline run.

---

## 6. Cut List

If implementation runs short on time, drop in this order. Each cut leaves the dashboard functional and demo-recordable, just less polished.

1. **Severity halos around critical pins** — small loss, trivial removal
2. **Hover tooltips on confidence dots** — the dots themselves still convey the information
3. **Map layer toggle** (Light/Streets/Satellite) — keep the default Light layer only
4. **Timeline strip** — drop entirely if needed; the findings list sorted by severity does the same job in a more clickable form. The conversation locked this in, but it's the largest single cut available if a critical bug eats time.
5. **The "Mark reviewed" and "Flag for re-inspection" action buttons** — keep "Generate work order" only; the others are ornamental
6. **Maintenance Context tab** — if Workflow 03 doesn't ship, this is already hidden, no work to remove

The irreducible minimum is: header + findings list (cards, no filters) + map (polyline + pins) + detail panel (clip + Pegasus prose + severity reasoning). Everything else is enhancement.

---

## 7. Open Questions

These need resolution before or during implementation. None block writing the proposal; all block specific build tasks.

| Question | Resolved by |
|---|---|
| Final brand wordmark — keep "GridSight" or change | Before recording the demo video (per `01_MASTER.md` §14) |
| Map base tile layer — confirm CartoDB Positron is acceptable | First map implementation task; switch to OSM default if Positron needs an API key we don't have |
| ~~PDF Report — server-side via `weasyprint` or client-side via `window.print()`~~ | **Resolved 2026-04-26: client-side `window.print()` with a print stylesheet.** No backend dependency, no install risk, no AWS surface. Server-side rejected for hackathon timing. |
| Class glyphs inside pins — use Lucide icons or custom SVGs | First pin implementation task; Lucide has reasonable insulator/leaf approximations |
| Severity halo for critical findings — confirm the 50m radius reads at typical zoom levels | First map implementation task; adjust to 100m if 50m is too small to see |

---

## 8. Reading Order for Implementers

When the team gets to dashboard implementation in Phase 4, read in this order:

1. **`01_MASTER.md` §6** (System Architecture) — the data flow that produces what this dashboard renders
2. **`01_MASTER.md` §10.3** (Combined confidence indicator) — the rule the confidence breakdown component renders
3. **This document, §3 (Component-by-component spec)** — the build target
4. **This document, §4 (Design system)** — the tokens to wire into Tailwind config
5. **This document, §5 (Interaction model)** — the state transitions to wire up
6. **This document, §6 (Cut list)** — read this *before* starting, not after running out of time

Total reading: ~25 minutes. Worth doing before opening the editor.

---

*End of proposal. Implementation begins after the backend pipeline produces canonical `findings.json` (per `02_BUILD_PLAN.md` Phase 4 entry conditions).*
