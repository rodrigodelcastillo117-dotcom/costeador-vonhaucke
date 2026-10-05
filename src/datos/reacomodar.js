// ============================================================================
//  RE-ACOMODAR SIN BORRAR LO QUE PUSISTE A MANO
//
//  Rodrigo (2026-08-17): "que al volver a armar NO se borre lo que edité a
//  mano". Y tenía razón en que dolía: el proyectista pasa media hora poniendo
//  los cinco privados como los quiere, agrega un mueble a la cotización, toca
//  "Que lo acomode Voni otra vez" — y el motor le devuelve un plano nuevo desde
//  cero. Se acomoda con miedo.
//
//  LA IDEA, EN UNA LÍNEA: lo que el proyectista puso con el dedo deja de ser
//  "un mueble por acomodar" y pasa a ser ESPACIO OCUPADO. Se le entrega al
//  motor como obstáculo —igual que una columna— y el motor acomoda el resto
//  alrededor. Así no hay dos motores ni un modo especial: es el mismo de
//  siempre, con menos espacio libre.
//
//  Se marca a mano en `Acomodo.jsx` con `manual: true` sobre la colocación (al
//  soltar con el dedo, al girar y al "ponlas todas aquí"). El marcador viaja
//  dentro del plan, así que sobrevive a guardar, salir y volver.
// ============================================================================
import { acomodarLocal, sentarSillas } from './planner.js';
import { dimsPieza } from './espacio.js';
import { sentarJuntas } from './juntasLayout.js';

// Qué colocaciones cuentan como "puestas a mano": las marcadas Y que todavía
// existan en la cotización (si quitaste el mueble, su lugar se libera).
export function fijasDe(colocacion, piezas) {
  const vivas = new Set((piezas || []).map((p) => p.id));
  return (colocacion || []).filter((c) => c && c.manual && vivas.has(c.id));
}

export function reacomodar({ areas, piezas, colocacion = [], byId, ajustar = false, respetarManual = true }) {
  const mapa = byId && Object.keys(byId).length
    ? byId
    : Object.fromEntries((piezas || []).map((p) => [p.id, p]));
  const fijas = respetarManual ? fijasDe(colocacion, piezas) : [];

  // Sin nada a mano: motor normal + una sola pasada semántica de salas de
  // juntas. La mesa conserva la posición del planner; las sillas usan la zona
  // que el planner ya reservó alrededor de esa mesa.
  if (!fijas.length) {
    const base = acomodarLocal(areas, piezas, { ajustar });
    const areasFinales = base.areas || areas;
    return { ...sentarJuntas({ ...base, areas: areasFinales }, piezas, areasFinales), fijas: 0 };
  }

  const idFijo = new Set(fijas.map((c) => c.id));
  const resto = (piezas || []).filter((p) => !idFijo.has(p.id));

  // Lo puesto a mano, convertido a huecos que el motor no puede usar. `tipo`
  // sólo lo lee el dibujo, y estas áreas NO se dibujan: son la copia que se le
  // da al motor. Las de verdad se devuelven intactas más abajo.
  const areasConFijos = (areas || []).map((a, i) => {
    const propios = fijas
      .filter((c) => (c.area ?? 0) === i)
      .map((c) => {
        const p = mapa[c.id];
        if (!p) return null;
        const { pw, ph } = dimsPieza(p, c.rot || 0);
        return { x: c.x, y: c.y, w: pw, h: ph, tipo: 'fijo' };
      })
      .filter(Boolean);
    return propios.length ? { ...a, obstaculos: [...(a.obstaculos || []), ...propios] } : a;
  });

  // Con muebles ya puestos NO se re-dimensiona el espacio: crecer el cuarto
  // debajo de un acomodo hecho a mano mueve el suelo bajo los pies.
  const r = acomodarLocal(areasConFijos, resto, { ajustar: false });
  // ⚠️ LA SILLA NO ENCUENTRA EL ESCRITORIO QUE PUSISTE A MANO. `acomodarLocal`
  // ya sienta cada silla junto a su escritorio (`sentarSillas`, planner.js),
  // pero sólo ve lo que le tocó acomodar A ÉL (`resto`): un escritorio fijo
  // viaja como OBSTÁCULO en `areasConFijos`, no como una colocación, así que
  // para esa llamada no existe ningún escritorio en ese cuarto. Medido: mover un
  // escritorio con el dedo y agregar su silla a la cotización → la silla se
  // acomodaba contra el muro opuesto, a metros del escritorio al que pertenece,
  // en vez de quedar pegada a él como en cualquier otro camino del motor.
  // Se vuelve a sentar sobre el resultado YA COMBINADO (fijo + nuevo), con la
  // lista COMPLETA de piezas y las áreas de verdad: ahí el escritorio manual sí
  // aparece como colocación y es candidato para sentar su silla.
  const puestas = sentarSillas([...fijas, ...(r.colocacion || [])], piezas, areas);
  const caben = puestas.length === (piezas || []).length;

  // La auditoría del motor contó SÓLO lo que le tocó acomodar ("12 de 12"
  // cuando había 30). Un cartel verde que miente es peor que no tener cartel.
  const auditoria = (r.auditoria || []).map((a) => (
    a.check === 'Todas las piezas colocadas'
      ? { ...a, ok: caben, detalle: `${puestas.length} de ${(piezas || []).length}` }
      : a
  ));
  auditoria.push({
    check: 'Respeté lo que pusiste a mano', ok: true,
    detalle: `${fijas.length} mueble(s) se quedaron exactamente donde los dejaste`,
  });

  const notas = [...(r.notas || [])];
  const sobran = (piezas || []).length - puestas.length;
  if (sobran > 0 && !notas.length) {
    notas.push(`${sobran} pieza(s) no cupieron alrededor de lo que acomodaste a mano.`);
  }

  const combinado = {
    ...r,
    // ⚠️ Las áreas que se devuelven son las DE VERDAD, no las que llevan los
    // muebles disfrazados de obstáculo: si se guardan éstas, el plano dibuja
    // columnas fantasma donde hay escritorios.
    areas,
    colocacion: puestas,
    caben, auditoria, notas,
    resumen: `Se respetaron ${fijas.length} mueble(s) que acomodaste a mano y se acomodó el resto alrededor. ${r.resumen || ''}`.trim(),
  };

  // Las sillas de junta AUTOMÁTICAS se acomodan en torno a la mesa después de
  // recombinar lo manual. Una silla que el usuario movió a mano permanece fija.
  const conJuntas = sentarJuntas(combinado, piezas, areas);
  return { ...conJuntas, fijas: fijas.length };
}
