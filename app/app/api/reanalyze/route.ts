import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function POST() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const statusPath = path.join(repoRoot, "app", "public", "data", "run_status.json");

  if (fs.existsSync(statusPath)) {
    try {
      const st = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
      if (st.state === "running") {
        return NextResponse.json(
          { error: "A pipeline run is already in progress.", status: st },
          { status: 409 },
        );
      }
    } catch {
      // ignore parse errors; treat as idle
    }
  }

  const isWin = process.platform === "win32";
  const venvPython = isWin
    ? path.join(repoRoot, ".venv", "Scripts", "python.exe")
    : path.join(repoRoot, ".venv", "bin", "python");
  const python = fs.existsSync(venvPython) ? venvPython : "python";

  // detached:true on Windows always allocates a new console window, overriding
  // windowsHide. Skipping detached and relying on unref() lets the python child
  // run independently while keeping the console hidden. The Next.js dev server
  // is long-lived for the demo's lifetime, which is all we need.
  const proc = spawn(python, ["-u", "-m", "pipeline.run_all"], {
    cwd: repoRoot,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, PYTHONPATH: repoRoot },
  });
  proc.unref();

  return NextResponse.json({ ok: true, pid: proc.pid });
}
