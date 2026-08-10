import { ImageResponse } from "next/og";
import { getPublicCounts } from "@/db/queries";
import { loadOgFonts, OgCard } from "@/lib/og-card";

export const alt = "Reporte CO · Mapa ciudadano del sismo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Crawlers refetch these often; 5 minutes keeps the count fresh without
// hammering the database on every share.
export const revalidate = 300;

export default async function Image() {
  // The live count is a nice signal but never worth a broken card.
  let stats: string | undefined;
  try {
    const { total, critical } = await getPublicCounts();
    if (total > 0) {
      stats = `${total} reportes${critical ? ` · ${critical} críticos` : ""}`;
    }
  } catch {
    stats = undefined;
  }

  return new ImageResponse(
    <OgCard
      title="Sismo en Colombia"
      subtitle="Reporta daños y necesidades. Anónimo."
      url="co.crafter.run"
      stats={stats}
    />,
    { ...size, fonts: await loadOgFonts() },
  );
}
