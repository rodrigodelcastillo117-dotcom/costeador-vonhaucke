// ============================================================================
//  RESUMEN DEL PROYECTO POR ÁREA
//
//  Rodrigo (2026-08-16): "que haga un resumen con precios de lo que es. Ejemplo
//  Sala Operativa (que son 15 benchs), que ponga la especificación y el TOTAL
//  DE ESA ÁREA."
//
//  Es como se lee un proyecto de oficina: no "36 piezas sueltas", sino "el open
//  space cuesta esto, los privados esto, la sala de juntas esto". El cliente
//  decide por área —recorta el comedor, agranda el open— y para eso necesita el
//  total de cada una.
//
//  De dónde sale: el ACOMODO ya sabe qué mueble quedó en qué cuarto
//  (`plan.colocacion[].area`), y cada pieza colocada arrastra el id de su
//  partida (`p1-3` viene de la partida `p1`). Con eso se reparte el importe de
//  cada partida entre las áreas donde de verdad quedaron sus piezas — no por
//  suposición.
// ============================================================================

import { vaBajoEscritorio, tipoDe } from './espacio.js';

// De `p12-3` a `p12`: el id de pieza que arma `expandirPiezas`.
const partidaDe = (idPieza) => String(idPieza).replace(/-\d+$/, '');

// Reparte una cantidad ENTERA entre varios cuartos, en proporción a un peso, y
// sin perder ni inventar una sola pieza (método del resto mayor). Si se
// redondeara cada parte por su cuenta, 4 gavetas entre 3 y 1 escritorios darían
// 3 + 1 = 4 unas veces y 3 + 2 = 5 otras: el total de la propuesta dejaría de
// cuadrar con la suma de las áreas.
export function repartirEntero(cantidad, pesos) {
  const suma = pesos.reduce((s, p) => s + p, 0);
  if (!suma || !cantidad) return pesos.map(() => 0);
  const exacto = pesos.map((p) => (cantidad * p) / suma);
  const parte = exacto.map(Math.floor);
  let faltan = cantidad - parte.reduce((s, n) => s + n, 0);
  const orden = exacto
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (let k = 0; faltan > 0; k = (k + 1) % orden.length, faltan--) parte[orden[k].i]++;
  return parte;
}

const m2De = (a) => {
  if (!a) return 0;
  if (a.poly?.length >= 3) {
    const p = a.poly;
    const s = p.reduce((acc, [x, y], i) => {
      const [x2, y2] = p[(i + 1) % p.length];
      return acc + (x * y2 - x2 * y);
    }, 0);
    return Math.abs(s / 2) / 1e6;      // el poly viene en mm
  }
  return ((a.ancho || 0) * (a.largo || 0)) / 1e6;
};

