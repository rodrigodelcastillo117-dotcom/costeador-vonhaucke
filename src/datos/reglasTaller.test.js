import { describe, it, expect } from 'vitest';
import { metrosDeCanto, perimetroPerfilMM, areaPintadaTubularM2, ladosConCanto, REGLAS_TALLER } from './reglasTaller.js';
import { conAcompanantes } from './autoInsumos.js';
import { mapIaComps } from './mapIaComps.js';
import { revisarEstructura, rolDe } from './revisionEstructural.js';
import { familiaDeMaterial, aplicarPoliticaMaterial, clasificarMaterial, MATCH, requiereConfirmacion, difiereDeLoPedido, formatoHojaDe } from './materialMatch.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { calcular } from '../motor/calculo.js';

const insumos = mapaInsumos(INSUMOS_SEMILLA);
const catalogo = Object.values(insumos);

describe('reglas de casa · canto y pintura por geometría', () => {
  it('lados con canto por rol: cubierta 4, costado 2, entrepaño 1, respaldo 0', () => {
    expect(ladosConCanto('cubierta')).toBe(4); expect(ladosConCanto('costado')).toBe(2);
    expect(ladosConCanto('entrepano')).toBe(1); expect(ladosConCanto('respaldo')).toBe(0); expect(ladosConCanto('loquesea')).toBe(1);
  });
  it('metros de canto: cubierta 800×700 ×3 = 3 × 2(0.8+0.7) = 9 m; entrepaño 790×250 ×6 = 4.74 m', () => {
    expect(metrosDeCanto({ largoMM: 800, anchoMM: 700, piezas: 3, rol: 'cubierta' })).toBeCloseTo(9, 6);
    expect(metrosDeCanto({ largoMM: 790, anchoMM: 250, piezas: 6, rol: 'entrepano' })).toBeCloseTo(4.74, 6);
    expect(metrosDeCanto({ largoMM: 800, anchoMM: 1100, piezas: 3, rol: 'respaldo' })).toBe(0);
  });
  it('perímetro del perfil: 1"x2" = 152.4 mm/m; 1 1/2" = 152.4; 38x38 = 152; sin perfil → 1"×1" supuesto', () => {
    expect(perimetroPerfilMM('Tubo / PTR 1"x2" cal. 16').mm).toBeCloseTo(152.4, 3);
    expect(perimetroPerfilMM('tubo 1 1/2" cal 14').mm).toBeCloseTo(152.4, 3);
    expect(perimetroPerfilMM('PTR 38x38 cal 14').mm).toBe(152);
    const d = perimetroPerfilMM('Tubo / PTR cal. 14'); expect(d.declarado).toBe(false); expect(d.mm).toBeCloseTo(101.6, 3);
  });
  it('30 m de PTR sin perfil declarado → 3.05 m² (como el "~3 m²" que la IA suponía, pero calculado)', () => {
    const a = areaPintadaTubularM2(30, 'PTR cal. 14'); expect(a.m2).toBeCloseTo(3.048, 2); expect(a.declarado).toBe(false);
  });
});

