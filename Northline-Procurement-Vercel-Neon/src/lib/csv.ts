import { uid } from "./utils";
import type { LineItem, LineItemColumn, TemplateSchema } from "./types";
import {
  defaultContractorColumns,
  defaultHeaderFields,
  defaultIssuerColumns,
} from "./presets";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function slug(label: string, index: number): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return s || `col_${index}`;
}

const QTY_HEADERS = /^(qty|quantity|qty_nr|no)$/i;
const UNIT_HEADERS = /^(unit|uom|unit_of_measure)$/i;
const DESC_HEADERS = /^(description|item|item_description|desc)$/i;
const SPEC_HEADERS = /^(spec|specification|notes|details)$/i;

export function parseCsvToSchema(text: string): TemplateSchema {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV needs a header row and at least one line item.");
  }
  const headers = splitCsvLine(lines[0]);
  if (headers.length === 0 || headers.every((h) => !h)) {
    throw new Error("CSV header row is empty.");
  }

  const issuerColumns: LineItemColumn[] = headers.map((label, index) => {
    const id = slug(label, index);
    let type: LineItemColumn["type"] = "text";
    if (QTY_HEADERS.test(label) || /qty|quantity|number/i.test(label)) type = "number";
    return {
      id,
      label: label || `Column ${index + 1}`,
      type,
      required: DESC_HEADERS.test(label) || QTY_HEADERS.test(label),
      filledBy: "issuer",
    };
  });

  const hasDesc = issuerColumns.some((c) => DESC_HEADERS.test(c.label) || c.id === "description");
  const hasQty = issuerColumns.some((c) => QTY_HEADERS.test(c.label) || c.id === "quantity");
  const hasUnit = issuerColumns.some((c) => UNIT_HEADERS.test(c.label) || c.id === "unit");
  const hasSpec = issuerColumns.some((c) => SPEC_HEADERS.test(c.label));

  const extras: LineItemColumn[] = [];
  if (!hasDesc) extras.push(defaultIssuerColumns[0]);
  if (!hasQty) extras.push(defaultIssuerColumns[1]);
  if (!hasUnit) extras.push(defaultIssuerColumns[2]);
  if (!hasSpec) extras.push(defaultIssuerColumns[3]);

  const lineItemColumns: LineItemColumn[] = [
    ...extras,
    ...issuerColumns,
    ...defaultContractorColumns,
  ];

  const lineItems: LineItem[] = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: LineItem = {};
    issuerColumns.forEach((col, i) => {
      const raw = cells[i] ?? "";
      row[col.id] = col.type === "number" || col.type === "currency" ? Number(raw) || raw : raw;
    });
    return row;
  });

  return {
    fields: defaultHeaderFields(),
    lineItemColumns,
    lineItems,
  };
}

export function blankSchema(): TemplateSchema {
  return {
    fields: defaultHeaderFields(),
    lineItemColumns: [...defaultIssuerColumns, ...defaultContractorColumns],
    lineItems: [
      {
        description: "",
        quantity: 1,
        unit: "nr",
        specification: "",
      },
    ],
  };
}

export function addLineItem(schema: TemplateSchema): TemplateSchema {
  const row: LineItem = {};
  for (const col of schema.lineItemColumns) {
    if (col.filledBy === "issuer") row[col.id] = col.type === "number" ? 1 : "";
  }
  return { ...schema, lineItems: [...schema.lineItems, row] };
}

export function newField(): TemplateSchema["fields"][number] {
  return {
    id: uid("fld"),
    label: "New question",
    type: "text",
    required: false,
    filledBy: "contractor",
  };
}
