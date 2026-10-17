// SyntaxUI "Animated Tabs" (line tabs with a red sliding underline), ported from
// components/reusable/AnimatedTabs.tsx. The underline slides with a CSS transition
// instead of framer-motion's layoutId. Keeps the old Segmented API (options / value / onChange).
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";

export function Segmented({ options, value, onChange, label = "View", className }) {
  const refs = useRef({});
  const [bar, setBar] = useState(null);

  const measure = () => {
    const el = refs.current[value];
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
  };
  useLayoutEffect(measure, [value, options.length, options.map((o) => o.label).join("|")]);
  useLayoutEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  return (
    <div
      aria-label={label}
      className={cn("relative inline-flex max-w-full flex-wrap items-center gap-1 pb-1.5", className)}
      role="tablist"
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            aria-selected={on}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-red-500/60",
              on ? "text-red-500" : "text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400"
            )}
            key={o.id}
            onClick={() => onChange(o.id)}
            ref={(el) => (refs.current[o.id] = el)}
            role="tab"
            type="button"
          >
            {o.icon ? <Icon className="size-4" name={o.icon} /> : null}
            {o.label}
          </button>
        );
      })}
      {bar ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 h-[3px] rounded-t-full bg-red-500/80 transition-[left,width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ left: bar.left + bar.width * 0.2, width: bar.width * 0.6 }}
        />
      ) : null}
    </div>
  );
}
