# GridSight — Domain Knowledge

> **Status:** Draft, Saturday April 25, 2026.
> **Companion docs:** `01_MASTER.md` (project source of truth), `02_BUILD_PLAN.md` (execution playbook), `03_REPO_STRUCTURE.md` (where things live).

---

## How to use this document

This is the authoritative source for the regulatory and engineering content that grounds GridSight's anomaly detection. When the Master Doc says "severity tiers grounded in NERC FAC-003-4," this is the doc with the actual numbers. When the validation labels need to distinguish a critical vegetation encroachment from a moderate one, this is the doc with the rule.

The doc covers six things, in order:

1. **Asset terminology** — what the components of a lattice steel transmission tower are called and why we care.
2. **Voltage class assumption** — the default we use and how to revise it.
3. **Class A: Insulator damage** — failure modes, visual indicators, severity tiers.
4. **Class B: Vegetation encroachment** — NERC FAC-003-4, the actual MVCD table, severity tiers.
5. **Severity scoring rules** — the literal rules the pipeline applies in `pipeline/severity.py`.
6. **Sources** — citations for all of the above.

Numbers in this document are the authoritative ones. If the Master Doc and this doc ever disagree on a number, this doc wins and the Master Doc gets updated.

---

## 1. Asset Terminology

GridSight targets one type of asset: high-voltage transmission line infrastructure built on **lattice steel suspension towers**. This section is the vocabulary every other section uses.

### 1.1 Tower types — and why we target suspension

There are three structural classes of transmission tower a drone might fly past, distinguished by how they handle the conductor's mechanical load:

- **Suspension tower** (also called *tangent tower* or *Type A*) — used on straight stretches of line. Insulator strings hang vertically from the cross-arms, supporting the conductor's weight but not its longitudinal tension. Used for line deviations of 0–2°, suspension towers are the most common type along a transmission corridor and may compose 90% of the line on relatively flat terrain. **This is what we target.**
- **Tension tower** (also called *strain tower*, *angle tower*, or *Type B/C/D*) — used where the line changes direction or terminates. Insulators are mounted horizontally to resist longitudinal tension. Less common than suspension; conductor and insulator geometry are different.
- **Dead-end tower** — a special tension tower at the end of a line section. Resists full conductor tension. Not a target.

We target suspension towers because they are visually consistent (vertical insulator strings, predictable cross-arm geometry), dominant in YouTube inspection footage, and the easiest to ground in a clean severity rubric.

### 1.2 Lattice steel tower anatomy

A typical lattice steel suspension tower has five anatomical sections, top to bottom:

- **Peak** — the triangular lattice structure at the top of the tower, supporting the **shield wire** (or *ground wire* / *OPGW*) which intercepts lightning strikes and diverts them to ground.
- **Cage** — the upper section between the peak and the tower body. The cage holds the cross-arms.
- **Cross-arms** — horizontal members extending from the cage, supporting the energized conductors via insulator strings. The number of cross-arms depends on the circuit configuration: typically three cross-arms per circuit (one per phase), or six in a vertical/stacked configuration on a double-circuit tower.
- **Tower body** — the main vertical lattice section between the cage and the ground.
- **Tower legs and base** — four legs at the corners of a square base, anchored to concrete foundations.

Conductors hang below the cross-arms. Insulator strings — the chains of porcelain, glass, or polymer disks — connect each conductor to the end of its cross-arm.

### 1.3 Insulator types

The insulator string electrically isolates the energized conductor from the grounded steel tower while mechanically supporting it. Three material types dominate:

- **Porcelain disc insulators** (cap-and-pin design) — the classic chain of bell-shaped ceramic disks. Each disk has a metal cap on top and a pin on the bottom; the cap of one disk fits onto the pin of the next. Insulators are either glass or porcelain discs or composite insulators using silicone rubber or EPDM rubber material assembled in strings or long rods whose lengths depend on the line voltage and environmental conditions.
- **Glass disc insulators** — same cap-and-pin structure as porcelain, but made of toughened glass. Common in older installations, especially in Europe.
- **Polymer (composite) insulators** — a fiberglass core rod sheathed in silicone rubber or EPDM rubber, with weather sheds molded along the length. Modern, lighter, more contamination-resistant. Increasingly common since the 1990s.

