import { useBenches } from "../hooks/benchStore";
import { Chip, FilterIcon, PlusIcon, TrashIcon } from "./ui";

const PRESETS = [1, 10, 50, 100]; // writes: 100 per 15 min per user (convex/rateLimits.ts)

// N presets + Insert / Delete for every region. Shared by the Latency and Compare tabs.
export function RunControls({ n, setN, ready }: { n: number; setN: (n: number) => void; ready: boolean }) {
  const benches = Object.values(useBenches()).filter((b) => b !== undefined);
  // Locked while any region is mid-run, so repeat clicks can't pile up.
  const locked = !ready || benches.length === 0 || benches.some((b) => b.busy !== null);
  return (
    <>
      <div className="flex items-center gap-1" role="group" aria-label="Writes per region">
        {PRESETS.map((p) => (
          <Chip key={p} active={n === p} onClick={() => setN(p)} icon={n === p ? <FilterIcon /> : undefined}>
            <span className="font-mono">{n === p ? `N = ${p}` : p}</span>
          </Chip>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-line" />
      <Chip tone="primary" icon={<PlusIcon />} onClick={() => benches.forEach((b) => b.insert(n))} disabled={locked}>
        Insert {n}
      </Chip>
      <Chip tone="danger" icon={<TrashIcon />} onClick={() => benches.forEach((b) => b.del())} disabled={locked}>
        Delete all
      </Chip>
    </>
  );
}
