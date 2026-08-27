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

/** Rough days from invoice to payment for ranking. */
export function paymentDaysFromTerms(terms: unknown): number | null {
  const t = String(terms ?? "").toLowerCase();
  if (!t.trim()) return null;
  if (t.includes("on delivery") || t.includes("cod") || t.includes("cash")) return 0;
  if (t.includes("50/50") || t.includes("deposit")) return 15;
  const m = t.match(/(\d+)\s*day/);
  if (m) return Number(m[1]);
  if (t.includes("60")) return 60;
  if (t.includes("30")) return 30;
  if (t.includes("14") || t.includes("net 14")) return 14;
  return 30;
}

export type BidSummary = {
  priceTotal: number | null;
  completeness: number;
  complete: boolean;
  paymentTerms: string;
  paymentDays: number | null;
  qualityNotes: string;
  leadDaysAvg: number | null;
  warranty: string;
  validityDays: string;
  highlights: string[];
};

export function summarizeBid(schema: TemplateSchema, payload: BidPayload): BidSummary {
  const scored = scoreSubmission(schema, payload);
  const paymentTerms = String(payload.fields.payment_terms ?? "").trim();
  const warranty = String(payload.fields.warranty ?? "").trim();
  const validityDays = String(payload.fields.validity_days ?? "").trim();

  const notes: string[] = [];
  for (const row of payload.lineItems) {
    const q = String(row.quality_notes ?? "").trim();
    if (q) notes.push(q);
  }
  const qualityNotes = notes.slice(0, 2).join("; ");

  let leadSum = 0;
  let leadN = 0;
  for (const row of payload.lineItems) {
    const d = toNumber(row.lead_days);
    if (d != null) {
      leadSum += d;
      leadN += 1;
    }
  }

  const highlights: string[] = [];
  if (paymentTerms) highlights.push(paymentTerms);
  if (warranty) highlights.push(warranty);
  if (leadN > 0) highlights.push(`Avg lead ${Math.round(leadSum / leadN)} days`);
  if (qualityNotes) highlights.push(qualityNotes.slice(0, 120));

  return {
    priceTotal: scored.priceTotal,
    completeness: scored.score,
    complete: scored.complete,
    paymentTerms: paymentTerms || "—",
    paymentDays: paymentDaysFromTerms(paymentTerms),
    qualityNotes,
    leadDaysAvg: leadN > 0 ? Math.round(leadSum / leadN) : null,
    warranty: warranty || "—",
    validityDays: validityDays || "—",
    highlights,
  };
}

export type RankedBid = {
  summary: BidSummary;
  priceScore: number;
  qualityScore: number;
  paymentScore: number;
  overall: number;
};

/**
 * Rank bids: higher overall is better.
 * - Price: lower total wins
 * - Quality: completeness + quality notes presence
 * - Payment: prefers ~30 day invoice terms (balanced for buyer cash vs supplier)
 */
export function rankBid(
  schema: TemplateSchema,
  payload: BidPayload,
  peers: BidPayload[],
): RankedBid {
  const summary = summarizeBid(schema, payload);
  const peerSummaries = peers.map((p) => summarizeBid(schema, p));

  const prices = peerSummaries
    .map((s) => s.priceTotal)
    .filter((n): n is number => n != null && n > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  let priceScore = 50;
  if (summary.priceTotal != null && minPrice != null && maxPrice != null) {
    if (maxPrice === minPrice) priceScore = 100;
    else
      priceScore = Math.round(
        100 * (1 - (summary.priceTotal - minPrice) / (maxPrice - minPrice)),
      );
  }

  let qualityScore = summary.completeness;
  if (summary.qualityNotes.length > 20) qualityScore = Math.min(100, qualityScore + 10);
  if (summary.qualityNotes.length > 60) qualityScore = Math.min(100, qualityScore + 5);
  if (summary.warranty !== "—") qualityScore = Math.min(100, qualityScore + 5);

  let paymentScore = 50;
  if (summary.paymentDays != null) {
    const ideal = 30;
    const dist = Math.abs(summary.paymentDays - ideal);
    paymentScore = Math.max(0, Math.round(100 - dist * 2));
  }

  const overall = Math.round(priceScore * 0.4 + qualityScore * 0.35 + paymentScore * 0.25);

  return { summary, priceScore, qualityScore, paymentScore, overall };
}
