import { ImageResponse } from "next/og";
import { getPublicCounts } from "@/db/queries";
import { loadOgFonts, OgCard } from "@/lib/og-card";
import { findCiudad } from "@/lib/taxonomy";

export const alt = "Reporte CO · Mapa ciudadano del sismo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

export default async function Image({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}) {
  const { ciudad } = await params;
  const city = findCiudad(ciudad);

  // Counts are per departamento, so the label says so rather than implying
  // every one of them is inside the city limits.
  let stats: string | undefined;
  if (city) {
    try {
      const { total } = await getPublicCounts(city.departamento);
      if (total > 0) stats = `${total} reportes en ${city.departamento}`;
    } catch {
      stats = undefined;
    }
  }

  return new ImageResponse(
    <OgCard
      title={city ? city.name : "Sismo en Colombia"}
      subtitle={
        city
          ? `${city.departamento} · Sismo del 10 de agosto de 2026`
          : "Reporta daños y necesidades. Anónimo."
      }
      url={city ? `co.crafter.run/${city.slug}` : "co.crafter.run"}
      stats={stats}
    />,
    { ...size, fonts: await loadOgFonts() },
  );
}
