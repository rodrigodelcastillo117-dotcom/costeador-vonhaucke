import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('fronteras económicas · centavos end-to-end', () => {
  it('App compara precio de renglones por centavos, no por peso entero', () => {
    const s=fs.readFileSync('src/App.jsx','utf8');
    const i=s.indexOf('const mismoRenglon');
    const bloque=s.slice(i, s.indexOf('function juntarIguales', i));
    expect(bloque).toContain('aCentavosEnteros(a.precioUnitario)');
    expect(bloque).not.toContain('Math.round(a.precioUnitario');
  });

  it('Banco deriva costo con dinero(), no Math.round al peso', () => {
    const s=fs.readFileSync('src/App.jsx','utf8');
    const i=s.indexOf('const costoDeBanco');
    const bloque=s.slice(i, s.indexOf('const margenDeBanco', i));
    expect(bloque).toContain('dinero(costoImplicito(precio2))');
    expect(bloque).not.toContain('Math.round(costoImplicito');
  });

  it('shadow cliente-servidor conserva centavos de precio y costo', () => {
    const s=fs.readFileSync('src/componentes/AsistenteEspecial.jsx','utf8');
    const i=s.indexOf('await registrarSombra');
    const bloque=s.slice(i, s.indexOf('});', i)+3);
    expect(bloque).toContain('precio_cliente: dinero(precio)');
    expect(bloque).toContain('costo_cliente: dinero(resultado.costoUnitario)');
    expect(bloque).not.toContain('Math.round(precio)');
    expect(bloque).not.toContain('Math.round(resultado.costoUnitario)');
  });

  it('comparación costo guardado vs hoy detecta diferencias de un centavo', () => {
    const s=fs.readFileSync('src/componentes/AsistenteEspecial.jsx','utf8');
    expect(s).toContain('aCentavosEnteros(costoGuardado.costoUnitario) !== aCentavosEnteros(resultado.costoUnitario)');
  });
});
