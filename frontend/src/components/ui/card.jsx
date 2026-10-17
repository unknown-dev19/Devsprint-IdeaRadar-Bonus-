// SyntaxUI "Card" (components/ui/card.tsx): rounded-lg, hairline border, shadow-sm.
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Card = forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

export const CardHeader = ({ className, ...props }) => <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
export const CardTitle = ({ className, ...props }) => <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />;
export const CardDescription = ({ className, ...props }) => <p className={cn("text-sm text-neutral-500 dark:text-neutral-400", className)} {...props} />;
export const CardContent = ({ className, ...props }) => <div className={cn("p-6 pt-0", className)} {...props} />;
