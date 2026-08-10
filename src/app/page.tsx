import { Megaphone } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { GithubBadge } from "@/components/github-badge";
import { ReportMap } from "@/components/map/report-map";
import { QrShare } from "@/components/qr-share";
import { Button } from "@/components/ui/button";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { getPublicReports } from "@/db/queries";
import { CIUDADES } from "@/lib/taxonomy";

// Always reflect the latest published reports.
export const dynamic = "force-dynamic";

export default async function Home() {
  // All published, PII-free reports (no time window).
  const initialReports = await getPublicReports({});

  return (
    <main className="relative flex h-screen flex-col overflow-hidden">
      <header className="z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-sidebar px-3 sm:px-4">
        <Brand href={null} />
        <div className="flex items-center gap-1.5">
          <GithubBadge />
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex"
          >
            <Link href="/acerca">Acerca</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex"
          >
            <Link href="/datos">Datos</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex"
          >
            <Link href="/moderation">Consola</Link>
          </Button>
          <WhatsAppShare />
          <QrShare />
          <Button asChild size="default" className="font-semibold shadow-sm">
            <Link href="/reportar">
              <Megaphone className="size-4" />
              Reportar
            </Link>
          </Button>
        </div>
      </header>

      <div className="relative flex-1">
        <ReportMap initialReports={initialReports} />
      </div>

      {/* City permalinks. Each opens the map framed on that city and is the
          link worth sharing locally, rather than this national one. */}
      <nav
        aria-label="Ver por ciudad"
        className="z-20 flex h-10 shrink-0 items-center gap-px overflow-x-auto border-t border-border bg-sidebar"
      >
        <span className="sticky left-0 z-10 flex h-full shrink-0 items-center bg-sidebar px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Tu ciudad
        </span>
        {CIUDADES.map((c) => (
          <Link
            key={c.slug}
            href={`/${c.slug}`}
            className="flex h-full shrink-0 items-center whitespace-nowrap px-3 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {c.name}
          </Link>
        ))}
      </nav>
    </main>
  );
}
