// ============================================================================
//  COMPUERTA ÚNICA DE EMISIÓN (VH-047) · certificación en navegador real
//   - Dirección: cotización sana → "Verificar emisión" dice Lista → "Descargar PDF"
//     baja el documento Y el servidor conserva la revisión (snapshot = lo emitido).
//   - Vendedor: renglón sin precio → el botón está bloqueado ANTES de preguntar al
//     servidor, con el motivo a la vista; el servidor dice lo mismo.
//   - Lo que sólo el servidor sabe (costo desconocido) bloquea aunque el cliente no
//     lo vea: el PDF NO sale y no se conserva ninguna revisión.
//  Nube falsa con la semántica de private_api.evaluar_emision_cotizacion / emitir_revision_v2.
// ============================================================================
import { test, expect } from '@playwright/test';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'ventas@vh.mx': 'vendedor', 'rodrigo@vh.mx': 'direccion' };
const PASS = 'prueba-123';
const SANA = { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000, costoUnitario: 21000, margen: 30, costoDerivado: false };

async function sembrarLocal(context, estado) {
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__sembrado__')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__sembrado__', '1'); } }, { k: CLAVE_LOCAL, v: estado });
}
async function entrar(page, email) {
  await page.goto('/');
  await page.fill('#email-login', email);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
}
const inputCliente = (page) => page.locator('label.etiqueta', { hasText: /^Cliente$/ }).locator('xpath=following-sibling::input[1]');
async function abrirPrimeraDelArchivo(page) {
  await page.getByRole('button', { name: /Presupuestos que ya hicimos/i }).first().click();
  await expect(page.getByTestId('respaldo-local')).toBeVisible({ timeout: 10000 });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /^Abrir$/ }).first().click();
  await expect(inputCliente(page)).toBeVisible({ timeout: 10000 });
}
const botonPDF = (page) => page.locator('button.cot-pdf');
const verificar = (page) => page.getByRole('button', { name: /Verificar emisión/i });

async function abrirComo(browser, nube, email) {
  const ctx = await browser.newContext({ acceptDownloads: true }); await nube.instalar(ctx);
  await sembrarLocal(ctx, estadoLocal());
  const page = await ctx.newPage();
  await entrar(page, email);
  await abrirPrimeraDelArchivo(page);
  return { ctx, page };
}

test.describe('Compuerta única de emisión', () => {
  test('Dirección: lista para emitir → el PDF baja y el servidor conserva la revisión con el snapshot emitido', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const id = nube.sembrarFila({ usuario: 'rodrigo@vh.mx', cliente: 'Tradeco', partidas: [SANA], total: 55680, piezas: 1 });
    const { ctx, page } = await abrirComo(browser, nube, 'rodrigo@vh.mx');

    await expect(botonPDF(page)).toBeEnabled();
    await verificar(page).click();
    await expect(page.getByText(/Lista para emitir/)).toBeVisible({ timeout: 15000 });
    expect(nube.llamadas.some((l) => l.includes('/rpc/evaluar_emision_cotizacion'))).toBe(true);   // VH-055: mismo snapshot que la emisión

    const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), botonPDF(page).click()]);
    expect(descarga.suggestedFilename()).toMatch(/\.pdf$/i);
    await expect.poll(() => nube.revisiones.length, { timeout: 10000 }).toBe(1);
    const rev = nube.revisiones[0];
    expect(rev.cotizacion_id).toBe(id);
    expect(rev.tipo).toBe('generado_v2');
    expect(rev.snapshot.partidas).toHaveLength(1);
    expect(rev.snapshot.partidas[0]).toMatchObject({ id: 'p1', cantidad: 1, precioUnitario: 48000 });
    // El total conservado es la escalera exacta del desglose (regla del servidor).
    const t = rev.snapshot.totales; const nz = (x) => Number(x) || 0;
    expect(rev.total).toBe(Math.round((nz(t.precioLista) - nz(t.descuento) + nz(t.contingencia) + nz(t.maniobras) + nz(t.flete) + nz(t.iva)) * 100) / 100);
    expect(rev.snapshot.total).toBe(rev.total);
    expect(page.locator('.aviso.rojo')).toHaveCount(0);
    await ctx.close();
  });

  test('Vendedor: renglón sin precio → bloqueado localmente con el motivo a la vista; el servidor coincide', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Acme', partidas: [{ id: 'p2', nombre: 'Especial a medida', cantidad: 1, precioUnitario: null }], total: 0, piezas: 1 });
    const { ctx, page } = await abrirComo(browser, nube, 'ventas@vh.mx');

    await expect(botonPDF(page)).toBeDisabled();
    await expect(botonPDF(page)).toHaveAttribute('title', /no tiene un precio válido/);
    await expect(page.getByText(/No se puede emitir todavía/).first()).toBeVisible();
    await page.getByRole('button', { name: /¿Por qué no puedo emitir\?/ }).click();
    await expect(page.getByText(/"Especial a medida" no tiene un precio válido/)).toBeVisible();

    await verificar(page).click();
    await expect(page.getByText(/Línea 1: falta un precio válido/)).toBeVisible({ timeout: 15000 });
    expect(nube.revisiones).toHaveLength(0);
    await ctx.close();
  });

  test('Lo que sólo el servidor sabe (costo desconocido) bloquea: no sale PDF ni se conserva revisión', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    // Fila sin costo interno: para el cliente está sana (cantidad y precio válidos).
    nube.sembrarFila({ usuario: 'rodrigo@vh.mx', cliente: 'Sin costo SA', partidas: [{ id: 'p3', nombre: 'Recepción curva', cantidad: 1, precioUnitario: 32000 }], total: 37120, piezas: 1 });
    const { ctx, page } = await abrirComo(browser, nube, 'rodrigo@vh.mx');

    await expect(botonPDF(page)).toBeEnabled();      // local: nada que objetar
    await verificar(page).click();
    await expect(page.getByText(/Faltan datos para cotizar/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Línea 1: falta confirmar el costo con Diseño\/Dirección/)).toBeVisible();

    let bajo = false; page.once('download', () => { bajo = true; });
    await botonPDF(page).click();
    await expect(page.getByText(/No se puede emitir: Faltan datos para cotizar/)).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    expect(bajo).toBe(false);
    expect(nube.revisiones).toHaveLength(0);
    expect(nube.llamadas.some((l) => l.includes('/rpc/emitir_revision'))).toBe(false);
    await ctx.close();
  });
});

