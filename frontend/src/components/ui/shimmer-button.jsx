// SyntaxUI "Shimmer Button": a moving highlight runs along a 2px gradient frame around a red button.
// The original animates a CSS variable with framer-motion; this uses a CSS keyframe (see index.css).
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const ShimmerButton = forwardRef(function ShimmerButton({ className, children, type = "button", ...props }, ref) {
  return (
    <button
      className={cn(
        "shimmer-frame group inline-flex overflow-hidden rounded-lg outline-none transition-transform duration-150 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-neutral-950",
        className
      )}
      ref={ref}
      type={type}
      {...props}
    >
      <span className="m-[2px] inline-flex h-9 items-center gap-2 rounded-[calc(0.5rem-2px)] bg-[#fb3b53] px-5 text-sm font-medium text-[#f6f6f6] backdrop-blur-sm">
        {children}
      </span>
    </button>
  );
});
