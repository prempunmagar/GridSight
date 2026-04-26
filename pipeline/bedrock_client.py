"""Shared boto3 session + Bedrock runtime client. Loads creds from .env via config.py."""

import os

import boto3

from pipeline import config


def session() -> boto3.Session:
    return boto3.Session(
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
        region_name=config.AWS_REGION,
    )


def account_id(s: boto3.Session) -> str:
    return s.client("sts").get_caller_identity()["Account"]


def s3_uri(key: str) -> str:
    return f"s3://{config.S3_BUCKET}/{key}"
