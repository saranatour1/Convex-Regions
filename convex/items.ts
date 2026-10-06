import { v } from "convex/values";
import { defineBatchWorkerValidators, ping as pingWorker } from "@convex-dev/batch-worker";
import { components, internal } from "./_generated/api";
import { env, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { rateLimiter } from "./rateLimits";
import { requireSession } from "./sessions";

const DELETE_BATCH = 50;
// Same fixed window in every region, so re-running `list` after a write costs the
// same whatever the table size. Must be >= the largest N the UI inserts at once.
const WINDOW = 100;

// Valid, unblocked session + per-user write limit (convex/rateLimits.ts).
// ponytail: anonymous users can mint a new identity by clearing storage; sign-in is the upgrade.
const allowWrite = async (ctx: MutationCtx, sessionToken: string) => {
  const { user } = await requireSession(ctx, sessionToken);
  if (!env.PAUSE_RATE_LIMITS) await rateLimiter.limit(ctx, "writes", { key: user._id, throws: true });
};

// ranAt: server time this result was computed (Date.now() is frozen at function start), i.e.
// just before a write's update is pushed to clients. Deliberate wall-clock read: we want the
// stamp of each run, and `list` re-runs on every insert anyway, so caching gains nothing.
export const list = query({
  args: {},
  returns: v.object({
    ranAt: v.number(),
    items: v.array(v.object({ _id: v.id("items"), key: v.string(), serverMs: v.optional(v.number()) })),
  }),
  handler: async (ctx) => {
    const items = await ctx.db.query("items").order("desc").take(WINDOW);
    return { ranAt: Date.now(), items: items.map(({ _id, key, serverMs }) => ({ _id, key, serverMs })) };
  },
});

// startedAt: server time this mutation began executing (same as the log's executionTimestamp).
export const add = mutation({
  args: { key: v.string(), sessionToken: v.string() },
  returns: v.object({ id: v.id("items"), startedAt: v.number() }),
  handler: async (ctx, { key, sessionToken }) => {
    const startedAt = Date.now();
    if (key.length > 64) throw new Error("key too long");
    await allowWrite(ctx, sessionToken);
    const id = await ctx.db.insert("items", { key });
    console.log(id); // the log stream pairs this line with the execution time (convex/http.ts)
    return { id, startedAt };
  },
});

// One request: marks a cutoff and hands the deleting to the batch worker.
export const clear = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken }) => {
    await allowWrite(ctx, sessionToken);
    const before = Date.now();
    const marker = await ctx.db.query("clears").first();
    if (marker) await ctx.db.patch("clears", marker._id, { before });
    else await ctx.db.insert("clears", { before });
    await pingWorker(ctx, components.batchWorker, {
      name: "clear",
      workQuery: internal.items.nextToDelete,
      workerMutation: internal.items.deleteBatch,
    });
    return null;
  },
});

const { vQueryArgs, vQueryReturns, vMutationArgs, vMutationReturns } = defineBatchWorkerValidators({
  batch: { ids: v.array(v.id("items")) },
});

// No cursor needed: processed rows are deleted, so each scan starts from the newest left.
// Newest first, so the rows on screen go first whatever the table size.
export const nextToDelete = internalQuery({
  args: vQueryArgs,
  returns: vQueryReturns,
  handler: async (ctx) => {
    const marker = await ctx.db.query("clears").first();
    if (!marker) return { kind: "idle" as const };
    const rows = await ctx.db
      .query("items")
      .withIndex("by_creation_time", (q) => q.lte("_creationTime", marker.before))
      .order("desc")
      .take(DELETE_BATCH);
    if (rows.length === 0) return { kind: "idle" as const };
    return { kind: "work" as const, batch: { ids: rows.map((r) => r._id) } };
  },
});

export const deleteBatch = internalMutation({
  args: vMutationArgs,
  returns: vMutationReturns,
  handler: async (ctx, { ids }) => {
    for (const id of ids) if (await ctx.db.get("items", id)) await ctx.db.delete("items", id);
    return null;
  },
});

// Round-trip probe for the network test. nonce defeats the client's query dedupe.
export const ping = query({
  args: { nonce: v.number() },
  returns: v.null(),
  handler: async () => null,
});
