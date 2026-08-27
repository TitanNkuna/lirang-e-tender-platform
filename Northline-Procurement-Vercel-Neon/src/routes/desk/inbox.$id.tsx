import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BidSheet } from "@/components/bid-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { emptyPayload, scoreSubmission } from "@/lib/completeness";
import { getMySubmission, saveSubmission } from "@/lib/server/submissions";
import { getTender } from "@/lib/server/tenders";
import { submissionBadge, submissionLabel, tenderBadge, tenderLabel } from "@/lib/status";
import type { BidPayload } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/desk/inbox/$id")({
  component: InboxDetail,
});

function InboxDetail() {
  const { id } = Route.useParams();
  const tenderId = Number(id);
  const qc = useQueryClient();
  const tender = useQuery({
    queryKey: ["tender", tenderId],
    queryFn: () => getTender({ data: tenderId }),
  });
  const mine = useQuery({
    queryKey: ["my-submission", tenderId],
    queryFn: () => getMySubmission({ data: tenderId }),
  });
  const [payload, setPayload] = useState<BidPayload | null>(null);

  useEffect(() => {
    if (mine.data) setPayload(mine.data.payload);
    else if (tender.data) setPayload(emptyPayload(tender.data.schema));
  }, [mine.data, tender.data]);

  const save = useMutation({
    mutationFn: (submit: boolean) => {
      if (!payload) throw new Error("Nothing to save.");
      return saveSubmission({ data: { tenderId, payload, submit } });
    },
    onSuccess: async (res) => {
      toast.success(res.status === "submitted" ? "Sheet submitted" : "Draft saved");
      await qc.invalidateQueries({ queryKey: ["my-submission", tenderId] });
      await qc.invalidateQueries({ queryKey: ["tenders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (tender.isPending || mine.isPending) return <Skeleton className="h-64" />;
  const t = tender.data;
  if (!t) return <p className="text-muted">This tender is not available on your desk.</p>;
  if (!payload) return <Skeleton className="h-64" />;

  const submitted = Boolean(mine.data && mine.data.status !== "draft");
  const locked = submitted || t.status !== "open";
  const score = scoreSubmission(t.schema, payload);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={tenderBadge(t.status)}>{tenderLabel(t.status)}</Badge>
            {mine.data && (
              <Badge variant={submissionBadge(mine.data.status, score.complete)}>
                {submissionLabel(mine.data.status)}
              </Badge>
            )}
          </div>
          <h1 className="mt-2 font-display text-3xl">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t.description}</p>
          <p className="mt-2 text-xs text-subtle">Due {formatDate(t.dueAt)}</p>
        </div>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => save.mutate(false)} disabled={save.isPending}>
              Save draft
            </Button>
            <Button onClick={() => save.mutate(true)} disabled={save.isPending}>
              Submit sheet
            </Button>
          </div>
        )}
      </header>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Completeness</span>
          <span className="tabular-nums">{score.score}%</span>
        </div>
        <Progress value={score.score} className="mt-2" />
        {score.missing.length > 0 && (
          <p className="mt-2 text-xs text-warn">Still needed: {score.missing.join("; ")}</p>
        )}
      </div>

      <BidSheet schema={t.schema} payload={payload} onChange={setPayload} readOnly={locked} />
    </div>
  );
}
