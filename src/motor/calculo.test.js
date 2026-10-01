import { describe, it, expect } from 'vitest';
import {
  comprar,
  calcular,
  piezasPorTablero,
  precioDe,
  calcularCostoHora,
  netoComponente,
  costoNetoComponente,
  PARAMETROS_DEFAULT,
  modeloParaPieza,
  componentesSinMaterial,
} from './calculo.js';

// ---------------------------------------------------------------------------
//  Insumos de prueba
// ---------------------------------------------------------------------------
const melamina = {
  id: 'melamina-19',
  nombre: 'Melamina 19 mm',
  clase: 'directa',
  precio: 320,
  mermaCorte: 6,
  formato: { tipo: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 },
};

const ptr = {
  id: 'ptr',
  nombre: 'Tubo / PTR',
  clase: 'directa',
  precio: 42,
  mermaCorte: 5,
  formato: { tipo: 'tramo', medida: 6 },
};

const tapacanto = {
  id: 'tapacanto',
  nombre: 'Tapacanto',
  clase: 'directa',
  precio: 10,
  mermaCorte: 4,
  inventario: true,
  formato: { tipo: 'rollo', medida: 50 },
};

const corredera = {
  id: 'corredera',
  nombre: 'Corredera',
  clase: 'indirecta',
  precio: 95,
  mermaCorte: 0,
};

const INSUMOS = {
  'melamina-19': melamina,
  ptr,
  tapacanto,
  corredera,
};

// ---------------------------------------------------------------------------
//  Piezas de prueba
// ---------------------------------------------------------------------------
// Escritorio App LT. La cubierta (1.30 m2 neta) esta calibrada para que la
// 7a pieza abra un tablero nuevo: es el escalon de lote del master (6.8).
const escritorioAppLT = {
  id: 'escritorio-app-lt-160',
  nombre: 'Escritorio App LT 1.60 x 0.70',
  componentes: [
    { insumoId: 'melamina-19', nombre: 'Cubierta', cantidad: 1.30 },
    { insumoId: 'corredera', nombre: 'Correderas cajonera', cantidad: 2 },
  ],
  horas: { pm: 4.77, pintura: 0.04, acabados: 0.61, carpinteria: 0.94, tapiceria: 0 },
  modoManoObra: 'horas',
  preparacionHoras: 0,
};

// Eclipse Cantilever: 72.17 h medidas, casi todo carpinteria. Revienta el %.
const eclipseCantilever = {
  id: 'eclipse-cantilever',
  nombre: 'Eclipse Cantilever',
  componentes: [
    { insumoId: 'melamina-19', nombre: 'Cubierta chapa', cantidad: 2.2 },
    { insumoId: 'corredera', nombre: 'Correderas', cantidad: 4 },
  ],
  horas: { pm: 0.68, pintura: 0.04, acabados: 0.20, carpinteria: 67.51, tapiceria: 3.74 },
  modoManoObra: 'horas',
  preparacionHoras: 0,
};

// ===========================================================================
//  LAS 12 PRUEBAS DEL MASTER (seccion 10)
// ===========================================================================

// 1. Compra por formato
describe('1. Compra por formato completo', () => {
  it('no existe medio tablero', () => {
    expect(comprar(melamina, 3.22, 1).unidades).toBe(2);
    expect(comprar(melamina, 3.22, 1).comprado).toBeCloseTo(5.9536, 4);
  });
  it('PTR en tramos de 6 m', () => {
    expect(comprar(ptr, 6.02, 1).unidades).toBe(2);
  });
});

// 2. Inventario no redondea
describe('2. Inventario no redondea', () => {
  it('el sobrante se guarda', () => {
    expect(comprar(tapacanto, 11.43, 1).unidades).toBeNull();
  });
});

// 3. Escalones de lote - el costo por pieza SUBE de 6 a 7
describe('3. Escalones de lote', () => {
  it('la 7a pieza abre tablero nuevo y sube el costo unitario', () => {
    const c6 = calcular(escritorioAppLT, 6, INSUMOS);
    const c7 = calcular(escritorioAppLT, 7, INSUMOS);
    expect(c7.costoUnitario).toBeGreaterThan(c6.costoUnitario);
  });
});

