// ============================================================================
//  Costeador · Diseño es técnico, Dirección controla economía comercial (comportamiento, 2026-10-14).
//  Antes: buscaba `{mostrarComercial && utilidad > 0` en el TEXTO de HojaCosto.jsx. Ahora RENDERIZA HojaCosto
//  con react-dom/server (node, sin jsdom) y verifica qué ve cada capacidad: con la capacidad comercial apagada
//  no aparecen precio de lista, utilidad ni precios por volumen; el costo técnico sí.
// ============================================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HojaCosto from '../componentes/HojaCosto.jsx';
import { veCostosCosteo, veEconomiaCotizacion } from './roles.js';

const resultado = {
  costoUnitario: 1000, materialTotal: 600, manoObra: 250, indirectosFabrica: 150,
  detalleInsumos: [{ seccion: 'cubiertas', costo: 600, nombre: 'MDF' }], componentesIgnorados: [],
};
const hoja = (props) => renderToStaticMarkup(createElement(HojaCosto, { resultado, insumos: {}, pieza: {}, ...props }));
const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Costeador · Diseño es técnico, Dirección controla economía comercial', () => {
  it('HojaCosto con capacidad comercial: muestra costo, precio de lista y utilidad', () => {
    const t = texto(hoja({ mostrarComercial: true, mostrarVolumen: true }));
    expect(t).toContain('Cuesta hacer 1');
    expect(t).toContain('$1,000.00');
    expect(t).toContain('Precio de lista');
    expect(t).toMatch(/ganas \$[\d,]+\.\d\d/);
  });

  it('HojaCosto no muestra precios/utilidad/volumen cuando la capacidad comercial está apagada', () => {
    const t = texto(hoja({ mostrarComercial: false, mostrarVolumen: true }));
    expect(t).toContain('Cuesta hacer 1');                     // costo técnico: sí
    expect(t).toContain('$1,000.00');
    for (const prohibido of ['Precio de lista', 'ganas', 'Utilidad', 'Alto (mucho vol.)', 'Intermedio', 'Bajo (pocas pzas)']) {
      expect(t, prohibido).not.toContain(prohibido);
    }
    // Ningún monto distinto de los rubros técnicos (material 600, MO 250, indirectos 150, costo 1000).
    const montos = new Set(t.match(/\$[\d,]+\.\d\d/g));
    for (const m of montos) expect(['$1,000.00', '$600.00', '$250.00', '$150.00']).toContain(m);
  });

  it('costeo incompleto: ni con capacidad comercial se imprime precio (Pendiente)', () => {
    const t = texto(hoja({ mostrarComercial: true, resultado: { ...resultado, componentesIgnorados: ['Costado sin material'] } }));
    expect(t).toContain('Costo NO EMITIBLE');
    expect(t).toContain('Pendiente');
    expect(t).not.toMatch(/ganas/);
  });

  it('roles: Diseño ve costos técnicos pero NO la economía comercial; sólo Dirección la ve', () => {
    expect(veCostosCosteo('diseno')).toBe(true);
    expect(veEconomiaCotizacion('diseno')).toBe(false);
    expect(veEconomiaCotizacion('direccion')).toBe(true);
    expect(veEconomiaCotizacion('vendedor')).toBe(false);
  });

  // STATIC GUARD: App.jsx y Costeador.jsx no se montan en node (App depende de sesión/Supabase; Costeador de todo el
  // estado de la app). La regla de visibilidad está probada arriba renderizando HojaCosto; aquí sólo el CABLEADO
  // de la capacidad: App la da sólo a Dirección y Costeador la pasa a HojaCosto y a sus acciones comerciales.
  it('cableado: App → Costeador → HojaCosto', () => {
    const app = fs.readFileSync('src/App.jsx', 'utf8');
    expect(app).toContain('puedeVerComercial={esDireccion}');
    const c = fs.readFileSync('src/componentes/Costeador.jsx', 'utf8');
    expect(c).toContain('puedeVerComercial = true');
    expect(c).toContain('{puedeVerComercial ? (');
    expect(c).toContain('mostrarComercial={puedeVerComercial}');
  });
});
