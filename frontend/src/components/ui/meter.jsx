// Thin progress bar (no SyntaxUI equivalent, so it is recoloured to the red/neutral scheme).
import { cn } from "@/lib/utils";

const FILLS = {
  brand: "bg-red-500",
  violet: "bg-red-500", // legacy name
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-600",
  sky: "bg-sky-500",
};

export function Meter({ value = 0, tone = "brand", className }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]", FILLS[tone] || FILLS.brand)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
