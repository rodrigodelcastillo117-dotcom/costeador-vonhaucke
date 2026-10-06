import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('Cotizar · emisión autoritativa fail-closed',()=>{
  const ui=fs.readFileSync('src/componentes/Cotizacion.jsx','utf8');
  const edge=fs.readFileSync('supabase/functions/cotizar-servidor/index.ts','utf8');

  it('DESCONOCIDO nunca permite PDF/impresión',()=>{
    const i=ui.indexOf('function conCandado');
    const b=ui.slice(i,i+2600);
    expect(b).toContain("if (estadoGate !== 'ALLOWED')");
    expect(b).not.toContain("g.estado !== 'DESCONOCIDO'");
  });

  it('PDF definitivo exige revisión inmutable antes de descargar',()=>{
    const i=ui.indexOf('async function descargarPDF');
    const b=ui.slice(i,i+4200);
    expect(b).toContain('if (!reg?.ok)');
    expect(b).toContain('return;');
    expect(b.indexOf('if (!reg?.ok)')).toBeLessThan(b.indexOf('descargarPropuesta({'));
    expect(b).toContain('borrador: false');
  });

  it('servidor usa dinero comercial canónico a centavos',()=>{
    expect(edge).toContain('precioConDescuento(precio_lista, descuento)');
    expect(edge).toContain('importePorCantidad(precio_final, cantidad)');
    expect(edge).toContain('cargoPorcentaje(baseIva, ivaPct)');
    expect(edge).not.toContain('Math.round(precio_lista * (1 - descuento / 100))');
    expect(edge).not.toContain('Math.round(baseIva * (ivaPct / 100))');
  });
});