A 230 kV single insulator string typically contains 12–18 porcelain disks. A 500 kV string contains 25+ disks. For polymer insulators, a single rod replaces the disk chain; the rod's length scales with voltage.

### 1.4 Conductors and bundling

A **conductor** is the energized wire carrying electricity. Each phase of a three-phase line is a separate conductor (or bundle).

In cases where line capacity exceeds the ability of a single wire to sufficiently carry the current, multiple conductors can be bundled together separated by short spacers. Bundling is common at 345 kV and above; visually, a bundle looks like 2, 3, or 4 parallel wires held apart by short metal spacers at intervals along the span.

GridSight does not target conductor damage directly — strands are typically too thin to assess from drone altitude — but conductor bundling is a useful visual cue for voltage class:

- 230 kV and below — usually single conductor per phase
- 345 kV — single or twin bundle
- 500 kV — usually triple bundle
- 765 kV — usually quad bundle

### 1.5 Right-of-way (ROW)

The **right-of-way** is the cleared corridor of land beneath and beside the transmission line, kept clear of tall vegetation. NERC's definition is engineering-based rather than purely legal: the standard's definition of right-of-way departs slightly from the strict legal definition in that it is based on engineering and construction considerations that establish the width of a corridor from a technical basis.

Typical ROW widths at our target voltage classes:

| Voltage class | Typical ROW width |
|---|---|
| 230 kV | ~100–150 ft |
| 345 kV | ~150–175 ft |
| 500 kV | ~175–200 ft |
| 765 kV | ~200 ft |

The ROW is the spatial context for vegetation encroachment scoring. Vegetation outside the ROW with no fall-in risk is not actionable; vegetation inside the ROW is at minimum a low-tier observation.

---

## 2. Voltage Class Assumption

GridSight defaults to **345 kV** for severity scoring (resolved 2026-04-26 per `01_MASTER.md` §14; the canonical demo corridor in southern Illinois is consistent with 345 kV EHV). Earlier drafts of this document defaulted to 230 kV before the corridor and footage were confirmed.

### Visual cues for voltage class identification

When reviewing footage, the data prep team uses these cues to confirm or revise the voltage class assumption:

- **Conductor bundling.** Single conductor per phase → likely 230 kV or below. Twin bundle → 345 kV. Triple bundle → 500 kV. Quad bundle → 765 kV.
- **Insulator string length.** A 230 kV porcelain string is roughly 6–8 ft long. A 500 kV string is 12–15 ft. A 765 kV string is 18+ ft.
- **Tower height.** 230 kV lattice towers are typically 80–130 ft tall. 345 kV towers are 100–150 ft. 500 kV towers are 130–200+ ft. 765 kV towers can exceed 200 ft.
- **Number of insulator disks (if visible).** Roughly: 230 kV ≈ 12–18 disks; 345 kV ≈ 18–24 disks; 500 kV ≈ 25–35 disks; 765 kV ≈ 35+ disks.

### Why default to 230 kV

230 kV transmission is the most common high-voltage class in publicly available drone footage, sits cleanly within FAC-003-4's applicability (the standard applies to all overhead transmission lines operated at 200 kV or higher), has a small MVCD that produces meaningful visual differences between severity tiers, and matches the visible characteristics of typical YouTube powerline inspection content. If footage clearly shows EHV (very tall towers, multiple bundled conductors, long insulator strings), the assumption is revised upward and the severity rules tighten accordingly.

---

## 3. Class A — Insulator Damage

Insulator failure is one of the most consequential failure modes on a transmission line. A failed insulator can drop a conductor or initiate a flashover, either of which can take the line out of service. The good news for our system: insulator damage is often visually obvious from drone altitude.

