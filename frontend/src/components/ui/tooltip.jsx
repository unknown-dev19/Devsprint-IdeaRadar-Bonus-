// SyntaxUI-styled tooltip (components/ui/tooltip.tsx look) as a CSS hover/focus tooltip.
import { cn } from "@/lib/utils";

export function Tooltip({ text, children, className }) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-950 opacity-0 shadow-md transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
