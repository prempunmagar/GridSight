"""Write `app/public/data/run_status.json` so the dashboard can poll pipeline progress."""

import json
from datetime import datetime, timezone

from pipeline import config

STATUS_PATH = config.APP_DATA_DIR / "run_status.json"


def write(state: str, stage: str = "", error: str = "", run_id: str = "") -> None:
    """state: idle | running | done | error"""
    config.APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATUS_PATH.write_text(json.dumps({
        "state": state,
        "stage": stage,
        "error": error,
        "run_id": run_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, indent=2))
