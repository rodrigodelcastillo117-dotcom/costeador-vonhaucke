import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);

async function login(page) {
  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Guía de uso/i })).toBeHidden({ timeout: 5000 });
  }
}

test.describe('E2E autenticado · flujo real', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para certificar el flujo autenticado.');

  test.beforeEach(async ({ page }) => { await login(page); });

  test('home es inequívoco: Cotizar · Costear · Cocrear', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Qué vas a hacer/i })).toBeVisible();
    await expect(page.getByTestId('home-cotizar')).toBeVisible();
    await expect(page.getByTestId('home-costear')).toBeVisible();
    await expect(page.getByTestId('home-cocrear')).toBeVisible();
  });

  test('COSTEAR abre directo el flujo de PDF y acepta un PDF multipágina real', async ({ page }) => {
    await page.getByTestId('home-costear').click();
    await expect(page.getByText(/Qué vas a costear/i)).toBeVisible({ timeout: 15000 });
    const input = page.getByTestId('costear-archivo');
    await expect(input).toHaveCount(1);
    await input.setInputFiles('e2e/fixtures/two-page.pdf');
    await expect(page.getByText(/Tu plano tiene 2 páginas/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Solo esta hoja/i })).toBeVisible();
  });

  test('COTIZAR abre VONI sin menú intermedio', async ({ page }) => {
    await page.getByTestId('home-cotizar').click();
    await expect(page.getByText(/asistente de proyecto/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Dónde va el proyecto|Cuéntame qué necesita tu cliente/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('COCREAR entra al estudio de co-diseño', async ({ page }) => {
    await page.getByTestId('home-cocrear').click();
    await expect(page.getByText(/Qué tienes en mente|Cocrear . de la idea|Diséñalo|Disénalo/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('atajos críticos no son botones muertos', async ({ page }) => {
    const costeoManual = page.getByRole('button', { name: /Costeo manual/i });
    if (await costeoManual.count()) {
      await costeoManual.click();
      await expect(page.getByText(/Descríbelo y Voni lo entiende|despiece/i).first()).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: /Inicio/i }).first().click().catch(() => {});
    }
  });


  test('ACOMODO abre sin errores de runtime y nunca inventa que el programa está completo', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    await page.getByRole('button', { name: /Acomodo/i }).first().click();
    await expect(
      page.getByText(/Áreas del proyecto|Tu cotización está vacía|Programa incompleto para acomodar|¿Dónde van estos muebles\?/i).first()
    ).toBeVisible({ timeout: 15000 });
    expect(pageErrors).toEqual([]);
  });

  test('salidas de propuesta: descarga PDF real e imprimir responde cuando hay proyecto', async ({ page }) => {
    await page.getByRole('button', { name: /Proyecto actual/i }).click();
    const descargar = page.getByRole('button', { name: /Descargar (PDF|BORRADOR)/i });
    const imprimir = page.getByRole('button', { name: /Imprimir( BORRADOR)?/i });

    if (!(await descargar.count())) {
      test.info().annotations.push({ type: 'nota', description: 'Proyecto vacío: no hay documento que emitir en esta cuenta.' });
      return;
    }

    await expect(descargar).toBeEnabled();
    const dl = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      descargar.click(),
    ]).then(([d]) => d);
    expect((await dl.suggestedFilename()).toLowerCase()).toMatch(/\.pdf$/);

    await page.evaluate(() => {
      window.__vhPrintCalled = false;
      window.vhPrint = () => { window.__vhPrintCalled = true; };
    });
    await expect(imprimir).toBeEnabled();
    await imprimir.click();
    await expect.poll(() => page.evaluate(() => window.__vhPrintCalled)).toBe(true);
  });

  test('cotización: botones de salida nunca quedan muertos cuando existe un proyecto', async ({ page }) => {
    const actual = page.getByRole('button', { name: /Proyecto actual/i });
    await actual.click();
    const descargar = page.getByRole('button', { name: /Descargar (PDF|BORRADOR)/i });
    const imprimir = page.getByRole('button', { name: /Imprimir( BORRADOR)?/i });
    if (await descargar.count()) {
      await expect(descargar).toBeEnabled();
      await expect(imprimir).toBeEnabled();
    } else {
      test.info().annotations.push({ type: 'nota', description: 'Proyecto vacío: la pantalla no expone emisión todavía.' });
    }
  });
});
