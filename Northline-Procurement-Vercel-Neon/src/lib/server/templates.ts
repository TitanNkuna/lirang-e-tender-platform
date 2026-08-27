import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { TemplateSchema } from "@/lib/types";
import { mapTemplate } from "./map";

async function requireProcurement(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ role: string }>`select role from profiles where user_id = ${userId}`;
  if (rows[0]?.role !== "procurement") throw new Error("Procurement desk only.");
  return sql;
}

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireProcurement(context.userId);
    const rows = await sql<{
      id: number;
      owner_id: string;
      name: string;
      description: string;
      category: string;
      schema_json: string;
      created_at: unknown;
      updated_at: unknown;
    }>`select * from templates where owner_id = ${context.userId} order by updated_at desc`;
    return rows.map(mapTemplate);
  });

export const getTemplate = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await requireProcurement(context.userId);
    const rows = await sql<{
      id: number;
      owner_id: string;
      name: string;
      description: string;
      category: string;
      schema_json: string;
      created_at: unknown;
      updated_at: unknown;
    }>`select * from templates where id = ${id} and owner_id = ${context.userId}`;
    return rows[0] ? mapTemplate(rows[0]) : null;
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id?: number;
      name: string;
      description: string;
      category: string;
      schema: TemplateSchema;
    }) => {
      const name = input.name.trim();
      if (name.length < 2) throw new Error("Template name is required.");
      if (!input.schema?.lineItems?.length) {
        throw new Error("Add at least one line item.");
      }
      return {
        id: input.id,
        name,
        description: input.description.trim(),
        category: input.category.trim() || "General",
        schemaJson: JSON.stringify(input.schema),
      };
    },
  )
  .handler(async ({ context, data }) => {
    const sql = await requireProcurement(context.userId);
    if (data.id) {
      const rows = await sql<{ id: number }>`
        update templates
        set name = ${data.name},
            description = ${data.description},
            category = ${data.category},
            schema_json = ${data.schemaJson},
            updated_at = now()
        where id = ${data.id} and owner_id = ${context.userId}
        returning id
      `;
      if (!rows[0]) throw new Error("Template not found.");
      return { id: Number(rows[0].id) };
    }
    const rows = await sql<{ id: number }>`
      insert into templates (owner_id, name, description, category, schema_json)
      values (${context.userId}, ${data.name}, ${data.description}, ${data.category}, ${data.schemaJson})
      returning id
    `;
    return { id: Number(rows[0].id) };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await requireProcurement(context.userId);
    await sql`delete from templates where id = ${id} and owner_id = ${context.userId}`;
    return { ok: true as const };
  });
