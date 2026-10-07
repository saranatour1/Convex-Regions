# Convex Region Latency

How fast a Convex write shows up in four regions (US, Europe, Australia, Canada), live.

[![Live demo](https://img.shields.io/badge/live%20demo-zany--puma--173.convex.site-8D2676)](https://zany-puma-173.convex.site)
## Tabs

- **Latency**: insert rows in every region and time each round trip.
- **Network test**: check WebSocket, HTTP, SSE and large messages per region.
- **Compare**: every region's latest run on one chart.
- **Light bulb**: one switch, four regions; watch each bulb light up as its update arrives.

## Run it

```bash
pnpm install
pnpm run dev
```

## Deploy

```bash
pnpm run deploy:prod
```

Deploys the backend to all four regions and publishes the site. Rate limits are in [`convex/rateLimits.ts`](convex/rateLimits.ts).

## Learn more

To learn more about developing your project with Convex, check out:

- The [Tour of Convex](https://docs.convex.dev/get-started) for a thorough introduction to Convex principles.
- The rest of [Convex docs](https://docs.convex.dev/) to learn about all Convex features.
- [Stack](https://stack.convex.dev/) for in-depth articles on advanced topics.

## Join the community

Join thousands of developers building full-stack apps with Convex:

- Join the [Convex Discord community](https://convex.dev/community) to get help in real-time.
- Follow [Convex on GitHub](https://github.com/get-convex/), star and contribute to the open-source implementation of Convex.
