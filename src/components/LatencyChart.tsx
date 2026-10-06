import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { REGIONS } from "../regions";
import { ms } from "../lib/format";
import type { Benches } from "../hooks/benchStore";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./chart";

const config: ChartConfig = Object.fromEntries(REGIONS.map((r) => [r.id, { label: `${r.flag} ${r.label}`, color: r.color }]));

// One line per region: x = write # in arrival order, y = ms from send until visible here.
// Lines grow live as each write lands (animation off so streaming points don't jitter).
export function LatencyChart({ benches }: { benches: Benches }) {
  const length = Math.max(0, ...REGIONS.map((r) => benches[r.id]?.series.length ?? 0));
  const data = Array.from({ length }, (_, i) => ({
    write: i + 1,
    ...Object.fromEntries(REGIONS.map((r) => [r.id, roundOrUndefined(benches[r.id]?.series[i])])),
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-full min-h-64 w-full">
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="write" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => ms(v)} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(_, payload) => `Write #${String(payload[0]?.payload?.write ?? "")}`} />}
        />
        {/* No end labels: lines converge and labels collide; the legend cards above + tooltip carry identity. */}
        {REGIONS.map((r) => (
          <Line
            key={r.id}
            dataKey={r.id}
            type="linear"
            stroke={`var(--color-${r.id})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-background)" }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

const roundOrUndefined = (v: number | undefined) => (v === undefined ? undefined : Math.round(v));