### 3.1 Failure modes and visual indicators

The following failure modes are documented in the EPRI Insulator Reference Book and in the IEEE literature on insulator inspection. We list the visible patterns Pegasus is asked to recognize, what causes them, and what severity tier each maps to.

#### 3.1.1 Porcelain shattering / chipping (cap-and-pin disks)

**Visual indicators:**
- Missing chunks of the bell-shaped porcelain disk
- Visible fracture lines or radial cracks
- Entire missing disk units in the chain (a "gap" in the string)
- Exposed metal pin where the porcelain has separated

**Cause.** Mechanical impact (hail, debris, vandalism), thermal stress, manufacturing defect, or end-of-life porcelain degradation. Once a disk shatters, the string's electrical and mechanical strength is compromised.

**Severity:** Critical. A shattered or missing disk is an immediate reliability concern; replacement is typically prioritized.

#### 3.1.2 Cap-and-pin corrosion

**Visual indicators:**
- Rust streaks running down from the metal hardware along the porcelain string
- Discolored (orange-brown) staining on the lower portion of disks
- Visible corrosion on the iron caps, particularly on lower disks of the string

**Cause.** Long-term moisture exposure, electrolytic corrosion (especially under DC stress), industrial pollution. Iron cap corrosion accelerates contamination accumulation and decreases the pollution flashover voltage; pin corrosion decreases mechanical strength of porcelain insulators.

**Severity:** High when severe (extensive rust streaks and visible corrosion on multiple disks); moderate when limited.

#### 3.1.3 Contamination buildup

**Visual indicators:**
- Dark uniform coating across the insulator surface (industrial/airborne pollution, ash)
- Bird streamers — large white streaks of bird droppings
- Salt deposits — whitish crusty buildup, common in coastal areas
- Cement, fly ash, or chemical plant deposits

**Cause.** Environmental exposure. Contamination is a leading cause of insulator flashover: a wet contaminated surface forms a conductive layer that allows current to track across what should be an insulating gap. Severity correlates with deposit density (Equivalent Salt Deposit Density, ESDD, in mg/cm² in the literature).

**Severity tiers:**
- **High:** heavy uniform coating, large bird streamers spanning multiple disks, visible salt crust, evidence the contamination has bridged disks
- **Moderate:** moderate localized deposits, partial coverage, some bird droppings
- **Low:** light dust or surface haze consistent with normal weathering

#### 3.1.4 Flashover burn marks

**Visual indicators:**
- Charred, blackened, or melted regions on the insulator surface or hardware
- Pitting or erosion around the cap edges
- Localized discoloration consistent with arc damage
- For polymer insulators: dark streaks following dry-band arcing patterns

**Cause.** A previous flashover event — an electrical arc that jumped across the insulator surface, typically due to contamination + moisture or a lightning-induced surge. The string survived but bears visible evidence.

**Severity:** Critical when burn marks are extensive or the disk is structurally compromised; high when burn marks are localized but clear.

#### 3.1.5 Polymer insulator aging

Polymer insulators have different failure modes than porcelain. The EPRI Insulator Reference Book identifies several specific aging patterns visible from drone altitude:

**Visual indicators:**
- **Erosion** — material loss on the rubber sheds, often appearing as missing chunks or worn-down sheds
- **Tracking** — dark conductive carbon paths along the surface, often following the rubber-to-fiberglass interface
- **Chalking** — surface becomes powdery and white, indicating UV degradation
- **Dry-band arcing damage** — localized burn streaks where contamination created intermittent dry bands during wet conditions
- **Sheath splitting** — visible cracks in the rubber sheath, exposing the fiberglass core

**Cause.** UV exposure, electrical stress, contamination cycles, mechanical loading. Polymer insulators have shorter service lives than porcelain in some environments, though they generally outperform porcelain in heavily polluted conditions.

**Severity:**
- Critical: visible sheath splitting exposing the fiberglass core; severe tracking
- High: significant erosion; moderate tracking; visible dry-band damage
- Moderate: chalking; localized minor erosion
- Low: surface discoloration without structural concern

