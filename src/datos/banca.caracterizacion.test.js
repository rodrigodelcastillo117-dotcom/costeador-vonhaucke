import { describe, it, expect } from 'vitest';
import { calcular, PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';

// ANCLA DE CALIBRACION REAL — banca doble Aeropuerto CDMX (C-CO-510R).
// Es el unico T.D.C. real que tenemos (Rafa, 2026-09-24). Costeada a mano en el
// Costeador por FRACCION DE HOJA, como la captura el estimador. Este test
// congela que la app reproduce el MATERIAL real ($7,586) sin merma inventada:
// si alguien rompe la fraccion de hoja, los insumos nuevos (tubo 4", Bari,
// pegado) o el motor, esto truena. NO es una regla de negocio; es memoria de
// una realidad medida. Ver project_costeador_open_items (2026-09-24).
describe('Banca C-CO-510R — ancla de calibración real (material)', () => {
  const INS = mapaInsumos(INSUMOS_SEMILLA);
  const pieza = {
    nombre: 'Banca doble C-CO-510R',
    modoManoObra: 'porcentaje', factorDirecta: 15.5, factorIndirecta: 12,
    componentes: [
      { insumoId: 'mdf', nombre: 'MDF fondo/laterales', hojas: 2 },
      { insumoId: 'chapa-madera', nombre: 'Chapa encino', hojas: 2 },
      { insumoId: 'pegado-chapa', nombre: 'Pegado de chapa', cantidad: 1 },
      { insumoId: 'inoxidable', nombre: 'Zoclo inox', hojas: 0.15 },
      { insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 },
      { insumoId: 'ptr-redondo-4', nombre: 'Tubular sillas 4"', cantidad: 0.333 },
      { insumoId: 'lamina-10', nombre: 'Asiento/respaldo cal10', hojas: 0.8 },
      { insumoId: 'ptr-cuadrado-4', nombre: 'Pedestales perfil 4"', cantidad: 0.7 },
      { insumoId: 'pintura-polvo', nombre: 'Pintura', cantidad: 0.276 },
      { insumoId: 'multicontactos-bari', nombre: 'Multicontactos Bari', cantidad: 2 },
    ],
  };

  it('todos los insumos existen en el catálogo (ninguno fantasma que cueste $0)', () => {
    for (const c of pieza.componentes) expect(INS[c.insumoId], `falta ${c.insumoId}`).toBeTruthy();
  });

  it('el material cae en el costo real (~$7,586) SIN desperdicio inventado', () => {
    const r = calcular(pieza, 1, INS, PARAMETROS_DEFAULT);
    expect(r.materialTotal).toBeGreaterThan(7450);
    expect(r.materialTotal).toBeLessThan(7700);   // real $7,585.92
    expect(r.desperdicio).toBe(0);                 // fracción de hoja no inventa merma
  });

  it('el costo de fabricar es realista y NO el doble (el bug original daba $26,811)', () => {
    const r = calcular(pieza, 1, INS, PARAMETROS_DEFAULT);
    expect(r.costoFabricacion).toBeGreaterThan(9000);
    expect(r.costoFabricacion).toBeLessThan(13000); // real $12,342; jamás cerca de $26,811
  });
});
