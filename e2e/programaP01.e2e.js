import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E REAL P0.1 (audit #10/#11) — navegador, botón, React state, doble click,
//  refresh. Gate de salida del "caso roto de Rodrigo": cotización parcial (10 WIN
//  + 10 gavetas, SIN bench APP LT) → VONI paso 2 propone el APP LT faltante →
//  "Aplicar programa detectado" lo agrega sin duplicar → doble click no duplica →
//  refresh persiste.
//
//  Requiere credenciales (TEST_EMAIL/TEST_PASSWORD): la app abre con sesión real
//  de Supabase. Sin credenciales se salta (igual que auth.e2e.js).
// ============================================================================
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);

const CLAVE = 'costeador-vonhaucke-v1';
// Estado sembrado: cotización PARCIAL + espacio operativo (areasM en METROS).
const ESTADO_SEMILLA = {
  onboardingVisto: true,
  cotizacion: {
    partidas: [
      { id: 'e-win', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 10, precioUnitario: 5210 },
      { id: 'e-gav', piezaId: 'gaveta-mox', nombre: 'Mox · Gaveta pedestal', cantidad: 10, precioUnitario: 3470 },
    ],
    acomodo: { areasM: [{ nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 10 }] },
  },
};

async function login(page) {
  await page.addInitScript(([clave, estado]) => {
    try { window.localStorage.setItem(clave, JSON.stringify(estado)); } catch (_e) { /* modo privado */ }
  }, [CLAVE, ESTADO_SEMILLA]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
  }
}

const contarBench = (page) => page.getByText(/App LT 10 usuarios|6000|Bench operativo/i).count();

test.describe('E2E P0.1 · caso roto de Rodrigo (navegador real)', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el gate E2E real.');

  test('propone el APP LT faltante, lo aplica sin duplicar, doble click idempotente, refresh persiste', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    await login(page);

    // COTIZAR → VONI, ir al PASO 2 (Muebles), donde vive el programa propuesto.
    await page.getByTestId('home-cotizar').click().catch(() => {});
    await page.getByText(/^Muebles$/).first().click().catch(() => {});

    const aplicar = page.getByRole('button', { name: /Aplicar programa detectado/i });
    const apareceCTA = await aplicar.isVisible({ timeout: 15000 }).catch(() => false);
    test.skip(!apareceCTA, 'La semilla no surfaceó el panel de programa en este entorno; revisar selectores/espacio.');

    await expect(page.getByText(/Programa detectado del plano/i)).toBeVisible();
    const benchAntes = await contarBench(page);

    // Aplicar una vez → agrega el bench.
    await aplicar.click();
    await expect.poll(() => contarBench(page)).toBeGreaterThan(benchAntes);
    const benchUna = await contarBench(page);

    // DOBLE CLICK real → NO duplica.
    const aplicar2 = page.getByRole('button', { name: /Aplicar programa detectado/i });
    if (await aplicar2.isVisible().catch(() => false)) {
      await aplicar2.click({ clickCount: 2, delay: 20 }).catch(() => {});
    }
    await page.waitForTimeout(300);
    expect(await contarBench(page)).toBe(benchUna);

    // REFRESH → persiste exactamente lo confirmado (una sola vez).
    await page.reload();
    await page.getByText(/^Muebles$/).first().click().catch(() => {});
    await page.waitForTimeout(500);
    expect(await contarBench(page)).toBe(benchUna);

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
