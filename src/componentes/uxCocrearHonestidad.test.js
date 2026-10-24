// uxCocrear · honestidad del concepto (VH-184 / VH-185)
// Source-assertion (el repo no tiene testing-library): la UI de COCREAR debe AVISAR
// — nunca substituir/sobrevender en silencio.
//  VH-185: el render de IA lleva un aviso de que puede no coincidir con 3D/medidas/pedido.
//  VH-184: cuando la tipología es "Producto libre" (FAMILIA.DESCONOCIDA), avisa que es
//          interpretación libre y hay que verificar que corresponda a lo pedido.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('./CocrearV3.jsx', import.meta.url)), 'utf8');

describe('uxCocrear honestidad (VH-184/185)', () => {
  it('VH-185 · el render de IA avisa que puede no coincidir con el 3D/medidas/pedido', () => {
    expect(src).toContain('data-testid="cocrear-render-aviso"');
    expect(src).toMatch(/Imagen de IA para ideación/);
    expect(src).toMatch(/no coincidir con el modelo 3D/);
  });

  it('VH-184 · "Producto libre" avisa que es interpretación libre (no substituye en silencio)', () => {
    expect(src).toContain('data-testid="cocrear-libre-aviso"');
    expect(src).toMatch(/interpret[oó] tu idea sin molde de cat[aá]logo/);
    // El aviso está condicionado a la familia DESCONOCIDA (producto libre).
    expect(src).toMatch(/FAMILIA\.DESCONOCIDA\)===FAMILIA\.DESCONOCIDA/);
  });
});
