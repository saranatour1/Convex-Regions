import { useCallback, useState } from "react";
import { ConvexProvider } from "convex/react";
import { REGIONS } from "../regions";
import { TONES, cx } from "../lib/format";
import type { Results } from "../lib/stats";
import { commands } from "../hooks/useRegionBench";
import { RegionBlock } from "../components/RegionBlock";
import { Chip, FilterIcon, PlusIcon, TrashIcon } from "../components/ui";

const PRESETS = [1, 10, 50, 100]; // writes: 100 per 15 min per user (convex/rateLimits.ts)

export function LatencyView({ resetKey, ready }: { resetKey?: string; ready: boolean }) {
  const [n, setN] = useState(50);
  const [results, setResults] = useState<Record<string, Results | undefined>>({});

  // New exit country (VPN switched) → old numbers no longer apply.
  const [key, setKey] = useState(resetKey);
  if (resetKey !== key) {
    setKey(resetKey);
    if (key !== undefined) setResults({});
  }

  // Lock the toolbar while any region is mid-run, so repeat clicks can't pile up.
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const onBusyChange = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      if (prev.has(id) === busy) return prev;
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const locked = !ready || busyIds.size > 0;

  const onResult = useCallback(
    (id: string, patch: Results) => setResults((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    [],
  );

  // Fastest = lowest median write → seen, once at least 2 regions have run.
  const timed = REGIONS.filter((r) => results[r.id]?.insert);
  const fastest =
    timed.length > 1 ? timed.reduce((a, b) => (results[a.id]!.insert!.p50 <= results[b.id]!.insert!.p50 ? a : b)).id : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <span className="mr-auto text-[13px] text-muted">Insert N rows per region and time each one until it shows up here.</span>
        <div className="flex items-center gap-1" role="group" aria-label="Writes per region">
          {PRESETS.map((p) => (
            <Chip key={p} active={n === p} onClick={() => setN(p)} icon={n === p ? <FilterIcon /> : undefined}>
              <span className="font-mono">{n === p ? `N = ${p}` : p}</span>
            </Chip>
          ))}
        </div>
        <span className="mx-1 h-5 w-px bg-line" />
        <Chip tone="primary" icon={<PlusIcon />} onClick={() => commands.forEach((c) => c.insert(n))} disabled={locked}>
          Insert {n}
        </Chip>
        <Chip tone="danger" icon={<TrashIcon />} onClick={() => commands.forEach((c) => c.del())} disabled={locked}>
          Delete all
        </Chip>
      </div>

      {/* 2×2 grid, all 4 regions in one view; capped and centered on large screens. */}
      <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2 md:grid-rows-2">
        {REGIONS.map((r) => (
          <ConvexProvider key={r.id} client={r.client}>
            <RegionBlock
              region={r}
              results={results[r.id]}
              fastest={fastest === r.id}
              onResult={onResult}
              onBusyChange={onBusyChange}
            />
          </ConvexProvider>
        ))}
      </main>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-panel px-4 py-2 text-xs text-muted">
        {TONES.map((t) => (
          <span key={t.label} className="flex items-center gap-1.5 font-mono">
            <span className={cx("size-2.5 rounded-[2px]", t.className)} /> {t.label}
          </span>
        ))}
        <span className="ml-auto">N=1 shows the pure distance to a region; a bigger N adds queueing.</span>
      </footer>
    </div>
  );
}