describe('reglas de casa · familias de herraje amarran al catálogo (autorizado por Dirección 12-oct)', () => {
  it('familias nuevas', () => {
    expect(familiaDeMaterial('Bisagras puertas')).toBe('herraje_bisagra');
    expect(familiaDeMaterial('Jaladera de acero')).toBe('herraje_jaladera');
    expect(familiaDeMaterial('Nivelador conico cromado 3/8')).toBe('herraje_nivelador');
    expect(familiaDeMaterial('Tapacanto PVC')).toBe('tapacanto');
    expect(familiaDeMaterial('Pintura electrostatica estructura')).toBe('pintura_polvo');
    expect(familiaDeMaterial('Kit iluminacion LED 5000 K')).toBe('iluminacion');
    expect(familiaDeMaterial('Contacto eléctrico')).toBe('electrico');
    expect(familiaDeMaterial('Lamina de acero cal. 18')).toBe('metal_lamina');  // no cambia
  });
  it('"Bisagra" sin id → se amarra a la bisagra del catálogo, provisional POR CONFIRMAR, y costea', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Bisagras puertas', material_solicitado: 'Bisagra', cantidad: 4 }, (id) => insumos[id], catalogo);
    expect(c.insumoId).toBe('bisagra'); expect(c.material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(requiereConfirmacion(c)).toBe(true);   // sigue bloqueando la emisión hasta confirmar
  });
  it('"Cerradura" con dos candidatos (genérica y electrónica) → el GENÉRICO es el de casa, no ambiguo', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Cerradura', material_solicitado: 'Cerradura', cantidad: 1 }, (id) => insumos[id], catalogo);
    expect(c.insumoId).toBe('cerradura'); expect(c._match.motivo).toMatch(/Estándar de casa/);
  });
  it('variante de herraje pedida que el catálogo no nombra ("bisagra cierre suave") → provisional, no EXACT', () => {
    const r = clasificarMaterial({ solicitado: 'Bisagra cierre suave', insumoId: 'bisagra', insumoNombre: 'Bisagra' });
    expect(r.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED); expect(r.cambio).toMatch(/cierre suave/);
    expect(clasificarMaterial({ solicitado: 'Bisagra', insumoId: 'bisagra', insumoNombre: 'Bisagra' }).clase).toBe(MATCH.EXACT);
  });
  it('tapacanto: "siempre es el mismo canto" → el estándar de casa aunque haya cubrecantos', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Tapacanto', material_solicitado: 'Tapacanto PVC', cantidad: 18 }, (id) => insumos[id], catalogo);
    expect(c.insumoId).toBe('tapacanto');
  });
  it('acero pedido en negro contra PTR crudo del mismo calibre: NO es crítico (el color lo da la pintura)', () => {
    const r = clasificarMaterial({ solicitado: 'PTR cal.14 negro', insumoId: 'ptr-14', insumoNombre: 'Tubo / PTR cal. 14' });
    expect(r.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED); expect(r.cambio).toMatch(/pintura electrostática/);
    // calibre distinto sigue siendo crítico
    expect(clasificarMaterial({ solicitado: 'PTR cal.14', insumoId: 'ptr', insumoNombre: 'Tubo / PTR 1"x2" cal. 16' }).clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
  });
});

