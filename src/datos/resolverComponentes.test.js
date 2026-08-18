import { describe, it, expect } from 'vitest';
import { costearItem, catalogoIA } from './lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { cotizarPorComponentes, casarComponente, tipoComponente } from './resolverComponentes.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, piezas: {} };

describe('cotizarPorComponentes — arma la banca sumando piezas reales del Excel', () => {
  it('clasifica los tipos del despiece y descarta lo que no es pieza suelta', () => {
    expect(tipoComponente('Cubierta recta izquierda (RICUBRECI25ABS)')).toBe('CUBIERTA');
    expect(tipoComponente('Pata doble 66° (RIPIBD)')).toBe('PATA');
    expect(tipoComponente('Biombo recto Acrílico')).toBe('BIOMBO');
    expect(tipoComponente('Canto — Cubierta recta')).toBeNull();      // va dentro de la cubierta
    expect(tipoComponente('Faldón/soportes metálicos biombo')).toBeNull();
  });

  it('casa una cubierta de Rio por tipo+medida aunque el modelo la nombre distinto', () => {
    const art = casarComponente('rio', { nombre: 'Cubierta recta (x)', largoMM: 1500, insumoId: 'melamina-28' });
    expect(art).toBeTruthy();
    expect(art.lista).toBeGreaterThan(0);
  });

  it('una banca App LT suma un precio > 0 y casa TODOS sus componentes', () => {
    const r = costearItem(estado, { ruta: 'applt', producto: 'banca_doble', cantidad: 1, seleccion: [{ clave: 'usuarios', valor: '6' }, { clave: 'largo', valor: '1500' }] });
    const comp = cotizarPorComponentes('applt', r?.pieza?.componentes || []);
    expect(comp.estado).not.toBe('ninguno');
    expect(comp.precio).toBeGreaterThan(0);
  });

  // Medición de cobertura (no es aserción dura: imprime para calibrar).
  it('COBERTURA por línea de benching (informe)', () => {
    const cat = catalogoIA();
    const filas = [];
    for (const [ruta, L] of Object.entries(cat)) {
      for (const p of L.productos || []) {
        if (!/bench|banca|estacion/i.test(p.id)) continue;
        let r; try { r = costearItem(estado, { ruta, producto: p.id, cantidad: 1, seleccion: [{ clave: 'usuarios', valor: '6' }, { clave: 'largo', valor: '1500' }] }); } catch (e) { continue; }
        const comp = cotizarPorComponentes(ruta, r?.pieza?.componentes || []);
        const pct = comp.cotizables ? Math.round(100 * comp.casados / comp.cotizables) : 0;
        filas.push(`${(ruta + '/' + p.id).padEnd(28)} ${comp.casados}/${comp.cotizables} (${pct}%)  ~$${Math.round(comp.precio)}  vs modelo $${Math.round(r.precioUnitario)}  ${comp.faltan.map((f) => f.tipo).join(',')}`);
      }
    }
    console.log('\n=== COBERTURA benching por componentes ===\n' + filas.join('\n') + '\n');
    expect(filas.length).toBeGreaterThan(0);
  });
});
