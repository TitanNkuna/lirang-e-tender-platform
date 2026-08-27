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
    const n = Number(value.replace(/,/g, " ").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looksLike(id: string, label: string, ...keys: string[]): boolean {
  const hay = `${id} ${label}`.toLowerCase();
  return keys.some((k) => hay.includes(k));
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

/** Sum contractor currency/price columns × qty when possible. */
export function computePriceTotal(
  schema: TemplateSchema,
  payload: BidPayload,
): number | null {
  const priceCols = schema.lineItemColumns.filter(
    (c) =>
      c.filledBy === "contractor" &&
      (c.type === "currency" ||
        looksLike(c.id, c.label, "price", "rate", "amount", "cost", "fee", "total")),
  );
  const qtyCol = schema.lineItemColumns.find(
    (c) =>
      c.filledBy === "issuer" &&
      (c.id === "quantity" || looksLike(c.id, c.label, "qty", "quantity", "count")),
  );

  const priceCol =
    priceCols.find((c) => looksLike(c.id, c.label, "unit", "price", "rate")) ?? priceCols[0];

  if (priceCol) {
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
    if (any) return total;
  }

  for (const field of schema.fields) {
    if (field.filledBy !== "contractor") continue;
    if (
      field.type === "currency" ||
      looksLike(field.id, field.label, "total", "price", "amount", "cost", "fee", "quote")
    ) {
      const n = toNumber(payload.fields[field.id]);
      if (n != null) return n;
    }
  }

  if (priceCols.length === 0) {
    let total = 0;
    let any = false;
    for (const col of schema.lineItemColumns.filter(
      (c) => c.filledBy === "contractor" && (c.type === "number" || c.type === "currency"),
    )) {
      schema.lineItems.forEach((_, index) => {
        const n = toNumber((payload.lineItems[index] ?? {})[col.id]);
        if (n != null) {
          total += n;
          any = true;
        }
      });
    }
    if (any) return total;
  }

  return null;
}

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
  filledSummary: string[];
  qualityFit: number;
  qualityFitLabel: string;
  qualityGaps: string[];
};

function fieldValue(payload: BidPayload, id: string): string {
  return String(payload.fields[id] ?? "").trim();
}

function findFieldValue(
  schema: TemplateSchema,
  payload: BidPayload,
  ...keys: string[]
): string {
  for (const f of schema.fields) {
    if (f.filledBy !== "contractor") continue;
    if (looksLike(f.id, f.label, ...keys)) {
      const v = fieldValue(payload, f.id);
      if (v) return v;
    }
  }
  return "";
}

export function assessQualityFit(
  schema: TemplateSchema,
  payload: BidPayload,
): { score: number; label: string; gaps: string[]; notes: string } {
  const gaps: string[] = [];
  const notesParts: string[] = [];
  let checks = 0;
  let hits = 0;

  const descCol = schema.lineItemColumns.find(
    (c) =>
      c.filledBy === "issuer" &&
      looksLike(c.id, c.label, "description", "spec", "item", "scope"),
  );
  const qualityCols = schema.lineItemColumns.filter(
    (c) =>
      c.filledBy === "contractor" &&
      looksLike(
        c.id,
        c.label,
        "quality",
        "spec",
        "grade",
        "make",
        "origin",
        "cert",
        "note",
        "compliance",
      ),
  );

  schema.lineItems.forEach((issuerRow, index) => {
    const req = descCol ? String(issuerRow[descCol.id] ?? "").trim() : "";
    const row = payload.lineItems[index] ?? {};
    let rowQuality = "";
    for (const col of qualityCols) {
      const v = String(row[col.id] ?? "").trim();
      if (v) rowQuality = rowQuality ? `${rowQuality}; ${v}` : v;
    }
    if (!rowQuality) {
      for (const col of schema.lineItemColumns.filter((c) => c.filledBy === "contractor")) {
        if (col.type === "number" || col.type === "currency") continue;
        const v = String(row[col.id] ?? "").trim();
        if (v) {
          rowQuality = v;
          break;
        }
      }
    }

    if (req) {
      checks += 1;
      if (!rowQuality) {
        gaps.push(`Line ${index + 1}: no quality answer for "${req.slice(0, 60)}"`);
      } else {
        hits += 1;
        notesParts.push(rowQuality.slice(0, 100));
        const reqWords = req
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 3);
        const ans = rowQuality.toLowerCase();
        const overlap = reqWords.filter((w) => ans.includes(w)).length;
        if (reqWords.length >= 2 && overlap === 0) {
          gaps.push(`Line ${index + 1}: answer may not address "${req.slice(0, 50)}"`);
        } else if (overlap > 0) {
          hits += 0.5;
          checks += 0.5;
        }
      }
    } else if (rowQuality) {
      notesParts.push(rowQuality.slice(0, 100));
    }
  });

  const warranty = findFieldValue(schema, payload, "warranty", "guarantee", "defect");
  const qualityField = findFieldValue(
    schema,
    payload,
    "quality",
    "compliance",
    "standard",
    "specification",
    "cert",
  );
  if (warranty) {
    checks += 1;
    hits += 1;
    notesParts.push(warranty.slice(0, 80));
  }
  if (qualityField) {
    checks += 1;
    hits += 1;
    notesParts.push(qualityField.slice(0, 80));
  }

  for (const f of schema.fields) {
    if (f.filledBy !== "contractor" || !f.required) continue;
    if (!looksLike(f.id, f.label, "quality", "warranty", "compliance", "standard", "spec"))
      continue;
    checks += 1;
    if (!isEmpty(payload.fields[f.id])) hits += 1;
    else gaps.push(`Missing: ${f.label}`);
  }

  if (checks === 0) {
    const scored = scoreSubmission(schema, payload);
    const score = scored.score;
    return {
      score,
      label:
        score >= 90
          ? "Form complete — limited quality detail on this sheet"
          : score >= 60
            ? "Partial sheet — quality fit unclear"
            : "Incomplete — cannot confirm quality",
      gaps: scored.missing.slice(0, 4),
      notes: notesParts.join(" · ").slice(0, 200),
    };
  }

  const score = Math.max(0, Math.min(100, Math.round((hits / checks) * 100)));
  let label = "Quality fit unclear";
  if (score >= 85) label = "Strong match to your requirements";
  else if (score >= 65) label = "Likely match — review details";
  else if (score >= 40) label = "Weak match — gaps in quality answers";
  else label = "Does not clearly meet quality requirements";

  return {
    score,
    label,
    gaps: gaps.slice(0, 5),
    notes: notesParts.join(" · ").slice(0, 240),
  };
}

