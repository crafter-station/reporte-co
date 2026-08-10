import type { PublicReport } from "@/db/schema";
import {
  categoryLabel,
  categoryMeta,
  SEVERITY_LABELS,
  type Severity,
} from "./taxonomy";

/**
 * Machine-readable exports of the public feed.
 *
 * A map you can only look at dispatches nobody. These serializers are what let
 * Defensa Civil, bomberos, an alcaldía or an NGO pull the same data into the
 * tools they already use: Excel/Sheets (CSV), Google Earth (KML), QGIS/ArcGIS
 * (GeoJSON). Everything here reads from PublicReport, so it can only ever
 * contain fields already cleared for publication.
 */

const BOGOTA = "America/Bogota";

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  timeZone: BOGOTA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Local (Bogotá) timestamp, the only one a field team cares about. */
export function localTime(d: Date | null): string {
  return d ? dateFmt.format(d).replace(",", "") : "";
}

/** Severity ordered for triage: most urgent first. */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Sort for responders: severity first, then most recent. */
export function triageSort(a: PublicReport, b: PublicReport): number {
  const ra = a.severity ? SEVERITY_RANK[a.severity] : 4;
  const rb = b.severity ? SEVERITY_RANK[b.severity] : 4;
  if (ra !== rb) return ra - rb;
  const ta = (a.publishedAt ?? a.createdAt).getTime();
  const tb = (b.publishedAt ?? b.createdAt).getTime();
  return tb - ta;
}

/** A `maps.google.com` link is what actually gets used in the field. */
export function mapsLink(lat: number | null, lng: number | null): string {
  return lat != null && lng != null
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : "";
}

function severityLabel(s: Severity | null): string {
  return s ? SEVERITY_LABELS[s] : "";
}

// ── CSV ───────────────────────────────────────────────────────────────────
const CSV_HEADERS = [
  "folio",
  "fecha",
  "categoria",
  "severidad",
  "departamento",
  "municipio",
  "barrio",
  "latitud",
  "longitud",
  "resumen",
  "categorias_reportadas",
  "mapa",
] as const;

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  // Quote when the value could otherwise break the row, and double any quotes.
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * RFC 4180 CSV, prefixed with a UTF-8 BOM so Excel renders "Chocó" and
 * "Quindío" correctly instead of mojibake.
 */
export function toCSV(reports: PublicReport[]): string {
  const rows = [CSV_HEADERS.join(",")];
  for (const r of reports) {
    rows.push(
      [
        r.id,
        localTime(r.publishedAt ?? r.createdAt),
        r.category ? categoryLabel(r.category) : "",
        severityLabel(r.severity),
        r.departamento ?? "",
        r.municipio ?? "",
        r.barrio ?? "",
        r.lat ?? "",
        r.lng ?? "",
        r.summary ?? "",
        r.categories.map(categoryLabel).join(" · "),
        mapsLink(r.lat, r.lng),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `﻿${rows.join("\r\n")}\r\n`;
}

// ── GeoJSON ───────────────────────────────────────────────────────────────
/** FeatureCollection for QGIS, ArcGIS, Mapbox, Leaflet, kepler.gl, etc. */
export function toGeoJSON(reports: PublicReport[]): string {
  return JSON.stringify(
    {
      type: "FeatureCollection",
      features: reports
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [r.lng, r.lat] },
          properties: {
            folio: r.id,
            categoria: r.category,
            categoria_label: r.category ? categoryLabel(r.category) : null,
            categorias: r.categories,
            severidad: r.severity,
            severidad_label: severityLabel(r.severity),
            resumen: r.summary,
            departamento: r.departamento,
            municipio: r.municipio,
            barrio: r.barrio,
            fecha: (r.publishedAt ?? r.createdAt).toISOString(),
            fecha_local: localTime(r.publishedAt ?? r.createdAt),
          },
        })),
    },
    null,
    2,
  );
}

// ── KML ───────────────────────────────────────────────────────────────────
function xmlEscape(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c] as string,
  );
}

/** KML wants aabbggrr, the reverse of the #rrggbb we use everywhere else. */
function kmlColor(hex: string): string {
  const h = hex.replace("#", "");
  return `ff${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`;
}

/**
 * KML for Google Earth, which is what field teams and local emergency offices
 * actually have open. Grouped into one folder per category so layers can be
 * toggled independently.
 */
export function toKML(reports: PublicReport[]): string {
  const placed = reports.filter((r) => r.lat != null && r.lng != null);
  const keys = Array.from(
    new Set(placed.map((r) => r.category ?? r.categories[0] ?? "other")),
  );

  const styles = keys
    .map((k) => {
      const meta = categoryMeta(k);
      return `    <Style id="cat-${xmlEscape(k)}">
      <IconStyle>
        <color>${kmlColor(meta.color)}</color>
        <scale>1.1</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
    </Style>`;
    })
    .join("\n");

  const folders = keys
    .map((k) => {
      const items = placed.filter(
        (r) => (r.category ?? r.categories[0] ?? "other") === k,
      );
      const marks = items
        .map((r) => {
          const place = [r.barrio, r.municipio, r.departamento]
            .filter(Boolean)
            .join(", ");
          const desc = [
            r.summary ?? "",
            "",
            `Severidad: ${severityLabel(r.severity) || "sin clasificar"}`,
            `Ubicación: ${place || "sin ubicación"}`,
            `Reportado: ${localTime(r.publishedAt ?? r.createdAt)}`,
            `Folio: ${r.id}`,
          ].join("\n");
          return `      <Placemark>
        <name>${xmlEscape(`${categoryLabel(k)} · ${r.municipio ?? "sin municipio"}`)}</name>
        <description>${xmlEscape(desc)}</description>
        <styleUrl>#cat-${xmlEscape(k)}</styleUrl>
        <Point><coordinates>${r.lng},${r.lat},0</coordinates></Point>
      </Placemark>`;
        })
        .join("\n");
      return `    <Folder>
      <name>${xmlEscape(categoryLabel(k))} (${items.length})</name>
${marks}
    </Folder>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Reporte CO · sismo 10 ago 2026</name>
    <description>Reportes ciudadanos verificados. Ubicaciones aproximadas por privacidad. co.crafter.run</description>
${styles}
${folders}
  </Document>
</kml>
`;
}
