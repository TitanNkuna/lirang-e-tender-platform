import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProfile } from "@/lib/server/profile";
import { listOwnerSubmissions } from "@/lib/server/submissions";
import { listMyTenders, listSuggestedWinners, loadSampleTender } from "@/lib/server/tenders";
import { submissionBadge, submissionLabel, tenderBadge, tenderLabel } from "@/lib/status";
import { CATEGORIES } from "@/lib/types";
import { formatDate, formatZar } from "@/lib/utils";

export const Route = createFileRoute("/desk/")({ component: DeskHome });

function DeskHome() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const tenders = useQuery({ queryKey: ["tenders"], queryFn: () => listMyTenders() });
  const submissions = useQuery({
    queryKey: ["owner-submissions"],
    queryFn: () => listOwnerSubmissions(),
    enabled: profile.data?.role === "procurement",
  });
  const winners = useQuery({
    queryKey: ["suggested-winners"],
    queryFn: () => listSuggestedWinners(),
    enabled: profile.data?.role === "procurement",
  });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sample = useMutation({
    mutationFn: () => loadSampleTender(),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["tenders"] });
      await qc.invalidateQueries({ queryKey: ["suggested-winners"] });
      await navigate({ to: "/desk/tenders/$id", params: { id: String(res.id) } });
    },
  });

  if (profile.data?.role === "contractor") {
    return <MarketplaceHome loading={tenders.isPending} rows={tenders.data ?? []} />;
  }

  const list = tenders.data ?? [];
  const open = list.filter((t) => t.status === "open").length;
  const awaiting = list.reduce((n, t) => n + t.submissionCount, 0);
  const awarded = list.filter((t) => t.status === "awarded").length;
  const returns = submissions.data ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Procurement desk</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl">Overview</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => sample.mutate()} disabled={sample.isPending}>
            <Sparkles />
            {sample.isPending ? "Loading sample…" : "Load sample tender"}
          </Button>
          <Button asChild>
            <Link to="/desk/new-tender">
              New tender
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open tenders" value={open} />
        <Stat label="Sheets in" value={awaiting} />
        <Stat label="Awarded" value={awarded} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Suggested winning bids</h2>
          <Link to="/desk/tenders" className="text-sm text-muted hover:text-fg">
            All tenders
          </Link>
        </div>
        {winners.isPending ? (
          <Skeleton className="h-36" />
        ) : (winners.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted">
              When contractors submit, a suggested winner appears here with price, quality fit, and
              payment terms. Open a tender for the full comparison.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {(winners.data ?? []).slice(0, 6).map((row) => (
              <li key={row.tenderId}>
                <Link
                  to="/desk/tenders/$id"
                  params={{ id: String(row.tenderId) }}
                  className="block rounded-xl border border-ok/40 bg-surface p-4 hover:border-ok"
                >
                  <p className="text-xs uppercase tracking-[0.12em] text-subtle">
                    {row.tenderTitle}
                  </p>
                  <p className="mt-1 font-display text-xl">{row.winner.companyName}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{row.winner.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-raised px-2.5 py-1 tabular-nums">
                      Score {row.winner.overall}
                    </span>
                    <span className="rounded-full bg-raised px-2.5 py-1 tabular-nums">
                      {formatZar(row.winner.summary.priceTotal)}
                    </span>
                    <span className="rounded-full bg-raised px-2.5 py-1">
                      Quality {row.winner.summary.qualityFit}%
                    </span>
                    <Badge variant={tenderBadge(row.tenderStatus as "open")}>
                      {tenderLabel(row.tenderStatus as "open")}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Contractor submissions</h2>
          <Link to="/desk/contractors" className="text-sm text-muted hover:text-fg">
            Company directory
          </Link>
        </div>
        {submissions.isPending ? (
          <Skeleton className="h-40" />
        ) : returns.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted">
              No contractor sheets submitted yet. They appear here once bidders return a form.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {returns.slice(0, 12).map((s) => (
              <li key={s.id}>
                <Link
                  to="/desk/tenders/$id"
                  params={{ id: String(s.tenderId) }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-border-strong"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.companyName}</p>
                    <p className="text-xs text-muted">
                      {s.tenderTitle}
                      {s.contactName ? ` · ${s.contactName}` : ""}
                      {s.phone ? ` · ${s.phone}` : ""}
                      {s.email ? ` · ${s.email}` : ""}
                    </p>
                  </div>
                  <Badge variant={submissionBadge(s.status as "submitted", true)}>
                    {submissionLabel(s.status as "submitted")}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Recent tenders</h2>
          <Link to="/desk/tenders" className="text-sm text-muted hover:text-fg">
            View all
          </Link>
        </div>
        {tenders.isPending ? (
          <Skeleton className="h-40" />
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-display text-xl">No tenders yet</p>
              <p className="mt-2 text-sm text-muted">
                Issue a sheet to contractors, or load the sample steel package to try AI review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {list.slice(0, 6).map((t) => (
              <li key={t.id}>
                <Link
                  to="/desk/tenders/$id"
                  params={{ id: String(t.id) }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-border-strong"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="text-xs text-muted">
                      {t.submissionCount} companies submitted · due {formatDate(t.dueAt)}
                    </p>
                  </div>
                  <Badge variant={tenderBadge(t.status)}>{tenderLabel(t.status)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MarketplaceHome({
  loading,
  rows,
}: {
  loading: boolean;
  rows: Awaited<ReturnType<typeof listMyTenders>>;
}) {
  const [category, setCategory] = useState<string>("all");
  const filtered = useMemo(() => {
    if (category === "all") return rows;
    return rows.filter((t) => t.category === category);
  }, [rows, category]);
  const openJobs = filtered.filter((t) => t.status === "open");

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Marketplace</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">Open jobs</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Tenders posted by procurement vendors on the platform. Bid on open jobs or invited
          packages.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={category === "all"} onClick={() => setCategory("all")} label="All" />
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
            label={c}
          />
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-40" />
      ) : openJobs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-display text-xl">No jobs on the market</p>
            <p className="mt-2 text-sm text-muted">
              When vendors publish open tenders or invite you, they appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {openJobs.map((t) => (
            <li key={t.id}>
              <Link
                to="/desk/inbox/$id"
                params={{ id: String(t.id) }}
                className="block rounded-xl border border-border bg-surface p-4 hover:border-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.12em] text-subtle">
                      {t.ownerCompanyName || "Vendor"} · {t.category}
                    </p>
                    <p className="mt-1 truncate font-medium">{t.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</p>
                  </div>
                  <Badge variant={tenderBadge(t.status)}>{tenderLabel(t.status)}</Badge>
                </div>
                <p className="mt-3 text-xs text-subtle">Due {formatDate(t.dueAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {filtered.some((t) => t.status !== "open") && (
        <section>
          <h2 className="mb-3 font-display text-xl">Closed / awarded</h2>
          <ul className="space-y-2">
            {filtered
              .filter((t) => t.status !== "open")
              .map((t) => (
                <li key={t.id}>
                  <Link
                    to="/desk/inbox/$id"
                    params={{ id: String(t.id) }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-border-strong"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.title}</p>
                      <p className="text-xs text-muted">
                        {t.ownerCompanyName || "Vendor"} · {t.category}
                      </p>
                    </div>
                    <Badge variant={tenderBadge(t.status)}>{tenderLabel(t.status)}</Badge>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-fg px-3 py-1.5 text-xs font-medium text-bg"
          : "rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:border-border-strong"
      }
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-subtle">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
    </div>
  );
}
