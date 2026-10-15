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
const repetidosDe = (ids) => [...new Set(ids.filter((r, i) => idValido(r) && ids.indexOf(r) !== i))];

// v5.2 (reauditoría GO/NO-GO, P1): ¿el caso es costeable? Lo dice la HOJA congelada (la fixture, leída de git en el SHA
// que sirvió el navegador), nunca el resumen ni una variable de entorno (antes LAB_COSTEABLE=0 bastaba para que un caso
// costeable pasara con 0 llamadas RC). Sólo `costeable: false` CON `motivo_no_costeable` lo declara no costeable; campo
// ausente o true = costeable; cualquier otro valor = indefinido (null) ⇒ NO_VERIFICADO.
export function costeableDeHoja(hoja) {
  if (!hoja || typeof hoja !== 'object' || Array.isArray(hoja)) return null;
  if (hoja.costeable === undefined || hoja.costeable === true) return true;
  if (hoja.costeable === false && idValido(hoja.motivo_no_costeable)) return false;
  return null;
}

// `hoja` = { ruta, sha256 } de la fixture que corrió (la escribe el E2E); el verificador la vuelve a leer de git.
export function auditarLlamadasCorrida(edges = [], { fnCosteo = 'costear-servidor-rc', costeable = true, hoja = null } = {}) {
  const lista = Array.isArray(edges) ? edges : [];
  const ia = lista.filter((e) => /^analizar-mueble/.test(e?.fn || ''));
  const request_ids = ia.map((e) => (idValido(e?.body?.request_id) ? e.body.request_id : null));
  const costeo = lista.filter((e) => String(e?.fn || '').startsWith('costear-servidor'));
  const porFn = {};
  for (const e of costeo) porFn[e.fn] = (porFn[e.fn] || 0) + 1;
  const rc = porFn[fnCosteo] || 0;
  const ajenas = Object.keys(porFn).filter((f) => f !== fnCosteo).sort();
  const sin_id = request_ids.filter((x) => x == null).length;
  const repetidos = repetidosDe(request_ids);
  const motivos = [
    sin_id && `${sin_id} de ${ia.length} llamada(s) de IA sin request_id`,
    repetidos.length && `request_id repetido en las llamadas de IA: ${repetidos.join(', ')}`,
    ajenas.length && `costeo con Edge distinta de ${fnCosteo}: ${ajenas.join(', ')}`,
    costeable == null && 'la hoja no declara bien si el caso es costeable (false exige motivo_no_costeable)',
    costeable !== false && rc === 0 && `caso costeable sin ninguna llamada a ${fnCosteo}`,
  ].filter(Boolean);
  return { ia: { llamadas: ia.length, request_ids, sin_id }, costeo: { fnEsperada: fnCosteo, porFn, rc, ajenas, costeable: costeable !== false }, hoja, motivos };
}

// v5.1 (reauditoría final): el verificador NO confía en los campos derivados del resumen (ajenas, rc, fnEsperada). Un
// llamadas.json con porFn {costear-servidor: 1} y ajenas [] daba OK. Ahora las Edge ajenas y las llamadas RC salen de
// porFn y de las llamadas CRUDAS de la hoja (edges.json), y el resumen tiene que cuadrar con ellas.
const FN_COSTEO_HOLDOUT = 'costear-servidor-rc';
function llamadasCrudas(crudas) {
  const ia = crudas.filter((e) => /^analizar-mueble/.test(e?.fn || ''));
  const porFn = {};
  for (const e of crudas) if (String(e?.fn || '').startsWith('costear-servidor')) porFn[e.fn] = (porFn[e.fn] || 0) + 1;
  // request_id guardado aparte por el E2E (o dentro de body si body es un objeto). Si no se puede leer, no se compara.
  const idDe = (e) => (e && 'request_id' in e ? e.request_id : e?.body && typeof e.body === 'object' ? e.body.request_id : undefined);
  const ids = ia.map(idDe);
  return { iaLlamadas: ia.length, porFn, ids: ids.includes(undefined) ? null : ids.map((x) => (idValido(x) ? x : null)) };
}

