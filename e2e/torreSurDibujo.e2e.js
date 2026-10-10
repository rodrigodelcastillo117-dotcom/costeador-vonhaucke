import { test, expect } from '@playwright/test';
import { hayCreds, login, armarYVerificar, verificarAcomodo, TORRE_SUR, leerCot } from './lib/torreSur.js';

// ============================================================================
//  E2E REAL · TORRE SUR · RUTA 2/3: "Dibujar la oficina".
//  Plantilla "Corporativo" → se ajustan los cuartos a Torre Sur con los INPUTS reales
//  (nombre/ancho/largo, Quitar) → "Amueblar mi oficina →" → Muebles: nadie contó
//  puestos (no hay lector), Voni estima por m² y la persona corrige a 8 con ± →
//  misma verificación que el PDF → Acomodo real.
//  Límite conocido (COT-P0-024): el dibujo no entrega puertas con geometría.
// ============================================================================
test.describe('E2E TORRE SUR · ruta Dibujo', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el recorrido real.');
  test.setTimeout(300000);

  test('dibujo (plantilla + inputs) → Voni arma → cotización sin pérdidas → acomodo real', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    await login(page);
    await page.getByTestId('home-cotizar').click();
    await page.getByRole('button', { name: /Dibujar la oficina/ }).click();

    // Plantilla y ajuste de cuartos a Torre Sur (4 cuartos; se quitan los que sobran).
    await page.getByRole('button', { name: /^Corporativo$/ }).click();
    await expect(page.getByText(/^Cuartos$/)).toBeVisible({ timeout: 15000 });
    const fila = (nombre) => page.locator('.fila-botones', { has: page.locator(`input[value="${nombre}"]`) }).first();
    for (const sobra of ['Privado 2', 'Lounge / comedor']) {
      await fila(sobra).getByRole('button', { name: /^Quitar$/ }).click();
    }
    const ajustar = async (nombrePlantilla, c) => {
      const f = fila(nombrePlantilla);
      await expect(f, `cuarto ${nombrePlantilla}`).toBeVisible();
      const nums = f.locator('input[type="number"]');
      await nums.nth(0).fill(String(c.ancho));
      await nums.nth(1).fill(String(c.largo));
      await f.locator('input[type="text"]').first().fill(c.nombre);
      // tipo explícito (chip) — no se confía en tipoPorTamano
      const chip = { open: 'Open space', privado: 'Privado', juntas: 'Sala de juntas', recepcion: 'Recepción' }[c.tipo];
      await fila(c.nombre).getByRole('button', { name: new RegExp(`^${chip}$`) }).click();
    };
    await ajustar('Open space', TORRE_SUR.cuartos[2]);
    await ajustar('Sala de juntas', TORRE_SUR.cuartos[1]);
    await ajustar('Privado 1', TORRE_SUR.cuartos[0]);
    await ajustar('Recepción', TORRE_SUR.cuartos[3]);
    await page.getByRole('button', { name: /Amueblar mi oficina/ }).click();

    // Las áreas dibujadas deben PERSISTIR (autosave de AcomodoBase) aunque aún no haya muebles.
    await expect.poll(async () => ((await leerCot(page)).acomodo?.areasM || []).length, { timeout: 15000 }).toBe(4);
    const areasM = (await leerCot(page)).acomodo.areasM;
    for (const c of TORRE_SUR.cuartos) {
      const a = areasM.find((x) => x.nombre === c.nombre);
      expect(a, `área ${c.nombre} no persistida`).toBeTruthy();
      expect([a.ancho, a.largo].sort(), c.nombre).toEqual([c.ancho, c.largo].sort());
      expect(a.tipo, `tipo de ${c.nombre}`).toBe(c.tipo);
    }

    // Muebles: Voni estima (8 m / 1.5 → 10); la persona corrige a 8 (sin lector no hay conteo).
    await armarYVerificar(page, { ruta: 'dibujo', puestos: TORRE_SUR.puestos });
    await verificarAcomodo(page, { ruta: 'dibujo', estadoFS: null });

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
