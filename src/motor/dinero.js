// Dinero canónico · política única de redondeo a centavos.
// Nunca representa dinero autoritativo mediante redondeo al peso.
// Los cálculos intermedios pueden usar Number, pero toda frontera económica
// (renglón, cargo, impuesto, comparación, emisión) se cuantiza a $0.01.

export function aCentavosEnteros(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  // EPSILON reduce artefactos binarios típicos como 1.005.
  return Math.round((n + Math.sign(n || 1) * Number.EPSILON) * 100);
}

export function deCentavosEnteros(centavos) {
  return Number.isInteger(centavos) ? centavos / 100 : NaN;
}

export function dinero(valor) {
  const c = aCentavosEnteros(valor);
  return c == null ? NaN : deCentavosEnteros(c);
}

export function sumarDinero(valores = []) {
  let total = 0;
  for (const v of valores) {
    const c = aCentavosEnteros(v);
    if (c == null) return NaN;
    total += c;
  }
  return deCentavosEnteros(total);
}

export function aplicarPct(base, pct) {
  const b = Number(base), p = Number(pct);
  if (!Number.isFinite(b) || !Number.isFinite(p)) return NaN;
  return dinero(b * p / 100);
}
