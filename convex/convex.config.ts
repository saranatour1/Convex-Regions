import { defineApp } from "convex/server";
import batchWorker from "@convex-dev/batch-worker/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const app = defineApp();
app.use(batchWorker);
app.use(rateLimiter);
export default app;
