import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Internal: run from the CLI, e.g. `pnpm run block <handle>` (all regions).
// Returns false if this region has never seen that handle.
const setBlocked = (blocked: boolean) =>
  internalMutation({
    args: { handle: v.string(), reason: v.optional(v.string()) },
    returns: v.boolean(),
    handler: async (ctx, { handle, reason }) => {
      const user = await ctx.db.query("users").withIndex("by_handle", (q) => q.eq("handle", handle)).unique();
      if (!user) return false;
      await ctx.db.patch("users", user._id, { blocked, blockedReason: blocked ? reason : undefined });
      return true;
    },
  });

export const block = setBlocked(true);
export const unblock = setBlocked(false);
