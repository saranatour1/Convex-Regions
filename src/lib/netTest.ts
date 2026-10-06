import { api } from "../../convex/_generated/api";
import type { Region } from "../regions";
import { time, type Net } from "./stats";

export type NetStep = "ws" | "http" | "echo-small" | "echo-big";
export const ECHO_BIG = 4 * 1024 * 1024;
const SAMPLES = 5;

// Browser half of `npx convex network-test`: same /instance_name and /echo endpoints.
// Standalone (not a hook) so it runs from any tab; reports progress as it goes.
export async function runNetTest(region: Region, onProgress: (step: NetStep, net: Net) => void): Promise<Net> {
  const net: Net = { wsSamples: [], httpSamples: [] };
  const report = (step: NetStep) => onProgress(step, { ...net, wsSamples: [...net.wsSamples], httpSamples: [...net.httpSamples] });

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
  report("echo-small");
  net.echoSmall = await echo(region, 128);
  report("echo-big");
  net.echoBig = await echo(region, ECHO_BIG);
  net.mbps = ECHO_BIG / 1e6 / (net.echoBig / 1000);
  report("echo-big");
  return net;
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
