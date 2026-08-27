import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { emptyPayload } from "@/lib/completeness";
import { getSql } from "@/lib/db";
import type { BidPayload } from "@/lib/types";
import { mapSubmission, parsePayload, parseSchema } from "./map";

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

/** All non-draft submissions across tenders owned by the procurement user. */
export const listOwnerSubmissions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await sql<{ role: string }>`
      select role from profiles where user_id = ${context.userId}
    `;
    if (me[0]?.role !== "procurement") return [];
    const rows = await sql<{
      id: number;
      tender_id: number;
      tender_title: string;
      contractor_user_id: string;
      company_name: string;
      contact_name: string;
      phone: string;
      email: string;
      address: string;
      logo_url: string;
      status: string;
      submitted_at: unknown;
      payload_json: string;
      schema_json: string;
    }>`
      select
        s.id,
        s.tender_id,
        t.title as tender_title,
        s.contractor_user_id,
        s.company_name,
        coalesce(p.contact_name, '') as contact_name,
        coalesce(p.phone, '') as phone,
        coalesce(p.email, '') as email,
        coalesce(p.address, '') as address,
        coalesce(p.logo_url, '') as logo_url,
        s.status,
        s.submitted_at,
        s.payload_json,
        t.schema_json
      from submissions s
      join tenders t on t.id = s.tender_id
      left join profiles p on p.user_id = s.contractor_user_id
      where t.owner_id = ${context.userId}
        and s.status <> 'draft'
      order by s.submitted_at desc nulls last, s.id desc
      limit 100
    `;
    return rows.map((r) => ({
      id: Number(r.id),
      tenderId: Number(r.tender_id),
      tenderTitle: r.tender_title,
      contractorUserId: r.contractor_user_id,
      companyName: r.company_name,
      contactName: r.contact_name,
      phone: r.phone,
      email: r.email,
      address: r.address,
      logoUrl: r.logo_url,
      status: r.status,
      submittedAt: r.submitted_at ? String(r.submitted_at) : null,
      payload: parsePayload(r.payload_json),
      schema: parseSchema(r.schema_json),
    }));
  });

/** Procurement: update a submission payload on a tender they own (edit after submit). */
export const updateOwnerSubmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { submissionId: number; payload: BidPayload }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await sql<{ role: string }>`
      select role from profiles where user_id = ${context.userId}
    `;
    if (me[0]?.role !== "procurement") {
      throw new Error("Procurement desk only.");
    }
    const owned = await sql<{ id: number; status: string }>`
      select s.id, s.status
      from submissions s
      join tenders t on t.id = s.tender_id
      where s.id = ${data.submissionId}
        and t.owner_id = ${context.userId}
    `;
    if (!owned[0]) throw new Error("Submission not found.");
    if (owned[0].status === "awarded") {
      throw new Error("Cannot edit an awarded submission.");
    }
    const payloadJson = JSON.stringify(data.payload);
    await sql`
      update submissions
      set payload_json = ${payloadJson}, updated_at = now()
      where id = ${data.submissionId}
    `;
    return { ok: true as const };
  });
