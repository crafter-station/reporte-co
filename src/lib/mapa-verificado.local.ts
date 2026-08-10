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

function puntoAyudaLocal(
  id: string,
  ciudad: string,
  lugar: string,
  direccion: string,
  coordinates: [number, number],
  detalle: string,
  source: string,
  origen: PuntoVerificado["origen"] = "mymaps",
  emoji = "📦",
  approx = origen !== "oficial",
): PuntoVerificado {
  return {
    id: `ayuda-${id}`,
    layer: "ayuda",
    emoji,
    title: `${emoji === "🩸" ? "DONACIÓN DE SANGRE" : "ACOPIO"} ${ciudad.toUpperCase()} — ${lugar}`,
    short: `${emoji === "🩸" ? "SANGRE" : "ACOPIO"} ${ciudad.toUpperCase()}`,
    body: `Dirección: ${direccion}. ${detalle}`,
    source,
    approx,
    estado: null,
    origen,
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
  puntoAyudaLocal(
    "acopio-bogota-cpdh",
    "Bogotá",
    "CPDH",
    "Carrera 18 #32A-11",
    [-74.073483, 4.621095],
    "Reciben colchonetas, cobijas, alimentos no perecederos, ropa y zapatos, vendas, gasas, solución salina, ropa interior nueva, productos de higiene menstrual y alimento para perros y gatos. Horario publicado: lunes a domingo, de 8:00 a.m. a 6:00 p.m. Confirmar antes de desplazarse.",
    "Piezas informativas de centros de acopio compartidas por el usuario, 10 ago.",
  ),
  puntoAyudaLocal(
    "acopio-bogota-bosa",
    "Bogotá",
    "Punto de acopio Bosa",
    "Carrera 87 #49A-38 sur",
    [-74.1885, 4.6265],
    "Reciben colchonetas, cobijas, alimentos no perecederos, ropa y zapatos, insumos médicos básicos, productos de higiene menstrual y alimento para animales. Horario publicado: lunes a domingo, de 8:00 a.m. a 6:00 p.m. Confirmar antes de desplazarse.",
    "Piezas informativas de centros de acopio compartidas por el usuario, 10 ago.",
  ),
  puntoAyudaLocal(
    "acopio-bogota-carrera-6",
    "Bogotá",
    "Punto de acopio Carrera 6",
    "Carrera 6 #27-72",
    [-74.068743, 4.613435],
    "Reciben colchonetas, cobijas, alimentos no perecederos, ropa y zapatos, insumos médicos básicos, productos de higiene menstrual y alimento para animales. Horario publicado: lunes a domingo, de 8:00 a.m. a 6:00 p.m. Confirmar antes de desplazarse.",
    "Piezas informativas de centros de acopio compartidas por el usuario, 10 ago.",
  ),
  puntoAyudaLocal(
    "acopio-bogota-colombia-humana",
    "Bogotá",
    "Sede Colombia Humana",
    "Transversal 17A bis #36-74",
    [-74.072465, 4.625599],
    "Sede anunciada como centro de acopio. La pieza no indica horario ni artículos específicos; confirmar antes de desplazarse.",
    "Listado de sedes de acopio compartido por el usuario, 10 ago.",
  ),
  puntoAyudaLocal(
    "acopio-bogota-otra-guardia",
    "Bogotá",
    "La Otra Guardia",
    "Carrera 17 #30-54",
    [-74.073513, 4.619312],
    "Sede anunciada como centro de acopio. La pieza no indica horario ni artículos específicos; confirmar antes de desplazarse.",
    "Listado de sedes de acopio compartido por el usuario, 10 ago.",
  ),
  puntoAyudaLocal(
    "acopio-bogota-casa-pcn",
    "Bogotá",
    "Casa PCN",
    "Calle 12D #1A-10",
    [-74.068678, 4.598861],
    "Sede anunciada como centro de acopio. La pieza no indica horario ni artículos específicos; confirmar antes de desplazarse.",
    "Listado de sedes de acopio compartido por el usuario, 10 ago.",
  ),
  puntoAyudaLocal(
    "acopio-bogota-facultad-rayon",
    "Bogotá",
    "Facultad del Rayón",
    "Carrera 19 #43A-25, Teusaquillo",
    [-74.072245, 4.632369],
    "Reciben alimentos no perecederos y productos de higiene personal para entregar al Banco de Alimentos de Bogotá. Horario publicado: lunes a sábado, de 11:00 a.m. a 8:00 p.m. Confirmar antes de desplazarse.",
    "Facultad del Rayón (@lafacultad.delrayon), 10 ago.",
  ),
  puntoAyudaLocal(
    "acopio-ibague-banco-alimentos",
    "Ibagué",
    "Banco Arquidiocesano de Alimentos",
    "Carrera 4 Estadio #23-42/44",
    [-75.215594, 4.43028],
    "Punto secundario de acopio. Confirmar disponibilidad antes de desplazarse: 316 423 7289.",
    "Banco Arquidiocesano de Alimentos de Ibagué / ABACO, 10 ago.",
    "oficial",
    "📦",
    true,
  ),
  puntoAyudaLocal(
    "sangre-bogota-cruz-roja",
    "Bogotá",
    "Banco Nacional de Sangre Cruz Roja",
    "Avenida Carrera 68 #68B-31",
    [-74.089331, 4.673248],
    "Punto fijo de donación. Confirmar requisitos y horario: 313 463 8636 o 310 210 0652.",
    "Cruz Roja Colombiana, Banco Nacional de Sangre",
    "oficial",
    "🩸",
  ),
  puntoAyudaLocal(
    "sangre-medellin-guayabal",
    "Medellín",
    "Cruz Roja Seccional Antioquia, Guayabal",
    "Carrera 52 #25-310",
    [-75.577228, 6.228108],
    "Punto fijo de donación. Horario publicado: lunes a viernes de 7:00 a.m. a 6:00 p.m. y sábados de 7:00 a.m. a 4:00 p.m.",
    "Cruz Roja Colombiana Seccional Antioquia",
    "oficial",
    "🩸",
  ),
  puntoAyudaLocal(
    "sangre-medellin-astoria",
    "Medellín",
    "Pasaje Comercial Astoria, local 103",
    "Carrera 49 #52-61",
    [-75.566194, 6.250623],
    "Punto fijo de donación. Horario publicado: lunes a sábado de 10:30 a.m. a 12:00 m. y de 1:00 p.m. a 5:30 p.m.",
    "Cruz Roja Colombiana Seccional Antioquia",
    "oficial",
    "🩸",
  ),
  puntoAyudaLocal(
    "sangre-villavicencio-cruz-roja",
    "Villavicencio",
    "Cruz Roja Seccional Meta",
    "Carrera 30 #39-30",
    [-73.636281, 4.153646],
    "Punto de donación de sangre. Confirmar requisitos y horario: 310 275 5012.",
    "Cruz Roja Colombiana, Red Nacional de Bancos de Sangre",
    "oficial",
    "🩸",
  ),
  puntoAyudaLocal(
    "sangre-cartagena-cruz-roja",
    "Cartagena",
    "Banco de Sangre Cruz Roja Seccional Bolívar",
    "Calle 30 #44D-71, barrio España",
    [-75.509989, 10.405994],
    "Punto de donación de sangre. Confirmar requisitos y horario: 310 627 6160.",
    "Cruz Roja Colombiana Seccional Bolívar",
    "oficial",
    "🩸",
  ),
  {
    id: "peligro-ariguani-refugio-cali",
    layer: "peligro",
    emoji: "⛔",
    title: "Unidad Residencial Ariguaní, El Refugio, Cali — Reporte de colapso",
    short: "Ariguaní, El Refugio, Cali",
    body: "Reporte ciudadano de colapso en la Carrera 67 #3C-15. Se pidió apoyo para buscar personas. INFORMACIÓN SIN VERIFICACIÓN INDEPENDIENTE: no acercarse ni interferir con los organismos de socorro; confirmar con las autoridades.",
    source: "Captura de reporte ciudadano compartida por el usuario, 10 ago.",
    approx: true,
    estado: null,
    origen: "mymaps",
    geometry: {
      type: "Point",
      coordinates: [-76.551642, 3.395545],
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
