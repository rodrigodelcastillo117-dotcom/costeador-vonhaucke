// ============================================================================
//  EL PROGRAMA SALE DEL PLANO  ·  criterio, no un cuestionario en blanco.
//
//  Rodrigo, 2026-08-17, probando con su plano real:
//    "nunca me pide la línea de los escritorios, ni benchs, ni sala de juntas,
//     ni nada… YO TUVE QUE PONER TODAS LAS CANTIDADES, no tuvo criterio de
//     decidir cuántos usuarios en benchs, cuántos en privados, cuántas sillas y
//     cuántas gavetas".
//
//  El plano YA lo dice: 8 islas de 4.5 × 3.5 m, 5 privados, dos salas, recepción.
//  Aquí se traduce a un PROGRAMA, para que el cuestionario llegue lleno y él
//  sólo cambie lo que quiera.
//
//  ⚠️ Y ESTO NO ES COSMÉTICO. Sin saber de las islas, Voni armó **4 bancas de 12
//  usuarios de 10.80 m** para islas de 4.5 m: ninguna cabía y TODO cayó en "sin
//  ubicar en el plano". El acomodo no puede arreglar un programa imposible.
//
//  Todo en METROS (es lo que devuelve `areasDeLectura` y lo que guarda `areasM`).
// ============================================================================
import { rolArea } from './planner.js';

// El rol de un cuarto: lo que declaró el lector, o su nombre. Mismo criterio que
// usa el acomodo — si difirieran, la app propondría un programa para unos
// cuartos y lo acomodaría en otros.
export const rolDe = (a) => a?.tipo || rolArea(a?.nombre);

// Una ZONA es un área dibujada DENTRO de otra (las islas punteadas del open
// space). Un CUARTO tiene muros propios.
const esZona = (a) => !!a?.dentroDe;

const FONDO_BENCH = 1.2;      // m, fondo de una hilera de bench
const SILLA = 0.66;           // m, lo que pide una silla detrás de la cubierta

/**
 * Cuántos puestos caben en UNA isla, con un largo de puesto dado.
 * La hilera corre por el lado largo; si el lado corto alcanza para dos hileras
 * enfrentadas con su silla, es bench doble. Es la misma regla del dibujo 3D y
 * del acomodo: `n = largo / largoPuesto` por hilera, doble si hay fondo.
 */
export function puestosPorIsla(area, largoPuestoMM = 1500) {
  const L = Math.max(area?.ancho || 0, area?.largo || 0);
  const F = Math.min(area?.ancho || 0, area?.largo || 0);
  const lp = (largoPuestoMM || 1500) / 1000;
  const porHilera = Math.floor(L / lp);
  if (porHilera < 1) return 0;
  // Dos hileras enfrentadas piden el fondo del bench + una silla de cada lado.
  const doble = F >= FONDO_BENCH + 2 * SILLA;
  // Una sola hilera pide el fondo + su silla.
  if (!doble) return F >= FONDO_BENCH + SILLA ? porHilera : 0;
  return porHilera * 2;
}

/** Personas que caben en una sala de juntas de `m2`. ~4 m² por persona con su paso. */
export const personasEnSala = (m2) => Math.max(4, Math.round((m2 || 0) / 4));

/**
 * Programa propuesto a partir de las áreas del plano.
 * @param areas  [{nombre, ancho, largo, tipo?, dentroDe?, contiene?}] en METROS
 * @param opts   { largoPuesto } en mm
 * @returns { operativos, privados, juntas, salas, recepcion, guardas,
 *            islas, porIsla, avisos, hayPlano }
 */
export function programaDelPlano(areas, opts = {}) {
  const largoPuesto = opts.largoPuesto || 1500;
  const lista = Array.isArray(areas) ? areas.filter(Boolean) : [];
  const vacio = {
    operativos: 0, privados: 0, juntas: 0, salas: [], recepcion: false, guardas: 0,
    islas: 0, porIsla: 0, avisos: [], hayPlano: false,
  };
  if (!lista.length) return vacio;

  const privados = lista.filter((a) => rolDe(a) === 'privado');
  const salasA = lista.filter((a) => rolDe(a) === 'juntas');
  const recepcion = lista.some((a) => rolDe(a) === 'recepcion');
  // Las islas: zonas de trabajo dentro de otro espacio. Si el plano no las
  // declara, el open space entero es una sola "isla".
  const zonas = lista.filter((a) => esZona(a) && rolDe(a) === 'open');
  const abiertos = lista.filter((a) => !esZona(a) && rolDe(a) === 'open' && !a.contiene);
  const islasA = zonas.length ? zonas : abiertos;

  const avisos = [];
  let operativos = 0, porIsla = 0;
  if (islasA.length) {
    const cuentas = islasA.map((a) => puestosPorIsla(a, largoPuesto));
    operativos = cuentas.reduce((s, n) => s + n, 0);
    porIsla = cuentas[0] || 0;
    // ⚠️ EL AVISO QUE FALTABA. Con 1.80 m por puesto, una isla de 4.5 m da 2 por
    // hilera (4 por isla), no 3 (6): 32 personas en vez de 48. Antes esto no se
    // decía en ningún lado y el proyectista descubría el hueco al final.
    if (zonas.length) {
      const con150 = islasA.reduce((s, a) => s + puestosPorIsla(a, 1500), 0);
      if (largoPuesto > 1500 && con150 > operativos) {
        avisos.push(`Con ${(largoPuesto / 1000).toFixed(2)} m por puesto caben ${operativos} en tus ${islasA.length} islas. Con 1.50 m serían ${con150}.`);
      }
      if (!operativos) avisos.push(`Las zonas de trabajo del plano son chicas para un puesto de ${(largoPuesto / 1000).toFixed(2)} m.`);
    }
  }

  const salas = salasA.map((a) => personasEnSala((a.ancho || 0) * (a.largo || 0)));
  // REGLA DE OFICIO: un archivero por persona sentada. Con el plano de Rodrigo da
  // 48 + 5 = 53, que es exactamente lo que él tecleó a mano.
  const guardas = operativos + privados.length;

  return {
    operativos,
    privados: privados.length,
    juntas: salas.length ? Math.max(...salas) : 0,
    salas,
    recepcion,
    guardas,
    islas: islasA.length,
    porIsla,
    avisos,
    hayPlano: true,
  };
}

/** Una línea en español de lo que se leyó, para enseñarla arriba del cuestionario. */
export function resumenDelPlano(pr) {
  if (!pr?.hayPlano) return '';
  const t = [];
  if (pr.operativos) t.push(`${pr.operativos} operativos en ${pr.islas} ${pr.islas === 1 ? 'zona' : 'zonas'} de ${pr.porIsla}`);
  if (pr.privados) t.push(`${pr.privados} ${pr.privados === 1 ? 'privado' : 'privados'}`);
  if (pr.salas.length) t.push(`${pr.salas.length} ${pr.salas.length === 1 ? 'sala' : 'salas'} de juntas (${pr.salas.join(' y ')})`);
  if (pr.recepcion) t.push('recepción');
  return t.length ? `Del plano: ${t.join(' · ')}.` : '';
}
