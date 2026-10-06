import { useEffect, useRef, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { MAX, type Region } from "../regions";
import { stats, type Results } from "../lib/stats";
import { describe, isRateLimited } from "../lib/errors";
import { sessionToken } from "../session";

export type Item = FunctionReturnType<typeof api.items.list>[number];
export type Busy = "insert" | "delete" | null;
const EMPTY: Item[] = [];

export function useRegionBench(region: Region, onResult: (id: string, patch: Results) => void) {
  const convex = useConvex();
  const raw = useQuery(api.items.list);
  const add = useMutation(api.items.add);
  const clear = useMutation(api.items.clear);

  // key (insert) or _id (delete) → performance.now() when the mutation was sent
  const sent = useRef(new Map<string, number>());
  const run = useRef<{ kind: "insert" | "delete"; total: number; start: number; lat: number[] } | null>(null);

  const [latency, setLatency] = useState<Record<string, number>>({}); // key → sent → seen ms
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

  // Timestamp changes when the client receives them, not after React renders.
  useEffect(() => {
    const watch = convex.watchQuery(api.items.list, {});
    const pending = sent.current; // same Map for the hook's lifetime
    const unsubscribe = watch.onUpdate(() => {
      const r = run.current;
      const list = watch.localQueryResult();
      if (!r || !list) return;
      const now = performance.now();
      const isInsert = r.kind === "insert";
      const present = new Set(list.map((i) => (isInsert ? i.key : i._id)));
      const seen: Record<string, number> = {};
      for (const [k, sentAt] of sent.current) {
        if (present.has(k) !== isInsert) continue;
        seen[k] = now - sentAt;
        r.lat.push(seen[k]);
        sent.current.delete(k);
      }
      if (r.lat.length > 0) {
        if (isInsert) {
          setLatency((prev) => ({ ...prev, ...seen }));
          setSeries([...r.lat]);
        }
        setProgress({ done: r.lat.length, total: r.total });
      }
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

  // ponytail: the Convex client runs one client's mutations in order, so with N
  // in flight the later ones include queueing. That's what a real client sees.
  const insert = (n: number) => {
    if (run.current || raw === undefined) return;
    const count = Math.min(n, MAX - raw.length);
    if (count <= 0) return setError(`Delete first (max ${MAX} rows).`);
    begin("insert", count);
    setSeries([]);
    for (let i = 0; i < count; i++) {
      const key = crypto.randomUUID();
      sent.current.set(key, performance.now());
      add({ key, sessionToken }).catch((e: unknown) => {
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

  return { items: raw ?? EMPTY, loaded: raw !== undefined, latency, series, busy, progress, error, insert, del };
}

export type Bench = ReturnType<typeof useRegionBench>;
