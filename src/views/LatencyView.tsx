import { REGIONS } from "../regions";
import { TONES, cx } from "../lib/format";
import type { Results } from "../lib/stats";
import { useBenches } from "../hooks/benchStore";
import { RegionBlock } from "../components/RegionBlock";
import { RunControls } from "../components/RunControls";
import type { Bench } from "../hooks/useRegionBench";

export function LatencyView({
  n,
  setN,
  ready,
  results,
}: {
  n: number;
  setN: (n: number) => void;
  ready: boolean;
  results: Record<string, Results | undefined>;
}) {
  const benches = useBenches();


  // Fastest = lowest median write → seen, once at least 2 regions have run.
  const timed = REGIONS.filter((r) => results[r.id]?.insert);
  const fastest =
    timed.length > 1 ? timed.reduce((a, b) => (results[a.id]!.insert!.p50 <= results[b.id]!.insert!.p50 ? a : b)).id : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <span className="mr-auto text-[13px] text-muted">Insert N rows per region and time each one until it shows up here.</span>
        <RunControls n={n} setN={setN} ready={ready} />
      </div>

      {/* 2×2 grid, all 4 regions in one view; capped and centered on large screens. */}
      <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2 md:grid-rows-2">
        {REGIONS.map((r) => (
          <RegionSlot key={r.id} bench={benches[r.id]}>
            {(bench) => <RegionBlock region={r} bench={bench} results={results[r.id]} fastest={fastest === r.id} />}
          </RegionSlot>
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

// Empty frame until the region's bench has published (first render).
function RegionSlot({ bench, children }: { bench?: Bench; children: (bench: Bench) => React.ReactNode }) {
  return bench ? children(bench) : <section className="min-h-72 rounded-lg border border-line bg-panel" />;
}
