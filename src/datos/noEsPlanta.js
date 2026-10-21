// ============================================================================
//  ¿Lo que se subió es una PLANTA de oficina? (E2E 2026-10-20)
//  Se subió por error el dibujo de un exhibidor (mueble de 3.6 m) como plano: la IA misma escribió
//  "no es una planta arquitectónica de oficina; no existen cuartos, muros ni puertas", pero la app
//  marcaba "✓ Lectura confiable" con 4 "cuartos" de 0.6 m² y dejaba usarlo para acomodar.
//  Puro: decide con la geometría leída y con lo que la propia lectura dice de sí misma.
// ============================================================================
const NOTA_NO_PLANTA = /no es (una |un )?(planta|plano) (arquitect|de oficina)|plano de mobiliario|no (existen|hay) cuartos|no es un plano de (planta|oficina)/i;

/** @returns {null | { motivo: string }} null si parece planta; si no, por qué no. */
export function noEsPlanta(lectura) {
  if (!lectura) return null;
  const areas = (Array.isArray(lectura.areas) ? lectura.areas : []).filter(Boolean);
  const m2 = (a) => (Number(a.ancho) || 0) * (Number(a.largo) || 0);
  const total = areas.reduce((t, a) => t + m2(a), 0);
  const nota = `${lectura.nota || ''} ${(lectura.resumen?.problemas || []).join(' ')}`;
  if (NOTA_NO_PLANTA.test(nota)) return { motivo: 'la lectura dice que el documento no es una planta de oficina' };
  if (areas.length && total < 8) return { motivo: `todo junto mide ~${total.toFixed(1)} m²; una oficina no cabe ahí` };
  if (areas.length >= 2 && areas.every((a) => m2(a) < 2.5)) return { motivo: 'ningún "cuarto" llega a 2.5 m²' };
  return null;
}