// 4. Acomodo en tablero
describe('4. Acomodo en tablero (rejilla)', () => {
  it('1.60 x 0.70 -> 1 pieza (62% merma)', () => {
    expect(piezasPorTablero(1600, 700)).toBe(1);
  });
  it('1.20 x 0.60 -> 4 piezas (3% merma)', () => {
    expect(piezasPorTablero(1200, 600)).toBe(4);
  });
  it('3.00 x 0.90 -> no cabe', () => {
    expect(piezasPorTablero(3000, 900)).toBe(0);
  });
});

// 5. La veta reduce el acomodo
describe('5. La veta reduce el acomodo', () => {
  it('con veta caben menos o igual', () => {
    expect(piezasPorTablero(1600, 700, { veta: true })).toBeLessThanOrEqual(
      piezasPorTablero(1600, 700, { veta: false })
    );
  });
});

// 6. Directa e indirecta no se mezclan
describe('6. Directa + indirecta = total', () => {
  it('las clases suman el material total', () => {
    const r = calcular(escritorioAppLT, 1, INSUMOS);
    expect(r.materialDirecto + r.materialIndirecto).toBeCloseTo(r.materialTotal, 6);
  });
});

// 7. Los dos modos de mano de obra coinciden con el factor equivalente
describe('7. Puente entre modos de mano de obra', () => {
  it('por horas y por porcentaje coinciden usando el factor equivalente', () => {
    const porHoras = calcular({ ...escritorioAppLT, modoManoObra: 'horas' }, 1, INSUMOS);
    const porPct = calcular(
      {
        ...escritorioAppLT,
        modoManoObra: 'porcentaje',
        factorDirecta: porHoras.factorEquivalente,
        factorIndirecta: PARAMETROS_DEFAULT.factorManoObraIndirecta,
      },
      1,
      INSUMOS
    );
    expect(Math.abs(porHoras.manoObra - porPct.manoObra)).toBeLessThan(1);
  });
});

// 8. El Eclipse revienta el porcentaje
describe('8. El Eclipse revienta el porcentaje', () => {
  it('factor equivalente arriba de 99%', () => {
    expect(calcular(eclipseCantilever, 1, INSUMOS).factorEquivalente).toBeGreaterThan(99);
  });
});

// 9. Los indirectos van sobre material DIRECTO
describe('9. Indirectos de fabrica sobre material directo', () => {
  it('indirectos = material directo * 34%', () => {
    const r = calcular(escritorioAppLT, 1, INSUMOS);
    expect(r.indirectosFabrica).toBeCloseTo(r.materialDirecto * 0.34, 6);
  });
});

// 10. El margen es sobre precio, no sobre costo
describe('10. Margen sobre precio', () => {
  it('1000 al 30% -> 1428.57', () => {
    expect(precioDe(1000, 30)).toBeCloseTo(1428.57, 2);
  });
});

// 11. Preparacion se reparte entre el lote
describe('11. Preparacion se reparte entre el lote', () => {
  it('cuesta mas por pieza en lote de 1 que de 20', () => {
    const c1 = calcular({ ...escritorioAppLT, preparacionHoras: 8 }, 1, INSUMOS);
    const c20 = calcular({ ...escritorioAppLT, preparacionHoras: 8 }, 20, INSUMOS);
    expect(c1.costoUnitario).toBeGreaterThan(c20.costoUnitario);
  });
});

// 12. Cero no truena
describe('12. Cero no truena', () => {
  it('pieza sin componentes cuesta 0', () => {
    expect(calcular({ componentes: [] }, 1, INSUMOS).costoUnitario).toBe(0);
  });
});

// 13. El retazo: una pieza chica del mismo material cae en el sobrante y NO
//     compra su propio tablero.
describe('13. El faldon cae en el retazo de la cubierta', () => {
  const cubierta = { insumoId: 'melamina-19', nombre: 'Cubierta', cantidad: 1.12, largoMM: 1600, anchoMM: 700, piezas: 1 };
  const faldon = { insumoId: 'melamina-19', nombre: 'Faldon', cantidad: 0.32 };
  it('cubierta sola compra 1 tablero', () => {
    const r = calcular({ componentes: [cubierta], modoManoObra: 'porcentaje' }, 1, INSUMOS);
    expect(r.detalleInsumos[0].unidades).toBe(1);
  });
  it('cubierta + faldon del mismo material siguen siendo 1 tablero', () => {
    const r = calcular({ componentes: [cubierta, faldon], modoManoObra: 'porcentaje' }, 1, INSUMOS);
    const melamina = r.detalleInsumos.find((d) => d.insumoId === 'melamina-19');
    expect(melamina.unidades).toBe(1);
  });
});

