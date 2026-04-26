# GridSight — Technical Documentation

> **Prepared for Hackathon Judges**  
> Track 02 (Energy Infrastructure Monitoring) · Workflow 02 (Transmission Lines)

GridSight transforms unstructured drone inspection footage and telemetry into georeferenced, work-order-ready datasets. This document outlines our TwelveLabs integration strategy, architectural approach, and the deliberate trade-offs we made for hackathon delivery.

---

## TwelveLabs Integration Strategy

GridSight utilizes two TwelveLabs foundation models via AWS Bedrock, playing distinct but complementary roles in our pipeline:

### 1. Marengo 3.0: The Temporal Locator
We use Marengo strictly for **semantic search and temporal localization**. 
* **How it works:** We upload the video asynchronously and run a configurable set of natural-language anomaly queries (e.g., *"shattered porcelain insulator"*, *"tree branches overhanging power lines"*).
* **Why Marengo:** Traditional Computer Vision (CV) requires frame-by-frame analysis and hundreds of bounding boxes. Marengo inherently understands video over time, allowing us to find the exact 12-second window where an anomaly occurs without training a custom object detection model.

### 2. Pegasus 1.2: The Structured Describer
We use Pegasus to analyze the 12-second clip extracts surfaced by Marengo, acting as a **condition describer, not a filter**. 
* **How it works:** We pass the clip to Pegasus with a rigid, few-shot prompt demanding JSON output. Pegasus evaluates the asset and returns a structured object indicating the `component_type`, `condition` (intact, damaged, contaminated, unclear), and `specific_defects`.
* **Handling formatting drift:** LLMs occasionally drift from strict JSON schemas. We handled this by implementing a robust fallback regex parser in the pipeline that extracts the JSON payload even if Pegasus wraps it in conversational prose.

---

## System Architecture

GridSight operates via a decoupled batch-processing architecture consisting of 7 discrete stages. 

1. **Ingest:** We load the video alongside a per-second telemetry CSV. To prove production viability, we wrote a real parser (`scripts/srt_to_csv.py`) capable of extracting this telemetry directly from standard DJI drone SRT export files.
2. **Index:** Video is indexed in Marengo via Bedrock.
3. **Detect:** We execute the anomaly queries and apply temporal deduplication (merging hits within 10 seconds of each other).
4. **Extract:** `ffmpeg` slices the source video into 15-second MP4 evidence clips based on Marengo's timestamps.
5. **Describe:** Pegasus parses each clip into a structured condition assessment. 
6. **Score & Locate:** A rules engine cross-references Pegasus's `specific_defects` against **NERC FAC-003** regulations to assign a severity tier (Critical, High, Moderate, Low). Simultaneously, the script performs a timestamp lookup against the telemetry file to attach GPS latitude, longitude, heading, and altitude.
7. **Export:** The pipeline emits standard CSV and GeoJSON datasets, alongside static JSON files serving the Next.js dashboard.

---

## Scoped-out Features & Architecture Trade-offs

We intentionally restricted scope to guarantee a reliable, judge-presentable delivery. 

### 1. No Live Backend API
**The Trade-off:** There is no Python web server, REST API, or GraphQL layer connecting the dashboard to the model backend. 
**The Rationale:** A live API would introduce fetch state management, deployment complexity, and the risk of server crashes during the demo. Instead, the Python pipeline writes directly to the Next.js `public/data/` directory. The dashboard acts purely as a static data viewer. This ensures zero latency, infinite scalability, and the ability for anyone to clone the repo and run the UI without AWS keys.

### 2. Asset-Centric vs. Anomaly-Only Filtering
**The Trade-off:** If Marengo flags a candidate moment but Pegasus determines the asset is perfectly healthy, *we keep the finding* and categorize its severity as `no_action`.
**The Rationale:** Hiding "healthy" findings would obscure the system's false-positive rate. By surfacing them, we operate transparently and lay the architectural groundwork for "full-inventory monitoring" (a stretch goal where utility operators want to see *every* asset, not just broken ones). The dashboard handles the noise by defaulting to a "needs action" filter.

### 3. Deliberately Coarse Spatial Estimates
**The Trade-off:** Pegasus produces a visual estimate of vegetation distance (`vegetation_distance_estimate_ft`).
**The Rationale:** We recognize the limitation of estimating 3D depth from 2D drone footage. While our severity scoring uses these estimates (anchored to NERC's Minimum Vegetation Clearance Distances), we disclose that these are coarse approximations (±5 ft) meant to *trigger* human inspection, not adjudicate regulatory compliance. Sub-meter accuracy would require LiDAR integration, which we explicitly scoped out.

### 4. 1080p Resolution Constraint
**The Trade-off:** We restricted ingestion to 1080p MP4s, ignoring 4K sources.
**The Rationale:** 4K video substantially inflates Bedrock upload times and `ffmpeg` clip extraction times without providing a meaningful semantic boost to Marengo/Pegasus. Processing times were kept below ~60 seconds per minute of video. 

### 5. Exclusion of Pipeline Inspection (Workflow 01)
**The Trade-off:** We committed 100% to high-voltage transmission lines, entirely ignoring the pipeline workflow option.
**The Rationale:** Combining two fundamentally different operational domains would have required two different regulatory severity rubrics. Staying narrow allowed us to bake actual NERC guidelines deeply into the code. 

---

## Conclusion

GridSight sacrifices real-time streaming and multi-domain scope in exchange for stability, regulatory accuracy, and transparency. By letting Marengo search time, Pegasus structure language, and a rigid rules-engine calculate severity, we built a pipeline that accurately mimics a real-world enterprise work-order system.
