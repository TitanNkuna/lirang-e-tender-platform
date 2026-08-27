import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProfile } from "@/lib/server/profile";
import { listMyTenders, loadSampleTender } from "@/lib/server/tenders";
import { tenderBadge, tenderLabel } from "@/lib/status";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/desk/")({ component: DeskHome });

function DeskHome() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const tenders = useQuery({ queryKey: ["tenders"], queryFn: () => listMyTenders() });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sample = useMutation({
    mutationFn: () => loadSampleTender(),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["tenders"] });
      await navigate({ to: "/desk/tenders/$id", params: { id: String(res.id) } });
    },
  });

  if (profile.data?.role === "contractor") {
    return <ContractorHome loading={tenders.isPending} rows={tenders.data ?? []} />;
  }

  const list = tenders.data ?? [];
  const open = list.filter((t) => t.status === "open").length;
  const awaiting = list.reduce((n, t) => n + t.submissionCount, 0);
  const awarded = list.filter((t) => t.status === "awarded").length;

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
                      {t.submissionCount} submitted · due {formatDate(t.dueAt)}
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

function ContractorHome({
  loading,
  rows,
}: {
  loading: boolean;
  rows: Awaited<ReturnType<typeof listMyTenders>>;
}) {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Contractor desk</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">Inbox</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Open tenders you can bid on. Fill the sheet, then submit. Incomplete returns are
          flagged on the issuer side.
        </p>
      </header>
      {loading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-display text-xl">No tenders yet</p>
            <p className="mt-2 text-sm text-muted">
              When a procurement team invites you or publishes an open tender, it lands here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                to="/desk/inbox/$id"
                params={{ id: String(t.id) }}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-border-strong"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    {t.category} · due {formatDate(t.dueAt)}
                  </p>
                </div>
                <Badge variant={tenderBadge(t.status)}>{tenderLabel(t.status)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
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
