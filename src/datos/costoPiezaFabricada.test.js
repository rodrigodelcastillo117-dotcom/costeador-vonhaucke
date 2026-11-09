// Costo de pieza fabricada: desarrollo plano fail-closed + materia prima real (motor).
import { describe, it, expect } from 'vitest';
import { desarrolloPlano, calibreDesdeTexto, elegirLamina, costearMateriaPrima } from './costoPiezaFabricada.js';

describe('costoPiezaFabricada', () => {
  it('desarrolloPlano: panel plano, panel con pestañas, caja 3D pendiente, insuficiente', () => {
    expect(desarrolloPlano([40, 23]).tipo).toBe('PANEL_PLANO');                   // 2 cotas
    expect(desarrolloPlano([1106, 828, 13]).tipo).toBe('PANEL_PESTANAS');         // 13mm = pestaña/retorno, no plano
    const panel = desarrolloPlano([538, 794, 20]);
    expect(panel.tipo).toBe('PANEL_PESTANAS');
    expect(panel.largoMM).toBe(794 + 40);                                         // L + 2d
    expect(panel.anchoMM).toBe(538 + 40);
    const caja = desarrolloPlano([1200, 865, 600]);
    expect(caja.pendiente).toBe(true); expect(caja.tipo).toBe('CAJA_3D');
    expect(desarrolloPlano([100]).pendiente).toBe(true);                          // 1 cota
  });

  it('desarrolloPlano: 3a cota <=5mm es espesor -> panel plano LxW', () => {
    const r = desarrolloPlano([1106, 828, 3]);
    expect(r.tipo).toBe('PANEL_PLANO');
    expect(r.largoMM).toBe(1106); expect(r.anchoMM).toBe(828);
  });

  it('calibreDesdeTexto', () => {
    expect(calibreDesdeTexto('MAQUILA PLACA GALVANIZADA 40 X 23 mm CALIBRE 24')).toBe(24);
    expect(calibreDesdeTexto('Lamina cal. 22 negra')).toBe(22);
    expect(calibreDesdeTexto('CUERPO EN LAMINA')).toBeNull();
  });

  it('elegirLamina: formato segun largo (4x8 vs 3x10) y calibre', () => {
    expect(elegirLamina(22, { largoMM: 834 }).id).toBe('lamina-22');             // cabe en 4x8
    expect(elegirLamina(20, { largoMM: 3000 }).id).toBe('lamina-3x10-20');       // >2440 -> 3x10
    expect(elegirLamina(24, { largoMM: 40 }).id).toBe('lamina-22');              // cal24 no existe -> mas cercano = cal22 (no cal10)
    expect(elegirLamina(null, {})).toBeNull();
  });

  it('costearMateriaPrima: puerta -> COSTEADA con lámina real, aprovechamiento y sin doble conteo', () => {
    const r = costearMateriaPrima({ clave: 'TELSVH120-P', nombre: 'Puerta', dims_mm: [538, 794, 20], piezas: 1, desc: 'PUERTA EN LAMINA' });
    expect(r.estado).toBe('COSTEADA');
    expect(r.componente.insumoId).toBe('lamina-22');                             // calibre default propuesto
    expect(r.evidencia.costo_mp_mxn).toBeGreaterThan(0);
    expect(r.evidencia.costo_mp_mxn).toBeLessThan(378.78);                       // menos de una hoja entera
    expect(r.evidencia.piezas_por_hoja).toBeGreaterThan(1);
    expect(r.evidencia.corte_incluido_en_precio).toBe(false);                    // hoja cruda -> corte aparte
    expect(r.evidencia.calibre_fuente).toBe('default propuesto');
    expect(r.pregunta).toMatch(/Confirmar calibre/);
  });

  it('costearMateriaPrima: caja 3D -> DESARROLLO_PENDIENTE (no inventa dims)', () => {
    const r = costearMateriaPrima({ clave: 'TELSVH120-CUE', nombre: 'Cuerpo', dims_mm: [1200, 865, 600], piezas: 1 });
    expect(r.estado).toBe('DESARROLLO_PENDIENTE');
    expect(r.componente).toBeUndefined();
    expect(r.pregunta).toMatch(/Desarrollo plano/);
  });

  it('costearMateriaPrima: calibre del plano manda sobre el default', () => {
    const r = costearMateriaPrima({ clave: 'TELSVH120-PLA', nombre: 'Placa', dims_mm: [40, 23], piezas: 1, desc: 'PLACA GALVANIZADA CALIBRE 24' });
    expect(r.estado).toBe('COSTEADA');
    expect(r.evidencia.calibre).toBe(24);
    expect(r.evidencia.calibre_fuente).toBe('del plano');
  });
});
