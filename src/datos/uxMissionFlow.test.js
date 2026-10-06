import { describe,it,expect } from 'vitest';
import fs from 'node:fs';

describe('UX · misión compartida en flujos críticos',()=>{
  const files=[
    ['src/componentes/Costeador.jsx','Misión · costear este mueble'],
    ['src/componentes/CocrearV3.jsx','Misión · cocrear un producto'],
    ['src/componentes/Cotizacion.jsx','Misión · cerrar esta cotización'],
    ['src/componentes/AcomodoBase.jsx','Misión · acomodar el proyecto'],
  ];
  for(const [path,title] of files){
    it(`${path} muestra estado y siguiente paso`,()=>{
      const s=fs.readFileSync(path,'utf8');
      expect(s).toContain("import MisionFlujo");
      expect(s).toContain(title);
      expect(s).toContain("siguiente=");
      expect(s).toContain("items=");
    });
  }

  it('la ayuda es visual y no altera motores ni costos',()=>{
    const s=fs.readFileSync('src/componentes/MisionFlujo.jsx','utf8');
    expect(s).toContain('Paso {safePaso} de {safeTotal}');
    expect(s).toContain('<b>Siguiente:</b>');
    expect(s).not.toContain('calcular');
    expect(s).not.toContain('setCosteo');
    expect(s).not.toContain('setCot');
  });
});
