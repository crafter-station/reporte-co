"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection, Feature as GeoFeature, Point } from "geojson";
import { Crosshair } from "lucide-react";
import mapboxgl, { type FilterSpecification } from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicReport } from "@/db/schema";
import { env } from "@/env";
import {
  CAPA_LABELS,
  CAPA_META,
  CAPAS_VERIFICADAS,
  type CapaVerificada,
  capaCounts,
  MAPA_VERIFICADO_NOMBRE,
  MAPA_VERIFICADO_URL,
  verificadoColors,
  verificadoIconId,
  verificadosFeatureCollection,
} from "@/lib/mapa-verificado";
import { PUBLIC_REPORTS_CHANNEL, type ReportEvent } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_META,
  type Category,
  COLOMBIA_BOUNDS,
  categoryLabel,
  categoryMeta,
  EPICENTRO,
  isCategory,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  SEVERITY_LABELS,
  type Severity,
  ZONA_AFECTADA,
} from "@/lib/taxonomy";
import { useGeolocation } from "@/lib/use-geolocation";
import { cn } from "@/lib/utils";

mapboxgl.accessToken = env.NEXT_PUBLIC_MAPBOX_TOKEN;

const DEFAULT_STYLE =
  env.NEXT_PUBLIC_MAP_STYLE_URL ?? "mapbox://styles/mapbox/dark-v11";

const SOURCE_ID = "reports";
const EPICENTER_SOURCE_ID = "epicenter";
const VERIFIED_SOURCE_ID = "verified";
const VERIFIED_POINTS_LAYER = "verified-points";
const VERIFIED_LINES_LAYER = "verified-lines";

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

/** The category that drives a report's color/legend bucket. */
function primaryKey(r: PublicReport): string {
  return r.category ?? r.categories[0] ?? "other";
}

/** Which canonical legend row a report belongs to. */
function legendCat(r: PublicReport): Category {
  const k = primaryKey(r);
  return isCategory(k) ? k : "other";
}

type PointFeature = GeoFeature<Point, Record<string, string>>;

