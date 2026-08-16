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

// De `p12-3` a `p12`: el id de pieza que arma `expandirPiezas`.
const partidaDe = (idPieza) => String(idPieza).replace(/-\d+$/, '');

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
  const areas = acomodo?.areas || [];
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

  const bloques = [];
  for (const [i, m] of [...cuenta.entries()].sort((a, b) => a[0] - b[0])) {
    const a = areas[i];
    const renglones = [...m.entries()].map(([pid, cantidad]) => {
      const p = porPartida[pid];
      return {
        nombre: p.nombre, cantidad,
        unitario: p.precioUnitario || 0,
        importe: (p.precioUnitario || 0) * cantidad,
      };
    }).sort((x, y) => y.importe - x.importe);
    bloques.push({
      nombre: a?.nombre || `Área ${i + 1}`,
      tipo: a?.tipo || null,
      m2: Math.round(m2De(a) * 10) / 10,
      renglones,
      total: renglones.reduce((s, r) => s + r.importe, 0),
    });
  }

  // Lo que la cotización trae pero el acomodo no colocó (o piezas que no piden
  // piso, como las gavetas rodantes). Se dice en vez de desaparecerlo: si no,
  // los totales por área no suman el total de la propuesta y nadie sabe por qué.
  const colocadasPorPartida = {};
  for (const c of colocacion) {
    const pid = partidaDe(c.id);
    colocadasPorPartida[pid] = (colocadasPorPartida[pid] || 0) + 1;
  }
  const sueltas = partidas
    .map((p) => ({ p, falta: (p.cantidad || 0) - (colocadasPorPartida[p.id] || 0) }))
    .filter((r) => r.falta > 0)
    .map(({ p, falta }) => ({
      nombre: p.nombre, cantidad: falta,
      unitario: p.precioUnitario || 0,
      importe: (p.precioUnitario || 0) * falta,
    }));
  if (sueltas.length) {
    bloques.push({
      nombre: 'Sin ubicar en el plano', tipo: null, m2: 0,
      renglones: sueltas.sort((x, y) => y.importe - x.importe),
      total: sueltas.reduce((s, r) => s + r.importe, 0),
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
