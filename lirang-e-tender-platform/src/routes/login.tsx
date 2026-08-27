import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Wordmark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type Search = { intent?: "procurement" | "contractor" };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    intent:
      search.intent === "contractor" || search.intent === "procurement"
        ? search.intent
        : undefined,
  }),
  component: Login,
});

function Login() {
  const { intent } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isPending && user) return <Navigate to="/onboarding" search={{ intent }} />;

  const callbackURL = intent ? `/onboarding?intent=${intent}` : "/onboarding";

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.split("@")[0],
              callbackURL,
            })
          : await authClient.signIn.email({
              email: email.trim(),
              password,
              callbackURL,
            });

      if (result.error) throw new Error(result.error.message ?? "Authentication failed.");
      window.location.href = callbackURL;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-surface md:block">
        <div className="ledger-grid absolute inset-0 opacity-60" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/"><Wordmark /></Link>
          <div>
            <p className="font-display text-4xl leading-tight">
              Lirang e-Tender — from request to award.
            </p>
            <p className="mt-4 max-w-sm text-sm text-muted">
              {intent === "contractor"
                ? "Complete and submit tender sheets as a contractor."
                : "Issue templates, compare returns and manage awards as a buyer."}
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden"><Wordmark /></div>
          <div>
            <h1 className="font-display text-3xl">{mode === "in" ? "Sign in" : "Create account"}</h1>
            <p className="mt-1 text-sm text-muted">
              Secure email and password authentication.
            </p>
          </div>

          <form className="space-y-3" onSubmit={onEmail}>
            {mode === "up" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            className="text-sm text-muted hover:text-fg"
            onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); }}
          >
            {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}
