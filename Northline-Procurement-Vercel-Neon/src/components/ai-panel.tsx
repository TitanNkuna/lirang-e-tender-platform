import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { AiReviewResult } from "@/lib/types";
import { formatZar } from "@/lib/utils";

export function AiPanel({ result }: { result: AiReviewResult }) {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-muted">{result.summary}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Lowest price"
          value={
            result.comparison.lowestPrice
              ? `${result.comparison.lowestPrice.contractor} · ${formatZar(result.comparison.lowestPrice.amount)}`
              : "—"
          }
        />
        <Stat
          label="Best quality"
          value={result.comparison.bestQuality?.contractor ?? "—"}
          hint={result.comparison.bestQuality?.reason}
        />
        <Stat
          label="Best value"
          value={result.comparison.bestValue?.contractor ?? "—"}
          hint={result.comparison.bestValue?.reason}
        />
      </div>

      <div className="space-y-3">
        {result.submissions.map((sub) => (
          <article key={sub.contractorUserId} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-fg">{sub.contractorName}</h3>
                <p className="mt-1 text-sm text-muted">{sub.reason}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    sub.recommendation === "reject"
                      ? "danger"
                      : sub.recommendation === "clarify"
                        ? "warn"
                        : "ok"
                  }
                >
                  {sub.recommendation === "reject"
                    ? "Reject"
                    : sub.recommendation === "clarify"
                      ? "Clarify"
                      : "Accept"}
                </Badge>
                <span className="font-mono text-sm tabular-nums">{formatZar(sub.priceTotal)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={sub.completenessScore} className="flex-1" />
              <span className="text-xs tabular-nums text-muted">{sub.completenessScore}%</span>
            </div>
            {sub.missing.length > 0 && (
              <p className="mt-2 text-xs text-danger">Missing: {sub.missing.join("; ")}</p>
            )}
            {sub.qualityNotes && (
              <p className="mt-2 text-sm text-muted">{sub.qualityNotes}</p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {sub.strengths.length > 0 && (
                <ul className="space-y-1 text-xs text-ok">
                  {sub.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
              {sub.risks.length > 0 && (
                <ul className="space-y-1 text-xs text-warn">
                  {sub.risks.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>

      {result.comparison.ranking.length > 0 && (
        <div className="-mx-4 overflow-x-auto md:mx-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-subtle">
                <th className="px-3 py-2 font-medium">Rank</th>
                <th className="px-3 py-2 font-medium">Contractor</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Quality</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {result.comparison.ranking.map((row, i) => (
                <tr key={row.contractor} className="border-b border-border">
                  <td className="px-3 py-2 tabular-nums text-subtle">{i + 1}</td>
                  <td className="px-3 py-2">{row.contractor}</td>
                  <td className="px-3 py-2 tabular-nums">{row.priceScore}</td>
                  <td className="px-3 py-2 tabular-nums">{row.qualityScore}</td>
                  <td className="px-3 py-2 tabular-nums">{row.valueScore}</td>
                  <td className="px-3 py-2 text-muted">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-subtle">{label}</p>
      <p className="mt-2 font-display text-lg leading-snug">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