export function summarizeBid(schema: TemplateSchema, payload: BidPayload): BidSummary {
  const scored = scoreSubmission(schema, payload);
  const paymentTerms =
    findFieldValue(schema, payload, "payment", "invoice", "terms", "net ") ||
    String(payload.fields.payment_terms ?? "").trim();
  const warranty =
    findFieldValue(schema, payload, "warranty", "guarantee", "defect") ||
    String(payload.fields.warranty ?? "").trim();
  const validityDays =
    findFieldValue(schema, payload, "validity", "valid") ||
    String(payload.fields.validity_days ?? "").trim();

  const fit = assessQualityFit(schema, payload);

  let leadSum = 0;
  let leadN = 0;
  for (const col of schema.lineItemColumns) {
    if (!looksLike(col.id, col.label, "lead", "delivery", "days", "turnaround")) continue;
    schema.lineItems.forEach((_, index) => {
      const d = toNumber((payload.lineItems[index] ?? {})[col.id]);
      if (d != null) {
        leadSum += d;
        leadN += 1;
      }
    });
  }

  const filledSummary: string[] = [];
  for (const f of schema.fields) {
    if (f.filledBy !== "contractor") continue;
    const v = fieldValue(payload, f.id);
    if (!v) continue;
    filledSummary.push(`${f.label}: ${v.slice(0, 80)}`);
    if (filledSummary.length >= 4) break;
  }
  if (filledSummary.length < 4) {
    for (const col of schema.lineItemColumns.filter((c) => c.filledBy === "contractor")) {
      if (col.type === "currency" || looksLike(col.id, col.label, "price", "rate", "amount"))
        continue;
      for (let i = 0; i < schema.lineItems.length && filledSummary.length < 5; i++) {
        const v = String((payload.lineItems[i] ?? {})[col.id] ?? "").trim();
        if (!v) continue;
        const item = schema.lineItems[i]?.description
          ? String(schema.lineItems[i].description).slice(0, 30)
          : `Line ${i + 1}`;
        filledSummary.push(`${item} — ${col.label}: ${v.slice(0, 50)}`);
      }
    }
  }

  const highlights: string[] = [];
  if (paymentTerms) highlights.push(paymentTerms);
  if (warranty) highlights.push(warranty);
  if (leadN > 0) highlights.push(`Avg lead ${Math.round(leadSum / leadN)} days`);
  if (fit.notes) highlights.push(fit.notes.slice(0, 120));

  return {
    priceTotal: scored.priceTotal,
    completeness: scored.score,
    complete: scored.complete,
    paymentTerms: paymentTerms || "Not stated",
    paymentDays: paymentDaysFromTerms(paymentTerms),
    qualityNotes: fit.notes,
    leadDaysAvg: leadN > 0 ? Math.round(leadSum / leadN) : null,
    warranty: warranty || "Not stated",
    validityDays: validityDays || "—",
    highlights,
    filledSummary,
    qualityFit: fit.score,
    qualityFitLabel: fit.label,
    qualityGaps: fit.gaps,
  };
}

