// ============================================================================
//  AUDITORÍA DE CALIDAD DEL ACOMODO  ·  capa de VERIFICACIÓN (no cambia el motor)
//  Dado el resultado del planner ({areas mm, colocacion:[{id,area,x,y,rot}], byId}),
//  comprueba de forma determinista que el acomodo sea físicamente honesto:
//    · ningún mueble encimado con otro de su misma área,
//    · ningún mueble fuera de los límites de su área.
//  Es el contrato de confianza del acomodo: si el motor (o un arrastre manual, o
//  `sentarSillas`) dejó un encimado, esto lo DETECTA en vez de dibujarlo como si
//  todo estuviera bien. No corrige: reporta.
//  Unidades en mm (igual que el motor). x/y = esquina sup-izq LOCAL al área;
//  rot 90/270 intercambia ancho×fondo.
// ============================================================================

// Huella (footprint) de una pieza colocada, respetando el giro.
export function footprintPieza(col, pieza) {
  const w0 = Number(pieza?.w) || 0;
  const d0 = Number(pieza?.d) || 0;
  const rot = ((Number(col?.rot) || 0) % 180 + 180) % 180;   // 0 o 90 efectivos
  const [w, h] = rot === 90 ? [d0, w0] : [w0, d0];
  return { x: Number(col?.x) || 0, y: Number(col?.y) || 0, w, h };
}

// Profundidad del solape en cada eje (mm). 0 si no se tocan en ese eje.
export function solapeEjes(a, b) {
  const dx = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const dy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return { dx, dy };
}

// Área (mm²) de intersección entre dos huellas (0 si no se tocan).
export function areaSolapeMM2(a, b) {
  const { dx, dy } = solapeEjes(a, b);
  return dx * dy;
}

// Auditoría completa. `tol` (mm) absorbe el roce de redondeos: por debajo de
// tol×tol no se considera encimado, y tol de margen al salirse del área.
export function auditarColocacion({ areas = [], colocacion = [], byId = {} } = {}, { tol = 50 } = {}) {
  const overlaps = [];
  const fuera = [];

  const porArea = new Map();
  for (const c of colocacion) {
    const a = c?.area ?? 0;
    if (!porArea.has(a)) porArea.set(a, []);
    porArea.get(a).push(c);
  }

  for (const [ai, items] of porArea) {
    const area = areas[ai];
    const fps = items.map((c) => ({ c, fp: footprintPieza(c, byId[c.id]) }));

    // Encimados entre piezas de la MISMA área (el motor separa con GAP; un encimado
    // es una anomalía real: arrastre manual, sentarSillas, o un bug de empaque).
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        // Encimado REAL = se montan más de `tol` en AMBOS ejes. Una astilla fina
        // (grueso de muro / roce de redondeo) sólo invade un eje y se ignora.
        const { dx, dy } = solapeEjes(fps[i].fp, fps[j].fp);
        if (dx > tol && dy > tol) {
          overlaps.push({ a: fps[i].c.id, b: fps[j].c.id, area: ai, m2: +((dx * dy) / 1e6).toFixed(2) });
        }
      }
    }

    // Fuera de los límites del área (bbox en mm). Sólo si el área trae medidas.
    if (area && area.ancho > 0 && area.largo > 0) {
      for (const { c, fp } of fps) {
        if (fp.x < -tol || fp.y < -tol || fp.x + fp.w > area.ancho + tol || fp.y + fp.h > area.largo + tol) {
          fuera.push({ id: c.id, area: ai });
        }
      }
    }
  }

  const ok = overlaps.length === 0 && fuera.length === 0;
  return {
    ok,
    overlaps,
    fuera,
    // En el mismo formato que la `auditoria` del planner, para fundirlo en la UI.
    checks: [
      { check: 'Sin muebles encimados', ok: overlaps.length === 0, detalle: overlaps.length ? `${overlaps.length} encimado(s)` : 'ninguno' },
      { check: 'Todo dentro de su área', ok: fuera.length === 0, detalle: fuera.length ? `${fuera.length} fuera` : 'ok' },
    ],
    resumen: ok ? 'Acomodo físicamente honesto: sin encimados ni piezas fuera de su área.'
      : `${overlaps.length} encimado(s) y ${fuera.length} fuera de área — revisa el acomodo.`,
  };
}
