import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Pairs "which row" (console line) with "how long" (execution event) by request id,
// then writes the dashboard's execution time onto the row.
// ponytail: a half whose partner was dropped by the best-effort stream stays parked; clear the table if it grows.
export const ingest = internalMutation({
  args: {
    halves: v.array(v.object({ requestId: v.string(), itemId: v.optional(v.string()), ms: v.optional(v.number()) })),
  },
  returns: v.null(),
  handler: async (ctx, { halves }) => {
    for (const half of halves) {
      const parked = await ctx.db
        .query("pendingServerTimes")
        .withIndex("by_requestId", (q) => q.eq("requestId", half.requestId))
        .unique();
      const itemId = half.itemId ?? parked?.itemId;
      const ms = half.ms ?? parked?.ms;
      if (itemId === undefined || ms === undefined) {
        if (parked) await ctx.db.patch("pendingServerTimes", parked._id, half);
        else await ctx.db.insert("pendingServerTimes", half);
        continue;
      }
      if (parked) await ctx.db.delete("pendingServerTimes", parked._id);
      const id = ctx.db.normalizeId("items", itemId);
      const item = id && (await ctx.db.get("items", id));
      if (item && item.serverMs === undefined) await ctx.db.patch("items", item._id, { serverMs: ms });
    }
    return null;
  },
});

// Called by scripts/sync-logs.mjs (CLI auth) with times it read from `convex logs`:
// addMs = items:add execution; listMs / listCached = the list run that delivered the row.
export const record = internalMutation({
  args: {
    rows: v.array(
      v.object({ itemId: v.string(), addMs: v.number(), listMs: v.optional(v.number()), listCached: v.optional(v.number()) }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { rows }) => {
    for (const { itemId, addMs, listMs, listCached } of rows) {
      const id = ctx.db.normalizeId("items", itemId);
      const item = id && (await ctx.db.get("items", id));
      if (!item) continue; // deleted since
      await ctx.db.patch("items", item._id, { serverMs: item.serverMs ?? addMs, listMs, listCached });
    }
    return null;
  },
});