// 14. La rejilla: las piezas grandes no cruzan tablero. 6 cubiertas de 1.60x0.70
//     necesitan 6 tableros (1 por pieza), no 3 por area.
describe('14. Piezas grandes no cruzan tablero', () => {
  const cubierta = { insumoId: 'melamina-19', nombre: 'Cubierta', cantidad: 1.12, largoMM: 1600, anchoMM: 700, piezas: 1 };
  it('6 cubiertas de 1.60x0.70 = 6 tableros', () => {
    const r = calcular({ componentes: [cubierta], modoManoObra: 'porcentaje' }, 6, INSUMOS);
    expect(r.detalleInsumos[0].unidades).toBe(6);
  });
});

// 15. Costeo por FRACCION de hoja (rendimiento sobre el aprovechamiento).
//     El insumo con fraccion:true NO compra hoja entera: cobra la fraccion
//     consumida ajustada por el aprovechamiento (Rodrigo 2026-08-12).
describe('15. Fraccion de hoja (aprovechamiento)', () => {
  const melaminaHoja = {
    id: 'melamina-hoja', clase: 'directa', precio: 950, unidad: 'hoja',
    fraccion: true, formato: { tipo: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 },
  };
  const INS = { 'melamina-hoja': melaminaHoja };
  const pieza = { componentes: [{ insumoId: 'melamina-hoja', nombre: 'Cubierta', cantidad: 1.0 }], modoManoObra: 'porcentaje' };

  it('cobra la fraccion, no la hoja entera', () => {
    const r = calcular(pieza, 1, INS); // aprovechamiento default 80%
    // 1.0 m2 / (2.9768 m2 * 0.80) = 0.4199 hoja
    expect(r.detalleInsumos[0].unidades).toBeCloseTo(0.4199, 3);
    expect(r.detalleInsumos[0].costo).toBeCloseTo(0.4199 * 950, 0);
    expect(r.materialDirecto).toBeLessThan(950); // NO compra hoja entera
  });
  it('mejor aprovechamiento => menor costo', () => {
    const c80 = calcular(pieza, 1, INS, { aprovechamientoCorte: 80 }).materialDirecto;
    const c90 = calcular(pieza, 1, INS, { aprovechamientoCorte: 90 }).materialDirecto;
    expect(c90).toBeLessThan(c80);
  });
  it('una pieza chica no dispara una hoja completa', () => {
    const chica = { componentes: [{ insumoId: 'melamina-hoja', nombre: 'Ceja', cantidad: 0.1 }], modoManoObra: 'porcentaje' };
    expect(calcular(chica, 1, INS).materialDirecto).toBeLessThan(60);
  });

});

// FRACCION DE HOJA DIRECTA (Rafa §1, 2026-09-23). El estimador captura "0.8 de
// hoja cal 10" (comp.hojas) igual que el T.D.C. real, en vez de nestear
// rectangulos —imposible de acertar en metal irregular, que inflaba la merma
// (banca aeropuerto: 73.7% de merma falsa). Costo = fraccion x precio_hoja, sin
// merma inventada, sin tocar las lineas que usan lamina en kg.
describe('16. Fracción de hoja directa (comp.hojas)', () => {
  const cal10 = {
    id: 'lam10', clase: 'directa', precio: 2016.8, unidad: 'hoja',
    fraccion: true, formato: { tipo: 'lamina', corto: 'cal10', medida: 79.9 },
  };
  const INS = { lam10: cal10 };

  it('0.8 de hoja = 0.8 x precio_hoja, exacto, con CERO desperdicio', () => {
    const pieza = { componentes: [{ insumoId: 'lam10', nombre: 'Asiento', hojas: 0.8 }], modoManoObra: 'porcentaje' };
    const r = calcular(pieza, 1, INS);
    expect(r.detalleInsumos[0].costo).toBeCloseTo(0.8 * 2016.8, 2); // 1613.44
    expect(r.detalleInsumos[0].desperdicio).toBe(0);
    expect(r.materialTotal).toBeCloseTo(1613.44, 2);
  });

  it('el kg crudo de las líneas (cantidad) sigue intacto', () => {
    const pieza = { componentes: [{ insumoId: 'lam10', nombre: 'Est.', cantidad: 40 }], modoManoObra: 'porcentaje' };
    const r = calcular(pieza, 1, INS); // 40 kg / (79.9 kg/hoja x 0.8 aprov) x precio
    expect(r.detalleInsumos[0].costo).toBeGreaterThan(0);
    expect(r.detalleInsumos[0].fraccion).toBe(true);
  });

  it('escala con el lote: 2 piezas = doble hojas y doble costo', () => {
    const pieza = { componentes: [{ insumoId: 'lam10', nombre: 'Asiento', hojas: 0.8 }], modoManoObra: 'porcentaje' };
    const r1 = calcular(pieza, 1, INS);
    const r2 = calcular(pieza, 2, INS);
    expect(r2.materialTotal).toBeCloseTo(r1.materialTotal * 2, 2);
  });
});

