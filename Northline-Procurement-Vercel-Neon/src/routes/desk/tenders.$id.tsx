import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AiPanel } from "@/components/ai-panel";
import { BidSheet } from "@/components/bid-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rankBid, scoreSubmission, summarizeBid } from "@/lib/completeness";
import { getLatestReview, runAiReview } from "@/lib/server/ai";
import { listContractors } from "@/lib/server/profile";
import {
  awardSubmission,
  deleteTender,
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
  const navigate = useNavigate();
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
      qc.invalidateQueries({ queryKey: ["owner-submissions"] }),
      qc.invalidateQueries({ queryKey: ["suggested-winners"] }),
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
  const remove = useMutation({
    mutationFn: () => deleteTender({ data: tenderId }),
    onSuccess: async () => {
      toast.success("Tender revoked");
      await qc.invalidateQueries({ queryKey: ["tenders"] });
      await navigate({ to: "/desk/tenders" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = submissions.data ?? [];
  const schema = tender.data?.schema;
  const scored = useMemo(() => {
    if (!schema) return [];
    const payloads = rows.map((s) => s.payload);
    return rows.map((s) => {
      const score = scoreSubmission(schema, s.payload);
      const summary = summarizeBid(schema, s.payload);
      const rank = rankBid(schema, s.payload, payloads);
      return { sub: s, score, summary, rank };
    });
  }, [rows, schema]);
  const suggested = useMemo(() => {
    if (scored.length === 0) return null;
    return scored.reduce((best, cur) => (cur.rank.overall > best.rank.overall ? cur : best));
  }, [scored]);
  const lowestPrice = useMemo(() => {
    const withPrice = scored.filter((x) => x.summary.priceTotal != null);
    if (withPrice.length === 0) return null;
    return withPrice.reduce((best, cur) =>
      (cur.summary.priceTotal ?? Infinity) < (best.summary.priceTotal ?? Infinity) ? cur : best,
    );
  }, [scored]);

  if (tender.isPending) return <Skeleton className="h-64" />;
  const t = tender.data;
  if (!t) return <p className="text-muted">Tender not found.</p>;

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
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Revoke this tender? It will be removed for all contractors and submissions will be deleted.",
                )
              )
                remove.mutate();
            }}
          >
            <Trash2 />
            {remove.isPending ? "Revoking…" : "Revoke tender"}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="ai">AI review</TabsTrigger>
          <TabsTrigger value="sheet">Sheet</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {submissions.isPending ? (
            <Skeleton className="h-40" />
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted">
                No submissions yet. Companies that return a sheet appear here with cost and a short
                summary.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-ok/40 bg-surface p-4 md:p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-subtle">
                  Suggested company
                </p>
                {suggested ? (
                  <>
                    <p className="mt-2 font-display text-2xl">{suggested.sub.companyName}</p>
                    <p className="mt-1 text-sm text-muted">
                      Ranked on form quality, total price, and invoice-to-payment range
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-raised/60 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-subtle">Overall</p>
                        <p className="mt-1 font-display text-xl tabular-nums">{suggested.rank.overall}</p>
                      </div>
                      <div className="rounded-lg bg-raised/60 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-subtle">Quality</p>
                        <p className="mt-1 font-display text-xl tabular-nums">
                          {suggested.rank.qualityScore}
                        </p>
                      </div>
                      <div className="rounded-lg bg-raised/60 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-subtle">Price</p>
                        <p className="mt-1 font-display text-xl tabular-nums">{suggested.rank.priceScore}</p>
                      </div>
                      <div className="rounded-lg bg-raised/60 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-subtle">
                          Invoice → pay
                        </p>
                        <p className="mt-1 font-display text-xl tabular-nums">
                          {suggested.rank.paymentScore}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                      <span className="rounded-full bg-raised px-3 py-1 tabular-nums">
                        {formatZar(suggested.summary.priceTotal)}
                      </span>
                      <span className="rounded-full bg-raised px-3 py-1">
                        {suggested.summary.paymentTerms}
                      </span>
                      <span className="rounded-full bg-raised px-3 py-1">
                        Quality fit {suggested.summary.qualityFit}% —{" "}
                        {suggested.summary.qualityFitLabel}
                      </span>
                      {suggested.summary.leadDaysAvg != null && (
                        <span className="rounded-full bg-raised px-3 py-1">
                          Lead ~{suggested.summary.leadDaysAvg} days
                        </span>
                      )}
                      <Button
                        size="sm"
                        className="ml-auto"
                        onClick={() => setOpenBid(suggested.sub)}
                      >
                        View full form
                      </Button>
                      {suggested.sub.status === "submitted" && t.status !== "awarded" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={award.isPending}
                          onClick={() => award.mutate(suggested.sub.id)}
                        >
                          Choose
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">Need at least one submission to rank.</p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-subtle">Submissions</p>
                  <p className="mt-2 font-display text-3xl tabular-nums">{rows.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-subtle">Complete sheets</p>
                  <p className="mt-2 font-display text-3xl tabular-nums">
                    {scored.filter((x) => x.score.complete).length}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-subtle">Lowest price</p>
                  <p className="mt-2 font-display text-lg">
                    {lowestPrice
                      ? `${lowestPrice.sub.companyName} · ${formatZar(lowestPrice.summary.priceTotal)}`
                      : "—"}
                  </p>
                </div>
              </div>

              <div>
                <h2 className="mb-3 font-display text-xl">Companies that submitted</h2>
                <p className="mb-3 text-sm text-muted">
                  Summary and cost below. Use <strong>View full form</strong> to see every field
                  they filled in.
                </p>
                <ul className="space-y-3">
                  {scored
                    .slice()
                    .sort((a, b) => b.rank.overall - a.rank.overall)
                    .map(({ sub: s, score, summary, rank }) => {
                      const isSuggested = suggested?.sub.id === s.id;
                      return (
                        <li
                          key={s.id}
                          className={`rounded-xl border px-4 py-4 ${
                            isSuggested ? "border-ok bg-surface" : "border-border bg-surface"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">
                                {s.companyName}
                                {isSuggested ? " · suggested" : ""}
                                {s.isSample ? " · sample" : ""}
                              </p>
                              <p className="mt-1 text-sm text-muted">
                                {summary.complete
                                  ? "Form complete"
                                  : `${score.missing.length} fields missing`}
                                {" · "}
                                {summary.paymentTerms}
                                {summary.paymentDays != null
                                  ? ` (~${summary.paymentDays}d invoice→pay)`
                                  : ""}
                                {" · score "}
                                {rank.overall}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display text-lg tabular-nums">
                                {formatZar(summary.priceTotal)}
                              </span>
                              <Badge variant={submissionBadge(s.status, score.complete)}>
                                {submissionLabel(s.status)}
                              </Badge>
                            </div>
                          </div>
                          <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
                            <div>
                              <dt className="text-subtle">Total cost</dt>
                              <dd className="mt-0.5 font-medium text-fg tabular-nums">
                                {formatZar(summary.priceTotal)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-subtle">Payment (invoice → pay)</dt>
                              <dd className="mt-0.5 text-fg">
                                {summary.paymentTerms}
                                {summary.paymentDays != null
                                  ? ` · ~${summary.paymentDays}d`
                                  : ""}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-subtle">Quality vs your requirements</dt>
                              <dd className="mt-0.5 text-fg">
                                {summary.qualityFit}% · {summary.qualityFitLabel}
                              </dd>
                            </div>
                          </dl>
                          {summary.filledSummary.length > 0 && (
                            <ul className="mt-2 space-y-0.5 text-xs text-muted">
                              {summary.filledSummary.slice(0, 3).map((line) => (
                                <li key={line} className="line-clamp-1">
                                  · {line}
                                </li>
                              ))}
                            </ul>
                          )}
                          {summary.qualityGaps.length > 0 && (
                            <p className="mt-1 line-clamp-2 text-xs text-danger">
                              Gaps: {summary.qualityGaps.slice(0, 2).join("; ")}
                            </p>
                          )}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button type="button" size="sm" onClick={() => setOpenBid(s)}>
                              View full form
                            </Button>
                            {s.status === "submitted" && t.status !== "awarded" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => award.mutate(s.id)}
                                disabled={award.isPending}
                              >
                                Choose
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            </div>
          )}
        </TabsContent>

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
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {score.score}%
                      </span>
                      <Badge variant={submissionBadge(s.status, score.complete)}>
                        {submissionLabel(s.status)}
                      </Badge>
                      <Button type="button" size="sm" onClick={() => setOpenBid(s)}>
                        View full form
                      </Button>
                    </div>
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
                <Button
                  className="mt-4"
                  onClick={() => ai.mutate()}
                  disabled={ai.isPending || rows.length === 0}
                >
                  {ai.isPending ? "Reading sheets…" : "Run AI review"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sheet">
          <BidSheet
            schema={t.schema}
            payload={{ fields: {}, lineItems: t.schema.lineItems.map(() => ({})) }}
            readOnly
          />
        </TabsContent>

        <TabsContent value="invites">
          <div className="space-y-4">
            {(invites.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">
                No contractors invited yet. Open tenders are still visible to any contractor desk.
              </p>
            ) : (
              <ul className="space-y-2">
                {(invites.data ?? []).map((i) => (
                  <li
                    key={i.contractor_user_id}
                    className="rounded-lg border border-border bg-surface px-4 py-3 text-sm"
                  >
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
        <DialogContent className="max-h-[90vh] w-[min(96vw,960px)] max-w-[960px] overflow-y-auto">
          {openBid && (
            <>
              <DialogHeader>
                <DialogTitle>{openBid.companyName} — full form</DialogTitle>
              </DialogHeader>
              <p className="mb-4 text-sm text-muted">
                Everything this contractor filled in for this tender.
              </p>
              <BidSheet schema={t.schema} payload={openBid.payload} readOnly />
              {openBid.status === "submitted" && t.status !== "awarded" && (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
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
