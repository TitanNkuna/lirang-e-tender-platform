import type { SubmissionStatus, TenderStatus } from "./types";

export function tenderBadge(status: TenderStatus): "accent" | "ok" | "warn" | "default" {
  if (status === "open") return "ok";
  if (status === "awarded") return "accent";
  if (status === "closed") return "warn";
  return "default";
}

export function submissionBadge(
  status: SubmissionStatus,
  complete?: boolean,
): "ok" | "warn" | "danger" | "accent" | "default" {
  if (status === "awarded") return "accent";
  if (status === "rejected") return "danger";
  if (status === "shortlisted") return "ok";
  if (status === "submitted") return complete === false ? "warn" : "ok";
  return "default";
}

export function tenderLabel(status: TenderStatus): string {
  if (status === "open") return "Open";
  if (status === "closed") return "Closed";
  if (status === "awarded") return "Awarded";
  return "Draft";
}

export function submissionLabel(status: SubmissionStatus): string {
  if (status === "submitted") return "Submitted";
  if (status === "rejected") return "Rejected";
  if (status === "awarded") return "Awarded";
  if (status === "shortlisted") return "Shortlisted";
  return "Draft";
}