// MO NO sobre lo comprado (Rafa/Rodrigo, 2026-09-23). Lo que Von Haucke compra
// ya hecho y solo instala (electrico, guardas armadas, EcoAcustic) no lleva
// mano de obra de fabricacion. Pintura/tela/tapiceria SI la llevan.
describe('17. Mano de obra no se cobra sobre lo comprado', () => {
  const INS = {
    metal:   { id: 'metal', nombre: 'Metal', clase: 'directa', seccion: 'metal', precio: 100, unidad: 'kg' },
    bari:    { id: 'bari', nombre: 'Bari', clase: 'indirecta', seccion: 'electrico', precio: 887, unidad: 'pza' },
    pintura: { id: 'pintura', nombre: 'Pintura', clase: 'indirecta', seccion: 'acabados', precio: 200, unidad: 'kg' },
  };

  it('un componente eléctrico comprado no suma mano de obra', () => {
    const pieza = {
      modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12,
      componentes: [
        { insumoId: 'metal', cantidad: 50 },   // $5000 fabricado -> 55% = 2750
        { insumoId: 'bari', cantidad: 2 },      // $1774 comprado -> 0
        { insumoId: 'pintura', cantidad: 1 },   // $200 acabado -> 12% = 24
      ],
    };
    expect(calcular(pieza, 1, INS).manoObra).toBeCloseTo(2750 + 24, 2);
  });

  it('sin el eléctrico, la MO no cambia (era 0 de todos modos)', () => {
    const con = calcular({ modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12,
      componentes: [{ insumoId: 'metal', cantidad: 50 }, { insumoId: 'bari', cantidad: 2 }] }, 1, INS);
    const sin = calcular({ modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12,
      componentes: [{ insumoId: 'metal', cantidad: 50 }] }, 1, INS);
    expect(con.manoObra).toBeCloseTo(sin.manoObra, 2);
  });
});

// ===========================================================================
//  Comprobaciones extra: numeros reales del master (1.2 y 1.3)
// ===========================================================================
describe('Comprobaciones contra los numeros reales del master', () => {
  // La nómina real YA NO vive en PARAMETROS_DEFAULT: iba como literal y Vite la
  // publicaba dentro del HTML público (auditoría 2026-08-16). Ahora la carga
  // Dirección desde la bóveda. La comprobación del master sigue viva, pero con
  // los números como DATO DE PRUEBA — este archivo no entra al paquete que se
  // publica, así que aquí no se filtran.
  it('el costo hora de taller da 40.60 con la nómina del master (1.2)', () => {
    const nominaDelMaster = {
      ...PARAMETROS_DEFAULT,
      nominaSemanalTotal: 423660, nominaSemanalDirecta: 215167,
      personasTotal: 183, operativos: 138,
    };
    const { horaNominal, horaTaller } = calcularCostoHora(nominaDelMaster);
    expect(horaNominal).toBeCloseTo(32.48, 2);
    expect(horaTaller).toBeCloseTo(40.60, 2);
  });

  it('la nómina NO viaja en el paquete público', () => {
    // Si alguien vuelve a escribir un número real en PARAMETROS_DEFAULT, se
    // publica en dist/index.html sin que nadie lo note. Esta prueba lo caza.
    for (const k of ['nominaSemanalTotal', 'nominaSemanalDirecta', 'personasTotal', 'operativos']) {
      expect(PARAMETROS_DEFAULT[k]).toBe(0);
    }
  });
  it('la mano de obra del App LT (6.36 h) da ~258 (1.3)', () => {
    const r = calcular(escritorioAppLT, 1, INSUMOS);
    expect(r.manoObra).toBeCloseTo(258, 0);
  });
});

