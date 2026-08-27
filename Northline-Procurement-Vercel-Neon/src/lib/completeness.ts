import type {
  BidPayload,
  CompletenessResult,
  LineItem,
  TemplateSchema,
} from "./types";

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "number") return Number.isNaN(value);
  return String(value).trim() === "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function emptyPayload(schema: TemplateSchema): BidPayload {
  return {
    fields: {},
    lineItems: schema.lineItems.map(() => ({})),
  };
}

export function mergeLineItems(schema: TemplateSchema, payload: BidPayload): LineItem[] {
  return schema.lineItems.map((issuerRow, index) => ({
    ...issuerRow,
    ...(payload.lineItems[index] ?? {}),
  }));
}

export function scoreSubmission(
  schema: TemplateSchema,
  payload: BidPayload,
): CompletenessResult {
  const missing: string[] = [];
  let filledRequired = 0;
  let totalRequired = 0;

  for (const field of schema.fields) {
    if (field.filledBy !== "contractor" || !field.required) continue;
    totalRequired += 1;
    const value = payload.fields[field.id];
    if (isEmpty(value)) missing.push(field.label);
    else filledRequired += 1;
  }

  const contractorCols = schema.lineItemColumns.filter(
    (c) => c.filledBy === "contractor" && c.required,
  );
  schema.lineItems.forEach((_, index) => {
    const row = payload.lineItems[index] ?? {};
    const rowLabel = schema.lineItems[index]?.description
      ? String(schema.lineItems[index].description)
      : `Line ${index + 1}`;
    for (const col of contractorCols) {
      totalRequired += 1;
      if (isEmpty(row[col.id])) missing.push(`${rowLabel} — ${col.label}`);
      else filledRequired += 1;
    }
  });

  const score =
    totalRequired === 0 ? 100 : Math.round((filledRequired / totalRequired) * 100);

  return {
    complete: missing.length === 0,
    score,
    missing,
    filledRequired,
    totalRequired,
    priceTotal: computePriceTotal(schema, payload),
  };
}

export function computePriceTotal(
  schema: TemplateSchema,
  payload: BidPayload,
): number | null {
  const priceCol = schema.lineItemColumns.find(
    (c) => c.filledBy === "contractor" && (c.id === "unit_price" || c.type === "currency"),
  );
  const qtyCol = schema.lineItemColumns.find(
    (c) => c.filledBy === "issuer" && (c.id === "quantity" || c.label.toLowerCase().includes("qty")),
  );
  if (!priceCol) return null;

  let total = 0;
  let any = false;
  schema.lineItems.forEach((issuerRow, index) => {
    const row = payload.lineItems[index] ?? {};
    const price = toNumber(row[priceCol.id]);
    if (price == null) return;
    const qty = qtyCol ? (toNumber(issuerRow[qtyCol.id]) ?? 1) : 1;
    total += price * qty;
    any = true;
  });
  return any ? total : null;
}
