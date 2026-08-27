import { isoFromUnknown } from "@/lib/utils";
import type {
  AiReviewRecord,
  AiReviewResult,
  BidPayload,
  Profile,
  Role,
  SubmissionRecord,
  SubmissionStatus,
  TemplateRecord,
  TemplateSchema,
  TenderRecord,
  TenderStatus,
  TenderVisibility,
} from "@/lib/types";

export function parseSchema(raw: string): TemplateSchema {
  return JSON.parse(raw) as TemplateSchema;
}

export function parsePayload(raw: string): BidPayload {
  return JSON.parse(raw) as BidPayload;
}

export function mapProfile(row: {
  user_id: string;
  role: string;
  company_name: string;
  contact_name: string;
}): Profile {
  return {
    userId: row.user_id,
    role: row.role as Role,
    companyName: row.company_name,
    contactName: row.contact_name,
  };
}

export function mapTemplate(row: {
  id: number;
  owner_id: string;
  name: string;
  description: string;
  category: string;
  schema_json: string;
  created_at: unknown;
  updated_at: unknown;
}): TemplateRecord {
  return {
    id: Number(row.id),
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    category: row.category,
    schema: parseSchema(row.schema_json),
    createdAt: isoFromUnknown(row.created_at) ?? "",
    updatedAt: isoFromUnknown(row.updated_at) ?? "",
  };
}

export function mapTender(row: {
  id: number;
  owner_id: string;
  template_id: number | null;
  title: string;
  description: string;
  category: string;
  due_at: unknown;
  visibility: string;
  status: string;
  schema_json: string;
  awarded_submission_id: number | null;
  created_at: unknown;
  submission_count?: number | string;
  invite_count?: number | string;
}): TenderRecord {
  return {
    id: Number(row.id),
    ownerId: row.owner_id,
    templateId: row.template_id == null ? null : Number(row.template_id),
    title: row.title,
    description: row.description,
    category: row.category,
    dueAt: isoFromUnknown(row.due_at),
    visibility: row.visibility as TenderVisibility,
    status: row.status as TenderStatus,
    schema: parseSchema(row.schema_json),
    awardedSubmissionId:
      row.awarded_submission_id == null ? null : Number(row.awarded_submission_id),
    createdAt: isoFromUnknown(row.created_at) ?? "",
    submissionCount: Number(row.submission_count ?? 0),
    inviteCount: Number(row.invite_count ?? 0),
  };
}

export function mapSubmission(row: {
  id: number;
  tender_id: number;
  contractor_user_id: string;
  company_name: string;
  payload_json: string;
  status: string;
  is_sample: boolean;
  submitted_at: unknown;
  created_at: unknown;
}): SubmissionRecord {
  return {
    id: Number(row.id),
    tenderId: Number(row.tender_id),
    contractorUserId: row.contractor_user_id,
    companyName: row.company_name,
    payload: parsePayload(row.payload_json),
    status: row.status as SubmissionStatus,
    isSample: Boolean(row.is_sample),
    submittedAt: isoFromUnknown(row.submitted_at),
    createdAt: isoFromUnknown(row.created_at) ?? "",
  };
}

export function mapReview(row: {
  id: number;
  tender_id: number;
  result_json: string;
  created_at: unknown;
}): AiReviewRecord {
  return {
    id: Number(row.id),
    tenderId: Number(row.tender_id),
    createdAt: isoFromUnknown(row.created_at) ?? "",
    result: JSON.parse(row.result_json) as AiReviewResult,
  };
}
