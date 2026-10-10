import { test, expect } from '@playwright/test';
import { hayCreds, login, armarYVerificar, verificarAcomodo, TORRE_SUR, leerCot } from './lib/torreSur.js';

// ============================================================================
//  E2E REAL · TORRE SUR · RUTA 3/3: "Todavía no hay plano" (sólo metros).
//  132 m² (entre ejes) · 1 privado · 1 sala de juntas de 8 · recepción →
//  "Empezar con 132 m² →" → Muebles: Voni estima puestos por m², la persona corrige
//  a 8 → misma verificación que el PDF → Acomodo real (sin FloorSpec: publicable).
// ============================================================================
test.describe('E2E TORRE SUR · ruta m²', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el recorrido real.');
  test.setTimeout(300000);

  test('m² + cuartos → Voni arma → cotización sin pérdidas → acomodo real', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    await login(page);
    await page.getByTestId('home-cotizar').click();
    await page.getByRole('button', { name: /Todavía no hay plano/ }).click();

    await page.locator('#m2-exacto').fill(String(TORRE_SUR.m2EntreEjes));
    await page.locator('#m2-exacto').blur();
    // Privados: 1 · Salas de juntas: 1 para 8 · Recepción
    const fila = (titulo) => page.locator('div', { has: page.locator('.prog-et strong', { hasText: new RegExp(`^${titulo}$`) }) }).last();
    await fila('Privados').getByRole('button', { name: 'Más' }).click();
    await fila('Salas de juntas').getByRole('button', { name: 'Más' }).click();
    await page.getByRole('button', { name: new RegExp(`^${TORRE_SUR.juntasPax}$`) }).click();
    await page.getByLabel(/^Recepción$/).check();
    await page.getByRole('button', { name: new RegExp(`Empezar con\\s+${TORRE_SUR.m2EntreEjes}\\s*m²`) }).click();

    // Cuartos generados y persistidos. El flujo m² NO pone `tipo` (cuartosDePrograma
    // sólo da nombre + lados; el rol se infiere del nombre aguas abajo) — se verifica por nombre.
    await expect.poll(async () => ((await leerCot(page)).acomodo?.areasM || []).length, { timeout: 15000 }).toBeGreaterThanOrEqual(4);
    const nombres = ((await leerCot(page)).acomodo.areasM || []).map((a) => String(a.nombre));
    for (const re of [/^Open space/, /^Privado 1$/, new RegExp(`^Sala de juntas \\(${TORRE_SUR.juntasPax} personas\\)$`), /^Recepción$/]) {
      expect(nombres.some((n) => re.test(n)), `falta cuarto ${re}: ${nombres.join(' | ')}`).toBe(true);
    }

    await armarYVerificar(page, { ruta: 'm2', puestos: TORRE_SUR.puestos });
    await verificarAcomodo(page, { ruta: 'm2', estadoFS: null });

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
