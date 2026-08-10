/**
 * Reporte CO — domain taxonomy.
 *
 * Single source of truth for report categories, severity, workflow status, and
 * Colombia's first-level administrative divisions. The DB schema, Zod
 * validators, and UI all derive from these constants so they can never drift.
 *
 * Modeled on Mission 4636's pipeline (ingest → categorize → geolocate →
 * verify → publish), retargeted to the 10 Aug 2026 M7.4 earthquake
 * (epicenter: San José del Palmar, Chocó) and its aftermath in the Eje
 * Cafetero, Valle del Cauca and Chocó.
 */

// ── Categories ────────────────────────────────────────────────────────────
// Ordered by response priority: life-safety first, then basic services.
export const CATEGORIES = [
  "rescue",
  "medical",
  "missing",
  "damage",
  "shelter",
  "water",
  "food",
  "electricity",
  "roads",
  "telecoms",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  rescue: "Rescate / atrapados",
  medical: "Heridos / salud",
  missing: "Personas desaparecidas",
  damage: "Daños estructurales",
  shelter: "Albergue / techo",
  water: "Agua",
  food: "Alimentos",
  electricity: "Electricidad",
  roads: "Vías / deslizamientos",
  telecoms: "Comunicaciones",
  other: "Otro",
};

/** Emoji + accent color per category, used on the map and in the queue. */
export const CATEGORY_META: Record<Category, { emoji: string; color: string }> =
  {
    rescue: { emoji: "🆘", color: "#dc2626" },
    medical: { emoji: "🚑", color: "#f43f5e" },
    missing: { emoji: "🔎", color: "#ec4899" },
    damage: { emoji: "🏚️", color: "#f97316" },
    shelter: { emoji: "⛺", color: "#a855f7" },
    water: { emoji: "💧", color: "#0ea5e9" },
    food: { emoji: "🍞", color: "#84cc16" },
    electricity: { emoji: "⚡", color: "#f59e0b" },
    roads: { emoji: "🛣️", color: "#94a3b8" },
    telecoms: { emoji: "📶", color: "#14b8a6" },
    other: { emoji: "📍", color: "#6b7280" },
  };

/** True when `value` is one of the canonical taxonomy categories. */
export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Resolve meta for any category string. Reporters may submit free-text
 * categories that don't exist yet (moderators recategorize later); those fall
 * back to the neutral `other` accent until reclassified.
 */
export function categoryMeta(value: string): { emoji: string; color: string } {
  return isCategory(value) ? CATEGORY_META[value] : CATEGORY_META.other;
}

/** Human label for any category string — known label or the raw custom text. */
export function categoryLabel(value: string): string {
  return isCategory(value) ? CATEGORY_LABELS[value] : value;
}

// ── Severity ──────────────────────────────────────────────────────────────
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

// ── Workflow status ───────────────────────────────────────────────────────
// pending     → just ingested, untouched
// in_review   → a moderator is structuring it
// verified    → structured + confirmed (needs N agreements before publish)
// published   → live on the public map (PII-scrubbed)
// rejected    → spam / not actionable
// duplicate   → merged into another report (see duplicateOf)
export const STATUSES = [
  "pending",
  "in_review",
  "verified",
  "published",
  "rejected",
  "duplicate",
] as const;
export type Status = (typeof STATUSES)[number];

// ── Intake sources ────────────────────────────────────────────────────────
export const SOURCES = ["whatsapp", "telegram", "web"] as const;
export type Source = (typeof SOURCES)[number];

// ── Volunteers ────────────────────────────────────────────────────────────
// The other half of the pipeline: people offering capacity rather than
// reporting a need. A volunteer's `capabilities` reuse CATEGORIES above (plus
// free-text labels, exactly like reports.categories) so an offer and a need can
// be matched on the same vocabulary.

/** How a volunteer asked to be reached. The value itself is opt-in — see schema. */
export const CONTACT_CHANNELS = ["whatsapp", "email"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Correo",
};

// pending → signed up, not yet reviewed by a moderator
// active  → cleared to receive assignments
// paused  → temporarily unavailable (travel, already at capacity elsewhere)
// blocked → spam / removed
export const VOLUNTEER_STATUSES = [
  "pending",
  "active",
  "paused",
  "blocked",
] as const;
export type VolunteerStatus = (typeof VOLUNTEER_STATUSES)[number];

export const VOLUNTEER_STATUS_LABELS: Record<VolunteerStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  paused: "En pausa",
  blocked: "Bloqueado",
};

/** Upper bound on concurrent cases a volunteer can declare. */
export const MAX_VOLUNTEER_CAPACITY = 10;

