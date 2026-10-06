import type { Region } from "../regions";
import { cx, ms, tone } from "../lib/format";
import { median, type Net } from "../lib/stats";
import type { NetStep } from "../lib/netTest";
import { Chip, PulseIcon } from "./ui";

export type NetState = { status: "idle" | "queued" | "running" | "done" | "error"; step?: NetStep; net?: Net; error?: string };

export function NetworkBlock({
  region,
  state,
  fastest,
  onRun,
  disabled,
}: {
  region: Region;
  state: NetState;
  fastest: boolean;
  onRun: () => void;
  disabled: boolean;
}) {
  const { net, step, status } = state;
  const ws = net?.wsSamples.length ? median(net.wsSamples) : undefined;
  const active = (s: NetStep) => status === "running" && step === s;

  return (
    <section
      className={cx(
        "flex min-h-72 flex-col overflow-hidden rounded-lg border bg-panel transition-colors duration-500",
        fastest ? "border-emerald-500/60" : "border-line",
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <span className="text-lg leading-none">{region.flag}</span>
        <h2 className="mr-auto text-sm font-medium text-neutral-100 sm:mr-0">{region.label}</h2>
        <span className="mr-auto hidden h-6 items-center whitespace-nowrap rounded-md border border-dashed border-line px-2 font-mono text-xs text-muted sm:inline-flex">
          {region.aws}
        </span>
        {fastest && (
          <span className="inline-flex h-6 items-center rounded-md border border-dashed border-emerald-500/60 px-2 text-xs text-emerald-300">
            fastest
          </span>
        )}
        <span className={cx("font-mono text-xs", status === "running" ? "text-sky-300" : "text-muted")}>
          {status === "queued" ? "queued" : status === "running" ? "testing…" : status === "done" ? "done" : ""}
        </span>
        <Chip icon={<PulseIcon />} onClick={onRun} disabled={disabled}>
          Run
        </Chip>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div>
          <p key={ws} className="font-mono text-3xl tabular-nums text-neutral-100 animate-flash">
            {ws === undefined ? "—" : ms(ws)}
          </p>
          <p className="text-xs text-muted">median WebSocket round trip · {region.city}</p>
        </div>

        <dl className="grid grid-cols-[6rem_1fr_auto] items-center gap-x-3 gap-y-2.5 font-mono text-xs">
          <Row label="WebSocket" active={active("ws")} value={net?.wsSamples.length ? ms(median(net.wsSamples)) : undefined}>
            <Samples values={net?.wsSamples} />
          </Row>
          <Row label="HTTP" active={active("http")} value={net?.httpSamples.length ? ms(median(net.httpSamples)) : undefined}>
            <Samples values={net?.httpSamples} />
          </Row>
          <Row label="Echo 128 B" active={active("echo-small")} value={net?.echoSmall === undefined ? undefined : ms(net.echoSmall)}>
            <Bar running={active("echo-small")} done={net?.echoSmall !== undefined} />
          </Row>
          <Row
            label="Echo 4 MB"
            active={active("echo-big")}
            value={net?.echoBig === undefined ? undefined : `${ms(net.echoBig)} · ${net.mbps!.toFixed(1)} MB/s`}
          >
            <Bar running={active("echo-big")} done={net?.echoBig !== undefined} />
          </Row>
        </dl>
      </div>

      {state.error && <p className="border-t border-line px-4 py-2 text-xs text-red-400">{state.error}</p>}
    </section>
  );
}

function Row({ label, value, active, children }: { label: string; value?: string; active: boolean; children: React.ReactNode }) {
  return (
    <>
      <dt className={cx("transition-colors", active ? "text-sky-300" : "text-muted")}>{label}</dt>
      <dd className="flex min-w-0 flex-wrap gap-1">{children}</dd>
      <dd key={value} className="text-right tabular-nums text-neutral-200 animate-flash">{value ?? "—"}</dd>
    </>
  );
}

// One pill per ping, popping in as each sample lands.
function Samples({ values = [] }: { values?: number[] }) {
  return (
    <>
      {values.map((v, i) => (
        <span key={i} className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 tabular-nums text-neutral-300 animate-pop">
          <span className={cx("size-1.5 rounded-[1px]", tone(v))} />
          {Math.round(v)}
        </span>
      ))}
    </>
  );
}

function Bar({ running, done }: { running: boolean; done: boolean }) {
  return (
    <span className="h-1 w-full overflow-hidden rounded-full bg-white/5">
      <span
        className={cx(
          "block h-full rounded-full transition-all duration-500",
          done ? "w-full bg-emerald-400" : running ? "w-1/3 animate-pulse bg-sky-400" : "w-0",
        )}
      />
    </span>
  );
}
