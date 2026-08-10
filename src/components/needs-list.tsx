"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import type { PublicReport } from "@/db/schema";
import {
  categoryLabel,
  categoryMeta,
  SEVERITY_LABELS,
  type Severity,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

/** Response priority: what a volunteer should look at first. */
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "border-red-500/40 text-red-400",
  high: "border-orange-500/40 text-orange-400",
  medium: "border-amber-500/40 text-amber-300",
  low: "border-border text-muted-foreground",
};

/**
 * `now` is passed in rather than read from Date.now() so the server render and
 * the hydrated render agree — otherwise a report that crosses a minute boundary
 * between the two produces a hydration mismatch.
 */
function relativeTime(date: Date | null, now: number | null): string {
  if (!date || now === null) return "";
  const mins = Math.round((now - new Date(date).getTime()) / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/**
 * Triage view of the needs a volunteer can act on.
 *
 * Every row here comes from getPublicReports(), the same query behind the
 * public map — already limited to published reports, PII-scrubbed and with
 * coarsened coordinates. This component shows nothing that isn't public
 * already; it only reshapes it into something you can scan and sort.
 */
export function NeedsList({ reports }: { reports: PublicReport[] }) {
  const [category, setCategory] = useState<string>("");
  const [departamento, setDepartamento] = useState<string>("");
  // Set after mount so relative timestamps never differ between the server
  // render and hydration.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Filter options come from what's actually published, not the full taxonomy,
  // so a volunteer never picks a filter that returns nothing.
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const r of reports) if (r.category) seen.add(r.category);
    return Array.from(seen).sort();
  }, [reports]);

  const departamentos = useMemo(() => {
    const seen = new Set<string>();
    for (const r of reports) if (r.departamento) seen.add(r.departamento);
    return Array.from(seen).sort();
  }, [reports]);

  const visible = useMemo(() => {
    return reports
      .filter((r) => !category || r.category === category)
      .filter((r) => !departamento || r.departamento === departamento)
      .slice()
      .sort((a, b) => {
        const sa = a.severity ? SEVERITY_RANK[a.severity] : 4;
        const sb = b.severity ? SEVERITY_RANK[b.severity] : 4;
        if (sa !== sb) return sa - sb;
        const ta = new Date(a.publishedAt ?? a.createdAt).getTime();
        const tb = new Date(b.publishedAt ?? b.createdAt).getTime();
        return tb - ta;
      });
  }, [reports, category, departamento]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link href="/">Ver mapa</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/ayudar">Quiero ayudar</Link>
            </Button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-[19px] font-semibold tracking-tight">
            Necesidades verificadas
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Reportes que ya pasaron por moderación. La ubicación es aproximada:
            se muestra la zona, nunca la dirección exacta.
          </p>
        </div>

        {/* Filters scroll horizontally instead of wrapping: on a phone, eleven
            wrapped categories would push the first actual need below the fold,
            which defeats the point of a triage list. */}
        <div className="mb-4 space-y-2">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex w-max gap-px border border-border bg-border">
              <button
                type="button"
                onClick={() => setCategory("")}
                className={cn(
                  "min-h-10 shrink-0 px-3 text-[12px] transition-colors",
                  category === ""
                    ? "bg-secondary text-foreground"
                    : "bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                Todas
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[12px] transition-colors",
                    category === c
                      ? "bg-secondary text-foreground"
                      : "bg-card text-muted-foreground hover:bg-accent",
                  )}
                >
                  <span
                    className="size-2 shrink-0"
                    style={{ backgroundColor: categoryMeta(c).color }}
                  />
                  {categoryLabel(c)}
                </button>
              ))}
            </div>
          </div>

          {departamentos.length > 1 ? (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="flex w-max gap-px border border-border bg-border">
                <button
                  type="button"
                  onClick={() => setDepartamento("")}
                  className={cn(
                    "min-h-10 shrink-0 whitespace-nowrap px-3 text-[12px] transition-colors",
                    departamento === ""
                      ? "bg-secondary text-foreground"
                      : "bg-card text-muted-foreground hover:bg-accent",
                  )}
                >
                  Todo el país
                </button>
                {departamentos.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDepartamento(d)}
                    className={cn(
                      "min-h-10 shrink-0 whitespace-nowrap px-3 text-[12px] transition-colors",
                      departamento === d
                        ? "bg-secondary text-foreground"
                        : "bg-card text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {visible.length} {visible.length === 1 ? "necesidad" : "necesidades"}
        </p>

        {visible.length === 0 ? (
          <div className="border border-border bg-card px-5 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">
              No hay necesidades publicadas con ese filtro.
            </p>
          </div>
        ) : (
          <ul className="space-y-px border border-border bg-border">
            {visible.map((r) => {
              const meta = categoryMeta(r.category ?? "other");
              const place = [r.barrio, r.municipio, r.departamento]
                .filter(Boolean)
                .join(", ");
              return (
                <li key={r.id} className="bg-card px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 size-2.5 shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] text-muted-foreground">
                          {categoryLabel(r.category ?? "other")}
                        </span>
                        {r.severity ? (
                          <span
                            className={cn(
                              "border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.1em]",
                              SEVERITY_STYLES[r.severity],
                            )}
                          >
                            {SEVERITY_LABELS[r.severity]}
                          </span>
                        ) : null}
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {relativeTime(r.publishedAt ?? r.createdAt, now)}
                        </span>
                      </div>

                      <p className="mt-1.5 text-[14px] leading-relaxed">
                        {r.summary}
                      </p>

                      {place ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <MapPin className="size-3" />
                          {place}
                        </p>
                      ) : null}
                    </div>

                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {r.id}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">
          ¿Vas a atender alguna? Por ahora coordina con el equipo de moderación
          usando el folio. Asignar casos y ver la dirección exacta es el
          siguiente paso del proyecto.
        </p>
      </main>
    </div>
  );
}
