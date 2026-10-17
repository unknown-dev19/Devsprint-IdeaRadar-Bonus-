// One import point for the SyntaxUI-style component layer.
import { cn } from "@/lib/utils";

export { Icon, Spinner } from "./icons";
export { Button, buttonClasses } from "./button";
export { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card";
export { Segmented } from "./tabs";
export { Chip } from "./badge";
export { Meter } from "./meter";
export { FIELD, Input, Textarea } from "./field";
export { ShimmerButton } from "./shimmer-button";
export { AnimatedBadge } from "./animated-badge";
export { PulsatingDots } from "./loaders";
export { Tooltip } from "./tooltip";
export { ThemeToggle } from "./theme-toggle";

/** IdeaRadar mark: radar rings + sweep, in SyntaxUI's "Syntax<UI>" wordmark style. */
export function Logo({ className }) {
  return (
    <svg aria-hidden="true" className={cn("size-6", className)} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.5" />
      <path d="M12 12 19 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="16.5" cy="14.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function SectionTitle({ eyebrow, children, aside }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-500">{eyebrow}</p>
        ) : null}
        <h3 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{children}</h3>
      </div>
      {aside}
    </div>
  );
}
