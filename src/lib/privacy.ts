import { createHmac } from "node:crypto";
import { env } from "@/env";

/**
 * Privacy is the load-bearing requirement of this project (see Mission 4636's
 * post-mortem: a public crisis map exposed at-risk people). Helpers here exist
 * to make "private by default" the path of least resistance.
 */

/**
 * One-way, salted hash of a reporter's phone number. We store ONLY this, never
 * the raw number, so reporters can't be deanonymized from the database while we
 * can still dedupe/count distinct senders.
 */
export function hashReporter(phone: string): string {
  const normalized = phone.replace(/[^\d]/g, "");
  return createHmac("sha256", env.REPORTER_HASH_SECRET)
    .update(normalized)
    .digest("hex")
    .slice(0, 32);
}

/**
 * One-way hash of a volunteer's contact (phone or email). Domain-separated from
 * hashReporter() with a `volunteer:` prefix, so the same person signing up to
 * help and reporting a need does NOT produce the same digest — the two
 * populations can never be correlated through the database.
 *
 * Unlike a reporter, a volunteer may also opt in to storing the raw value (see
 * `volunteers.contact`). This hash is stored either way: it is what makes
 * re-registration idempotent without depending on the raw value.
 */
export function hashVolunteerContact(contact: string): string {
  const normalized = contact.trim().toLowerCase().replace(/\s+/g, "");
  return createHmac("sha256", env.REPORTER_HASH_SECRET)
    .update(`volunteer:${normalized}`)
    .digest("hex")
    .slice(0, 32);
}

// Patterns that should never reach a public surface.
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Colombian national ID with an explicit prefix — "CC 1.234.567.890",
// "C.C. 79123456", "TI 1023456789", "CE-345678", "NIT 900.123.456-7".
const CEDULA_PREFIXED_RE =
  /\b(?:c\.?\s?c\.?|t\.?\s?i\.?|c\.?\s?e\.?|nit)[\s.:#-]*\d[\d.\s-]{5,}\d\b/gi;
// Bare dotted cédula, e.g. "79.123.456" or "1.234.567.890". The dot grouping is
// what makes this an id rather than an arbitrary number; undotted digit runs are
// caught by PHONE_RE below.
const CEDULA_BARE_RE = /\b\d{1,3}(?:\.\d{3}){2,3}\b/g;

/**
 * Strip obvious PII from free text before it can be shown publicly. This is a
 * safety net, not a substitute for the moderator authoring a clean `summary`.
 */
export function scrubPII(text: string): string {
  return text
    .replace(EMAIL_RE, "[correo oculto]")
    .replace(CEDULA_PREFIXED_RE, "[cédula oculta]")
    .replace(CEDULA_BARE_RE, "[cédula oculta]")
    .replace(PHONE_RE, "[número oculto]")
    .trim();
}

/**
 * Coarsen precise coordinates to a privacy-preserving public location by
 * snapping to a grid. Default ~0.02° ≈ 2.2 km cells: enough to be useful on a
 * map without pinpointing a specific home.
 */
export function coarsenCoords(
  lat: number,
  lng: number,
  cell = 0.02,
): { lat: number; lng: number } {
  const snap = (v: number) => Math.round(v / cell) * cell;
  return {
    lat: Number(snap(lat).toFixed(4)),
    lng: Number(snap(lng).toFixed(4)),
  };
}
