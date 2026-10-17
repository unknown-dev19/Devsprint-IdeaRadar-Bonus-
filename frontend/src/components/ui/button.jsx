// SyntaxUI "Button" (components/ui/button.tsx), ported to plain JSX: same variants and sizes,
// minus the cva/Radix-Slot dependencies. Use `as="a"` for link buttons.
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-neutral-950";

export const VARIANTS = {
  default:
    "bg-neutral-900 text-neutral-50 hover:bg-neutral-900/90 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-50/90",
  brand: "bg-red-500 text-white hover:bg-red-500/90",
  destructive: "bg-red-500 text-neutral-50 hover:bg-red-500/90 dark:bg-red-900 dark:hover:bg-red-900/90",
  outline:
    "border border-neutral-200 bg-white hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  secondary:
    "bg-neutral-100 text-neutral-900 hover:bg-neutral-100/80 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-800/80",
  ghost: "hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  link: "text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50",
};

export const SIZES = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3",
  xs: "h-7 px-2.5 text-xs",
  lg: "h-11 px-8",
  icon: "size-9",
};

export const buttonClasses = ({ variant = "default", size = "default", className } = {}) =>
  cn(BASE, VARIANTS[variant], SIZES[size], className);

export const Button = forwardRef(function Button({ as: Tag = "button", variant, size, className, type, ...props }, ref) {
  return (
    <Tag
      className={buttonClasses({ variant, size, className })}
      ref={ref}
      {...(Tag === "button" ? { type: type || "button" } : {})}
      {...props}
    />
  );
});
