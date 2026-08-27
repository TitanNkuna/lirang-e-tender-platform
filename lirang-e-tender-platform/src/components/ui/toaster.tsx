import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "bg-surface text-fg border border-border shadow-[var(--shadow-panel)]",
          title: "text-fg",
          description: "text-muted",
        },
      }}
    />
  );
}
