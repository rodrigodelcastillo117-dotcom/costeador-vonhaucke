import { describe, it, expect } from 'vitest';
import { INSUMOS_SEMILLA } from './insumos.js';
import { aplicarPoliticaMaterial, reconciliarMaterialServidor, clasificarMaterial, puedeConfirmarMaterial, estadoConTopeLegacy, requiereConfirmacion, MATCH, MATCH_AUTOCOSTEABLE } from './materialMatch.js';
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
// `origenLegacy` SÓLO lo fija el servidor (provenance confiable); el edge interactivo real
// pasa SIEMPRE false. En las pruebas simulamos un re-costeo de expediente verificado con true.
function servidor(componentesCrudos, { rol = 'diseno', origenLegacy = false } = {}) {
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
    componentes: v.intent.pieza.componentes.map((c) => reconciliarMaterialServidor(c, (id) => INSUMOS[id], CAT, { puedeConfirmar, origenLegacyConfiable: origenLegacy })),
  };
  const r = calcular(reconc, 1, INSUMOS, PARAMETROS_DEFAULT);
  const em = costeoEmitible(r);
  const precioRaw = precioDe(r.costoUnitario, 40);
  // ESTADO como el edge: emitible+todo-certificado→'certificado'; aquí asumimos precios
  // certificados para probar el TOPE P0.11 (LEGACY_SELECTED nunca llega a 'certificado').
  const estadoBase = !em.emitible ? 'incompleto' : 'certificado';
  const estado = estadoConTopeLegacy(estadoBase, reconc.componentes);
  return {
    status: 200,
    intentComponentes: reconc.componentes,             // lo EFECTIVO que el servidor costeó
    emitible: em.emitible,
    estado,
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
// ============================================================================
//  P0.10 — LEGACY no se infiere por FALTA de material_solicitado. Sólo provenance
//  server-side confiable. P0.11 — LEGACY nunca llega a 'certificado' automáticamente.
//  Adversariales H–N.
// ============================================================================
describe('P0.10/P0.11 — LEGACY sólo por provenance server-side, nunca certificado automático', () => {
  const sinSolicitado = { nombre: 'Cubierta', insumoId: 'melamina-19-color', forma: 'area', largoMM: 1200, anchoMM: 600, cantidad: 1, hojas: 0.3 };

  it('H) VENDEDOR omite material_solicitado → NO legacy, NO emisión por esa omisión', () => {
    const s = servidor([sinSolicitado], { rol: 'vendedor', origenLegacy: false });
    expect(s.status).toBe(200);
    expect(s.intentComponentes[0].material_match).toBe(MATCH.CANDIDATE_REQUIRES_CONFIRMATION); // pendiente
    expect(s.intentComponentes[0].material_match).not.toBe(MATCH.LEGACY_SELECTED);
    expect(s.emitible).toBe(false);
  });

  it('I) DISEÑO omite material_solicitado SIN confirmación → tampoco legacy automático', () => {
    const s = servidor([sinSolicitado], { rol: 'diseno', origenLegacy: false });
    expect(s.intentComponentes[0].material_match).toBe(MATCH.CANDIDATE_REQUIRES_CONFIRMATION);
    expect(s.emitible).toBe(false);
  });

  it('J) BOM histórico REAL con provenance server-side → sí backward compatibility (LEGACY_SELECTED, emite)', () => {
    const s = servidor([sinSolicitado], { rol: 'vendedor', origenLegacy: true }); // provenance la fija el servidor
    expect(s.intentComponentes[0].material_match).toBe(MATCH.LEGACY_SELECTED);
    expect(s.intentComponentes[0].insumoId).toBe('melamina-19-color');            // no se destruye
    expect(s.emitible).toBe(true);
  });

  it('K) cliente manda material_match=LEGACY_SELECTED → ignorado/recalculado (queda pendiente)', () => {
    const s = servidor([{ ...sinSolicitado, material_match: 'LEGACY_SELECTED' }], { rol: 'vendedor', origenLegacy: false });
    expect(s.intentComponentes[0].material_match).toBe(MATCH.CANDIDATE_REQUIRES_CONFIRMATION);
    expect(s.emitible).toBe(false);
  });

  it('L) cliente manda legacy=true → sin autoridad (el DTO lo descarta, sigue pendiente)', () => {
    const s = servidor([{ ...sinSolicitado, legacy: true }], { rol: 'vendedor', origenLegacy: false });
    expect(s.status).toBe(200);
    expect(s.intentComponentes[0].material_match).toBe(MATCH.CANDIDATE_REQUIRES_CONFIRMATION);
    expect(s.intentComponentes[0].legacy).toBeUndefined();   // el flag del cliente no sobrevive
  });

  it('M) legacy real + precios todos certificables → NO estado=certificado (tope preliminar)', () => {
    const s = servidor([sinSolicitado], { rol: 'vendedor', origenLegacy: true });
    expect(s.intentComponentes[0].material_match).toBe(MATCH.LEGACY_SELECTED);
    expect(s.emitible).toBe(true);
    expect(s.estado).toBe('preliminar');                     // NO 'certificado' aunque emita
    expect(s.estado).not.toBe('certificado');
  });

  it('N) legacy migrado/confirmado válidamente → cambia de estado y de BOM hash (revisión)', () => {
    const legacy = reconciliarMaterialServidor(sinSolicitado, (id) => INSUMOS[id], CAT, { puedeConfirmar: false, origenLegacyConfiable: true });
    // Confirmación válida (diseño/dirección) sobre la misma pieza → USER_CONFIRMED.
    const confirmado = reconciliarMaterialServidor({ ...sinSolicitado, material_confirmado: true }, (id) => INSUMOS[id], CAT, { puedeConfirmar: true });
    expect(legacy.material_match).toBe(MATCH.LEGACY_SELECTED);
    expect(confirmado.material_match).toBe(MATCH.USER_CONFIRMED);
    // Estado: legacy topa en preliminar; confirmado puede certificar.
    expect(estadoConTopeLegacy('certificado', [legacy])).toBe('preliminar');
    expect(estadoConTopeLegacy('certificado', [confirmado])).toBe('certificado');
    // Revisión/hash: legacy ≠ confirmado.
    expect(bomHash([legacy])).not.toBe(bomHash([confirmado]));
  });

  it('insumoId INEXISTENTE (con o sin provenance) → NOT_AVAILABLE (fail-closed)', () => {
    const rec = reconciliarMaterialServidor({ nombre: 'X', insumoId: 'fantasma-999' }, (id) => INSUMOS[id], CAT, { origenLegacyConfiable: true });
    expect(rec.insumoId).toBe('');
    expect(rec.material_match).toBe(MATCH.NOT_AVAILABLE);
  });
});

// ============================================================================
//  ADVERSARIALES O–T (auditoría final): material_solicitado también es client-controlled;
//  identidad de perfil/metal y acabado/color; blockers simultáneos; cross-family override.
// ============================================================================
describe('O–T — nada que controle el cliente otorga EXACT/emisión por sí solo', () => {
  it('O) spec coherente enviada por el browser (sin provenance) → NO EXACT: provisional, no emitible (P0.12)', () => {
    const s = servidor([{ nombre: 'Lateral', insumoId: 'melamina-19-color', material_solicitado: 'melamina 19 color madera', forma: 'area', largoMM: 950, anchoMM: 650, cantidad: 2, hojas: 0.4 }], { rol: 'vendedor' });
    expect(s.intentComponentes[0].material_match).not.toBe(MATCH.EXACT);
    expect(s.intentComponentes[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(s.emitible).toBe(false);
    // Con provenance server-side de la spec, SÍ sería EXACT:
    const conProv = reconciliarMaterialServidor({ nombre: 'Lateral', insumoId: 'melamina-19-color', material_solicitado: 'melamina 19 color madera' }, (id) => INSUMOS[id], CAT, { origenSpecConfiable: true });
    expect(conProv.material_match).toBe(MATCH.EXACT);
  });

  it('P) identidad de perfil: lámina vs PTR (mismo calibre) → NO EXACT, CRÍTICO (P0.13)', () => {
    const laminaVsPtr = clasificarMaterial({ solicitado: 'lámina de acero cal. 14', insumoId: 'ptr-14', insumoNombre: 'Tubo / PTR cal. 14' });
    expect(laminaVsPtr.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(laminaVsPtr.insumoIdEfectivo).toBe('');
    // redondo vs tubo (PTR) → crítico
    const redondoVsPtr = clasificarMaterial({ solicitado: 'tubo redondo cal. 14', insumoId: 'ptr-14', insumoNombre: 'Tubo / PTR 1"x2" cal. 14' });
    expect(redondoVsPtr.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    // dimensiones de perfil distintas 1x2 vs 3x1½ → crítico
    const dimsDistintas = clasificarMaterial({ solicitado: 'PTR 3x1 1/2 cal. 14', insumoId: 'ptr', insumoNombre: 'Tubo / PTR 1"x2" cal. 16' });
    expect(dimsDistintas.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
  });

  it('Q) acabado/color: melamina BLANCA 19 vs COLOR/madera 19 → NO EXACT, variante por confirmar (P0.14)', () => {
    const r = clasificarMaterial({ solicitado: 'melamina blanca 19 mm', insumoId: 'melamina-19-color', insumoNombre: 'Melamina de COLOR / madera 19 mm' });
    expect(r.clase).not.toBe(MATCH.EXACT);
    expect(r.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);  // misma familia+espesor pero color distinto
    expect(r.autocosteable).toBe(true);                          // costea provisional
    // mismo color (nogal ↔ "Nogal Neo TX") sí es EXACT
    const exacto = clasificarMaterial({ solicitado: 'melamina nogal 19 mm', insumoId: 'melamina-19-nogal', insumoNombre: 'Melamina 19 mm Nogal Neo TX' });
    expect(exacto.clase).toBe(MATCH.EXACT);
  });

  it('R) blockers SIMULTÁNEOS: partida por-confirmar Y sin precio usable → aparecen AMBOS (P0.15)', () => {
    const INS2 = { 'sin-precio': { nombre: 'Tablero sin precio', seccion: 'cubiertas', clase: 'directa', formato: { medida: 2.98 }, fraccion: true } }; // sin `precio`
    const comp = { nombre: 'Panel X', insumoId: 'sin-precio', material_match: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, forma: 'area', largoMM: 1000, anchoMM: 500, cantidad: 1, hojas: 0.3 };
    const r = calcular({ piezas: 1, componentes: [comp] }, 1, INS2, PARAMETROS_DEFAULT);
    expect(r.materialesPorConfirmar).toContain('Panel X');       // bloqueo 1: por confirmar
    expect(r.componentesIgnorados).toContain('Panel X');          // bloqueo 2: sin precio
    const em = costeoEmitible(r);
    expect(em.bloqueos.materiales_por_confirmar).toContain('Panel X');
    expect(em.bloqueos.datos_faltantes).toContain('Panel X');
    expect(em.emitible).toBe(false);
  });

  it('S) cross-family confirmation (solid surface→MDF, material_confirmado SIN override) → NO USER_CONFIRMED', () => {
    const catSinSS = [{ id: 'mdf', nombre: 'MDF 19 mm', precio: 437, seccion: 'cubierta', clase: 'directa', formato: { medida: 2.98 }, fraccion: true }];
    const insSinSS = Object.fromEntries(catSinSS.map((x) => [x.id, x]));
    const rec = reconciliarMaterialServidor(
      { nombre: 'Cubierta', insumoId: 'mdf', material_solicitado: 'superficie sólida azul', material_confirmado: true },
      (id) => insSinSS[id], catSinSS, { puedeConfirmar: true },  // diseño/dirección, pero SIN override
    );
    expect(rec.material_match).not.toBe(MATCH.USER_CONFIRMED);
    expect(rec.material_match).toBe(MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION);
    expect(rec.insumoId).toBe('');                                // jamás MDF disfrazado de solid surface
  });

  it('T) cross-family con ENGINEERING_OVERRIDE + capability + motivo → USER_CONFIRMED auditable; sin capability → NO', () => {
    const catSinSS = [{ id: 'mdf', nombre: 'MDF 19 mm', precio: 437, seccion: 'cubierta', clase: 'directa', formato: { medida: 2.98 }, fraccion: true }];
    const insSinSS = Object.fromEntries(catSinSS.map((x) => [x.id, x]));
    const base = { nombre: 'Cubierta', insumoId: 'mdf', material_solicitado: 'superficie sólida azul', material_confirmado: true, engineering_override: true, override_motivo: 'Cliente aprobó MDF por costo (acta 123)' };
    const conCap = reconciliarMaterialServidor(base, (id) => insSinSS[id], catSinSS, { puedeConfirmar: true });
    expect(conCap.material_match).toBe(MATCH.USER_CONFIRMED);      // sustitución deliberada autorizada
    expect(conCap.insumoId).toBe('mdf');
    expect(conCap._match.motivo).toMatch(/override|acta 123/i);    // motivo auditable
    // sin capability, el override NO aplica:
    const sinCap = reconciliarMaterialServidor(base, (id) => insSinSS[id], catSinSS, { puedeConfirmar: false });
    expect(sinCap.material_match).not.toBe(MATCH.USER_CONFIRMED);
  });
});

// ============================================================================
//  P0.16 — AUTORIDAD DEL SERVIDOR para APROBAR (no el juez local). Regresión obligatoria:
//  IA propone melamina 19 EXACT localmente, pero el servidor (sin provenance de spec) la
//  clasifica provisional/incompleto → NO aprobable. Tras confirmación de Diseño → aprobable.
// ============================================================================
describe('P0.16 — aprobar exige validación server-authority (costo local == servidor a centavos)', () => {
  // Réplica del predicado de aprobación del frontend (AsistenteEspecial.validarServidorParaAprobar).
  const centavos = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x) * 100) : null);
  const validoParaAprobar = (localCosto, s) => {
    const ok = s.status === 200;
    const estadoOK = ok && !!s.estado && s.estado !== 'incompleto' && s.estado !== 'bloqueado';
    const costoFinito = Number.isFinite(Number(s.costoUnitario));
    const cL = centavos(localCosto), cS = costoFinito ? centavos(s.costoUnitario) : null;
    return ok && estadoOK && costoFinito && cS != null && cL === cS;
  };

  const ai = { nombre: 'Lateral', insumoId: 'melamina-19-color', material_solicitado: 'melamina 19 color madera', forma: 'area', largoMM: 950, anchoMM: 650, cantidad: 2, hojas: 0.4 };
  // Igual que mapIaComps del cliente: aplica política + copia medidas de área (que la función pura no copia).
  const mapConDims = (z) => { const c = mapear(z); if (z.forma === 'area') { c.largoMM = z.largoMM; c.anchoMM = z.anchoMM; c.piezas = z.cantidad || 1; c.cantidad = 1; if (z.hojas > 0) c.hojas = z.hojas; } return c; };

  it('local diría EXACT/emitible, pero el servidor sin provenance → provisional/incompleto → NO aprobable', () => {
    const local = mapConDims(ai);
    expect(local.material_match).toBe(MATCH.EXACT);                 // el juez LOCAL lo ve exacto
    expect(costeoEmitible(costear([local])).emitible).toBe(true);   // y emitible local
    const localCosto = costear([local]).costoUnitario;

    const s1 = servidor([ai], { rol: 'diseno' });                   // servidor, sin confirmar
    expect(s1.intentComponentes[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(s1.estado).toBe('incompleto');
    expect(validoParaAprobar(localCosto, s1)).toBe(false);          // P0.16: NO se puede aprobar
  });

  it('tras confirmación explícita de Diseño → USER_CONFIRMED, costo cuadra a centavos → SÍ aprobable', () => {
    const localCosto = costear([mapConDims(ai)]).costoUnitario;
    const s2 = servidor([{ ...ai, material_confirmado: true }], { rol: 'diseno' });
    expect(s2.intentComponentes[0].material_match).toBe(MATCH.USER_CONFIRMED);
    expect(s2.estado).not.toBe('incompleto');
    expect(Number.isFinite(Number(s2.costoUnitario))).toBe(true);
    expect(validoParaAprobar(localCosto, s2)).toBe(true);           // costo local == servidor → aprobable
  });

  it('vendedor NO obtiene costo técnico del servidor → nunca aprobable por esa vía', () => {
    // (el edge no devuelve `costo` a vendedor; aquí el harness igual bloquea por estado provisional)
    const s = servidor([ai], { rol: 'vendedor' });
    expect(s.estado).toBe('incompleto');
    expect(validoParaAprobar(999, s)).toBe(false);
  });
});
