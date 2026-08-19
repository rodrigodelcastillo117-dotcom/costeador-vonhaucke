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

// ⚠️ UNA SALA DE JUNTAS SIEMPRE VA EN PAR (Rodrigo, 2026-08-17): "8, no 9".
// La gente se sienta enfrentada a los dos lados de la mesa, así que un número
// impar deja una silla sola en la cabecera o un lugar vacío. Se redondea HACIA
// ABAJO al par: más vale prometer 8 que no quepan 9.
const M2_POR_PERSONA = 4;        // con su paso alrededor de la mesa
export const personasEnSala = (m2) => Math.max(4, 2 * Math.floor((m2 || 0) / M2_POR_PERSONA / 2));

// ¿Sobra lugar en la sala para una credenza? Rodrigo: "me hubiera gustado que
// me propusiera, si es que hay espacio, una credenza para guardar cosas o poner
// café, galletas y refrescos". Es un mueble contra el muro: pide poco, pero
// pide. Se ofrece sólo cuando de verdad sobra, no siempre.
const M2_CREDENZA = 4;
export const cabeCredenza = (m2, personas) => (m2 || 0) - (personas || 0) * M2_POR_PERSONA >= M2_CREDENZA;

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
  // ⚠️ 2026-08-18: un área operativa que CONTIENE una sala de juntas circular
  // (dentroDe) se excluía de `abiertos` igual que si contuviera islas — y como
  // la sala de juntas no es una zona 'open', tampoco entraba a `zonas`. El área
  // desaparecía entera: 0 operativos, aunque el plano sí pedía 90 personas ahí.
  // Sólo hay que excluir al padre cuando lo que contiene son ISLAS abiertas
  // (`zonas`) — un cuarto cerrado anidado (junta/privado) no vuelve pasillo al
  // que lo rodea.
  const nombresConIslas = new Set(zonas.map((z) => z.dentroDe));
  const abiertos = lista.filter((a) => !esZona(a) && rolDe(a) === 'open' && !nombresConIslas.has(a.nombre));
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
        // ⚠️ EL AVISO TIENE QUE ENSEÑAR LA CUENTA, NO EL RESULTADO. Rodrigo:
        // *"¿por qué con 1.8 caben 32 pero con 1.5 caben 48? No entiendo esa
        // lógica"*. Y tenía razón: decir el número sin la división obliga a
        // creerle a la app. Lo que pasa es que la isla no es múltiplo del
        // puesto y el pedazo que sobra no alcanza para sentar a nadie.
        const A = islasA[0];
        const L = Math.max(A.ancho || 0, A.largo || 0);
        const lp = largoPuesto / 1000;
        const porHilera = Math.floor(L / lp);
        const sobra = L - porHilera * lp;
        avisos.push(
          `Tus islas miden ${L.toFixed(2)} m de largo: con ${lp.toFixed(2)} m por puesto caben `
          + `${porHilera} por hilera${sobra > 0.05 ? ` y sobran ${sobra.toFixed(2)} m que no alcanzan para otro` : ''}. `
          + `Son ${operativos} en total. Con 1.50 m caben ${Math.floor(L / 1.5)} por hilera y serían ${con150}.`,
        );
      }
      if (!operativos) avisos.push(`Las zonas de trabajo del plano son chicas para un puesto de ${(largoPuesto / 1000).toFixed(2)} m.`);
    }
  }

  const m2Salas = salasA.map((a) => (a.ancho || 0) * (a.largo || 0));
  const salas = m2Salas.map(personasEnSala);
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
    salasInfo: salasA.map((a, i) => ({ nombre: a.nombre, m2: m2Salas[i], caben: salas[i] })),
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

/**
 * Lo que hay que DECIRLE de la sala de juntas, según lo que él pidió.
 *
 * ⚠️ SE PROPONE, NO SE IMPONE (Rodrigo, 2026-08-17): *"que me avise y me diga:
 * por el espacio podríamos meter una sala de juntas para 8 personas… pero en
 * este caso yo pedí una de 4"*. La app no le corrige el 4 por la espalda: le
 * dice lo que cabe y él decide. Y de ahí sale lo otro que pidió: si pide menos
 * de lo que cabe, **sobra lugar para una credenza** — café, galletas, refrescos
 * y guardado.
 */
export function avisosDeSala(pr, personasPedidas) {
  const out = [];
  const n = personasPedidas || 0;
  if (!pr?.hayPlano || !n) return out;
  for (const s of pr.salasInfo || []) {
    const m2 = Math.round(s.m2);
    if (n > s.caben) {
      out.push(`${s.nombre} mide ${m2} m²: da para ${s.caben} personas, y pediste ${n}. Va a quedar apretada.`);
      continue;
    }
    if (n < s.caben) out.push(`Por el espacio de ${s.nombre} (${m2} m²) podríamos meter una sala para ${s.caben}; pediste ${n}.`);
    if (cabeCredenza(s.m2, n)) out.push(`En ${s.nombre} sobra lugar para una credenza: guardado, café, galletas y refrescos.`);
  }
  return out;
}
