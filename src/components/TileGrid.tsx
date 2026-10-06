import { cx, ms, tone } from "../lib/format";
import type { Shown } from "../hooks/useWithGhosts";

// One square per row, newest first so fresh inserts stay visible; the oldest get clipped.
export function TileGrid({ rows, latency }: { rows: Shown[]; latency: Record<string, number> }) {
  if (rows.length === 0) {
    return <p className="py-2 text-[13px] text-muted">Empty. Hit Insert.</p>;
  }
  return (
    <div className="flex max-h-24 min-h-0 shrink-0 flex-wrap content-start gap-1 overflow-hidden">
      {[...rows].reverse().map((t) => {
        const l = t.serverMs ?? latency[t.key]; // dashboard execution time, else this tab's browser time
        return (
          <span
            key={t._id}
            title={l === undefined ? undefined : `${ms(l)} (${t.serverMs === undefined ? "browser" : "server"})`}
            className={cx(
              "size-3 rounded-[3px] motion-reduce:animate-none",
              t.ghost ? "bg-red-500 animate-vanish" : cx(tone(l), "animate-pop"),
            )}
          />
        );
      })}
    </div>
  );
}
