#!/usr/bin/env node
/**
 * Follows `convex logs` for the four regional deployments and writes each insert's
 * dashboard times onto its row (shown in the app's "logs" column):
 *   addMs      items:add execution time; its console line is the new row's id
 *   listMs     the first items:list run that executed after that add finished, i.e. the
 *              run that delivered the row ("read fresh")
 *   listCached how many other subscribers got that same run from cache (same start time)
 *
 * Usage: pnpm run logs:sync   (Ctrl+C to stop). Uses your Convex CLI login.
 * ponytail: one `convex run` per region per flush; fine for a demo, a log stream scales better.
 */
import { spawn } from "node:child_process";

const REGIONS = {
  us: "ardent-kingfisher-453",
  eu: "wooden-ocelot-218",
  au: "insightful-crane-62",
  ca: "curious-hyena-917",
};
const SETTLE_MS = 1500; // after a run is logged, wait for its cached copies to be logged too
const GIVE_UP_MS = 30_000; // no delivering run seen by then: record the add time alone
const HISTORY = 500; // backfill recent inserts on start

const ms = (seconds) => Math.round(seconds * 1000);

/** The list run that delivered an add's row: the first fresh execution after the add finished. */
export const deliveringRun = (add, lists) => lists.find((l) => !l.cached && l.execTs >= add.doneTs);

/** Pairs adds with the run that delivered them. */
export function match(adds, lists, now) {
  const ready = [];
  const pending = [];
  for (const a of adds) {
    const run = deliveringRun(a, lists);
    if (run && now - run.seenAt > SETTLE_MS) {
      const listCached = lists.filter((l) => l.cached && l.execTs === run.execTs).length;
      ready.push({ itemId: a.itemId, addMs: a.addMs, listMs: run.ms, listCached });
    } else if (now - a.seenAt > GIVE_UP_MS) {
      ready.push({ itemId: a.itemId, addMs: a.addMs });
    } else {
      pending.push(a);
    }
  }
  return { ready, pending };
}

function follow(region, deployment) {
  let adds = [];
  let lists = [];
  let buf = "";
  let busy = false;

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
      if (e.identifier === "items:add") {
        const itemId = e.logLines?.[0]?.messages?.[0]?.replace(/'/g, "");
        if (itemId) adds.push({ itemId, addMs: ms(e.executionTime), doneTs: ms(e.timestamp), seenAt });
      } else if (e.identifier === "items:list") {
        lists.push({ execTs: ms(e.executionTimestamp), ms: ms(e.executionTime), cached: !!e.cachedResult, seenAt });
      }
    }
  });
  p.on("exit", (code) => {
    console.error(`[${region}] convex logs exited (${code})`);
    process.exitCode = 1;
  });

  setInterval(async () => {
    if (busy) return;
    const { ready, pending } = match(adds, lists, Date.now());
    adds = pending;
    lists = lists.filter((l) => Date.now() - l.seenAt < GIVE_UP_MS * 2); // keep memory bounded
    if (ready.length === 0) return;
    busy = true;
    const arg = JSON.stringify({ rows: ready });
    const run = spawn("npx", ["convex", "run", "--deployment", deployment, "serverTimes:record", arg], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    run.on("exit", (code) => {
      busy = false;
      const sample = ready[ready.length - 1];
      console.log(
        code === 0
          ? `[${region}] ${ready.length} row(s) · last: add ${sample.addMs} ms, list ${sample.listMs ?? "—"} ms, ${sample.listCached ?? 0} cached`
          : `[${region}] convex run failed (${code}); will not retry these ${ready.length} row(s)`,
      );
    });
  }, 1000);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Following logs for", Object.keys(REGIONS).join(", "), "· Ctrl+C to stop");
  for (const [region, deployment] of Object.entries(REGIONS)) follow(region, deployment);
}
