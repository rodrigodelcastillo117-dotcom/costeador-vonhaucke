import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('Cotizar · emisión autoritativa fail-closed',()=>{
  const ui=fs.readFileSync('src/componentes/Cotizacion.jsx','utf8');
  const edge=fs.readFileSync('supabase/functions/cotizar-servidor/index.ts','utf8');

  it('DESCONOCIDO nunca permite documento definitivo; degrada a borrador',()=>{
    const i=ui.indexOf('async function resolverModoDocumento');
    const b=ui.slice(i,i+4200);
    expect(b).toContain("if (estadoGate !== 'ALLOWED')");
    expect(b).toContain("definitivo: false");
    expect(b).not.toContain("g.estado !== 'DESCONOCIDO'");
  });

  it('PDF definitivo exige revisión inmutable, pero el borrador sigue disponible',()=>{
    const i=ui.indexOf('async function resolverModoDocumento');
    const b=ui.slice(i,i+5200);
    expect(b).toContain('const reg = onEmitida ? await onEmitida()');
    expect(b).toContain('if (!reg?.ok)');
    expect(b).toContain('definitivo: false');
    expect(ui).toContain('borrador: !modo.definitivo');
    expect(ui).toContain('Descargar BORRADOR');
  });

  it('servidor usa dinero comercial canónico a centavos',()=>{
    expect(edge).toContain('precioConDescuento(precio_lista, descuento)');
    expect(edge).toContain('importePorCantidad(precio_final, cantidad)');
    expect(edge).toContain('cargoPorcentaje(baseIva, ivaPct)');
    expect(edge).not.toContain('Math.round(precio_lista * (1 - descuento / 100))');
    expect(edge).not.toContain('Math.round(baseIva * (ivaPct / 100))');
  });
});
