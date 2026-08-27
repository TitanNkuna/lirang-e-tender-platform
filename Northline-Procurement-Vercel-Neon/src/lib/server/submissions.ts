import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { emptyPayload } from "@/lib/completeness";
import { getSql } from "@/lib/db";
import type { BidPayload } from "@/lib/types";
import { mapSubmission, parseSchema } from "./map";

async function canBid(userId: string, tenderId: number) {
  const sql = await getSql();
  const profile = await sql<{
    role: string;
    company_name: string;
  }>`select role, company_name from profiles where user_id = ${userId}`;
  if (profile[0]?.role !== "contractor") {
    return { sql, allowed: false as const, companyName: "" };
  }
  const tender = await sql<{
    id: number;
    visibility: string;
    status: string;
    schema_json: string;
  }>`select id, visibility, status, schema_json from tenders where id = ${tenderId}`;
  if (!tender[0] || tender[0].status !== "open") {
    return { sql, allowed: false as const, companyName: profile[0].company_name };
  }
  if (tender[0].visibility === "invite_only") {
    const invited = await sql<{ n: number }>`
      select 1 as n from tender_invites
      where tender_id = ${tenderId} and contractor_user_id = ${userId}
    `;
    if (!invited[0]) {
      return { sql, allowed: false as const, companyName: profile[0].company_name };
    }
  }
  return {
    sql,
    allowed: true as const,
    companyName: profile[0].company_name,
    schemaJson: tender[0].schema_json,
  };
}

export const getMySubmission = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((tenderId: number) => tenderId)
  .handler(async ({ context, data: tenderId }) => {
    const gate = await canBid(context.userId, tenderId);
    const rows = await gate.sql<{
      id: number;
      tender_id: number;
      contractor_user_id: string;
      company_name: string;
      payload_json: string;
      status: string;
      is_sample: boolean;
      submitted_at: unknown;
      created_at: unknown;
    }>`
      select * from submissions
      where tender_id = ${tenderId} and contractor_user_id = ${context.userId}
    `;
    if (rows[0]) return mapSubmission(rows[0]);
    if (!gate.allowed) return null;
    const schema = parseSchema(gate.schemaJson);
    return {
      id: 0,
      tenderId,
      contractorUserId: context.userId,
      companyName: gate.companyName,
      payload: emptyPayload(schema),
      status: "draft" as const,
      isSample: false,
      submittedAt: null,
      createdAt: new Date().toISOString(),
    };
  });

export const saveSubmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { tenderId: number; payload: BidPayload; submit: boolean }) => input)
  .handler(async ({ context, data }) => {
    const gate = await canBid(context.userId, data.tenderId);
    if (!gate.allowed) throw new Error("This tender is not open to you.");
    const payloadJson = JSON.stringify(data.payload);
    const status = data.submit ? "submitted" : "draft";
    const existing = await gate.sql<{ id: number; status: string }>`
      select id, status from submissions
      where tender_id = ${data.tenderId} and contractor_user_id = ${context.userId}
    `;
    if (existing[0] && existing[0].status !== "draft") {
      throw new Error("This sheet is already submitted.");
    }
    if (existing[0]) {
      await gate.sql`
        update submissions
        set payload_json = ${payloadJson},
            status = ${status},
            company_name = ${gate.companyName},
            submitted_at = case when ${data.submit} then now() else submitted_at end,
            updated_at = now()
        where id = ${existing[0].id} and contractor_user_id = ${context.userId}
      `;
      return { id: Number(existing[0].id), status };
    }
    const rows = await gate.sql<{ id: number }>`
      insert into submissions (
        tender_id, contractor_user_id, company_name, payload_json, status, submitted_at
      ) values (
        ${data.tenderId},
        ${context.userId},
        ${gate.companyName},
        ${payloadJson},
        ${status},
        ${data.submit ? new Date().toISOString() : null}
      ) returning id
    `;
    return { id: Number(rows[0].id), status };
  });
