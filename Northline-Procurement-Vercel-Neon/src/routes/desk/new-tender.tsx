import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TemplateEditor } from "@/components/template-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { blankSchema } from "@/lib/csv";
import { PRESETS } from "@/lib/presets";
import { listContractors } from "@/lib/server/profile";
import { listTemplates } from "@/lib/server/templates";
import { createTender } from "@/lib/server/tenders";
import type { TemplateSchema, TenderVisibility } from "@/lib/types";

export const Route = createFileRoute("/desk/new-tender")({ component: NewTender });

function NewTender() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => listTemplates() });
  const contractors = useQuery({ queryKey: ["contractors"], queryFn: () => listContractors() });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [dueAt, setDueAt] = useState("");
  const [visibility, setVisibility] = useState<TenderVisibility>("open");
  const [schema, setSchema] = useState<TemplateSchema>(blankSchema());
  const [invites, setInvites] = useState<string[]>([]);
  const [source, setSource] = useState("blank");

  const options = useMemo(() => {
    const presets = PRESETS.map((p) => ({ id: `preset:${p.key}`, label: `Preset · ${p.name}` }));
    const saved = (templates.data ?? []).map((t) => ({
      id: `tpl:${t.id}`,
      label: `Saved · ${t.name}`,
    }));
    return [{ id: "blank", label: "Blank sheet" }, ...presets, ...saved];
  }, [templates.data]);

  function applySource(value: string) {
    setSource(value);
    if (value === "blank") {
      setSchema(blankSchema());
      return;
    }
    if (value.startsWith("preset:")) {
      const preset = PRESETS.find((p) => p.key === value.slice(7));
      if (preset) {
        setSchema(preset.schema);
        setCategory(preset.category);
        if (!title) setTitle(preset.name);
        if (!description) setDescription(preset.description);
      }
      return;
    }
    if (value.startsWith("tpl:")) {
      const tpl = (templates.data ?? []).find((t) => t.id === Number(value.slice(4)));
      if (tpl) {
        setSchema(tpl.schema);
        setCategory(tpl.category);
        if (!title) setTitle(tpl.name);
        if (!description) setDescription(tpl.description);
      }
    }
  }

  const publish = useMutation({
    mutationFn: () =>
      createTender({
        data: {
          title,
          description,
          category,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          visibility,
          schema,
          templateId: source.startsWith("tpl:") ? Number(source.slice(4)) : null,
          inviteUserIds: invites,
        },
      }),
    onSuccess: async (res) => {
      toast.success("Tender issued");
      await qc.invalidateQueries({ queryKey: ["tenders"] });
      await navigate({ to: "/desk/tenders/$id", params: { id: String(res.id) } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        publish.mutate();
      }}
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Issue</p>
          <h1 className="mt-1 font-display text-3xl">New tender</h1>
        </div>
        <Button type="submit" disabled={publish.isPending}>
          {publish.isPending ? "Issuing…" : "Issue to contractors"}
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="desc">Cover note</Label>
          <Textarea
            id="desc"
            className="min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source">Start from</Label>
          <Select id="source" value={source} onChange={(e) => applySource(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due">Due date</Label>
          <Input id="due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vis">Visibility</Label>
          <Select
            id="vis"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as TenderVisibility)}
          >
            <option value="open">Open — any signed-in contractor</option>
            <option value="invite_only">Invite only</option>
          </Select>
        </div>
      </section>

      {(contractors.data ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl">Invite contractors</h2>
          <ul className="space-y-2">
            {(contractors.data ?? []).map((c) => {
              const checked = invites.includes(c.userId);
              return (
                <li key={c.userId}>
                  <label className="flex h-11 items-center gap-3 rounded-lg border border-border bg-surface px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setInvites(
                          checked ? invites.filter((id) => id !== c.userId) : [...invites, c.userId],
                        )
                      }
                    />
                    <span className="font-medium">{c.companyName}</span>
                    <span className="text-muted">{c.contactName}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <TemplateEditor
        name={title}
        description={description}
        category={category}
        schema={schema}
        onName={setTitle}
        onDescription={setDescription}
        onCategory={setCategory}
        onSchema={setSchema}
      />
    </form>
  );
}
