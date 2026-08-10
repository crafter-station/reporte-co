import { NeedsList } from "@/components/needs-list";
import { getPublicReports } from "@/db/queries";

export const metadata = { title: "Necesidades · Reporte CO" };

// Always reflect the latest published reports.
export const dynamic = "force-dynamic";

export default async function NecesidadesPage() {
  // Same query as the public map: published only, PII-scrubbed, coarsened geo.
  const reports = await getPublicReports({});

  return <NeedsList reports={reports} />;
}
