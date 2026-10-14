// Holdout Intelisis v3 · comparación del congelamiento (lógica pura; la usa scripts/congelar_holdout.mjs).
// Fail-closed: sin huellas frescas de base de datos, de Edge Y de los modelos observados, el resultado es
// NO_VERIFICADO, nunca OK. v3 (reauditoría v2, P1-02): los archivos son el CIERRE TRANSITIVO de imports de las entradas
// (antes una lista a mano dejaba fuera reglasTaller.js y acabados.js) y el modelo de IA se CONGELA por (fn, modo): un
// modelo observado distinto al esperado invalida la corrida (registrar el model_id no basta: el modelo sale de una
// variable de entorno que no cambia el SHA de la Edge).
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const sinFecha = (o) => { const c = JSON.parse(JSON.stringify(o || {})); delete c.medido_en; delete c.medidoEn; return c; };
// --- v5 (cierre pre-deploy, 14-oct): auditoría de las llamadas de UNA corrida (la usa el E2E al final de cada hoja) ---
// Toda llamada a analizar-mueble* cuenta: una respuesta sin request_id queda como null (antes `.filter(Boolean)` la
// borraba y el verificador nunca se enteraba). Toda llamada cuyo nombre empiece con costear-servidor tiene que ser
// EXACTAMENTE la RC; un caso costeable sin ninguna llamada RC no prueba nada.
const idValido = (x) => typeof x === 'string' && x.trim().length > 0;
export function auditarLlamadasCorrida(edges = [], { fnCosteo = 'costear-servidor-rc', costeable = true } = {}) {
  const lista = Array.isArray(edges) ? edges : [];
  const ia = lista.filter((e) => /^analizar-mueble/.test(e?.fn || ''));
  const request_ids = ia.map((e) => (idValido(e?.body?.request_id) ? e.body.request_id : null));
  const costeo = lista.filter((e) => String(e?.fn || '').startsWith('costear-servidor'));
  const porFn = {};
  for (const e of costeo) porFn[e.fn] = (porFn[e.fn] || 0) + 1;
  const rc = porFn[fnCosteo] || 0;
  const ajenas = Object.keys(porFn).filter((f) => f !== fnCosteo).sort();
  const sin_id = request_ids.filter((x) => x == null).length;
  const motivos = [
    sin_id && `${sin_id} de ${ia.length} llamada(s) de IA sin request_id`,
    ajenas.length && `costeo con Edge distinta de ${fnCosteo}: ${ajenas.join(', ')}`,
    costeable && rc === 0 && `caso costeable sin ninguna llamada a ${fnCosteo}`,
  ].filter(Boolean);
  return { ia: { llamadas: ia.length, request_ids, sin_id }, costeo: { fnEsperada: fnCosteo, porFn, rc, ajenas, costeable: !!costeable }, motivos };
}

// Une las auditorías de todas las hojas de una corrida (y sus 0-binario.json) en lo que consume compararHuellas.
export function unirCorrida(hojas = []) {
  const ia = { llamadas: 0, request_ids: [], sin_id: 0 };
  const costeo = { porFn: {}, ajenas: [], casos: 0, casosSinRc: 0 };
  const binarios = [];
  for (const h of hojas) {
    const a = h?.auditoria;
    if (a) {
      ia.llamadas += a.ia?.llamadas || 0; ia.request_ids.push(...(a.ia?.request_ids || [])); ia.sin_id += a.ia?.sin_id || 0;
      for (const [f, n] of Object.entries(a.costeo?.porFn || {})) costeo.porFn[f] = (costeo.porFn[f] || 0) + n;
      for (const f of a.costeo?.ajenas || []) if (!costeo.ajenas.includes(f)) costeo.ajenas.push(f);
      costeo.casos += 1;
      if (a.costeo?.costeable && !(a.costeo?.rc > 0)) costeo.casosSinRc += 1;
    } else costeo.casosSinAuditoria = (costeo.casosSinAuditoria || 0) + 1;
    if (h?.binario) binarios.push(h.binario);
  }
  return { ia, costeo, binarios };
}

// Código que viaja en el binario del navegador o en las Edge: un cambio ahí entre el SHA congelado y el servido invalida
// aunque el archivo no esté en el cierre de imports (p. ej. App.jsx). Docs y evidencia del propio holdout no.
const RE_CODIGO = /^(src|supabase|e2e|scripts|public|index\.html|vite\.config|package(-lock)?\.json|lab\/costear\/ciego_erp)/;
const RE_NO_CODIGO = /^lab\/costear\/holdout_intelisis\/MANIFIESTO\.json$|\.md$/;

