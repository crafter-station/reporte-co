import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  Category,
  ContactChannel,
  Severity,
  Source,
  Status,
  VolunteerStatus,
} from "@/lib/taxonomy";

/**
 * reports — every inbound signal becomes one row.
 *
 * Privacy model (Mission 4636's #1 lesson — "default to private data"):
 *   • We never store a raw phone number; only a salted hash (reporterHash).
 *   • rawText / lat / lng / mediaUrl are INTERNAL ONLY (moderation surface).
 *   • publicLat / publicLng are coarsened (e.g. parish/departamento centroid) and are
 *     the ONLY coordinates ever served to the public map.
 *   • A report is invisible to the public until status === 'published'.
 */
export const reports = pgTable(
  "reports",
  {
    // Short id doubles as the human-facing ticket number (e.g. in the auto-reply).
    id: text("id").primaryKey(),

    // ── Intake ──
    source: text("source").$type<Source>().notNull(),
    // Provider message id (e.g. WhatsApp wamid) — used for idempotency.
    sourceRef: text("source_ref"),
    // Salted hash of the reporter's phone number. NEVER the raw number.
    reporterHash: text("reporter_hash"),
    // Original message text — internal only, scrubbed before anything is public.
    rawText: text("raw_text"),
    // Internal-only link to any attached media (photo of a queue, outage, etc.).
    mediaUrl: text("media_url"),
    // Internal-only storage paths (private bucket) of photos a reporter attached
    // as supporting evidence. Visible only to moderators via signed URLs.
    media: jsonb("media").$type<string[]>().notNull().default([]),
    // Public URLs of the photos a moderator explicitly approved for the map
    // (EXIF-stripped on upload). Empty until a moderator publishes one.
    publicMedia: jsonb("public_media").$type<string[]>().notNull().default([]),

    // ── Structuring (filled by the crowd / moderators) ──
    // Primary category — moderator-assigned; drives the map color & filters.
    category: text("category").$type<Category>(),
    // All categories a reporter tagged (may be several at once, and may include
    // free-text labels not yet in the taxonomy). Hints until a moderator sets
    // the canonical `category`; never constrained to the enum at the DB layer.
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    severity: text("severity").$type<Severity>(),
    status: text("status").$type<Status>().notNull().default("pending"),
    // Human-readable summary shown publicly (no PII).
    summary: text("summary"),

    // ── Geo ──
    departamento: text("departamento"),
    municipio: text("municipio"),
    barrio: text("barrio"),
    // Precise coords — INTERNAL ONLY.
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // Coarsened coords — the only ones exposed publicly.
    publicLat: doublePrecision("public_lat"),
    publicLng: doublePrecision("public_lng"),

    // ── Verification / dedupe ──
    // Set of moderator ids who confirmed this report (agreement => publishable).
    verifiedBy: jsonb("verified_by").$type<string[]>().notNull().default([]),
    // If this is a duplicate, point at the canonical report.
    duplicateOf: text("duplicate_of"),
    moderatorNote: text("moderator_note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_status_idx").on(t.status),
    index("reports_category_idx").on(t.category),
    index("reports_departamento_idx").on(t.departamento),
    index("reports_created_at_idx").on(t.createdAt),
    // Fast idempotency lookups on inbound webhook retries.
    index("reports_source_ref_idx").on(t.sourceRef),
  ],
);

