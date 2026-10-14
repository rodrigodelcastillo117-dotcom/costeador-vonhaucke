import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Link de prueba: el build publicado sólo puede apuntar Costear a las Edge -rc si es un Preview de Vercel
// con CARRIL_RC=si. Producción (VERCEL_ENV=production) nunca, aunque la variable exista por error.
describe('carril RC publicado', () => {
  const cfg = fs.readFileSync('vite.config.js', 'utf8');
  const nube = fs.readFileSync('src/nube.js', 'utf8');
  it('la bandera exige VERCEL_ENV=preview y CARRIL_RC=si', () => {
    expect(cfg).toContain("__CARRIL_RC__: JSON.stringify(process.env.VERCEL_ENV === 'preview' && process.env.CARRIL_RC === 'si')");
  });
  it('los nombres RC son fijos (no salen de variables) y sólo cubren Costear', () => {
    expect(nube).toContain("const FN_ANALIZAR = CARRIL_RC ? 'analizar-mueble-rc' :");
    expect(nube).toContain("const FN_COSTEAR = CARRIL_RC ? 'costear-servidor-rc' :");
    expect(nube).not.toMatch(/FN_(LEER_PLANO|COTIZAR_TEXTO|GENERAR_RENDER|ACOMODAR) = CARRIL_RC/);
  });
  it('fuera de un navegador en una URL de preview el carril queda apagado, aunque el build traiga la bandera', async () => {
    // Auditoría P1-06: la bandera horneada no basta; sin hostname de preview (Node, pruebas, dominio de producción) → Edge productivas.
    const m = await import('../nube.js');
    expect(m.CARRIL_RC).toBe(false);
  });
  it('la app avisa visiblemente que es un link de prueba', () => {
    const app = fs.readFileSync('src/App.jsx', 'utf8');
    expect(app).toContain('data-testid="carril-rc"');
  });
});
