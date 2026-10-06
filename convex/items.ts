import { v } from "convex/values";
import { defineBatchWorkerValidators, ping as pingWorker } from "@convex-dev/batch-worker";
import { components, internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { rateLimiter } from "./rateLimits";
import { requireSession } from "./sessions";

const DELETE_BATCH = 50;

// Valid, unblocked session + per-user write limit (convex/rateLimits.ts).
// ponytail: anonymous users can mint a new identity by clearing storage; sign-in is the upgrade.
const allowWrite = async (ctx: MutationCtx, sessionToken: string) => {
  const { user } = await requireSession(ctx, sessionToken);
  await rateLimiter.limit(ctx, "writes", { key: user._id, throws: true });
};

export const list = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("items"), key: v.string() })),
  handler: async (ctx) => {
    const items = await ctx.db.query("items").order("desc").take(1000);
    return items.map(({ _id, key }) => ({ _id, key }));
  },
});

export const add = mutation({
  args: { key: v.string(), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { key, sessionToken }) => {
    if (key.length > 64) throw new Error("key too long");
    await allowWrite(ctx, sessionToken);
    await ctx.db.insert("items", { key });
    return null;
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

// No cursor needed: processed rows are deleted, so each scan starts from the oldest left.
export const nextToDelete = internalQuery({
  args: vQueryArgs,
  returns: vQueryReturns,
  handler: async (ctx) => {
    const marker = await ctx.db.query("clears").first();
    if (!marker) return { kind: "idle" as const };
    const rows = await ctx.db
      .query("items")
      .withIndex("by_creation_time", (q) => q.lte("_creationTime", marker.before))
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
