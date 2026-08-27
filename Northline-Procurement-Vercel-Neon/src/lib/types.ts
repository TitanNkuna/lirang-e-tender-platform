export type Role = "procurement" | "contractor";

export type FieldType = "text" | "textarea" | "number" | "currency" | "select" | "date";

export type FilledBy = "issuer" | "contractor";

export type TemplateField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  help?: string;
  options?: string[];
  filledBy: FilledBy;
};

export type LineItemColumn = {
  id: string;
  label: string;
  type: "text" | "number" | "currency";
  required: boolean;
  filledBy: FilledBy;
};

export type LineItem = Record<string, string | number>;

export type TemplateSchema = {
  fields: TemplateField[];
  lineItemColumns: LineItemColumn[];
  lineItems: LineItem[];
};

export type BidPayload = {
  fields: Record<string, string | number>;
  lineItems: LineItem[];
};

export type Profile = {
  userId: string;
  role: Role;
  companyName: string;
  contactName: string;
};

export type TemplateRecord = {
  id: number;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  schema: TemplateSchema;
  createdAt: string;
  updatedAt: string;
};

export type TenderStatus = "draft" | "open" | "closed" | "awarded";
export type TenderVisibility = "open" | "invite_only";
export type SubmissionStatus = "draft" | "submitted" | "rejected" | "shortlisted" | "awarded";

export type TenderRecord = {
  id: number;
  ownerId: string;
  templateId: number | null;
  title: string;
  description: string;
  category: string;
  dueAt: string | null;
  visibility: TenderVisibility;
  status: TenderStatus;
  schema: TemplateSchema;
  awardedSubmissionId: number | null;
  createdAt: string;
  submissionCount: number;
  inviteCount: number;
};

export type SubmissionRecord = {
  id: number;
  tenderId: number;
  contractorUserId: string;
  companyName: string;
  payload: BidPayload;
  status: SubmissionStatus;
  isSample: boolean;
  submittedAt: string | null;
  createdAt: string;
};

export type ContractorDirectoryItem = {
  userId: string;
  companyName: string;
  contactName: string;
};

export type CompletenessResult = {
  complete: boolean;
  score: number;
  missing: string[];
  filledRequired: number;
  totalRequired: number;
  priceTotal: number | null;
};

export type AiSubmissionReview = {
  contractorName: string;
  contractorUserId: string;
  completenessScore: number;
  complete: boolean;
  missing: string[];
  recommendation: "accept" | "reject" | "clarify";
  reason: string;
  priceTotal: number | null;
  qualityNotes: string;
  strengths: string[];
  risks: string[];
};

export type AiReviewResult = {
  summary: string;
  submissions: AiSubmissionReview[];
  comparison: {
    lowestPrice: { contractor: string; amount: number | null } | null;
    bestQuality: { contractor: string; reason: string } | null;
    bestValue: { contractor: string; reason: string } | null;
    ranking: Array<{
      contractor: string;
      priceScore: number;
      qualityScore: number;
      valueScore: number;
      notes: string;
    }>;
  };
};

export type AiReviewRecord = {
  id: number;
  tenderId: number;
  createdAt: string;
  result: AiReviewResult;
};

export const CATEGORIES = [
  "Structural steel",
  "Civil works",
  "Electrical",
  "Mechanical",
  "IT services",
  "Facilities",
  "Service Level Agreement",
  "General",
] as const;
