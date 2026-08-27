import { Plus, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addLineItem, newField, parseCsvToSchema } from "@/lib/csv";
import { CATEGORIES, type FieldType, type FilledBy, type LineItemColumn, type TemplateSchema } from "@/lib/types";
import { uid } from "@/lib/utils";

export function TemplateEditor({
  name, description, category, schema, onName, onDescription, onCategory, onSchema,
}: {
  name: string; description: string; category: string; schema: TemplateSchema;
  onName: (v: string) => void; onDescription: (v: string) => void;
  onCategory: (v: string) => void; onSchema: (v: TemplateSchema) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    const text = await file.text();
    onSchema(parseCsvToSchema(text));
    if (!name) onName(file.name.replace(/\.[^.]+$/, ""));
  }

  function updateField(index: number, patch: Partial<TemplateSchema["fields"][number]>) {
    const fields = schema.fields.slice();
    fields[index] = { ...fields[index], ...patch };
    onSchema({ ...schema, fields });
  }

  function updateColumn(index: number, patch: Partial<LineItemColumn>) {
    const columns = schema.lineItemColumns.slice();
    const oldId = columns[index].id;
    const next = { ...columns[index], ...patch };
    columns[index] = next;
    let lineItems = schema.lineItems;
    if (next.id !== oldId) {
      lineItems = lineItems.map((row) => {
        const copy = { ...row };
        if (oldId in copy) {
          copy[next.id] = copy[oldId];
          delete copy[oldId];
        }
        return copy;
      });
    }
    onSchema({ ...schema, lineItemColumns: columns, lineItems });
  }

  function removeColumn(index: number) {
    const column = schema.lineItemColumns[index];
    const lineItemColumns = schema.lineItemColumns.filter((_, i) => i !== index);
    const lineItems = schema.lineItems.map((row) => {
      const copy = { ...row };
      delete copy[column.id];
      return copy;
    });
    onSchema({ ...schema, lineItemColumns, lineItems });
  }

  function addColumn() {
    const column: LineItemColumn = {
      id: uid("col"),
      label: "New column",
      type: "text",
      required: false,
      filledBy: "contractor",
    };
    onSchema({ ...schema, lineItemColumns: [...schema.lineItemColumns, column] });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tname">Template name</Label>
          <Input id="tname" value={name} onChange={(e) => onName(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tdesc">Description</Label>
          <Textarea id="tdesc" className="min-h-20" value={description} onChange={(e) => onDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tcat">Category</Label>
          <Select id="tcat" value={category} onChange={(e) => onCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Import line items</Label>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file); e.target.value = ""; }} />
          <Button type="button" variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
            <Upload /> Import CSV
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">Contractor questions</h3>
            <p className="text-xs text-muted">Every field is editable, including type, required status, owner and help text.</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => onSchema({ ...schema, fields: [...schema.fields, newField()] })}><Plus /> Add</Button>
        </div>
        <div className="space-y-3">
          {schema.fields.map((field, index) => (
            <div key={field.id} className="space-y-3 rounded-lg border border-border bg-surface p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px_auto]">
                <Input value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} placeholder="Question / field label" />
                <Select value={field.type} onChange={(e) => updateField(index, { type: e.target.value as FieldType })}>
                  <option value="text">Text</option><option value="textarea">Long text</option><option value="number">Number</option>
                  <option value="currency">Currency</option><option value="select">Select</option><option value="date">Date</option>
                </Select>
                <Select value={field.filledBy} onChange={(e) => updateField(index, { filledBy: e.target.value as FilledBy })}>
                  <option value="contractor">Contractor fills</option><option value="issuer">Issuer fills</option>
                </Select>
                <Button type="button" size="icon" variant="ghost" onClick={() => onSchema({ ...schema, fields: schema.fields.filter((f) => f.id !== field.id) })} aria-label="Delete field"><Trash2 /></Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={field.help ?? ""} onChange={(e) => updateField(index, { help: e.target.value })} placeholder="Help / instructions (optional)" />
                <Input
                  value={field.options?.join(", ") ?? ""}
                  disabled={field.type !== "select"}
                  onChange={(e) => updateField(index, { options: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
                  placeholder="Select options, comma separated"
                />
                <label className="flex h-10 items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} /> Required
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">Line-item columns</h3>
            <p className="text-xs text-muted">Define which columns the issuer and contractor see and who fills each one.</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={addColumn}><Plus /> Column</Button>
        </div>
        <div className="space-y-2">
          {schema.lineItemColumns.map((column, index) => (
            <div key={column.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_130px_150px_auto]">
              <Input value={column.label} onChange={(e) => updateColumn(index, { label: e.target.value })} placeholder="Column label" />
              <Select value={column.type} onChange={(e) => updateColumn(index, { type: e.target.value as LineItemColumn["type"] })}>
                <option value="text">Text</option><option value="number">Number</option><option value="currency">Currency</option>
              </Select>
              <Select value={column.filledBy} onChange={(e) => updateColumn(index, { filledBy: e.target.value as FilledBy })}>
                <option value="issuer">Issuer fills</option><option value="contractor">Contractor fills</option>
              </Select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted"><input type="checkbox" checked={column.required} onChange={(e) => updateColumn(index, { required: e.target.checked })} /> Required</label>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeColumn(index)} aria-label="Delete column"><Trash2 /></Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">Example / issuer rows</h3>
            <p className="text-xs text-muted">These rows become the tender's starting sheet. Contractor-only columns are completed by bidders.</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => onSchema(addLineItem(schema))}><Plus /> Row</Button>
        </div>
        <div className="-mx-4 overflow-x-auto md:mx-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead><tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-subtle">
              {schema.lineItemColumns.filter((c) => c.filledBy === "issuer").map((c) => <th key={c.id} className="px-2 py-2 text-left font-medium">{c.label}</th>)}
              <th className="w-12" />
            </tr></thead>
            <tbody>
              {schema.lineItems.map((row, index) => (
                <tr key={index} className="border-b border-border">
                  {schema.lineItemColumns.filter((c) => c.filledBy === "issuer").map((c) => (
                    <td key={c.id} className="px-2 py-2">
                      <Input className="h-10" type={c.type === "text" ? "text" : "number"} value={row[c.id] ?? ""}
                        onChange={(e) => {
                          const lineItems = schema.lineItems.slice();
                          lineItems[index] = { ...row, [c.id]: c.type === "text" ? e.target.value : e.target.value === "" ? "" : Number(e.target.value) };
                          onSchema({ ...schema, lineItems });
                        }} />
                    </td>
                  ))}
                  <td className="px-2 py-2"><Button type="button" size="icon" variant="ghost" onClick={() => onSchema({ ...schema, lineItems: schema.lineItems.filter((_, i) => i !== index) })} aria-label="Delete row"><Trash2 /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
