import { z } from "zod";
import {
  CATEGORIES,
  DEPARTAMENTO_NAMES,
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

/** Filters accepted by the public map/feed endpoint. */
export const publicQuerySchema = z.object({
  category: categorySchema.optional(),
  severity: severitySchema.optional(),
  departamento: departamentoSchema.optional(),
});
export type PublicQueryInput = z.infer<typeof publicQuerySchema>;
