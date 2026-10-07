import { cx, ms, tone } from "../lib/format";
import type { Shown } from "../hooks/useWithGhosts";

const VISIBLE = 40; // more than fits; the block clips the rest

// Newest rows on top, like the Convex data view.
// round trip: this tab's stopwatch (send → row visible); "—" for rows this tab didn't time.
// server › logs: the Convex dashboard's numbers for the row, via pnpm run logs:sync.
export function RowTable({ rows, latency }: { rows: Shown[]; latency: Record<string, number> }) {
  const recent = rows.slice(-VISIBLE).reverse();
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-line">
      <table className="w-full table-fixed border-collapse font-mono text-xs">
        <thead className="bg-white/[0.03] text-left text-muted">
          <tr className="[&>th]:border-b [&>th]:border-line [&>th]:px-3 [&>th]:py-1.5 [&>th]:font-normal">
            <th>_id</th>
            <th>key</th>
            <th className="w-28 whitespace-nowrap text-right" title="Round trip, timed in this tab: from sending the insert until the row was visible here. Includes the trip to the region and back, and any wait behind earlier inserts.">
              round trip
            </th>
            <th
              className="w-32 text-right"
              title="From the Convex dashboard logs (pnpm run logs:sync): the items:list run that delivered this row. Text = its execution time, read fresh. Hover a cell for the items:add time and how many subscribers got it from cache."
            >
              <span className="block text-[9px] uppercase leading-none tracking-wide">server</span>
              logs
            </th>
          </tr>
        </thead>
        <tbody>
          {recent.map((r) => {
            const t = latency[r.key];
            return (
              <tr
                key={r._id}
                className={cx(
                  "border-b border-line/60 motion-reduce:animate-none [&>td]:truncate [&>td]:px-3 [&>td]:py-1",
                  r.ghost ? "animate-row-out text-red-300 line-through" : "animate-row-in text-neutral-300",
                )}
              >
                <td>{r._id}</td>
                <td className="text-muted">{r.key}</td>
                <td className="text-right tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    {t === undefined ? "—" : ms(t)}
                    <span className={cx("size-2 rounded-[2px]", r.ghost ? "bg-red-500" : tone(t))} />
                  </span>
                </td>
                <td
                  className="text-right tabular-nums"
                  title={
                    r.listMs === undefined
                      ? undefined
                      : `items:add ${r.serverMs === undefined ? "—" : ms(r.serverMs)} · items:list ${ms(r.listMs)} read fresh · ${r.listCached ?? 0} served from cache`
                  }
                >
                  {r.listMs === undefined ? (
                    "—"
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-muted">server</span>
                      {ms(r.listMs)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {recent.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center font-sans text-muted">
                No documents
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

