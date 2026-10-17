// SyntaxUI "Animated Badge" (the "Star on GitHub" pill): a conic-gradient border that orbits the pill.
import { cn } from "@/lib/utils";

export function AnimatedBadge({ children, className }) {
  return (
    <span className={cn("relative inline-flex overflow-hidden rounded-full p-px ring-1 ring-inset ring-neutral-300/60 dark:ring-gray-100/10", className)}>
      <span aria-hidden="true" className="orbit-border absolute inset-[-1000%]" />
      <span className="relative inline-flex items-center justify-center gap-2 rounded-full bg-black px-3 py-1.5 text-[12px] font-medium uppercase tracking-wide text-white backdrop-blur">
        {children}
      </span>
    </span>
  );
}
