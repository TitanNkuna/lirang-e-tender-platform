import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { scoreSubmission } from "@/lib/completeness";
import { getSql } from "@/lib/db";
import type { AiReviewResult, BidPayload, TemplateSchema } from "@/lib/types";
import { mapReview, parsePayload, parseSchema } from "./map";

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI returned no JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

export const getLatestReview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((tenderId: number) => tenderId)
  .handler(async ({ context, data: tenderId }) => {
    const sql = await getSql();
    const owned = await sql<{ id: number }>`
      select id from tenders where id = ${tenderId} and owner_id = ${context.userId}
    `;
    if (!owned[0]) return null;
    const rows = await sql<{
      id: number;
      tender_id: number;
      result_json: string;
      created_at: unknown;
    }>`
      select id, tender_id, result_json, created_at
      from ai_reviews
      where tender_id = ${tenderId}
      order by created_at desc
      limit 1
    `;
    return rows[0] ? mapReview(rows[0]) : null;
  });

export const runAiReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((tenderId: number) => tenderId)
  .handler(async ({ context, data: tenderId }) => {
    const sql = await getSql();
    const tenders = await sql<{
      id: number;
      title: string;
      description: string;
      schema_json: string;
    }>`select id, title, description, schema_json from tenders where id = ${tenderId} and owner_id = ${context.userId}`;
    const tender = tenders[0];
    if (!tender) throw new Error("Tender not found.");

    const rows = await sql<{
      contractor_user_id: string;
      company_name: string;
      payload_json: string;
    }>`
      select contractor_user_id, company_name, payload_json
      from submissions
      where tender_id = ${tenderId} and status <> 'draft'
    `;
    if (rows.length === 0) throw new Error("No submitted sheets to review yet.");

    const schema = parseSchema(tender.schema_json) as TemplateSchema;
    const scored = rows.map((row) => {
      const payload = parsePayload(row.payload_json) as BidPayload;
      const completeness = scoreSubmission(schema, payload);
      return {
        contractorUserId: row.contractor_user_id,
        companyName: row.company_name,
        payload,
        completeness,
      };
    });

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new Error("AI is not configured. Set AI_API_KEY, AI_API_URL and AI_MODEL in Vercel.");
    }

    const facts = scored.map((s) => ({
      contractor: s.companyName,
      contractorUserId: s.contractorUserId,
      complete: s.completeness.complete,
      completenessScore: s.completeness.score,
      missing: s.completeness.missing,
      priceTotalZar: s.completeness.priceTotal,
      headerAnswers: s.payload.fields,
      lineItems: schema.lineItems.map((issuer, i) => ({
        description: issuer.description,
        quantity: issuer.quantity,
        unit: issuer.unit,
        specification: issuer.specification,
        contractor: s.payload.lineItems[i] ?? {},
      })),
    }));

    const prompt = `You are a senior procurement officer reviewing contractor bid sheets for a South African tender. Currency is ZAR.

Tender: ${tender.title}
${tender.description}

Factual completeness has already been computed. Treat missing[] as ground truth. Incomplete sheets should be recommended "reject" unless the gaps are trivial.

Return ONLY JSON matching:
{
  "summary": "2-4 sentences for the buyer",
  "submissions": [
    {
      "contractorName": "",
      "contractorUserId": "",
      "completenessScore": 0,
      "complete": true,
      "missing": [],
      "recommendation": "accept" | "reject" | "clarify",
      "reason": "",
      "priceTotal": 0,
      "qualityNotes": "",
      "strengths": [],
      "risks": []
    }
  ],
  "comparison": {
    "lowestPrice": { "contractor": "", "amount": 0 },
    "bestQuality": { "contractor": "", "reason": "" },
    "bestValue": { "contractor": "", "reason": "" },
    "ranking": [
      { "contractor": "", "priceScore": 0, "qualityScore": 0, "valueScore": 0, "notes": "" }
    ]
  }
}

Scores are 0-100. Compare price AND quality (certs, mill origin, warranty, lead time, completeness). Do not invent line items or prices.

BIDS:
${JSON.stringify(facts)}`;

    const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3500,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      throw new Error(`AI API error ${res.status}`);
    }
    const body = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = body.choices[0]?.message.content ?? "";
    const parsed = extractJson(text) as AiReviewResult;

    parsed.submissions = parsed.submissions.map((sub) => {
      const fact = scored.find(
        (s) =>
          s.contractorUserId === sub.contractorUserId || s.companyName === sub.contractorName,
      );
      if (!fact) return sub;
      return {
        ...sub,
        contractorName: fact.companyName,
        contractorUserId: fact.contractorUserId,
        completenessScore: fact.completeness.score,
        complete: fact.completeness.complete,
        missing: fact.completeness.missing,
        priceTotal: fact.completeness.priceTotal,
        recommendation: fact.completeness.complete ? sub.recommendation : "reject",
      };
    });

    const resultJson = JSON.stringify(parsed);
    const saved = await sql<{
      id: number;
      tender_id: number;
      result_json: string;
      created_at: unknown;
    }>`
      insert into ai_reviews (tender_id, requested_by, result_json)
      values (${tenderId}, ${context.userId}, ${resultJson})
      returning id, tender_id, result_json, created_at
    `;
    return mapReview(saved[0]);
  });
