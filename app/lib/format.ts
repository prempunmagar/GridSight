export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`;
}

export function formatHeading(deg: number): string {
  return `${Math.round(deg)}°`;
}

export function findingTitle(specificDefects: string[], componentType: string, condition: string): string {
  if (condition === "intact") return `Intact ${componentType.replace("_", " ")}`;
  if (condition === "unclear") return `Unclear (${componentType.replace("_", " ")})`;
  if (specificDefects.length > 0) return specificDefects[0];
  return `${condition} ${componentType.replace("_", " ")}`;
}
