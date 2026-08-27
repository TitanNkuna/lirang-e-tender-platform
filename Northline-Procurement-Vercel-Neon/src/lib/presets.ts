import type { BidPayload, LineItemColumn, TemplateSchema } from "./types";

export const defaultIssuerColumns: LineItemColumn[] = [
  { id: "description", label: "Description", type: "text", required: true, filledBy: "issuer" },
  { id: "quantity", label: "Qty", type: "number", required: true, filledBy: "issuer" },
  { id: "unit", label: "Unit", type: "text", required: true, filledBy: "issuer" },
  {
    id: "specification",
    label: "Specification",
    type: "text",
    required: false,
    filledBy: "issuer",
  },
];

export const defaultContractorColumns: LineItemColumn[] = [
  {
    id: "unit_price",
    label: "Unit price (ZAR)",
    type: "currency",
    required: true,
    filledBy: "contractor",
  },
  { id: "lead_days", label: "Lead (days)", type: "number", required: true, filledBy: "contractor" },
  { id: "make", label: "Make / mill / origin", type: "text", required: false, filledBy: "contractor" },
  {
    id: "quality_notes",
    label: "Quality notes",
    type: "text",
    required: false,
    filledBy: "contractor",
  },
];

export function defaultHeaderFields(): TemplateSchema["fields"] {
  return [
    {
      id: "validity_days",
      label: "Quote validity (days)",
      type: "number",
      required: true,
      filledBy: "contractor",
      help: "How long this price holds.",
    },
    {
      id: "warranty",
      label: "Warranty / defects liability",
      type: "text",
      required: true,
      filledBy: "contractor",
    },
    {
      id: "payment_terms",
      label: "Payment terms",
      type: "select",
      required: true,
      filledBy: "contractor",
      options: ["30 days from invoice", "On delivery", "50/50 deposit and completion", "Other"],
    },
    {
      id: "exclusions",
      label: "Exclusions and qualifications",
      type: "textarea",
      required: false,
      filledBy: "contractor",
    },
  ];
}

function steelSchema(): TemplateSchema {
  return {
    fields: defaultHeaderFields(),
    lineItemColumns: [...defaultIssuerColumns, ...defaultContractorColumns],
    lineItems: [
      {
        description: "Universal beams 305 × 165 × 54",
        quantity: 48,
        unit: "nr",
        specification: "S355JR, EN 10025-2, 12 m lengths, mill certs 3.1",
      },
      {
        description: "Universal columns 203 × 203 × 46",
        quantity: 24,
        unit: "nr",
        specification: "S355JR, EN 10025-2, 9 m lengths",
      },
      {
        description: "Chequer plate 6 mm",
        quantity: 120,
        unit: "m²",
        specification: "Grade 250, raised pattern, oil-free",
      },
      {
        description: "Site welding consumables",
        quantity: 1,
        unit: "lot",
        specification: "E7018 electrodes, sufficient for splice joints",
      },
      {
        description: "Delivery to site — Warehouse 12, Germiston",
        quantity: 1,
        unit: "lot",
        specification: "Offload by contractor, working hours only",
      },
    ],
  };
}

function facilitiesSchema(): TemplateSchema {
  return {
    fields: defaultHeaderFields(),
    lineItemColumns: [...defaultIssuerColumns, ...defaultContractorColumns],
    lineItems: [
      {
        description: "Quarterly HVAC service — office block A",
        quantity: 4,
        unit: "visit",
        specification: "Filter change, coil clean, refrigerant check",
      },
      {
        description: "Emergency call-out (after hours)",
        quantity: 12,
        unit: "call",
        specification: "4-hour response, labour only",
      },
      {
        description: "Replacement filters (pack)",
        quantity: 16,
        unit: "pack",
        specification: "OEM or equivalent, F7",
      },
    ],
  };
}

function itSchema(): TemplateSchema {
  return {
    fields: defaultHeaderFields(),
    lineItemColumns: [...defaultIssuerColumns, ...defaultContractorColumns],
    lineItems: [
      {
        description: "Managed endpoint protection — 80 seats",
        quantity: 12,
        unit: "month",
        specification: "EDR + 24/7 SOC, ISO 27001 operator",
      },
      {
        description: "On-site technician (business hours)",
        quantity: 24,
        unit: "day",
        specification: "Level 2, Johannesburg metro",
      },
      {
        description: "Firewall appliance + 3-year licence",
        quantity: 1,
        unit: "nr",
        specification: "Next-gen, 2 Gbps threat protection",
      },
    ],
  };
}