/**
 * audit_log — append-only trail of every state change on a report.
 * Critical for a tool operating under an adversarial threat model: who did what.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_report_id_idx").on(t.reportId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
);

/**
 * volunteers — the other side of the pipeline: people offering capacity.
 *
 * Same privacy tiering as `reports`: sensitive values may live here, but they
 * never reach a public surface.
 *   • RLS is enabled with NO policies, so the table is deny-by-default. This
 *     matters on Supabase specifically: PostgREST auto-exposes every table in
 *     the `public` schema, and the anon key ships in the browser bundle — so
 *     without RLS this table would be readable at /rest/v1/volunteers by
 *     anyone who opened devtools. The app is unaffected: it connects as the
 *     table owner over DATABASE_URL, which bypasses RLS.
 *   • There is NO public read path to this table. Volunteers are never listed
 *     publicly and no volunteer field is ever broadcast over Realtime.
 *   • contactHash is always stored (dedupe), domain-separated from reporter
 *     hashes. The raw `contact` is stored ONLY on explicit opt-in: unlike a
 *     reporter, whose number arrives embedded in a WhatsApp message, a
 *     volunteer signs up precisely in order to be contacted.
 *   • Free text (displayName, notes) is scrubbed with scrubPII() on write.
 *   • Geography is coarse by construction — departamento/municipio, never
 *     coordinates. A volunteer's home is as sensitive as a reporter's.
 */
export const volunteers = pgTable(
  "volunteers",
  {
    // Short id doubles as the human-facing folio, e.g. "VOL-4H8TNQ2X".
    id: text("id").primaryKey(),

    // ── Identity ──
    // Salted hash of the volunteer's phone/email. Always present — this is what
    // makes re-registration idempotent, with no dependency on the raw value.
    contactHash: text("contact_hash").notNull(),
    contactChannel: text("contact_channel").$type<ContactChannel>().notNull(),
    // The raw contact, stored ONLY when the volunteer opts in to being reached.
    // Internal-only, same tier as reports.rawText and the precise coordinates:
    // no endpoint returns it, it never goes over Realtime, and it never renders
    // on a public surface.
    contact: text("contact"),
    // When that consent was given. Null means no consent on file, so nothing may
    // contact this person. Clearing `contact` revokes it.
    contactConsentAt: timestamp("contact_consent_at", { withTimezone: true }),
    // Optional alias. Scrubbed on write; a real name is never required.
    displayName: text("display_name"),

    // ── The offer ──
    // Needs this person can cover. Mirrors reports.categories: taxonomy values
    // plus free-text labels, so an offer and a need share one vocabulary.
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    departamento: text("departamento"),
    municipio: text("municipio"),
    // How many cases this person can hold at once. Inert until assignments
    // land; collected here because it is part of the offer.
    capacity: integer("capacity").notNull().default(1),
    // Free-text detail (vehicle, schedule, certifications). Scrubbed on write.
    notes: text("notes"),

    // Signing up grants nothing: a moderator moves a volunteer to `active`.
    status: text("status")
      .$type<VolunteerStatus>()
      .notNull()
      .default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One row per person — makes re-registration idempotent, like sourceRef.
    uniqueIndex("volunteers_contact_hash_idx").on(t.contactHash),
    index("volunteers_status_idx").on(t.status),
    index("volunteers_departamento_idx").on(t.departamento),
  ],
).enableRLS();

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;
export type Volunteer = typeof volunteers.$inferSelect;
export type NewVolunteer = typeof volunteers.$inferInsert;

/** Columns safe to expose to the public map — no PII, coarsened geo only. */
export const PUBLIC_REPORT_COLUMNS = {
  id: reports.id,
  category: reports.category,
  categories: reports.categories,
  severity: reports.severity,
  summary: reports.summary,
  departamento: reports.departamento,
  municipio: reports.municipio,
  barrio: reports.barrio,
  lat: reports.publicLat,
  lng: reports.publicLng,
  media: reports.publicMedia,
  createdAt: reports.createdAt,
  publishedAt: reports.publishedAt,
} as const;

/** Shape of a report as served to the public map/feed. */
export type PublicReport = {
  id: string;
  category: Category | null;
  categories: string[];
  severity: Severity | null;
  summary: string | null;
  departamento: string | null;
  municipio: string | null;
  barrio: string | null;
  lat: number | null;
  lng: number | null;
  // Public, moderator-approved photo URLs (empty for most reports).
  media: string[];
  createdAt: Date;
  publishedAt: Date | null;
};

// Keep `sql` import meaningful for future default expressions / generated cols.
export const _schemaVersion = sql`1`;