// ===========================================================================
//  LA FORMULA DE ALBA, ENCHUFADA (2026-08-18) — motor/formulaAlba.js
//  Sin horas medidas y sin factores fijados a mano (el caso de ESTIMACION,
//  que es el de Alba), el modo clasico ya no usa 17%/12%/34% planos: usa
//  MO%+GI por tipo de material. formulaAlba.test.js ya prueba la formula
//  PURA contra el T.D.C. real; esto prueba el ENCHUFE — que calcular()
//  llega al mismo numero — y que horas medidas / factores a mano siguen
//  intactos (no los toca la formula de Alba).
// ===========================================================================
describe('La formula de Alba enchufada en calcular() (sin horas, sin factores fijos)', () => {
  // Insumo sintetico a $1/unidad: 'cantidad' ES el costo de material, para
  // comparar centavo a centavo contra los renglones reales del T.D.C.
  const INS_ALBA = {
    'x-cubierta': { id: 'x-cubierta', nombre: 'Cubierta melamina', seccion: 'cubiertas', clase: 'directa', precio: 1 },
    'x-metal': { id: 'x-metal', nombre: 'Estructura metalica', seccion: 'metal', clase: 'directa', precio: 1 },
    'x-cristal': { id: 'x-cristal', nombre: 'Biombo de cristal', seccion: 'mamparas', clase: 'directa', precio: 1 },
  };
  const piezaDe = (insumoId, material) => ({
    componentes: [{ insumoId, nombre: 'Pieza', cantidad: material }],
    modoManoObra: 'porcentaje',
  });

  it('cubierta ATCUBS44ABS: mat 381.84 -> MO 57.28, GI 171.84, fab 610.96 (15% MO)', () => {
    const r = calcular(piezaDe('x-cubierta', 381.84), 1, INS_ALBA);
    expect(r.manoObra).toBeCloseTo(57.28, 1);
    expect(r.indirectosFabrica).toBeCloseTo(171.84, 1);
    expect(r.costoFabricacion).toBeCloseTo(610.96, 1);
  });

  it('metal ATOM3: mat 46.67 -> MO 9.33, GI 27.99, fab 83.99 (20% MO, GI 3xMO)', () => {
    const r = calcular(piezaDe('x-metal', 46.67), 1, INS_ALBA);
    expect(r.manoObra).toBeCloseTo(9.33, 1);
    expect(r.indirectosFabrica).toBeCloseTo(27.99, 1);
    expect(r.costoFabricacion).toBeCloseTo(83.99, 1);
  });

  it('cristal ATBIOCRT4: mat 717.67 -> MO 7.18, GI 35.88, fab 760.73 (1% MO, GI 5% mat)', () => {
    const r = calcular(piezaDe('x-cristal', 717.67), 1, INS_ALBA);
    expect(r.manoObra).toBeCloseTo(7.18, 1);
    expect(r.indirectosFabrica).toBeCloseTo(35.88, 1);
    expect(r.costoFabricacion).toBeCloseTo(760.73, 1);
  });

  it('con horas medidas, sigue el 34% viejo — Alba es solo para estimacion sin horas', () => {
    const pieza = {
      componentes: [{ insumoId: 'x-metal', nombre: 'Pieza', cantidad: 1000 }],
      modoManoObra: 'horas',
      horas: { pm: 1, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0, otros: 0 },
    };
    const r = calcular(pieza, 1, INS_ALBA);
    expect(r.indirectosFabrica).toBeCloseTo(1000 * 0.34, 6);
  });

  it('con factores fijados a mano (el puente 6.4), sigue la formula vieja', () => {
    const pieza = {
      componentes: [{ insumoId: 'x-metal', nombre: 'Pieza', cantidad: 1000 }],
      modoManoObra: 'porcentaje', factorDirecta: 17, factorIndirecta: 12,
    };
    const r = calcular(pieza, 1, INS_ALBA);
    expect(r.manoObra).toBeCloseTo(170, 6);           // 17% de 1000, formula vieja
    expect(r.indirectosFabrica).toBeCloseTo(340, 6);  // 34% viejo tambien
  });
});

