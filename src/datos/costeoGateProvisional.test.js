import { describe, it, expect } from 'vitest';
import { INSUMOS_SEMILLA } from './insumos.js';
import { aplicarPoliticaMaterial, reconciliarMaterialServidor, puedeConfirmarMaterial, requiereConfirmacion, MATCH, MATCH_AUTOCOSTEABLE } from './materialMatch.js';
import { validarIntentCosteo } from './validarIntentCosteo.js';
import { calcular, costeoEmitible, bomHash, precioDe, PARAMETROS_DEFAULT } from '../motor/calculo.js';

// ============================================================================
//  GATE ECONÓMICO · material PROVISIONAL "por confirmar" (audit 2026-10-08).
//  Un costo provisional (18→19) PUEDE mostrarse como subtotal, pero NO es emitible
//  hasta confirmación humana. Prueba las 4 piezas del juez:
//   · calcular → resultado.materialesPorConfirmar
//   · costeoEmitible → bloqueo materiales_por_confirmar, emitible=false, costoTotal=null
//   · servidor (validarIntentCosteo→calcular→costeoEmitible) preserva material_match
//   · bomHash distingue provisional de USER_CONFIRMED
// ============================================================================

const CAT = INSUMOS_SEMILLA;
const INSUMOS = Object.fromEntries(CAT.map((x) => [x.id, x]));
const resolver = (id) => INSUMOS[id];
const mapear = (z) => aplicarPoliticaMaterial({ ...z, material_solicitado: z.material_solicitado || z.nombre }, resolver, CAT);
const costear = (componentes) => calcular({ nombre: 'P', piezas: 1, componentes, modoManoObra: 'porcentaje', margen: 40 }, 1, INSUMOS, PARAMETROS_DEFAULT);

// Espejo FIEL de la cadena del servidor (costear-servidor/index.ts): DTO estricto →
// RECONCILIACIÓN de material contra el catálogo autoritativo (ignora el material_match del
// browser) → motor → juez de emisión. Esto es lo que cierra el bypass P0.5.
function servidor(componentesCrudos, { rol = 'diseno' } = {}) {
  const body = { cantidad: 1, pieza: { componentes: componentesCrudos } };
  const v = validarIntentCosteo(body);
  if (!v.ok) return { status: 400, code: v.code, issues: v.issues };
  // P0.9: capability de confirmación la decide el SERVIDOR por rol (igual que index.ts).
  const puedeConfirmar = puedeConfirmarMaterial(rol);
  if (!puedeConfirmar && v.intent.pieza.componentes.some((c) => c.material_confirmado === true)) {
    return { status: 403, code: 'MATERIAL_CONFIRMATION_FORBIDDEN' };
  }
  const reconc = {
    ...v.intent.pieza,
    componentes: v.intent.pieza.componentes.map((c) => reconciliarMaterialServidor(c, (id) => INSUMOS[id], CAT, { puedeConfirmar })),
  };
  const r = calcular(reconc, 1, INSUMOS, PARAMETROS_DEFAULT);
  const em = costeoEmitible(r);
  const precioRaw = precioDe(r.costoUnitario, 40);
  return {
    status: 200,
    intentComponentes: reconc.componentes,             // lo EFECTIVO que el servidor costeó
    emitible: em.emitible,
    costoUnitario: r.costoUnitario,
    costoTotal: em.costoTotal,
    materialesPorConfirmar: em.bloqueos.materiales_por_confirmar,
    precioVenta: em.emitible && Number.isFinite(precioRaw) ? precioRaw : null,
  };
}

const PANEL = { nombre: 'Lateral melamina', insumoId: 'melamina-19-color', material_solicitado: 'melamina 18 mm nogal', forma: 'area', largoMM: 950, anchoMM: 650, cantidad: 4, hojas: 0.8 };

