import { defineApp } from "convex/server";
import batchWorker from "@convex-dev/batch-worker/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import staticHosting from "@convex-dev/static-hosting/convex.config.js";

const app = defineApp();
app.use(batchWorker);
app.use(rateLimiter);
// Serves the built frontend at https://<deployment>.convex.site.
app.use(staticHosting, { httpPrefix: "/" });
export default app;
