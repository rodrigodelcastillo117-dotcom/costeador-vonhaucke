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


// Aplica un porcentaje sobre CENTAVOS ENTEROS usando BigInt en la frontera.
// El porcentaje se cuantiza a 1e-6 puntos porcentuales; evita que 12.5%, IVA,
// descuentos, etc. acumulen error binario antes del redondeo final a centavo.
export function porcentajeCentavos(baseCentavos, pct) {
  if (!Number.isSafeInteger(baseCentavos)) return null;
  const p = Number(pct);
  if (!Number.isFinite(p)) return null;
  const escala = 1_000_000; // micro-puntos porcentuales
  const pMicro = Math.round(p * escala);
  const den = BigInt(100 * escala);
  const num = BigInt(baseCentavos) * BigInt(pMicro);
  const neg = num < 0n;
  const abs = neg ? -num : num;
  const q = (abs + den / 2n) / den; // half-up a centavo
  const out = Number(neg ? -q : q);
  return Number.isSafeInteger(out) ? out : null;
}
