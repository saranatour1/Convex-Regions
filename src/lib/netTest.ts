import { api } from "../../convex/_generated/api";
import type { Region } from "../regions";
import { sessionToken } from "../session";
import { median, time, type Net } from "./stats";

export type NetStep = "ws" | "http" | "site" | "sse" | "echo-small" | "echo-big" | "ws-big";
export const ECHO_BIG = 4 * 1024 * 1024;
export const WS_BIG = 1_000_000;
const SAMPLES = 5;
const SITE_SAMPLES = 3;
const SSE_GAP_MS = 200; // matches convex/http.ts
const SSE_TIMEOUT_MS = 10_000;

// Browser half of `npx convex network-test` (/instance_name, /echo), plus the connection checks from
// get-convex/network-test: an HTTP action and an SSE stream on .convex.site, and a large WebSocket message.
// Standalone (not a hook) so it runs from any tab; reports progress as it goes.
export async function runNetTest(region: Region, onProgress: (step: NetStep, net: Net) => void): Promise<Required<Net>> {
  const net: Net = { wsSamples: [], httpSamples: [], siteSamples: [] };
  const report = (step: NetStep) =>
    onProgress(step, {
      ...net,
      wsSamples: [...net.wsSamples],
      httpSamples: [...net.httpSamples],
      siteSamples: [...net.siteSamples],
    });
  const site = region.url.replace(".convex.cloud", ".convex.site");

  report("ws");
  for (let i = 0; i < SAMPLES; i++) {
    net.wsSamples.push(await time(() => region.client.query(api.items.ping, { nonce: Math.random() })));
    report("ws");
  }
  report("http");
  for (let i = 0; i < SAMPLES; i++) {
    net.httpSamples.push(await time(() => fetch(`${region.url}/instance_name`, { cache: "no-store" })));
    report("http");
  }
  report("site");
  for (let i = 0; i < SITE_SAMPLES; i++) {
    net.siteSamples.push(
      await time(async () => {
        const res = await fetch(`${site}/api/ping`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP action /api/ping returned ${res.status}`);
      }),
    );
    report("site");
  }
  report("sse");
  const sse = (net.sse = await sseStream(`${site}/api/sse`));
  report("echo-small");
  const echoSmall = (net.echoSmall = await echo(region, 128));
  report("echo-big");
  const echoBig = (net.echoBig = await echo(region, ECHO_BIG));
  const mbps = (net.mbps = ECHO_BIG / 1e6 / (echoBig / 1000));
  report("ws-big");
  const wsBig = (net.wsBig = await time(async () => {
    const payload = await region.client.mutation(api.logs.netPayload, { sessionToken, bytes: WS_BIG });
    if (payload.length !== WS_BIG) throw new Error(`WebSocket returned ${payload.length}/${WS_BIG} bytes`);
  }));
  report("ws-big");
  return { ...net, sse, echoSmall, echoBig, mbps, wsBig };
}

async function echo(region: Region, size: number) {
  const body = new Uint8Array(size);
  // random bytes so a compressing proxy can't inflate throughput
  for (let i = 0; i < size; i += 65536) crypto.getRandomValues(body.subarray(i, i + 65536));
  return time(async () => {
    const res = await fetch(`${region.url}/echo`, { method: "POST", body });
    const got = (await res.arrayBuffer()).byteLength;
    if (got !== size) throw new Error(`echo returned ${got}/${size} bytes`);
  });
}

// Opens the SSE stream and times its events. The server spaces them SSE_GAP_MS apart; if they
// arrive bunched together, something on the way (a proxy, antivirus) buffered the stream.
function sseStream(url: string): Promise<NonNullable<Net["sse"]>> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const arrivals: number[] = [];
    const es = new EventSource(url);
    const timeout = setTimeout(() => {
      es.close();
      reject(new Error("SSE stream timed out"));
    }, SSE_TIMEOUT_MS);
    es.onmessage = (e) => {
      arrivals.push(performance.now());
      if (e.data !== "done") return;
      clearTimeout(timeout);
      es.close();
      const gaps = arrivals.slice(1).map((t, i) => t - arrivals[i]);
      resolve({
        firstMs: arrivals[0] - t0,
        totalMs: arrivals[arrivals.length - 1] - t0,
        streamed: median(gaps.slice(0, -1)) >= SSE_GAP_MS / 2,
      });
    };
    es.onerror = () => {
      clearTimeout(timeout);
      es.close();
      reject(new Error("SSE stream failed to connect"));
    };
  });
}
