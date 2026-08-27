import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyTenders } from "@/lib/server/tenders";
import { tenderBadge, tenderLabel } from "@/lib/status";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/desk/tenders")({ component: TendersPage });

function TendersPage() {
  const list = useQuery({ queryKey: ["tenders"], queryFn: () => listMyTenders() });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Issued</p>
          <h1 className="mt-1 font-display text-3xl">Tenders</h1>
        </div>
        <Button asChild>
          <Link to="/desk/new-tender">New tender</Link>
        </Button>
      </header>
      {list.isPending ? (
        <Skeleton className="h-48" />
      ) : (list.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            No tenders issued yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {(list.data ?? []).map((t) => (
            <li key={t.id}>
              <Link
                to="/desk/tenders/$id"
                params={{ id: String(t.id) }}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-border-strong"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    {t.category} · {t.submissionCount} submitted · due {formatDate(t.dueAt)}
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