describe('P0.1 — PROVISIONAL (18→19) NO es emitible, pero sí tiene costo', () => {
  it('1) melamina 18→19: candidato autollenado, costo>0, emitible=false, bloqueo materiales_por_confirmar, costoTotal=null', () => {
    const comp = mapear(PANEL);
    expect(comp.insumoId).toBe('melamina-19-color');                 // autollenado
    expect(comp.material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);

    const r = costear([comp]);
    expect(r.costoUnitario).toBeGreaterThan(0);                      // hay costo provisional
    expect(r.materialesPorConfirmar).toContain('Lateral melamina');

    const em = costeoEmitible(r);
    expect(em.emitible).toBe(false);                                 // NO emitible
    expect(em.bloqueos.materiales_por_confirmar).toContain('Lateral melamina');
    expect(em.costoTotal).toBeNull();                                // sin costo total autorizado
    expect(em.subtotalConocido).toBeGreaterThan(0);                  // pero el subtotal existe
  });

  it('2) tras confirmación humana: USER_CONFIRMED, mismo insumoId, mismo costo, emitible=true, BOM hash CAMBIA', () => {
    const prov = mapear(PANEL);
    const conf = { ...prov, material_match: MATCH.USER_CONFIRMED, _match: { ...prov._match, clase: MATCH.USER_CONFIRMED, confirmado_por_usuario: true } };

    expect(conf.insumoId).toBe(prov.insumoId);                       // mismo insumoId
    expect(costear([prov]).costoUnitario).toBe(costear([conf]).costoUnitario); // mismo costo

    const em = costeoEmitible(costear([conf]));
    expect(em.emitible).toBe(true);                                  // liberado
    expect(em.costoTotal).not.toBeNull();

    expect(bomHash([prov])).not.toBe(bomHash([conf]));               // hash distingue confirmación
  });
});

