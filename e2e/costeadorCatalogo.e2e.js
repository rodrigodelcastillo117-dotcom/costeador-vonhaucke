// ============================================================================
//  VH-066 · Si la edge analizar-mueble usó el catálogo de respaldo del cliente
//  (`catalogoFuente: 'cliente-fallback'`), el Modo avanzado lo dice; antes callaba.
// ============================================================================
import { test, expect } from '@playwright/test';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'rodrigo@vh.mx': 'direccion' };

async function abrirModoAvanzado(browser, nube) {
  const context = await browser.newContext(); await nube.instalar(context);
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__s')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__s', '1'); } }, { k: CLAVE_LOCAL, v: estadoLocal() });
  const page = await context.newPage();
  await page.goto('/');
  await page.fill('#email-login', 'rodrigo@vh.mx'); await page.fill('#pass-login', 'prueba-123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /¿Cuánto nos cuesta fabricarlo\?/ }).first().click();   // abre el bloque Costear
  await page.getByRole('button', { name: /Costear a mano/i }).first().click();
  await expect(page.locator('#desc-voni')).toBeVisible({ timeout: 10000 });
  await page.fill('#desc-voni', 'Mesa de juntas de MDF 16 mm para 8 personas');
  await page.getByRole('button', { name: /Analizar con Voni/ }).click();
  return { context, page };
}

test('catálogo central caído: el Modo avanzado avisa "no cotices en firme"', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  nube.catalogoFuente = 'cliente-fallback';
  const { context, page } = await abrirModoAvanzado(browser, nube);
  await expect(page.getByTestId('catalogo-fallback')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('catalogo-fallback')).toContainText(/No cotices en firme/);
  await context.close();
});

test('catálogo canónico: sin aviso', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  const { context, page } = await abrirModoAvanzado(browser, nube);
  await expect(page.getByText(/Cubierta/).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('catalogo-fallback')).toHaveCount(0);
  await context.close();
});
