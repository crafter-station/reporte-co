import type { NextRequest } from "next/server";
import { exportResponse } from "@/lib/export-route";

export const dynamic = "force-dynamic";

/** GET /api/reports.kml — responder download of the public feed. */
export async function GET(request: NextRequest) {
  return exportResponse(request, "kml");
}
