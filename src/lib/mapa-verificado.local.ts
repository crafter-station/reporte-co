/**
 * Hand-curated reference pins — everything that isn't in the My Maps snapshot.
 *
 * `bun run map:sync` overwrites `mapa-verificado.data.ts` wholesale, so anything
 * added by hand lives here instead and survives the next sync.
 *
 * Rules for adding a pin:
 *   • Cite the source in `source`, naming the authority that published it.
 *   • Put the street address in `body` verbatim. Coordinates are our derivation;
 *     the address is the thing that was actually published, and it's what
 *     someone standing on the corner can act on.
 *   • Set `approx: true` unless the coordinates were corroborated twice.
 *     Bogotá addresses geocode badly — providers happily interpolate a house
 *     number onto the right block and call it exact.
 */

import type { PuntoVerificado } from "./mapa-verificado";

/**
 * What the Cruz Roja asked for, shared by every Bogotá collection point. Kept
 * on the pin rather than behind a link: "what do I bring?" is the question you
 * have while looking at the marker, not after navigating away.
 */
const RECIBE_CRUZ_ROJA =
  "RECIBEN: agua potable embotellada, cobijas, mantas, almohadas, colchonetas y toldillos; " +
  "alimentos no perecederos (arroz, aceite, pastas, enlatados abre fácil, fríjol, lentejas, " +
  "harina, panela, leche en polvo); primeros auxilios (tapabocas, gasas estériles, alcohol, " +
  "clorhexidina, guantes quirúrgicos y de látex); aseo personal (jabón, shampoo, crema y " +
  "cepillos dentales, toallas higiénicas, papel higiénico, pañales de niño y adulto, toallitas " +
  "húmedas, crema antipañalitis, biberones). Revise las fechas de vencimiento.";

const FUENTE_CRUZ_ROJA =
  "Alcaldía Mayor de Bogotá y Cruz Roja Colombiana Seccional Cundinamarca y Bogotá";

/**
 * Collection points of the campaign "Bogotá se solidariza ante el sismo".
 *
 * Coordinates: the sede administrativa and the Palacio de los Deportes were
 * each confirmed twice — a named building in OpenStreetMap landing within ~25 m
 * of an independent geocode of the published address, and the sports venue as
 * its own mapped POI. The other four resolved only to an interpolated house
 * number on the correct block, so they carry `approx` and lean on the address.
 */
function acopioBogota(
  id: string,
  short: string,
  lugar: string,
  direccion: string,
  coordinates: [number, number],
  approx: boolean,
): PuntoVerificado {
  return {
    id: `ayuda-acopio-bogota-${id}`,
    layer: "ayuda",
    emoji: "📦",
    title: `ACOPIO BOGOTÁ — ${lugar}`,
    short,
    body: `Punto de acopio de la Cruz Roja Bogotá. Dirección: ${direccion}. ${RECIBE_CRUZ_ROJA}`,
    source: FUENTE_CRUZ_ROJA,
    approx,
    estado: null,
    origen: "oficial",
    geometry: { type: "Point", coordinates },
  };
}

export const PUNTOS_LOCALES: PuntoVerificado[] = [
  acopioBogota(
    "samu-sur",
    "Acopio SAMU Sur",
    "SAMU Sur",
    "Avenida Carrera 68 # 31-41 sur",
    [-74.131601, 4.607284],
    true,
  ),
  acopioBogota(
    "samu-norte",
    "Acopio SAMU Norte",
    "SAMU Norte",
    "Calle 134 con Carrera 7b bis # 132-31",
    [-74.032201, 4.709967],
    true,
  ),
  acopioBogota(
    "salvamento-acuatico",
    "Acopio Salvamento Acuático",
    "Centro de salvamento acuático",
    "Avenida La Esmeralda (Av. Carrera 60) # 63-81",
    [-74.084437, 4.660199],
    true,
  ),
  acopioBogota(
    "sede-administrativa",
    "Acopio Cruz Roja sede",
    "Sede administrativa Cruz Roja",
    "Carrera 24 # 73-38",
    [-74.066155, 4.66419],
    false,
  ),
  acopioBogota(
    "bodega",
    "Acopio bodega Cruz Roja",
    "Bodega Cruz Roja",
    "Diagonal 79b # 62-53",
    [-74.07705, 4.679282],
    true,
  ),
  acopioBogota(
    "palacio-deportes",
    "Acopio Palacio de los Deportes",
    "Palacio de los Deportes",
    "Calle 63 # 59a-06",
    [-74.084058, 4.655319],
    false,
  ),
  {
    id: "ayuda-acopio-armenia-banco-alimentos",
    layer: "ayuda",
    emoji: "📦",
    title: "ACOPIO ARMENIA — Banco de Alimentos Monseñor Roberto López Londoño",
    short: "ACOPIO ARMENIA",
    body: "Centro de acopio habilitado. Dirección: Calle 21 #12-08, Armenia. Dona solo artículos en buen estado y sigue las indicaciones del centro.",
    source:
      "Pieza informativa «Centros de acopio habilitados por ciudad», 10 ago. Dirección corroborada por Caracol Radio.",
    approx: true,
    estado: null,
    origen: "mymaps",
    geometry: {
      type: "Point",
      coordinates: [-75.672708, 4.531523],
    },
  },
  {
    id: "ayuda-acopio-manizales-banco-alimentos",
    layer: "ayuda",
    emoji: "📦",
    title: "ACOPIO MANIZALES — Banco Arquidiocesano de Alimentos",
    short: "ACOPIO MANIZALES",
    body: "Centro de acopio habilitado. Dirección: Calle 49 #27A-85, Manizales. Dona solo artículos en buen estado y sigue las indicaciones del centro.",
    source:
      "Pieza informativa «Centros de acopio habilitados por ciudad», 10 ago. Dirección corroborada por el Banco Arquidiocesano de Alimentos de Manizales.",
    approx: true,
    estado: null,
    origen: "mymaps",
    geometry: {
      type: "Point",
      coordinates: [-75.500787, 5.060916],
    },
  },
];

/**
 * Cash donations for the same campaign. Not a place, so it never becomes a pin
 * — a marker dropped on an arbitrary building would imply you can walk in. It's
 * shown on /acerca instead, transcribed exactly as published.
 */
export const DONACION_EN_DINERO = {
  titular: "Cruz Roja Colombiana Seccional Cundinamarca y Bogotá",
  banco: "Banco de Bogotá",
  cuenta: "078381860",
  tipo: "Cuenta corriente",
  fuente: FUENTE_CRUZ_ROJA,
} as const;
