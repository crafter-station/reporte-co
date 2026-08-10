/**
 * Sync the citizen-curated "CRISIS 10 DE AGOSTO" Google My Maps layer into
 * `src/lib/mapa-verificado.data.ts`.
 *
 *   bun run map:sync
 *
 * Why bake it in instead of fetching at runtime: Google's KML endpoint sends no
 * CORS headers (so the browser can't read it directly), it rate-limits, and a
 * crisis map must keep rendering when a third party is down. Committing the
 * snapshot also makes every change to the reference layer show up in a diff and
 * go through review — which is the point, since these pins tell people where
 * NOT to go.
 *
 * Re-run it after the curators edit the map; commit the resulting diff.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

const MID = "19VCxfF0ihITJC8BIB3dZeBMHDQaliY4";
const KML_URL = `https://www.google.com/maps/d/kml?mid=${MID}&forcekml=1`;
const VIEWER_URL = `https://www.google.com/maps/d/u/0/viewer?mid=${MID}`;
const OUT = path.resolve(
  import.meta.dirname,
  "../src/lib/mapa-verificado.data.ts",
);

/** Folder emoji → our layer key. Unknown folders abort the sync (see below). */
const LAYER_BY_EMOJI: Record<string, string> = {
  "🔴": "peligro",
  "🟢": "ayuda",
  "🔵": "logistica",
  "🟡": "vias",
};

/**
 * Placemarks whose leading emoji marks them as notes to the map's own editors
 * ("how to fill in this layer") rather than a real place. They're anchored at
 * arbitrary coordinates, so drawing them would put a pin where nothing is.
 */
const EDITOR_NOTE_EMOJI = "ℹ️";

// ── Minimal KML reader ────────────────────────────────────────────────────
// Google My Maps emits one machine-generated shape, so a tag scan beats adding
// an XML dependency to a repo that has none. It reads Points and LineStrings:
// the corridor layer's instructions say cleared roads get drawn as lines, so
// those need to survive the next sync without a code change.

function tagContent(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  for (const m of xml.matchAll(re)) out.push(m[1]);
  return out;
}

function firstTag(xml: string, tag: string): string | null {
  return tagContent(xml, tag)[0] ?? null;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** CDATA → plain text: unwrap, turn `<br>` into newlines, drop other markup. */
function plainText(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Coord = [number, number];

/** KML coordinates are `lng,lat[,alt]` tuples separated by whitespace. */
function parseCoords(raw: string): Coord[] {
  const out: Coord[] = [];
  for (const tuple of raw.trim().split(/\s+/)) {
    const [lng, lat] = tuple.split(",").map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng, lat]);
  }
  return out;
}

// ── Normalization ─────────────────────────────────────────────────────────

/** Leading emoji (with any variation selector) split from the rest of a title. */
function splitEmoji(name: string): { emoji: string; title: string } {
  const m = name.trim().match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
  return m
    ? { emoji: m[1], title: m[2].trim() }
    : { emoji: "", title: name.trim() };
}

/**
 * Heads that name a state or a role rather than a place. The curators write
 * most titles as "Place — what's happening", but corridor and work-front pins
 * invert it ("CERRADA — Manizales–Fresno"), so for those the tail is the place.
 * Kept as an explicit list because "ACOPIO CALI" is also shouted in caps and
 * *is* the place — a generic all-caps rule would mislabel it.
 */
const GENERIC_HEADS =
  /^(abierta|cerrada|suspendido|sin operaci[oó]n(\s+a[eé]rea)?|frente de rescate)$/i;

/**
 * A label short enough to sit next to the marker: the segment of the title
 * that identifies the place, minus any trailing parenthetical aside.
 */
function shortLabel(title: string): string {
  const parts = title.split(/\s+[—–]\s+/).map((s) => s.trim());
  const head = parts[0] ?? title;
  const pick =
    parts.length > 1 && GENERIC_HEADS.test(head)
      ? parts.slice(1).join(" — ")
      : head;
  return pick.replace(/\s*\([^)]*\)\s*$/, "").trim() || title;
}

/** Split the trailing "Fuente: …" attribution off the body of a description. */
function splitSource(desc: string): { body: string; source: string | null } {
  const m = desc.match(/(^|\n|\s)Fuente:\s*([\s\S]+)$/);
  if (!m) return { body: desc, source: null };
  // Left as written, trailing period and all — attributions end in "10 ago."
  // and "5:25 p.m.", and trimming the dot mangles the second.
  return {
    body: desc.slice(0, m.index).trim(),
    source: m[2].replace(/\s+/g, " ").trim(),
  };
}

/**
 * True when the curators flagged the pin as a stand-in rather than a surveyed
 * location. The map has to say so out loud: several of these are "confirm by
 * phone before going", and treating them as exact is how people drive to a
 * place that isn't there.
 */
function isApproximate(text: string): boolean {
  return /ubicaci[oó]n aproximada|ubicaci[oó]n de referencia|marcador aproximado|como referencia|como ancla|sin ubicaci[oó]n f[ií]sica/i.test(
    text,
  );
}

