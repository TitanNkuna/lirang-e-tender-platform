import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteTemplate, listTemplates, saveTemplate } from "@/lib/server/templates";
import { PRESETS } from "@/lib/presets";

export const Route = createFileRoute("/desk/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["templates"], queryFn: () => listTemplates() });
  const createPreset = useMutation({
    mutationFn: (key: string) => {
      const preset = PRESETS.find((p) => p.key === key);
      if (!preset) throw new Error("Unknown preset.");
      return saveTemplate({
        data: {
          name: preset.name,
          description: preset.description,
          category: preset.category,
          schema: preset.schema,
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteTemplate({ data: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Library</p>
          <h1 className="mt-1 font-display text-3xl">Templates</h1>
        </div>
        <Button asChild>
          <Link to="/desk/templates/$id" params={{ id: "new" }}>
            <Plus />
            New template
          </Link>
        </Button>
      </header>

      <section>
        <h2 className="mb-3 font-display text-xl">Start from a preset</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => createPreset.mutate(p.key)}
              className="rounded-xl border border-border bg-surface p-4 text-left hover:border-border-strong"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-subtle">{p.category}</p>
              <p className="mt-2 font-display text-lg">{p.name}</p>
              <p className="mt-1 text-sm text-muted">{p.description}</p>
            </button>
          ))}
        </div>
      </section>

      {list.isPending ? (
        <Skeleton className="h-40" />
      ) : (list.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            No saved templates yet. Import a CSV or use a preset.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {(list.data ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <Link
                to="/desk/templates/$id"
                params={{ id: String(t.id) }}
                className="min-w-0 flex-1"
              >
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-xs text-muted">
                  {t.category} · {t.schema.lineItems.length} line items
                </p>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove.mutate(t.id)}
                aria-label="Delete template"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
