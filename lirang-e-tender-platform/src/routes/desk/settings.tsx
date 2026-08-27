import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMyProfile, saveProfile } from "@/lib/server/profile";
import { isProfileComplete, type Role } from "@/lib/types";

export const Route = createFileRoute("/desk/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const [role, setRole] = useState<Role>("procurement");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (profile.data) {
      setRole(profile.data.role);
      setCompanyName(profile.data.companyName);
      setContactName(profile.data.contactName);
      setPhone(profile.data.phone ?? "");
      setEmail(profile.data.email ?? "");
      setAddress(profile.data.address ?? "");
    }
  }, [profile.data]);

  const incomplete = profile.data ? !isProfileComplete(profile.data) : true;

  const save = useMutation({
    mutationFn: () =>
      saveProfile({ data: { role, companyName, contactName, phone, email, address } }),
    onSuccess: async () => {
      toast.success("Company profile saved");
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await navigate({ to: "/desk" });
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
        <h1 className="mt-1 font-display text-3xl">Company profile</h1>
        <p className="mt-2 text-sm text-muted">
          Required for all accounts. Used so the other desk can call or email to verify.
        </p>
        {incomplete && (
          <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            Complete every field below to use the desk.
          </p>
        )}
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
        <Label htmlFor="company">Company name *</Label>
        <Input
          id="company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          minLength={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact">Contact name *</Label>
        <Input
          id="contact"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          required
          minLength={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone *</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+27 …"
          required
          minLength={7}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.co.za"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address">Address *</Label>
        <Textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          placeholder="Physical or registered address"
          required
          minLength={5}
        />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full">
        {save.isPending ? "Saving…" : "Save company profile"}
      </Button>
    </form>
  );
}