// Une las auditorías de todas las hojas de una corrida (y sus 0-binario.json) en lo que consume compararHuellas.
export function unirCorrida(hojas = []) {
  const ia = { llamadas: 0, request_ids: [], sin_id: 0 };
  const costeo = { porFn: {}, ajenas: [], casos: 0, casosSinRc: 0, casosSinCrudas: 0, casosInconsistentes: 0,
    casosSinHoja: 0, hojasDistintas: [], casosCosteableInvalido: 0, casosCosteableDistinto: 0 };
  const binarios = [];
  for (const h of hojas) {
    const a = h?.auditoria;
    if (a) {
      ia.llamadas += a.ia?.llamadas || 0; ia.request_ids.push(...(a.ia?.request_ids || [])); ia.sin_id += a.ia?.sin_id || 0;
      const porFnHoja = a.costeo?.porFn || {};
      for (const [f, n] of Object.entries(porFnHoja)) costeo.porFn[f] = (costeo.porFn[f] || 0) + n;
      const crudas = Array.isArray(h.crudas) ? llamadasCrudas(h.crudas) : null;
      if (!crudas) costeo.casosSinCrudas += 1;
      else if (crudas.iaLlamadas !== (a.ia?.llamadas || 0) || canon(crudas.porFn) !== canon(porFnHoja)
        || (crudas.ids && canon(crudas.ids) !== canon(a.ia?.request_ids || []))) costeo.casosInconsistentes += 1;
      else if ((a.costeo?.rc || 0) !== (porFnHoja[FN_COSTEO_HOLDOUT] || 0)) costeo.casosInconsistentes += 1;
      // Ajena = cualquier costear-servidor* que no sea la RC, venga de donde venga (resumen, porFn o crudas).
      for (const f of [...(a.costeo?.ajenas || []), ...Object.keys(porFnHoja), ...Object.keys(crudas?.porFn || {})]) {
        if (f !== FN_COSTEO_HOLDOUT && !costeo.ajenas.includes(f)) costeo.ajenas.push(f);
      }
      costeo.casos += 1;
      const rc = Math.min(porFnHoja[FN_COSTEO_HOLDOUT] || 0, crudas ? crudas.porFn[FN_COSTEO_HOLDOUT] || 0 : Infinity);
      // v5.2: costeable sale de la FIXTURE (h.fixture = { ruta, sha256, datos } leída de git en el SHA servido), no de
      // a.costeo.costeable. Sin fixture, o si la de git no es la que declaró el E2E, no hay forma de saberlo.
      const decl = a.hoja; const fx = h.fixture;
      if (!idValido(decl?.ruta) || !idValido(decl?.sha256) || !fx || !idValido(fx.sha256)) costeo.casosSinHoja += 1;
      else if (fx.ruta !== decl.ruta || fx.sha256 !== decl.sha256) costeo.hojasDistintas.push(decl.ruta);
      const costeable = fx ? costeableDeHoja(fx.datos) : null;
      if (fx && costeable == null) costeo.casosCosteableInvalido += 1;
      if (costeable != null && (a.costeo?.costeable !== false) !== costeable) costeo.casosCosteableDistinto += 1;
      // Indefinido cuenta como costeable: el peor caso es pedir una llamada RC de más, nunca dejar pasar un caso sin costeo.
      if (costeable !== false && !(rc > 0)) costeo.casosSinRc += 1;
    } else costeo.casosSinAuditoria = (costeo.casosSinAuditoria || 0) + 1;
    if (h?.binario) binarios.push(h.binario);
  }
  return { ia, costeo, binarios };
}

