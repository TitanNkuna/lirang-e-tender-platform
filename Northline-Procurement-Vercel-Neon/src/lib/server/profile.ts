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
    try {
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
    } catch {
      const rows = await sql<{
        user_id: string;
        role: string;
        company_name: string;
        contact_name: string;
      }>`select user_id, role, company_name, contact_name from profiles where user_id = ${context.userId}`;
      return rows[0]
        ? mapProfile({ ...rows[0], phone: "", email: "", address: "" })
        : null;
    }
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
      const phone = (input.phone ?? "").trim();
      const email = (input.email ?? "").trim();
      const address = (input.address ?? "").trim();
      if (input.role !== "procurement" && input.role !== "contractor") {
        throw new Error("Choose a desk.");
      }
      if (companyName.length < 2) throw new Error("Company name is required.");
      if (contactName.length < 2) throw new Error("Contact name is required.");
      if (phone.length < 7) throw new Error("Phone number is required.");
      if (!email.includes("@") || email.length < 5) throw new Error("Valid email is required.");
      if (address.length < 5) throw new Error("Address is required.");
      return { role: input.role, companyName, contactName, phone, email, address };
    },
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    try {
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
    } catch {
      await sql`
        insert into profiles (user_id, role, company_name, contact_name, updated_at)
        values (${context.userId}, ${data.role}, ${data.companyName}, ${data.contactName}, now())
        on conflict (user_id) do update set
          role = excluded.role,
          company_name = excluded.company_name,
          contact_name = excluded.contact_name,
          updated_at = now()
      `;
      throw new Error(
        "Database needs migration 0003 (phone/email/address). Redeploy so migrations run, then save again.",
      );
    }

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
    try {
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
    } catch {
      const rows = await sql<{
        user_id: string;
        company_name: string;
        contact_name: string;
      }>`select user_id, company_name, contact_name from profiles where role = 'contractor' order by company_name`;
      return rows.map((r) => ({
        userId: r.user_id,
        companyName: r.company_name,
        contactName: r.contact_name,
        phone: "",
        email: "",
        address: "",
      }));
    }
  });
