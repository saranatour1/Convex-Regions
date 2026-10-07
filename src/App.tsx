import { Activity, useCallback, useEffect, useState } from "react";
import { ConvexProvider } from "convex/react";
import { BenchHost } from "./components/BenchHost";
import { api } from "../convex/_generated/api";
import { REGIONS } from "./regions";
import { sessionToken } from "./session";
import { useSessions } from "./hooks/useSessions";
import { countryFlag, countryName, deviceTimeZone } from "./lib/format";
import { useExitLocation } from "./hooks/useExitLocation";
import { ChevronIcon, Chip, PinIcon, Tabs } from "./components/ui";
import { LatencyView } from "./views/LatencyView";
import { NetworkView } from "./views/NetworkView";
import { CompareView } from "./views/CompareView";
import { BulbView } from "./views/BulbView";
import type { Results } from "./lib/stats";

const TABS = [
  { id: "latency", label: "Latency" },
  { id: "network", label: "Network test" },
  { id: "compare", label: "Compare" },
  { id: "bulb", label: "Light bulb" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function App() {
  const [tab, setTab] = useState<Tab>("latency");
  const { location, checking, detect } = useExitLocation();
  const session = useSessions();
  const ready = session.status === "ready";

  // Shared by the Latency and Compare tabs.
  const [n, setN] = useState(50);
  const [latency, setLatency] = useState<Record<string, Results | undefined>>({});
  const onLatency = useCallback(
    (id: string, patch: Results) => setLatency((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    [],
  );

  // New exit country (VPN switched) → old numbers no longer apply.
  const [resultsCountry, setResultsCountry] = useState(location?.country);
  if (location?.country !== resultsCountry) {
    setResultsCountry(location?.country);
    if (resultsCountry !== undefined) setLatency({});
  }

  // Log exit-location changes per user (home region; the server skips repeats).
  const country = location?.country;
  const colo = location?.colo;
  useEffect(() => {
    if (!ready || !country || !colo) return;
    REGIONS[0]?.client.mutation(api.logs.locationChanged, { sessionToken, country, colo }).catch(() => {});
  }, [ready, country, colo]);

  return (
    <div className="flex min-h-screen flex-col md:h-screen">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        <nav className="mr-auto flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
          <img src="/convex.svg" alt="Convex" className="mr-0.5 size-4" />
          <span>demo-regions</span>
          <ChevronIcon />
          <span className="font-mono text-neutral-200">items</span>
          <span className="ml-2">
            <Chip
              icon={<PinIcon />}
              onClick={() => void detect()}
              title={`Where your traffic exits, per Cloudflare. Switch VPN country, then come back to this tab. Device time zone (doesn't follow VPN): ${deviceTimeZone}. Your handle: ${session.handle ?? "…"}`}
            >
              <span key={location?.country} className="animate-flash">
                {location
                  ? `${countryFlag(location.country)} ${countryName(location.country)} · ${location.colo} edge`
                  : checking
                    ? "Locating…"
                    : "Location unknown"}
              </span>
            </Chip>
          </span>
        </nav>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </header>
      {session.error && (
        <p className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-[13px] text-red-300">{session.error}</p>
      )}

      {/* Always mounted (outside the tabs) so a run keeps going whichever tab is open. */}
      {REGIONS.map((r) => (
        <ConvexProvider key={r.id} client={r.client}>
          <BenchHost region={r} onResult={onLatency} />
        </ConvexProvider>
      ))}

      {/* Activity keeps the hidden tab's state (rows, results, test progress) instead of unmounting it. */}
      <Activity mode={tab === "latency" ? "visible" : "hidden"}>
        <LatencyView n={n} setN={setN} ready={ready} results={latency} />
      </Activity>
      <Activity mode={tab === "network" ? "visible" : "hidden"}>
        <NetworkView location={location} ready={ready} />
      </Activity>
      <Activity mode={tab === "compare" ? "visible" : "hidden"}>
        <CompareView n={n} setN={setN} ready={ready} results={latency} />
      </Activity>
      <Activity mode={tab === "bulb" ? "visible" : "hidden"}>
        <BulbView ready={ready} />
      </Activity>
    </div>
  );
}
