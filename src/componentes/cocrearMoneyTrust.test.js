import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import { formatearReferenciaCocrear } from '../datos/cocrearReferencias.js';

describe('Cocrear money trust contract',()=>{
  it('UI principal muestra dos decimales',()=>{
    const s=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
    expect(s).toContain('minimumFractionDigits:2');
    expect(s).toContain('maximumFractionDigits:2');
    expect(s).not.toContain('maximumFractionDigits:0');
  });

  it('referencias comerciales conservan centavos',()=>{
    const r=formatearReferenciaCocrear({
      items:[{producto_id:1,nombre:'Mesa',precio:1234.56,moneda:'MXN'}],
      moneda:'MXN',
      rango_precio:{min:1234.56,max:2345.67},
      rango_costo:{min:987.65,max:1111.11},
    });
    expect(r.rangoPrecio).toContain('$1,234.56');
    expect(r.rangoPrecio).toContain('$2,345.67');
    expect(r.rangoCosto).toContain('$987.65');
  });

  it('dinero inválido no se convierte silenciosamente en cero',()=>{
    const s=fs.readFileSync('src/datos/cocrearReferencias.js','utf8');
    expect(s).not.toContain('Number(n)||0');
    expect(s).toContain("if(!Number.isFinite(v)) return '—'");
  });
});
