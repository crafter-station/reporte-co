import type { NextRequest } from "next/server";
import { getPublicReports } from "@/db/queries";
import { toCSV, toGeoJSON, toKML, triageSort } from "./export";
import { publicQuerySchema } from "./validations";

type Format = "csv" | "geojson" | "kml";

const SERIALIZERS = {
  csv: {
    render: toCSV,
    contentType: "text/csv; charset=utf-8",
    filename: "reportes-co.csv",
  },
  geojson: {
    render: toGeoJSON,
    contentType: "application/geo+json; charset=utf-8",
    filename: "reportes-co.geojson",
  },
  kml: {
    render: toKML,
    contentType: "application/vnd.google-earth.kml+xml; charset=utf-8",
    filename: "reportes-co.kml",
  },
} as const satisfies Record<
  Format,
  { render: (r: never[]) => string; contentType: string; filename: string }
>;

/**
 * Shared handler for the responder download endpoints. Same filters as the
 * JSON feed (`?category=&severity=&departamento=`), same published-only data.
 *
 * CORS is open because the point is for someone else's dashboard, notebook or
 * spreadsheet to pull this directly. Everything served here is already public.
 */
export async function exportResponse(
  request: NextRequest,
  format: Format,
): Promise<Response> {
  const parsed = publicQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = (await getPublicReports(parsed.data)).sort(triageSort);
  const { render, contentType, filename } = SERIALIZERS[format];

  return new Response(render(data as never[]), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=60, s-maxage=60",
    },
  });
}
