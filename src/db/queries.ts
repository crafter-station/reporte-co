import { and, desc, eq, sql } from "drizzle-orm";
import type { PublicQueryInput } from "@/lib/validations";
import { db } from "./index";
import { type PublicReport, type Report, reports } from "./schema";

/**
 * Public map/feed query. Returns ALL published reports with coarsened coords
 * and no PII (no time window — everything published is always shown). This is
 * the single function the public surface is allowed to call.
 */
export async function getPublicReports(
  filters: PublicQueryInput,
): Promise<PublicReport[]> {
  const where = and(
    eq(reports.status, "published"),
    filters.category ? eq(reports.category, filters.category) : undefined,
    filters.severity ? eq(reports.severity, filters.severity) : undefined,
    filters.departamento
      ? eq(reports.departamento, filters.departamento)
      : undefined,
  );

  return db
    .select({
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
    })
    .from(reports)
    .where(where)
    .orderBy(desc(reports.publishedAt))
    .limit(1000);
}

/**
 * Cheap published-report tallies for the OG cards, which only need two
 * numbers and must not pull a thousand rows on every crawler hit.
 */
export async function getPublicCounts(
  departamento?: string,
): Promise<{ total: number; critical: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      critical: sql<number>`(count(*) filter (where ${reports.severity} = 'critical'))::int`,
    })
    .from(reports)
    .where(
      and(
        eq(reports.status, "published"),
        departamento ? eq(reports.departamento, departamento) : undefined,
      ),
    );
  return row ?? { total: 0, critical: 0 };
}

/** Moderation queue — newest unprocessed reports first. Internal surface. */
export async function getQueue(
  status: Report["status"] = "pending",
): Promise<Report[]> {
  return db
    .select()
    .from(reports)
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(100);
}

export async function getReport(id: string): Promise<Report | undefined> {
  return db.query.reports.findFirst({ where: eq(reports.id, id) });
}

/** Counts per status — drives the queue dashboard header. */
export async function getStatusCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: reports.status, count: sql<number>`count(*)::int` })
    .from(reports)
    .groupBy(reports.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}
