import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { rateLimiter } from "./rateLimits";
import { requireSession } from "./sessions";

const vBulb = v.object({ on: v.boolean(), flipId: v.string(), flippedAt: v.number() });

// The shared switch for this region; everyone watching sees the same bulb.
export const get = query({
  args: {},
  returns: v.union(v.null(), vBulb),
  handler: async (ctx) => {
    const bulb = await ctx.db.query("bulb").first();
    return bulb && { on: bulb.on, flipId: bulb.flipId, flippedAt: bulb.flippedAt };
  },
});

// Sets (not toggles) the bulb, so one click lands all four regions on the same state.
// 10 clicks per visitor per hour; applies even with PAUSE_RATE_LIMITS (it's the experiment's rule).
export const set = mutation({
  args: { sessionToken: v.string(), on: v.boolean(), flipId: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken, on, flipId }) => {
    if (flipId.length > 64) throw new ConvexError({ kind: "BadInput" as const });
    const { user } = await requireSession(ctx, sessionToken);
    await rateLimiter.limit(ctx, "bulbClicks", { key: user._id, throws: true });
    const bulb = await ctx.db.query("bulb").first();
    const next = { on, flipId, flippedAt: Date.now() };
    if (bulb) await ctx.db.patch("bulb", bulb._id, next);
    else await ctx.db.insert("bulb", next);
    return null;
  },
});
