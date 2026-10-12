import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('PDF money trust contract',()=>{
  const ficha=fs.readFileSync('src/componentes/FichaPDF.jsx','utf8');
  const propuesta=fs.readFileSync('src/datos/pdfPropuesta.js','utf8');
  const cot=fs.readFileSync('src/componentes/Cotizacion.jsx','utf8');

  it('FichaPDF usa fronteras monetarias canónicas y muestra centavos',()=>{
    expect(ficha).toContain('importePorCantidad');
    expect(ficha).toContain('cargoPorcentaje');
    expect(ficha).toContain('sumarMontos');
    expect(ficha).toContain('pesos2(');
    expect(ficha).not.toMatch(/\bpesos\(/);
  });

  it('PDF descargable jamás convierte dinero inválido en $0.00',()=>{
    expect(propuesta).toContain("if (!Number.isFinite(v)) return '—'");
    expect(propuesta).not.toContain("if (!Number.isFinite(v)) return '$0.00'");
    expect(propuesta).not.toContain('pesos(pt.precioUnitario || 0)');
  });

  it('Cotización no conserva cálculo muerto UNKNOWN→ZERO de costo total',()=>{
    expect(cot).not.toContain('(p.costoUnitario || 0) * p.cantidad');
    expect(cot).not.toContain('const utilidadTotal = baseGravable - costoTotal');
  });
});