function slaSchema(serviceType: "facilities" | "it" | "general"): TemplateSchema {
  const commonFields = [
    {
      id: "service_scope",
      label: "Service scope and exclusions",
      type: "textarea" as const,
      required: true,
      filledBy: "contractor" as const,
      help: "Describe exactly what is included and excluded.",
    },
    {
      id: "service_hours",
      label: "Service hours / availability",
      type: "text" as const,
      required: true,
      filledBy: "contractor" as const,
    },
    {
      id: "escalation",
      label: "Escalation procedure",
      type: "textarea" as const,
      required: true,
      filledBy: "contractor" as const,
    },
    {
      id: "reporting",
      label: "Reporting frequency and format",
      type: "text" as const,
      required: true,
      filledBy: "contractor" as const,
    },
    {
      id: "service_credits",
      label: "Service credits / remedies for missed SLA",
      type: "textarea" as const,
      required: false,
      filledBy: "contractor" as const,
    },
  ];

  const serviceRows =
    serviceType === "facilities"
      ? [
          { description: "Critical HVAC failure", priority: "P1", response: "1 hour", resolution: "4 hours", availability: "24/7" },
          { description: "Major HVAC fault", priority: "P2", response: "4 hours", resolution: "24 hours", availability: "Business hours" },
          { description: "Routine maintenance request", priority: "P3", response: "1 business day", resolution: "5 business days", availability: "Business hours" },
        ]
      : serviceType === "it"
        ? [
            { description: "Production system outage", priority: "P1", response: "15 minutes", resolution: "4 hours", availability: "24/7" },
            { description: "Major user-impacting incident", priority: "P2", response: "1 hour", resolution: "8 hours", availability: "24/7" },
            { description: "Standard support request", priority: "P3", response: "4 business hours", resolution: "3 business days", availability: "Business hours" },
          ]
        : [
            { description: "Critical service interruption", priority: "P1", response: "1 hour", resolution: "4 hours", availability: "24/7" },
            { description: "Major service issue", priority: "P2", response: "4 hours", resolution: "24 hours", availability: "Business hours" },
            { description: "Standard request", priority: "P3", response: "1 business day", resolution: "5 business days", availability: "Business hours" },
          ];

  return {
    fields: commonFields,
    lineItemColumns: [
      { id: "description", label: "Service / incident", type: "text", required: true, filledBy: "issuer" },
      { id: "priority", label: "Priority", type: "text", required: true, filledBy: "issuer" },
      { id: "response", label: "Response target", type: "text", required: true, filledBy: "contractor" },
      { id: "resolution", label: "Resolution target", type: "text", required: true, filledBy: "contractor" },
      { id: "availability", label: "Availability", type: "text", required: true, filledBy: "contractor" },
      { id: "measurement", label: "Measurement / reporting method", type: "text", required: false, filledBy: "contractor" },
    ],
    lineItems: serviceRows,
  };
}

export type Preset = {
  key: string;
  name: string;
  category: string;
  description: string;
  schema: TemplateSchema;
};

export const PRESETS: Preset[] = [
  {
    key: "steel",
    name: "Structural steel package",
    category: "Structural steel",
    description: "Beams, columns, plate and delivery — typical warehouse package.",
    schema: steelSchema(),
  },
  {
    key: "facilities",
    name: "Facilities maintenance",
    category: "Facilities",
    description: "HVAC service, call-outs and consumables for a 12-month term.",
    schema: facilitiesSchema(),
  },
  {
    key: "it",
    name: "Managed IT services",
    category: "IT services",
    description: "Endpoint protection, on-site support and a firewall appliance.",
    schema: itSchema(),
  },
  {
    key: "sla-facilities",
    name: "Facilities SLA",
    category: "Service Level Agreement",
    description: "Ready-to-edit response, resolution, availability and service-credit schedule for facilities services.",
    schema: slaSchema("facilities"),
  },
  {
    key: "sla-it",
    name: "IT Support SLA",
    category: "Service Level Agreement",
    description: "Ready-to-edit IT incident priorities, response targets, resolution targets and reporting requirements.",
    schema: slaSchema("it"),
  },
  {
    key: "sla-general",
    name: "General Services SLA",
    category: "Service Level Agreement",
    description: "Flexible SLA baseline for outsourced services with editable service levels and remedies.",
    schema: slaSchema("general"),
  },
];