### 3.2 What does NOT count as a Class A finding

These visual conditions are NOT insulator damage and should not be flagged:

- Normal weathering discoloration on porcelain (slight grey-tan shift from new white)
- Light surface dust or rain streaking
- Photographic artifacts (lens flare, motion blur, glare on shiny porcelain)
- Hardware on the tower that is not part of the insulator string itself (clamps, dampers, spacers — these are different components)
- Shadows or exposure issues that mimic damage but aren't real

The Pegasus prompt explicitly asks for `condition: intact` when the insulator is healthy, even if it shows normal weathering.

### 3.3 Class A severity rule summary

| Condition | Specific defect | Severity |
|---|---|---|
| Damaged | Shattered or missing porcelain disk | Critical |
| Damaged | Visible flashover burn marks (extensive) | Critical |
| Damaged | Polymer sheath splitting / fiberglass exposure | Critical |
| Damaged | Severe cap-and-pin corrosion (multi-disk) | High |
| Damaged | Localized flashover burn marks | High |
| Damaged | Polymer erosion (significant) or tracking | High |
| Contaminated | Heavy uniform pollution / salt crust / large bird streamers | High |
| Contaminated | Moderate localized deposits | Moderate |
| Damaged | Polymer chalking; minor cap corrosion | Moderate |
| Contaminated | Light surface haze | Low |
| Damaged | Polymer surface discoloration only | Low |
| Intact | (none) | No action |
| Unclear | (insufficient visual info) | Low + needs_human_review |

---

## 4. Class B — Vegetation Encroachment

This class is governed by **NERC Reliability Standard FAC-003-4**, "Transmission Vegetation Management." The standard's purpose, in the regulator's own words, is to maintain a reliable electric transmission system through a defense-in-depth strategy that prevents vegetation-related outages from cascading.

This is the cleanest regulatory anchor in the entire project. We do not invent severity numbers — we use the actual values from FAC-003-4 Table 2.

### 4.1 What FAC-003-4 requires

Each applicable Transmission Owner must manage vegetation to prevent encroachment into the **Minimum Vegetation Clearance Distance (MVCD)** of any line operated at 200 kV or higher (and certain lower-voltage lines designated as IROL or WECC Major Transfer Path elements).

Four categories of encroachment are violations under R1 and R2 (paraphrased from the standard):

1. **Real-time observation of vegetation within MVCD** — the most direct violation, found by inspection
2. **Fall-in from inside the ROW** that caused a sustained outage — a tree from within the cleared corridor fell and contacted the line
3. **Blowing together** of conductors and vegetation inside the ROW that caused an outage — wind pushed them into contact
4. **Grow-in** that caused an outage — vegetation grew into the MVCD over time

GridSight is most directly useful for category 1 (visual real-time observation) and proactively for category 4 (catching grow-ins before they cause outages).

### 4.2 The MVCD — what it is and how it's calculated

The MVCD is a calculated minimum distance derived from the Gallet equation, a method used in high-voltage transmission line design to compute flash-over distances. The values in FAC-003-4 Table 2 are based on empirical EPRI testing performed under FERC Order 777, completed in 2015, which adjusted the gap factor in the Gallet equation from 1.3 to 1.0 — a more conservative value that increased MVCDs across the AC voltage range.

MVCD varies by:

- **Voltage class** (higher voltage → larger MVCD)
- **Altitude above sea level** (higher altitude → larger MVCD due to thinner air)

The values are the minimum distances required to prevent flashover. Real vegetation management programs maintain substantially larger distances to account for conductor sway, tree growth, and seasonal variation.

### 4.3 FAC-003-4 Table 2 — MVCD values for AC systems (feet)

This is the authoritative reference table for our severity scoring. Reproduced here at our target voltage classes; full table including extreme altitudes and lower-voltage classes is in FAC-003-4 itself.

