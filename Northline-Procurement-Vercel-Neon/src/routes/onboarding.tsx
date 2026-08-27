import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Wordmark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile, saveProfile } from "@/lib/server/profile";
import type { Role } from "@/lib/types";

type Search = { intent?: Role };

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    intent:
      search.intent === "contractor" || search.intent === "procurement"
        ? search.intent
        : undefined,
  }),
  component: Onboarding,
});

function Onboarding() {
  const { intent } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const current = useCurrentUser();
  const navigate = useNavigate();
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const [role, setRole] = useState<Role>(intent ?? "procurement");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState(current?.displayName ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => saveProfile({ data: { role, companyName, contactName } }),
    onSuccess: () => navigate({ to: "/desk" }),
    onError: (err: Error) => setError(err.message),
  });

  if (isPending || (user && profileQuery.isPending)) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="h-10 w-48 animate-pulse rounded-sm bg-raised" />
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (profileQuery.data) return <Navigate to="/desk" />;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-12">
      <Wordmark />
      <h1 className="mt-10 font-display text-4xl">Which desk is yours?</h1>
      <p className="mt-2 text-muted">
        Procurement issues the template. Contractors fill it. You can switch later
        in settings.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <RoleCard
          active={role === "procurement"}
          title="Procurement"
          body="Upload templates, send tenders, read returns, run AI comparison."
          onClick={() => setRole("procurement")}
        />
        <RoleCard
          active={role === "contractor"}
          title="Contractor"
          body="See tenders sent to you, fill the sheet, submit your prices."
          onClick={() => setRole("contractor")}
        />
      </div>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="company">Company name</Label>
          <Input
            id="company"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Northline Projects"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact">Your name</Label>
          <Input
            id="contact"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Opening desk…" : "Enter desk"}
        </Button>
      </form>
    </main>
  );
}

function RoleCard({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-5 text-left transition-colors ${
        active ? "border-accent bg-raised" : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <p className="font-display text-xl">{title}</p>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </button>
  );
}