describe('P0.2 — el servidor recibe el estado y no deja salir provisional como completo', () => {
  it('3) request a servidor del 18→19: preserva material_match y NO emite (sin precio)', () => {
    const comp = mapear(PANEL);
    const s = servidor([comp]);
    // El DTO conservó material_match (uppercased) para la decisión server-side.
    expect(s.intentComponentes[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(s.costoUnitario).toBeGreaterThan(0);                      // costo provisional existe
    expect(s.emitible).toBe(false);                                  // pero no es completo/certificado
    expect(s.costoTotal).toBeNull();
    expect(s.precioVenta).toBeNull();                                // no sale precio de venta
    expect(s.materialesPorConfirmar).toContain('Lateral melamina');
  });

  it('3b) confirmado humano en servidor (material_confirmado) → emitible, con precio', () => {
    const comp = { ...mapear(PANEL), material_confirmado: true };  // intención dedicada, no el string
    const s = servidor([comp]);
    expect(s.intentComponentes[0].material_match).toBe(MATCH.USER_CONFIRMED);
    expect(s.emitible).toBe(true);
    expect(s.precioVenta).toBeGreaterThan(0);
  });
});

describe('P0 — fail-closed intacto para el resto', () => {
  it('4) acero cal.14→18 (crítico): costo pendiente, emitible=false', () => {
    const comp = mapear({ nombre: 'Cabezal', insumoId: 'lamina-14', material_solicitado: 'lamina de acero cal. 18', cantidad: 3 });
    expect(comp.insumoId).toBe('');                                  // no costea
    expect(comp.material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(costeoEmitible(costear([comp])).emitible).toBe(false);
  });

  it('5) solid surface → MDF: BLOQUEADO (catálogo sin solid surface)', () => {
    const catSinSS = [{ id: 'mdf', nombre: 'MDF 19 mm', precio: 437, seccion: 'cubierta', clase: 'directa', formato: { medida: 2.98 }, fraccion: true }];
    const insSinSS = Object.fromEntries(catSinSS.map((x) => [x.id, x]));
    const comp = aplicarPoliticaMaterial({ nombre: 'Cubierta', insumoId: 'mdf', material_solicitado: 'superficie sólida azul', forma: 'area', largoMM: 800, anchoMM: 400, cantidad: 1 }, (id) => insSinSS[id], catSinSS);
    expect(comp.insumoId).toBe('');                                  // jamás MDF
    expect(comp.material_match).toBe(MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION);
    expect(costeoEmitible(calcular({ piezas: 1, componentes: [comp] }, 1, insSinSS, PARAMETROS_DEFAULT)).emitible).toBe(false);
  });

  it('6) dos candidatos ambiguos de la misma familia: BLOQUEADO (no escoge solo)', () => {
    const comp = mapear({ nombre: 'Panel', insumoId: '', material_solicitado: 'melamina' });
    expect(comp.insumoId).toBe('');
    expect(comp.material_match).toBe(MATCH.AMBIGUOUS);
    expect(costeoEmitible(costear([comp])).emitible).toBe(false);
  });

  it('7) EXACT: sin regresión — costea y emite', () => {
    const comp = mapear({ nombre: 'Cubierta', insumoId: 'melamina-19-color', material_solicitado: 'melamina 19 mm color madera', forma: 'area', largoMM: 1200, anchoMM: 600, cantidad: 1, hojas: 0.3 });
    expect(comp.material_match).toBe(MATCH.EXACT);
    const em = costeoEmitible(costear([comp]));
    expect(em.emitible).toBe(true);
    expect(em.costoTotal).not.toBeNull();
    expect(em.bloqueos.materiales_por_confirmar).toEqual([]);
  });
});

// ============================================================================
//  ADVERSARIALES (audit 2026-10-08, P0.5/P0.6): el material_match del BROWSER no es
//  autoridad. El servidor RECALCULA la clase efectiva; un spoof no se salta el gate.
// ============================================================================
describe('ADVERSARIAL — el servidor no confía en el material_match del cliente', () => {
  const PANEL18 = { nombre: 'Lateral', insumoId: 'melamina-19-color', material_solicitado: 'melamina 18 mm nogal', forma: 'area', largoMM: 950, anchoMM: 650, cantidad: 4, hojas: 0.8 };

  it('A) spoof EXACT sobre 18→19 → servidor recalcula SAME_FAMILY_COMPATIBLE_PROPOSED, emitible=false', () => {
    const s = servidor([{ ...PANEL18, material_match: 'EXACT' }]);   // el browser miente
    expect(s.status).toBe(200);
    expect(s.intentComponentes[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(s.emitible).toBe(false);
    expect(s.precioVenta).toBeNull();
  });

  it('B) omite material_match → el servidor lo deriva, sigue emitible=false', () => {
    const s = servidor([{ ...PANEL18 }]);                            // sin material_match
    expect(s.intentComponentes[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(s.emitible).toBe(false);
  });

  it('C) material_match basura → 400 INVALID_INPUT (enum estricto, fail-closed)', () => {
    const s = servidor([{ ...PANEL18, material_match: 'TODO_BIEN_CONFIA_EN_MI' }]);
    expect(s.status).toBe(400);
    expect(s.code).toBe('INVALID_INPUT');
  });

  it('D) spoof cross-family (MDF + EXACT para "solid surface") → NUNCA EXACT, nunca MDF, bloqueado', () => {
    const s = servidor([{ nombre: 'Cubierta', insumoId: 'mdf', material_solicitado: 'superficie sólida azul', material_match: 'EXACT', forma: 'area', largoMM: 800, anchoMM: 400, cantidad: 1 }]);
    expect(s.intentComponentes[0].material_match).not.toBe(MATCH.EXACT);
    expect(s.intentComponentes[0].insumoId).not.toBe('mdf');         // jamás MDF disfrazado
    expect(s.emitible).toBe(false);
  });

  it('E) critical spoof (cal.18 pedida, cal.14 candidato, browser EXACT) → CRITICAL, no emitible', () => {
    const s = servidor([{ nombre: 'Cabezal', insumoId: 'lamina-14', material_solicitado: 'lámina de acero cal. 18', material_match: 'EXACT', cantidad: 3 }]);
    expect(s.intentComponentes[0].material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(s.intentComponentes[0].insumoId).toBe('');
    expect(s.emitible).toBe(false);
  });

  it('F) confirmación humana VÁLIDA (material_confirmado) → USER_CONFIRMED efectivo, libera gate, distinguible de IA', () => {
    const s = servidor([{ ...PANEL18, material_confirmado: true }]); // intención dedicada, no string
    expect(s.intentComponentes[0].material_match).toBe(MATCH.USER_CONFIRMED);
    expect(s.intentComponentes[0]._match.confirmado_por_usuario).toBe(true); // actor humano, no IA
    expect(s.emitible).toBe(true);
    expect(s.precioVenta).toBeGreaterThan(0);
  });

  it('F-neg) material_match="USER_CONFIRMED" SIN intención (solo string) NO libera el gate', () => {
    // El browser pone el string pero no la intención dedicada: el servidor recalcula a COMPATIBLE.
    const s = servidor([{ ...PANEL18, material_match: 'USER_CONFIRMED' }]);
    expect(s.intentComponentes[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(s.emitible).toBe(false);
  });

  it('G) hash: distinto solicitado y distinto candidato → hashes distintos', () => {
    const a = { nombre: 'P', insumoId: 'melamina-19-color', material_solicitado: 'melamina 18 mm' };
    const b = { ...a, material_solicitado: 'melamina 16 mm' };
    expect(bomHash([a])).not.toBe(bomHash([b]));                      // cambió la especificación
    const c = { nombre: 'P', insumoId: '', material_solicitado: 'lámina cal.18', candidate_insumo_id: 'lamina-14' };
    const d = { ...c, candidate_insumo_id: 'lamina-18' };
    expect(bomHash([c])).not.toBe(bomHash([d]));                      // cambió el candidato crítico
  });
});

describe('MATCH_AUTOCOSTEABLE sólo significa "puede subtotal provisional", NO emitible', () => {
  it('COMPATIBLE está en MATCH_AUTOCOSTEABLE (subtotal) pero NO es emitible ni libera el gate', () => {
    const comp = mapear(PANEL);
    expect(MATCH_AUTOCOSTEABLE.has(comp.material_match)).toBe(true);  // puede subtotal
    expect(requiereConfirmacion(comp)).toBe(true);                    // pero el gate lo bloquea
    expect(costeoEmitible(costear([comp])).emitible).toBe(false);     // NO emitible
    // Ningún caller lo usa como emitible/aprobado/certificado: el ÚNICO juez de emisión es
    // costeoEmitible (vía materialesPorConfirmar), no MATCH_AUTOCOSTEABLE.
  });
  it('USER_CONFIRMED está en MATCH_AUTOCOSTEABLE y SÍ libera (no es por confirmar)', () => {
    const comp = { ...mapear(PANEL), material_match: MATCH.USER_CONFIRMED };
    expect(MATCH_AUTOCOSTEABLE.has(comp.material_match)).toBe(true);
    expect(requiereConfirmacion(comp)).toBe(false);
  });
});

// ============================================================================
//  P0.9 — CAPABILITY DE CONFIRMACIÓN TÉCNICA (el servidor decide por ROL, no el browser).
//  Modelo: IA propone → Diseño/Dirección confirma → Ventas consume.
// ============================================================================
describe('P0.9 — sólo Diseño/Dirección pueden confirmar material', () => {
  const PANEL18 = { nombre: 'Lateral', insumoId: 'melamina-19-color', material_solicitado: 'melamina 18 mm nogal', forma: 'area', largoMM: 950, anchoMM: 650, cantidad: 4, hojas: 0.8 };

  it('VENDEDOR + material_confirmado=true → 403 MATERIAL_CONFIRMATION_FORBIDDEN (no degrada en silencio)', () => {
    const s = servidor([{ ...PANEL18, material_confirmado: true }], { rol: 'vendedor' });
    expect(s.status).toBe(403);
    expect(s.code).toBe('MATERIAL_CONFIRMATION_FORBIDDEN');
  });

  it('VENDEDOR sin confirmar (solo 18→19) → puede COSTEAR provisional, pero NO emitible', () => {
    const s = servidor([PANEL18], { rol: 'vendedor' });
    expect(s.status).toBe(200);
    expect(s.intentComponentes[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(s.emitible).toBe(false);
  });

  it('DISEÑO + confirmación válida → USER_CONFIRMED efectivo, emitible, con precio', () => {
    const s = servidor([{ ...PANEL18, material_confirmado: true }], { rol: 'diseno' });
    expect(s.intentComponentes[0].material_match).toBe(MATCH.USER_CONFIRMED);
    expect(s.emitible).toBe(true);
    expect(s.precioVenta).toBeGreaterThan(0);
  });

  it('DIRECCIÓN + confirmación válida → USER_CONFIRMED efectivo', () => {
    const s = servidor([{ ...PANEL18, material_confirmado: true }], { rol: 'direccion' });
    expect(s.intentComponentes[0].material_match).toBe(MATCH.USER_CONFIRMED);
    expect(s.emitible).toBe(true);
  });
});

// ============================================================================
//  P1 — ESPESOR: no todo cambio de espesor de panel es "compatible".
// ============================================================================
describe('P1 — política de espesor conservadora (sólo 18↔19 aprobado)', () => {
  const panel = (mm) => mapear({ nombre: 'Cubierta', insumoId: 'melamina-19-color', material_solicitado: `melamina ${mm} mm color`, forma: 'area', largoMM: 1200, anchoMM: 600, cantidad: 1, hojas: 0.3 });

  it('18→19 = COMPATIBLE provisional (único aprobado)', () => {
    expect(panel(18).material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
  });
  it('28→19 = CRÍTICO (doble tablero/engrosado posible)', () => {
    expect(panel(28).material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(panel(28).insumoId).toBe('');
  });
  it('36→19 = CRÍTICO', () => {
    expect(panel(36).material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
  });
  it('9→19 = CRÍTICO', () => {
    expect(panel(9).material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
  });
});

// ============================================================================
//  BACKWARD-COMPAT — BOMs legacy / selección manual (insumoId sin material_solicitado).
// ============================================================================
describe('backward-compat: BOMs legacy no se destruyen ni inventan confirmación', () => {
  const legacy = { nombre: 'Cubierta', insumoId: 'melamina-19-color', forma: 'area', largoMM: 1200, anchoMM: 600, cantidad: 1, hojas: 0.3 };

  it('legacy (insumoId, SIN material_solicitado) → se PRESERVA (LEGACY_SELECTED), costea y EMITE', () => {
    const rec = reconciliarMaterialServidor(legacy, (id) => INSUMOS[id], CAT, { puedeConfirmar: false });
    expect(rec.insumoId).toBe('melamina-19-color');          // no se destruye el insumo efectivo
    expect(rec.material_match).toBe(MATCH.LEGACY_SELECTED);
    const em = costeoEmitible(costear([rec]));
    expect(em.emitible).toBe(true);                          // cotización legacy sigue emitible
    expect(em.costoTotal).not.toBeNull();
  });

  it('legacy con insumoId INEXISTENTE → NOT_AVAILABLE (fail-closed, no inventa)', () => {
    const rec = reconciliarMaterialServidor({ nombre: 'X', insumoId: 'fantasma-999' }, (id) => INSUMOS[id], CAT, { puedeConfirmar: false });
    expect(rec.insumoId).toBe('');
    expect(rec.material_match).toBe(MATCH.NOT_AVAILABLE);
    expect(costeoEmitible(costear([rec])).emitible).toBe(false);
  });

  it('legacy NO inventa confirmación: material_confirmado sin capability NO promueve a USER_CONFIRMED', () => {
    const rec = reconciliarMaterialServidor({ ...legacy, material_confirmado: true }, (id) => INSUMOS[id], CAT, { puedeConfirmar: false });
    expect(rec.material_match).toBe(MATCH.LEGACY_SELECTED);  // no USER_CONFIRMED sin rol
    expect(rec._match.confirmado_por_usuario).toBe(false);
  });

  it('un BOM legacy completo (varias piezas con insumoId) mantiene su costo > 0 (no se vuelve $0)', () => {
    const bom = [
      { nombre: 'Cubierta', insumoId: 'melamina-19-color', forma: 'area', largoMM: 1200, anchoMM: 600, cantidad: 1, hojas: 0.3 },
      { nombre: 'Costado', insumoId: 'melamina-16', forma: 'area', largoMM: 700, anchoMM: 600, cantidad: 2, hojas: 0.4 },
    ].map((c) => reconciliarMaterialServidor(c, (id) => INSUMOS[id], CAT, { puedeConfirmar: false }));
    const em = costeoEmitible(costear(bom));
    expect(em.emitible).toBe(true);
    expect(em.subtotalConocido).toBeGreaterThan(0);
  });
});
