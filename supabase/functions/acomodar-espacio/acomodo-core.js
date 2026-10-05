// ============================================================================
//  acomodo-core · núcleo DETERMINISTA del acomodo con repair-loop (hasta 3).
//  Puro: sin Deno, sin red. La propuesta de la IA se inyecta como `proponer`,
//  así el bucle y el validador son deterministas y testeables.
//
//  Contrato (resumen):
//   - validarColocacion(areas, piezas, colocacion) → verifica límites del área,
//     traslapes y que CADA pieza (por id, cantidad intacta) tenga posición válida.
//   - acomodarConReparacion({areas, piezas, proponer, maxIntentos}) → corre hasta
//     3 intentos; cada reintento recibe las violaciones concretas y las piezas ya
//     válidas (para NO moverlas). Nunca inventa muebles ni reduce cantidades.
//     Si al final quedan piezas sin colocar devuelve PARCIAL explícito
//     (colocadas/total, motivo por pieza, recomendaciones) y NUNCA completo=true.
//     Conserva la traza de los intentos para auditar.
// ============================================================================

// Huella efectiva según el giro (rot 90 intercambia ancho/fondo).
export function huellaConRot(pieza, rot) {
  const w = Number(pieza?.w) || 0;
  const d = Number(pieza?.d) || 0;
  return Number(rot) === 90 ? { w: d, d: w } : { w, d };
}

// Traslape de dos rectángulos (origen esquina sup-izq). Tolerancia para bordes
// que apenas se tocan (no es traslape real).
function seSolapan(a, b, tol = 1) {
  return a.x + tol < b.x + b.w && a.x + a.w > b.x + tol && a.y + tol < b.y + b.d && a.y + a.d > b.y + tol;
}

// Valida una colocación contra las áreas y las piezas pedidas. Determinista.
// Toda pieza pedida debe aparecer colocada, dentro de su área y sin traslapar.
export function validarColocacion(areas = [], piezas = [], colocacion = [], tolMM = 1) {
  const col = Array.isArray(colocacion) ? colocacion : [];
  const byId = new Map(col.map((c) => [String(c?.id), c]));
  const rectsPorArea = {};
  const porPieza = [];

  for (const p of piezas) {
    const id = String(p?.id);
    const c = byId.get(id);
    if (!c) { porPieza.push({ id, ok: false, area: null, motivo: 'no colocada: la IA no devolvió posición para esta pieza' }); continue; }

    const ai = Number(c.area);
    const area = areas[ai];
    if (!area) { porPieza.push({ id, ok: false, area: ai, motivo: `área inválida (${c.area})` }); continue; }

    const { w, d } = huellaConRot(p, c.rot);
    const x = Number(c.x); const y = Number(c.y);
    const A = Number(area.ancho); const L = Number(area.largo);
    const motivos = [];
    if (!Number.isFinite(x) || !Number.isFinite(y)) motivos.push('posición no numérica');
    if (x < -tolMM) motivos.push(`se sale por la izquierda (x=${Math.round(x)} mm)`);
    if (y < -tolMM) motivos.push(`se sale por arriba (y=${Math.round(y)} mm)`);
    if (Number.isFinite(x) && x + w > A + tolMM) motivos.push(`se sale por la derecha (${Math.round(x + w)} > ${A} mm del área "${area.nombre || ai}")`);
    if (Number.isFinite(y) && y + d > L + tolMM) motivos.push(`se sale por abajo (${Math.round(y + d)} > ${L} mm del área "${area.nombre || ai}")`);

    const rect = { id, x, y, w, d };
    rectsPorArea[ai] = rectsPorArea[ai] || [];
    for (const otro of rectsPorArea[ai]) {
      if (Number.isFinite(x) && Number.isFinite(y) && seSolapan(rect, otro, tolMM)) motivos.push(`traslapa con la pieza ${otro.id}`);
    }
    rectsPorArea[ai].push(rect);
    porPieza.push({ id, ok: motivos.length === 0, area: ai, motivo: motivos.join('; ') || null });
  }

  const colocadas = porPieza.filter((p) => p.ok).length;
  const total = piezas.length;
  const noColocadas = porPieza.filter((p) => !p.ok);
  return { ok: total > 0 && colocadas === total, colocadas, total, porPieza, noColocadas };
}

