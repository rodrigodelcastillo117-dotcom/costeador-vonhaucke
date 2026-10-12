import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('costeo nuevo → cotización · autoridad al centavo', () => {
  it('no persiste un costo sólo calculado en navegador', () => {
    const s = fs.readFileSync('src/App.jsx', 'utf8');
    const i = s.indexOf('function onAgregarCotizacion');
    const j = s.indexOf('function onGuardarPieza', i);
    const b = s.slice(i, j);
    expect(b).toContain('costearServidor(costeo, n)');
    expect(b).toContain('aCentavosEnteros(costoClienteRaw)');
    expect(b).toContain('aCentavosEnteros(costoServidorRaw)');
    expect(b).toContain('clienteC !== servidorC');
    expect(b).toContain('costoUnitario: costoServidor');
    expect(b).toContain('costoPendiente: false');
    expect(b).not.toContain('resultado?.costoUnitario ?? 0');
  });
});