// Código que viaja en el binario del navegador o en las Edge: un cambio ahí entre el SHA congelado y el servido invalida
// aunque el archivo no esté en el cierre de imports (p. ej. App.jsx). Docs y evidencia del propio holdout no.
// v5.3 (P1): playwright.config.js también: decide cuántas veces se reintenta la prueba que produce la evidencia.
const RE_CODIGO = /^(src|supabase|e2e|scripts|public|index\.html|vite\.config|playwright\.config|package(-lock)?\.json|lab\/costear\/ciego_erp)/;
const RE_NO_CODIGO = /^lab\/costear\/holdout_intelisis\/MANIFIESTO\.json$|\.md$/;

// v5.4 (revisión propia del cierre v5.3): el config que Playwright CARGÓ y el servidor que contestó en el baseURL.
// Playwright prueba playwright.config.ts antes que .js: un .ts sin versionar no sale en `git status --untracked-files=no`
// ni en el diff y deja intacta la huella del .js congelado. Y con reuseExistingServer el E2E usa cualquier Vite que esté en
// el puerto, sea del checkout que sea.
export const CONFIG_PLAYWRIGHT_CONGELADO = 'playwright.config.js';
// Argumentos permitidos del servidor (opciones de node, NODE_OPTIONS y Vite): sólo memoria de node, puerto, strictPort y
// force. Una raíz posicional (`vite /otro/checkout`), `--config`, `--mode`, `--require`/`--import`/`--loader` o cualquier otro
// argumento cambian qué código se sirve ⇒ no se aceptan (lista permitida, no lista negra).
export function argumentosViteValidos(args) {
  if (!Array.isArray(args)) return false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && /^\d+$/.test(String(args[i + 1] ?? ''))) { i++; continue; }
    if (/^(--port=\d+|--strictPort|--force|--max-old-space-size=\d+)$/.test(String(args[i]))) continue;
    return false;
  }
  return true;
}

// v5.5 (P1-HO-02, auditoría de 9013d20): la identidad git se MIDE, no se declara. Antes `shaGit` salía de LAB_GIT_SHA y el
// `git diff` del verificador se hacía contra ese valor: un checkout B con otro HEAD, LAB_GIT_SHA=SHA congelado y
// GIT_SHA=SHA congelado (que vite.config.js prefiere para el SHA visible) daba OK aunque B sirviera otro código.
// Ahora el E2E mide `headGit` (git rev-parse HEAD, 40 hex) en el checkout que sirvió y el verificador exige que el SHA
// visible y el declarado coincidan con él; el diff y la hoja congelada se leen desde `headGit`.
// Los comandos git corren sin variables GIT_* del entorno (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE…), que harían medir
// otro repo, y sin objetos `git replace`, que harían ver otro contenido bajo el mismo SHA.
export function envGitLimpio(env = {}) {
  return { ...Object.fromEntries(Object.entries(env).filter(([k]) => !/^GIT_/i.test(k))), GIT_NO_REPLACE_OBJECTS: '1' };
}
export const esShaCompleto = (s) => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);
// Un SHA corto sólo identifica al HEAD si tiene 7–40 hex y es su prefijo (con 1 carácter, `GIT_SHA=8`, "coincidiría").
const esPrefijoDe = (corto, head) => typeof corto === 'string' && /^[0-9a-f]{7,40}$/.test(corto) && head.startsWith(corto);

