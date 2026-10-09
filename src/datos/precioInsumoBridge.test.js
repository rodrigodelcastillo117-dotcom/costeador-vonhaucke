import { describe, it, expect } from 'vitest';
import { INSUMOS_SEMILLA, mapaInsumos, FUENTE_SS } from './insumos.js';
import { ESTADO_PRECIO, FUENTE_PRECIO } from './precioProvenance.js';
import { observacionDeInsumo, resolverPrecioInsumo, resolverPrecioInsumoVivo, explicarPrecioInsumo, clasificarFuenteTexto, fechaDeFuenteTexto, precioCapturadoAMano } from './precioInsumoBridge.js';
import { FUENTE_ERP } from './insumos.js';

const CAT = mapaInsumos(INSUMOS_SEMILLA);

describe('precioInsumoBridge · conecta el catálogo REAL con el resolver', () => {
  it('EcoLegno 19 mm (dato real del catálogo) → REAL_OBSERVED con procedencia de Compras', () => {
    const ins = CAT['melamina-19'];
    expect(ins).toBeTruthy();
    expect(ins.precio).toBe(544);                          // dato real en insumos.js
    const r = resolverPrecioInsumo('melamina-19', ins, { hoy: '2026-10-08' });
    expect(r.precio).toBe(544);
    expect(r.estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_DATED);  // compra real FECHADA (2026-08-14)
    expect(r.fuente).toBe(FUENTE_PRECIO.COMPRA_REAL);
    expect(r.source_date).toBe('2026-08-14');
    expect(r.bloqueaCostoOficial).toBe(false);
  });

  it('"¿por qué $544?" → explicación auditable para EcoLegno', () => {
    const texto = explicarPrecioInsumo('melamina-19', CAT['melamina-19'], { hoy: '2026-10-08' });
    expect(texto).toContain('544');
    expect(texto).toMatch(/Compra real|Compras/);
    expect(texto).toMatch(/2026/);
  });

  it('fuente estimada de mercado (FUENTE_SS) → PROVISIONAL y bloquea costo oficial', () => {
    const insSS = { precio: 3500, unidad: 'm2', nombre: 'Superficie sólida', fuente: FUENTE_SS };
    const r = resolverPrecioInsumo('ss-demo', insSS, { hoy: '2026-10-08' });
    expect(r.estado).toBe(ESTADO_PRECIO.PROVISIONAL);
    expect(r.bloqueaCostoOficial).toBe(true);
  });

  it('fuente DESCONOCIDA no se inventa → PROVISIONAL sin fecha', () => {
    const obs = observacionDeInsumo('x', { precio: 10, unidad: 'pz', fuente: 'algo-no-mapeado' });
    expect(obs.fuente).toBe(FUENTE_PRECIO.PROVISIONAL);
    expect(obs.source_date).toBeNull();
  });

  it('P0-PRICE-TRUST: precio CAPTURADO a mano NO hereda la evidencia vieja → PROVISIONAL (no oficial)', () => {
    // Insumo con compra real fechada, pero Dirección cambió el importe a mano.
    const insManual = { precio: 600, precioBase: 544, actualizado: '2026-10-08', unidad: 'hoja', nombre: 'Melamina', fuente: 'Compras, lista del 2026-08-14' };
    expect(precioCapturadoAMano(insManual)).toBe(true);
    const r = resolverPrecioInsumoVivo('melamina-19', insManual, { hoy: '2026-10-08' });
    expect(r.estado).toBe(ESTADO_PRECIO.PROVISIONAL);     // el monto nuevo no está autenticado por la fuente vieja
    expect(r.bloqueaCostoOficial).toBe(true);
    expect(r.precio).toBe(600);
    // Sin capturar (precio = base) sí conserva la evidencia real fechada.
    const insReal = { precio: 544, precioBase: 544, unidad: 'hoja', nombre: 'Melamina', fuente: 'Compras, lista del 2026-08-14' };
    expect(resolverPrecioInsumoVivo('melamina-19', insReal, { hoy: '2026-10-08' }).estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_DATED);
  });

  it('PRICE DATE/TRUST: FUENTE_ERP ("ERP, ultima compra") SIN fecha → REAL_OBSERVED_UNDATED (no oficial)', () => {
    const insErp = { precio: 123, unidad: 'pz', nombre: 'Tornillo', fuente: FUENTE_ERP };
    const r = resolverPrecioInsumo('erp-demo', insErp, { hoy: '2026-10-08' });
    expect(r.estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_UNDATED);  // real pero sin fecha
    expect(r.bloqueaCostoOficial).toBe(true);                    // no permite afirmar "fechado/vigente"
    expect(explicarPrecioInsumo('erp-demo', insErp)).toMatch(/sin fecha/i);
  });

  it('INVENTARIO: toda fuente real del catálogo se clasifica (tipo no nulo) y extrae fecha cuando la trae', () => {
    const fuentesUsadas = new Set(INSUMOS_SEMILLA.map((i) => i.fuente).filter(Boolean));
    for (const f of fuentesUsadas) {
      const c = clasificarFuenteTexto(f);
      expect(c.fuente, `fuente sin clasificar: ${f}`).toBeTruthy();
    }
    // El ERP grande de Luis Daniel (…10082026.xlsx) → COMPRA_REAL fechada 2026-08-10.
    const erpLuis = [...fuentesUsadas].find((f) => /10082026\.xlsx/.test(f));
    expect(erpLuis).toBeTruthy();
    expect(clasificarFuenteTexto(erpLuis).source_date).toBe('2026-08-10');
  });

  it('extracción de fecha: ISO directa y DDMMYYYY de nombre de archivo', () => {
    expect(fechaDeFuenteTexto('lista del 2026-08-14')).toBe('2026-08-14');
    expect(fechaDeFuenteTexto('…al 10082026.xlsx')).toBe('2026-08-10');
    expect(fechaDeFuenteTexto('ERP, ultima compra')).toBeNull();   // sin fecha → null (no se inventa)
  });

  it('cobertura: el catálogo real resuelve mayoría REAL_OBSERVED/CURRENT (no PENDING masivo)', () => {
    let pending = 0; let real = 0;
    for (const [id, ins] of Object.entries(CAT)) {
      if (ins?.precio == null) continue;
      const r = resolverPrecioInsumo(id, ins, { hoy: '2026-10-08' });
      if (r.estado === ESTADO_PRECIO.PENDING) pending += 1;
      else if (r.estado === ESTADO_PRECIO.REAL_OBSERVED_DATED || r.estado === ESTADO_PRECIO.REAL_OBSERVED_UNDATED || r.estado === ESTADO_PRECIO.CURRENT_VERIFIED) real += 1;
    }
    expect(real).toBeGreaterThan(0);
    // Sin fuente/precio inválidos no deben dominar: la evidencia real existe.
    expect(real).toBeGreaterThan(pending);
  });
});
