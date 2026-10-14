// Holdout Intelisis v3 · comparación del congelamiento (lógica pura; la usa scripts/congelar_holdout.mjs).
// Fail-closed: sin huellas frescas de base de datos, de Edge Y de los modelos observados, el resultado es
// NO_VERIFICADO, nunca OK. v3 (reauditoría v2, P1-02): los archivos son el CIERRE TRANSITIVO de imports de las entradas
// (antes una lista a mano dejaba fuera reglasTaller.js y acabados.js) y el modelo de IA se CONGELA por (fn, modo): un
// modelo observado distinto al esperado invalida la corrida (registrar el model_id no basta: el modelo sale de una
// variable de entorno que no cambia el SHA de la Edge).
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const sinFecha = (o) => { const c = JSON.parse(JSON.stringify(o || {})); delete c.medido_en; delete c.medidoEn; return c; };
export function compararHuellas(manifiesto, { archivos, db, edges, modelos, requests }) {
  const cambios = [];
  for (const f of new Set([...Object.keys(manifiesto.archivos || {}), ...Object.keys(archivos)])) if (manifiesto.archivos?.[f] !== archivos[f]) cambios.push(`archivo ${f}`);
  const esperados = manifiesto.modelosEsperados;
  // v4 (reauditoría v3, P1-02): un arreglo VACÍO no demuestra nada (ventana mal calculada, telemetría caída): no verifica.
  // Con --requests, cada request de IA que hizo la corrida debe tener su evento con model_id (no basta la ventana).
  const sinEvento = Array.isArray(requests) ? requests.filter((r) => !(modelos || []).some((o) => o?.request_id === r)) : [];
  const falta = [!db && 'huellas de base (--db)', !edges && 'versiones de Edge (--edges)',
    !esperados && 'modelos esperados en el MANIFIESTO',
    !(Array.isArray(modelos) && modelos.length) && 'modelos observados (--modelos, no vacío)',
    !Array.isArray(requests) && 'requests de IA de la corrida (--requests)',
    sinEvento.length && `evento de IA (ai_eventos) para ${sinEvento.length} request(s): ${sinEvento.slice(0, 3).join(', ')}`].filter(Boolean);
  // Los modelos se comparan aunque falte otra huella: un modelo distinto ya invalida.
  if (esperados && Array.isArray(modelos)) {
    for (const o of modelos) {
      const e = esperados[o?.fn]?.[o?.modo];
      if (!o?.model_id || o.model_id !== e) cambios.push(`modelo ${o?.fn}/${o?.modo}: ${o?.model_id ?? 'sin model_id'} (esperado ${e ?? 'ninguno'})`);
    }
  }
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
