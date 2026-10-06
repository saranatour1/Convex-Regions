export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : `${Math.round(x)} ms`);

// Tile color by how long the write took to show up. undefined = not timed by this tab.
export const TONES = [
  { max: 300, label: "< 300 ms", className: "bg-emerald-400" },
  { max: 600, label: "< 600 ms", className: "bg-lime-300" },
  { max: 1000, label: "< 1 s", className: "bg-amber-400" },
  { max: Infinity, label: "≥ 1 s", className: "bg-rose-500" },
];
export const tone = (latency?: number) =>
  latency === undefined ? "bg-neutral-700/60" : TONES.find((t) => latency < t.max)!.className;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code: string) => {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code; // e.g. Cloudflare's "XX" / "T1" for unknown / Tor
  }
};
export const countryFlag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐";
export const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