/** Project the visible reports into a GeoJSON FeatureCollection for the source. */
function toFeatureCollection(
  reports: PublicReport[],
  active: Set<Category>,
): FeatureCollection<Point, Record<string, string>> {
  const features: PointFeature[] = [];
  for (const r of reports) {
    if (r.lat == null || r.lng == null) continue;
    if (!active.has(legendCat(r))) continue;
    const key = primaryKey(r);
    const meta = categoryMeta(key);
    const sev = r.severity
      ? (SEVERITY_LABELS[r.severity as Severity] ?? r.severity)
      : "";
    const loc = [r.barrio, r.municipio, r.departamento]
      .filter(Boolean)
      .join(", ");
    // Properties must be primitive — the full category list rides as JSON.
    const cats = (r.categories.length ? r.categories : [key]).map((c) => ({
      label: categoryLabel(c),
      color: categoryMeta(c).color,
    }));
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        color: meta.color,
        summary: r.summary ?? "",
        sev,
        loc,
        cats: JSON.stringify(cats),
        media: JSON.stringify(r.media ?? []),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function safeParse<T>(raw: string | undefined, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function popupHtml(props: Record<string, string>): string {
  const cats = safeParse<{ label: string; color: string }[]>(props.cats, []);
  const media = safeParse<string[]>(props.media, []);
  const chips = cats
    .map(
      (c) =>
        `<span class="mc-pop-chip"><span class="mc-pop-dot" style="background:${c.color}"></span>${escapeHtml(c.label)}</span>`,
    )
    .join("");
  const photos = media.length
    ? `<div class="mc-pop-media">${media
        .map(
          (url) =>
            `<img src="${encodeURI(url)}" alt="" loading="lazy" class="mc-pop-img" />`,
        )
        .join("")}</div>`
    : "";
  return `
    <div class="mc-pop-title">
      ${chips}
      ${props.sev ? `<span class="mc-pop-sev">· ${escapeHtml(props.sev)}</span>` : ""}
    </div>
    ${props.summary ? `<div class="mc-pop-body">${escapeHtml(props.summary)}</div>` : ""}
    ${photos}
    ${props.loc ? `<div class="mc-pop-loc">${escapeHtml(props.loc)}</div>` : ""}`;
}

// ── Reference layer (curated My Maps pins) ────────────────────────────────

/** Logical size of a reference marker, in CSS pixels. */
const VERIFIED_ICON_PX = 12;

// Static snapshot — built once per module, never refetched at runtime.
const VERIFIED_DATA = verificadosFeatureCollection();
const VERIFIED_COLORS = verificadoColors();
const VERIFIED_COUNTS = capaCounts();
const VERIFIED_TOTAL = Object.values(VERIFIED_COUNTS).reduce(
  (a, b) => a + b,
  0,
);

/**
 * Reference pins are drawn as squares so a glance separates them from the round
 * report dots: a red circle is "someone reported this", a red square is "the
 * curators copied this out of an official bulletin". Same map, two pipelines,
 * and the difference matters before you act on either.
 */
function squareIcon(color: string, ratio: number): ImageData | null {
  const px = Math.round(VERIFIED_ICON_PX * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const border = Math.max(1, Math.round(1.5 * ratio));
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = color;
  ctx.fillRect(border, border, px - border * 2, px - border * 2);
  return ctx.getImageData(0, 0, px, px);
}

/**
 * Colombian landline/mobile numbers, as the curators write them: "313 753 08
 * 68", "(604) 448 3888", "310 415 7033". Short emergency codes (123, #767) are
 * left alone — three loose digits match far too much prose to be worth it.
 */
const PHONE_RE =
  /(?:\+?\d{1,3}\s?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g;

/**
 * Escape `text`, turning phone numbers into `tel:` links on the way — several
 * of these pins say "confirm by phone before going", and on a phone that should
 * be one tap. Splitting first keeps the escaper from mangling the anchors (and
 * keeps the matcher away from the digits inside entities like `&#39;`).
 */
function linkifyPhones(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(PHONE_RE)) {
    const start = m.index ?? 0;
    out += escapeHtml(text.slice(last, start));
    const digits = m[0].replace(/[^\d+]/g, "");
    out += `<a class="mc-pop-tel" href="tel:${digits}">${escapeHtml(m[0])}</a>`;
    last = start + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

/**
 * Popup for one or more reference pins. Several sit at identical coordinates on
 * purpose — a collapsed building is both a danger zone and a rescue front — so
 * the popup renders every pin under the cursor instead of whichever one happens
 * to be drawn on top.
 */
function verifiedPopupHtml(features: Record<string, string>[]): string {
  return features
    .map((p) => {
      const capa = isCapa(p.layer) ? p.layer : null;
      const label = capa ? CAPA_LABELS[capa] : p.layer;
      const estado = p.estado ? ` · ${p.estado.toUpperCase()}` : "";
      const approx = p.approx
        ? `<div class="mc-pop-approx">Ubicación aproximada — confirme antes de desplazarse.</div>`
        : "";
      const source = p.source
        ? `<div class="mc-pop-loc">Fuente: ${escapeHtml(p.source)}</div>`
        : "";
      return `
        <div class="mc-pop-item">
          <div class="mc-pop-title">
            <span class="mc-pop-chip">
              <span class="mc-pop-dot" style="background:${p.color}"></span>${escapeHtml(label)}
            </span>
            <span class="mc-pop-sev">${escapeHtml(estado)}</span>
          </div>
          <div class="mc-pop-body">
            <strong>${escapeHtml(`${p.emoji} ${p.title}`.trim())}</strong>
            ${p.body ? `<br />${linkifyPhones(p.body)}` : ""}
          </div>
          ${approx}
          ${source}
        </div>`;
    })
    .join("");
}

function isCapa(value: string): value is CapaVerificada {
  return (CAPAS_VERIFICADAS as readonly string[]).includes(value);
}

/** A named place the map can jump to: the epicenter, or a shared city view. */
export type MapView = {
  label: string;
  lat: number;
  lng: number;
  zoom: number;
};

export function ReportMap({
  initialReports,
  view,
}: {
  initialReports: PublicReport[];
  /**
   * Opening view. When a city permalink supplies one we also stop auto-flying
   * to the visitor's own location, so a link shared as "the map for Pereira"
   * still shows Pereira to someone reading it from Bogotá.
   */
  view?: MapView;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // Read once at init; changing the prop later should not re-create the map.
  const viewRef = useRef<MapView>(
    view ?? { label: "Zona afectada", ...ZONA_AFECTADA },
  );
  const [active, setActive] = useState<Set<Category>>(new Set(CATEGORIES));
  const [capas, setCapas] = useState<Set<CapaVerificada>>(
    new Set(CAPAS_VERIFICADAS),
  );
  const [reports, setReports] = useState<PublicReport[]>(initialReports);
  // Prompt for the visitor's location as soon as the map loads.
  const { coords: userCoords } = useGeolocation();

  const data = useMemo(
    () => toFeatureCollection(reports, active),
    [reports, active],
  );
  // Keep latest data reachable from the one-time `load` handler.
  const dataRef = useRef(data);
  dataRef.current = data;

  // Mapbox filter for the reference layers: only the checked capas.
  const capaFilter = useMemo<FilterSpecification>(
    () => ["in", ["get", "layer"], ["literal", [...capas]]],
    [capas],
  );
  const capaFilterRef = useRef(capaFilter);
  capaFilterRef.current = capaFilter;

  // Per-category counts for the legend (independent of the active filter).
  const counts = useMemo(() => {
    const c = {} as Record<Category, number>;
    for (const cat of CATEGORIES) c[cat] = 0;
    for (const r of reports) {
      if (r.lat == null || r.lng == null) continue;
      c[legendCat(r)]++;
    }
    return c;
  }, [reports]);

  const placed = useMemo(
    () => reports.filter((r) => r.lat != null && r.lng != null).length,
    [reports],
  );

  const verifiedShown = useMemo(
    () =>
      CAPAS_VERIFICADAS.reduce(
        (n, capa) => (capas.has(capa) ? n + VERIFIED_COUNTS[capa] : n),
        0,
      ),
    [capas],
  );

  // Initialize the map once, wiring the clustered source + layers on load.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE,
      center: [viewRef.current.lng, viewRef.current.lat],
      zoom: viewRef.current.zoom,
      maxBounds: COLOMBIA_BOUNDS,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    map.on("load", () => {
      // Epicenter reference — a single static point with expanding rings, drawn
      // beneath the reports so it orients the map without competing with them.
      map.addSource(EPICENTER_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [EPICENTRO.lng, EPICENTRO.lat],
          },
          properties: {},
        },
      });
      map.addLayer({
        id: "epicenter-halo",
        type: "circle",
        source: EPICENTER_SOURCE_ID,
        paint: {
          "circle-color": "transparent",
          "circle-stroke-color": "#dc2626",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.5,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            10,
            8,
            34,
            12,
            90,
          ],
        },
      });
      map.addLayer({
        id: "epicenter",
        type: "circle",
        source: EPICENTER_SOURCE_ID,
        paint: {
          "circle-color": "#dc2626",
          "circle-stroke-color": "rgba(255,255,255,0.9)",
          "circle-stroke-width": 1.5,
          "circle-radius": 5,
        },
      });
      map.addLayer({
        id: "epicenter-label",
        type: "symbol",
        source: EPICENTER_SOURCE_ID,
        layout: {
          "text-field": "Epicentro M7.4",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 10,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-letter-spacing": 0.06,
        },
        paint: {
          "text-color": "#fca5a5",
          "text-halo-color": "rgba(0,0,0,0.75)",
          "text-halo-width": 1.2,
        },
      });

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: dataRef.current,
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 14,
      });

      // Cluster bubbles — neutral chrome; only individual points carry color.
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1c1c1c",
          "circle-stroke-color": "#3a3a3a",
          "circle-stroke-width": 1,
          "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 50, 27],
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#f4f4f4" },
      });

      // Individual reports — colored by primary category, hairline white ring.
      map.addLayer({
        id: "points",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-stroke-color": "rgba(255,255,255,0.92)",
          "circle-stroke-width": 1.5,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            4,
            12,
            7,
            16,
            10,
          ],
        },
      });

      // Reference layer — the curated My Maps pins, inserted directly beneath
      // `points`. Live report dots still win the top of the stack, but the
      // cluster bubbles under them are neutral chrome, and chrome must not sit
      // on top of a "no se acerque" pin. Never clustered either: an acopio point
      // folded into a bubble is a point you can't act on.
      const ratio = Math.max(2, Math.round(window.devicePixelRatio || 1));
      for (const color of VERIFIED_COLORS) {
        const id = verificadoIconId(color);
        if (map.hasImage(id)) continue;
        const image = squareIcon(color, ratio);
        if (image) map.addImage(id, image, { pixelRatio: ratio });
      }

      map.addSource(VERIFIED_SOURCE_ID, {
        type: "geojson",
        data: VERIFIED_DATA,
      });

      // Corridors the curators trace as lines (the layer's instructions call for
      // drawing cleared roads); the snapshot is all points until they do.
      map.addLayer(
        {
          id: VERIFIED_LINES_LAYER,
          type: "line",
          source: VERIFIED_SOURCE_ID,
          filter: [
            "all",
            ["==", ["geometry-type"], "LineString"],
            capaFilterRef.current,
          ],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 7, 2, 14, 5],
            "line-opacity": 0.85,
          },
        },
        "points",
      );

      map.addLayer(
        {
          id: VERIFIED_POINTS_LAYER,
          type: "symbol",
          source: VERIFIED_SOURCE_ID,
          filter: [
            "all",
            ["==", ["geometry-type"], "Point"],
            capaFilterRef.current,
          ],
          layout: {
            "icon-image": ["get", "icon"],
            // Coincident pins are meaningful here — a collapsed building is both
            // a danger zone and a rescue front — so let them stack rather than
            // have collision detection silently drop one.
            "icon-allow-overlap": true,
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              6,
              0.7,
              12,
              1,
              16,
              1.25,
            ],
            // Labels from city-permalink zoom up (the tightest city view opens
            // at 12); collision detection thins them out when they'd collide.
            "text-field": ["step", ["zoom"], "", 12, ["get", "short"]],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 10,
            "text-offset": [0, 1],
            "text-anchor": "top",
            "text-max-width": 9,
            "text-optional": true,
          },
          paint: {
            "text-color": "#e8e8e8",
            "text-halo-color": "rgba(0,0,0,0.8)",
            "text-halo-width": 1.2,
          },
        },
        "points",
      );

      // Click a cluster → zoom to its expansion level.
      map.on("click", "clusters", (e) => {
        // Mapbox fires every layer's handler under the cursor, so a reference
        // pin sitting on a cluster would both open its popup and zoom away from
        // it. Whatever is drawn on top wins the click.
        if (
          map.queryRenderedFeatures(e.point, {
            layers: [VERIFIED_POINTS_LAYER],
          }).length
        ) {
          return;
        }
        const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = f[0]?.properties?.cluster_id;
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
        if (clusterId == null || !src) return;
        src.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          const geom = f[0].geometry as Point;
          map.easeTo({
            center: geom.coordinates as [number, number],
            zoom,
            duration: 600,
          });
        });
      });

      // Click a point → popup built from its properties.
      map.on("click", "points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const geom = f.geometry as Point;
        new mapboxgl.Popup({ offset: 14, closeButton: false })
          .setLngLat(geom.coordinates as [number, number])
          .setHTML(popupHtml(f.properties as Record<string, string>))
          .addTo(map);
      });

      // Click a reference pin → popup covering every pin stacked under it.
      map.on("click", VERIFIED_POINTS_LAYER, (e) => {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: [VERIFIED_POINTS_LAYER],
        });
        const seen = new Set<string>();
        const props: Record<string, string>[] = [];
        for (const f of hits) {
          const p = f.properties as Record<string, string> | null;
          if (!p || seen.has(p.id)) continue;
          seen.add(p.id);
          props.push(p);
        }
        if (!props.length) return;
        const geom = hits[0].geometry as Point;
        new mapboxgl.Popup({
          offset: 12,
          closeButton: true,
          maxWidth: "270px",
        })
          .setLngLat(geom.coordinates as [number, number])
          .setHTML(verifiedPopupHtml(props))
          .addTo(map);
      });

      for (const layer of ["clusters", "points", VERIFIED_POINTS_LAYER]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      loadedRef.current = true;
    });

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Push fresh/filtered data into the source whenever it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    src?.setData(data);
  }, [data]);

  // Show/hide reference capas as they're toggled in the legend.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setFilter(VERIFIED_POINTS_LAYER, [
      "all",
      ["==", ["geometry-type"], "Point"],
      capaFilter,
    ]);
    map.setFilter(VERIFIED_LINES_LAYER, [
      "all",
      ["==", ["geometry-type"], "LineString"],
      capaFilter,
    ]);
  }, [capaFilter]);

  // Live updates: append newly published reports as they happen.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(PUBLIC_REPORTS_CHANNEL)
      .on("broadcast", { event: "report-event" }, ({ payload }) => {
        const evt = payload as ReportEvent;
        if (evt.type === "report:published") {
          setReports((prev) =>
            prev.some((r) => r.id === evt.report.id)
              ? prev
              : [evt.report, ...prev],
          );
        } else if (evt.type === "report:removed") {
          setReports((prev) => prev.filter((r) => r.id !== evt.id));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Drop a "you are here" dot and fly to the visitor once their location is
  // known — but only if they're inside Colombia (visitors abroad keep the
  // country overview, since the map is bounded to the country anyway).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userCoords) return;

    const [[west, south], [east, north]] = COLOMBIA_BOUNDS;
    const inCountry =
      userCoords.lng >= west &&
      userCoords.lng <= east &&
      userCoords.lat >= south &&
      userCoords.lat <= north;
    if (!inCountry) return;

    const place = () => {
      const lngLat: [number, number] = [userCoords.lng, userCoords.lat];
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat(lngLat);
      } else {
        const el = document.createElement("div");
        el.setAttribute("aria-label", "Tu ubicación");
        el.style.cssText =
          "width:16px;height:16px;border-radius:9999px;background:#3b82f6;box-shadow:0 0 0 4px rgba(59,130,246,0.25),0 0 0 1.5px rgba(255,255,255,0.9);";
        userMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat(lngLat)
          .addTo(map);
      }
      // A city permalink was shared for that city: keep its framing, just show
      // the visitor where they are within it.
      if (view) return;
      map.flyTo({ center: lngLat, zoom: 12, duration: 1500, essential: true });
    };

    if (loadedRef.current) place();
    else map.once("load", place);
  }, [userCoords, view]);

  function toggle(cat: Category) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function toggleCapa(capa: CapaVerificada) {
    setCapas((prev) => {
      const next = new Set(prev);
      if (next.has(capa)) next.delete(capa);
      else next.add(capa);
      return next;
    });
  }

  // On a city permalink this returns to that city; otherwise, to the epicenter.
  const quickView: MapView = view ?? { ...EPICENTRO, label: "Epicentro" };
  const focusQuickView = useCallback(() => {
    mapRef.current?.flyTo({
      center: [quickView.lng, quickView.lat],
      zoom: quickView.zoom,
      duration: 1200,
      essential: true,
    });
  }, [quickView]);

  const focusCountry = useCallback(() => {
    mapRef.current?.fitBounds(COLOMBIA_BOUNDS, {
      padding: 32,
      duration: 1200,
    });
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Legend / category filter */}
      <div className="absolute left-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-[212px] flex-col overflow-y-auto border border-border bg-card/95 backdrop-blur">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Reportes
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {data.features.length}/{placed}
          </span>
        </div>
        <div className="flex flex-col">
          {CATEGORIES.map((cat) => {
            const on = active.has(cat);
            const meta = CATEGORY_META[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggle(cat)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-accent",
                  on ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {/* Round, like the report dots on the map. */}
                <span
                  className="size-2.5 shrink-0 rounded-full border border-black/10"
                  style={{
                    backgroundColor: meta.color,
                    opacity: on ? 1 : 0.25,
                  }}
                />
                <span className="flex-1">{CATEGORY_LABELS[cat]}</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {counts[cat]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Reference layer — curated pins from the citizen My Maps. Square
            swatches here because they're square markers on the map. */}
        <div className="flex items-center justify-between border-y border-border px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Mapa verificado
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {verifiedShown}/{VERIFIED_TOTAL}
          </span>
        </div>
        <div className="flex flex-col">
          {CAPAS_VERIFICADAS.map((capa) => {
            const on = capas.has(capa);
            return (
              <button
                key={capa}
                type="button"
                onClick={() => toggleCapa(capa)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-accent",
                  on ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className="size-2.5 shrink-0 border border-black/10"
                  style={{
                    backgroundColor: CAPA_META[capa].color,
                    opacity: on ? 1 : 0.25,
                  }}
                />
                <span className="flex-1">{CAPA_LABELS[capa]}</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {VERIFIED_COUNTS[capa]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="border-t border-border px-3 py-2 text-[10px] leading-snug text-muted-foreground">
          Curado a mano desde{" "}
          <a
            href={MAPA_VERIFICADO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {MAPA_VERIFICADO_NOMBRE}
          </a>
          . No es fuente oficial: emergencias, 123.
        </p>
        {/* Quick views */}
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
          <button
            type="button"
            onClick={focusQuickView}
            className="flex items-center justify-center gap-1.5 bg-card px-2 py-2 text-[11px] text-foreground transition-colors hover:bg-accent"
          >
            <Crosshair className="size-3" />
            {quickView.label}
          </button>
          <button
            type="button"
            onClick={focusCountry}
            className="bg-card px-2 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Todo el país
          </button>
        </div>
      </div>

      {/* Live indicator */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 border border-border bg-card/95 px-2.5 py-1.5 backdrop-blur">
        <span className="relative flex size-2 items-center justify-center">
          <span
            className="absolute size-2 rounded-full bg-emerald-500"
            style={{ animation: "mc-pulse 2.2s ease-out infinite" }}
          />
          <span className="size-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {data.features.length} en vivo
        </span>
      </div>
    </div>
  );
}
