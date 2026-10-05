import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);

async function login(page) {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
  }
  return pageErrors;
}

async function assertHealthy(page, pageErrors, label) {
  await page.waitForTimeout(500);
  await expect(page.locator('body')).not.toHaveText(/^\s*$/);
  await expect(page.locator('#email-login')).toHaveCount(0);
  expect(pageErrors, `${label}: errores JS de página`).toEqual([]);
}

async function openFromHome(page, buttonName) {
  const errors = await login(page);
  const b = page.getByRole('button', { name: buttonName }).first();
  await expect(b).toBeVisible({ timeout: 10000 });
  await b.click();
  await assertHealthy(page, errors, String(buttonName));
}

test.describe('Auditoría producción autenticada — navegación amplia', () => {
  test.skip(!hayCreds, 'TEST_EMAIL/TEST_PASSWORD no configurados en GitHub Actions.');

  test('Home y puertas principales no rompen', async ({ page }) => {
    const errors = await login(page);
    // Los copies de marketing cambian seguido; la salud del Home se ancla a
    // acciones funcionales y al shell autenticado, no a un slogan.
    await expect(page.getByRole('button', { name: /Cocrear un producto/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Dime qué pide el cliente/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ver todo lo de cotizar/i })).toBeVisible();
    await assertHealthy(page, errors, 'home');
  });

  test('Cocrear abre', async ({ page }) => openFromHome(page, /Cocrear un producto/i));
  test('Voni abre', async ({ page }) => openFromHome(page, /Dime qué pide el cliente/i));
  test('Costear abre para Dirección', async ({ page }) => openFromHome(page, /Cuánto nos cuesta fabricarlo/i));
  test('Cotizar de línea abre', async ({ page }) => openFromHome(page, /Cotizar de línea/i));
  test('Banco de precios abre', async ({ page }) => openFromHome(page, /Banco de precios/i));
  test('Presupuestos abre', async ({ page }) => openFromHome(page, /Presupuestos que ya hicimos/i));
  test('Especial a la medida abre', async ({ page }) => openFromHome(page, /Especial a la medida/i));
  test('Lo que Voni sabe abre', async ({ page }) => openFromHome(page, /Lo que Voni sabe/i));
  test('Tablero Dirección abre', async ({ page }) => openFromHome(page, /Ver el negocio/i));
  test('Usuarios y accesos abre', async ({ page }) => openFromHome(page, /Usuarios y accesos/i));

  for (const target of [
    /Cotizar con IA/i,
    /Cotizar de línea/i,
    /Banco de precios/i,
    /Presupuestos que ya hicimos/i,
    /Cotizar especial/i,
    /Mis cotizaciones/i,
    /Acomodo en el espacio/i,
  ]) {
    test(`Panel Cotizar → ${target}`, async ({ page }) => {
      const errors = await login(page);
      await page.getByRole('button', { name: /Ver todo lo de cotizar/i }).click();
      const b = page.getByRole('button', { name: target }).first();
      await expect(b).toBeVisible({ timeout: 10000 });
      await b.click();
      await assertHealthy(page, errors, `cotizar ${target}`);
    });
  }
});
