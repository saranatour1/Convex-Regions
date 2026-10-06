import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn's class helper (used by components/chart.tsx).
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
