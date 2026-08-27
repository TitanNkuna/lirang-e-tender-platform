import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteTender, listMyTenders } from "@/lib/server/tenders";
import { tenderBadge, tenderLabel } from "@/lib/status";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/desk/tenders")({ component: TendersPage });

function TendersPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["tenders"], queryFn: () => listMyTenders() });
  const remove = useMutation({
    mutationFn: (id: number) => deleteTender({ data: id }),
    onSuccess: async () => {
      toast.success("Tender revoked");
      await qc.invalidateQueries({ queryKey: ["tenders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <Link
                to="/desk/tenders/$id"
                params={{ id: String(t.id) }}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 hover:opacity-90"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    {t.category} · {t.submissionCount} submitted · due {formatDate(t.dueAt)}
                  </p>
                </div>
                <Badge variant={tenderBadge(t.status)}>{tenderLabel(t.status)}</Badge>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Revoke tender"
                disabled={remove.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Revoke this tender? It will be removed for all contractors and submissions will be deleted.",
                    )
                  )
                    remove.mutate(t.id);
                }}
              >
                <Trash2 className="size-4 text-danger" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
