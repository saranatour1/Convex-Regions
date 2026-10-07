import { ConvexError } from "convex/values";

// Error kinds thrown by convex/sessions.ts, convex/logs.ts and the rate limiter.
export const errorKind = (e: unknown) =>
  e instanceof ConvexError ? (e.data as { kind?: string } | undefined)?.kind : undefined;

export const isRateLimited = (
  e: unknown,
): e is ConvexError<{ kind: "RateLimited"; name: string; retryAfter: number }> => errorKind(e) === "RateLimited";

const wait = (ms: number) => (ms >= 60_000 ? `${Math.ceil(ms / 60_000)} min` : `${Math.ceil(ms / 1000)}s`);

export const describe = (e: unknown) => {
  if (isRateLimited(e)) {
    const retry = wait(e.data.retryAfter);
    if (e.data.name === "appCalls") return `The demo hit its hourly limit (5,000 calls per region). Try again in ${retry}.`;
    if (e.data.name === "bulbClicks") return `That's your 10 clicks for this hour. Try again in ${retry}.`;
    return `Slow down: rate limited. Retry in ${retry}.`;
  }
  switch (errorKind(e)) {
    case "Blocked":
      return "This browser has been blocked from the demo.";
    case "SessionInvalid":
      return "Session not recognized. Reload the page.";
    case "BadInput":
      return "Request rejected.";
  }
  return e instanceof Error ? e.message : String(e);
};
