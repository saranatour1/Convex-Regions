import { useEffect, useState } from "react";
import type { Item } from "./useRegionBench";

export type Shown = Item & { ghost?: boolean };

// Oldest → newest. Deleted rows stay briefly as "ghosts" so they can animate out.
// `loaded` is false while the subscription (re)connects, e.g. a tab coming back from
// <Activity mode="hidden">; that empty list must not read as "everything was deleted".
export function useWithGhosts(items: Item[], loaded: boolean) {
  const [prev, setPrev] = useState(items);
  const [shown, setShown] = useState<Shown[]>(() => [...items].reverse());
  if (loaded && items !== prev) {
    setPrev(items);
    const live = new Map(items.map((i) => [i._id, i]));
    const had = new Set(shown.map((s) => s._id));
    setShown([
      // A row that comes back (e.g. after a reconnect) stops being a ghost.
      ...shown.map((s) => live.get(s._id) ?? { ...s, ghost: true }),
      ...[...items].reverse().filter((i) => !had.has(i._id)), // list is newest-first
    ]);
  }

  const hasGhosts = shown.some((s) => s.ghost);
  useEffect(() => {
    if (!hasGhosts) return;
    // ponytail: one timer, reset while deletes keep landing, so the batch clears together
    const t = setTimeout(() => setShown((s) => s.filter((x) => !x.ghost)), 600);
    return () => clearTimeout(t);
  }, [shown, hasGhosts]);

  return shown;
}
