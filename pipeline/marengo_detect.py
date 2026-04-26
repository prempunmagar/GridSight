"""Stage 3: embed text queries, score clips by cosine similarity, dedup candidate timestamps."""

import json
import time
from pathlib import Path

import numpy as np

from pipeline import bedrock_client, config

TOP_K_PER_QUERY = 8


def _embed_text_async(bedrock_runtime, s3_client, text: str, output_prefix: str) -> list[float]:
    """Embed a single text query via Marengo async; return a flat float vector."""
    output_uri = f"s3://{config.S3_BUCKET}/{output_prefix}/"
    response = bedrock_runtime.start_async_invoke(
        modelId=config.BEDROCK_MARENGO_MODEL_ID,
        modelInput={"inputType": "text", "text": {"inputText": text}},
        outputDataConfig={"s3OutputDataConfig": {"s3Uri": output_uri}},
    )
    arn = response["invocationArn"]
    while True:
        resp = bedrock_runtime.get_async_invoke(invocationArn=arn)
        status = resp["status"]
        if status == "Completed":
            result_uri = resp["outputDataConfig"]["s3OutputDataConfig"]["s3Uri"]
            break
        if status == "Failed":
            raise RuntimeError(f"text embed failed: {resp.get('failureMessage')}")
        time.sleep(5)

    rest = result_uri[len("s3://"):]
    bucket, _, prefix = rest.partition("/")
    listing = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)
    all_keys = [o["Key"] for o in listing.get("Contents", []) if o["Key"].endswith(".json")]
    json_keys = [k for k in all_keys if not k.endswith("/manifest.json")]
    if not json_keys:
        raise RuntimeError(f"no embedding output JSON at {result_uri} (only: {all_keys})")
    payload = json.loads(s3_client.get_object(Bucket=bucket, Key=json_keys[0])["Body"].read())
    items = payload.get("data") or payload.get("embeddings") or []
    if not items:
        raise RuntimeError(f"empty embedding payload from {json_keys[0]}: {payload}")
    vec = items[0].get("embedding") or items[0].get("float")
    return vec


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1e-9
    return float(np.dot(a, b) / denom)


def score_clips(query_vec: list[float], clip_embeddings: list[dict]) -> list[dict]:
    q = np.array(query_vec, dtype=np.float32)
    out = []
    for clip in clip_embeddings:
        emb = clip["embedding"]
        if emb is None:
            continue
        score = cosine_similarity(q, np.array(emb, dtype=np.float32))
        out.append({
            "start_sec": float(clip["start_sec"]),
            "end_sec": float(clip["end_sec"]),
            "score": score,
        })
    out.sort(key=lambda r: r["score"], reverse=True)
    return out


def detect(clip_embeddings: list[dict], queries: list[tuple[str, str]],
           top_k: int = TOP_K_PER_QUERY,
           cache_path: "Path | None" = None) -> list[dict]:
    """For each query, return top_k candidates as {timestamp, query, score, source}.

    Text embeddings are cached on disk by the SHA-1 of the query string.
    """
    sess = bedrock_client.session()
    bedrock_runtime = sess.client("bedrock-runtime")
    s3 = sess.client("s3")

    cache: dict[str, list[float]] = {}
    if cache_path and cache_path.exists():
        cache = json.loads(cache_path.read_text())

    candidates: list[dict] = []
    for source, query in queries:
        if query in cache:
            print(f"  embedding query (cached): {query!r}")
            vec = cache[query]
        else:
            print(f"  embedding query: {query!r}")
            vec = _embed_text_async(bedrock_runtime, s3, query,
                                    output_prefix=f"text-embeddings/{abs(hash(query)):x}")
            cache[query] = vec
            if cache_path:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(json.dumps(cache))
        ranked = score_clips(vec, clip_embeddings)[:top_k]
        for r in ranked:
            mid = (r["start_sec"] + r["end_sec"]) / 2.0
            candidates.append({
                "timestamp_seconds": mid,
                "query_string": query,
                "marengo_score": r["score"],
                "discovery_source": source,
                "start_sec": r["start_sec"],
                "end_sec": r["end_sec"],
            })
    return candidates


def deduplicate(candidates: list[dict],
                window_seconds: int = config.DEDUP_WINDOW_SECONDS) -> list[dict]:
    """Cluster candidates within `window_seconds` into single records, keep highest score, merge queries."""
    sorted_c = sorted(candidates, key=lambda c: c["timestamp_seconds"])
    clusters: list[list[dict]] = []
    for c in sorted_c:
        if clusters and abs(c["timestamp_seconds"] - clusters[-1][-1]["timestamp_seconds"]) <= window_seconds:
            clusters[-1].append(c)
        else:
            clusters.append([c])

    merged: list[dict] = []
    for cluster in clusters:
        best = max(cluster, key=lambda r: r["marengo_score"])
        queries = sorted({c["query_string"] for c in cluster})
        sources = {c["discovery_source"] for c in cluster}
        source = "anomaly_query" if "anomaly_query" in sources else "inventory_query"
        merged.append({
            "timestamp_seconds": best["timestamp_seconds"],
            "matched_queries": queries,
            "marengo_score": best["marengo_score"],
            "discovery_source": source,
            "start_sec": best["start_sec"],
            "end_sec": best["end_sec"],
        })
    return merged