export type SampleBid = {
  contractorUserId: string;
  companyName: string;
  payload: BidPayload;
};

export function sampleSteelBids(): SampleBid[] {
  const kloof: BidPayload = {
    fields: {
      validity_days: 30,
      warranty: "12 months defects liability from delivery",
      payment_terms: "30 days from invoice",
      exclusions: "No erection. Prices exclude VAT.",
    },
    lineItems: [
      {
        unit_price: 2850,
        lead_days: 21,
        make: "ArcelorMittal Vanderbijlpark",
        quality_notes: "3.1 mill certs with heat numbers; ultrasonic tested flanges",
      },
      {
        unit_price: 2420,
        lead_days: 21,
        make: "ArcelorMittal",
        quality_notes: "Straightness per EN 10034",
      },
      {
        unit_price: 890,
        lead_days: 14,
        make: "Local mill, Grade 250",
        quality_notes: "Oil-free, plastic wrapped bundles",
      },
      {
        unit_price: 18500,
        lead_days: 7,
        make: "Lincoln Electric",
        quality_notes: "Batch certificates on request",
      },
      {
        unit_price: 24000,
        lead_days: 21,
        make: "Own fleet",
        quality_notes: "Hiab offload included, banksman on arrival",
      },
    ],
  };

  const umgeni: BidPayload = {
    fields: {
      validity_days: 14,
      warranty: "",
      payment_terms: "On delivery",
      exclusions: "Subject to mill availability",
    },
    lineItems: [
      {
        unit_price: 2700,
        lead_days: 28,
        make: "Import — origin TBC",
        quality_notes: "",
      },
      {
        unit_price: 2300,
        lead_days: 28,
        make: "",
        quality_notes: "",
      },
      { unit_price: "", lead_days: "", make: "", quality_notes: "" },
      {
        unit_price: 12000,
        lead_days: 10,
        make: "Generic",
        quality_notes: "",
      },
      { unit_price: "", lead_days: "", make: "", quality_notes: "Transport extra" },
    ],
  };

  const karoo: BidPayload = {
    fields: {
      validity_days: 45,
      warranty: "6 months from delivery",
      payment_terms: "50/50 deposit and completion",
      exclusions: "Erection, cranage, and after-hours delivery excluded. Prices exclude VAT.",
    },
    lineItems: [
      {
        unit_price: 2480,
        lead_days: 35,
        make: "Imported S355 equivalent",
        quality_notes: "Mill certs on request after order",
      },
      {
        unit_price: 2100,
        lead_days: 35,
        make: "Imported",
        quality_notes: "Visual inspection only",
      },
      {
        unit_price: 760,
        lead_days: 21,
        make: "Local",
        quality_notes: "Standard commercial quality",
      },
      {
        unit_price: 9800,
        lead_days: 14,
        make: "House brand",
        quality_notes: "",
      },
      {
        unit_price: 18500,
        lead_days: 35,
        make: "Third-party haulier",
        quality_notes: "Client to provide offload",
      },
    ],
  };

  return [
    {
      contractorUserId: "sample:kloof-steelworks",
      companyName: "Kloof Steelworks (Pty) Ltd",
      payload: kloof,
    },
    {
      contractorUserId: "sample:umgeni-fab",
      companyName: "Umgeni Fabrication",
      payload: umgeni,
    },
    {
      contractorUserId: "sample:karoo-civil",
      companyName: "Karoo Civil Supply",
      payload: karoo,
    },
  ];
}

export const SAMPLE_TENDER = {
  title: "Structural steel package — Warehouse 12",
  description:
    "Supply and deliver the steel package for the new warehouse at Germiston. Erection is under a separate contract. Prices in ZAR, excluding VAT.",
  category: "Structural steel",
  schema: steelSchema(),
};
