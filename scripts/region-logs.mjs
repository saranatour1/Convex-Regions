#!/usr/bin/env node
/**
 * Summarize Convex function execution times across the four regional deployments.
 *
 * `convex logs` streams forever even with --history, so each region is collected
 * until `history` Completion events arrive (or a timeout), then the process is killed.
 *
 * Usage:
 *   pnpm run region-logs
 *   pnpm run region-logs -- --history 200 --path items:add
 */

import { spawn } from "node:child_process";

const REGIONS = [
  { id: "us", label: "USA", deployment: "ardent-kingfisher-453" },
  { id: "eu", label: "Europe", deployment: "wooden-ocelot-218" },
  { id: "au", label: "Australia", deployment: "insightful-crane-62" },
  { id: "ca", label: "Canada", deployment: "curious-hyena-917" },
];

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) return true;
  return v;
};

const history = Number(flag("history", "200"));
const pathFilter = String(flag("path", "items:add"));
const timeoutMs = Number(flag("timeout", "20000"));

if (!Number.isFinite(history) || history < 1) {
  console.error("Invalid --history; expected a positive integer.");
  process.exit(1);
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

const summarize = (ms) => {
  if (ms.length === 0) return null;
  const s = [...ms].sort((a, b) => a - b);
  return { n: s.length, p50: pct(s, 0.5), p95: pct(s, 0.95), max: s[s.length - 1] };
};

const fmt = (n) => (n === undefined || n === null ? "—" : `${Math.round(n * 10) / 10}ms`);

/** Normalize CLI Completion JSONL and webhook-style events into one shape. */
const parseEvent = (e) => {
  // CLI: { kind: "Completion", identifier: "items:add", executionTime: seconds, requestId }
  if (e?.kind === "Completion" && typeof e.identifier === "string") {
    const ms =
      typeof e.executionTime === "number"
        ? e.executionTime * 1000
        : typeof e.userExecutionTime === "number"
          ? e.userExecutionTime * 1000
          : null;
    if (ms === null) return null;
    return { path: e.identifier, ms, requestId: e.requestId, ok: !e.error };
  }
  // Webhook / older: { topic: "function_execution", function: { path }, execution_time_ms }
  if (e?.topic === "function_execution" && e?.function?.path) {
    if (typeof e.execution_time_ms !== "number") return null;
    return {
      path: e.function.path,
      ms: e.execution_time_ms,
      requestId: e.function.request_id,
      ok: e.status === "success" || e.status === undefined,
    };
  }
  return null;
};

const fetchLogs = (deployment) =>
  new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["convex", "logs", "--history", String(history), "--success", "--jsonl", "--deployment", deployment],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;
    const completions = [];

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      resolve({ error, events: completions });
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (e?.kind === "Completion" || e?.topic === "function_execution") {
            completions.push(e);
          }
          // History flag means "show n recent then keep watching"; stop once we have them.
          if (completions.length >= history) finish(null);
        } catch {
          /* ignore non-JSON */
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => finish(err.message));
    child.on("close", (code) => {
      if (settled) return;
      if (code && code !== 0 && completions.length === 0) {
        finish((stderr || `convex logs exit ${code}`).trim().split("\n").pop());
      } else {
        finish(null);
      }
    });
  });

console.log(`region-logs · path=${pathFilter} · history=${history}\n`);

let failed = 0;
for (const r of REGIONS) {
  console.log(`${r.label} (${r.id}) · ${r.deployment}`);
  const { error, events } = await fetchLogs(r.deployment);
  if (error && events.length === 0) {
    console.log(`  ERROR: ${error}\n`);
    failed++;
    continue;
  }

  const matches = [];
  for (const e of events) {
    const n = parseEvent(e);
    if (!n || !n.ok || n.path !== pathFilter) continue;
    matches.push(n);
  }

  if (matches.length === 0) {
    console.log(
      `  no successful ${pathFilter} executions in last ${history} completions (${events.length} Completion events)\n`,
    );
    continue;
  }

  const stats = summarize(matches.map((m) => m.ms));
  console.log(`  n=${stats.n}  p50=${fmt(stats.p50)}  p95=${fmt(stats.p95)}  max=${fmt(stats.max)}`);
  for (const s of matches.slice(-3)) {
    console.log(`  sample  ${fmt(s.ms).padStart(8)}  ${s.requestId ?? "?"}`);
  }
  console.log();
}

if (failed > 0) {
  console.error(`Failed for ${failed}/${REGIONS.length} deployments.`);
  process.exit(1);
}
