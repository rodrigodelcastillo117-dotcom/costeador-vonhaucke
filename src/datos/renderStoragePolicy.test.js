import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('cotización · renders no inflan el JSON', () => {
  it('renders de partida persisten URL de Storage, nunca base64', () => {
    const s = fs.readFileSync('src/componentes/Cotizacion.jsx', 'utf8');
    // VH-046/VH-072: los renders de partida salen de `renderDePartida` (URL de Storage, nunca base64)
    // y la imagen del acomodo pasa por `imagenAcomodoAStorage`.
    expect(s).toContain('renderDePartida(');
    expect(s).toContain('render: r.url');
    expect(s).toContain('imagenAcomodoAStorage(');
    expect(s).not.toContain('render: r.dataUrl');
    expect(s).not.toContain("render3d: c.toDataURL");
  });

  it('el render final del espacio sólo puede venir del Acomodo validado', () => {
    const s = fs.readFileSync('src/componentes/Cotizacion.jsx', 'utf8');
    const i=s.indexOf('async function renderOficina()');
    const j=s.indexOf('// DESCARGAR de verdad:',i);
    const b=s.slice(i,j);
    expect(b).toContain('cotCliente.acomodo?.render3d');
    expect(b).toContain('desde Cotización no voy a inventar una oficina genérica');
    expect(b).not.toContain("modo: 'oficina'");
    expect(b).not.toContain("persistirRender(r.dataUrl, 'acomodo')");
  });

  it('convierte la URL sólo en memoria al crear el PDF', () => {
    const s = fs.readFileSync('src/componentes/Cotizacion.jsx', 'utf8');
    expect(s).toContain('urlADataUrl(cotCliente.acomodo?.render3d)');
    expect(s).toContain('const cotParaPdf');
    expect(s).toContain('cot: cotParaPdf');
  });
});
