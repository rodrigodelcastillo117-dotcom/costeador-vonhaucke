import { describe, it, expect } from 'vitest';
import { INSUMOS_SEMILLA } from './datos/insumos.js';
import { aplicarPoliticaMaterial, MATCH, estadoMaterialUI } from './datos/materialMatch.js';
import { calcular, PARAMETROS_DEFAULT } from './motor/calculo.js';

// ============================================================================
//  E2E — CASO REAL DEL MOSTRADOR (counter Grab&Go que Rodrigo pegó).
//  La IA lee el plano y propone material; antes el UI dejaba casi todo en
//  "¿de qué es? / $0" aunque la IA YA había encontrado el candidato.
//  Esta prueba ejerce el MISMO camino que el UI (mapIaComps → aplicarPoliticaMaterial
//  con el catálogo real) + el motor, y afirma la política de 4 clases:
//   · melamina 18→19 color = autollenado + costo PROVISIONAL (por confirmar)
//   · lámina cal.18 pedida vs cal.14 catálogo = CRÍTICO (no autocostea)
//   · refrigerador fuera de catálogo = pendiente, NUNCA $0 real
//  Fail-closed intacto: cruce de familia jamás autocostea.
// ============================================================================

const CAT = INSUMOS_SEMILLA;
const INSUMOS = Object.fromEntries(CAT.map((x) => [x.id, x]));
const resolver = (id) => INSUMOS[id];
// mapIaComps real: material_solicitado = material_solicitado || nombre de la pieza.
const mapear = (z) => aplicarPoliticaMaterial({ ...z, material_solicitado: z.material_solicitado || z.nombre }, resolver, CAT);

