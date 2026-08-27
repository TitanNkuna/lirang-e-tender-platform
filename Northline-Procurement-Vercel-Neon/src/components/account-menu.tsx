import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, LogOut, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authEnabled, signOut } from "@/lib/auth/client";
import { saveProfile } from "@/lib/server/profile";
import type { Profile, Role } from "@/lib/types";
import { initials } from "@/lib/utils";

export function AccountMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const [role, setRole] = useState<Role>(profile.role);
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [contactName, setContactName] = useState(profile.contactName);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [address, setAddress] = useState(profile.address);
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl ?? "");

  useEffect(() => {
    setRole(profile.role);
    setCompanyName(profile.companyName);
    setContactName(profile.contactName);
    setPhone(profile.phone);
    setEmail(profile.email);
    setAddress(profile.address);
    setLogoUrl(profile.logoUrl ?? "");
  }, [profile]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const save = useMutation({
    mutationFn: () =>
      saveProfile({
        data: { role, companyName, contactName, phone, email, address, logoUrl },
      }),
    onSuccess: async () => {
      toast.success("Company profile saved");
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onLogoFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 280_000) {
      toast.error("Image must be under 280KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result.startsWith("data:image/")) {
        toast.error("Could not read image");
        return;
      }
      setLogoUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const avatar = logoUrl || null;
  const letter = initials(companyName || contactName || "C");

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Company profile"
        aria-expanded={open}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-9 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-raised text-sm font-medium">
            {letter}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,22rem)] rounded-xl border border-border bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg leading-tight">Company profile</p>
              <p className="mt-0.5 text-xs text-muted">Required for verification</p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-muted hover:bg-raised hover:text-fg"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className="relative">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="size-16 rounded-full border border-border object-cover"
                />
              ) : (
                <span className="grid size-16 place-items-center rounded-full bg-raised text-lg font-medium">
                  {letter}
                </span>
              )}
              <button
                type="button"
                className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border border-border bg-surface shadow"
                onClick={() => fileRef.current?.click()}
                aria-label="Upload logo"
              >
                <Camera className="size-3.5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onLogoFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{companyName || "Your company"}</p>
              <p className="truncate text-xs text-muted">{contactName || "Contact"}</p>
              {logoUrl && (
                <button
                  type="button"
                  className="mt-1 text-xs text-muted underline-offset-2 hover:underline"
                  onClick={() => setLogoUrl("")}
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={role === "procurement" ? "default" : "secondary"}
                onClick={() => setRole("procurement")}
              >
                Procurement
              </Button>
              <Button
                type="button"
                size="sm"
                variant={role === "contractor" ? "default" : "secondary"}
                onClick={() => setRole("contractor")}
              >
                Contractor
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor="am-company">Company *</Label>
              <Input
                id="am-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="am-contact">Contact *</Label>
              <Input
                id="am-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="am-phone">Phone *</Label>
              <Input
                id="am-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                minLength={7}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="am-email">Email *</Label>
              <Input
                id="am-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="am-address">Address *</Label>
              <Textarea
                id="am-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                required
                minLength={5}
              />
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save profile"}
            </Button>
          </form>

          {authEnabled && (
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-muted hover:bg-raised hover:text-fg"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
