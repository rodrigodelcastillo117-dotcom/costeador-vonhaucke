// Comparador del BOM FINAL (el DTO real que recibe costear-servidor) contra la hoja de control de un fixture.
// No decide nada por la persona: dice, renglón por renglón esperado, si el BOM lo trae completo, duplicado,
// omitido o con medida/cantidad/material distinto, y lista lo que sobra. Lo usan labCostear.e2e.js y
// lab/costear/verificarHoja.mjs (sobre corridas guardadas).

const rx = (s) => (s ? new RegExp(s, 'i') : null);
const ordenar = (a, b) => [Math.max(a, b), Math.min(a, b)];

// Medida neta del renglón: piezas (área), metros (lineal), cantidad (pieza), m² (área total).
function medidas(c) {
  const piezas = (Number(c.piezas) > 0 ? Number(c.piezas) : 1) * (Number(c.cantidad) > 0 && Number(c.largoMM) > 0 && Number(c.anchoMM) > 0 ? Number(c.cantidad) : 1);
  const areaM2 = Number(c.largoMM) > 0 && Number(c.anchoMM) > 0 ? (Number(c.largoMM) * Number(c.anchoMM) / 1e6) * piezas : null;
  return { piezas, areaM2, cantidad: Number(c.cantidad) || 0 };
}

export function compararConHoja(componentes = [], hoja = {}) {
  const comps = (Array.isArray(componentes) ? componentes : []).filter((c) => c && !c.excluida);
  const esperados = hoja.esperado || [];
  const nombre = (c) => String(c.nombre || '');
  const casa = (e, c, conMaterial) => rx(e.patron).test(nombre(c)) && !(e.noPatron && rx(e.noPatron).test(nombre(c))) && (!conMaterial || !e.ids || rx(e.ids).test(String(c.insumoId || '')));
  // 1ª pasada: material Y nombre. Un renglón se asigna al primer esperado que lo reclama así.
  const asignado = new Map();   // índice comp → índice esperado
  esperados.forEach((e, k) => comps.forEach((c, i) => { if (!asignado.has(i) && casa(e, c, true)) asignado.set(i, k); }));
  // 2ª pasada: esperados sin nada → ¿hay un renglón LIBRE con ese nombre pero otro material? (error de material)
  const malMaterial = new Map();
  esperados.forEach((e, k) => {
    if ([...asignado.values()].includes(k)) return;
    comps.forEach((c, i) => { if (!asignado.has(i) && !malMaterial.has(i) && casa(e, c, false)) malMaterial.set(i, k); });
  });
  const filas = esperados.map((e, k) => {
    const M = comps.map((c, i) => ({ c, i })).filter(({ i }) => asignado.get(i) === k).map(({ c }) => ({ c, ...medidas(c) }));
    const mal = comps.filter((_, i) => malMaterial.get(i) === k);
    const f = { clave: e.clave, renglones: M.length, materiales: [...new Set(M.map((m) => m.c.insumoId))], estado: 'PASS', motivos: [], evidencia: e.evidencia || null, inferido: !!e.inferido };
    const falla = (msg) => { f.estado = e.inferido && f.estado !== 'FAIL' ? 'RIESGO' : 'FAIL'; f.motivos.push(msg + (e.inferido ? ' (inferido: el plano no lo acota)' : '')); };
    if (mal.length) { f.estado = 'FAIL'; f.motivos.push(`material fuera de la familia esperada (${e.ids}): ${mal.map((c) => `${c.nombre} [${c.insumoId || 'vacío'}]`).join(', ')}`); }
    if (!M.length) { if (!mal.length) falla('omitido: ningún renglón del BOM corresponde'); return f; }
    if (e.piezas != null) {
      const total = M.reduce((s, m) => s + m.piezas, 0); f.piezas = total;
      if (total !== e.piezas) falla(total > e.piezas ? `duplicado: ${total} piezas, el plano dice ${e.piezas}` : `faltan piezas: ${total}, el plano dice ${e.piezas}`);
      if (e.dims) {
        const [EL, EA] = ordenar(e.dims[0], e.dims[1]);
        const malas = M.filter((m) => { const [L, A] = ordenar(Number(m.c.largoMM) || 0, Number(m.c.anchoMM) || 0); return Math.abs(L - EL) > e.tol || Math.abs(A - EA) > e.tol; });
        if (malas.length) falla(`medida distinta (esperado ${EL}×${EA} ±${e.tol}): ${malas.map((m) => `${m.c.largoMM}×${m.c.anchoMM}`).join(', ')}`);
      }
    }
    if (e.areaM2 != null) {
      const a = M.reduce((s, m) => s + (m.areaM2 || 0), 0); f.areaM2 = Math.round(a * 1000) / 1000;
      if (Math.abs(a - e.areaM2) > e.areaM2 * (e.tolPct || 10) / 100) falla(`área ${f.areaM2} m², el plano da ${e.areaM2} m² (±${e.tolPct || 10} %)`);
    }
    if (e.metros) {
      const m = M.reduce((s, x) => s + x.cantidad, 0); f.metros = Math.round(m * 1000) / 1000;
      if (m < e.metros[0] || m > e.metros[1]) falla(`${f.metros} m, esperado ${e.metros[0]}–${e.metros[1]} m`);
      if (!e.suma && M.length > 1) falla(`duplicado: ${M.length} renglones`);
    }
    if (e.cantidad != null) {
      const q = M.reduce((s, x) => s + x.cantidad * (Number(x.c.piezas) > 0 ? Number(x.c.piezas) : 1), 0); f.cantidad = q;
      if (q !== e.cantidad) falla(`cantidad ${q}, el plano dice ${e.cantidad}`);
    }
    return f;
  });
  const permitidos = rx(hoja.extrasPermitidos);
  const sobran = comps.filter((_, i) => !asignado.has(i) && !malMaterial.has(i)).map((c) => ({ nombre: c.nombre, insumoId: c.insumoId, permitido: !!(permitidos && permitidos.test(nombre(c))) }));
  const resumen = {
    esperados: filas.length,
    pass: filas.filter((f) => f.estado === 'PASS').length,
    fail: filas.filter((f) => f.estado === 'FAIL').length,
    riesgo: filas.filter((f) => f.estado === 'RIESGO').length,
    sobrantesNoPermitidos: sobran.filter((s) => !s.permitido).length,
    renglonesBom: comps.length,
  };
  resumen.veredicto = resumen.fail || resumen.sobrantesNoPermitidos ? 'FAIL' : resumen.riesgo ? 'RIESGO' : 'PASS';
  return { resumen, filas, sobran };
}

// Componentes del DTO guardado por labCostear (8-dto-servidor.json: { req, res }).
export function componentesDeDto(dto) {
  let req = dto && dto.req; if (typeof req === 'string') { try { req = JSON.parse(req); } catch (_e) { req = null; } }
  const buscar = (o) => { if (!o || typeof o !== 'object') return null; if (Array.isArray(o.componentes)) return o.componentes; for (const v of Object.values(o)) { const r = buscar(v); if (r) return r; } return null; };
  return buscar(req) || [];
}
