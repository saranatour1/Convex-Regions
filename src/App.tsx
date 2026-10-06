import { Activity, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { REGIONS } from "./regions";
import { sessionToken } from "./session";
import { useSessions } from "./hooks/useSessions";
import { countryFlag, countryName, deviceTimeZone } from "./lib/format";
import { useExitLocation } from "./hooks/useExitLocation";
import { ChevronIcon, Chip, PinIcon, Tabs } from "./components/ui";
import { LatencyView } from "./views/LatencyView";
import { NetworkView } from "./views/NetworkView";

const TABS = [
  { id: "latency", label: "Latency" },
  { id: "network", label: "Network test" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function App() {
  const [tab, setTab] = useState<Tab>("latency");
  const { location, checking, detect } = useExitLocation();
  const session = useSessions();
  const ready = session.status === "ready";

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

      {/* Activity keeps the hidden tab's state (rows, results, test progress) instead of unmounting it. */}
      <Activity mode={tab === "latency" ? "visible" : "hidden"}>
        <LatencyView resetKey={location?.country} ready={ready} />
      </Activity>
      <Activity mode={tab === "network" ? "visible" : "hidden"}>
        <NetworkView location={location} ready={ready} />
      </Activity>
    </div>
  );
}
