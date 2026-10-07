import { ConvexReactClient } from "convex/react";

// One Convex client per regional deployment (URLs in .env.local, or .env.prod for build:prod).
// Read each variable directly: `import.meta.env` as a whole would inline every VITE_ var into the bundle.
// color: the region's line in the chart. These four pass the dataviz validator
// all-pairs on the dark panel (CVD + normal vision), so crossing lines stay distinct.
export const REGIONS = [
  { id: "us", code: "iad", label: "USA", color: "#3987e5", flag: "🇺🇸", city: "N. Virginia", aws: "aws-us-east-1", url: import.meta.env.VITE_CONVEX_URL_US },
  { id: "eu", code: "dub", label: "Europe", color: "#c98500", flag: "🇪🇺", city: "Ireland", aws: "aws-eu-west-1", url: import.meta.env.VITE_CONVEX_URL_EU },
  { id: "au", code: "syd", label: "Australia", color: "#d55181", flag: "🇦🇺", city: "Sydney", aws: "aws-ap-southeast-2", url: import.meta.env.VITE_CONVEX_URL_AU },
  { id: "ca", code: "yul", label: "Canada", color: "#008300", flag: "🇨🇦", city: "Montréal", aws: "aws-ca-central-1", url: import.meta.env.VITE_CONVEX_URL_CA },
]
  .filter((r): r is typeof r & { url: string } => typeof r.url === "string")
  .map((r) => ({ ...r, client: new ConvexReactClient(r.url) }));

export type Region = (typeof REGIONS)[number];

export const WINDOW = 100; // matches WINDOW in convex/items.ts
