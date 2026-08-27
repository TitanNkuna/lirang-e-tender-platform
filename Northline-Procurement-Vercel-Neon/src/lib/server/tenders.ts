import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { SAMPLE_TENDER, sampleSteelBids } from "@/lib/presets";
import type { TemplateSchema, TenderVisibility } from "@/lib/types";
import { mapSubmission, mapTender } from "./map";

async function profileOf(userId: string) {
  const sql = await getSql();
  const rows = await sql<{
    role: string;
    company_name: string;
    contact_name: string;
  }>`select role, company_name, contact_name from profiles where user_id = ${userId}`;
  return { sql, profile: rows[0] ?? null };
}

const TENDER_SELECT = `
  t.id, t.owner_id, t.template_id, t.title, t.description, t.category,
  t.due_at, t.visibility, t.status, t.schema_json, t.awarded_submission_id, t.created_at,
  (select count(*) from submissions s where s.tender_id = t.id and s.status <> 'draft') as submission_count,
  (select count(*) from tender_invites i where i.tender_id = t.id) as invite_count,
  p.company_name as owner_company_name
`;

export const listMyTenders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (!profile) return [];
    if (profile.role === "procurement") {
      const rows = await sql.query<Parameters<typeof mapTender>[0]>(
        `select ${TENDER_SELECT} from tenders t
         left join profiles p on p.user_id = t.owner_id
         where t.owner_id = $1 order by t.created_at desc`,
        [context.userId],
      );
      return rows.map(mapTender);
    }
    const rows = await sql.query<Parameters<typeof mapTender>[0]>(
      `select ${TENDER_SELECT}
       from tenders t
       left join profiles p on p.user_id = t.owner_id
       where t.status in ('open', 'closed', 'awarded')
         and (
           t.visibility = 'open'
           or exists (
             select 1 from tender_invites i
             where i.tender_id = t.id and i.contractor_user_id = $1
           )
         )
       order by t.due_at nulls last, t.created_at desc`,
      [context.userId],
    );
    return rows.map(mapTender);
  });

export const getTender = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (!profile) return null;
    const rows = await sql.query<Parameters<typeof mapTender>[0]>(
      `select ${TENDER_SELECT} from tenders t
       left join profiles p on p.user_id = t.owner_id
       where t.id = $1`,
      [id],
    );
    const tender = rows[0] ? mapTender(rows[0]) : null;
    if (!tender) return null;
    if (profile.role === "procurement") {
      if (tender.ownerId !== context.userId) return null;
      return tender;
    }
    if (tender.visibility === "open") return tender;
    const invited = await sql<{ n: number }>`
      select 1 as n from tender_invites
      where tender_id = ${id} and contractor_user_id = ${context.userId}
    `;
    return invited[0] ? tender : null;
  });

export const createTender = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      title: string;
      description: string;
      category: string;
      dueAt: string | null;
      visibility: TenderVisibility;
      schema: TemplateSchema;
      templateId?: number | null;
      inviteUserIds?: string[];
    }) => {
      const title = input.title.trim();
      if (title.length < 2) throw new Error("Tender title is required.");
      if (!input.schema?.lineItems?.length) throw new Error("The sheet needs line items.");
      return {
        title,
        description: input.description.trim(),
        category: input.category.trim() || "General",
        dueAt: input.dueAt,
        visibility: input.visibility === "invite_only" ? "invite_only" : "open",
        schemaJson: JSON.stringify(input.schema),
        templateId: input.templateId ?? null,
        inviteUserIds: input.inviteUserIds ?? [],
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (profile?.role !== "procurement") throw new Error("Procurement desk only.");
    const rows = await sql<{ id: number }>`
      insert into tenders (
        owner_id, template_id, title, description, category, due_at, visibility, status, schema_json
      ) values (
        ${context.userId},
        ${data.templateId},
        ${data.title},
        ${data.description},
        ${data.category},
        ${data.dueAt},
        ${data.visibility},
        'open',
        ${data.schemaJson}
      ) returning id
    `;
    const id = Number(rows[0].id);
    for (const uid of data.inviteUserIds) {
      await sql`
        insert into tender_invites (tender_id, contractor_user_id)
        values (${id}, ${uid})
        on conflict do nothing
      `;
    }
    return { id };
  });

