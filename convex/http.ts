import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";

const http = httpRouter();

const hexToBytes = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((b) => parseInt(b, 16)));
const MAX_AGE_MS = 5 * 60 * 1000; // reject replays of old batches

// Webhook log stream (dashboard → Integrations → Log streams → Webhook), at /api/logs.
// Keeps only items:add: its console line (the new row's id) and its execution time.
http.route({
  path: "/logs",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = env.LOG_STREAM_SECRET;
    if (!secret) return new Response("LOG_STREAM_SECRET not set", { status: 500 });

    const body = await req.arrayBuffer();
    const signature = req.headers.get("x-webhook-signature")?.replace("sha256=", "") ?? "";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("HMAC", key, hexToBytes(signature), body))) {
      return new Response("bad signature", { status: 401 });
    }

    // The stream can be configured as a JSON array or as JSONL.
    const text = new TextDecoder().decode(body);
    let events: unknown[];
    try {
      events = text.trimStart().startsWith("[") ? JSON.parse(text) : text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      return new Response("bad body", { status: 400 });
    }

    const halves: { requestId: string; itemId?: string; ms?: number }[] = [];
    for (const e of events) {
      if (typeof e !== "object" || e === null) continue;
      const { topic, timestamp, function: fn, message, execution_time_ms, status } = e as Record<string, unknown>;
      if (typeof timestamp !== "number" || timestamp < Date.now() - MAX_AGE_MS) continue;
      if (typeof fn !== "object" || fn === null) continue;
      const { path, request_id } = fn as Record<string, unknown>;
      if (path !== "items:add" || typeof request_id !== "string") continue;
      if (topic === "console" && typeof message === "string") {
        halves.push({ requestId: request_id, itemId: message.replace(/'/g, "") });
      } else if (topic === "function_execution" && status === "success" && typeof execution_time_ms === "number") {
        halves.push({ requestId: request_id, ms: execution_time_ms });
      }
    }
    // Chunked so a busy batch stays inside one mutation's read/write limits.
    for (let i = 0; i < halves.length; i += 200) {
      await ctx.runMutation(internal.serverTimes.ingest, { halves: halves.slice(i, i + 200) });
    }
    return new Response(null, { status: 200 });
  }),
});

export default http;