test.describe('Aprobación de Dirección (VH-055)', () => {
  test('margen bajo → requiere aprobación → el vendedor la pide desde la cotización → Dirección aprueba → emite; el hash aprobado es el hash emitido', async ({ browser }) => {
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    // Precio 25,000 sobre costo 21,000 = 16 % de margen (< 25 %): requiere aprobación.
    const id = nube.sembrarFila({ usuario: 'ventas@vh.mx', cliente: 'Margen Bajo SA', partidas: [{ id: 'p5', nombre: 'Mesa de juntas', cantidad: 1, precioUnitario: 25000, costoUnitario: 21000, margen: 16 }], total: 29000, piezas: 1 });
    const { ctx, page } = await abrirComo(browser, nube, 'ventas@vh.mx');

    await expect(botonPDF(page)).toBeEnabled();   // local: nada que objetar (el vendedor no ve el costo)
    await verificar(page).click();
    await expect(page.getByText(/Requiere aprobación de Dirección antes de emitir/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Línea 1: requiere aprobación de Dirección/)).toBeVisible();
    expect(nube.llamadas.some((l) => l.includes('/rpc/evaluar_emision_cotizacion'))).toBe(true);

    // El PDF no sale sin aprobación.
    await botonPDF(page).click();
    await expect(page.getByText(/No se puede emitir: Requiere aprobación/)).toBeVisible({ timeout: 15000 });
    expect(nube.revisiones).toHaveLength(0);

    // Pide la aprobación desde la cotización.
    await page.getByTestId('solicitar-aprobacion').locator('input').fill('Cliente estratégico, igualamos competencia');
    await page.getByRole('button', { name: /Solicitar aprobación a Dirección/ }).click();
    await expect(page.getByTestId('aprobacion-msg')).toHaveText(/Solicitud enviada \(#1\)/, { timeout: 15000 });
    expect(nube.aprobaciones).toHaveLength(1);
    expect(nube.aprobaciones[0]).toMatchObject({ cotizacion_id: id, estado: 'PENDIENTE', solicitado_por: 'ventas@vh.mx', motivo: 'Cliente estratégico, igualamos competencia', reglas_version: 1 });
    // Pedirla otra vez para la misma versión no duplica.
    await page.getByRole('button', { name: /Solicitar aprobación a Dirección/ }).click();
    await expect(page.getByTestId('aprobacion-msg')).toHaveText(/Ya había una solicitud pendiente/, { timeout: 15000 });
    expect(nube.aprobaciones).toHaveLength(1);

    // Dirección aprueba (misma regla que resolver_aprobacion: sólo PENDIENTE, sólo Dirección).
    nube.resolverAprobacion(1, 'APROBADA', 'rodrigo@vh.mx');

    // El vendedor vuelve a verificar: ahora está lista, y emite.
    await verificar(page).click();
    await expect(page.getByText(/Lista para emitir/)).toBeVisible({ timeout: 15000 });
    const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), botonPDF(page).click()]);
    expect(descarga.suggestedFilename()).toMatch(/\.pdf$/i);
    await expect.poll(() => nube.revisiones.length, { timeout: 10000 }).toBe(1);
    expect(nube.revisiones[0].hash).toBe(nube.aprobaciones[0].revision_hash);   // la versión aprobada ES la emitida
    expect(nube.revisiones[0].snapshot.partidas[0]).not.toHaveProperty('costoUnitario');   // el vendedor nunca mandó economía
    await ctx.close();
  });
});
