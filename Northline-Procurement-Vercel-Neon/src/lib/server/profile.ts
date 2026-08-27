import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { Role } from "@/lib/types";
import { PRESETS } from "@/lib/presets";
import { mapProfile } from "./map";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      role: string;
      company_name: string;
      contact_name: string;
      phone: string;
      email: string;
      address: string;
    }>`select user_id, role, company_name, contact_name, phone, email, address from profiles where user_id = ${context.userId}`;
    return rows[0] ? mapProfile(rows[0]) : null;
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      role: Role;
      companyName: string;
      contactName: string;
      phone?: string;
      email?: string;
      address?: string;
    }) => {
      const companyName = input.companyName.trim();
      const contactName = input.contactName.trim();
      if (input.role !== "procurement" && input.role !== "contractor") {
        throw new Error("Choose a desk.");
      }
      if (companyName.length < 2) throw new Error("Company name is required.");
      return {
        role: input.role,
        companyName,
        contactName,
        phone: (input.phone ?? "").trim(),
        email: (input.email ?? "").trim(),
        address: (input.address ?? "").trim(),
      };
    },
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into profiles (user_id, role, company_name, contact_name, phone, email, address, updated_at)
      values (${context.userId}, ${data.role}, ${data.companyName}, ${data.contactName}, ${data.phone}, ${data.email}, ${data.address}, now())
      on conflict (user_id) do update set
        role = excluded.role,
        company_name = excluded.company_name,
        contact_name = excluded.contact_name,
        phone = excluded.phone,
        email = excluded.email,
        address = excluded.address,
        updated_at = now()
    `;

    if (data.role === "procurement") {
      for (const preset of PRESETS) {
        await sql`
          insert into templates (owner_id, name, description, category, schema_json)
          select ${context.userId}, ${preset.name}, ${preset.description}, ${preset.category}, ${JSON.stringify(preset.schema)}
          where not exists (
            select 1 from templates
            where owner_id = ${context.userId} and name = ${preset.name}
          )
        `;
      }
    }
    return { ok: true as const };
  });

export const listContractors = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await sql<{ role: string }>`select role from profiles where user_id = ${context.userId}`;
    if (me[0]?.role !== "procurement") return [];
    const rows = await sql<{
      user_id: string;
      company_name: string;
      contact_name: string;
      phone: string;
      email: string;
      address: string;
    }>`select user_id, company_name, contact_name, phone, email, address from profiles where role = 'contractor' order by company_name`;
    return rows.map((r) => ({
      userId: r.user_id,
      companyName: r.company_name,
      contactName: r.contact_name,
      phone: r.phone ?? "",
      email: r.email ?? "",
      address: r.address ?? "",
    }));
  });
