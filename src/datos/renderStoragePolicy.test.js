import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('cotización · renders no inflan el JSON', () => {
  it('persiste URLs de Storage y nunca dataUrl dentro de partidas/acomodo', () => {
    const s = fs.readFileSync('src/componentes/Cotizacion.jsx', 'utf8');
    expect(s).toContain('subirRender as subirRenderNube');
    expect(s).toContain("persistirRender(r.dataUrl, 'partidas')");
    expect(s).toContain("persistirRender(r.dataUrl, 'acomodo')");
    expect(s).toContain('render: up.url');
    expect(s).toContain('render3d: up.url');
    expect(s).not.toContain('render: r.dataUrl');
    expect(s).not.toContain('render3d: r.dataUrl');
    expect(s).not.toContain("render3d: c.toDataURL");
  });

  it('convierte la URL sólo en memoria al crear el PDF', () => {
    const s = fs.readFileSync('src/componentes/Cotizacion.jsx', 'utf8');
    expect(s).toContain('urlADataUrl(cotCliente.acomodo?.render3d)');
    expect(s).toContain('const cotParaPdf');
    expect(s).toContain('cot: cotParaPdf');
  });
});