| Nominal Voltage | Max System Voltage | Sea level – 500 ft | 500 – 1,000 ft | 1,000 – 2,000 ft | 2,000 – 3,000 ft | 3,000 – 4,000 ft | 4,000 – 5,000 ft |
|---|---|---|---|---|---|---|---|
| **230 kV** | 242 kV | **4.0 ft** | 4.1 ft | 4.2 ft | 4.3 ft | 4.3 ft | 4.4 ft |
| **345 kV** | 362 kV | **4.3 ft** | 4.3 ft | 4.4 ft | 4.5 ft | 4.6 ft | 4.7 ft |
| **500 kV** | 550 kV | **7.0 ft** | 7.1 ft | 7.2 ft | 7.4 ft | 7.5 ft | 7.6 ft |
| **765 kV** | 800 kV | **11.6 ft** | 11.7 ft | 11.9 ft | 12.1 ft | 12.2 ft | 12.4 ft |

Higher-altitude rows (5,000+ ft) and lower-voltage classes (161 kV, 138 kV, 115 kV, 88 kV, 69 kV — applicable only if designated as IROL or WECC path elements) are in FAC-003-4 Table 2 directly. A footnote in the standard specifies that change in transient overvoltage factors is the driver in the decrease in MVCDs for voltages of 345 kV and above compared to the lower-voltage classes — which is why 345 kV's MVCD is only slightly higher than 230 kV's.

### 4.4 Default MVCD for GridSight

GridSight defaults to **345 kV at sea level – 500 ft altitude** (Decision D6 + §14 resolution), which gives:

> **MVCD = 4.3 ft**

This is the critical threshold. Vegetation closer than 4.3 ft to a 345 kV conductor at typical US lowland altitude is a NERC violation in real time.

If a future run targets a different voltage class, the threshold is revised per the table above. The `run_metadata.json` `voltage_class` field records the assumption used for each pipeline run.

### 4.5 Severity tiers — vegetation encroachment

We anchor the severity tiers to multiples of the MVCD. The thresholds below assume the default 345 kV / sea level case (MVCD = 4.3 ft). For other voltage/altitude combinations, multiply by the appropriate MVCD.

| Severity | Distance from conductor | Rationale |
|---|---|---|
| **Critical** | < 1.0 × MVCD (< 4.3 ft at 345 kV) | NERC violation in real time. Confirmed flashover risk. Immediate action required. |
| **High** | 1.0 – 2.5 × MVCD (4.3 – 10.75 ft) | Just outside MVCD; conductor sway under load could violate. Active management threshold. |
| **Moderate** | 2.5 – 6.25 × MVCD (10.75 – 26.9 ft) | Within typical ROW (~75–87 ft half-width at 345 kV); not immediately dangerous but worth tracking. |
| **Low / no_action** | > 6.25 × MVCD outside ROW | Outside ROW with no fall-in risk. Observed but not actionable. |

**Fall-in risk** is a separate consideration. A tree growing 30 ft from a conductor but tall enough to fall into it is a fall-in risk — a category 2 / 3 encroachment under FAC-003-4 if it falls. The pipeline does not currently estimate fall-in risk; this is noted as a limitation and a candidate for future work.

### 4.6 Practical estimation note

In our pipeline, Pegasus produces a `vegetation_distance_estimate_ft` value. This is a visual estimate from drone footage, not a measured distance. Real production deployment would pair the system with LiDAR or photogrammetry for accurate distance measurement; the demo's distance estimates are coarse (likely ±5 ft).

We disclose this in the severity scoring: any vegetation distance flagged as critical or high should be treated as a candidate for human inspection, not a confirmed NERC violation. The system's job is to surface candidates, not adjudicate compliance.

### 4.7 What does NOT count as a Class B finding

These visual conditions are NOT vegetation encroachment and should not be flagged:

