import { describe,it,expect } from 'vitest';
import fs from 'node:fs';

describe('PDF / print recovery contract',()=>{
  const s=fs.readFileSync('src/componentes/Cotizacion.jsx','utf8');
  it('never disables download because a definitive-emission gate is pending',()=>{
    expect(s).toContain('borrador: !modo.definitivo');
    expect(s).toContain('Descargar BORRADOR');
    expect(s).not.toContain('onClick={conCandado(descargarPDF)}');
  });
  it('prints a visible draft rather than becoming a dead action',()=>{
    expect(s).toContain("document.body.classList.add('vh-print-borrador')");
    expect(s).toContain("typeof window.vhPrint === 'function'");
    expect(fs.readFileSync('src/estilos.css','utf8')).toContain('BORRADOR · NO REGISTRADO');
  });
});

describe('disabled controls recovery contract',()=>{
  it('explains every disabled button without enabling it',()=>{
    const s=fs.readFileSync('src/runtimeGuardrails.js','utf8');
    expect(s).toContain('Esta acción necesita completar un paso anterior.');
    expect(s).toContain('btn.disabled');
    expect(s).not.toContain('btn.disabled = false');
  });
});
