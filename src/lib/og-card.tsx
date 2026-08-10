import { CATEGORIES, CATEGORY_META } from "./taxonomy";

/**
 * Shared artwork for the dynamically generated Open Graph cards.
 *
 * Rendered by Satori, not a browser: only flexbox and a subset of CSS work,
 * every element with children needs an explicit `display`, and there is no
 * Tailwind here. Keep it boring and inline-styled.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BG = "#0a0a0a";
const FG = "#fafafa";
const MUTED = "#a1a1a1";
const BORDER = "#2a2a2a";
const PANEL = "#141414";

/**
 * Geist as TTF, fetched at request time because Satori cannot read woff2 and
 * the bundle is capped at 500KB. Sending no User-Agent is what makes Google
 * serve truetype instead. Returns null on any failure so the card still
 * renders with the built-in font rather than 500ing.
 */
export async function loadGeist(
  weight: 400 | 600,
): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Geist:wght@${weight}`,
      { next: { revalidate: 604800 } },
    ).then((r) => (r.ok ? r.text() : ""));
    const url = css.match(
      /src:\s*url\((https:[^)]+)\)\s*format\('truetype'\)/,
    )?.[1];
    if (!url) return null;
    const res = await fetch(url, { next: { revalidate: 604800 } });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: "normal";
};

/**
 * Font set for ImageResponse, or undefined to fall back to the built-in face.
 * Both weights are fetched in parallel and either may come back null.
 */
export async function loadOgFonts(): Promise<OgFont[] | undefined> {
  const [regular, semibold] = await Promise.all([
    loadGeist(400),
    loadGeist(600),
  ]);
  const fonts: OgFont[] = [];
  if (regular)
    fonts.push({
      name: "Geist",
      data: regular,
      weight: 400,
      style: "normal",
    });
  if (semibold)
    fonts.push({
      name: "Geist",
      data: semibold,
      weight: 600,
      style: "normal",
    });
  return fonts.length ? fonts : undefined;
}

/** The brand mark: square diamond pin with a beacon at its heart. */
function Mark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={FG}
      strokeWidth="1.6"
      strokeLinecap="square"
      role="presentation"
    >
      <path d="M12 3 L19 10 L12 17 L5 10 Z" />
      <rect x="11" y="9" width="2" height="2" fill={FG} stroke="none" />
      <path d="M12 17 V21" />
    </svg>
  );
}

export type OgCardProps = {
  /** Big line: a city name, or the national headline. */
  title: string;
  /** Context line under the title. */
  subtitle: string;
  /** Shown bottom-left, without the scheme. */
  url: string;
  /** Optional live counts, e.g. "39 reportes · 8 críticos". */
  stats?: string;
};

export function OgCard({ title, subtitle, url, stats }: OgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: BG,
        color: FG,
        padding: 64,
        fontFamily: "Geist, sans-serif",
      }}
    >
      {/* Inset frame, echoing the in-app chrome */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 28,
          right: 28,
          bottom: 28,
          border: `1px solid ${BORDER}`,
        }}
      />

      {/* Brand lockup */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            backgroundColor: PANEL,
            border: `1px solid ${BORDER}`,
          }}
        >
          <Mark size={28} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: 16,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>
            Reporte CO
          </div>
          <div style={{ fontSize: 15, color: MUTED, letterSpacing: 1.6 }}>
            MAPA CIUDADANO · PRIVADO POR DISEÑO
          </div>
        </div>
      </div>

      {/* Headline */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: title.length > 20 ? 76 : 96,
            fontWeight: 600,
            letterSpacing: -2.5,
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 30,
            color: MUTED,
            marginTop: 18,
            letterSpacing: -0.4,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Category swatches + footer */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", marginBottom: 26 }}>
          {CATEGORIES.map((c) => (
            <div
              key={c}
              style={{
                width: 44,
                height: 6,
                backgroundColor: CATEGORY_META[c].color,
                marginRight: 6,
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: MUTED,
            letterSpacing: 0.8,
          }}
        >
          <div style={{ display: "flex" }}>{url}</div>
          {stats ? <div style={{ display: "flex" }}>{stats}</div> : null}
        </div>
      </div>
    </div>
  );
}
