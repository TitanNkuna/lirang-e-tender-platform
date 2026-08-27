import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BidSheet } from "@/components/bid-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listContractors } from "@/lib/server/profile";
import { listOwnerSubmissions } from "@/lib/server/submissions";
import { submissionBadge, submissionLabel } from "@/lib/status";
import { formatDate, initials } from "@/lib/utils";

export const Route = createFileRoute("/desk/contractors")({
  component: ContractorsPage,
});

type OwnerSub = Awaited<ReturnType<typeof listOwnerSubmissions>>[number];

function ContractorsPage() {
  const list = useQuery({ queryKey: ["contractors"], queryFn: () => listContractors() });
  const submissions = useQuery({
    queryKey: ["owner-submissions"],
    queryFn: () => listOwnerSubmissions(),
  });
  const [open, setOpen] = useState<OwnerSub | null>(null);

  const byCompany = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        companyName: string;
        contactName: string;
        phone: string;
        email: string;
        address: string;
        logoUrl: string;
        rows: OwnerSub[];
      }
    >();
    for (const s of submissions.data ?? []) {
      const key = s.contractorUserId || s.companyName;
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(s);
      } else {
        map.set(key, {
          key,
          companyName: s.companyName,
          contactName: s.contactName,
          phone: s.phone,
          email: s.email,
          address: s.address,
          logoUrl: s.logoUrl,
          rows: [s],
        });
      }
    }
    return [...map.values()].sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [submissions.data]);

  const directory = list.data ?? [];
  const directoryWithoutSubs = directory.filter(
    (c) => !(submissions.data ?? []).some((s) => s.contractorUserId === c.userId),
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Directory</p>
        <h1 className="mt-1 font-display text-3xl">Contractors</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Companies that submitted on your tenders, plus the full directory. Open a form to review
          what they filled in.
        </p>
      </header>

      <section>
        <h2 className="mb-3 font-display text-xl">Submitted on your tenders</h2>
        {submissions.isPending ? (
          <Skeleton className="h-40" />
        ) : byCompany.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted">
              No submissions yet. When a contractor returns a sheet, they appear here with a full
              form view.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-4">
            {byCompany.map((co) => (
              <li key={co.key} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start gap-3">
                  {co.logoUrl ? (
                    <img
                      src={co.logoUrl}
                      alt=""
                      className="size-11 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <span className="grid size-11 place-items-center rounded-full bg-raised text-sm font-medium">
                      {initials(co.companyName)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{co.companyName}</p>
                    <p className="text-sm text-muted">{co.contactName || "—"}</p>
                    <dl className="mt-2 space-y-0.5 text-xs text-muted">
                      {co.phone && (
                        <div>
                          <span className="text-subtle">Phone · </span>
                          <a href={`tel:${co.phone}`} className="text-fg hover:underline">
                            {co.phone}
                          </a>
                        </div>
                      )}
                      {co.email && (
                        <div>
                          <span className="text-subtle">Email · </span>
                          <a href={`mailto:${co.email}`} className="text-fg hover:underline">
                            {co.email}
                          </a>
                        </div>
                      )}
                      {co.address && (
                        <div>
                          <span className="text-subtle">Address · </span>
                          {co.address}
                        </div>
                      )}
                    </dl>
                  </div>
                  <Badge variant="default">{co.rows.length} sheet(s)</Badge>
                </div>

                <ul className="mt-4 space-y-2 border-t border-border pt-3">
                  {co.rows.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-raised/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.tenderTitle}</p>
                        <p className="text-xs text-muted">
                          {s.submittedAt ? formatDate(s.submittedAt) : "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={submissionBadge(s.status as "submitted", true)}>
                          {submissionLabel(s.status as "submitted")}
                        </Badge>
                        <Button type="button" size="sm" onClick={() => setOpen(s)}>
                          View full form
                        </Button>
                        <Button type="button" size="sm" variant="secondary" asChild>
                          <Link to="/desk/tenders/$id" params={{ id: String(s.tenderId) }}>
                            Open tender
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {directoryWithoutSubs.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl">All contractor profiles</h2>
          <p className="mb-3 text-sm text-muted">
            Registered contractors who have not submitted on your tenders yet.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {directoryWithoutSubs.map((c) => (
              <li key={c.userId} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-raised text-sm font-medium">
                    {initials(c.companyName)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{c.companyName}</p>
                    <p className="text-sm text-muted">{c.contactName || "—"}</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 text-xs text-muted">
                  {c.phone && (
                    <div>
                      <span className="text-subtle">Phone · </span>
                      <a href={`tel:${c.phone}`} className="text-fg hover:underline">
                        {c.phone}
                      </a>
                    </div>
                  )}
                  {c.email && (
                    <div>
                      <span className="text-subtle">Email · </span>
                      <a href={`mailto:${c.email}`} className="text-fg hover:underline">
                        {c.email}
                      </a>
                    </div>
                  )}
                  {c.address && (
                    <div>
                      <span className="text-subtle">Address · </span>
                      {c.address}
                    </div>
                  )}
                  {!c.phone && !c.email && !c.address && (
                    <p className="text-subtle">No contact details on profile yet.</p>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] w-[min(96vw,960px)] max-w-[960px] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {open.companyName} — {open.tenderTitle}
                </DialogTitle>
              </DialogHeader>
              <p className="mb-4 text-sm text-muted">
                Full form as submitted. To edit values, open the tender and use{" "}
                <strong>Edit form</strong> on the submission.
              </p>
              <BidSheet schema={open.schema} payload={open.payload} readOnly />
              <div className="mt-4">
                <Button type="button" variant="secondary" asChild>
                  <Link to="/desk/tenders/$id" params={{ id: String(open.tenderId) }}>
                    Open tender to edit
                  </Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
