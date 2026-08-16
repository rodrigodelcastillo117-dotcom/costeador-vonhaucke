// ============================================================================
//  DATOS SEMILLA - Tiempos medidos UE (master 8.3)
//  Horas-hombre reales de planta por area del costeador.
// ============================================================================

export const UE = {
  escritorio_app_lt_1u: { pm: 4.77, pintura: 0.04, acabados: 0.61, carpinteria: 0.94, tapiceria: 0 },
  modulo_app_lt_3u:     { pm: 10.45, pintura: 0.08, acabados: 1.32, carpinteria: 2.81, tapiceria: 0 },
  eclipse_cantilever:   { pm: 0.68, pintura: 0.04, acabados: 0.20, carpinteria: 67.51, tapiceria: 3.74 },
  // Medidas nuevas de Honorino (levantamiento Sec.4, 2026-08-13). Horas por area.
  escritorio_app_lt_L_150x90: { pm: 6.2822, carpinteria: 1.3906, pintura: 0.0473, acabados: 1.1304, tapiceria: 0 }, // total 8.85 h
  bench_app_lt_4u:            { pm: 9.5884, carpinteria: 2.8136, pintura: 0.0968, acabados: 1.4368, tapiceria: 0 }, // total 13.94 h (modulo completo; OJO: <lineal desde 3u)
};

// Suma de horas de una UE
export function horasTotales(ue) {
  if (!ue) return 0;
  return (ue.pm || 0) + (ue.pintura || 0) + (ue.acabados || 0) + (ue.carpinteria || 0) + (ue.tapiceria || 0);
}
