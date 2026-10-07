export type Stats = { n: number; p50: number; p95: number; max: number; total: number };
export type Net = {
  wsSamples: number[];
  httpSamples: number[];
  echoSmall?: number;
  echoBig?: number;
  mbps?: number;
};
// insert: browser E2E (send → mutation resolve). insertServer: same-clock listRanAt − startedAt.
// insertNetwork: per insert, E2E − server span = time outside the server (there, queue, back).
export type Results = { insert?: Stats; insertServer?: Stats; insertNetwork?: Stats; delete?: Stats };

export const time = async (f: () => Promise<unknown>) => {
  const t = performance.now();
  await f();
  return performance.now() - t;
};

const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

export const median = (xs: number[]) => pct([...xs].sort((a, b) => a - b), 0.5);

export const stats = (lat: number[], total: number): Stats => {
  const s = [...lat].sort((a, b) => a - b);
  return { n: s.length, p50: pct(s, 0.5), p95: pct(s, 0.95), max: s[s.length - 1], total };
};

/** Primary ranking metric: server-span median when present, else browser E2E. */
export const primaryInsert = (r: Results | undefined): Stats | undefined => r?.insertServer ?? r?.insert;

/**
 * Fastest region = lowest median network time (E2E − server span). Server work is ~the same
 * everywhere, so what's left is mostly distance to this browser. Both are single-clock
 * durations, so no clock sync is needed. Every compared region uses the same metric:
 * network time if all of them have it, else browser E2E for all. Needs 2+ regions.
 */
export const fastestRegion = (results: Record<string, Results | undefined>): string | null => {
  const timed = Object.entries(results).filter(([, r]) => r?.insert);
  if (timed.length < 2) return null;
  const useNetwork = timed.every(([, r]) => r!.insertNetwork);
  const score = (r: Results) => (useNetwork ? r.insertNetwork! : r.insert!).p50;
  return timed.reduce((a, b) => (score(a[1]!) <= score(b[1]!) ? a : b))[0];
};
