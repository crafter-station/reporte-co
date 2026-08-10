import type { NextRequest } from "next/server";
import { volunteerSchema } from "@/lib/validations";
import { registerVolunteer } from "@/lib/volunteers";

export const dynamic = "force-dynamic";

/**
 * POST /api/volunteers — volunteer sign-up.
 *
 * There is deliberately no GET: volunteers are never listed publicly, so this
 * table has no public read path at all. The needs a volunteer browses come from
 * GET /api/reports, which is already PII-free.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const parsed = volunteerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_volunteer", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, updated } = await registerVolunteer(parsed.data);
  return Response.json({ id, updated }, { status: updated ? 200 : 201 });
}
