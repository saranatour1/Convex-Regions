import { useSyncExternalStore } from "react";
import type { Bench } from "./useRegionBench";

// Live bench state per region, published by <BenchHost> (always mounted, outside the
// tabs) so the Latency blocks and the chart read the same runs, from any tab.
// Partial: a region is missing until its host has rendered once.
export type Benches = Readonly<Partial<Record<string, Bench>>>;
let snapshot: Benches = {};
const listeners = new Set<() => void>();

export const publishBench = (id: string, bench: Bench) => {
  snapshot = { ...snapshot, [id]: bench };
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useBenches = () => useSyncExternalStore(subscribe, () => snapshot);
