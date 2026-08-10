import { Download, ExternalLink, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getPublicReports } from "@/db/queries";
import { localTime, mapsLink, triageSort } from "@/lib/export";
import {
  categoryLabel,
  categoryMeta,
  SEVERITY_LABELS,
  type Severity,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { publicQuerySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Datos para equipos de respuesta · Reporte CO",
  description:
    "Descarga los reportes ciudadanos verificados en CSV, GeoJSON o KML. Abierto para Defensa Civil, bomberos, alcaldías, ONG y medios.",
};

const DOWNLOADS = [
  {
    href: "/api/reports.csv",
    label: "CSV",
    hint: "Excel · Google Sheets",
  },
  {
    href: "/api/reports.kml",
    label: "KML",
    hint: "Google Earth · Maps",
  },
  {
    href: "/api/reports.geojson",
    label: "GeoJSON",
    hint: "QGIS · ArcGIS",
  },
  {
    href: "/api/reports",
    label: "JSON",
    hint: "API · integraciones",
  },
];

/** Accent per severity so the triage table scans at a glance. */
const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "border-red-500/50 bg-red-500/10 text-red-400",
  high: "border-orange-500/50 bg-orange-500/10 text-orange-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  low: "border-border bg-muted text-muted-foreground",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </div>
  );
}

