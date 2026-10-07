import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

// Per-deployment state, so per-user limits apply in each region separately.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  writes: { kind: "fixed window", rate: 100, period: 15 * MINUTE, capacity: 100 }, // per user
  netTests: { kind: "token bucket", rate: 8, period: 5 * MINUTE, capacity: 8 }, // per user, ~2 full runs
  locationLogs: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 }, // per user
  sessionStarts: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 }, // per user key
  // Global (one bucket for everyone), so concurrent session starts could conflict on it; shards spread the writes.
  newUsers: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60, shards: 4 },
  bulbClicks: { kind: "fixed window", rate: 10, period: HOUR }, // per user: the light bulb switch
  // App-wide cap on every public mutation in this deployment (convex/sessions.ts). Not affected
  // by PAUSE_RATE_LIMITS: it's the safety net. Queries can't be limited (they can't write), but
  // they only re-run after writes, so this caps them too. Global bucket, hence shards.
  appCalls: { kind: "fixed window", rate: 5000, period: HOUR, shards: 10 },
});
