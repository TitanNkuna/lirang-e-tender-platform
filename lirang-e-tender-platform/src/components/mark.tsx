import { cn } from "@/lib/utils";
import { BRAND_SHORT } from "@/lib/brand";

/** Lirang mark — rounded tile with a stylised “L”. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7", className)}
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="2.5"
        width="27"
        height="27"
        rx="7"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M11 9.5v13h10.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-fg", className)}>
      <Mark className="size-7 text-accent" />
      <span className="font-display text-xl tracking-tight">{BRAND_SHORT}</span>
    </span>
  );
}
