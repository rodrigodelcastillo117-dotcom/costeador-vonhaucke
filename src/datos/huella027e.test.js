import { describe, it, expect, beforeAll } from 'vitest';
import { footprintDe } from './lineas.js';
import { dimensionesEnNombre, expandirPiezas } from './espacio.js';

// ============================================================================
//  COT-P1-027e · AUTORIDAD DIMENSIONAL (Parte XI §2).
//  Evidencia real (E2E Torre Sur 15:17Z, e2e/evidence/torre-sur-pdf-acomodo-full.json):
//  la pieza "Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha" viajó al solver con
//  w:2100, d:200. Causa: footprintDe() toma como huella la primera pieza del despiece
//  que se llame "tapa" (mayorPor(/tapa/)) y la credenza Eclipse sólo tiene una
//  "Tapa de registro" de L × 200 (eclipse.js:254). El producto declara fondos:[600]
//  (autoridad 1) y el despiece trae "Credenza · piso/techo" 2100 × 600.
// ============================================================================
describe('COT-P1-027e · huella de la credenza Eclipse', () => {
  let costearItem, estado;
  beforeAll(async () => {
    const ln = await import('./lineas.js');
    const ins = await import('./insumos.js');
    const mc = await import('../motor/calculo.js');
    costearItem = ln.costearItem;
    estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
  });

  it('RED→GREEN: costearItem eclipse/credenza 2100 → huella 2100 × 600 (no 200)', () => {
    const c = costearItem(estado, { ruta: 'eclipse', producto: 'credenza', cantidad: 1, seleccion: [{ clave: 'largoMM', valor: '2100' }, { clave: 'mano', valor: 'D' }, { clave: 'finish', valor: 'chapa' }], etiqueta: 'credenza' });
    expect(c).toBeTruthy();
    expect(c.w).toBe(2100);
    expect(c.d).toBe(600);
    expect(c.huellaOrigen).toBe('PRODUCTO');       // autoridad 1: dimensión declarada del producto
    // y lo que viaja al solver (expandirPiezas) conserva esa huella
    const pz = expandirPiezas([{ id: 'c', nombre: c.nombre, cantidad: 1, w: c.w, d: c.d, ruta: 'eclipse' }])[0];
    expect([pz.w, pz.d]).toEqual([2100, 600]);
  });

  it('una "tapa de registro" (L × 200) no es la cubierta: footprintDe toma el cuerpo con fondo creíble', () => {
    const comp = [
      { nombre: 'Credenza · lateral', largoMM: 600, anchoMM: 590 },
      { nombre: 'Credenza · piso/techo', largoMM: 2100, anchoMM: 600 },
      { nombre: 'Tapa de registro', largoMM: 2100, anchoMM: 200 },
    ];
    const fp = footprintDe(comp, 'Eclipse Credenza baja 2.10 × 0.60 m');
    expect([fp.w, fp.d]).toEqual([2100, 600]);
    expect(fp.origen).toBe('DESPIECE_MAYOR');
  });

  it('una cubierta real sí manda (escritorio: "Cubierta de trabajo" 2100 × 900)', () => {
    const comp = [{ nombre: 'Credenza · piso/techo', largoMM: 2100, anchoMM: 600 }, { nombre: 'Cubierta de trabajo', largoMM: 2100, anchoMM: 900 }];
    const fp = footprintDe(comp, 'Eclipse Escritorio Directivo 2.10 m');
    expect([fp.w, fp.d, fp.origen]).toEqual([2100, 900, 'DESPIECE_CUBIERTA']);
  });

  it('autoridad: producto (largoMM × fondoMM) > despiece > nombre; contradicción con el nombre queda marcada, no elegida', () => {
    const comp = [{ nombre: 'Tapa de registro', largoMM: 2100, anchoMM: 200 }];
    const fp = footprintDe(comp, 'Credenza 2.10 × 0.90 m', { config: { largoMM: 2100, fondoMM: 600 }, producto: { fondos: [600] } });
    expect([fp.w, fp.d, fp.origen]).toEqual([2100, 600, 'PRODUCTO']);
    expect(fp.conflicto).toEqual({ nombre: { w: 2100, d: 900 } });
  });

  it('sin despiece ni nombre con medidas → huella DESCONOCIDA (nunca certificada)', () => {
    const fp = footprintDe([], 'Sillón Pac');
    expect(fp.w).toBe(0); expect(fp.d).toBe(0);
    expect(fp.origen).toBe('DESCONOCIDA');
  });
});

describe('COT-P1-027e · dimensionesEnNombre con unidades (m / cm / mm / decimales)', () => {
  it('metros con decimales: "2.10 × 0.60 m" → 2100 × 600', () => {
    expect(dimensionesEnNombre('Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha', 'mueble')).toMatchObject({ w: 2100, d: 600, unidad: 'm', inferido: false });
  });
  it('mesa "1.20 × 1.20" sin unidad pero con decimales → metros INFERIDOS (marcado)', () => {
    expect(dimensionesEnNombre('Mesa de juntas APP LT 1.20 × 1.20', 'mueble')).toMatchObject({ w: 1200, d: 1200, inferido: true });
  });
  it('centímetros: "120 x 75 cm" → 1200 × 750', () => {
    expect(dimensionesEnNombre('Escritorio 120 x 75 cm', 'mueble')).toMatchObject({ w: 1200, d: 750, unidad: 'cm' });
  });
  it('milímetros explícitos e implícitos (≥100 sin unidad) siguen igual', () => {
    expect(dimensionesEnNombre('Módulo recepción (2420 × 830 mm)', 'mueble')).toMatchObject({ w: 2420, d: 830 });
    expect(dimensionesEnNombre('Mesa (1200 × 1200)', 'mueble')).toMatchObject({ w: 1200, d: 1200, unidad: 'mm' });
  });
  it('tres medidas en guarda: (750 × 750 × 420 mm) → fondo 420, alto 750', () => {
    expect(dimensionesEnNombre('Archivero Modulor 2 puertas + 1 entrepaño (750 × 750 × 420 mm)', 'guarda')).toMatchObject({ w: 750, d: 420, alto: 750 });
  });
  it('adversarial: códigos y enteros pequeños sin unidad NO son medidas', () => {
    expect(dimensionesEnNombre('Silla operativa · WIN 5210', 'asiento')).toBeNull();
    expect(dimensionesEnNombre('Modelo 2x4 serie 3', 'mueble')).toBeNull();        // ambiguo: ¿m? ¿pies? → desconocido
    expect(dimensionesEnNombre('Credenza 2 puertas x 3 entrepaños', 'guarda')).toBeNull();
  });
  it('adversarial: fuera de rango físico → null (no se certifica una medida absurda)', () => {
    expect(dimensionesEnNombre('Mesa 25 × 30 m', 'mueble')).toBeNull();
    expect(dimensionesEnNombre('Repisa 0.05 × 0.02 m', 'mueble')).toBeNull();
  });
  it('unidades mezcladas / contradictorias → null', () => {
    expect(dimensionesEnNombre('Mesa 2100 mm × 0.60 m', 'mueble')).toBeNull();
  });
  it('expandirPiezas usa la medida del nombre cuando la partida no trae w/d (credenza 2.10 × 0.60 m)', () => {
    const p = expandirPiezas([{ id: 'c', nombre: 'Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha', cantidad: 1, ruta: 'eclipse' }])[0];
    expect([p.w, p.d]).toEqual([2100, 600]);
  });
});
