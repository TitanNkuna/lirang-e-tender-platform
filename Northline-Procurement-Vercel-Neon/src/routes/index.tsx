import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileSpreadsheet, Scale, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { isPending } = useCurrentUserState();

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark />
        <nav className="flex items-center gap-2">
          {isPending ? (
            <div className="h-11 w-24 animate-pulse rounded-sm bg-raised" />
          ) : (
            <>
              <SignedOut>
                <Button variant="ghost" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link to="/login" search={{ intent: "procurement" }}>
                    Open desk
                  </Link>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button asChild>
                  <Link to="/desk">
                    Go to desk
                    <ArrowRight />
                  </Link>
                </Button>
              </SignedIn>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="ledger-grid pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 md:grid-cols-[1.15fr_0.85fr] md:pt-16">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                {BRAND_NAME}
              </p>
              <h1 className="mt-4 max-w-xl font-display text-4xl leading-[1.08] text-fg sm:text-5xl md:text-6xl">
                Send the sheet.
                <br />
                Read every return.
              </h1>
              <p className="mt-5 max-w-lg text-base text-muted sm:text-lg">
                {BRAND_TAGLINE} Issue bid templates, collect filled sheets, and
                compare who completed the work — and who should be rejected.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to="/login" search={{ intent: "procurement" }}>
                    I issue tenders
                    <ArrowRight />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/login" search={{ intent: "contractor" }}>
                    I bid as a contractor
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-subtle">
                Two desks, two logins. Install from the browser onto this laptop
                when you want it on the dock.
              </p>
            </div>

            <aside className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-panel)]">
              <p className="text-xs uppercase tracking-[0.16em] text-subtle">
                Sample return
              </p>
              <h2 className="mt-2 font-display text-2xl">Warehouse 12 steel</h2>
              <ul className="mt-5 space-y-3">
                <ReturnRow
                  name="Kloof Steelworks"
                  note="Complete · mill certs"
                  amount="R 186k"
                  tone="ok"
                />
                <ReturnRow
                  name="Karoo Civil Supply"
                  note="Lowest price · thinner QA"
                  amount="R 163k"
                  tone="warn"
                />
                <ReturnRow
                  name="Umgeni Fabrication"
                  note="Incomplete sheet · reject"
                  amount="—"
                  tone="danger"
                />
              </ul>
              <div className="mt-5 rounded-lg bg-raised px-4 py-3 text-sm text-muted">
                AI comparison: Kloof is best value — complete sheet, certified
                mill, 21-day lead. Umgeni left two prices blank.
              </div>
            </aside>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-3">
            <Feature
              icon={<FileSpreadsheet className="size-5" />}
              title="Upload a template"
              body="Build the sheet in the desk or drop a CSV. Line items, quantities and the questions contractors must answer."
            />
            <Feature
              icon={<ShieldCheck className="size-5" />}
              title="Contractors fill it"
              body="They sign in on their own desk, see only the tenders sent to them, and submit prices, lead times and quality notes."
            />
            <Feature
              icon={<Scale className="size-5" />}
              title="AI reads the returns"
              body="Completeness first. Incomplete sheets are flagged for rejection. Then price and quality are ranked side by side."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function ReturnRow({
  name,
  note,
  amount,
  tone,
}: {
  name: string;
  note: string;
  amount: string;
  tone: "ok" | "warn" | "danger";
}) {
  const color =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-danger";
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-3">
      <div>
        <p className="text-sm font-medium text-fg">{name}</p>
        <p className={`text-xs ${color}`}>{note}</p>
      </div>
      <p className="font-mono text-sm tabular-nums text-fg">{amount}</p>
    </li>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="grid size-10 place-items-center rounded-md border border-border bg-bg text-accent">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-xl">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
