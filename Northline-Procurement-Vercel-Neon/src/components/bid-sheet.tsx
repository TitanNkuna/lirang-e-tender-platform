import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BidPayload, LineItem, TemplateField, TemplateSchema } from "@/lib/types";
import { formatZar } from "@/lib/utils";

export function BidSheet({
  schema,
  payload,
  onChange,
  readOnly,
}: {
  schema: TemplateSchema;
  payload: BidPayload;
  onChange?: (next: BidPayload) => void;
  readOnly?: boolean;
}) {
  const contractorFields = schema.fields.filter((f) => f.filledBy === "contractor");
  const issuerCols = schema.lineItemColumns.filter((c) => c.filledBy === "issuer");
  const contractorCols = schema.lineItemColumns.filter((c) => c.filledBy === "contractor");

  function setField(id: string, value: string | number) {
    if (!onChange) return;
    onChange({ ...payload, fields: { ...payload.fields, [id]: value } });
  }

  function setCell(row: number, id: string, value: string | number) {
    if (!onChange) return;
    const lineItems = schema.lineItems.map((_, i) => payload.lineItems[i] ?? {});
    lineItems[row] = { ...lineItems[row], [id]: value };
    onChange({ ...payload, lineItems });
  }

  return (
    <div className="space-y-8">
      {contractorFields.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          {contractorFields.map((field) => (
            <FieldControl
              key={field.id}
              field={field}
              value={payload.fields[field.id] ?? ""}
              readOnly={readOnly}
              onChange={(v) => setField(field.id, v)}
            />
          ))}
        </section>
      )}

      <div className="-mx-4 overflow-x-auto md:mx-0">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-subtle">
              <th className="px-3 py-2 font-medium">#</th>
              {issuerCols.map((c) => (
                <th key={c.id} className="px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              {contractorCols.map((c) => (
                <th key={c.id} className="px-3 py-2 font-medium">
                  {c.label}
                  {c.required ? " *" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schema.lineItems.map((issuerRow, index) => (
              <tr key={index} className="border-b border-border align-top">
                <td className="px-3 py-2 tabular-nums text-subtle">{index + 1}</td>
                {issuerCols.map((c) => (
                  <td key={c.id} className="px-3 py-2 text-fg">
                    {formatCell(issuerRow, c.id, c.type)}
                  </td>
                ))}
                {contractorCols.map((c) => (
                  <td key={c.id} className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-fg">
                        {formatCell(payload.lineItems[index] ?? {}, c.id, c.type)}
                      </span>
                    ) : (
                      <Input
                        className="h-10"
                        type={c.type === "text" ? "text" : "number"}
                        min={c.type === "number" || c.type === "currency" ? 0 : undefined}
                        value={payload.lineItems[index]?.[c.id] ?? ""}
                        onChange={(e) =>
                          setCell(
                            index,
                            c.id,
                            c.type === "text" ? e.target.value : e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(row: LineItem, id: string, type: string) {
  const value = row[id];
  if (value == null || value === "") return "—";
  if (type === "currency") return formatZar(Number(value));
  return String(value);
}

function FieldControl({
  field,
  value,
  readOnly,
  onChange,
}: {
  field: TemplateField;
  value: string | number;
  readOnly?: boolean;
  onChange: (value: string | number) => void;
}) {
  const wide = field.type === "textarea";
  return (
    <div className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label>
        {field.label}
        {field.required ? " *" : ""}
      </Label>
      {readOnly ? (
        <p className="min-h-11 rounded-sm border border-border bg-bg px-3 py-2.5 text-sm">
          {value === "" || value == null ? "—" : String(value)}
        </p>
      ) : field.type === "textarea" ? (
        <Textarea value={String(value)} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <Select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          type={field.type === "text" || field.type === "date" ? field.type : "number"}
          value={value}
          onChange={(e) =>
            onChange(
              field.type === "number" || field.type === "currency"
                ? e.target.value === ""
                  ? ""
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
      {field.help && <p className="text-xs text-subtle">{field.help}</p>}
    </div>
  );
}
