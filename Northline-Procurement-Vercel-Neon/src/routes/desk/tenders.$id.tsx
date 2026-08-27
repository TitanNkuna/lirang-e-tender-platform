import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AiPanel } from "@/components/ai-panel";
import { BidSheet } from "@/components/bid-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { scoreSubmission } from "@/lib/completeness";
import { getLatestReview, runAiReview } from "@/lib/server/ai";
import { listContractors } from "@/lib/server/profile";
import {
  awardSubmission,
  getTender,
  inviteContractors,
  listInvites,
  listSubmissionsForTender,
  rejectSubmission,
  setTenderStatus,
} from "@/lib/server/tenders";
import { submissionBadge, submissionLabel, tenderBadge, tenderLabel } from "@/lib/status";
import type { SubmissionRecord } from "@/lib/types";
import { formatDate, formatZar } from "@/lib/utils";

export const Route = createFileRoute("/desk/tenders/$id")({
  component: TenderDetail,
});

function TenderDetail() {
  const { id } = Route.useParams();
  const tenderId = Number(id);
  const qc = useQueryClient();
  const [openBid, setOpenBid] = useState<SubmissionRecord | null>(null);
  const [inviteIds, setInviteIds] = useState<string[]>([]);

  const tender = useQuery({
    queryKey: ["tender", tenderId],
    queryFn: () => getTender({ data: tenderId }),
  });
  const submissions = useQuery({
    queryKey: ["submissions", tenderId],
    queryFn: () => listSubmissionsForTender({ data: tenderId }),
  });
  const review = useQuery({
    queryKey: ["review", tenderId],
    queryFn: () => getLatestReview({ data: tenderId }),
  });
  const invites = useQuery({
    queryKey: ["invites", tenderId],
    queryFn: () => listInvites({ data: tenderId }),
  });
  const contractors = useQuery({
    queryKey: ["contractors"],
    queryFn: () => listContractors(),
  });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["tender", tenderId] }),
      qc.invalidateQueries({ queryKey: ["submissions", tenderId] }),
      qc.invalidateQueries({ queryKey: ["review", tenderId] }),
      qc.invalidateQueries({ queryKey: ["invites", tenderId] }),
      qc.invalidateQueries({ queryKey: ["tenders"] }),
    ]);
  };

  const ai = useMutation({
    mutationFn: () => runAiReview({ data: tenderId }),
    onSuccess: async () => {
      toast.success("AI review ready");
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const close = useMutation({
    mutationFn: (status: "open" | "closed") => setTenderStatus({ data: { tenderId, status } }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });
  const award = useMutation({
    mutationFn: (submissionId: number) => awardSubmission({ data: { tenderId, submissionId } }),
    onSuccess: async () => {
      toast.success("Awarded");
      setOpenBid(null);
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const reject = useMutation({
    mutationFn: (submissionId: number) => rejectSubmission({ data: { tenderId, submissionId } }),
    onSuccess: async () => {
      toast.success("Rejected");
      setOpenBid(null);
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const invite = useMutation({
    mutationFn: () => inviteContractors({ data: { tenderId, userIds: inviteIds } }),
    onSuccess: async () => {
      setInviteIds([]);
      toast.success("Invites sent");
      await invalidate();
    },
  });

  if (tender.isPending) return <Skeleton className="h-64" />;
  const t = tender.data;
  if (!t) return <p className="text-muted">Tender not found.</p>;

  const rows = submissions.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={tenderBadge(t.status)}>{tenderLabel(t.status)}</Badge>
            <span className="text-xs text-subtle">{t.category}</span>
          </div>
          <h1 className="mt-2 font-display text-3xl">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t.description}</p>
          <p className="mt-2 text-xs text-subtle">Due {formatDate(t.dueAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.status === "open" && (
            <Button variant="secondary" onClick={() => close.mutate("closed")}>
              Close tender
            </Button>
          )}
          {t.status === "closed" && (
            <Button variant="secondary" onClick={() => close.mutate("open")}>
              Reopen
            </Button>
          )}
          <Button onClick={() => ai.mutate()} disabled={ai.isPending || rows.length === 0}>
            {ai.isPending ? "Reading sheets…" : "Run AI review"}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="returns">
        <TabsList>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="ai">AI review</TabsTrigger>
          <TabsTrigger value="sheet">Sheet</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
        </TabsList>

        <TabsContent value="returns">
          {submissions.isPending ? (
            <Skeleton className="h-40" />
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted">
                No sheets submitted yet. Load the sample tender from Overview if you want to try AI
                comparison immediately.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {rows.map((s) => {
                const score = scoreSubmission(t.schema, s.payload);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setOpenBid(s)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left hover:border-border-strong"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {s.companyName}
                          {s.isSample ? " · sample" : ""}
                        </p>
                        <p className="text-xs text-muted">
                          {score.complete ? "Complete" : `${score.missing.length} missing`} ·{" "}
                          {formatZar(score.priceTotal)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs tabular-nums text-muted">
                          {score.score}%
                        </span>
                        <Badge variant={submissionBadge(s.status, score.complete)}>
                          {submissionLabel(s.status)}
                        </Badge>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="ai">
          {review.isPending ? (
            <Skeleton className="h-40" />
          ) : review.data ? (
            <AiPanel result={review.data.result} />
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="font-display text-xl">No review yet</p>
                <p className="mt-2 text-sm text-muted">
                  AI reads completeness first, then compares price and quality across contractors.
                </p>
                <Button className="mt-4" onClick={() => ai.mutate()} disabled={ai.isPending || rows.length === 0}>
                  {ai.isPending ? "Reading sheets…" : "Run AI review"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sheet">
          <BidSheet schema={t.schema} payload={{ fields: {}, lineItems: t.schema.lineItems.map(() => ({})) }} readOnly />
        </TabsContent>

        <TabsContent value="invites">
          <div className="space-y-4">
            {(invites.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">No contractors invited yet. Open tenders are still visible to any contractor desk.</p>
            ) : (
              <ul className="space-y-2">
                {(invites.data ?? []).map((i) => (
                  <li key={i.contractor_user_id} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                    {i.company_name} · {i.contact_name}
                  </li>
                ))}
              </ul>
            )}
            {(contractors.data ?? []).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Add invites</p>
                {(contractors.data ?? []).map((c) => (
                  <label key={c.userId} className="flex h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={inviteIds.includes(c.userId)}
                      onChange={() =>
                        setInviteIds(
                          inviteIds.includes(c.userId)
                            ? inviteIds.filter((x) => x !== c.userId)
                            : [...inviteIds, c.userId],
                        )
                      }
                    />
                    {c.companyName}
                  </label>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={inviteIds.length === 0 || invite.isPending}
                  onClick={() => invite.mutate()}
                >
                  Send invites
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(openBid)} onOpenChange={(o) => !o && setOpenBid(null)}>
        <DialogContent className="max-h-[86vh] w-[min(92vw,880px)] overflow-y-auto">
          {openBid && (
            <>
              <DialogHeader>
                <DialogTitle>{openBid.companyName}</DialogTitle>
              </DialogHeader>
              <BidSheet schema={t.schema} payload={openBid.payload} readOnly />
              {openBid.status === "submitted" && t.status !== "awarded" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => award.mutate(openBid.id)} disabled={award.isPending}>
                    Award
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => reject.mutate(openBid.id)}
                    disabled={reject.isPending}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
