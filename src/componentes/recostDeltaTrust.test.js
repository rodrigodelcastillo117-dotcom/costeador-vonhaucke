// ============================================================================
//  AsistenteEspecial · recost delta trust (comportamiento, 2026-10-14).
//  Antes: buscaba `aCentavosEnteros(costoGuardado.costoUnitario) != null` en el TEXTO del componente. La
//  comparación se extrajo (refactor puro) a difierenAlCentavo (datos/renglonesComerciales.js) y aquí se EJECUTA.
// ============================================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { difierenAlCentavo } from '../datos/renglonesComerciales.js';

describe('AsistenteEspecial · recost delta trust', () => {
  it('no compara costo guardado desconocido contra cero', () => {
    for (const desconocido of [null, undefined, '', '  ', NaN, 'abc']) {
      expect(difierenAlCentavo(desconocido, 0), String(desconocido)).toBe(false);      // desconocido ≠ $0
      expect(difierenAlCentavo(desconocido, 5072.85), String(desconocido)).toBe(false); // no hay "Δ $5,072.85"
    }
    expect(difierenAlCentavo(0, 5072.85)).toBe(true);           // un 0 REAL guardado sí es diferencia
  });

  // STATIC GUARD: AsistenteEspecial.jsx no se monta en node (sin jsdom). Sólo el CABLEADO del aviso de re-costeo.
  it('cableado: el aviso "Re-costeo con catálogo de hoy" usa la comparación probada', () => {
    const s = fs.readFileSync('src/componentes/AsistenteEspecial.jsx', 'utf8');
    const i = s.indexOf('Re-costeo con catálogo de hoy');
    const b = s.slice(Math.max(0, i - 800), i + 900);
    expect(b).toContain('difierenAlCentavo(costoGuardado.costoUnitario, resultado.costoUnitario)');
    expect(b).not.toContain('costoGuardado.costoUnitario || 0');
  });
});
