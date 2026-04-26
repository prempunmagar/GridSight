"""Stage 2: upload video to S3, start Marengo async indexing, poll for completion, fetch embeddings."""

import json
import time
from pathlib import Path

from pipeline import bedrock_client, config


def upload_video(s3_client, video_path: Path, key: str) -> str:
    s3_client.upload_file(str(video_path), config.S3_BUCKET, key)
    return bedrock_client.s3_uri(key)


def start_indexing(bedrock_runtime, video_s3_uri: str, output_prefix: str, account: str) -> str:
    output_uri = f"s3://{config.S3_BUCKET}/{output_prefix}/"
    response = bedrock_runtime.start_async_invoke(
        modelId=config.BEDROCK_MARENGO_MODEL_ID,
        modelInput={
            "inputType": "video",
            "video": {
                "mediaSource": {
                    "s3Location": {"uri": video_s3_uri, "bucketOwner": account}
                },
                "embeddingOption": ["visual"],
                "embeddingScope": ["clip", "asset"],
            },
        },
        outputDataConfig={"s3OutputDataConfig": {"s3Uri": output_uri}},
    )
    return response["invocationArn"]


def wait_for_indexing(bedrock_runtime, invocation_arn: str,
                      poll_interval: int = 15, timeout_seconds: int = 1800) -> str:
    start = time.time()
    while True:
        resp = bedrock_runtime.get_async_invoke(invocationArn=invocation_arn)
        status = resp["status"]
        elapsed = int(time.time() - start)
        print(f"  [marengo-index t={elapsed:4d}s] {status}")
        if status == "Completed":
            return resp["outputDataConfig"]["s3OutputDataConfig"]["s3Uri"]
        if status == "Failed":
            raise RuntimeError(f"Marengo indexing failed: {resp.get('failureMessage')}")
        if elapsed > timeout_seconds:
            raise TimeoutError(f"Marengo indexing exceeded {timeout_seconds}s")
        time.sleep(poll_interval)


def fetch_clip_embeddings(s3_client, output_s3_uri: str) -> list[dict]:
    """Download Marengo's output JSON and return clip-scope embedding records."""
    if not output_s3_uri.startswith("s3://"):
        raise ValueError(f"unexpected output URI: {output_s3_uri}")
    rest = output_s3_uri[len("s3://"):]
    bucket, _, prefix = rest.partition("/")

    listing = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)
    contents = listing.get("Contents", [])
    json_keys = [obj["Key"] for obj in contents if obj["Key"].endswith(".json")]
    if not json_keys:
        raise RuntimeError(f"no JSON output found at {output_s3_uri}: keys={[o['Key'] for o in contents]}")

    def _first_present(d: dict, keys: list[str]):
        for k in keys:
            if d.get(k) is not None:
                return d[k]
        return None

    embeddings: list[dict] = []
    for key in json_keys:
        body = s3_client.get_object(Bucket=bucket, Key=key)["Body"].read()
        payload = json.loads(body)
        items = payload.get("data") or payload.get("embeddings") or []
        for item in items:
            scope = _first_present(item, ["embeddingScope", "embedding_scope"])
            if scope == "clip":
                embeddings.append({
                    "start_sec": _first_present(item, ["startSec", "start_sec", "start_offset_sec"]),
                    "end_sec": _first_present(item, ["endSec", "end_sec", "end_offset_sec"]),
                    "embedding": _first_present(item, ["embedding", "float"]),
                })
    if not embeddings:
        raise RuntimeError(f"no clip-scope embeddings found in {json_keys}")
    return embeddings


def index_video(video_path: Path, s3_video_key: str, output_prefix: str) -> list[dict]:
    """End-to-end: upload, index, poll, return clip embeddings."""
    sess = bedrock_client.session()
    s3 = sess.client("s3")
    bedrock_runtime = sess.client("bedrock-runtime")
    account = bedrock_client.account_id(sess)

    print(f"  Uploading {video_path.name} to s3://{config.S3_BUCKET}/{s3_video_key}...")
    video_uri = upload_video(s3, video_path, s3_video_key)

    print("  Starting Marengo async indexing...")
    arn = start_indexing(bedrock_runtime, video_uri, output_prefix, account)
    print(f"  invocationArn: {arn}")

    output_uri = wait_for_indexing(bedrock_runtime, arn)
    print(f"  Output: {output_uri}")

    embeddings = fetch_clip_embeddings(s3, output_uri)
    print(f"  Loaded {len(embeddings)} clip-scope embeddings")
    return embeddings
