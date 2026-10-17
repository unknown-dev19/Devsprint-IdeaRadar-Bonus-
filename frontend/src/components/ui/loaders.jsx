// SyntaxUI "Pulsating Dots" loader (three red dots), as CSS animation.
import { cn } from "@/lib/utils";

export function PulsatingDots({ className, dot = "size-2" }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex items-center gap-1.5", className)}>
      {[0, 0.3, 0.6].map((d) => (
        <span className={cn("pulse-dot rounded-full bg-red-500", dot)} key={d} style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}
