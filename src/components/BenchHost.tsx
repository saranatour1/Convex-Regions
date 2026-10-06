import { useEffect } from "react";
import type { Region } from "../regions";
import type { Results } from "../lib/stats";
import { useRegionBench } from "../hooks/useRegionBench";
import { publishBench } from "../hooks/benchStore";

// Renders nothing; runs one region's bench and publishes its state.
export function BenchHost({ region, onResult }: { region: Region; onResult: (id: string, patch: Results) => void }) {
  const bench = useRegionBench(region, onResult);
  useEffect(() => publishBench(region.id, bench));
  return null;
}