export function compararHuellas(manifiesto, { archivos, db, edges, modelos, corrida, cambiosGit }) {
  const cambios = [];
  for (const f of new Set([...Object.keys(manifiesto.archivos || {}), ...Object.keys(archivos)])) if (manifiesto.archivos?.[f] !== archivos[f]) cambios.push(`archivo ${f}`);
  const esperados = manifiesto.modelosEsperados;
  // v4: un arreglo de modelos VACÍO no demuestra nada. v5: cada request_id de la corrida necesita un evento con función,
  // modo y model_id; y cada llamada de IA necesita su request_id (una llamada sin ID = NO_VERIFICADO, nunca se filtra).
  const ids = corrida?.ia?.request_ids || [];
  const sinEvento = ids.filter((r) => idValido(r) && !(modelos || []).some((o) => o?.request_id === r && o?.fn && o?.modo && o?.model_id));
  const sinId = corrida ? Math.max(corrida.ia?.sin_id || 0, ids.filter((r) => !idValido(r)).length) : 0;
  const llamadasDescuadradas = corrida && (corrida.ia?.llamadas || 0) !== ids.length;
  const binarios = corrida?.binarios || [];
  const falta = [!db && 'huellas de base (--db)', !edges && 'versiones de Edge (--edges)',
    !esperados && 'modelos esperados en el MANIFIESTO',
    !manifiesto.frontendSha && 'SHA del frontend en el MANIFIESTO',
    !(Array.isArray(modelos) && modelos.length) && 'modelos observados (--modelos, no vacío)',
    !corrida && 'auditoría de la corrida (--corrida)',
    corrida && sinId && `${sinId} llamada(s) de IA sin request_id`,
    corrida && llamadasDescuadradas && `request_id (${ids.length}) ≠ llamadas de IA (${corrida.ia?.llamadas || 0})`,
    sinEvento.length && `evento de IA (ai_eventos con función, modo y model_id) para ${sinEvento.length} request(s): ${sinEvento.slice(0, 3).join(', ')}`,
    corrida && corrida.costeo?.casosSinAuditoria && `${corrida.costeo.casosSinAuditoria} hoja(s) sin auditoría de llamadas`,
    corrida && corrida.costeo?.casosSinRc && `${corrida.costeo.casosSinRc} caso(s) costeable(s) sin llamada a costear-servidor-rc`,
    corrida && !binarios.length && 'evidencia del binario (0-binario.json)',
    corrida && binarios.length && !Array.isArray(cambiosGit) && 'diferencias git entre el SHA congelado y el servido'].filter(Boolean);
  // Los modelos se comparan aunque falte otra huella: un modelo distinto ya invalida.
  if (esperados && Array.isArray(modelos)) {
    for (const o of modelos) {
      const e = esperados[o?.fn]?.[o?.modo];
      if (!o?.model_id || o.model_id !== e) cambios.push(`modelo ${o?.fn}/${o?.modo}: ${o?.model_id ?? 'sin model_id'} (esperado ${e ?? 'ninguno'})`);
    }
  }
  // Una Edge de costeo ajena (p. ej. costear-servidor de PRODUCCIÓN) invalida la corrida.
  for (const f of corrida?.costeo?.ajenas || []) cambios.push(`costeo con Edge ajena: ${f}`);
  // El binario: lo que sirvió el navegador es lo que se congeló (mismo SHA en navegador y git; sin código cambiado entre medio).
  for (const b of binarios) {
    if (!b?.shaApp || !b?.shaGit || !String(b.shaGit).startsWith(String(b.shaApp)) && !String(b.shaApp).startsWith(String(b.shaGit))) cambios.push(`binario: el navegador sirvió ${b?.shaApp ?? 'sin SHA'} y git era ${b?.shaGit ?? 'sin SHA'}`);
  }
  for (const f of Array.isArray(cambiosGit) ? cambiosGit : []) if (RE_CODIGO.test(f) && !RE_NO_CODIGO.test(f)) cambios.push(`código cambiado después del congelamiento: ${f}`);
  // Un cambio invalida aunque además falte alguna huella (exit 1 del script, no 2).
  if (falta.length) return { estado: cambios.length ? 'CAMBIO' : 'NO_VERIFICADO', cambios, falta };
  if (canon(sinFecha(manifiesto.baseDatos)) !== canon(sinFecha(db))) cambios.push('base de datos (precios/catálogo/config/SQL)');
  for (const [slug, e] of Object.entries(manifiesto.edges || {})) {
    const hoy = edges[slug];
    if (!hoy || hoy.version !== e.version || hoy.ezbr_sha256 !== e.ezbr_sha256) cambios.push(`edge ${slug}`);
  }
  return { estado: cambios.length ? 'CAMBIO' : 'OK', cambios, falta: [] };
}


// --- cierre transitivo de imports (lógica pura: `leer(ruta)` devuelve el texto o null si no existe) ---
// Sólo imports RELATIVOS (./ ../): los paquetes externos los fija package-lock.json (que también se congela) y las
// URL/npm: de las Edge viajan con versión dentro del propio archivo, que se congela.
const RE_IMPORT = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
export function importsRelativos(codigo) {
  const out = [];
  for (const m of String(codigo || '').matchAll(RE_IMPORT)) { const e = m[1] || m[2] || m[3]; if (e && /^\.\.?\//.test(e)) out.push(e); }
  return out;
}
const unir = (base, rel) => {
  const partes = base.split('/').slice(0, -1);
  for (const t of rel.split('/')) { if (t === '..') partes.pop(); else if (t !== '.') partes.push(t); }
  return partes.join('/');
};
export function cierreDeImports(entradas, leer) {
  const vistos = new Set(); const pila = [...entradas];
  while (pila.length) {
    const f = pila.pop();
    if (vistos.has(f)) continue;
    const txt = leer(f);
    if (txt == null) continue;
    vistos.add(f);
    if (!/\.(m?js|jsx|ts)$/.test(f)) continue;
    for (const rel of importsRelativos(txt)) {
      const base = unir(f, rel);
      const cand = [base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}/index.js`].find((c) => leer(c) != null);
      if (cand) pila.push(cand); else vistos.add(`FALTA:${base}`);   // un import que no resuelve se ve en el manifiesto
    }
  }
  return [...vistos].sort();
}