// ===========================================================================
//  LA FRACCION DE HOJA ES EL ACOMODO REAL, NO UN % SUPUESTO (2026-08-18)
//  Cazado validando contra el T.D.C. de Alba: una pieza con MEDIDA conocida
//  cobra la fraccion del acomodo en rejilla (piezasPorTablero, prueba 4), no
//  el area entre (hoja x 80% de aprovechamiento). Antes de este fix, la
//  cubierta de Alba (1.20x0.60, 4 por tablero) se cobraba a 0.30 de hoja en
//  vez de 0.25 — que es justo lo que trae su explosivo real.
// ===========================================================================
describe('La fraccion de hoja usa el acomodo real cuando la pieza trae medida', () => {
  const melaminaHoja = {
    id: 'melamina-hoja', clase: 'directa', precio: 1000, unidad: 'hoja',
    fraccion: true, formato: { tipo: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 },
  };
  const INS = { 'melamina-hoja': melaminaHoja };

  it('1.20 x 0.60 (4 por tablero) cobra 0.25 de hoja, no 0.30 (80% generico)', () => {
    const pieza = {
      componentes: [{ insumoId: 'melamina-hoja', nombre: 'Cubierta', largoMM: 1200, anchoMM: 600, piezas: 1 }],
      modoManoObra: 'porcentaje',
    };
    const r = calcular(pieza, 1, INS);
    expect(r.detalleInsumos[0].unidades).toBeCloseTo(0.25, 4);
    expect(r.materialDirecto).toBeCloseTo(250, 2); // 0.25 x 1000
  });

  it('una pieza SIN medida sigue con el % de aprovechamiento generico (sin cambios)', () => {
    const pieza = { componentes: [{ insumoId: 'melamina-hoja', nombre: 'Retazo', cantidad: 1.0 }], modoManoObra: 'porcentaje' };
    const r = calcular(pieza, 1, INS);
    // 1.0 m2 / (2.9768 m2 x 80% aprovechamiento) = 0.4199 hoja — el comportamiento de siempre.
    expect(r.detalleInsumos[0].unidades).toBeCloseTo(0.4199, 3);
  });
});

// ---------------------------------------------------------------------------
//  NADA NEGATIVO LLEGA A SER DINERO
//  El caso real: en el Asistente especial, `-500` en el largo de una cubierta
//  daba "Precio de lista $-636", sin aviso y con el botón de cotizar encendido.
//  El `min="0"` del <input type=number> NO impide teclear, y hay ~30 campos así
//  en 5 pantallas: por eso se guarda el EMBUDO, no cada campo.
// ---------------------------------------------------------------------------
describe('nada negativo llega a ser dinero', () => {
  const cubierta = { nombre: 'Cubierta', insumoId: 'melamina-19', largoMM: 1500, anchoMM: 600, piezas: 1 };

  it('un largo negativo NO produce área negativa', () => {
    expect(netoComponente({ ...cubierta, largoMM: -500 })).toBe(0);
    expect(netoComponente({ ...cubierta, anchoMM: -600 })).toBe(0);
  });

  it('un largo negativo NO produce COSTO negativo — que es lo que se veía', () => {
    const costo = costoNetoComponente({ ...cubierta, largoMM: -500 }, melamina);
    expect(costo).toBe(0);
    expect(costo).toBeGreaterThanOrEqual(0);
  });

  it('unas piezas negativas tampoco', () => {
    expect(netoComponente({ ...cubierta, piezas: -3 })).toBe(0);
    expect(netoComponente(cubierta, -3)).toBe(0);
  });

  it('una cantidad negativa de insumo suelto tampoco', () => {
    expect(netoComponente({ nombre: 'Bisagra', insumoId: 'x', cantidad: -8 })).toBe(0);
  });

  it('pero lo bueno sigue saliendo igual — esto no es una red que apague todo', () => {
    // 1.5 m × 0.6 m = 0.9 m². Si esta prueba cambia, el arreglo se pasó de listo.
    expect(netoComponente(cubierta)).toBeCloseTo(0.9, 6);
    expect(netoComponente({ ...cubierta, piezas: 2 }, 3)).toBeCloseTo(5.4, 6);
  });
});

