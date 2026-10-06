import type { ReactNode } from "react";
import { cx } from "../lib/format";

// Dashed pill, like the filter chips in the Convex dashboard.
export function Chip({
  children,
  onClick,
  disabled,
  active,
  tone = "default",
  icon,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: "default" | "primary" | "danger";
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed px-2.5 text-[13px] transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        tone === "default" &&
          (active
            ? "border-solid border-neutral-400 bg-white/[0.06] text-neutral-100"
            : "border-line text-neutral-300 hover:border-neutral-500 hover:bg-white/[0.04]"),
        tone === "primary" && "border-solid border-neutral-200 bg-neutral-100 text-neutral-900 hover:bg-white",
        tone === "danger" && "border-red-400/40 text-red-300 hover:bg-red-400/10",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
export const FilterIcon = () => <Svg><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></Svg>;
export const PlusIcon = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>;
export const TrashIcon = () => <Svg><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg>;
export const PulseIcon = () => <Svg><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>;
export const PinIcon = () => <Svg><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></Svg>;
export const ChevronIcon = () => <Svg><path d="m9 18 6-6-6-6" /></Svg>;

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex items-center gap-1 rounded-md border border-dashed border-line p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "h-6 rounded px-2.5 text-[13px] transition-colors",
            value === t.id ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:text-neutral-100",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
