import { useEffect } from "react";
import type { Region } from "../regions";
import { cx, ms } from "../lib/format";
import type { Results } from "../lib/stats";
import { commands, useRegionBench } from "../hooks/useRegionBench";
import { useWithGhosts } from "../hooks/useWithGhosts";
import { RowTable } from "./RowTable";
import { TileGrid } from "./TileGrid";

export function RegionBlock({
  region,
  results,
  fastest,
  onResult,
  onBusyChange,
}: {
  region: Region;
  results?: Results;
  fastest: boolean;
  onResult: (id: string, patch: Results) => void;
  onBusyChange: (id: string, busy: boolean) => void;
}) {
  const b = useRegionBench(region, onResult);
  const rows = useWithGhosts(b.items, b.loaded);

  const busy = b.busy !== null;
  useEffect(() => {
    onBusyChange(region.id, busy);
    return () => onBusyChange(region.id, false);
  }, [busy, region.id, onBusyChange]);

  useEffect(() => {
    commands.set(region.id, b);
    return () => void commands.delete(region.id);
  });

  const { insert: ins, delete: del } = results ?? {};
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
          <span className="inline-flex h-6 items-center rounded-md border border-dashed border-emerald-500/60 px-2 text-xs text-emerald-300">
            fastest
          </span>
        )}
        <span className="font-mono text-xs tabular-nums text-muted">
          {running ? `${b.progress!.done} / ${b.progress!.total}` : `${b.items.length} rows`}
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
            <p key={ins?.p50} className="font-mono text-3xl tabular-nums text-neutral-100 animate-flash">
              {ins ? ms(ins.p50) : "—"}
            </p>
            <p className="text-xs text-muted">median time until a write shows up · {region.city}</p>
          </div>
          <TileGrid rows={rows} latency={b.latency} />
        </div>
        <RowTable rows={rows} latency={b.latency} />
      </div>

      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 font-mono text-xs text-muted">
        <span>all visible <b className="font-normal text-neutral-200">{ins ? ms(ins.total) : "—"}</b></span>
        <span>all deleted <b className="font-normal text-neutral-200">{del ? ms(del.total) : "—"}</b></span>
        {b.error && <span className="text-red-400">{b.error}</span>}
      </footer>
    </section>
  );
}
