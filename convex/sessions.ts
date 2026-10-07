import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import { rateLimiter } from "./rateLimits";

const TOKEN = /^[0-9a-f]{64}$/; // 32 random bytes, hex (see src/session.ts)

export const sha256 = async (s: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const sessionInvalid = () => new ConvexError({ kind: "SessionInvalid" as const });

// Called by the browser on load, once per region. Creates the user and session if new.
export const start = mutation({
  args: { userKey: v.string(), sessionToken: v.string(), userAgent: v.optional(v.string()) },
  returns: v.object({ handle: v.string() }),
  handler: async (ctx, { userKey, sessionToken, userAgent }) => {
    if (!TOKEN.test(userKey) || !TOKEN.test(sessionToken)) throw sessionInvalid();
    const keyHash = await sha256(userKey);
    await rateLimiter.limit(ctx, "appCalls", { throws: true }); // doesn't go through requireSession
    await rateLimiter.limit(ctx, "sessionStarts", { key: keyHash, throws: true });

    let user = await ctx.db.query("users").withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash)).unique();
    if (!user) {
      await rateLimiter.limit(ctx, "newUsers", { throws: true });
      const id = await ctx.db.insert("users", { keyHash, handle: keyHash.slice(0, 16), blocked: false });
      user = (await ctx.db.get("users", id))!;
    }
    if (user.blocked) throw new ConvexError({ kind: "Blocked" as const });

    const tokenHash = await sha256(sessionToken);
    const session = await ctx.db.query("sessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (session) {
      if (session.userId !== user._id) throw sessionInvalid();
      await ctx.db.patch("sessions", session._id, { lastSeenAt: Date.now() });
    } else {
      await ctx.db.insert("sessions", {
        userId: user._id,
        tokenHash,
        lastSeenAt: Date.now(),
        userAgent: userAgent?.slice(0, 200),
      });
    }
    return { handle: user.handle };
  },
});

// Every write goes through this: a known session whose user isn't blocked, under the app-wide cap.
export async function requireSession(ctx: MutationCtx, sessionToken: string) {
  if (!TOKEN.test(sessionToken)) throw sessionInvalid();
  const tokenHash = await sha256(sessionToken);
  const session = await ctx.db.query("sessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
  if (!session) throw sessionInvalid();
  const user = await ctx.db.get("users", session.userId);
  if (!user) throw sessionInvalid();
  if (user.blocked) throw new ConvexError({ kind: "Blocked" as const });
  await rateLimiter.limit(ctx, "appCalls", { throws: true });
  return { session, user };
}
