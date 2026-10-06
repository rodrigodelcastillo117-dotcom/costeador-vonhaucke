import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

for (const file of ['src/componentes/CocrearV3.jsx','src/componentes/CocrearV2.jsx']) {
  describe(file+' · release contract', () => {
    const s=fs.readFileSync(file,'utf8');
    it('usa el gate canónico listaParaCotizar, no solo official_cost', () => {
      expect(s).toContain("pipeline?.lineaCotizacion?.listaParaCotizar===true");
      expect(s).toContain("disabled={!listaParaCotizar||!onAgregar}");
    });
    it('no etiqueta official_cost como costo certificado', () => {
      expect(s).not.toContain('Costo certificado:');
    });
  });
}