export type RankedBid = {
  summary: BidSummary;
  priceScore: number;
  qualityScore: number;
  paymentScore: number;
  overall: number;
};

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
  } else if (summary.priceTotal != null) {
    priceScore = 70;
  }

  let qualityScore = Math.round(summary.completeness * 0.45 + summary.qualityFit * 0.55);
  if (summary.warranty !== "Not stated") qualityScore = Math.min(100, qualityScore + 5);

  let paymentScore = 50;
  if (summary.paymentDays != null) {
    const ideal = 30;
    const dist = Math.abs(summary.paymentDays - ideal);
    paymentScore = Math.max(0, Math.round(100 - dist * 2));
  } else if (summary.paymentTerms !== "Not stated") {
    paymentScore = 55;
  }

  const overall = Math.round(priceScore * 0.35 + qualityScore * 0.4 + paymentScore * 0.25);

  return { summary, priceScore, qualityScore, paymentScore, overall };
}

export type SuggestedWinnerCandidate = {
  id: number;
  companyName: string;
  payload: BidPayload;
  status: string;
};

export type SuggestedWinner = {
  submissionId: number;
  companyName: string;
  overall: number;
  priceScore: number;
  qualityScore: number;
  paymentScore: number;
  summary: BidSummary;
  reason: string;
};

/** Deterministic best bid among non-draft submissions for one tender. */
export function pickSuggestedWinner(
  schema: TemplateSchema,
  candidates: SuggestedWinnerCandidate[],
): SuggestedWinner | null {
  if (candidates.length === 0) return null;
  const payloads = candidates.map((c) => c.payload);
  let best: SuggestedWinner | null = null;
  for (const c of candidates) {
    const rank = rankBid(schema, c.payload, payloads);
    const reasonParts = [
      rank.summary.qualityFitLabel,
      rank.summary.priceTotal != null
        ? `Total ${rank.summary.priceTotal.toLocaleString("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 })}`
        : "Price not stated",
      rank.summary.paymentTerms !== "Not stated"
        ? `Payment: ${rank.summary.paymentTerms}`
        : null,
    ].filter(Boolean) as string[];
    const row: SuggestedWinner = {
      submissionId: c.id,
      companyName: c.companyName,
      overall: rank.overall,
      priceScore: rank.priceScore,
      qualityScore: rank.qualityScore,
      paymentScore: rank.paymentScore,
      summary: rank.summary,
      reason: reasonParts.join(" · "),
    };
    if (!best || row.overall > best.overall) best = row;
  }
  return best;
}
