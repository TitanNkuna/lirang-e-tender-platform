import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle",
        "transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        "disabled:opacity-40 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg",
        className,
      )}
      {...props}
    />
  );
}
