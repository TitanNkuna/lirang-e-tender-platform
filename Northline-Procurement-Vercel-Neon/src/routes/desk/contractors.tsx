import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listContractors } from "@/lib/server/profile";
import { initials } from "@/lib/utils";

export const Route = createFileRoute("/desk/contractors")({
  component: ContractorsPage,
});

function ContractorsPage() {
  const list = useQuery({ queryKey: ["contractors"], queryFn: () => listContractors() });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Directory</p>
        <h1 className="mt-1 font-display text-3xl">Contractors</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Anyone who signs in on the contractor desk appears here. Invite them from a tender.
        </p>
      </header>
      {list.isPending ? (
        <Skeleton className="h-40" />
      ) : (list.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            No contractor accounts yet. Ask suppliers to sign in and choose the contractor desk —
            or load a sample tender to review three comparison bids without waiting.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(list.data ?? []).map((c) => (
            <li key={c.userId} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
              <span className="grid size-11 place-items-center rounded-full bg-raised text-sm font-medium">
                {initials(c.companyName)}
              </span>
              <div>
                <p className="font-medium">{c.companyName}</p>
                <p className="text-sm text-muted">{c.contactName || "—"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
