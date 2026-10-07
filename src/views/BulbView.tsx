import { useEffect, useState } from "react";
import { ConvexProvider, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { REGIONS, type Region } from "../regions";
import { sessionToken } from "../session";
import { describe } from "../lib/errors";
import { cx, ms } from "../lib/format";

type BulbState = { on: boolean; flipId: string; flippedAt: number };
// One click: its target state, when it left this browser, and when each region's update landed.
type Flip = { id: string; on: boolean; t0: number; landed: Record<string, number>; failed: Record<string, string> };

const ORDINAL = ["1st", "2nd", "3rd", "4th"];
const MAX_RUNS = 5;

// One switch, four regions. A click writes the same state to every region at once; each bulb
// changes the moment its own region's update reaches this browser, so the order is real.
export function BulbView({ ready }: { ready: boolean }) {
  const [states, setStates] = useState<Record<string, BulbState | null>>({});
  const [flip, setFlip] = useState<Flip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<(Flip & { at: number })[]>([]); // this tab's finished clicks, newest first

  const pending = flip !== null && REGIONS.some((r) => flip.landed[r.id] === undefined && !flip.failed[r.id]);
  const now = useNow(pending);

  // Once every region has landed (or failed), keep the click as a run.
  const [recorded, setRecorded] = useState<string | null>(null);
  if (flip && !pending && recorded !== flip.id) {
    setRecorded(flip.id);
    setRuns((prev) => [{ ...flip, at: Date.now() }, ...prev].slice(0, MAX_RUNS));
  }

  // The switch shows your click's target while it's in flight, else the most recently flipped region.
  const latest = Object.values(states)
    .filter((s): s is BulbState => s !== null)
    .sort((a, b) => b.flippedAt - a.flippedAt)[0];
  const switchOn = pending ? flip.on : (latest?.on ?? false);

  const click = () => {
    const f: Flip = { id: crypto.randomUUID(), on: !switchOn, t0: performance.now(), landed: {}, failed: {} };
    setFlip(f);
    setError(null);
    const update = (fn: (p: Flip) => Flip) => setFlip((p) => (p?.id === f.id ? fn(p) : p));
    for (const r of REGIONS) {
      // Resolves in the same update that changes this region's bulb on screen.
      r.client.mutation(api.bulb.set, { sessionToken, on: f.on, flipId: f.id }).then(
        () => update((p) => ({ ...p, landed: { ...p.landed, [r.id]: performance.now() - f.t0 } })),
        (e: unknown) => {
          setError(describe(e));
          update((p) => ({ ...p, failed: { ...p.failed, [r.id]: describe(e) } }));
        },
      );
    }
  };

  const order = flip ? REGIONS.filter((r) => flip.landed[r.id] !== undefined).sort((a, b) => flip.landed[a.id] - flip.landed[b.id]) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-[13px] text-muted">
        <span className="mr-auto">One switch, four regions. Each bulb changes when its region's update reaches you.</span>
        <span className="font-mono text-xs">10 clicks per hour</span>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-6 p-4">
        <LightSwitch on={switchOn} onClick={click} disabled={!ready || pending} />
        {error && <p className="text-[13px] text-red-400">{error}</p>}

        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
          {REGIONS.map((r) => (
            <ConvexProvider key={r.id} client={r.client}>
              <RegionBulb
                region={r}
                onState={(s) => setStates((prev) => (prev[r.id] === s ? prev : { ...prev, [r.id]: s }))}
                waiting={flip !== null && flip.landed[r.id] === undefined && !flip.failed[r.id]}
                elapsed={flip ? (flip.landed[r.id] ?? (flip.failed[r.id] ? undefined : now - flip.t0)) : undefined}
                rank={order.indexOf(r)}
                failed={flip?.failed[r.id]}
              />
            </ConvexProvider>
          ))}
        </div>

        <RunsTable runs={runs} />

        <p className="max-w-xl text-center text-xs text-muted">
          Times are round trips: from your click, to that region, and back to this browser. Other visitors' clicks flip
          your bulbs too, in the order their updates arrive.
        </p>
      </main>
    </div>
  );
}

