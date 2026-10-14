// Holdout Intelisis v2 · comparación del congelamiento (lógica pura; la usa scripts/congelar_holdout.mjs).
// Fail-closed: sin huellas frescas de base de datos y de Edge, el resultado es NO_VERIFICADO, nunca OK.
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const sinFecha = (o) => { const c = JSON.parse(JSON.stringify(o || {})); delete c.medido_en; delete c.medidoEn; return c; };
export function compararHuellas(manifiesto, { archivos, db, edges }) {
  const cambios = [];
  for (const f of new Set([...Object.keys(manifiesto.archivos || {}), ...Object.keys(archivos)])) if (manifiesto.archivos?.[f] !== archivos[f]) cambios.push(`archivo ${f}`);
  if (!db || !edges) return { estado: 'NO_VERIFICADO', cambios, falta: [!db && 'huellas de base (--db)', !edges && 'versiones de Edge (--edges)'].filter(Boolean) };
  if (canon(sinFecha(manifiesto.baseDatos)) !== canon(sinFecha(db))) cambios.push('base de datos (precios/catálogo/config/SQL)');
  for (const [slug, e] of Object.entries(manifiesto.edges || {})) {
    const hoy = edges[slug];
    if (!hoy || hoy.version !== e.version || hoy.ezbr_sha256 !== e.ezbr_sha256) cambios.push(`edge ${slug}`);
  }
  return { estado: cambios.length ? 'CAMBIO' : 'OK', cambios, falta: [] };
}

