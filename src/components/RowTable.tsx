import { cx, ms, tone } from "../lib/format";
import type { Shown } from "../hooks/useWithGhosts";

const VISIBLE = 40; // more than fits; the block clips the rest

// Newest rows on top, like the Convex data view.
// Time column: items:add execution time from the dashboard logs (log stream webhook) once it
// arrives; until then, this tab's browser-measured time, tagged "browser".
export function RowTable({ rows, latency }: { rows: Shown[]; latency: Record<string, number> }) {
  const recent = rows.slice(-VISIBLE).reverse();
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-line">
      <table className="w-full table-fixed border-collapse font-mono text-xs">
        <thead className="bg-white/[0.03] text-left text-muted">
          <tr className="[&>th]:border-b [&>th]:border-line [&>th]:px-3 [&>th]:py-1.5 [&>th]:font-normal">
            <th>_id</th>
            <th>key</th>
            <th className="w-36 text-right" title="Server: items:add execution time from the Convex dashboard logs. Browser: time until the write showed up in this tab.">time</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((r) => {
            const t = r.serverMs ?? latency[r.key];
            const browser = r.serverMs === undefined && t !== undefined;
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
                    {t !== undefined && (
                      <span className="text-[10px] uppercase tracking-wide text-muted">{browser ? "browser" : "server"}</span>
                    )}
                    {t === undefined ? "—" : ms(t)}
                    <span className={cx("size-2 rounded-[2px]", r.ghost ? "bg-red-500" : tone(t))} />
                  </span>
                </td>
              </tr>
            );
          })}
          {recent.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center font-sans text-muted">
                No documents
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
