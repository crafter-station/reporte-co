/**
 * Seed sample published reports — Reporte CO.
 *
 * Populates the public map with realistic, PII-free demo points so the
 * clustering, category colors, and multi-category popups can be evaluated.
 * Heavily weighted to the corridor hit by the 10 Aug 2026 M7.4 quake —
 * Chocó (epicenter) → Eje Cafetero → Valle del Cauca — so the cluster
 * behavior is visible at the default zoom.
 *
 * Idempotent: every row id is prefixed `seed_`, and the script clears the
 * previous batch before inserting, so it's safe to re-run. To remove the demo
 * data entirely:  delete from reports where id like 'seed_%';
 *
 *   bun --env-file=.env.local scripts/seed-reports.ts
 */
import { like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { type NewReport, reports } from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✗ DATABASE_URL is missing — run with --env-file=.env.local");
  process.exit(1);
}

// Places, weighted by `n` — Pereira, Manizales, Armenia and Cali dominate
// (worst-hit cities), with Chocó around the epicenter and a thin tail of
// secondary cities for national context.
const PLACES = [
  // ── Risaralda ──
  {
    departamento: "Risaralda",
    municipio: "Pereira",
    barrio: "Cuba",
    lat: 4.799,
    lng: -75.717,
    n: 3,
  },
  {
    departamento: "Risaralda",
    municipio: "Pereira",
    barrio: "Centro",
    lat: 4.8135,
    lng: -75.6944,
    n: 3,
  },
  {
    departamento: "Risaralda",
    municipio: "Pereira",
    barrio: "Villa Santana",
    lat: 4.813,
    lng: -75.669,
    n: 2,
  },
  {
    departamento: "Risaralda",
    municipio: "Dosquebradas",
    barrio: "Santa Mónica",
    lat: 4.835,
    lng: -75.674,
    n: 2,
  },
  // ── Caldas ──
  {
    departamento: "Caldas",
    municipio: "Manizales",
    barrio: "Centro",
    lat: 5.0703,
    lng: -75.5138,
    n: 3,
  },
  {
    departamento: "Caldas",
    municipio: "Manizales",
    barrio: "Chipre",
    lat: 5.071,
    lng: -75.529,
    n: 2,
  },
  {
    departamento: "Caldas",
    municipio: "Villamaría",
    barrio: "Centro",
    lat: 5.045,
    lng: -75.512,
    n: 1,
  },
  // ── Quindío ──
  {
    departamento: "Quindío",
    municipio: "Armenia",
    barrio: "Centro",
    lat: 4.535,
    lng: -75.68,
    n: 3,
  },
  {
    departamento: "Quindío",
    municipio: "Calarcá",
    barrio: "Centro",
    lat: 4.523,
    lng: -75.643,
    n: 1,
  },
  // ── Valle del Cauca ──
  {
    departamento: "Valle del Cauca",
    municipio: "Cali",
    barrio: "San Antonio",
    lat: 3.4467,
    lng: -76.5416,
    n: 3,
  },
  {
    departamento: "Valle del Cauca",
    municipio: "Cali",
    barrio: "Siloé",
    lat: 3.428,
    lng: -76.556,
    n: 2,
  },
  {
    departamento: "Valle del Cauca",
    municipio: "Cali",
    barrio: "El Poblado",
    lat: 3.418,
    lng: -76.474,
    n: 2,
  },
  {
    departamento: "Valle del Cauca",
    municipio: "Cartago",
    barrio: "Centro",
    lat: 4.7469,
    lng: -75.9116,
    n: 1,
  },
  {
    departamento: "Valle del Cauca",
    municipio: "Tuluá",
    barrio: "Centro",
    lat: 4.0847,
    lng: -76.1954,
    n: 1,
  },
  {
    departamento: "Valle del Cauca",
    municipio: "Buenaventura",
    barrio: "Centro",
    lat: 3.8801,
    lng: -77.0312,
    n: 1,
  },
  // ── Chocó (epicenter) ──
  {
    departamento: "Chocó",
    municipio: "San José del Palmar",
    barrio: "Centro",
    lat: 4.8965,
    lng: -76.2286,
    n: 3,
  },
  {
    departamento: "Chocó",
    municipio: "Nóvita",
    barrio: "Centro",
    lat: 4.955,
    lng: -76.606,
    n: 1,
  },
  {
    departamento: "Chocó",
    municipio: "Quibdó",
    barrio: "Centro",
    lat: 5.6947,
    lng: -76.6611,
    n: 2,
  },
  // ── Resto del país ──
  {
    departamento: "Antioquia",
    municipio: "Medellín",
    barrio: "Laureles",
    lat: 6.2442,
    lng: -75.5812,
    n: 1,
  },
  {
    departamento: "Bogotá D.C.",
    municipio: "Bogotá",
    barrio: "Chapinero",
    lat: 4.649,
    lng: -74.062,
    n: 1,
  },
  {
    departamento: "Tolima",
    municipio: "Ibagué",
    barrio: "Centro",
    lat: 4.4389,
    lng: -75.2322,
    n: 1,
  },
];

