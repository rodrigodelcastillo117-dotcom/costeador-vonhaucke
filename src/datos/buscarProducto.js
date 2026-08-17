// ============================================================================
//  BUSCAR UN PRODUCTO, NO UNA LÍNEA
//
//  Rodrigo: "si quiero agregar un producto me manda a una página gigante… es
//  DEMASIADO tardado, demasiados clicks. Piensa cómo cotizar lo de línea lo más
//  fácil, rápido, eficiente y fluido posible."
//
//  La causa medida: el buscador de Inicio filtraba sobre el título, la
//  descripción y el grupo de las 24 LÍNEAS — nunca sobre los 118 PRODUCTOS que
//  viven dentro. Resultado real:
//     "mesa de juntas" → 0 resultados   (y hay 8 líneas que la tienen)
//     "silla"          → 0 resultados
//     "escritorio"     → 6 líneas, y FALTABA Eclipse, la de escritorios
//  Así, para llegar a un producto había que adivinar en qué línea vive y
//  navegar una taxonomía —"Operativo / benching", "Guardas"— que un vendedor no
//  tiene por qué conocerse.
//
//  Aquí se aplanan las 24 líneas a un índice de sus 118 productos. Cada
//  resultado sabe su `ruta` y su `productoId`, así que al tocarlo se abre la
//  línea CON ESE PRODUCTO YA ESCOGIDO: de 5–6 toques por mueble a 3.
// ============================================================================
import { LINEAS_REG } from './lineas.js';
import { bancoUnico } from './banco.js';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Sinónimos de oficina: cómo lo dice un vendedor vs cómo se llama en el catálogo.
// Sin esto, "banca" no encuentra "bench" y "gaveta" no encuentra "pedestal",
// que es exactamente donde se rinde alguien que busca por primera vez.
const SINONIMOS = {
  bench: 'banca banco benching operativo isla puestos',
  banca: 'bench benching operativo isla',
  escritorio: 'mesa de trabajo estacion privado directivo ejecutivo',
  mesa_juntas: 'sala de juntas consejo board reunion junta',
  juntas: 'sala de juntas consejo board reunion',
  credenza: 'guarda mueble bajo lateral',
  archivero: 'guarda archivo cajones file',
  gaveta: 'pedestal rodante cajonera archivero movil',
  pedestal: 'gaveta rodante cajonera',
  locker: 'casillero guarda personal',
  librero: 'estante repisa guarda',
  armario: 'guardarropa closet guarda alto',
  recepcion: 'lobby mostrador front desk',
  mampara: 'biombo panel divisor privacidad cancel',
  biombo: 'mampara panel divisor privacidad',
  sillon: 'silla lounge butaca sofa',
  pouf: 'puff taburete otomana lounge',
  sofa: 'sillon lounge sala',
};

// ⚠️ Y LA SILLERÍA TAMBIÉN. Rodrigo: "no me salen en Cotizar de línea las
// sillas que ya tenemos". No salían porque la sillería es COMPRADA-REVENDIDA:
// no es una línea Von Haucke y vive sólo en el Banco de precios. Pero el
// vendedor no piensa en esa frontera: piensa "necesito una WIN". Aquí entran al
// mismo buscador, marcadas `banco: true` para que al tocarlas se abra el banco.
const SILLAS = bancoUnico()
  .filter((p) => p.categoria === 'Sillería')
  .map((p) => ({
    ruta: 'banco', banco: true, linea: 'Sillería', productoId: p.id, nombre: p.nombre,
    precio: p.precio,
    busca: sinAcentos([p.nombre, p.clave, p.material, 'silla silleria banco de precios'].join(' ')),
  }));

/** Los 118 productos de las 24 líneas + la sillería del banco. */
export const PRODUCTOS_INDEX = Object.entries(LINEAS_REG).flatMap(([ruta, L]) =>
  (L.productos || []).map((p) => ({
    ruta,
    linea: L.titulo,
    productoId: p.id,
    nombre: p.nombre,
    // Todo lo que se puede teclear para dar con él, en una sola cuerda.
    busca: sinAcentos([p.nombre, L.titulo, ruta, p.id.replace(/_/g, ' '), SINONIMOS[p.id] || ''].join(' ')),
  })),
).concat(SILLAS);

/**
 * Busca productos por lo que la gente teclea. Todas las palabras tienen que
 * aparecer (así "mesa juntas eclipse" afina en vez de traer de más), y primero
 * salen los que empiezan con lo que escribiste.
 */
export function buscarProductos(q, tope = 24) {
  const t = sinAcentos(q).trim();
  if (!t) return [];
  const palabras = t.split(/\s+/).filter(Boolean);
  const hit = PRODUCTOS_INDEX.filter((p) => palabras.every((w) => p.busca.includes(w)));
  return hit
    .sort((a, b) => {
      const ap = sinAcentos(a.nombre).startsWith(palabras[0]) ? 0 : 1;
      const bp = sinAcentos(b.nombre).startsWith(palabras[0]) ? 0 : 1;
      return ap !== bp ? ap - bp : a.nombre.localeCompare(b.nombre);
    })
    .slice(0, tope);
}
