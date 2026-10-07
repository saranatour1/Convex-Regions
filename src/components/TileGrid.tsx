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
        const l = latency[t.key]; // this tab's stopwatch, like the table's "round trip" column
        return (
          <span
            key={t._id}
            title={l === undefined ? undefined : `${ms(l)} round trip`}
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
