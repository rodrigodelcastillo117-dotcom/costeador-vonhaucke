// ============================================================================
//  MÉTRICAS DEL HOLDOUT INTELISIS (Operación 9.5 · punto 7). Se fijan ANTES de ver los muebles nuevos.
//  Error relativo por mueble: e = app / erp − 1 (positivo = la app cuesta de más).
//   · MAE    : media de |app − erp| en pesos
//   · MAPE   : media de |e| en %
//   · sesgo  : media de e en % (con signo: dice si la app tiende a cobrar de más o de menos)
//   · dentro5/10/20 : % de muebles con |e| ≤ 5 / 10 / 20 %
//  Por componente (mp = material, mo = mano de obra, gi = gastos indirectos de fabricación, total) y por familia.
//  Un mueble sin dato ERP o app para ese componente NO cuenta en ese componente (se reporta `n` y `sinDato`); nunca se
//  rellena con 0. Un mueble que la app no pudo costear cuenta como `noCosteados`, no se excluye en silencio.
// ============================================================================
export const COMPONENTES = Object.freeze(['mp', 'mo', 'gi', 'total']);
const num = (x) => (x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

export function metricasDe(pares = []) {
  const ok = pares.filter((p) => num(p.erp) != null && num(p.erp) > 0 && num(p.app) != null);
  const n = ok.length;
  if (!n) return { n: 0, sinDato: pares.length, mae: null, mape: null, sesgo: null, dentro5: null, dentro10: null, dentro20: null };
  const e = ok.map((p) => num(p.app) / num(p.erp) - 1);
  const pct = (lim) => r2((e.filter((x) => Math.abs(x) <= lim + 1e-12).length / n) * 100);
  return {
    n, sinDato: pares.length - n,
    mae: r2(ok.reduce((s, p) => s + Math.abs(num(p.app) - num(p.erp)), 0) / n),
    mape: r2((e.reduce((s, x) => s + Math.abs(x), 0) / n) * 100),
    sesgo: r2((e.reduce((s, x) => s + x, 0) / n) * 100),
    dentro5: pct(0.05), dentro10: pct(0.10), dentro20: pct(0.20),
  };
}

/** filas: [{ clave, familia, costeado:boolean, erp:{mp,mo,gi,total}, app:{mp,mo,gi,total} }] */
export function reporteHoldout(filas = []) {
  const costeadas = filas.filter((f) => f.costeado !== false);
  const porComp = (fs) => Object.fromEntries(COMPONENTES.map((c) => [c, metricasDe(fs.map((f) => ({ erp: f.erp?.[c], app: f.app?.[c] })))]));
  const familias = [...new Set(costeadas.map((f) => f.familia || 'sin-familia'))].sort();
  return {
    muebles: filas.length,
    noCosteados: filas.length - costeadas.length,
    global: porComp(costeadas),
    porFamilia: Object.fromEntries(familias.map((k) => [k, porComp(costeadas.filter((f) => (f.familia || 'sin-familia') === k))])),
  };
}
