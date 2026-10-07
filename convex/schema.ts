import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // key: client-generated UUID. serverMs: items:add execution time from the
  // dashboard logs, filled in by the log stream webhook (convex/http.ts).
  items: defineTable({
    key: v.string(),
    serverMs: v.optional(v.number()),
    // From the logs (scripts/sync-logs.mjs): the items:list run that first delivered this row.
    // listMs: its execution time (executed fresh); listCached: subscribers served it from cache.
    listMs: v.optional(v.number()),
    listCached: v.optional(v.number()),
    latencyMs: v.optional(v.number()), // ponytail: unused, old rows still carry it; drop after a Delete all
  }),
  // Log events arrive split (console line with the id, execution with the time),
  // possibly in different batches: park the half that came first, by request id.
  pendingServerTimes: defineTable({
    requestId: v.string(),
    itemId: v.optional(v.string()),
    ms: v.optional(v.number()),
  }).index("by_requestId", ["requestId"]),
  // Singleton: the delete worker removes items created at or before `before`.
  clears: defineTable({ before: v.number() }),

  // Anonymous users: one per browser. keyHash = SHA-256 of the browser's userKey;
  // handle = its first 16 hex chars, identical in every region (use it to block).
  users: defineTable({
    keyHash: v.string(),
    handle: v.string(),
    blocked: v.boolean(),
    blockedReason: v.optional(v.string()),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_handle", ["handle"]),
  // One per browser tab. Only the token's hash is stored.
  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    lastSeenAt: v.number(),
    userAgent: v.optional(v.string()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  // Audit logs, written to the home region (US) only.
  netTests: defineTable({
    userId: v.id("users"),
    sessionId: v.id("sessions"),
    region: v.string(),
    country: v.optional(v.string()),
    colo: v.optional(v.string()),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    wsMs: v.optional(v.number()),
    httpMs: v.optional(v.number()),
    echoSmallMs: v.optional(v.number()),
    echoBigMs: v.optional(v.number()),
    mbps: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_userId", ["userId"]),
  locationChanges: defineTable({
    userId: v.id("users"),
    sessionId: v.id("sessions"),
    country: v.string(),
    colo: v.string(),
    previousCountry: v.optional(v.string()),
    previousColo: v.optional(v.string()),
  }).index("by_userId", ["userId"]),
});