export function resumenPorArea(partidas, acomodo) {
  const colocacion = acomodo?.plan?.colocacion || [];
  // ⚠️ DE DÓNDE SALEN LOS NOMBRES DE LOS CUARTOS.
  // En el PDF de Rodrigo salían "Área 7", "Área 8", "Área 9" al lado de
  // "Oficina 4" y "Oficina 5": el acomodo guardado traía MENOS áreas que las que
  // referencia la colocación, así que `areas[7]` era `undefined` y se inventaba
  // un nombre. Un cliente leyendo "Área 8" en su propuesta no sabe qué cuarto es.
  // Se toma la lista que de verdad cubra los índices colocados.
  const maxI = colocacion.reduce((m, c) => Math.max(m, c.area ?? 0), -1);
  const cubre = (as) => Array.isArray(as) && as.length > maxI && as.every((a) => a);
  const areas = [acomodo?.areas, acomodo?.plan?.areas, acomodo?.areasM]
    .find(cubre) || acomodo?.areas || [];
  if (!partidas?.length) return [];

  const porPartida = Object.fromEntries(partidas.map((p) => [p.id, p]));
  // area -> id de partida -> cuántas piezas de esa partida cayeron ahí
  const cuenta = new Map();
  for (const c of colocacion) {
    const pid = partidaDe(c.id);
    if (!porPartida[pid]) continue;
    const k = c.area ?? 0;
    if (!cuenta.has(k)) cuenta.set(k, new Map());
    const m = cuenta.get(k);
    m.set(pid, (m.get(pid) || 0) + 1);
  }

  // ---- LAS GAVETAS TAMBIÉN ESTÁN EN UN CUARTO ------------------------------
  // Una gaveta rodante no se dibuja porque vive DEBAJO de la cubierta, pero no
  // está en el limbo: está bajo los escritorios de su cuarto. Antes caían todas
  // en "Sin ubicar en el plano", y el cliente leía que 25 gavetas no tenían
  // lugar. Se reparten siguiendo a los escritorios que sí se colocaron.
  const escritoriosPorArea = new Map();
  for (const c of colocacion) {
    const p = porPartida[partidaDe(c.id)];
    if (!p || tipoDe(p) !== 'escritorio') continue;
    const k = c.area ?? 0;
    escritoriosPorArea.set(k, (escritoriosPorArea.get(k) || 0) + 1);
  }
  const colocadasPorPartida = {};
  for (const c of colocacion) {
    const pid = partidaDe(c.id);
    colocadasPorPartida[pid] = (colocadasPorPartida[pid] || 0) + 1;
  }
  const areasConEscritorio = [...escritoriosPorArea.keys()].sort((a, b) => a - b);
  const bajoCubierta = new Map();      // area -> pid -> cuántas
  const repartidas = {};               // pid -> cuántas quedaron ubicadas así
  if (areasConEscritorio.length) {
    for (const p of partidas) {
      if (!vaBajoEscritorio(p)) continue;
      const falta = (p.cantidad || 0) - (colocadasPorPartida[p.id] || 0);
      if (falta <= 0) continue;
      const trozos = repartirEntero(falta, areasConEscritorio.map((k) => escritoriosPorArea.get(k)));
      areasConEscritorio.forEach((k, j) => {
        if (!trozos[j]) return;
        if (!bajoCubierta.has(k)) bajoCubierta.set(k, new Map());
        bajoCubierta.get(k).set(p.id, trozos[j]);
        if (!cuenta.has(k)) cuenta.set(k, new Map());
      });
      repartidas[p.id] = falta;
    }
  }

  const bloques = [];
  for (const [i, m] of [...cuenta.entries()].sort((a, b) => a[0] - b[0])) {
    const a = areas[i];
    const bajo = bajoCubierta.get(i) || new Map();
    const renglones = [...m.entries(), ...bajo.entries()].map(([pid, cantidad]) => {
      const p = porPartida[pid];
      return {
        nombre: p.nombre, cantidad,
        // Se dice con todas sus letras dónde está: no ocupa piso, va abajo.
        bajoCubierta: bajo.has(pid) && !m.has(pid),
        unitario: p.precioUnitario == null || !Number.isFinite(Number(p.precioUnitario)) ? null : Number(p.precioUnitario),
        importe: p.precioUnitario == null || !Number.isFinite(Number(p.precioUnitario))
          ? null : Number(p.precioUnitario) * cantidad,
      };
    }).sort((x, y) => (y.importe ?? -Infinity) - (x.importe ?? -Infinity));
    const incompletos = renglones.filter((r) => r.importe == null).length;
    bloques.push({
      nombre: a?.nombre || 'Sin ubicar en el plano',
      tipo: a?.tipo || null,
      m2: Math.round(m2De(a) * 10) / 10,
      renglones,
      total: incompletos ? null : renglones.reduce((s, r) => s + r.importe, 0),
      incompleto: incompletos > 0,
      renglonesSinPrecio: incompletos,
    });
  }

  // Lo que la cotización trae pero el acomodo no colocó NI pudo ubicar bajo una
  // cubierta. Se dice en vez de desaparecerlo: si no, los totales por área no
  // suman el total de la propuesta y nadie sabe por qué.
  const sueltas = partidas
    .map((p) => ({ p, falta: (p.cantidad || 0) - (colocadasPorPartida[p.id] || 0) - (repartidas[p.id] || 0) }))
    .filter((r) => r.falta > 0)
    .map(({ p, falta }) => ({
      nombre: p.nombre, cantidad: falta,
      unitario: p.precioUnitario == null || !Number.isFinite(Number(p.precioUnitario)) ? null : Number(p.precioUnitario),
      importe: p.precioUnitario == null || !Number.isFinite(Number(p.precioUnitario))
        ? null : Number(p.precioUnitario) * falta,
    }));
  if (sueltas.length) {
    bloques.push({
      nombre: 'Sin ubicar en el plano', tipo: null, m2: 0,
      renglones: sueltas.sort((x, y) => (y.importe ?? -Infinity) - (x.importe ?? -Infinity)),
      total: sueltas.some((r) => r.importe == null) ? null : sueltas.reduce((s, r) => s + r.importe, 0),
      incompleto: sueltas.some((r) => r.importe == null),
      renglonesSinPrecio: sueltas.filter((r) => r.importe == null).length,
      sinUbicar: true,
    });
  }
  return bloques;
}

// Una línea corta que describe el área por lo que TIENE, no por su nombre:
// "15 estaciones, 4 guardas". Es lo que Rodrigo pide ver junto al total.
export function especificacion(bloque) {
  const n = bloque.renglones.reduce((s, r) => s + r.cantidad, 0);
  if (!n) return '';
  return bloque.renglones
    .slice(0, 3)
    .map((r) => `${r.cantidad} × ${r.nombre.split('·')[0].trim()}`)
    .join(' · ') + (bloque.renglones.length > 3 ? ` · y ${bloque.renglones.length - 3} más` : '');
}