// Report "profiles": a primary category, optional extra categories (multi-tag),
// some with a free-text custom label that doesn't exist in the taxonomy yet.
const PROFILES: {
  category: string;
  extra: string[];
  severity: string;
  custom?: string;
}[] = [
  { category: "rescue", extra: ["damage"], severity: "critical" },
  { category: "damage", extra: [], severity: "high" },
  { category: "medical", extra: ["rescue"], severity: "critical" },
  { category: "shelter", extra: ["food"], severity: "high" },
  { category: "water", extra: [], severity: "high" },
  { category: "electricity", extra: ["telecoms"], severity: "medium" },
  { category: "roads", extra: [], severity: "high" },
  { category: "missing", extra: [], severity: "critical" },
  { category: "damage", extra: ["shelter"], severity: "high" },
  { category: "food", extra: ["water"], severity: "medium" },
  { category: "telecoms", extra: [], severity: "medium" },
  { category: "other", extra: [], severity: "low", custom: "Gas domiciliario" },
  {
    category: "other",
    extra: ["damage"],
    severity: "medium",
    custom: "Réplicas sentidas",
  },
  { category: "medical", extra: [], severity: "high" },
  { category: "shelter", extra: [], severity: "medium" },
];

const SUMMARY: Record<string, (p: string) => string> = {
  rescue: (p) =>
    `Vivienda colapsada en ${p}; vecinos reportan personas atrapadas entre los escombros.`,
  medical: (p) =>
    `Varios heridos por caída de estructuras en ${p}; el centro de salud está desbordado.`,
  missing: (p) =>
    `Familias buscan a personas no localizadas tras el derrumbe en ${p}.`,
  damage: (p) =>
    `Edificación con muros agrietados y riesgo de colapso en ${p}; evacuada por precaución.`,
  shelter: (p) =>
    `Familias sin techo pasando la noche a la intemperie en ${p}; se necesitan albergue y colchonetas.`,
  water: (p) =>
    `Sin agua por daño en la red de acueducto tras el sismo en ${p}.`,
  food: (p) =>
    `Familias evacuadas en ${p} sin alimentos ni agua potable desde la mañana.`,
  electricity: (p) => `Sin energía eléctrica desde el sismo en ${p}.`,
  roads: (p) =>
    `Deslizamiento bloquea la vía en ${p}; paso restringido en ambos sentidos.`,
  telecoms: (p) =>
    `Sin señal de telefonía móvil ni internet en ${p} desde el sismo.`,
  other: (p) => `Afectación reportada tras el sismo en ${p}.`,
};

const jitter = () => (Math.random() - 0.5) * 0.012; // ≈ ±0.65 km
const round4 = (v: number) => Number(v.toFixed(4));

function buildRows(): NewReport[] {
  const rows: NewReport[] = [];
  let i = 0;
  for (const place of PLACES) {
    for (let k = 0; k < place.n; k++) {
      const profile = PROFILES[i % PROFILES.length];
      const summaryFn = SUMMARY[profile.category] ?? SUMMARY.other;
      const summary = profile.custom
        ? `${profile.custom}: afectación reportada en ${place.barrio}, ${place.municipio}.`
        : summaryFn(`${place.barrio}, ${place.municipio}`);
      // Reporter-tagged categories: custom label leads when present.
      const categories = Array.from(
        new Set(
          profile.custom
            ? [profile.custom, ...profile.extra]
            : [profile.category, ...profile.extra],
        ),
      );

      // Everything is post-quake: reports land within the last ~10 hours.
      const ageMinutes = Math.floor(Math.random() * 10 * 60);
      const publishedAt = new Date(Date.now() - ageMinutes * 60_000);
      const createdAt = new Date(publishedAt.getTime() - 25 * 60_000);

      rows.push({
        id: `seed_${String(i + 1).padStart(3, "0")}`,
        source: "web",
        rawText: summary,
        category: profile.category as NewReport["category"],
        categories,
        severity: profile.severity as NewReport["severity"],
        summary,
        departamento: place.departamento,
        municipio: place.municipio,
        barrio: place.barrio,
        // Precise coords stay internal/null — only the coarse public point.
        publicLat: round4(place.lat + jitter()),
        publicLng: round4(place.lng + jitter()),
        status: "published",
        publishedAt,
        createdAt,
        updatedAt: publishedAt,
      });
      i++;
    }
  }
  return rows;
}

async function main() {
  const client = postgres(DATABASE_URL as string, { prepare: false, max: 1 });
  const db = drizzle(client);
  try {
    const rows = buildRows();
    const cleared = await db
      .delete(reports)
      .where(like(reports.id, "seed_%"))
      .returning({ id: reports.id });
    await db.insert(reports).values(rows);
    console.log(
      `✓ Cleared ${cleared.length} previous seed rows, inserted ${rows.length} published sample reports.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