describe('E2E mostrador — la IA llena el material como indica el plano (sin romper fail-closed)', () => {
  it('melamina 18 mm color madera (no existe) → candidato 19 color, COSTEA provisional + POR CONFIRMAR', () => {
    const c = mapear({
      nombre: 'Laterales base (modulo bajo)',
      insumoId: 'melamina-19-color',               // la IA ya resolvió "19 mm color madera"
      material_solicitado: 'melamina 18 mm color madera',
      forma: 'area', largoMM: 950, anchoMM: 650, cantidad: 4, hojas: 0.8,
    });
    expect(c.insumoId).toBe('melamina-19-color');                 // deja de estar vacío
    expect(c._match.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(c._match.cambio).toBe('Solicitado 18 mm → candidato 19 mm');
    const e = estadoMaterialUI(c, INSUMOS);
    expect(e.costeable).toBe(true);
    expect(e.selVal).toBe('melamina-19-color');                   // el selector lo muestra
    expect(e.badge).toMatch(/POR CONFIRMAR/);
  });

  it('cubierta espesor 28 → melamina 19: SALTO GRANDE no aprobado → CRÍTICO, NO autocostea (28 mm puede ser doble tablero/engrosado)', () => {
    const c = mapear({
      nombre: 'Cubierta de mostrador',
      insumoId: 'melamina-19-color',
      material_solicitado: 'cubierta melamina 28 mm color',
      forma: 'area', largoMM: 2400, anchoMM: 700, cantidad: 1, hojas: 0.6,
    });
    expect(c._match.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(c.insumoId).toBe('');                               // no entra al costo sin confirmar
    expect(c._match.candidate_insumo_id).toBe('melamina-19-color'); // se muestra para decidir
    expect(estadoMaterialUI(c, INSUMOS).costeable).toBe(false);
  });

  it('postes PTR cal.14 (igual calibre, falta sección) → ESTIMACIÓN, no ingeniería certificada', () => {
    const c = mapear({ nombre: 'Postes verticales', insumoId: 'ptr-14', material_solicitado: 'tubo PTR cal. 14', cantidad: 10 });
    expect(c.insumoId).toBe('ptr-14'); // entra como referencia económica
    expect(c._match.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(c._match.confirmado_por_usuario).toBe(false);
    expect(c._match.cambio).toMatch(/sección/i); // no es EXACT por faltar sección
  });

  it('CRÍTICO: cabezal pide lámina cal.18 pero la IA mapeó cal.14 → NO autocostea, preselecciona candidato', () => {
    const c = mapear({ nombre: 'Cabezal letrero', insumoId: 'lamina-14', material_solicitado: 'lamina de acero cal. 18', cantidad: 3 });
    expect(c.insumoId).toBe('');                                  // no entra al costo sin confirmar
    expect(c._match.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(c._match.candidate_insumo_id).toBe('lamina-14');
    const e = estadoMaterialUI(c, INSUMOS);
    expect(e.costeable).toBe(false);
    expect(e.selVal).toBe('lamina-14');                           // se muestra para decidir
    expect(e.mostrarConfirmar).toBe(true);
    expect(e.pendienteMsg).toMatch(/Costo pendiente/);
  });

  it('refrigerador vitrina (fuera de catálogo) → pendiente, NUNCA $0 real ni inventado', () => {
    const c = mapear({ nombre: 'Refrigerador vitrina doble puerta', insumoId: '', material_solicitado: 'refrigerador vitrina doble puerta nicho' });
    expect(c.insumoId).toBe('');
    expect(c._match.clase).toBe(MATCH.NOT_AVAILABLE);
    const e = estadoMaterialUI(c, INSUMOS);
    expect(e.costeable).toBe(false);
    expect(e.pendienteMsg).toMatch(/Costo pendiente/);
    expect(e.pendienteMsg).not.toMatch(/\$0/);
  });

  it('cross-familia: si la IA metiera MDF para "superficie sólida", NUNCA se queda MDF (fail-closed)', () => {
    const c = mapear({ nombre: 'Panel', insumoId: 'mdf', material_solicitado: 'superficie sólida azul', forma: 'area', largoMM: 800, anchoMM: 400, cantidad: 1 });
    // El MDF jamás se cuela como "superficie sólida". El catálogo real SÍ tiene solid surface,
    // así que la red de seguridad recupera el material de la MISMA familia (no MDF).
    expect(c.insumoId).not.toBe('mdf');
    expect(c._match.familiaSolicitada).toBe('superficie_solida');
    if (c.insumoId) {
      // si recuperó un candidato, es de la familia correcta (superficie sólida), nunca MDF
      expect(INSUMOS[c.insumoId].nombre.toLowerCase()).toMatch(/s[oó]lid|surface|corian|krion/);
    }
  });

  it('BOM del mostrador: los paneles de melamina ya CONTRIBUYEN al costo (antes salían $0)', () => {
    const piezas = [
      { nombre: 'Laterales base', insumoId: 'melamina-19-color', material_solicitado: 'melamina 18 mm color madera', forma: 'area', largoMM: 950, anchoMM: 650, cantidad: 4, hojas: 0.8 },
      { nombre: 'Entrepanos y fondos', insumoId: 'melamina-19-color', material_solicitado: 'melamina 18 mm color', forma: 'area', largoMM: 790, anchoMM: 650, cantidad: 6, hojas: 1.0 },
      { nombre: 'Cubierta de mostrador', insumoId: 'melamina-19-color', material_solicitado: 'cubierta melamina 28 mm color', forma: 'area', largoMM: 2400, anchoMM: 700, cantidad: 1, hojas: 0.6 },
      { nombre: 'Refrigerador vitrina', insumoId: '', material_solicitado: 'refrigerador vitrina doble puerta' },
      { nombre: 'Cabezal lámina cal.18', insumoId: 'lamina-14', material_solicitado: 'lamina de acero cal. 18', cantidad: 3 },
    ];
    const componentes = piezas.map(mapear);
    const costeables = componentes.filter((c) => estadoMaterialUI(c, INSUMOS).costeable);
    // Los paneles 18→19 (compatible aprobado) entran; la cubierta 28→19 (salto grande =
    // crítico), el refrigerador y la lámina-crítica NO.
    expect(costeables.map((c) => c.nombre)).toEqual([
      'Laterales base', 'Entrepanos y fondos',
    ]);
    const r = calcular({ nombre: 'Mostrador', piezas: 1, componentes, modoManoObra: 'porcentaje', margen: 40 }, 1, INSUMOS, PARAMETROS_DEFAULT);
    expect(r.costoUnitario).toBeGreaterThan(0);   // ya no sale $0 en todo
    expect(r.materialTotal).toBeGreaterThan(0);
  });
});
