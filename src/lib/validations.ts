import { z } from "zod";
import {
  CATEGORIES,
  CONTACT_CHANNELS,
  DEPARTAMENTO_NAMES,
  MAX_VOLUNTEER_CAPACITY,
  SEVERITIES,
  SOURCES,
  STATUSES,
} from "./taxonomy";

// Enum validators derived from the taxonomy (single source of truth).
export const categorySchema = z.enum(CATEGORIES);
export const severitySchema = z.enum(SEVERITIES);
export const statusSchema = z.enum(STATUSES);
export const sourceSchema = z.enum(SOURCES);
export const departamentoSchema = z.enum(
  DEPARTAMENTO_NAMES as [string, ...string[]],
);

const latSchema = z.number().min(-90).max(90);
const lngSchema = z.number().min(-180).max(180);

/**
 * Public web-form submission (anonymous, no account).
 * Mirrors what a WhatsApp message carries, but typed for the API boundary.
 */
export const webReportSchema = z.object({
  text: z.string().trim().min(3, "Cuéntanos qué está pasando").max(2000),
  // One report can touch several needs at once (e.g. atrapados + heridos), and
  // a reporter may add a free-text category we don't have yet — moderators
  // recategorize later, so we accept any short label, not just the enum.
  categories: z
    .array(z.string().trim().min(1).max(40))
    .max(8)
    .optional()
    .transform((v) => (v ? Array.from(new Set(v)) : v)),
  departamento: departamentoSchema.optional(),
  municipio: z.string().trim().max(120).optional(),
  barrio: z.string().trim().max(120).optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
});
export type WebReportInput = z.infer<typeof webReportSchema>;

/**
 * Moderator action: structure + verify a report from the queue.
 * Geo + category are required to move a report toward `verified`.
 */
export const moderateReportSchema = z.object({
  category: categorySchema,
  severity: severitySchema,
  summary: z.string().trim().min(3).max(280),
  departamento: departamentoSchema,
  municipio: z.string().trim().max(120).optional(),
  barrio: z.string().trim().max(120).optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
  note: z.string().trim().max(500).optional(),
  // Subset of the report's private media paths the moderator approved to
  // publish on the public map pin.
  publishMedia: z.array(z.string().trim().min(1)).max(3).optional(),
});
export type ModerateReportInput = z.infer<typeof moderateReportSchema>;

export const contactChannelSchema = z.enum(CONTACT_CHANNELS);

/**
 * Volunteer sign-up. The mirror image of `webReportSchema`: instead of a need,
 * it carries an offer of capacity.
 *
 * Contact is opt-in. `contact` is only accepted alongside an explicit
 * `contactConsent`, and the refine below makes the two impossible to separate —
 * so a raw contact can never be persisted without consent on record.
 */
export const volunteerSchema = z
  .object({
    // Capabilities mirror reports.categories: taxonomy keys plus free-text
    // labels a moderator can reconcile later.
    capabilities: z
      .array(z.string().trim().min(1).max(40))
      .min(1, "Elige al menos una forma de ayudar")
      .max(8)
      .transform((v) => Array.from(new Set(v))),
    departamento: departamentoSchema,
    municipio: z.string().trim().max(120).optional(),
    capacity: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_VOLUNTEER_CAPACITY)
      .default(1),
    displayName: z.string().trim().max(60).optional(),
    notes: z.string().trim().max(500).optional(),
    contactChannel: contactChannelSchema,
    contact: z.string().trim().min(5).max(120),
    // Explicit opt-in to being contacted. Without it the raw contact is dropped
    // and only the hash is kept.
    contactConsent: z.boolean().default(false),
  })
  .refine((d) => d.contactChannel !== "email" || d.contact.includes("@"), {
    message: "Correo inválido",
    path: ["contact"],
  });
export type VolunteerInput = z.infer<typeof volunteerSchema>;

/** Filters accepted by the public map/feed endpoint. */
export const publicQuerySchema = z.object({
  category: categorySchema.optional(),
  severity: severitySchema.optional(),
  departamento: departamentoSchema.optional(),
});
export type PublicQueryInput = z.infer<typeof publicQuerySchema>;
