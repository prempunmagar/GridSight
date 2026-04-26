"""Stage 5: send each clip to Pegasus 1.2 for structured JSON description."""

import json
import re
from pathlib import Path

from pipeline import bedrock_client, config

PROMPT = """You are a transmission-line inspector reviewing a 12-second drone clip.

Identify the most operationally significant subject. Choose ONE component_type.
Priority order when multiple are visible:
  1. visible vegetation that approaches conductors -> "vegetation"
  2. damaged or contaminated insulator strings -> "insulator_string"
  3. damaged conductors -> "conductor"
  4. otherwise the dominant component (tower / insulator_string / etc.)

Condition rules:
- "damaged" if you can see ANY of: cracks, fractures, missing disks, rust streaks,
  cap corrosion, polymer erosion, sheath splitting, burn marks, white deposits,
  bird streamers spanning disks, or any non-cosmetic surface defect.
- "contaminated" if visible pollution, salt crust, or dense bird droppings without
  structural damage.
- "intact" only if the component looks clean and structurally whole.
- "unclear" only if the clip is too far / blurred / occluded to assess.

Low-grade defects (light rust streaks, surface corrosion, mild discoloration,
copper-colored hardware staining) ARE damaged, not intact.

For vegetation, also estimate distance from the nearest conductor in feet
(rough drone-altitude visual estimate; null if no conductor visible).

Return ONLY valid JSON matching this schema, no other text:
{
  "component_type": "insulator_string" | "conductor" | "tower" | "vegetation" | "guy_wire" | "other",
  "condition": "intact" | "damaged" | "contaminated" | "unclear",
  "specific_defects": [string, ...],
  "vegetation_distance_estimate_ft": number | null,
  "confidence": "high" | "medium" | "low"
}

Example (cracked insulator):
{"component_type": "insulator_string", "condition": "damaged",
 "specific_defects": ["cracked porcelain disk", "visible burn mark"],
 "vegetation_distance_estimate_ft": null, "confidence": "high"}

Example (rusty hardware):
{"component_type": "insulator_string", "condition": "damaged",
 "specific_defects": ["rust streaks on cap-and-pin hardware"],
 "vegetation_distance_estimate_ft": null, "confidence": "medium"}

Example (vegetation near line):
{"component_type": "vegetation", "condition": "damaged",
 "specific_defects": ["tall trees within right-of-way at conductor height"],
 "vegetation_distance_estimate_ft": 12, "confidence": "medium"}

Example (intact):
{"component_type": "insulator_string", "condition": "intact",
 "specific_defects": [], "vegetation_distance_estimate_ft": null,
 "confidence": "high"}
"""

DEFAULT_PARSED = {
    "component_type": "other",
    "condition": "unclear",
    "specific_defects": [],
    "vegetation_distance_estimate_ft": None,
    "pegasus_confidence": "low",
}


def _extract_json(text: str) -> dict | None:
    """Best-effort: parse text as JSON, else extract first {...} block."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _normalize(parsed: dict) -> dict:
    """Fill defaults, coerce types, and rename ``confidence`` → ``pegasus_confidence``.

    Downstream code (severity scoring, exports, the dashboard schema) reads
    ``pegasus_confidence``; the model emits ``confidence``.
    """
    out: dict = {**DEFAULT_PARSED}
    for k, v in parsed.items():
        if v is None and k != "vegetation_distance_estimate_ft":
            continue
        if k == "confidence":
            out["pegasus_confidence"] = v
        else:
            out[k] = v
    if not isinstance(out.get("specific_defects"), list):
        out["specific_defects"] = []
    return out


def describe_clip(clip_s3_uri: str, account: str) -> tuple[dict, str]:
    """Call Pegasus on `clip_s3_uri`, return (normalized_parsed_dict, raw_message)."""
    sess = bedrock_client.session()
    bedrock_runtime = sess.client("bedrock-runtime")

    request_body = {
        "inputPrompt": PROMPT,
        "mediaSource": {"s3Location": {"uri": clip_s3_uri, "bucketOwner": account}},
        "temperature": 0,
    }
    response = bedrock_runtime.invoke_model(
        modelId=config.BEDROCK_PEGASUS_MODEL_ID,
        body=json.dumps(request_body),
        contentType="application/json",
        accept="application/json",
    )
    payload = json.loads(response["body"].read())
    raw = payload.get("message", "")
    parsed = _extract_json(raw) or {}
    normalized = _normalize(parsed)
    return normalized, raw


def upload_clip(s3_client, clip_path: Path, key: str) -> str:
    s3_client.upload_file(str(clip_path), config.S3_BUCKET, key)
    return bedrock_client.s3_uri(key)
