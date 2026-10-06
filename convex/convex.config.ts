import { defineApp } from "convex/server";
import { v } from "convex/values";
import batchWorker from "@convex-dev/batch-worker/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import staticHosting from "@convex-dev/static-hosting/convex.config.js";

// convex/http.ts routes live under /api so the static site can own the root.
// LOG_STREAM_SECRET: the HMAC secret the dashboard shows for this deployment's webhook log stream.
// PAUSE_RATE_LIMITS: any value skips the per-user insert and network-test limits (for testing).
const app = defineApp({
  httpPrefix: "/api",
  env: { LOG_STREAM_SECRET: v.optional(v.string()), PAUSE_RATE_LIMITS: v.optional(v.string()) },
});
app.use(batchWorker);
app.use(rateLimiter);
// Serves the built frontend at https://<deployment>.convex.site.
app.use(staticHosting, { httpPrefix: "/" });
export default app;