// ---------------------------------------------------------------------------
//  modeloParaPieza() — la fusión que antes vivía duplicada en lineas.js y
//  CosteadorLinea.jsx (2026-08-20). No debe inventar nada nuevo, solo
//  reflejar exactamente lo que las dos implementaciones ya hacían.
// ---------------------------------------------------------------------------
describe('modeloParaPieza()', () => {
  const base = { modeloCosteo: 'clasico', margenObjetivo: 50 };

  it('pieza clásica: el mismo objeto de parámetros, sin copiar nada', () => {
    const { par, esIntelisis } = modeloParaPieza(base, { modoManoObra: 'porcentaje' });
    expect(par).toBe(base);
    expect(esIntelisis).toBe(false);
  });

  it('pieza sin modeloCosteo: igual que clásica, sin importar qué diga par.modeloCosteo global', () => {
    const { par, esIntelisis } = modeloParaPieza({ ...base, modeloCosteo: 'intelisis' }, {});
    expect(esIntelisis).toBe(false);
    expect(par.modeloCosteo).toBe('intelisis'); // no se toca lo que ya traía parametrosBase
  });

  it('pieza intelisis: fusiona modeloCosteo, usarCostoPorArea, y las tarifas de parModelo', () => {
    const parModelo = { costoHoraArea: { carpinteria: 54.55 }, costoHoraGIF: { carpinteria: 190.82 }, utilidadPct: 20 };
    const { par, esIntelisis } = modeloParaPieza(base, { modeloCosteo: 'intelisis', parModelo });
    expect(esIntelisis).toBe(true);
    expect(par.modeloCosteo).toBe('intelisis');
    expect(par.usarCostoPorArea).toBe(true);
    expect(par.costoHoraArea).toEqual(parModelo.costoHoraArea);
    expect(par.utilidadPct).toBe(20);
    expect(par.margenObjetivo).toBe(50); // lo demás de parametrosBase sigue ahí
  });
});

// Producto NUEVO de cero (estimación pura = fórmula de Alba): bloquea que el
// costeo siga el método real de Vonhaucke — MO 20% del material, indirecto 3×MO,
// costo = material×1.8. Verificado al centavo contra la T.D.C. del copete
// C-CO-516R de Alba (2026-09-30). Si esto cambia, el costeo dejó de cuadrar con Alba.
describe('producto nuevo (fórmula Alba): MO 20% + indirecto 3×MO', () => {
  const insumos = { gen: { id: 'gen', nombre: 'Material generico', seccion: 'general', precio: 100, unidad: 'pza', clase: 'directa' } };
  const pieza = { nombre: 'Mueble nuevo', componentes: [{ insumoId: 'gen', cantidad: 10 }] };

  it('indirecto es exactamente 3× la mano de obra y costo = material×1.8', () => {
    const r = calcular(pieza, 1, insumos);
    expect(r.materialTotal).toBeCloseTo(1000, 2);
    expect(r.manoObra).toBeCloseTo(200, 2);          // 20% del material
    expect(r.indirectosFabrica).toBeCloseTo(600, 2); // 3× la MO
    expect(r.indirectosFabrica).toBeCloseTo(r.manoObra * 3, 6);
    expect(r.costoUnitario).toBeCloseTo(1800, 2);    // material × 1.8
  });
});

describe('piezas sin material (costeo incompleto)', () => {
  const insumos = { 'mdf-16': { id: 'mdf-16', nombre: 'MDF 16 mm', seccion: 'tableros', clase: 'directa', unidad: 'm2', precio: 450, formato: { largo: 2440, ancho: 1220 } } };

  it('componentesSinMaterial lista las piezas cuyo insumo no existe', () => {
    const comps = [
      { nombre: 'Costado', insumoId: 'mdf-16', largoMM: 600, anchoMM: 400, cantidad: 2 },
      { nombre: 'Acometida', insumoId: '', cantidad: 1 },
      { nombre: 'Arnés', insumoId: 'no-existe', cantidad: 1 },
    ];
    expect(componentesSinMaterial(comps, insumos)).toEqual(['Acometida', 'Arnés']);
  });

  it('calcular() reporta componentesIgnorados y NO los suma al costo', () => {
    const comps = [
      { nombre: 'Costado', insumoId: 'mdf-16', largoMM: 600, anchoMM: 400, cantidad: 2 },
      { nombre: 'Acometida', insumoId: '', cantidad: 1 },
    ];
    const r = calcular({ componentes: comps }, 1, insumos);
    expect(r.componentesIgnorados).toEqual(['Acometida']); // la acometida (sin insumo) se reporta, no se suma
  });

  it('un despiece completo no reporta ignorados', () => {
    const comps = [{ nombre: 'Costado', insumoId: 'mdf-16', largoMM: 600, anchoMM: 400, cantidad: 2 }];
    expect(componentesSinMaterial(comps, insumos)).toEqual([]);
    expect(calcular({ componentes: comps }, 1, insumos).componentesIgnorados).toEqual([]);
  });
});
