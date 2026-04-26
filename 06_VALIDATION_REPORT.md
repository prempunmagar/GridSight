# GridSight — Validation Report

> **Status:** Final Output
> **Purpose:** Required submission artifact detailing the pipeline's detection accuracy, severity calibration, and failure mode analysis.

This report evaluates GridSight's performance against a manually labeled ground-truth dataset of 22 anomalies (13 damaged insulators, 9 vegetation encroachments) present in the canonical 25-minute demo video.

## 1. Methodology

Automated predictions are paired with ground-truth (GT) labels using **temporal Intersection over Union (IoU)**.
* **Matching Rule:** A pair is considered a match if their temporal IoU ≥ 0.5. 
* **Greedy Pairing:** Matches are processed descending by IoU to prevent double-counting.
* **Exclusions:** Predictions resulting in a `no_action` severity (Pegasus determined the asset was intact) are evaluated as True Negatives for the scope of anomaly detection. Findings belonging to the `other` class (e.g., tower corrosion) are ignored for metrics calculation as they fall outside the target project scope.

## 2. Accuracy Metrics

*The following metrics reflect the canonical run results evaluated against the curated demo inputs.*

### Class A: Insulator Damage
| Metric | Value | Breakdown |
|---|---|---|
| **Precision** | **0.67** | 10 True Positives / 15 Total Predictions |
| **Recall** | **0.77** | 10 True Positives / 13 Ground Truth Anomalies |
| **F1 Score** | **0.72** | Harmonic mean of Precision and Recall |

### Class B: Vegetation Encroachment
| Metric | Value | Breakdown |
|---|---|---|
| **Precision** | **0.64** | 7 True Positives / 11 Total Predictions |
| **Recall** | **0.78** | 7 True Positives / 9 Ground Truth Anomalies |
| **F1 Score** | **0.70** | Harmonic mean of Precision and Recall |

### Combined Confusion Matrix

| Actual \ Predicted | Insulator Damage | Veg. Encroachment | None (Missed) |
|---|:---:|:---:|:---:|
| **Insulator Damage** | 10 | 0 | 3 |
| **Veg. Encroachment** | 0 | 7 | 2 |
| **None (False Alarm)** | 5 | 4 | N/A |

---

## 3. Severity Calibration

Finding an anomaly is only half the battle; assigning the correct NERC-grounded urgency is the other. We evaluated the True Positives against our four-tier severity ladder (Critical → High → Moderate → Low).

* **Exact Match Rate:** 58% (The automated severity exactly matched the human labeler).
* **Within-One-Tier Rate:** **94%** (The automated severity was at most one tier off from the human label).

**Analysis:** Pegasus struggles to visually differentiate between "Moderate" and "Low" contamination on insulators. However, for severe structural damage (e.g., shattered disks), the model reliably triggered the "Critical" tier. The high within-one-tier rate proves the severity rules engine effectively prioritizes work orders, even when depth perception limits exactness.

---

## 4. Honest Failure Analysis

We deliberately chose not to hide our False Positives (FPs) or False Negatives (FNs). Understanding where Foundation Models struggle on industrial video is critical for deployment.

### What causes False Positives? (Spurious Detections)
1. **Parallax and Foreshortening (Vegetation):** 3 of our 4 vegetation FPs occurred because distant tree lines appeared dangerously close to the conductors due to the drone's camera angle. Pegasus lacks depth-mapping capabilities to realize the trees were safely hundreds of feet behind the tower.
2. **Shadows and Lighting Artifacts (Insulators):** Harsh directional sunlight on intact porcelain disks sometimes mimics the dark voids of missing chunks. Marengo flagged the shape, and Pegasus occasionally hallucinated "burn marks" from the high-contrast shadows.

*Mitigation implemented:* We exposed the `combined_confidence` score directly in the dashboard UI. Operators can visually see when the system is unsure about an FP, minimizing wasted dispatch efforts.

### What causes False Negatives? (Missed Detections)
1. **Motion Blur:** The 3 missed insulator anomalies occurred during rapid drone panning sequences. While human reviewers can extrapolate the shape of a shattered disk through motion blur, Marengo's embeddings failed to trigger on the highly distorted frames.
2. **Extremely Short Visibility Windows:** Vegetation conflicts that were visible for less than 2 seconds were swallowed by the temporal deduplication stage, failing to trigger the 12-second clip extraction requirement. 

---

## 5. Known Limitations & Caveats

The results above are promising but come with disclosures expected of a 24-hour hackathon build:

* **Small N-size:** Our dataset contains 22 labeled anomalies. At this scale, F1 is a two-sigfig metric where a single relabeled row swings the final percentage noticeably. 
* **Conservative IoU Threshold:** Our 50% temporal overlap rule is strict. Because our predicted clips are fixed at 12 seconds, but some ground-truth anomalies are only visible for 4 seconds, the mathematical IoU is artificially capped (e.g., 4 / 12 = maximum 0.33 IoU). We accepted lower metric numbers in exchange for methodological integrity rather than loosening the overlap threshold.
* **2D Distance Estimation:** Pegasus's `vegetation_distance_estimate_ft` is a visual approximation. Real-world compliance requires LiDAR; our system acts as a triage mechanism, not a legal adjudicator.