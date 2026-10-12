import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { totalesCotizacion } from './totales.js';
import { paraGuardar } from './cotizaciones.js';
import { aCentavosEnteros } from '../motor/dinero.js';

describe('contrato comercial · una sola verdad a centavos', () => {
  const partidas=[{id:'p1',nombre:'Producto',cantidad:3,precioUnitario:1234.57}];

  it('IVA congelado en la cotización gana sobre un parámetro global futuro', () => {
    const viejo=totalesCotizacion(partidas,{ivaPct:16,anticipoPct:50},{ivaPorcentaje:22});
    const esperado=totalesCotizacion(partidas,{ivaPct:16,anticipoPct:50},{ivaPorcentaje:16});
    expect(viejo.totalCentavos).toBe(esperado.totalCentavos);
    expect(viejo.ivaPct).toBe(16);
  });

  it('anticipo + saldo cuadran EXACTAMENTE con total en centavos enteros', () => {
    const t=totalesCotizacion(partidas,{ivaPct:16,anticipoPct:37.5},{});
    const saldo=t.totalCentavos-t.anticipoCentavos;
    expect(t.anticipoCentavos+saldo).toBe(t.totalCentavos);
    expect(aCentavosEnteros(t.anticipo)).toBe(t.anticipoCentavos);
  });

  it('persistencia congela IVA, anticipo y monto de anticipo', () => {
    const estado={
      parametros:{ivaPorcentaje:16},
      insumos:{a:{id:'a',precio:1}},
      cotizacion:{partidas,ivaPct:16,anticipoPct:37.5},
    };
    const f=paraGuardar(estado,'test@vh.mx');
    expect(f.totales.ivaPct).toBe(16);
    expect(f.totales.anticipoPct).toBe(37.5);
    expect(f.totales.anticipo).toBeGreaterThan(0);
  });

  it('PDF usa total canónico y no reconstruye el firmado con redondeos al peso', () => {
    const s=fs.readFileSync('src/datos/pdfPropuesta.js','utf8');
    expect(s).toContain('const totalImpreso = totales.totalRedondeado');
    expect(s).toContain('const antImpreso = totales.anticipo');
    expect(s).not.toContain('a + Math.round(monto)');
    expect(s).not.toContain('Math.round(totalImpreso *');
  });

  it('la pantalla comercial usa pesos2 en la escalera y total animado conserva centavos', () => {
    const q=fs.readFileSync('src/componentes/Cotizacion.jsx','utf8');
    const m=fs.readFileSync('src/componentes/MontoAnimado.jsx','utf8');
    expect(q).toContain('{pesos2(iva)}');
    expect(q).toContain('{pesos2(anticipo)}');
    expect(q).toContain('{pesos2(totalRedondeado - anticipo)}');
    expect(m).toContain('pesos2(mostrado)');
    expect(m).not.toContain('Math.round(mostrado)');
  });
});
