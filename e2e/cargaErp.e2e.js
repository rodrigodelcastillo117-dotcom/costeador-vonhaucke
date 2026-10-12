// ============================================================================
//  VH-089 · "Cargar compras del ERP" (Dirección): lee el .xlsx en el navegador, muestra el
//  resumen honesto (con costo / sin costo / certificables / preliminares) y manda lotes a la RPC.
// ============================================================================
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const FIX = path.resolve('src/datos/fixtures/erp_ultima_compra_mini.xlsx');

async function entrar(browser, nube, email, pass = 'prueba-123') {
  const context = await browser.newContext(); await nube.instalar(context);
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__s')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__s', '1'); } }, { k: CLAVE_LOCAL, v: estadoLocal() });
  const page = await context.newPage();
  await page.goto('/');
  await page.fill('#email-login', email); await page.fill('#pass-login', pass);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
  return { context, page };
}

test('Dirección sube el reporte del ERP: resumen correcto y carga por lotes a la RPC', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: { 'rodrigo@vh.mx': 'direccion' } });
  const { context, page } = await entrar(browser, nube, 'rodrigo@vh.mx');
  await page.getByText('Más herramientas').click();
  await page.getByRole('button', { name: /^Cargar compras del ERP/ }).click();
  await expect(page.getByTestId('carga-erp-archivo')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('carga-erp-archivo').setInputFiles(FIX);
  const resumen = page.getByTestId('carga-erp-resumen');
  await expect(resumen).toBeVisible({ timeout: 15000 });
  await expect(resumen).toContainText(/Renglones en el archivo\s*4/);
  await expect(resumen).toContainText(/Con costo \(entran\)\s*3/);
  await expect(resumen).toContainText(/Sin costo \(no entran, nunca \$0\)\s*1/);
  await expect(resumen).toContainText(/Compra ≤ 24 meses \(se certifican\)\s*2/);
  await expect(resumen).toContainText(/Bloqueados en el ERP \(entran inactivos\)\s*1/);
  await page.getByTestId('carga-erp-cargar').click();
  const res = page.getByTestId('carga-erp-resultado');
  await expect(res).toBeVisible({ timeout: 15000 });
  await expect(res).toContainText(/Insumos nuevos en el catálogo\s*3/);
  await expect(res).toContainText(/Precios nuevos\s*3/);
  await expect(res).toContainText(/certificados \(≤ 24 meses\)\s*2/);
  expect(nube.cargasErp.map((c) => c.documento)).toEqual(['erp_ultima_compra_mini.xlsx', 'erp_ultima_compra_mini.xlsx']);
  expect(nube.cargasErp[0].catalogo).toBe(3); expect(nube.cargasErp[1].precios).toBe(3);
  await context.close();
});

test('un archivo que no es el reporte del ERP se rechaza con explicación', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: { 'rodrigo@vh.mx': 'direccion' } });
  const { context, page } = await entrar(browser, nube, 'rodrigo@vh.mx');
  await page.getByText('Más herramientas').click();
  await page.getByRole('button', { name: /^Cargar compras del ERP/ }).click();
  await page.getByTestId('carga-erp-archivo').setInputFiles({ name: 'otro.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('no soy un zip') });
  await expect(page.getByTestId('carga-erp-error')).toBeVisible({ timeout: 10000 });
  await context.close();
});

test('un vendedor no ve el atajo de carga', async ({ browser }) => {
  const nube = crearNubeFalsa({ usuarios: { 'ventas@vh.mx': 'vendedor' } });
  const { context, page } = await entrar(browser, nube, 'ventas@vh.mx');
  await page.getByText('Más herramientas').click();
  await expect(page.getByRole('button', { name: /^Cargar compras del ERP/ })).toHaveCount(0);
  await context.close();
});
