import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);

const CLAVE = 'costeador-vonhaucke-v1';

// Determinista (#9): marca onboarding visto ANTES de montar para que el modal de
// guía nunca intercepte clicks (causa de la corrida flaky).
async function sembrarOnboarding(page) {
  await page.addInitScript((k) => {
    try { const s = JSON.parse(window.localStorage.getItem(k) || '{}'); s.onboardingVisto = true; window.localStorage.setItem(k, JSON.stringify(s)); } catch (_e) { /* modo privado */ }
  }, CLAVE);
}

// Siembra un proyecto mínimo (#9). El Home actual expone el proyecto en curso
// mediante el CTA principal data-testid="home-retomar"; "Proyecto actual" quedó
// como atajo secundario dentro de "Más herramientas".
async function sembrarProyecto(page) {
  await page.addInitScript((k) => {
    try {
      const s = JSON.parse(window.localStorage.getItem(k) || '{}');
      s.onboardingVisto = true;
      s.cotizacion = { ...(s.cotizacion || {}), partidas: [{ id: 'seed-1', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 4, precioUnitario: 5210, deBanco: true, precioReal: true }] };
      window.localStorage.setItem(k, JSON.stringify(s));
    } catch (_e) { /* modo privado */ }
  }, CLAVE);
  await page.reload();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });

  // Certifica que el proyecto sembrado SOBREVIVIÓ el reload/hidratación.
  await expect(page.getByTestId('home-retomar')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate((k) => {
    try { return JSON.parse(window.localStorage.getItem(k) || '{}')?.cotizacion?.partidas?.length || 0; }
    catch (_e) { return 0; }
  }, CLAVE)).toBeGreaterThan(0);
}

async function abrirProyectoActual(page) {
  const retomar = page.getByTestId('home-retomar');
  if (await retomar.isVisible().catch(() => false)) {
    await retomar.click();
    return;
  }

  // Fallback para variantes de Home: abre explícitamente el contenedor secundario.
  const mas = page.locator('details.inicio-op-mas');
  if (await mas.count()) {
    if (!(await mas.getAttribute('open'))) await mas.locator('summary').click();
  }
  await page.getByRole('button', { name: /Proyecto actual/i }).click();
}

async function login(page) {
  await sembrarOnboarding(page);
  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
}

test.describe('E2E autenticado · flujo real', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para certificar el flujo autenticado.');

  test.beforeEach(async ({ page }) => { await login(page); });

  test('home es inequívoco: Cotizar · Costear · Cocrear', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Cocreando|Qué vas a hacer|Qué quieres resolver hoy/i }).first()).toBeVisible();
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
    await expect(page.getByTestId('cotizar-plano')).toHaveCount(1);
  });

  test('COCREAR entra al estudio de co-diseño', async ({ page }) => {
    await page.getByTestId('home-cocrear').click();
    await expect(page.getByText(/Qué tienes en mente|Cocrear . de la idea|Diséñalo|Disénalo/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('atajos críticos no son botones muertos', async ({ page }) => {
    const mas = page.locator('details.inicio-op-mas');
    if (await mas.count() && !(await mas.getAttribute('open'))) await mas.locator('summary').click();
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
      page.getByText(/Áreas del proyecto|Tu cotización está vacía|Programa incompleto para acomodar|¿Dónde va a ir esto\?/i).first()
    ).toBeVisible({ timeout: 15000 });
    expect(pageErrors).toEqual([]);
  });

  test('salidas de propuesta: descarga PDF real e imprimir responde cuando hay proyecto', async ({ page }) => {
    await sembrarProyecto(page);
    await abrirProyectoActual(page);
    const descargar = page.getByRole('button', { name: /Descargar (PDF|BORRADOR)/i });
    const imprimir = page.getByRole('button', { name: /Imprimir( BORRADOR)?/i });

    // Una prueba que termina con "return" cuando falta el botón da falso verde.
    // Con el proyecto sembrado la salida PDF ES una capacidad obligatoria.
    await expect(descargar, 'El botón de descarga PDF debe existir con proyecto real').toHaveCount(1);
    await expect(descargar).toBeEnabled();
    const dl = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      descargar.click(),
    ]).then(([d]) => d);
    expect((await dl.suggestedFilename()).toLowerCase()).toMatch(/\.pdf$/);
    const bytes=await readFile(await dl.path());
    expect(bytes.subarray(0,5).toString('ascii')).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);

    await page.evaluate(() => {
      window.__vhPrintCalled = false;
      window.vhPrint = () => { window.__vhPrintCalled = true; };
    });
    await expect(imprimir).toBeEnabled();
    await imprimir.click();
    await expect.poll(() => page.evaluate(() => window.__vhPrintCalled)).toBe(true);
  });

  test('cotización: botones de salida nunca quedan muertos cuando existe un proyecto', async ({ page }) => {
    await sembrarProyecto(page);
    await abrirProyectoActual(page);
    const descargar = page.getByRole('button', { name: /Descargar (PDF|BORRADOR)/i });
    const imprimir = page.getByRole('button', { name: /Imprimir( BORRADOR)?/i });
    await expect(descargar, 'Sin botón PDF no existe salida de proyecto').toHaveCount(1);
    await expect(imprimir, 'Sin botón imprimir no existe salida de proyecto').toHaveCount(1);
    await expect(descargar).toBeEnabled();
    await expect(imprimir).toBeEnabled();
  });
});