/**
 * Corridor pins carry their state in the title ("CERRADA — …", "SUSPENDIDO —
 * …") and echo it in the emoji (🟡 open / 🔴 closed) — the one layer that holds
 * two meanings at once. Read the word first and fall back to the emoji, since a
 * corridor wrongly drawn as open is the error that puts someone on a closed road.
 */
function estado(
  layer: string,
  title: string,
  emoji: string,
): "abierta" | "cerrada" | null {
  if (layer !== "vias") return null;
  if (/^abierta\b/i.test(title)) return "abierta";
  if (/^(cerrada|suspendido|sin operaci[oó]n)\b/i.test(title)) return "cerrada";
  return emoji === "🟡" ? "abierta" : "cerrada";
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

// ── Sync ──────────────────────────────────────────────────────────────────

type Entry = {
  id: string;
  layer: string;
  emoji: string;
  title: string;
  short: string;
  body: string;
  source: string | null;
  approx: boolean;
  estado: "abierta" | "cerrada" | null;
  geometry:
    | { type: "Point"; coordinates: Coord }
    | { type: "LineString"; coordinates: Coord[] };
};

const res = await fetch(KML_URL);
if (!res.ok) {
  throw new Error(`My Maps KML fetch failed: ${res.status} ${res.statusText}`);
}
const kml = await res.text();

const doc = firstTag(kml, "Document") ?? kml;
const mapName = plainText(firstTag(doc, "name"));
const mapNotice = plainText(firstTag(doc, "description"));

const entries: Entry[] = [];
const seen = new Set<string>();
let skipped = 0;

for (const folder of tagContent(doc, "Folder")) {
  const folderName = plainText(firstTag(folder, "name"));
  const { emoji: folderEmoji } = splitEmoji(folderName);
  const layer = LAYER_BY_EMOJI[folderEmoji];
  // Fail loudly: a renamed folder must be mapped deliberately, never dropped
  // on the floor — silently losing a layer of danger pins is the worst outcome.
  if (!layer) {
    throw new Error(
      `Unmapped folder "${folderName}" — add its emoji to LAYER_BY_EMOJI.`,
    );
  }

  for (const pm of tagContent(folder, "Placemark")) {
    const { emoji, title } = splitEmoji(plainText(firstTag(pm, "name")));
    if (emoji === EDITOR_NOTE_EMOJI) {
      skipped++;
      continue;
    }

    const point = firstTag(firstTag(pm, "Point") ?? "", "coordinates");
    const line = firstTag(firstTag(pm, "LineString") ?? "", "coordinates");
    const coords = parseCoords(point ?? line ?? "");
    if (!coords.length) {
      skipped++;
      continue;
    }

    const desc = plainText(firstTag(pm, "description"));
    const { body, source } = splitSource(desc);

    let id = `${layer}-${slug(shortLabel(title))}`;
    for (let n = 2; seen.has(id); n++)
      id = `${layer}-${slug(shortLabel(title))}-${n}`;
    seen.add(id);

    entries.push({
      id,
      layer,
      emoji,
      title,
      short: shortLabel(title),
      body,
      source,
      approx: isApproximate(desc) || isApproximate(title),
      estado: estado(layer, title, emoji),
      geometry: line
        ? { type: "LineString", coordinates: coords }
        : { type: "Point", coordinates: coords[0] },
    });
  }
}

if (!entries.length)
  throw new Error("No placemarks parsed — refusing to write.");

const file = `// GENERATED by scripts/sync-mapa-verificado.ts — do not edit by hand.
// Source: ${mapName} (Google My Maps)
// ${VIEWER_URL}
//
// Re-run \`bun run map:sync\` to refresh, then review the diff before committing.

import type { PuntoVerificado } from "./mapa-verificado";

/** Title the curators gave the source map. */
export const MAPA_VERIFICADO_NOMBRE = ${JSON.stringify(mapName)};

/** The curators' own disclaimer, shown verbatim so we never overstate it. */
export const MAPA_VERIFICADO_AVISO = ${JSON.stringify(mapNotice)};

/** Public viewer for the source map. */
export const MAPA_VERIFICADO_URL = ${JSON.stringify(VIEWER_URL)};

/** When this snapshot was taken. */
export const MAPA_VERIFICADO_SYNC = ${JSON.stringify(new Date().toISOString())};

export const PUNTOS_VERIFICADOS: PuntoVerificado[] = ${JSON.stringify(entries, null, 2)};
`;

await writeFile(OUT, file);

const byLayer = entries.reduce<Record<string, number>>((acc, e) => {
  acc[e.layer] = (acc[e.layer] ?? 0) + 1;
  return acc;
}, {});
console.log(`✓ ${entries.length} placemarks → src/lib/mapa-verificado.data.ts`);
console.log(
  `  ${Object.entries(byLayer)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ")}${skipped ? ` · skipped ${skipped}` : ""}`,
);
