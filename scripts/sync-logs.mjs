#!/usr/bin/env node
/**
 * Follows `convex logs` for the four regional deployments and writes each insert's
 * dashboard times onto its row (the app's "logs" column), and each light bulb click's
 * times into bulbFlips (bulb:set, and the bulb:get re-run that delivered it):
 *   addMs      items:add execution time; its console line is the new row's id
 *   listMs     the first items:list run that executed after that add finished, i.e. the
 *              run that delivered the row ("read fresh")
 *   listCached how many other subscribers got that same run from cache (same start time)
 *
 * Usage: pnpm run logs:sync        dev deployments (dev/us … dev/ca)
 *        pnpm run logs:sync:prod   production deployments (prod/us … prod/ca)
 * Ctrl+C to stop. Uses your Convex CLI login.
 * ponytail: one `convex run` per region per flush; fine for a demo, a log stream scales better.
 */
import { spawn } from "node:child_process";

const ENV = process.argv.includes("--prod") ? "prod" : "dev";
// Deployment references, so the same script follows dev/us … or prod/us …
const REGIONS = Object.fromEntries(["us", "eu", "au", "ca"].map((r) => [r, `${ENV}/${r}`]));
const SETTLE_MS = 1500; // after a run is logged, wait for its cached copies to be logged too
const GIVE_UP_MS = 30_000; // no delivering run seen by then: record the add time alone
const HISTORY = 500; // backfill recent inserts on start

const ms = (seconds) => Math.round(seconds * 1000);

/** The list run that delivered an add's row: the first fresh execution after the add finished. */
export const deliveringRun = (add, lists) => lists.find((l) => !l.cached && l.execTs >= add.doneTs);

// What to follow: a write, the query re-run that delivers it, and where to save the times.
// The write logs one id per console line (items:add: the row id, bulb:set: the click id).
const KINDS = [
  {
    name: "row",
    write: "items:add",
    read: "items:list",
    save: "serverTimes:record",
    row: (m) => ({ itemId: m.id, addMs: m.writeMs, listMs: m.readMs, listCached: m.readCached }),
  },
  {
    name: "bulb click",
    write: "bulb:set",
    read: "bulb:get",
    save: "serverTimes:recordBulb",
    row: (m) => ({ flipId: m.id, setMs: m.writeMs, getMs: m.readMs, getCached: m.readCached }),
  },
];

/** Pairs writes with the run that delivered them. */
export function match(adds, lists, now) {
  const ready = [];
  const pending = [];
  for (const a of adds) {
    const run = deliveringRun(a, lists);
    if (run && now - run.seenAt > SETTLE_MS) {
      const readCached = lists.filter((l) => l.cached && l.execTs === run.execTs).length;
      ready.push({ id: a.id, writeMs: a.addMs, readMs: run.ms, readCached });
    } else if (now - a.seenAt > GIVE_UP_MS) {
      ready.push({ id: a.id, writeMs: a.addMs });
    } else {
      pending.push(a);
    }
  }
  return { ready, pending };
}

function follow(region, deployment) {
  const state = KINDS.map((kind) => ({ kind, adds: [], lists: [], busy: false }));
  let buf = "";

  const p = spawn("npx", ["convex", "logs", "--deployment", deployment, "--history", String(HISTORY), "--jsonl"], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  p.stdout.on("data", (chunk) => {
    const lines = (buf + chunk).split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      if (e?.kind !== "Completion" || e.error) continue;
      const seenAt = Date.now();
      for (const st of state) {
        if (e.identifier === st.kind.write) {
          for (const logLine of e.logLines ?? []) {
            const id = logLine.messages?.[0]?.replace(/'/g, "");
            if (id) st.adds.push({ id, addMs: ms(e.executionTime), doneTs: ms(e.timestamp), seenAt });
          }
        } else if (e.identifier === st.kind.read) {
          st.lists.push({ execTs: ms(e.executionTimestamp), ms: ms(e.executionTime), cached: !!e.cachedResult, seenAt });
        }
      }
    }
  });
  p.on("exit", (code) => {
    console.error(`[${region}] convex logs exited (${code})`);
    process.exitCode = 1;
  });

  setInterval(() => {
    for (const st of state) {
      if (st.busy) continue;
      const { ready, pending } = match(st.adds, st.lists, Date.now());
      st.adds = pending;
      st.lists = st.lists.filter((l) => Date.now() - l.seenAt < GIVE_UP_MS * 2); // keep memory bounded
      if (ready.length === 0) continue;
      st.busy = true;
      const arg = JSON.stringify({ rows: ready.map(st.kind.row) });
      const run = spawn("npx", ["convex", "run", "--deployment", deployment, st.kind.save, arg], {
        stdio: ["ignore", "ignore", "inherit"],
      });
      run.on("exit", (code) => {
        st.busy = false;
        const last = ready[ready.length - 1];
        console.log(
          code === 0
            ? `[${region}] ${ready.length} ${st.kind.name}(s) · last: write ${last.writeMs} ms, read ${last.readMs ?? "—"} ms, ${last.readCached ?? 0} cached`
            : `[${region}] convex run failed (${code}); will not retry these ${ready.length} ${st.kind.name}(s)`,
        );
      });
    }
  }, 1000);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Following ${ENV} logs for`, Object.values(REGIONS).join(", "), "· Ctrl+C to stop");
  for (const [region, deployment] of Object.entries(REGIONS)) follow(region, deployment);
}