export const inviteContractors = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { tenderId: number; userIds: string[] }) => input)
  .handler(async ({ context, data }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (profile?.role !== "procurement") throw new Error("Procurement desk only.");
    const owned = await sql<{ id: number }>`
      select id from tenders where id = ${data.tenderId} and owner_id = ${context.userId}
    `;
    if (!owned[0]) throw new Error("Tender not found.");
    for (const uid of data.userIds) {
      await sql`
        insert into tender_invites (tender_id, contractor_user_id)
        values (${data.tenderId}, ${uid})
        on conflict do nothing
      `;
    }
    return { ok: true as const };
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((tenderId: number) => tenderId)
  .handler(async ({ context, data: tenderId }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (profile?.role !== "procurement") return [];
    const owned = await sql<{ id: number }>`
      select id from tenders where id = ${tenderId} and owner_id = ${context.userId}
    `;
    if (!owned[0]) return [];
    return sql<{
      contractor_user_id: string;
      company_name: string;
      contact_name: string;
    }>`
      select i.contractor_user_id, p.company_name, p.contact_name
      from tender_invites i
      join profiles p on p.user_id = i.contractor_user_id
      where i.tender_id = ${tenderId}
      order by p.company_name
    `;
  });

export const setTenderStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { tenderId: number; status: "open" | "closed" }) => input)
  .handler(async ({ context, data }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (profile?.role !== "procurement") throw new Error("Procurement desk only.");
    await sql`
      update tenders set status = ${data.status}, updated_at = now()
      where id = ${data.tenderId} and owner_id = ${context.userId} and status <> 'awarded'
    `;
    return { ok: true as const };
  });

export const awardSubmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { tenderId: number; submissionId: number }) => input)
  .handler(async ({ context, data }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (profile?.role !== "procurement") throw new Error("Procurement desk only.");
    const owned = await sql<{ id: number }>`
      select id from tenders where id = ${data.tenderId} and owner_id = ${context.userId}
    `;
    if (!owned[0]) throw new Error("Tender not found.");
    await sql`
      update submissions set status = 'submitted', updated_at = now()
      where tender_id = ${data.tenderId} and status = 'awarded'
    `;
    const updated = await sql<{ id: number }>`
      update submissions set status = 'awarded', updated_at = now()
      where id = ${data.submissionId} and tender_id = ${data.tenderId} and status = 'submitted'
      returning id
    `;
    if (!updated[0]) throw new Error("Submission is not ready to award.");
    await sql`
      update tenders
      set status = 'awarded', awarded_submission_id = ${data.submissionId}, updated_at = now()
      where id = ${data.tenderId} and owner_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const rejectSubmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { tenderId: number; submissionId: number }) => input)
  .handler(async ({ context, data }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (profile?.role !== "procurement") throw new Error("Procurement desk only.");
    await sql`
      update submissions set status = 'rejected', updated_at = now()
      where id = ${data.submissionId}
        and tender_id = ${data.tenderId}
        and tender_id in (select id from tenders where owner_id = ${context.userId})
        and status = 'submitted'
    `;
    return { ok: true as const };
  });

export const loadSampleTender = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (profile?.role !== "procurement") throw new Error("Procurement desk only.");
    const schemaJson = JSON.stringify(SAMPLE_TENDER.schema);
    const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await sql<{ id: number }>`
      insert into tenders (
        owner_id, title, description, category, due_at, visibility, status, schema_json
      ) values (
        ${context.userId},
        ${SAMPLE_TENDER.title},
        ${SAMPLE_TENDER.description},
        ${SAMPLE_TENDER.category},
        ${due},
        'open',
        'open',
        ${schemaJson}
      ) returning id
    `;
    const tenderId = Number(rows[0].id);
    for (const bid of sampleSteelBids()) {
      const payload = JSON.stringify(bid.payload);
      await sql`
        insert into submissions (
          tender_id, contractor_user_id, company_name, payload_json, status, is_sample, submitted_at
        ) values (
          ${tenderId},
          ${bid.contractorUserId},
          ${bid.companyName},
          ${payload},
          'submitted',
          true,
          now()
        )
      `;
    }
    return { id: tenderId };
  });

export const listSubmissionsForTender = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((tenderId: number) => tenderId)
  .handler(async ({ context, data: tenderId }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (profile?.role !== "procurement") return [];
    const owned = await sql<{ id: number }>`
      select id from tenders where id = ${tenderId} and owner_id = ${context.userId}
    `;
    if (!owned[0]) return [];
    const rows = await sql<{
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
      where tender_id = ${tenderId} and status <> 'draft'
      order by submitted_at desc nulls last, id
    `;
    return rows.map(mapSubmission);
  });

export const deleteTender = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((tenderId: number) => tenderId)
  .handler(async ({ context, data: tenderId }) => {
    const { sql, profile } = await profileOf(context.userId);
    if (profile?.role !== "procurement") throw new Error("Procurement desk only.");
    const deleted = await sql<{ id: number }>`
      delete from tenders
      where id = ${tenderId} and owner_id = ${context.userId}
      returning id
    `;
    if (!deleted[0]) throw new Error("Tender not found.");
    return { ok: true as const };
  });