describe('reglas de casa · acompañantes por geometría', () => {
  const base = [
    { nombre: 'Laterales módulo bajo', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 19 mm', largoMM: 950, anchoMM: 650, piezas: 4, cantidad: 1, forma: 'area' },
    { nombre: 'Cubierta mostrador', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 19 mm', largoMM: 800, anchoMM: 700, piezas: 3, cantidad: 1, forma: 'area' },
    { nombre: 'Puertas módulo bajo', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 19 mm', largoMM: 395, anchoMM: 790, piezas: 2, cantidad: 1, forma: 'area' },
    { nombre: 'Respaldo superior', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 19 mm', largoMM: 800, anchoMM: 1100, piezas: 3, cantidad: 1, forma: 'area' },
    { nombre: 'Bastidor PTR estructura negra', insumoId: 'ptr-14', material_solicitado: 'PTR cal.14 negro', cantidad: 30, piezas: 1, forma: 'lineal' },
  ];
  it('agrega tapacanto (metros por cantos visibles), pintura (m² por perfil) y niveladores; no duplica', () => {
    const r = conAcompanantes(base, insumos);
    const tc = r.find((c) => c._regla === 'tapacanto'); expect(tc).toBeTruthy(); expect(tc.insumoId).toBe('tapacanto');
    // laterales (costado, 2 lados) 4×(0.95+0.65)=6.4 · cubiertas 3×2(0.8+0.7)=9 · puertas 2×2(0.395+0.79)=4.74 · respaldo 0
    expect(tc.cantidad).toBeCloseTo(20.14, 2);
    const pin = r.find((c) => c._regla === 'pintura'); expect(pin).toBeTruthy();
    expect(pin.areaPintadaM2).toBeCloseTo(3.05, 2); expect(pin.tubular).toBe(true); expect(pin.material_solicitado).toMatch(/negro/);
    expect(pin.insumoId).toMatch(/^pintura-polvo/); expect(insumos[pin.insumoId].nombre).toMatch(/negro/i);
    const niv = r.find((c) => c._regla === 'niveladores'); expect(niv).toBeTruthy(); expect(niv.cantidad).toBe(12); expect(niv.insumoId).toBe('nivelador');
    expect(conAcompanantes(r, insumos)).toHaveLength(r.length);   // idempotente
  });
  it('gabinete bajo sin base → zoclo del material de los costados y luego niveladores', () => {
    const gab = base.slice(0, 4);
    const r = conAcompanantes(gab, insumos);
    const z = r.find((c) => c._regla === 'zoclo'); expect(z).toBeTruthy(); expect(z.largoMM).toBe(2400); expect(z.anchoMM).toBe(100); expect(z.insumoId).toBe('melamina-19-color');
    expect(r.some((c) => c._regla === 'niveladores')).toBe(true);
  });
  it('sin insumos (modo histórico) sólo corre la regla del adhesivo', () => {
    expect(conAcompanantes(base)).toHaveLength(base.length);
  });
  it('si la persona ya puso tapacanto o pintura, no se agregan otra vez', () => {
    const r = conAcompanantes([...base, { nombre: 'Tapacanto PVC', insumoId: 'tapacanto', cantidad: 18 }, { nombre: 'Pintura electrostática', insumoId: 'pintura-polvo-negro', areaPintadaM2: 3 }], insumos);
    expect(r.filter((c) => familiaDeMaterial(insumos[c.insumoId]?.nombre || '') === 'tapacanto')).toHaveLength(1);
    expect(r.filter((c) => familiaDeMaterial(insumos[c.insumoId]?.nombre || '') === 'pintura_polvo')).toHaveLength(1);
  });
});

describe('reglas de casa · mapIaComps compartido: la hoja de tablero la decide el motor', () => {
  it('pieza de tablero con hojas de la IA → iaHojas se conserva, hojas NO (motor: rejilla + A14)', () => {
    const [c] = mapIaComps({ piezas: [{ nombre: 'Laterales', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 19 mm', forma: 'area', largoMM: 950, anchoMM: 650, cantidad: 4, hojas: 0.83 }] }, insumos);
    expect(c.iaHojas).toBe(0.83); expect(c.hojas).toBeUndefined(); expect(c.piezas).toBe(4);
    const r = calcular({ componentes: [c] }, 1, insumos, {});
    const d = r.detalleInsumos.find((x) => x.insumoId === 'melamina-19-color');
    expect(d.metodoConsumo).toBe('RENDIMIENTO_GEOMETRICO'); expect(d.unidades).toBeGreaterThanOrEqual(1);
  });
  it('lámina irregular con hojas de la IA → fracción directa se respeta (Rafa §1)', () => {
    const [c] = mapIaComps({ piezas: [{ nombre: 'Asiento perforado', insumoId: 'lamina-18', material_solicitado: 'Lámina cal. 18', forma: 'area', largoMM: 600, anchoMM: 450, cantidad: 2, hojas: 0.3 }] }, insumos);
    expect(c.hojas).toBe(0.3);
  });
});

describe('reglas de casa · revisión estructural de consistencia', () => {
  it('repisa visible en MDF crudo con el resto en melamina y sin laca → warning; respaldo de 19 → info; claro ≥ 800 → info', () => {
    const comps = [
      { nombre: 'Cubierta', insumoId: 'melamina-19-color', largoMM: 800, anchoMM: 700 },
      { nombre: 'Repisas superiores de exhibición', insumoId: 'mdf', largoMM: 790, anchoMM: 250 },
      { nombre: 'Respaldo superior', insumoId: 'melamina-19-color', largoMM: 800, anchoMM: 1100 },
      { nombre: 'Repisa larga', insumoId: 'melamina-19-color', largoMM: 1200, anchoMM: 300 },
    ];
    const r = revisarEstructura({ componentes: comps, insumos });
    const reglas = r.observaciones.map((o) => o.regla).filter(Boolean);
    expect(reglas).toContain('acabado_consistente'); expect(reglas).toContain('respaldo_espesor'); expect(reglas).toContain('refuerzo_claro');
    expect(r.observaciones.find((o) => o.regla === 'acabado_consistente').nivel).toBe('warning');
  });
  it('roles: plural y frente de cajón', () => {
    expect(rolDe('Puertas módulo bajo')).toBe('puerta'); expect(rolDe('Frente de cajón')).toBe('frente_cajon'); expect(rolDe('Bisagras puertas')).toBe('herraje'); expect(rolDe('Zoclo')).toBe('pata');
  });
});

describe('reglas de casa · PTR sin perfil contra varias variantes', () => {
  const cat = [
    { id: 'a', nombre: 'PTR 3" x 1 1/2" cal. 14' }, { id: 'b', nombre: 'Tubo / PTR cal. 14' }, { id: 'c', nombre: 'Tubo redondo 4" cal. 14' },
    { id: 'd', nombre: 'PTR CUADRADO 1"" CALIBRE 14 PIEZA DE 6000', evidencia: { certificable: true } }, { id: 'e', nombre: 'PTR CUADRADO DE 3/4" CALIBRE 14' },
  ];
  it('"PTR cal.14" → el perfil por defecto de casa (1"×1"), marcado como supuesto', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Bastidor', material_solicitado: 'PTR cal.14' }, (id) => cat.find((x) => x.id === id), cat);
    expect(c.insumoId).toBe('d'); expect(c._match.cambio).toMatch(/perfil supuesto/);
  });
  it('si el pedido SÍ trae perfil, manda el perfil', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Bastidor', material_solicitado: 'PTR 3" x 1 1/2" cal. 14' }, (id) => cat.find((x) => x.id === id), cat);
    expect(c.insumoId).toBe('a');
  });
});

// VH-164 (2026-10-13, mesa de centro V3-5): la base tubular cromada recibía pintura en polvo por la
// regla de casa y el renglón "cromado (EcoCrom)" se leía como ACERO (por "tubular"), con 1000×1000
// inventado y el tubular como candidato (doble conteo).
describe('VH-164 · acabado metálico (EcoCrom) en lugar de pintura', () => {
  const base = () => [
    { nombre: 'Marcos rectangulares base (tubular redondo 3/4 cal.18)', insumoId: 'tubular-redondo-34', material_solicitado: 'tubular redondo 3/4" cal. 18', cantidad: 5.6, forma: 'lineal' },
    { nombre: 'Postes verticales base (tubular redondo 3/4 cal.18)', insumoId: 'tubular-redondo-34', material_solicitado: 'tubular redondo 3/4" cal. 18', cantidad: 1.568, forma: 'lineal' },
    { nombre: 'Acabado cromado de la base (EcoCrom)', insumoId: '', material_solicitado: 'cromado (EcoCrom) en base tubular', cantidad: 1, largoMM: 1000, anchoMM: 1000 },
  ];
  it('el acabado es su propia familia; el tubo cromado sigue siendo tubo', () => {
    expect(familiaDeMaterial('cromado (EcoCrom) en base tubular')).toBe('acabado_metal');
    expect(familiaDeMaterial('Acabado cromado de la base (EcoCrom)')).toBe('acabado_metal');
    expect(familiaDeMaterial('EcoCrom')).toBe('acabado_metal');
    expect(familiaDeMaterial('Acabado EcoCrome tensores')).toBe('acabado_metal');
    expect(familiaDeMaterial('tubular redondo 3/4" cromado')).toBe('metal_lamina');
    expect(familiaDeMaterial('Nivelador conico cromado 3/8')).toBe('herraje_nivelador');
    expect(familiaDeMaterial('Jaladera cromo 128 mm')).toBe('herraje_jaladera');
  });
  it('el acabado y EcoCrom son la misma familia: no es conflicto crítico ni propone el tubular', () => {
    const r = clasificarMaterial({ solicitado: 'cromado (EcoCrom) en base tubular', insumoId: 'ecocrom', insumoNombre: 'EcoCrom' });
    expect(r.clase).not.toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    const t = clasificarMaterial({ solicitado: 'cromado (EcoCrom) en base tubular', insumoId: 'tubular-redondo-34', insumoNombre: insumos['tubular-redondo-34'].nombre });
    expect(t.insumoIdEfectivo || '').not.toBe('tubular-redondo-34');
  });
  it('no agrega pintura en polvo y el área del acabado sale de la geometría del tubo', () => {
    const r = conAcompanantes(base(), insumos);
    expect(r.some((c) => /pintura/i.test(c.nombre) || /^pintura-polvo/.test(c.insumoId || ''))).toBe(false);
    const ac = r.find((c) => /cromado/i.test(c.nombre));
    // 7.168 m × perímetro de 3/4" (π·19.05 mm = 59.85 mm) = 0.429 m²
    expect(ac.cantidad).toBeCloseTo(0.43, 2);
    expect(ac.largoMM).toBeUndefined(); expect(ac.anchoMM).toBeUndefined();
    expect(ac._regla).toBe('acabado_metal'); expect(ac.iaMedida).toBe('1000×1000');
    // Sólo se agrega la regla de casa 3 (4 niveladores por base con patas); nada de pintura.
    expect(r.filter((c) => c._auto).map((c) => c._regla)).toEqual(['niveladores']);
  });
  it('una cantidad confirmada por la persona no se toca', () => {
    const b = base(); b[2] = { ...b[2], cantidad: 0.6, cantidad_confirmada: true };
    const r = conAcompanantes(b, insumos);
    expect(r.find((c) => /cromado/i.test(c.nombre)).cantidad).toBe(0.6);
  });
  it('sin acabado metálico el acero sí lleva pintura (regla 5 intacta)', () => {
    const r = conAcompanantes(base().slice(0, 2), insumos);
    expect(r.some((c) => c._regla === 'pintura')).toBe(true);
  });
  it('una pintura que puso la IA no se borra aunque haya acabado (se dice, no se esconde)', () => {
    const r = conAcompanantes([...base(), { nombre: 'Pintura electrostática base', material_solicitado: 'Pintura electrostática en polvo negra', cantidad: 1 }], insumos);
    expect(r.some((c) => /Pintura electrostática base/.test(c.nombre))).toBe(true);
  });
});

describe('VH-164b · perímetro de tubo redondo', () => {
  it('Ø3/4" = π·19.05 mm; el cuadrado 3/4" sigue siendo 4·19.05 mm', () => {
    expect(perimetroPerfilMM('Tubular redondo 3/4" cal. 18').mm).toBeCloseTo(Math.PI * 19.05, 3);
    expect(perimetroPerfilMM('Tubular redondo 3/4" cal. 18').perfil).toBe('Ø3/4"');
    expect(perimetroPerfilMM('Tubular cuadrado 3/4" cal. 18').mm).toBeCloseTo(4 * 19.05, 3);
    expect(perimetroPerfilMM('PTR 3" x 1 1/2" cal. 14').mm).toBeCloseTo(2 * (3 + 1.5) * 25.4, 3);
  });
});

describe('VH-165 · la soldadura no es un perfil de acero', () => {
  it('familia propia: no se auto-asigna al PTR ni suma área al acabado', () => {
    expect(familiaDeMaterial('soldadura para tubo')).toBe('soldadura');
    expect(familiaDeMaterial('Soldadura base tubular')).toBe('soldadura');
    const c = aplicarPoliticaMaterial({ nombre: 'Soldadura base tubular', insumoId: 'soldadura', material_solicitado: 'soldadura para tubo', material_match: 'EXACT', forma: 'pieza', cantidad: 1 }, (id) => insumos[id], catalogo);
    expect(c.insumoId || '').not.toMatch(/^ptr|^tub/);
    expect(c.candidate_insumo_id || '').not.toMatch(/^ptr|^tub/);
  });
  it('mesa de centro V4: EcoCrom = 0.43 m² aunque la IA traiga la soldadura', () => {
    const r = conAcompanantes(mapIaComps({ piezas: [
      { nombre: 'Marcos (tubo redondo 3/4)', insumoId: 'tubular-redondo-34', material_solicitado: 'tubular redondo 3/4 cal. 18', material_match: 'EXACT', forma: 'lineal', largoMM: 5600, cantidad: 1 },
      { nombre: 'Postes verticales de base', insumoId: 'tubular-redondo-34', material_solicitado: 'tubular redondo 3/4 cal. 18', material_match: 'EXACT', forma: 'lineal', largoMM: 1568, cantidad: 1 },
      { nombre: 'Acabado cromado de base (EcoCrom)', insumoId: 'ecocrom', material_solicitado: 'cromado (EcoCrom) en base tubular', material_match: 'EXACT', forma: 'area', largoMM: 1000, anchoMM: 0, cantidad: 1 },
      { nombre: 'Soldadura base tubular', insumoId: 'soldadura', material_solicitado: 'soldadura para tubo', material_match: 'EXACT', forma: 'pieza', cantidad: 1 },
    ] }, insumos), insumos);
    expect(r.find((c) => /cromado/i.test(c.nombre)).cantidad).toBeCloseTo(0.43, 2);
    expect(r.find((c) => /soldadura/i.test(c.nombre)).insumoId || '').not.toMatch(/^ptr|^tub/);
  });
});

describe('VH-168 · el formato de hoja es identidad del tablero', () => {
  const cur4x8 = { id: 'melamina-28-walnut', nombre: 'Melamina 28 mm, Walnut', unidad: 'hoja', formato: { tipo: 'tablero', largoMM: 2440, anchoMM: 1220, medida: 2.977 } };
  const erp5x8 = { id: 'erp-ame28152-b709', nombre: 'AGLOMERADO MELAMINA DOS CARAS HOJA 5 X 8 ESPESOR 28 mm -- AME28152 · ACABADO MADERA WALNUT', unidad: 'hoja', formato: null };
  const pol = (sol, ins) => aplicarPoliticaMaterial({ nombre: 'Entrepaños', insumoId: ins.id, material_solicitado: sol, material_match: 'EXACT' }, (id) => (id === ins.id ? ins : null), [ins]);
  it('pedido 5×8 contra curado 4×8: no es EXACT, es diferencia que exige confirmación', () => {
    for (const sol of ['Aglomerado melamina dos caras 28 mm acabado Walnut, hoja 5 x 8', 'melamina 28 mm walnut 5×8 (1525 × 2440)', 'melamina 28 mm walnut hoja 1.525 x 2.44 m']) {
      const p = pol(sol, cur4x8);
      expect(p.material_match).not.toBe('EXACT');
      expect(p._match?.cambio || '').toMatch(/hoja 5×8 → candidato hoja 4×8/);
      expect(difiereDeLoPedido(p._match?.cambio)).toBe(true);
    }
  });
  it('pedido 5×8 contra el ERP 5×8 (formato sólo en el nombre): sigue siendo exacto', () => {
    expect(pol('Aglomerado melamina 28 mm Walnut, hoja 5 x 8', erp5x8).material_match).toBe('EXACT');
  });
  it('si lo pedido no dice formato, no se inventa diferencia (ausencia no es diferencia)', () => {
    expect(pol('Aglomerado melamina dos caras 28 mm acabado Walnut', cur4x8).material_match).toBe('EXACT');
  });
  it('PTR 1" x 2" no se lee como formato de hoja', () => {
    expect(formatoHojaDe('PTR 1" x 2" cal. 16')).toBeNull();
    expect(formatoHojaDe('Lámina cal. 18 hoja 4 x 8')).toEqual([1220, 2440]);
    expect(formatoHojaDe('lámina 3 x 10 cal 12')).toEqual([914, 3048]);
  });
});

describe('VH-169 · librero 5×8: zoclo sólo en gabinete bajo y tapacanto sin duplicar', () => {
  const librero = () => [
    { nombre: 'Laterales', insumoId: 'melamina-28-walnut', largoMM: 1800, anchoMM: 350, piezas: 2, cantidad: 1 },
    { nombre: 'Piso y techo', insumoId: 'melamina-28-walnut', largoMM: 844, anchoMM: 350, piezas: 2, cantidad: 1 },
    { nombre: 'Entrepaños fijos', insumoId: 'melamina-28-walnut', largoMM: 844, anchoMM: 330, piezas: 4, cantidad: 1 },
    { nombre: 'Respaldo', insumoId: 'melamina-16-walnut', largoMM: 1800, anchoMM: 900, piezas: 1, cantidad: 1 },
    { nombre: 'Tapacanto PVC 2 mm Walnut, cantos frontales de laterales', insumoId: 'tapacanto', material_solicitado: 'Tapacanto PVC 2 mm Walnut', cantidad: 3.6, forma: 'lineal' },
    { nombre: 'Tapacanto PVC 2 mm Walnut, frente piso/techo/entrepaños', insumoId: 'tapacanto', material_solicitado: 'Tapacanto PVC 2 mm Walnut', cantidad: 5.064, forma: 'lineal' },
    { nombre: 'Niveladores', insumoId: 'nivelador', cantidad: 4 },
  ];
  it('un librero de 1800 mm no recibe zoclo; una credenza baja sí, con el largo de la cubierta', () => {
    expect(conAcompanantes(librero(), insumos).some((c) => c._regla === 'zoclo')).toBe(false);
    const credenza = [
      { nombre: 'Laterales', insumoId: 'mdf', largoMM: 650, anchoMM: 450, piezas: 2, cantidad: 1 },
      { nombre: 'Cubierta', insumoId: 'mdf', largoMM: 1800, anchoMM: 450, piezas: 1, cantidad: 1 },
      { nombre: 'Puertas', insumoId: 'mdf', largoMM: 630, anchoMM: 580, piezas: 3, cantidad: 1 },
    ];
    const z = conAcompanantes(credenza, insumos).find((c) => c._regla === 'zoclo');
    expect(z && z.largoMM).toBe(1800);
  });
  it('"cantos frontales": un canto por pieza = 8.66 m; el segundo renglón queda excluido y visible', () => {
    const r = conAcompanantes(librero(), insumos);
    const tapas = r.filter((c) => c.insumoId === 'tapacanto');
    expect(tapas).toHaveLength(2);
    const vivo = tapas.filter((c) => !c.excluida);
    expect(vivo).toHaveLength(1);
    expect(vivo[0].cantidad).toBeCloseTo(2 * 1.8 + 2 * 0.844 + 4 * 0.844, 2);
    const fuera = tapas.find((c) => c.excluida);
    expect(fuera._regla).toBe('tapacanto_duplicado'); expect(fuera.iaNota).toMatch(/no contarlo dos veces/);
  });
});

describe('VH-169b · un escritorio con cajonera comprada no es gabinete', () => {
  it('sin zoclo en el escritorio en L; con zoclo si las gavetas son fabricadas en un gabinete bajo', () => {
    const escritorio = [
      { nombre: 'Cubierta principal', insumoId: 'melamina-19-gris-humo-lm', largoMM: 1600, anchoMM: 700, piezas: 1, cantidad: 1 },
      { nombre: 'Panel lateral 731x700', insumoId: 'melamina-19-gris-humo-lm', largoMM: 731, anchoMM: 700, piezas: 2, cantidad: 1 },
      { nombre: 'Faldón', insumoId: 'melamina-19-gris-humo-lm', largoMM: 1500, anchoMM: 300, piezas: 1, cantidad: 1 },
      { nombre: 'Cajonera móvil 3 gavetas (comprada)', insumoId: 'cajonera-movil', cantidad: 1 },
    ];
    expect(conAcompanantes(escritorio, insumos).some((c) => c._regla === 'zoclo')).toBe(false);
    const cajonero = [
      { nombre: 'Laterales', insumoId: 'mdf', largoMM: 700, anchoMM: 450, piezas: 2, cantidad: 1 },
      { nombre: 'Cubierta', insumoId: 'mdf', largoMM: 500, anchoMM: 450, piezas: 1, cantidad: 1 },
      { nombre: 'Frentes de gaveta', insumoId: 'mdf', largoMM: 480, anchoMM: 200, piezas: 3, cantidad: 1 },
    ];
    expect(conAcompanantes(cajonero, insumos).some((c) => c._regla === 'zoclo')).toBe(true);
  });
});

describe('VH-170 · tapacanto duplicado: idempotente entre pasadas', () => {
  const mesa = () => [
    { nombre: 'Cubierta 2400×1200', insumoId: 'melamina-28-walnut', largoMM: 2400, anchoMM: 1200, piezas: 1, cantidad: 1 },
    { nombre: 'Tapacanto PVC 2 mm Walnut perímetro cubierta', insumoId: 'tapacanto', material_solicitado: 'Tapacanto PVC 2 mm Walnut', cantidad: 7.2 },
    { nombre: 'Panel lateral base 722×1000', insumoId: 'melamina-28-walnut', largoMM: 1000, anchoMM: 722, piezas: 2, cantidad: 1 },
    { nombre: 'Faldón central 2000×300', insumoId: 'melamina-19-walnut', largoMM: 2000, anchoMM: 300, piezas: 1, cantidad: 1 },
    { nombre: 'Tapacanto PVC paneles base y faldón', insumoId: 'tapacanto', material_solicitado: 'Tapacanto PVC', cantidad: 12 },
  ];
  it('1ª pasada: un renglón vivo por geometría (15.24 m) y el otro excluido', () => {
    const r = conAcompanantes(mesa(), insumos);
    const vivos = r.filter((c) => c.insumoId === 'tapacanto' && !c.excluida);
    expect(vivos).toHaveLength(1); expect(vivos[0].cantidad).toBeCloseTo(15.24, 2);
    expect(r.filter((c) => c.insumoId === 'tapacanto' && c.excluida)).toHaveLength(1);
    expect(Object.keys(r).some((k) => k === '-1')).toBe(false);
  });
  it('2ª pasada con la IA proponiendo otra vez el duplicado: sigue un solo renglón vivo', () => {
    const r1 = conAcompanantes(mesa(), insumos);
    const reanalisis = [...r1.filter((c) => !c.excluida), { nombre: 'Tapacanto PVC paneles base y faldón', insumoId: 'tapacanto', material_solicitado: 'Tapacanto PVC', cantidad: 12 }];
    const r2 = conAcompanantes(reanalisis, insumos);
    expect(r2.filter((c) => c.insumoId === 'tapacanto' && !c.excluida)).toHaveLength(1);
  });
});

describe('VH-174 · las reglas de casa se re-aplican después del amarre ERP (idempotentes)', () => {
  it('un renglón "Canto de paneles…" sin material que luego se amarra a tapacanto queda excluido; dos pasadas no cambian nada', () => {
    const base = [
      { nombre: 'Cubierta 2400×1200', insumoId: 'melamina-28-walnut', cantidad: 1, piezas: 1, largoMM: 2400, anchoMM: 1200 },
      { nombre: 'Panel lateral base 722×1000', insumoId: 'melamina-28-walnut', cantidad: 1, piezas: 2, largoMM: 1000, anchoMM: 722 },
      { nombre: 'Faldón central 2000×300', insumoId: 'melamina-19-walnut', cantidad: 1, piezas: 1, largoMM: 2000, anchoMM: 300 },
      { nombre: 'Tapacanto PVC 2 mm Walnut perímetro cubierta', insumoId: 'tapacanto', cantidad: 7.2 },
      { nombre: 'Canto de paneles de base (laterales y faldón)', insumoId: '', material_solicitado: 'canto de paneles', cantidad: 12 },
    ];
    const r1 = conAcompanantes(base, insumos);
    expect(r1.find((c) => /Canto de paneles/.test(c.nombre)).excluida).toBeFalsy();   // aún no es tapacanto
    const amarrado = r1.map((c) => (/Canto de paneles/.test(c.nombre) ? { ...c, insumoId: 'tapacanto' } : c));
    const r2 = conAcompanantes(amarrado, insumos);
    expect(r2.find((c) => /Canto de paneles/.test(c.nombre)).excluida).toBe(true);
    expect(r2.filter((c) => c.insumoId === 'tapacanto' && !c.excluida).map((c) => c.cantidad)).toEqual([15.24]);
    expect(conAcompanantes(r2, insumos)).toEqual(r2);   // idempotente
  });
});
