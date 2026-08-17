// ============================================================================
//  "ESTO ENTENDÍ"  ·  la lectura en español de lo que Voni armó
//
//  Rodrigo (2026-08-17): "el paso 'esto entendí' — la lista corregible ANTES de
//  acomodar".
//
//  Hoy Voni lee un párrafo y devuelve VEINTE renglones de catálogo. Revisar
//  veinte renglones con clave y acabado no es revisar el proyecto: nadie cacha
//  ahí que pidió 37 lugares y le cotizaron 27 sillas. Aquí lo mismo se dice
//  como se habla —"22 puestos de trabajo · 27 sillas · 25 gavetas"— y se
//  señala lo que NO cuadra, que es lo único que hace que valga la pena un paso
//  más antes de acomodar.
//
//  ⚠️ NO ES UNA LISTA PARALELA. Es una LECTURA de las partidas que ya existen:
//  cada renglón apunta a su partida y el ± cambia esa partida, no una copia.
//  La lista intermedia de "renglones propuestos" ya se quitó una vez (2026-08-15)
//  justamente porque eran los mismos muebles en dos lados. Esto no lo repite.
// ============================================================================
import { tipoDe, vaBajoEscritorio } from './espacio.js';
import { esSillaDeTrabajo, esSillaDeVisita } from './planner.js';
import { puestosDe } from './porCuarto.js';

const sinAcento = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Una banca de 10 usuarios NO va en un privado: eso decide si un escritorio
// "llena" una oficina cerrada o no.
const esBench = (pt) => /banca|bench/.test(sinAcento(pt.nombre)) || puestosDe(pt.nombre) > 1;

// A qué renglón de la lectura pertenece cada partida. El orden de este arreglo
// es el orden en que se lee un proyecto: la gente, dónde se junta, dónde
// guarda, con qué se sienta.
const GRUPOS = [
  { clave: 'puestos', titulo: 'Puestos de trabajo', unidad: 'personas',
    es: (pt) => tipoDe(pt) === 'escritorio', cuenta: (pt) => puestosDe(pt.nombre, pt.cantidad) },
  { clave: 'juntas', titulo: 'Mesas de juntas', unidad: 'mesas',
    es: (pt) => tipoDe(pt) === 'juntas' },
  { clave: 'guardas', titulo: 'Guardado de piso', unidad: 'muebles',
    es: (pt) => tipoDe(pt) === 'guarda' && !vaBajoEscritorio(pt) },
  { clave: 'gavetas', titulo: 'Gavetas bajo la cubierta', unidad: 'gavetas',
    es: (pt) => vaBajoEscritorio(pt) },
  { clave: 'sillas', titulo: 'Sillas de trabajo', unidad: 'sillas',
    es: (pt) => esSillaDeTrabajo({ tipo: 'asiento', nombre: pt.nombre }) && !esSillaDeVisita({ tipo: 'asiento', nombre: pt.nombre }) },
  { clave: 'visita', titulo: 'Sillas de visita', unidad: 'sillas',
    es: (pt) => esSillaDeVisita({ tipo: 'asiento', nombre: pt.nombre }) },
  { clave: 'lounge', titulo: 'Lounge y espera', unidad: 'piezas',
    es: (pt) => tipoDe(pt) === 'asiento' },
  { clave: 'mamparas', titulo: 'Mamparas y muros', unidad: 'piezas',
    es: (pt) => tipoDe(pt) === 'mampara' },
  { clave: 'otros', titulo: 'Lo demás', unidad: 'piezas', es: () => true },
];

const esPrivado = (a) => /priv|direcc|gerenc|oficina/.test(sinAcento(a?.nombre)) || a?.tipo === 'privado';

export function loQueEntendi(partidas = [], areasM = []) {
  const grupos = GRUPOS.map((g) => ({ ...g, renglones: [], cuentaTotal: 0 }));
  for (const pt of partidas) {
    const g = grupos.find((x) => x.es(pt));
    g.renglones.push({ id: pt.id, nombre: pt.nombre, cantidad: pt.cantidad || 0 });
    g.cuentaTotal += g.cuenta ? g.cuenta(pt) : (pt.cantidad || 0);
  }
  const vivos = grupos.filter((g) => g.renglones.length)
    .map(({ es, cuenta, ...g }) => g);   // las funciones no salen de aquí

  const de = (clave) => vivos.find((g) => g.clave === clave)?.cuentaTotal || 0;
  const puestos = de('puestos');
  const sillas = de('sillas');
  const visitas = de('visita');
  const gavetas = de('gavetas');

  const cuartos = (areasM || []).map((a) => ({
    nombre: a.nombre,
    m2: Math.round((a.ancho || 0) * (a.largo || 0)),
    privado: esPrivado(a),
  }));
  const espacio = {
    hay: cuartos.length > 0,
    m2: Math.round(cuartos.reduce((s, c) => s + c.m2, 0)),
    cuartos,
    privados: cuartos.filter((c) => c.privado).length,
    pisos: new Set((areasM || []).map((a) => a.nivel ?? 0)).size,
  };

  // ---- LO QUE NO CUADRA ----------------------------------------------------
  // Esto es lo que justifica el paso. Son las tres cosas que se cachan tarde:
  // gente sin silla, privados vacíos y muebles sin espacio donde ponerlos.
  const avisos = [];
  if (!espacio.hay) {
    avisos.push({ tono: 'ambar', texto: 'Todavía no me dijiste dónde va el proyecto. Sin espacio no puedo acomodar.' });
  }
  if (puestos > 0 && sillas + visitas < puestos) {
    const faltan = puestos - sillas - visitas;
    avisos.push({
      tono: 'ambar',
      texto: `Son ${puestos} puestos de trabajo y ${sillas + visitas} silla(s): faltan ${faltan}.`,
    });
  }
  if (puestos > 0 && sillas > puestos) {
    avisos.push({ tono: 'ambar', texto: `Hay ${sillas} sillas de trabajo para ${puestos} puestos: sobran ${sillas - puestos}.` });
  }
  if (gavetas > puestos && puestos > 0) {
    avisos.push({ tono: 'ambar', texto: `Hay ${gavetas} gavetas para ${puestos} puestos: sobran ${gavetas - puestos}.` });
  }
  if (espacio.privados > 0) {
    const individuales = partidas
      .filter((pt) => tipoDe(pt) === 'escritorio' && !esBench(pt))
      .reduce((s, pt) => s + (pt.cantidad || 0), 0);
    if (individuales < espacio.privados) {
      avisos.push({
        tono: 'ambar',
        texto: `Dijiste ${espacio.privados} privado(s) y hay ${individuales} escritorio(s) individual(es): ${espacio.privados - individuales} se quedaría(n) vacío(s).`,
      });
    }
  }

  return {
    espacio, grupos: vivos, avisos,
    puestos, sillas, visitas, gavetas,
    // El titular: lo que Rodrigo quiere leer de un vistazo antes de seguir.
    titular: [
      espacio.hay ? `${espacio.m2} m²${espacio.pisos > 1 ? ` en ${espacio.pisos} pisos` : ''}` : null,
      espacio.privados ? `${espacio.privados} privado${espacio.privados === 1 ? '' : 's'}` : null,
      puestos ? `${puestos} puesto${puestos === 1 ? '' : 's'} de trabajo` : null,
      sillas + visitas ? `${sillas + visitas} silla${sillas + visitas === 1 ? '' : 's'}` : null,
      gavetas ? `${gavetas} gaveta${gavetas === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · '),
  };
}
