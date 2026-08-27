import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyProfile, saveProfile } from "@/lib/server/profile";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/desk/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const [role, setRole] = useState<Role>("procurement");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");

  useEffect(() => {
    if (profile.data) {
      setRole(profile.data.role);
      setCompanyName(profile.data.companyName);
      setContactName(profile.data.contactName);
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => saveProfile({ data: { role, companyName, contactName } }),
    onSuccess: async () => {
      toast.success("Saved");
      await qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form
      className="mx-auto max-w-lg space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Account</p>
        <h1 className="mt-1 font-display text-3xl">Settings</h1>
      </header>
      <div className="space-y-1.5">
        <Label>Desk</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={role === "procurement" ? "default" : "secondary"}
            onClick={() => setRole("procurement")}
          >
            Procurement
          </Button>
          <Button
            type="button"
            variant={role === "contractor" ? "default" : "secondary"}
            onClick={() => setRole("contractor")}
          >
            Contractor
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact">Your name</Label>
        <Input id="contact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </div>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