export function compararHuellas(manifiesto, { archivos, db, edges, modelos, corrida, cambiosGit }) {
  const cambios = [];
  for (const f of new Set([...Object.keys(manifiesto.archivos || {}), ...Object.keys(archivos)])) if (manifiesto.archivos?.[f] !== archivos[f]) cambios.push(`archivo ${f}`);
  const esperados = manifiesto.modelosEsperados;
  // v4: un arreglo de modelos VACÍO no demuestra nada. v5: cada request_id de la corrida necesita un evento con función,
  // modo y model_id; y cada llamada de IA necesita su request_id (una llamada sin ID = NO_VERIFICADO, nunca se filtra).
  // v5.2 (P1): request_id ↔ evento es 1:1. Cada id es único en la corrida; cada id tiene EXACTAMENTE un evento; no hay
  // eventos de otros requests; y #eventos = #llamadas. Antes un id repetido con un solo evento daba OK.
  const ids = corrida?.ia?.request_ids || [];
  const unicos = [...new Set(ids.filter(idValido))];
  const repetidos = repetidosDe(ids);
  const eventos = Array.isArray(modelos) ? modelos : [];
  const eventosDe = (r) => eventos.filter((o) => o?.request_id === r);
  const sinEvento = unicos.filter((r) => !eventosDe(r).some((o) => o?.fn && o?.modo && o?.model_id));
  const conVarios = unicos.filter((r) => eventosDe(r).length > 1);
  const ajenosIa = eventos.filter((o) => !unicos.includes(o?.request_id)).map((o) => o?.request_id ?? 'sin request_id');
  const eventosDescuadrados = corrida && eventos.length > 0 && eventos.length !== ids.length;
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
    corrida && repetidos.length && `request_id repetido (${repetidos.length}): ${repetidos.slice(0, 3).join(', ')}`,
    corrida && sinEvento.length && `evento de IA (ai_eventos con función, modo y model_id) para ${sinEvento.length} request(s): ${sinEvento.slice(0, 3).join(', ')}`,
    corrida && conVarios.length && `más de un evento de IA para ${conVarios.length} request(s): ${conVarios.slice(0, 3).join(', ')}`,
    corrida && ajenosIa.length && `${ajenosIa.length} evento(s) de IA que no son de esta corrida: ${ajenosIa.slice(0, 3).join(', ')}`,
    eventosDescuadrados && `eventos de IA (${eventos.length}) ≠ llamadas de IA (${ids.length})`,
    corrida && corrida.costeo?.casosSinAuditoria && `${corrida.costeo.casosSinAuditoria} hoja(s) sin auditoría de llamadas`,
    corrida && corrida.costeo?.casosSinCrudas && `${corrida.costeo.casosSinCrudas} hoja(s) sin llamadas crudas (edges.json)`,
    corrida && corrida.costeo?.casosInconsistentes && `${corrida.costeo.casosInconsistentes} hoja(s) cuyo llamadas.json no cuadra con sus llamadas crudas (edges.json)`,
    corrida && corrida.costeo?.casosSinRc && `${corrida.costeo.casosSinRc} caso(s) costeable(s) sin llamada a costear-servidor-rc`,
    corrida && corrida.costeo?.casosSinHoja && `${corrida.costeo.casosSinHoja} hoja(s) sin fixture congelada (ruta + sha256 en git al SHA servido)`,
    corrida && corrida.costeo?.casosCosteableInvalido && `${corrida.costeo.casosCosteableInvalido} hoja(s) con "costeable" inválido (false exige motivo_no_costeable)`,
    corrida && corrida.costeo?.casosCosteableDistinto && `${corrida.costeo.casosCosteableDistinto} hoja(s) cuyo llamadas.json declara "costeable" distinto de su hoja congelada`,
    corrida && !binarios.length && 'evidencia del binario (0-binario.json)',
    // v5.3 (P1): la evidencia sale del PRIMER intento. Un 0-binario sin `reintento` (E2E anterior) no lo demuestra.
    corrida && binarios.some((b) => b && !Number.isInteger(b.reintento)) && 'intento de la prueba en 0-binario.json (reintento)',
    corrida && binarios.some((b) => b && typeof b.arbolLimpio !== 'boolean') && 'estado del árbol de git en 0-binario.json (arbolLimpio)',
    corrida && binarios.some((b) => b && !(b.entornoVite && typeof b.entornoVite === 'object')) && 'entorno de Vite servido en 0-binario.json (entornoVite)',
    corrida && !(manifiesto.entornoVite && typeof manifiesto.entornoVite === 'object') && 'entorno de Vite esperado en el MANIFIESTO',
    // v5.5: sin el HEAD medido (40 hex) la evidencia no demuestra qué commit sirvió; un SHA corto o declarado no basta.
    corrida && binarios.some((b) => b && !esShaCompleto(b.headGit)) && 'HEAD de git medido en 0-binario.json (headGit)',
    // v5.4: sin el config cargado o sin el servidor que contestó, la evidencia no demuestra con qué arnés ni de qué checkout salió.
    corrida && binarios.some((b) => b && typeof b.configPlaywright !== 'string') && 'config de Playwright cargado en 0-binario.json (configPlaywright)',
    corrida && binarios.some((b) => b && !(b.servidor && typeof b.servidor.mismoCheckout === 'boolean' && Array.isArray(b.servidor.argumentos))) && 'servidor de Vite que contestó en 0-binario.json (servidor)',
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
  // La hoja que está en git en el SHA servido no es la que corrió el E2E (otro sha256): invalida.
  for (const f of corrida?.costeo?.hojasDistintas || []) cambios.push(`hoja distinta de la que corrió el E2E: ${f}`);
  // El binario: lo que sirvió el navegador es lo que se congeló (mismo SHA en navegador y git; sin código cambiado entre medio).
  for (const b of binarios) {
    if (!b?.shaApp || !b?.shaGit || !String(b.shaGit).startsWith(String(b.shaApp)) && !String(b.shaApp).startsWith(String(b.shaGit))) cambios.push(`binario: el navegador sirvió ${b?.shaApp ?? 'sin SHA'} y git era ${b?.shaGit ?? 'sin SHA'}`);
    if (esShaCompleto(b?.headGit)) {
      if (b.shaApp && !esPrefijoDe(b.shaApp, b.headGit)) cambios.push(`binario: el navegador sirvió ${b.shaApp} y el HEAD medido del checkout es ${b.headGit.slice(0, 7)}`);
      if (b.shaGit && !esPrefijoDe(b.shaGit, b.headGit)) cambios.push(`binario: el SHA declarado (LAB_GIT_SHA) ${b.shaGit} no es el HEAD medido del checkout ${b.headGit.slice(0, 7)}`);
    }
    if (Number.isInteger(b?.reintento) && b.reintento !== 0) cambios.push(`evidencia de un reintento de Playwright (reintento ${b.reintento}): sólo vale el primer intento`);
    if (b?.arbolLimpio === false) cambios.push('binario: la corrida se sirvió con cambios sin commit en el árbol de git');
    if (b?.entornoVite && typeof b.entornoVite === 'object' && manifiesto.entornoVite && canon(b.entornoVite) !== canon(manifiesto.entornoVite)) {
      const claves = [...new Set([...Object.keys(b.entornoVite), ...Object.keys(manifiesto.entornoVite)])].filter((k) => canon(b.entornoVite[k]) !== canon(manifiesto.entornoVite[k])).sort();
      cambios.push(`entorno de Vite distinto al congelado: ${claves.join(', ')}`);
    }
    if (typeof b?.configPlaywright === 'string' && b.configPlaywright !== CONFIG_PLAYWRIGHT_CONGELADO) cambios.push(`Playwright cargó ${b.configPlaywright}, no el config congelado (${CONFIG_PLAYWRIGHT_CONGELADO})`);
    if (b?.servidor && typeof b.servidor === 'object') {
      if (b.servidor.mismoCheckout === false) cambios.push('el servidor de Vite que contestó no es de este checkout');
      if (Array.isArray(b.servidor.argumentos) && !argumentosViteValidos(b.servidor.argumentos)) cambios.push(`servidor de Vite lanzado con argumentos no permitidos: ${b.servidor.argumentos.join(' ')}`);
    }
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
