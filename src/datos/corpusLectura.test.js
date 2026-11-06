// LABORATORIO PERMANENTE DE LECTURA→COSTEO (corpus real, 2026-11-06).
// 7 planos reales distintos (recepción corporativa, colección PET de 4 muebles, 4 vitrinas Telcel,
// exhibidor Alpura) analizados EN VIVO por analizar-mueble-rc tras el fix de "nombrar la familia".
// Los despieces quedaron CONGELADOS (fixtures) + un mini-catálogo SIN precios (para no driftear con
// las compras semanales). Este test NO llama al edge: es determinista y CI-safe.
//
// COMPUERTA: si una futura regresión (en el taxonómico de familias, en mapIaComps o en la política de
// material) hace que una pieza con insumoId VÁLIDO deje de auto-costear por NO reconocer su familia
// —el bug exacto del plano P-01: "estructura metálica" en vez de "PTR de acero"—, este test lo CAZA
// antes de prod. No afirma montos (los precios cambian); afirma ESTRUCTURA: 0 huecos-por-vaguedad.
import { describe, it, expect } from 'vitest';
import { mapIaComps } from './mapIaComps.js';
import { familiaDeMaterial } from './materialMatch.js';
import mini from './fixtures/corpus/_mini_catalogo.json';
import manifest from './fixtures/corpus/_manifest.json';

const fixtures = import.meta.glob('./fixtures/corpus/*.json', { eager: true });
const cargar = (archivo) => fixtures[`./fixtures/corpus/${archivo}`]?.default;

// Un "hueco por vaguedad" = pieza NO auto-costeable cuyo insumoId SÍ existe en el catálogo, pero su
// material_solicitado no nombra una familia reconocible (→ CANDIDATE_REQUIRES_CONFIRMATION). Es el bug.
// NO cuenta: NOT_AVAILABLE (familia nombrada sin insumo en catálogo), AMBIGUOUS (varios candidatos),
// SAME_FAMILY_CRITICAL_CONFLICT (calibre/perfil distinto) — ésos son comportamiento correcto del gate.
function huecosPorVaguedad(propuesta) {
  const comps = mapIaComps(propuesta, mini);
  const piezas = propuesta.piezas || [];
  const out = [];
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i], z = piezas[i];
    const clase = c.material_match || c._match?.clase || '';
    const auto = c._match?.autocosteable;
    if (auto) continue;
    if (clase === 'CANDIDATE_REQUIRES_CONFIRMATION') {
      const fam = familiaDeMaterial(z?.material_solicitado || z?.nombre || '');
      const existe = !!(z?.insumoId && mini[z.insumoId]);
      if (!fam && existe) out.push(`${c.nombre} :: "${z?.material_solicitado}" (id=${z?.insumoId})`);
    }
  }
  return out;
}

describe('LABORATORIO corpus · lectura→costeo (7 planos reales)', () => {
  it('el corpus está completo (7 fixtures)', () => {
    expect(manifest.length).toBe(7);
    for (const m of manifest) expect(cargar(m.archivo), m.archivo).toBeTruthy();
  });

  for (const m of manifest) {
    describe(m.desc, () => {
      const prop = cargar(m.archivo);

      it('CERO huecos por vaguedad (insumoId válido sin familia reconocible)', () => {
        expect(huecosPorVaguedad(prop)).toEqual([]);
      });

      it('CADA pieza trae procedencia válida', () => {
        const ok = new Set(['MEASURED', 'DERIVED', 'INFERRED', 'ASSUMED']);
        const sin = (prop.piezas || []).filter((p) => !ok.has(p.procedencia)).map((p) => p.nombre);
        expect(sin).toEqual([]);
      });

      it('NO costea un EQUIPO EXTERNO (refri/pantalla/electrodoméstico) como insumo', () => {
        // El cuerpo de MELAMINA de un display refrigerado SÍ es pieza; un APARATO de refrigeración no.
        // Invariante: si el material nombra un equipo externo, la pieza NO lleva insumoId (queda pendiente).
        const costeadoComoEquipo = (prop.piezas || []).filter(
          (p) => familiaDeMaterial(p.material_solicitado || p.nombre || '') === 'equipo_externo' && !!p.insumoId,
        );
        expect(costeadoComoEquipo.map((p) => `${p.nombre} → ${p.insumoId}`)).toEqual([]);
      });

      it('coherencia confianza↔procedencia: ASSUMED ⇒ no "alta"', () => {
        const malas = (prop.piezas || []).filter((p) => p.procedencia === 'ASSUMED' && p.confianza === 'alta').map((p) => p.nombre);
        expect(malas).toEqual([]);
      });
    });
  }

  it('TASA de auto-costeo del corpus ≥ 85% (no baja silenciosamente)', () => {
    let total = 0, auto = 0;
    for (const m of manifest) {
      const prop = cargar(m.archivo);
      const comps = mapIaComps(prop, mini);
      total += comps.length;
      auto += comps.filter((c) => c._match?.autocosteable).length;
    }
    const tasa = auto / total;
    expect(total).toBeGreaterThanOrEqual(150);
    expect(tasa).toBeGreaterThanOrEqual(0.85);
  });
});
