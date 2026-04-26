"""
GridSight - Phase 1 Bedrock smoke test.

Verifies end-to-end access to both TwelveLabs models on Amazon Bedrock by
exercising the two invocation patterns the pipeline depends on:

  1. Pegasus 1.2 - sync InvokeModel (used in Stage 5 for clip descriptions)
  2. Marengo Embed 3.0 - async StartAsyncInvoke (used in Stage 2 for indexing)

A synthetic 10-second test video is generated locally with ffmpeg, uploaded
to S3, and used as input for both calls. On success, prints:

    Decision Gate 1: GO. Phase 1 task 1 complete.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv


REQUIRED_ENV = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_REGION",
    "BEDROCK_MARENGO_MODEL_ID",
    "BEDROCK_PEGASUS_MODEL_ID",
    "S3_BUCKET",
]


def load_config():
    load_dotenv()
    missing = [k for k in REQUIRED_ENV if not os.getenv(k)]
    if missing:
        print(f"ERROR: missing or empty in .env: {missing}")
        sys.exit(1)
    return {k: os.getenv(k) for k in REQUIRED_ENV}


def build_session(cfg):
    return boto3.Session(
        aws_access_key_id=cfg["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=cfg["AWS_SECRET_ACCESS_KEY"],
        aws_session_token=cfg["AWS_SESSION_TOKEN"],
        region_name=cfg["AWS_REGION"],
    )


def ensure_test_video(path):
    if path.exists():
        print(f"  Using existing test video: {path} ({path.stat().st_size // 1024} KB)")
        return
    print(f"  Generating synthetic test video at {path}...")
    path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", "testsrc=duration=10:size=640x360:rate=30",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("ERROR: ffmpeg failed.")
        print(result.stderr[-500:])
        sys.exit(1)
    print(f"  Created: {path.stat().st_size // 1024} KB")


def upload_to_s3(s3_client, local_path, bucket, key):
    print(f"  Uploading to s3://{bucket}/{key}...")
    s3_client.upload_file(str(local_path), bucket, key)
    return f"s3://{bucket}/{key}"


def test_pegasus(bedrock_runtime, model_id, s3_uri, account_id):
    print()
    print("=" * 60)
    print("Test 1/2: Pegasus 1.2 (sync InvokeModel)")
    print("=" * 60)
    print(f"  modelId: {model_id}")
    request_body = {
        "inputPrompt": "Describe what you see in this video in one sentence.",
        "mediaSource": {
            "s3Location": {"uri": s3_uri, "bucketOwner": account_id}
        },
        "temperature": 0,
    }
    try:
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps(request_body),
            contentType="application/json",
            accept="application/json",
        )
        result = json.loads(response["body"].read())
        print(f"\n  Response: {result.get('message', result)}")
        print(f"  finishReason: {result.get('finishReason')}")
        print("\n  PASS")
        return True
    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg = e.response["Error"]["Message"]
        print(f"\n  FAIL: {code}")
        print(f"  {msg}")
        if code == "AccessDeniedException":
            print("  -> Bedrock console -> Model access -> request access for Pegasus 1.2")
        elif code == "ValidationException":
            print("  -> Check S3 bucket region matches AWS_REGION")
        elif code in ("ExpiredTokenException", "UnrecognizedClientException"):
            print("  -> Workshop Studio creds expired. Get fresh ones.")
        return False


def test_marengo(bedrock_runtime, model_id, s3_input_uri, s3_output_uri, account_id):
    print()
    print("=" * 60)
    print("Test 2/2: Marengo Embed 3.0 (async StartAsyncInvoke)")
    print("=" * 60)
    print(f"  modelId: {model_id}")
    model_input = {
        "inputType": "video",
        "video": {
            "mediaSource": {
                "s3Location": {"uri": s3_input_uri, "bucketOwner": account_id}
            },
            "embeddingOption": ["visual"],
            "embeddingScope": ["clip", "asset"],
        },
    }
    try:
        response = bedrock_runtime.start_async_invoke(
            modelId=model_id,
            modelInput=model_input,
            outputDataConfig={"s3OutputDataConfig": {"s3Uri": s3_output_uri}},
        )
        invocation_arn = response["invocationArn"]
        print(f"  Job started.")
        print(f"  invocationArn: {invocation_arn}")
        print("  Polling status...")
        for attempt in range(60):
            status_resp = bedrock_runtime.get_async_invoke(invocationArn=invocation_arn)
            status = status_resp["status"]
            print(f"    [{attempt + 1:2d}/60] {status}")
            if status == "Completed":
                output = status_resp["outputDataConfig"]["s3OutputDataConfig"]["s3Uri"]
                print(f"\n  Results written to: {output}")
                print("\n  PASS")
                return True
            if status == "Failed":
                fail_msg = status_resp.get("failureMessage", "(no failureMessage)")
                print(f"\n  FAIL: {fail_msg}")
                return False
            time.sleep(10)
        print("\n  TIMEOUT after 10 minutes.")
        return False
    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg = e.response["Error"]["Message"]
        print(f"\n  FAIL: {code}")
        print(f"  {msg}")
        if code == "AccessDeniedException":
            print("  -> Bedrock console -> Model access -> request access for Marengo Embed 3.0")
        elif code == "ValidationException":
            print("  -> Check S3 bucket region matches AWS_REGION")
        elif code in ("ExpiredTokenException", "UnrecognizedClientException"):
            print("  -> Workshop Studio creds expired. Get fresh ones.")
        return False


def main():
    print("GridSight Phase 1 Bedrock smoke test")
    print(f"Working directory: {Path.cwd()}\n")
    cfg = load_config()
    session = build_session(cfg)
    print("Configuration:")
    print(f"  region:          {cfg['AWS_REGION']}")
    print(f"  bucket:          {cfg['S3_BUCKET']}")
    print(f"  Marengo modelId: {cfg['BEDROCK_MARENGO_MODEL_ID']}")
    print(f"  Pegasus modelId: {cfg['BEDROCK_PEGASUS_MODEL_ID']}")
    try:
        sts = session.client("sts")
        identity = sts.get_caller_identity()
        account_id = identity["Account"]
        print(f"  account:         {account_id}")
        print(f"  caller arn:      {identity['Arn']}")
    except ClientError as e:
        print(f"\nERROR: STS call failed: {e}")
        sys.exit(1)
    print("\nStep 1: Prepare test video")
    test_video = Path("examples") / "test_video.mp4"
    ensure_test_video(test_video)
    print("\nStep 2: Upload to S3")
    s3 = session.client("s3")
    s3_key = "smoke-test/test_video.mp4"
    try:
        s3_input_uri = upload_to_s3(s3, test_video, cfg["S3_BUCKET"], s3_key)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        print(f"\n  FAIL: {code} - {e.response['Error']['Message']}")
        sys.exit(1)
    s3_output_uri = f"s3://{cfg['S3_BUCKET']}/smoke-test/marengo-output/"
    bedrock_runtime = session.client("bedrock-runtime")
    pegasus_ok = test_pegasus(bedrock_runtime, cfg["BEDROCK_PEGASUS_MODEL_ID"], s3_input_uri, account_id)
    marengo_ok = test_marengo(bedrock_runtime, cfg["BEDROCK_MARENGO_MODEL_ID"], s3_input_uri, s3_output_uri, account_id)
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Pegasus 1.2 (sync):        {'PASS' if pegasus_ok else 'FAIL'}")
    print(f"  Marengo Embed 3.0 (async): {'PASS' if marengo_ok else 'FAIL'}")
    print()
    if pegasus_ok and marengo_ok:
        print("Decision Gate 1: GO. Phase 1 task 1 complete.")
        sys.exit(0)
    else:
        print("Decision Gate 1: BLOCKED. Fix the failing test before Phase 2.")
        sys.exit(1)


if __name__ == "__main__":
    main()