import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { ReportMap } from "@/components/map/report-map";
import { QrShare } from "@/components/qr-share";
import { Button } from "@/components/ui/button";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { getPublicReports } from "@/db/queries";
import { CIUDADES, findCiudad } from "@/lib/taxonomy";

// Always reflect the latest published reports.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ciudad: string }> };

/**
 * Per-city permalinks (`/pereira`, `/cali`, …). Static routes like `/acerca`
 * and `/datos` win over this dynamic segment, and anything unrecognized 404s.
 */
export function generateStaticParams() {
  return CIUDADES.map((c) => ({ ciudad: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { ciudad } = await params;
  const city = findCiudad(ciudad);
  if (!city) return {};

  const title = `Sismo en ${city.name} · Reporte CO`;
  const description = `Mapa ciudadano de daños y necesidades en ${city.name}, ${city.departamento}, tras el sismo del 10 de agosto de 2026. Reporta de forma anónima: personas atrapadas, heridos, viviendas afectadas, albergues, vías bloqueadas o falta de servicios.`;

  return {
    title,
    description,
    alternates: { canonical: `/${city.slug}` },
    openGraph: {
      title,
      description,
      url: `/${city.slug}`,
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CiudadPage({ params }: Params) {
  const { ciudad } = await params;
  const city = findCiudad(ciudad);
  if (!city) notFound();

  // The feed stays national: a report just across the municipal line still
  // matters to someone looking at this city. Only the framing is local.
  const initialReports = await getPublicReports({});

  return (
    <main className="relative flex h-screen flex-col overflow-hidden">
      <header className="z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-sidebar px-3 sm:px-4">
        <Brand href="/" tagline={`Sismo · ${city.name}`} />
        <div className="flex items-center gap-1.5">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex"
          >
            <Link href="/">Todo el país</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex"
          >
            <Link
              href={`/datos?departamento=${encodeURIComponent(city.departamento)}`}
            >
              Datos
            </Link>
          </Button>
          <WhatsAppShare path={`/${city.slug}`} place={city.name} />
          <QrShare path={`/${city.slug}`} />
          <Button asChild size="default" className="font-semibold shadow-sm">
            <Link href="/reportar">
              <Megaphone className="size-4" />
              Reportar
            </Link>
          </Button>
        </div>
      </header>

      <div className="relative flex-1">
        <ReportMap
          initialReports={initialReports}
          view={{
            label: city.name,
            lat: city.lat,
            lng: city.lng,
            zoom: city.zoom,
          }}
        />
      </div>
    </main>
  );
}