export default async function DatosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // Unknown/invalid filters degrade to "show everything" rather than erroring:
  // this page is meant to survive a hand-edited URL pasted into a radio call.
  const parsed = publicQuerySchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : {};
  const reports = (await getPublicReports(filters)).sort(triageSort);

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString();
  const suffix = query ? `?${query}` : "";

  const bySeverity = reports.reduce<Record<string, number>>((acc, r) => {
    const k = r.severity ?? "sin";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const departamentos = Array.from(
    new Set(reports.map((r) => r.departamento).filter(Boolean)),
  ).sort() as string[];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        tagline="Datos abiertos"
        right={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link href="/">Mapa</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/acerca">Acerca</Link>
            </Button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="space-y-3">
          <SectionLabel>Para equipos de respuesta</SectionLabel>
          <h1 className="text-[28px] font-medium leading-tight tracking-tight">
            Descarga los reportes verificados.
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Estos son los reportes ciudadanos que ya pasaron por revisión de
            voluntarios. Son de uso libre para Defensa Civil, bomberos,
            alcaldías, organismos de socorro, ONG y medios. No hay que pedir
            permiso ni registrarse.
          </p>
        </div>

        {/* Downloads */}
        <div className="mt-8 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          {DOWNLOADS.map((d) => (
            <a
              key={d.label}
              href={`${d.href}${suffix}`}
              className="group flex flex-col gap-1 bg-card px-4 py-4 transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2 text-[15px] font-medium tracking-tight">
                <Download className="size-3.5 text-muted-foreground" />
                {d.label}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {d.hint}
              </span>
            </a>
          ))}
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Los enlaces respetan el filtro activo y se pueden llamar directamente
          desde un script o un dashboard. Aceptan{" "}
          <code className="text-foreground">?departamento=</code>,{" "}
          <code className="text-foreground">?categoria</code> vía{" "}
          <code className="text-foreground">?category=</code> y{" "}
          <code className="text-foreground">?severity=</code>.
        </p>

        {/* Counts */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="border border-border bg-card px-3 py-1.5 text-[13px]">
            {reports.length} reportes publicados
          </span>
          {(["critical", "high", "medium", "low"] as Severity[])
            .filter((s) => bySeverity[s])
            .map((s) => (
              <span
                key={s}
                className={cn(
                  "border px-3 py-1.5 text-[13px]",
                  SEVERITY_CLASS[s],
                )}
              >
                {bySeverity[s]} {SEVERITY_LABELS[s].toLowerCase()}
              </span>
            ))}
        </div>

        {/* Departamento filter */}
        {departamentos.length > 1 || filters.departamento ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <Link
              href="/datos"
              className={cn(
                "border px-2.5 py-1 text-[12px] transition-colors hover:bg-accent",
                filters.departamento
                  ? "border-border bg-card text-muted-foreground"
                  : "border-foreground/30 bg-secondary text-foreground",
              )}
            >
              Todos
            </Link>
            {departamentos.map((d) => (
              <Link
                key={d}
                href={`/datos?departamento=${encodeURIComponent(d)}`}
                className={cn(
                  "border px-2.5 py-1 text-[12px] transition-colors hover:bg-accent",
                  filters.departamento === d
                    ? "border-foreground/30 bg-secondary text-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {d}
              </Link>
            ))}
          </div>
        ) : null}

        {/* Triage table */}
        <div className="mt-6 overflow-x-auto border border-border">
          <table className="w-full min-w-[860px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-sidebar text-left">
                {[
                  "Hora",
                  "Categoría",
                  "Severidad",
                  "Ubicación",
                  "Reporte",
                  "Ir",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const key = r.category ?? r.categories[0] ?? "other";
                const place = [r.barrio, r.municipio, r.departamento]
                  .filter(Boolean)
                  .join(", ");
                const link = mapsLink(r.lat, r.lng);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 align-top hover:bg-accent/40"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {localTime(r.publishedAt ?? r.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 shrink-0"
                          style={{ backgroundColor: categoryMeta(key).color }}
                        />
                        {categoryLabel(key)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {r.severity ? (
                        <span
                          className={cn(
                            "border px-1.5 py-0.5 text-[11px]",
                            SEVERITY_CLASS[r.severity],
                          )}
                        >
                          {SEVERITY_LABELS[r.severity]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {place || "-"}
                    </td>
                    <td className="max-w-[380px] px-3 py-2.5 leading-relaxed">
                      {r.summary ?? "-"}
                    </td>
                    <td className="px-3 py-2.5">
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                        >
                          <MapIcon className="size-3" />
                          Mapa
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    No hay reportes publicados con este filtro todavía.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* How to use */}
        <section className="mt-10 space-y-4">
          <SectionLabel>Cómo usar cada formato</SectionLabel>
          <ul className="divide-y divide-border border border-border bg-card text-[13px] leading-relaxed">
            <li className="px-3 py-2.5">
              <span className="font-medium">KML</span> se abre directo en Google
              Earth y se puede importar a Google My Maps. Cada categoría es una
              capa que se puede prender y apagar.
            </li>
            <li className="px-3 py-2.5">
              <span className="font-medium">CSV</span> abre en Excel o Google
              Sheets. Si Excel mete todo en una columna, usa Datos › Texto en
              columnas, separador coma.
            </li>
            <li className="px-3 py-2.5">
              <span className="font-medium">GeoJSON</span> carga en QGIS, ArcGIS
              o cualquier visor web.
            </li>
            <li className="px-3 py-2.5">
              <span className="font-medium">JSON</span> es la misma API que usa
              el mapa. Sin llave, con CORS abierto.
            </li>
          </ul>
        </section>

        {/* Caveats */}
        <section className="mt-8 space-y-3 border border-amber-500/30 bg-amber-500/5 p-4">
          <SectionLabel>Antes de usarlos</SectionLabel>
          <ul className="space-y-2 text-[13px] leading-relaxed text-foreground/90">
            <li>
              Las coordenadas están redondeadas a una cuadrícula de ~2 km por
              privacidad de quien reporta. Sirven para priorizar zonas, no para
              llegar a una puerta específica.
            </li>
            <li>
              Son reportes ciudadanos revisados por voluntarios, no
              verificaciones en terreno. Trátalos como una pista, no como un
              parte oficial.
            </li>
            <li>
              Si necesitas la ubicación exacta de un caso puntual para una
              operación de rescate, escríbenos y lo coordinamos con el
              reportante.
            </li>
          </ul>
          <p className="text-[12px] text-muted-foreground">
            Emergencias con riesgo de vida: línea{" "}
            <span className="text-foreground">123</span>.
          </p>
        </section>

        <div className="mt-8 flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/">
              <ExternalLink className="size-3.5" />
              Ver el mapa
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
