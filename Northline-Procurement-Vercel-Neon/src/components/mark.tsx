import { cn } from "@/lib/utils";

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
        rx="6"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M9 22V10h2.2l7.6 8.4V10H21v12h-2.2L11.2 13.6V22H9Z"
        fill="currentColor"
      />
      <path d="M8 24.5h16" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-fg", className)}>
      <Mark className="size-7 text-accent" />
      <span className="font-display text-xl tracking-tight">Northline</span>
    </span>
  );
}
