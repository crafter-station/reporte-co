import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://co.crafter.run";
const DESCRIPTION =
  "Plataforma ciudadana, abierta y privada por diseño para mapear daños, personas atrapadas, heridos, albergues y falta de servicios tras el sismo de magnitud 7,4 del 10 de agosto de 2026 en Chocó, el Eje Cafetero y el Valle del Cauca. Inspirada en Mission 4636.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Reporte CO · Mapa ciudadano del sismo",
  description: DESCRIPTION,
  openGraph: {
    title: "Reporte CO",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Reporte CO",
    locale: "es_CO",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reporte CO",
    description: DESCRIPTION,
    images: ["/og-twitter.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
        <Toaster theme="dark" position="bottom-right" />
        <Analytics />
      </body>
    </html>
  );
}