- Low ground cover, grasses, or shrubs well below conductor height
- Vegetation outside the ROW that poses no fall-in risk (height of vegetation < distance to nearest conductor)
- Vegetation at the ground level under or near tower legs (a different concern, governed by tower foundation maintenance, not FAC-003)
- Crops, lawns, or maintained landscaping inside the ROW that is intentionally low
- Distant tree lines that appear close due to camera perspective (drone-altitude foreshortening)

### 4.8 Class B severity rule summary

| Condition | Specific scenario | Severity |
|---|---|---|
| Vegetation in contact with conductor | Visible touching or overhang | Critical |
| Vegetation within MVCD (< 4 ft at 230 kV) | NERC violation | Critical |
| Vegetation 1.0 – 2.5 × MVCD from conductor | Active management threshold | High |
| Vegetation 2.5 – 6.25 × MVCD; within ROW | Inside corridor, safe distance | Moderate |
| Vegetation outside ROW, no fall-in risk | Observed but not actionable | No action |
| Tall tree adjacent to ROW | Fall-in risk candidate | Moderate (flagged) |
| Unclear (foliage density obscures distance) | Visually ambiguous | Low + needs_human_review |

---

## 5. Severity Scoring Rules — Implementation Spec

This section is the literal spec for `pipeline/severity.py`. The function signature is:

```python
def score_finding(parsed: dict, marengo_score: float, voltage_class: str = "345kV") -> dict:
    """
    Maps a Pegasus-parsed finding to a severity decision.

    Returns:
      {
        "severity": "critical" | "high" | "moderate" | "low" | "no_action",
        "combined_confidence": "high" | "medium" | "low",
        "needs_human_review": bool,
        "class": "insulator_damage" | "vegetation_encroachment" | "other",
      }
    """
```

### 5.1 Class assignment

```
if parsed["component_type"] == "insulator_string":
    class = "insulator_damage"
elif parsed["component_type"] == "vegetation":
    class = "vegetation_encroachment"
else:
    class = "other"
```

### 5.2 Class A (insulator damage) severity

```
condition = parsed["condition"]
defects = parsed["specific_defects"]   # list of strings

# Intact short-circuits to no_action
if condition == "intact":
    severity = "no_action"

# Unclear short-circuits to low + needs_review
elif condition == "unclear":
    severity = "low"
    needs_human_review = True

# Damage + contamination follow the rule table
elif condition in ("damaged", "contaminated"):
    severity = _class_a_severity_from_defects(defects, condition)
```

Where `_class_a_severity_from_defects` implements the table from Section 3.3. Implementation pattern: keyword matching against the `defects` list.

```
CRITICAL_KEYWORDS = ["shattered", "missing disk", "sheath split", "fiberglass exposed",
                     "extensive burn", "severe burn"]
HIGH_KEYWORDS = ["severe corrosion", "rust streak", "burn mark", "polymer erosion",
                 "tracking", "heavy contamination", "salt crust", "large bird streamer"]
MODERATE_KEYWORDS = ["moderate corrosion", "partial damage", "polymer chalking",
                     "moderate contamination", "localized deposit"]
# Fall-through: low

def _class_a_severity_from_defects(defects, condition):
    blob = " ".join(d.lower() for d in defects)
    if any(k in blob for k in CRITICAL_KEYWORDS):
        return "critical"
    if any(k in blob for k in HIGH_KEYWORDS):
        return "high"
    if any(k in blob for k in MODERATE_KEYWORDS):
        return "moderate"
    return "low"
```

Keyword lists tunable during Phase 3 prompt iteration. The fallback is `"low"`, which is conservative — anything Pegasus flagged but didn't articulate clearly errs toward surfaceable.

### 5.3 Class B (vegetation encroachment) severity

```
distance_ft = parsed["vegetation_distance_estimate_ft"]
mvcd_ft = MVCD_TABLE[voltage_class]["sea_level_to_500_ft"]   # 4.3 for 345 kV (default)

if distance_ft is None:
    # Pegasus couldn't estimate; fall back to keyword analysis
    severity = _class_b_severity_from_defects(defects)
elif distance_ft < 1.0 * mvcd_ft:
    severity = "critical"
elif distance_ft < 2.5 * mvcd_ft:
    severity = "high"
elif distance_ft < 6.25 * mvcd_ft:
    severity = "moderate"
else:
    severity = "no_action"
```

