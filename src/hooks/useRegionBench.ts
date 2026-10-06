import { useEffect, useRef, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Region } from "../regions";
import { stats, type Results } from "../lib/stats";
import { describe, isRateLimited } from "../lib/errors";
import { sessionToken } from "../session";

export type Item = FunctionReturnType<typeof api.items.list>["items"][number];
export type Busy = "insert" | "delete" | null;
const EMPTY: Item[] = [];

// One insert's timeline, all epoch ms. sentAt/receivedAt are this browser's clock;
// startedAt (add began) and listRanAt (list re-ran with the row) are the server's.
// Comparing across the two clocks needs a clock-offset estimate first.
export type Stamps = { sentAt: number; startedAt: number; listRanAt?: number; receivedAt: number };
const wallNow = () => performance.timeOrigin + performance.now(); // epoch ms, sub-ms precision

export function useRegionBench(region: Region, onResult: (id: string, patch: Results) => void) {
  const convex = useConvex();
  const raw = useQuery(api.items.list)?.items;
  const add = useMutation(api.items.add);
  const clear = useMutation(api.items.clear);

  // key (insert) or _id (delete) → performance.now() when the mutation was sent
  const sent = useRef(new Map<string, number>());
  const run = useRef<{ kind: "insert" | "delete"; total: number; start: number; lat: number[] } | null>(null);

  const [latency, setLatency] = useState<Record<string, number>>({}); // key → browser sent → seen ms (this tab)
  const [stamps, setStamps] = useState<Record<string, Stamps>>({}); // key → server/browser timeline
  const [series, setSeries] = useState<number[]>([]); // last insert run, in arrival order
  const [busy, setBusy] = useState<Busy>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ends the run once nothing is outstanding. Shared by the subscription and by
  // rate-limited inserts that drop out, so it lives in a ref.
  const settle = useRef((_now: number) => {});
  useEffect(() => {
    settle.current = (now) => {
      const r = run.current;
      if (!r || sent.current.size > 0) return;
      if (r.lat.length > 0) {
        const s = stats(r.lat, now - r.start);
        onResult(region.id, r.kind === "insert" ? { insert: s } : { delete: s });
      }
      run.current = null;
      setBusy(null);
    };
  });

  // Deletes: timestamp rows leaving the list when the client receives the update,
  // not after React renders. (Inserts are timed by their mutation promise below.)
  useEffect(() => {
    const watch = convex.watchQuery(api.items.list, {});
    const pending = sent.current; // same Map for the hook's lifetime
    const unsubscribe = watch.onUpdate(() => {
      const r = run.current;
      const list = watch.localQueryResult()?.items;
      if (r?.kind !== "delete" || !list) return;
      const now = performance.now();
      const present = new Set(list.map((i) => i._id));
      for (const [id, sentAt] of sent.current) {
        if (present.has(id as Id<"items">)) continue;
        r.lat.push(now - sentAt);
        sent.current.delete(id);
      }
      if (r.lat.length > 0) setProgress({ done: r.lat.length, total: r.total });
      settle.current(now);
    });
    return () => {
      unsubscribe();
      // Hidden by <Activity> (or unmounted) mid-run: we'd miss updates and report
      // inflated times, so drop the run instead.
      if (run.current) {
        run.current = null;
        pending.clear();
        setBusy(null);
        setError("Run cancelled: its tab was hidden. Run it again.");
      }
    };
  }, [convex]);

  const fail = (e: unknown) => {
    run.current = null;
    sent.current.clear();
    setBusy(null);
    setError(describe(e));
  };

  const begin = (kind: "insert" | "delete", total: number) => {
    setError(null);
    setBusy(kind);
    setProgress({ done: 0, total });
    sent.current.clear();
    run.current = { kind, total, start: performance.now(), lat: [] };
  };

  // A Convex mutation resolves only once this client's query results include the
  // write, so sent → resolved is exactly "until it shows up", and doesn't depend on
  // whether the row is inside the list window or on how big the table is.
  // ponytail: one client's mutations run in order, so with N in flight the later ones
  // include queueing. Same N in every region, and it's what a real client sees.
  const insert = (n: number) => {
    if (run.current || raw === undefined) return;
    begin("insert", n);
    setSeries([]);
    for (let i = 0; i < n; i++) {
      const key = crypto.randomUUID();
      const sentAt = performance.now();
      const sentWall = wallNow();
      sent.current.set(key, sentAt);
      add({ key, sessionToken }).then(({ startedAt }) => {
        const now = performance.now();
        // The promise resolves in the same update that delivered the row, so the cached
        // list result right now is the run that carried it.
        const listRanAt = convex.watchQuery(api.items.list, {}).localQueryResult()?.ranAt;
        setStamps((prev) => ({ ...prev, [key]: { sentAt: sentWall, startedAt, listRanAt, receivedAt: wallNow() } }));
        const r = run.current;
        if (!r || !sent.current.delete(key)) return; // run was cancelled
        const t = now - sentAt;
        r.lat.push(t);
        setLatency((prev) => ({ ...prev, [key]: t }));
        setSeries([...r.lat]);
        setProgress({ done: r.lat.length, total: r.total });
        settle.current(now);
      }, (e: unknown) => {
        if (!isRateLimited(e)) return fail(e);
        // Over the limit: show why, drop this write from the run, keep the rest.
        setError(describe(e));
        sent.current.delete(key);
        if (run.current) run.current.total--;
        settle.current(performance.now());
      });
    }
  };

  const del = () => {
    if (run.current || !raw?.length) return;
    begin("delete", raw.length);
    const now = performance.now();
    for (const { _id } of raw) sent.current.set(_id, now);
    // One request; the batch worker deletes server-side in chunks.
    clear({ sessionToken }).catch(fail);
  };

  return { items: raw ?? EMPTY, loaded: raw !== undefined, latency, stamps, series, busy, progress, error, insert, del };
}

export type Bench = ReturnType<typeof useRegionBench>;