// Razones concretas para re-promptear (una por pieza inválida).
export function resumenViolaciones(val) {
  return (val?.noColocadas || []).map((p) => `Pieza ${p.id}: ${p.motivo || 'inválida'}`);
}

// Recomendaciones de corrección cuando el acomodo queda parcial. NUNCA propone
// reducir cantidades automáticamente (eso lo decide una persona).
export function recomendacionesParcial(val) {
  const motivos = (val?.noColocadas || []).map((p) => p.motivo || '').join(' ');
  const recs = [];
  if (/traslapa/.test(motivos)) recs.push('Hay traslapes: separa las piezas o baja la densidad de esa área.');
  if (/se sale/.test(motivos)) recs.push('Piezas que no caben en su área: muévelas a otra área con más espacio o revisa sus medidas.');
  if (/no colocada/.test(motivos)) recs.push('No hubo superficie libre suficiente para todas las piezas.');
  recs.push('Opciones: mover a otra área · cambiar el producto por uno más chico · acomodar a mano. No se reducen cantidades ni se inventan muebles para “hacerlo caber”.');
  return recs;
}

// Preserva SOLO las colocaciones válidas del intento previo (para no moverlas).
function colocacionesValidas(colocacion, val) {
  const okIds = new Set((val?.porPieza || []).filter((p) => p.ok).map((p) => String(p.id)));
  return (colocacion || []).filter((c) => okIds.has(String(c?.id)));
}

// Orquestador: corre `proponer` hasta `maxIntentos`, validando de forma
// determinista entre cada intento y alimentando las violaciones concretas.
// `proponer(ctx)` debe devolver { colocacion, zonas?, resumen?, notas?, caben? }.
export async function acomodarConReparacion({ areas, piezas, proponer, maxIntentos = 3 }) {
  const intentos = [];
  let mejor = null;
  let colocacionValidaPrevia = [];
  let violacionesPrevias = [];

  for (let intento = 1; intento <= maxIntentos; intento++) {
    let plan;
    try {
      plan = await proponer({ areas, piezas, intento, violacionesPrevias, colocacionValidaPrevia });
    } catch (e) {
      // Un intento que falla (API/JSON) no tira todo: se registra y se sigue
      // conservando el mejor parcial logrado hasta ahora.
      intentos.push({ intento, error: String(e?.message || e), colocadas: mejor?.val.colocadas || 0, total: piezas.length, violaciones: [] });
      continue;
    }
    const colocacion = (plan && Array.isArray(plan.colocacion)) ? plan.colocacion : [];
    const val = validarColocacion(areas, piezas, colocacion);
    intentos.push({ intento, colocadas: val.colocadas, total: val.total, violaciones: resumenViolaciones(val) });

    if (!mejor || val.colocadas > mejor.val.colocadas) mejor = { plan, colocacion, val };

    if (val.ok) {
      return {
        ok: true, completo: true,
        plan: { ...plan, caben: true },
        colocacion, colocadas: val.colocadas, total: val.total,
        porPieza: val.porPieza, noColocadas: [], recomendaciones: [], intentos,
      };
    }
    colocacionValidaPrevia = colocacionesValidas(colocacion, val);
    violacionesPrevias = resumenViolaciones(val);
  }

  // Agotados los intentos: PARCIAL explícito (mejor intento), nunca completo.
  const b = mejor || { plan: { colocacion: [] }, colocacion: [], val: validarColocacion(areas, piezas, []) };
  return {
    ok: true, completo: false,
    plan: { ...b.plan, caben: false },
    colocacion: b.colocacion,
    colocadas: b.val.colocadas, total: b.val.total,
    porPieza: b.val.porPieza,
    noColocadas: b.val.noColocadas,
    recomendaciones: recomendacionesParcial(b.val),
    intentos,
  };
}
