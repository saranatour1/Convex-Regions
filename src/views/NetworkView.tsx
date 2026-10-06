import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { REGIONS, type Region } from "../regions";
import { median, type Net } from "../lib/stats";
import { describe } from "../lib/errors";
import type { ExitLocation } from "../hooks/useExitLocation";
import { sessionToken } from "../session";
import { runNetTest } from "../lib/netTest";
import { NetworkBlock, type NetState } from "../components/NetworkBlock";
import { Chip, PulseIcon } from "../components/ui";

const IDLE: NetState = { status: "idle" };

// Logs go to the home region (US) so every test is auditable in one place.
const home = REGIONS[0].client;

export function NetworkView({ location, ready }: { location: ExitLocation | null; ready: boolean }) {
  const resetKey = location?.country;
  const [states, setStates] = useState<Record<string, NetState>>({});
  const [running, setRunning] = useState(false);

  // New exit country (VPN switched) → old numbers no longer apply.
  const [key, setKey] = useState(resetKey);
  if (resetKey !== key) {
    setKey(resetKey);
    if (key !== undefined && !running) setStates({});
  }

  const patch = (id: string, next: Partial<NetState>) =>
    setStates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? IDLE), ...next } }));

  const runOne = async (r: Region) => {
    patch(r.id, { status: "running", error: undefined, net: undefined });
    let id;
    try {
      // Rate-limited per user server-side; no log row, no test.
      id = await home.mutation(api.logs.netTestBegin, {
        sessionToken,
        region: r.id,
        country: location?.country,
        colo: location?.colo,
      });
    } catch (e) {
      patch(r.id, { status: "error", error: describe(e) });
      return;
    }
    try {
      const net = await runNetTest(r, (step, n) => patch(r.id, { step, net: n }));
      patch(r.id, { status: "done" });
      await home.mutation(api.logs.netTestFinish, { sessionToken, id, result: summarize(net) });
    } catch (e) {
      patch(r.id, { status: "error", error: describe(e) });
      await home
        .mutation(api.logs.netTestFinish, { sessionToken, id, result: { kind: "failed", error: describe(e) } })
        .catch(() => {});
    }
  };

  const run = async (targets: Region[]) => {
    setRunning(true);
    targets.forEach((r) => patch(r.id, { status: "queued" }));
    // ponytail: one region at a time so the 4 MB echoes don't share bandwidth and skew MB/s
    for (const r of targets) await runOne(r);
    setRunning(false);
  };

  const done = REGIONS.filter((r) => states[r.id]?.status === "done" && states[r.id]?.net?.wsSamples.length);
  const wsOf = (r: Region) => median(states[r.id].net!.wsSamples);
  const fastest = done.length > 1 ? done.reduce((a, b) => (wsOf(a) <= wsOf(b) ? a : b)).id : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-[13px] text-muted">
        <span className="mr-auto">5 WebSocket pings, 5 HTTP pings, then a 128 B and a 4 MB echo, one region at a time.</span>
        <Chip tone="primary" icon={<PulseIcon />} onClick={() => void run(REGIONS)} disabled={running || !ready}>
          {running ? "Testing…" : "Run all regions"}
        </Chip>
      </div>
      {/* 2×2 grid, all 4 regions in one view; capped and centered on large screens. */}
      <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2 md:grid-rows-2">
        {REGIONS.map((r) => (
          <NetworkBlock
            key={r.id}
            region={r}
            state={states[r.id] ?? IDLE}
            fastest={fastest === r.id}
            onRun={() => void run([r])}
            disabled={running || !ready}
          />
        ))}
      </main>
      <footer className="border-t border-line bg-panel px-4 py-2 text-xs text-muted">
        Full check including DNS and TCP: <code className="text-neutral-300">pnpm run nettest</code>
      </footer>
    </div>
  );
}

const summarize = (net: Required<Net>) => ({
  kind: "done" as const,
  wsMs: median(net.wsSamples),
  httpMs: median(net.httpSamples),
  echoSmallMs: net.echoSmall,
  echoBigMs: net.echoBig,
  mbps: net.mbps,
});
