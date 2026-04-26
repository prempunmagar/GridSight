"""Write `app/public/data/run_status.json` so the dashboard can poll pipeline progress."""

import json
import os
from datetime import datetime, timezone

from pipeline import config

STATUS_PATH = config.APP_DATA_DIR / "run_status.json"
RUN_ID_ENV = "GRIDSIGHT_RUN_ID"


def write(state: str, stage: str = "", error: str = "",
          run_id: str = "", detail: str = "") -> None:
    """state: idle | running | done | error.

    `stage` is the canonical stage tag (ingest, marengo-index, ...).
    `detail` is a free-form human-readable progress string within the stage,
    e.g. "5/14 clips" during the Pegasus loop.
    """
    config.APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATUS_PATH.write_text(json.dumps({
        "state": state,
        "stage": stage,
        "detail": detail,
        "error": error,
        "run_id": run_id or os.environ.get(RUN_ID_ENV, ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, indent=2))
