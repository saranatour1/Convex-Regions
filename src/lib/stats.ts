export type Stats = { n: number; p50: number; p95: number; max: number; total: number };
export type Net = {
  wsSamples: number[];
  httpSamples: number[];
  echoSmall?: number;
  echoBig?: number;
  mbps?: number;
};
export type Results = { insert?: Stats; delete?: Stats };

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