// Your latest clicks: each region's round trip, fastest highlighted.
function RunsTable({ runs }: { runs: (Flip & { at: number })[] }) {
  return (
    <div className="w-full max-w-md overflow-x-auto rounded-md border border-line">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead className="bg-white/[0.03] text-left text-muted">
          <tr className="[&>th]:border-b [&>th]:border-line [&>th]:px-2 [&>th]:py-1 [&>th]:font-normal">
            <th>time</th>
            <th>switch</th>
            {REGIONS.map((r) => (
              <th key={r.id} className="text-right" title={r.label}>
                {r.flag}
              </th>
            ))}
            <th className="text-right">fastest</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const fastest = REGIONS.filter((r) => run.landed[r.id] !== undefined).sort(
              (a, b) => run.landed[a.id] - run.landed[b.id],
            )[0];
            return (
              <tr key={run.id} className="border-b border-line/60 text-neutral-300 last:border-0 [&>td]:px-2 [&>td]:py-0.5">
                <td className="text-muted">{new Date(run.at).toLocaleTimeString()}</td>
                <td>{run.on ? "on" : "off"}</td>
                {REGIONS.map((r) => (
                  <td key={r.id} className={cx("text-right tabular-nums", fastest === r && "text-emerald-300")}>
                    {run.failed[r.id] ? <span className="text-red-400">failed</span> : ms(run.landed[r.id])}
                  </td>
                ))}
                <td className="text-right" title={fastest?.label}>{fastest ? fastest.flag : "—"}</td>
              </tr>
            );
          })}
          {runs.length === 0 && (
            <tr>
              <td colSpan={REGIONS.length + 3} className="px-2 py-2 text-center font-sans text-muted">
                No runs yet. Flip the switch.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RegionBulb({
  region,
  onState,
  waiting,
  elapsed,
  rank,
  failed,
}: {
  region: Region;
  onState: (s: BulbState | null) => void;
  waiting: boolean;
  elapsed?: number;
  rank: number;
  failed?: string;
}) {
  const state = useQuery(api.bulb.get);
  useEffect(() => {
    if (state !== undefined) onState(state);
  }, [state, onState]);
  const on = state?.on ?? false;

  return (
    <section
      className={cx(
        "flex flex-col items-center gap-2 rounded-lg border bg-panel px-3 pb-4 transition-colors duration-500",
        rank === 0 ? "border-emerald-500/60" : "border-line",
      )}
    >
      {/* The wire from the switch; a pulse runs down it while this region's update is on its way. */}
      <div className="relative h-10 w-px overflow-hidden bg-line">
        {waiting && <span className="absolute inset-x-[-1.5px] top-0 h-2.5 rounded-full bg-sky-300 animate-signal" />}
      </div>
      <Bulb on={on} />
      <p className="flex items-center gap-1.5 text-sm text-neutral-100">
        <span className="text-base leading-none">{region.flag}</span>
        {region.label}
      </p>
      <p className="text-xs text-muted">{region.city}</p>
      <p className={cx("font-mono text-lg tabular-nums", waiting ? "text-muted" : "text-neutral-100")}>
        {failed ? "—" : elapsed === undefined ? "—" : ms(elapsed)}
      </p>
      <p className="h-4 text-xs">
        {failed ? (
          <span className="text-red-400">failed</span>
        ) : rank >= 0 ? (
          <span className={rank === 0 ? "text-emerald-300" : "text-muted"}>{ORDINAL[rank]}</span>
        ) : null}
      </p>
    </section>
  );
}

// Incandescent bulb: the glow and filament replay their heat-up / cool-down on each change.
function Bulb({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 100 130" className="h-32 w-auto" role="img" aria-label={on ? "Bulb on" : "Bulb off"}>
      <defs>
        <radialGradient id="bulb-glow">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g key={String(on)}>
        <circle cx="50" cy="50" r="50" fill="url(#bulb-glow)" className={on ? "animate-glow-on" : "animate-glow-off"} />
        <path
          d="M50 14a32 32 0 0 1 19 57.7c-3.6 3-5 6.6-5 11.3H36c0-4.7-1.4-8.3-5-11.3A32 32 0 0 1 50 14z"
          className={cx("transition-[fill] duration-300", on ? "fill-amber-100/25" : "fill-white/5")}
          stroke="#71717a"
          strokeWidth="1.5"
        />
        <path
          d="M43 83V64l3.5-7 3.5 7 3.5-7 3.5 7v19"
          fill="none"
          strokeWidth="2"
          strokeLinejoin="round"
          className={on ? "animate-filament-on" : "animate-filament-off"}
        />
      </g>
      <rect x="35" y="85" width="30" height="20" rx="3" fill="#52525b" />
      <path d="M35 91h30M35 97h30" stroke="#3f3f46" strokeWidth="2" />
      <path d="M44 105h12l-3 6h-6z" fill="#3f3f46" />
    </svg>
  );
}

function LightSwitch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label="Light switch"
      onClick={onClick}
      disabled={disabled}
      className="group flex h-28 w-20 items-center justify-center rounded-xl border border-line bg-neutral-800 shadow-inner disabled:cursor-wait"
    >
      <span className="relative h-16 w-9 rounded-md border border-line bg-neutral-900">
        <span
          className={cx(
            "absolute inset-x-1 h-7 rounded-sm transition-all duration-100",
            on ? "top-1 bg-neutral-100" : "top-7 bg-neutral-500",
            "group-enabled:group-hover:brightness-110",
          )}
        />
      </span>
    </button>
  );
}

// Re-renders every animation frame while `active`, so the waiting bulbs' counters run live.
function useNow(active: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    let id = requestAnimationFrame(function tick() {
      setNow(performance.now());
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [active]);
  return now;
}
