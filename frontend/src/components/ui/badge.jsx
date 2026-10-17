// Small status pill. SyntaxUI has no plain Badge, so this keeps the app's tones but uses
// SyntaxUI's red accent (the old "violet" tone is now the brand red).
import { cn } from "@/lib/utils";

const TONES = {
  zinc: "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-neutral-300",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  red: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  brand: "bg-red-500/10 text-red-600 dark:text-red-300",
};
TONES.violet = TONES.brand; // legacy name

export function Chip({ tone = "zinc", className, children }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone] || TONES.zinc, className)}>
      {children}
    </span>
  );
}
