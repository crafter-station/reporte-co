"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** WhatsApp glyph. lucide dropped brand icons, and in Colombia this button
 *  only reads as "share" if it carries the mark people recognize. */
function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      role="img"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z" />
    </svg>
  );
}

/**
 * One-tap share into WhatsApp, which is how anything actually travels here.
 * The message is written to be forwardable as-is into a neighborhood group,
 * so it leads with what the link is for rather than with the link.
 */
export function WhatsAppShare({
  path = "/",
  place,
  className,
}: {
  path?: string;
  /** Named place, so a city permalink shares as "the map for Pereira". */
  place?: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");

  // The absolute URL is only knowable on the client (depends on the origin).
  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  const message = [
    place
      ? `Mapa ciudadano del sismo en ${place}.`
      : "Mapa ciudadano del sismo.",
    "",
    "Puedes reportar daños, personas atrapadas, heridos, familias sin techo, vías bloqueadas o falta de agua y luz. Es anónimo: no piden tu nombre ni tu número.",
    "",
    "Si hay vidas en riesgo, llama al 123 primero.",
    "",
    url,
  ].join("\n");

  return (
    <Button
      asChild
      size="icon-sm"
      variant="outline"
      className={className}
      aria-label="Compartir por WhatsApp"
    >
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
      >
        <WhatsAppMark className="size-[17px]" />
      </a>
    </Button>
  );
}
