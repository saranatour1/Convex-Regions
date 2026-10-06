import { ConvexError, v } from "convex/values";
import { env, mutation } from "./_generated/server";
import { rateLimiter } from "./rateLimits";
import { requireSession } from "./sessions";

const REGIONS = new Set(["us", "eu", "au", "ca"]);
const short = (s: string | undefined, max = 8) => {
  if (s !== undefined && s.length > max) throw new ConvexError({ kind: "BadInput" as const });
  return s;
};

// Logged before the browser runs a test, so the rate limit gates the test itself.
export const netTestBegin = mutation({
  args: { sessionToken: v.string(), region: v.string(), country: v.optional(v.string()), colo: v.optional(v.string()) },
  returns: v.id("netTests"),
  handler: async (ctx, { sessionToken, region, country, colo }) => {
    const { user, session } = await requireSession(ctx, sessionToken);
    if (!REGIONS.has(region)) throw new ConvexError({ kind: "BadInput" as const });
    if (!env.PAUSE_RATE_LIMITS) await rateLimiter.limit(ctx, "netTests", { key: user._id, throws: true });
    return await ctx.db.insert("netTests", {
      userId: user._id,
      sessionId: session._id,
      region,
      country: short(country),
      colo: short(colo),
      status: "running",
    });
  },
});

export const netTestFinish = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("netTests"),
    result: v.union(
      v.object({
        kind: v.literal("done"),
        wsMs: v.number(),
        httpMs: v.number(),
        echoSmallMs: v.number(),
        echoBigMs: v.number(),
        mbps: v.number(),
      }),
      v.object({ kind: v.literal("failed"), error: v.string() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { sessionToken, id, result }) => {
    const { user } = await requireSession(ctx, sessionToken);
    const test = await ctx.db.get("netTests", id);
    if (!test || test.userId !== user._id || test.status !== "running") throw new ConvexError({ kind: "BadInput" as const });
    if (result.kind === "done") {
      const { kind: _, ...numbers } = result;
      await ctx.db.patch("netTests", id, { status: "done", ...numbers });
    } else {
      await ctx.db.patch("netTests", id, { status: "failed", error: result.error.slice(0, 500) });
    }
    return null;
  },
});

// Logs the user's exit location (follows VPN) only when it differs from their last entry.
export const locationChanged = mutation({
  args: { sessionToken: v.string(), country: v.string(), colo: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken, country, colo }) => {
    const { user, session } = await requireSession(ctx, sessionToken);
    short(country);
    short(colo);
    await rateLimiter.limit(ctx, "locationLogs", { key: user._id, throws: true });
    const last = await ctx.db
      .query("locationChanges")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (last && last.country === country && last.colo === colo) return null;
    await ctx.db.insert("locationChanges", {
      userId: user._id,
      sessionId: session._id,
      country,
      colo,
      previousCountry: last?.country,
      previousColo: last?.colo,
    });
    return null;
  },
});
