import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-raised", className)}>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
