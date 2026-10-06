import { test, expect } from '@playwright/test';

// E2E de flujos CON LOGIN. Gated por credenciales de una CUENTA DE PRUEBA sembrada:
//   TEST_EMAIL / TEST_PASSWORD  (en CI como secrets; en local como env vars).
// Sin credenciales se SALTA limpio (no rompe la suite). Con ellas, ejercita los
// pilares autenticados de punta a punta en navegador real.
//   Nunca usar aquí credenciales de producción de una persona real: una cuenta de
//   prueba dedicada, idealmente con rol Dirección para ver todo el flujo.
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);

test.describe('E2E autenticado', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD (cuenta de prueba) para correr los flujos con login.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('#email-login', EMAIL);
    await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    // El login cae cuando aparece el shell (el botón Salir del encabezado).
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    // Primer login: se abre la guía "Bienvenido al costeador" encima. Se cierra con
    // Escape para no tapar la pantalla (si no está, no pasa nada).
    if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: /Guía de uso/i })).toBeHidden({ timeout: 5000 });
    }
  });

  test('login → inicio simple orientado a trabajos', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Qué quieres hacer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nueva cotización/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cotizar un producto conocido/i })).toBeVisible();
  });

  test('Cocrear sigue disponible sin competir con el camino principal', async ({ page }) => {
    await page.getByText(/Más herramientas/i).click();
    await page.getByRole('button', { name: /Cocrear un producto/i }).click();
    await expect(page.getByText(/Qué tienes en mente|Cocrear . de la idea|Diséñalo|Disénalo/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('abre Cotizar y ve el gate de emisión (seller-safe)', async ({ page }) => {
    // Si hay partidas, el encabezado muestra "Mi cotización"; si no, se omite el assert del gate.
    const carrito = page.getByRole('button', { name: /Ver mi cotización|Mi cotización/i });
    if (await carrito.count()) {
      await carrito.first().click();
      await expect(page.getByRole('button', { name: /Verificar emisión|Descargar PDF/i }).first()).toBeVisible({ timeout: 15000 });
    } else {
      test.info().annotations.push({ type: 'nota', description: 'Sin partidas en la cuenta de prueba: se omite el gate.' });
    }
  });
  test('home prioriza una ruta clara por rol y no ofrece callejones', async ({ page }) => {
    // Regla UX: un usuario nuevo debe poder empezar sin conocer la arquitectura.
    // Siempre existe la puerta guiada por lenguaje de cliente.
    await expect(page.getByRole('button', { name: /Nueva cotización/i })).toBeVisible();
    // Nunca enseñamos un CTA que sólo conduce a "no tienes permiso".
    const textosBloqueo = page.getByText(/no tienes permiso|no puedes usar|solo dirección/i);
    await expect(textosBloqueo).toHaveCount(0);
  });

  test('navegar y volver conserva el contexto del inicio', async ({ page }) => {
    // Entrar a una herramienta y volver no debe resetear la experiencia ni obligar
    // a reaprender dónde estaba el usuario.
    await page.getByRole('button', { name: /Nueva cotización/i }).click();
    await expect(page.getByText(/Voni|proyecto|cliente/i).first()).toBeVisible({ timeout: 15000 });
    const volver = page.getByRole('button', { name: /Atrás|Inicio|Volver/i }).first();
    if (await volver.count()) {
      await volver.click();
      await expect(page.getByRole('button', { name: /Nueva cotización/i })).toBeVisible({ timeout: 10000 });
    }
  });

});
