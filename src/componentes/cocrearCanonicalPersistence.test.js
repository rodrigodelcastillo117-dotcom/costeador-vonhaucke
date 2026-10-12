import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

for(const file of ['src/componentes/CocrearV3.jsx','src/componentes/CocrearV2.jsx']){
  describe(file+' · canonical persistence',()=>{
    const s=fs.readFileSync(file,'utf8');
    const i=s.indexOf('const agregarCotizacion=async()=>');
    const j=s.indexOf('const css=',i);
    const b=s.slice(i,j>i?j:i+7000);
    it('no oculta fallos de persistencia',()=>{
      expect(b).toContain('No se agregó a la cotización');
      expect(b).toContain('No se pudo registrar la revisión canónica');
      expect(b).not.toContain('catch{}');
    });
    it('exige version_id antes de agregar la partida',()=>{
      expect(b).toContain("!reg?.ok||!reg?.version_id");
      expect(b.indexOf('onAgregar({')).toBeGreaterThan(b.indexOf('registrarProductoDesdeExpediente'));
    });
    it('muestra fallo de render canónico como warning',()=>{
      expect(b).toContain('Render canónico pendiente');
    });
  });
}
