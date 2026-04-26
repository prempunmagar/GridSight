import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function POST() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const statusPath = path.join(repoRoot, "app", "public", "data", "run_status.json");
  const payload = {
    state: "idle",
    stage: "",
    error: "",
    run_id: "",
    updated_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(statusPath, JSON.stringify(payload, null, 2));
  return NextResponse.json({ ok: true });
}
