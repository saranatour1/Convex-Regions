import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

// Per-deployment state, so per-user limits apply in each region separately.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  writes: { kind: "fixed window", rate: 100, period: 15 * MINUTE, capacity: 100 }, // per user
  netTests: { kind: "token bucket", rate: 8, period: 5 * MINUTE, capacity: 8 }, // per user, ~2 full runs
  locationLogs: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 }, // per user
  sessionStarts: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 }, // per user key
  newUsers: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 }, // global
});
