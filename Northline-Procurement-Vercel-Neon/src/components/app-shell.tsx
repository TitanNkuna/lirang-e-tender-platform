import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { UserButton } from "@/lib/auth/gates";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: typeof Inbox };

export function AppShell({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const items: Item[] =
    profile.role === "procurement"
      ? [
          { to: "/desk", label: "Overview", icon: LayoutDashboard },
          { to: "/desk/tenders", label: "Tenders", icon: Inbox },
          { to: "/desk/templates", label: "Templates", icon: FileSpreadsheet },
          { to: "/desk/contractors", label: "Contractors", icon: Building2 },
          { to: "/desk/settings", label: "Settings", icon: Settings },
        ]
      : [
          { to: "/desk", label: "Inbox", icon: Inbox },
          { to: "/desk/settings", label: "Settings", icon: Settings },
        ];

  return (
    <div className="min-h-screen bg-bg md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-surface md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <Mark className="size-7 text-accent" />
          <div>
            <p className="font-display text-lg leading-none">Northline</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-subtle">
              {profile.role === "procurement" ? "Procurement" : "Contractor"}
            </p>
          </div>
        </div>
        <NavList items={items} onNavigate={() => setOpen(false)} />
        {profile.role === "procurement" && (
          <div className="mt-auto p-4">
            <Button className="w-full" asChild>
              <Link to="/desk/new-tender">
                <Plus />
                New tender
              </Link>
            </Button>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border px-4 md:h-16 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Menu">
              <Menu />
            </Button>
            <Mark className="size-6 text-accent" />
          </div>
          <p className="hidden truncate text-sm text-muted md:block">
            {profile.companyName}
          </p>
          <div className="ml-auto [&_span]:max-w-[28vw] [&_span]:truncate md:[&_span]:max-w-none">
            <UserButton />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="bg-surface">
          <div className="mb-6 flex items-center gap-2 pt-1">
            <Mark className="size-7 text-accent" />
            <span className="font-display text-lg">Northline</span>
          </div>
          <NavList items={items} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NavList({ items, onNavigate }: { items: Item[]; onNavigate: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active =
          item.to === "/desk" ? pathname === "/desk" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-2 rounded-sm px-3 text-sm",
              active ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
