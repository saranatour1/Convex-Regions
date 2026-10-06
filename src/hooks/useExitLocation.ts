import { useCallback, useEffect, useState } from "react";
import { REGIONS } from "../regions";

export type ExitLocation = { country: string; colo: string };

// Cloudflare (already in front of every Convex URL) reports where this browser's
// traffic exits. That follows a VPN; Intl's time zone does not (it's an OS setting).
const TRACE_URL = `${REGIONS[0]?.url}/cdn-cgi/trace`;

export function useExitLocation() {
  const [location, setLocation] = useState<ExitLocation | null>(null);
  const [checking, setChecking] = useState(false);

  const detect = useCallback(async () => {
    setChecking(true);
    try {
      const text = await (await fetch(TRACE_URL, { cache: "no-store" })).text();
      const fields = new Map(text.trim().split("\n").map((l) => l.split("=", 2) as [string, string]));
      const next = { country: fields.get("loc") ?? "XX", colo: fields.get("colo") ?? "?" };
      setLocation(next);
    } catch {
      setLocation(null);
    } finally {
      setChecking(false);
    }
  }, []);

  // Check on load, and whenever you come back from switching VPN country.
  useEffect(() => {
    const check = () => void detect();
    const initial = setTimeout(check, 0);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, [detect]);

  return { location, checking, detect };
}
