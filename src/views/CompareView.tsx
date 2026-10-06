import { REGIONS } from "../regions";
import { cx, ms } from "../lib/format";
import { primaryInsert, type Results } from "../lib/stats";
import { useBenches } from "../hooks/benchStore";
import { LatencyChart } from "../components/LatencyChart";
import { RunControls } from "../components/RunControls";

// One chart: every region's latest insert run, drawn live while it runs.
export function CompareView({
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
  const timed = REGIONS.filter((r) => primaryInsert(results[r.id]));
  const fastest =
    timed.length > 1
      ? timed.reduce((a, b) => (primaryInsert(results[a.id])!.p50 <= primaryInsert(results[b.id])!.p50 ? a : b)).id
      : null;
  const empty = REGIONS.every((r) => !benches[r.id]?.series.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <span className="mr-auto text-[13px] text-muted">Each write's time until it shows up here, by region, in arrival order.</span>
        <RunControls n={n} setN={setN} ready={ready} />
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 p-3">
        {/* Legend with live numbers; color follows the region, never its rank. */}
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {REGIONS.map((r) => {
            const b = benches[r.id];
            const primary = primaryInsert(results[r.id]);
            const e2e = results[r.id]?.insert;
            const running = b?.busy === "insert" && b.progress;
            return (
              <li
                key={r.id}
                className={cx(
                  "flex flex-col gap-1 rounded-lg border bg-panel px-3 py-2 transition-colors duration-500",
                  fastest === r.id ? "border-emerald-500/60" : "border-line",
                )}
              >
                <span className="flex items-center gap-2 text-[13px] text-neutral-200">
                  <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                  {r.flag} {r.label}
                  {fastest === r.id && <span className="ml-auto text-xs text-emerald-300">fastest</span>}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {running ? (
                    `${b.progress!.done} / ${b.progress!.total} seen…`
                  ) : primary ? (
                    <>
                      median <b className="font-normal text-neutral-100">{ms(primary.p50)}</b>
                      {e2e && results[r.id]?.insertServer ? (
                        <> · browser {ms(e2e.p50)}</>
                      ) : (
                        <> · all {ms(e2e?.total ?? primary.total)}</>
                      )}
                    </>
                  ) : (
                    "no run yet"
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <section className="relative flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-panel p-4">
          <header className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium text-neutral-100">Time until each write shows up</h2>
            <span className="text-xs text-muted">x: write # (arrival order) · y: ms</span>
          </header>
          <div className="relative min-h-64 flex-1">
            <LatencyChart benches={benches} />
          </div>
          {empty && (
            <p className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-muted">
              Pick N and hit Insert to draw the lines live.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
