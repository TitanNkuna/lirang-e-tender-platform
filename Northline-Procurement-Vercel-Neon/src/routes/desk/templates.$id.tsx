import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TemplateEditor } from "@/components/template-editor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { blankSchema } from "@/lib/csv";
import { getTemplate, saveTemplate } from "@/lib/server/templates";
import type { TemplateSchema } from "@/lib/types";

export const Route = createFileRoute("/desk/templates/$id")({
  component: TemplateDetail,
});

function TemplateDetail() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const existing = useQuery({
    queryKey: ["template", id],
    queryFn: () => getTemplate({ data: Number(id) }),
    enabled: !isNew,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [schema, setSchema] = useState<TemplateSchema>(blankSchema());
  const [hydrated, setHydrated] = useState(isNew);

  useEffect(() => {
    if (existing.data) {
      setName(existing.data.name);
      setDescription(existing.data.description);
      setCategory(existing.data.category);
      setSchema(existing.data.schema);
      setHydrated(true);
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: () =>
      saveTemplate({
        data: {
          id: isNew ? undefined : Number(id),
          name,
          description,
          category,
          schema,
        },
      }),
    onSuccess: async (res) => {
      toast.success("Template saved");
      await qc.invalidateQueries({ queryKey: ["templates"] });
      if (isNew) await navigate({ to: "/desk/templates/$id", params: { id: String(res.id) } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isNew && existing.isPending) return <Skeleton className="h-64" />;
  if (!isNew && existing.data === null) {
    return <p className="text-muted">Template not found.</p>;
  }
  if (!hydrated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Template</p>
          <h1 className="mt-1 font-display text-3xl">{isNew ? "New template" : name || "Template"}</h1>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save template"}
        </Button>
      </header>
      <TemplateEditor
        name={name}
        description={description}
        category={category}
        schema={schema}
        onName={setName}
        onDescription={setDescription}
        onCategory={setCategory}
        onSchema={setSchema}
      />
    </div>
  );
}
