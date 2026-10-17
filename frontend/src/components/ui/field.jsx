// Text input / textarea. SyntaxUI ships no plain form fields, so these follow its card styling
// (rounded-md, neutral borders) with the red focus ring.
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const FIELD =
  "w-full rounded-md border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/25 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-600";

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input className={cn(FIELD, className)} ref={ref} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea className={cn(FIELD, "resize-y", className)} ref={ref} {...props} />;
});
