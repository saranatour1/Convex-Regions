import { ConvexError } from "convex/values";

// Error kinds thrown by convex/sessions.ts, convex/logs.ts and the rate limiter.
export const errorKind = (e: unknown) =>
  e instanceof ConvexError ? (e.data as { kind?: string } | undefined)?.kind : undefined;

export const isRateLimited = (e: unknown): e is ConvexError<{ kind: "RateLimited"; retryAfter: number }> =>
  errorKind(e) === "RateLimited";

export const describe = (e: unknown) => {
  if (isRateLimited(e)) return `Slow down: rate limited. Retry in ${Math.ceil(e.data.retryAfter / 1000)}s.`;
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