The `MVCD_TABLE` dict in `pipeline/severity.py` encodes Section 4.3 of this document — voltage class × altitude band → MVCD in feet. The default lookup is sea-level / 230 kV; the function signature accepts a `voltage_class` parameter for runs where higher voltages are confirmed.

### 5.4 Combined confidence (per Master Doc Section 10.3)

```
m = marengo_score
p = parsed["pegasus_confidence"]   # "high" | "medium" | "low"

if m >= 0.7 and p == "high":
    combined_confidence = "high"
elif m < 0.5 or p == "low":
    combined_confidence = "low"
else:
    combined_confidence = "medium"
```

### 5.5 Needs human review flag

```
needs_human_review = (
    condition == "unclear"
    or (severity in ("critical", "high") and combined_confidence == "low")
    or (parsed["component_type"] == "other")
)
```

The flag triggers when (a) Pegasus expressed visual uncertainty, (b) we have a high-severity claim with weak underlying signals, or (c) the finding doesn't fit our two target classes cleanly.

---

## 6. Sources and Further Reading

The numbered references below are the authoritative sources for this document's content. URLs were live as of April 2026.

**Regulatory:**

- **NERC Reliability Standard FAC-003-4**, "Transmission Vegetation Management" — Adopted by NERC Board of Trustees February 11, 2016; FERC Letter Order approval April 26, 2016. Source for MVCD Table 2, the four encroachment categories, and the Gallet equation derivation. <https://www.nerc.com/pa/Stand/Reliability%20Standards/FAC-003-4.pdf>
- **FERC, Order No. 777** (March 21, 2013), 142 FERC ¶ 61,208 — directed NERC to undertake EPRI testing that produced the adjusted MVCD values in FAC-003-4. Background only; not directly cited.
- **FERC, "Transmission Line Vegetation Management"** — plain-language overview from the regulator. <https://www.ferc.gov/transmission-line-vegetation-management>

**Engineering references:**

- **EPRI Insulator Reference Book ("The Violet Book," 2021)** — comprehensive industry reference on insulator types, failure modes, contamination behavior, and inspection methodology. The most authoritative source on visual insulator inspection.
- **IEEE Standard 516** — Guide for Maintenance Methods on Energized Power Lines. Historical source for minimum air insulation distances; superseded for vegetation management by FAC-003-4.

**Tower and asset terminology:**

- Wikipedia, "Transmission tower" — general overview of tower types, conductor bundling, and component naming. Useful for cross-checking terminology. <https://en.wikipedia.org/wiki/Transmission_tower>
- "Design Requirements of Transmission Line Towers," EE Power technical articles — practical reference on suspension vs. tension towers and lattice steel construction. <https://eepower.com/technical-articles/design-requirements-of-transmission-line-towers/>
- AEP, "Transmission Facts" — reference for ROW widths and tower heights by voltage class. <https://web.ecs.baylor.edu/faculty/grady/_13_EE392J_2_Spring11_AEP_Transmission_Facts.pdf>

**Insulator failure mode literature (sample):**

- Hackam, R. "Outdoor HV composite polymeric insulators." IEEE Transactions on Dielectrics and Electrical Insulation 6 (1999): 557–585. — foundational reference on polymer insulator aging.
- Han, S., Hao, R. & Lee, J. "Inspection of insulators on high-voltage power transmission lines." IEEE Transactions on Power Delivery 24 (2009): 2319–2327.
- "Influence of Contamination Distribution in Characterizing the Flashover Phenomenon on Outdoor Insulator," Ain Shams Engineering Journal (2023). — recent contamination severity classification.

---

*End of document. Numbers here are the source of truth for severity scoring. If the pipeline ever produces severity values that disagree with these rules, the pipeline is wrong, not this doc.*
