import { WINDOW, type Region } from "../regions";
import { cx, ms } from "../lib/format";
import { primaryInsert, type Results } from "../lib/stats";
import type { Bench } from "../hooks/useRegionBench";
import { useWithGhosts } from "../hooks/useWithGhosts";
import { RowTable } from "./RowTable";
import { TileGrid } from "./TileGrid";

export function RegionBlock({
  region,
  bench: b,
  results,
  fastest,
}: {
  region: Region;
  bench: Bench;
  results?: Results;
  fastest: boolean;
}) {
  const rows = useWithGhosts(b.items, b.loaded);

  const { insert: e2e, insertServer, insertNetwork, delete: del } = results ?? {};
  const primary = primaryInsert(results);
  const running = b.busy !== null && b.progress;

  return (
    <section
      className={cx(
        "flex min-h-72 flex-col overflow-hidden rounded-lg border bg-panel transition-colors duration-500",
        fastest ? "border-emerald-500/60" : "border-line",
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <span className="text-lg leading-none">{region.flag}</span>
        <h2 className="mr-auto text-sm font-medium text-neutral-100 sm:mr-0">{region.label}</h2>
        <span className="mr-auto hidden h-6 items-center whitespace-nowrap rounded-md border border-dashed border-line px-2 font-mono text-xs text-muted sm:inline-flex">
          {region.aws}
        </span>
        {fastest && (
          <span
            title="Lowest median time outside Convex: round trip minus time inside Convex. Mostly distance to this browser; includes queueing when N > 1."
            className="inline-flex h-6 items-center rounded-md border border-dashed border-emerald-500/60 px-2 text-xs text-emerald-300"
          >
            fastest
          </span>
        )}
        <span className="font-mono text-xs tabular-nums text-muted">
          {running ? `${b.progress!.done} / ${b.progress!.total}` : `${b.items.length}${b.items.length === WINDOW ? "+" : ""} rows`}
        </span>
      </header>

      <div className="h-px bg-line">
        <div
          className={cx("h-full transition-[width] duration-150", b.busy === "delete" ? "bg-red-400" : "bg-emerald-400")}
          style={{ width: running ? `${(b.progress!.done / b.progress!.total) * 100}%` : "0%" }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-h-0 flex-col gap-3">
          <div>
            <p key={primary?.p50} className="font-mono text-3xl tabular-nums text-neutral-100 animate-flash">
              {primary ? ms(primary.p50) : "—"}
            </p>
            <p className="text-xs text-muted">
              {insertServer
                ? `median time inside Convex (add start → list re-run) · ${region.city}`
                : `median round trip (send → visible) · ${region.city}`}
            </p>
            {insertServer && e2e && (
              <p className="mt-0.5 font-mono text-xs tabular-nums text-muted">
                round trip <b className="font-normal text-neutral-300">{ms(e2e.p50)}</b>
                {insertNetwork && (
                  <>
                    {" · "}outside Convex <b className="font-normal text-neutral-300">{ms(insertNetwork.p50)}</b>
                  </>
                )}
              </p>
            )}
          </div>
          <TileGrid rows={rows} latency={b.latency} />
        </div>
        <RowTable rows={rows} latency={b.latency} />
      </div>

      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 font-mono text-xs text-muted">
        <span>all visible <b className="font-normal text-neutral-200">{e2e ? ms(e2e.total) : "—"}</b></span>
        <span>all deleted <b className="font-normal text-neutral-200">{del ? ms(del.total) : "—"}</b></span>
        {b.error && <span className="text-red-400">{b.error}</span>}
      </footer>
    </section>
  );
}