// ── Colombia first-level divisions (32 departamentos + Bogotá D.C.) ────────
// Approximate capital/centroid coords used to default the map view and to
// snap public pins to a coarse location when a precise one isn't safe to show.
// The quake-affected departments lead the list (Chocó holds the epicenter,
// then Risaralda / Caldas / Quindío / Valle del Cauca); the rest follow
// alphabetically.
export const DEPARTAMENTOS = [
  { name: "Chocó", lat: 5.69, lng: -76.66 },
  { name: "Risaralda", lat: 4.81, lng: -75.7 },
  { name: "Caldas", lat: 5.07, lng: -75.52 },
  { name: "Quindío", lat: 4.53, lng: -75.68 },
  { name: "Valle del Cauca", lat: 3.45, lng: -76.53 },
  { name: "Amazonas", lat: -4.21, lng: -69.94 },
  { name: "Antioquia", lat: 6.24, lng: -75.57 },
  { name: "Arauca", lat: 7.08, lng: -70.76 },
  { name: "Atlántico", lat: 10.97, lng: -74.78 },
  { name: "Bogotá D.C.", lat: 4.71, lng: -74.07 },
  { name: "Bolívar", lat: 10.39, lng: -75.48 },
  { name: "Boyacá", lat: 5.54, lng: -73.37 },
  { name: "Caquetá", lat: 1.61, lng: -75.61 },
  { name: "Casanare", lat: 5.34, lng: -72.4 },
  { name: "Cauca", lat: 2.44, lng: -76.61 },
  { name: "Cesar", lat: 10.46, lng: -73.25 },
  { name: "Córdoba", lat: 8.75, lng: -75.88 },
  { name: "Cundinamarca", lat: 4.9, lng: -74.3 },
  { name: "Guainía", lat: 3.87, lng: -67.92 },
  { name: "Guaviare", lat: 2.57, lng: -72.64 },
  { name: "Huila", lat: 2.93, lng: -75.29 },
  { name: "La Guajira", lat: 11.54, lng: -72.91 },
  { name: "Magdalena", lat: 11.24, lng: -74.2 },
  { name: "Meta", lat: 4.14, lng: -73.63 },
  { name: "Nariño", lat: 1.21, lng: -77.28 },
  { name: "Norte de Santander", lat: 7.89, lng: -72.51 },
  { name: "Putumayo", lat: 1.15, lng: -76.65 },
  { name: "San Andrés y Providencia", lat: 12.58, lng: -81.7 },
  { name: "Santander", lat: 7.12, lng: -73.12 },
  { name: "Sucre", lat: 9.3, lng: -75.4 },
  { name: "Tolima", lat: 4.44, lng: -75.23 },
  { name: "Vaupés", lat: 1.2, lng: -70.17 },
  { name: "Vichada", lat: 6.19, lng: -67.49 },
] as const;

export const DEPARTAMENTO_NAMES = DEPARTAMENTOS.map((d) => d.name);
export type DepartamentoName = (typeof DEPARTAMENTOS)[number]["name"];

/** Geographic center of Colombia — used when showing the whole country. */
export const COLOMBIA_CENTER = { lat: 4.6, lng: -74.3, zoom: 5 };

/**
 * Map pan limits, as Mapbox [[swLng, swLat], [neLng, neLat]]. Constrains the
 * map to Colombia (mainland plus the San Andrés archipelago and a little
 * padding) so you can never drift away from the country.
 */
export const COLOMBIA_BOUNDS: [[number, number], [number, number]] = [
  [-82.3, -4.6],
  [-66.5, 13.6],
];

/** Zoom range: country overview ↔ street level. */
export const MAP_MIN_ZOOM = 4.6;
export const MAP_MAX_ZOOM = 19;

/**
 * Epicenter of the 10 Aug 2026 M7.4 earthquake — ~5 km east of San José del
 * Palmar, Chocó, at ~103 km depth (Servicio Geológico Colombiano; USGS puts it
 * at 4.9031 / -76.1885, 107 km).
 */
export const EPICENTRO = {
  lat: 4.9031,
  lng: -76.1885,
  zoom: 8.4,
  label: "San José del Palmar, Chocó",
};

/**
 * Default map view: the affected corridor. Frames Quibdó and the epicenter in
 * Chocó through the Eje Cafetero (Pereira, Manizales, Armenia) down to Cali,
 * so the whole damage zone and its point detail are visible at once.
 */
export const ZONA_AFECTADA = { lat: 4.5, lng: -75.9, zoom: 7.2 };

export function departamentoCentroid(
  name: string,
): { lat: number; lng: number } | null {
  const match = DEPARTAMENTOS.find((d) => d.name === name);
  return match ? { lat: match.lat, lng: match.lng } : null;
}
