import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { REGIONS } from "../regions";
import { describe, errorKind } from "../lib/errors";
import { sessionToken, userKey } from "../session";

export type SessionStatus = "starting" | "ready" | "blocked" | "error";

// Every region keeps its own users/sessions tables, so register with all of them.
export function useSessions() {
  const [status, setStatus] = useState<SessionStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      REGIONS.map((r) => r.client.mutation(api.sessions.start, { userKey, sessionToken, userAgent: navigator.userAgent })),
    )
      .then(([first]) => {
        if (cancelled) return;
        setHandle(first?.handle ?? null);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus(errorKind(e) === "Blocked" ? "blocked" : "error");
        setError(describe(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, error, handle };
}
