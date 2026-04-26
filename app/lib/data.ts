import type { Finding } from "@/types/findings";
import type { FlightPath } from "@/types/telemetry";
import type { RunMetadata } from "@/types/metadata";

export async function loadFindings(): Promise<Finding[]> {
  const res = await fetch("/data/findings.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to load findings.json: ${res.status}`);
  return res.json();
}

export async function loadFlightPath(): Promise<FlightPath> {
  const res = await fetch("/data/flight_path.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to load flight_path.json: ${res.status}`);
  return res.json();
}

export async function loadMetadata(): Promise<RunMetadata> {
  const res = await fetch("/data/run_metadata.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to load run_metadata.json: ${res.status}`);
  return res.json();
}
