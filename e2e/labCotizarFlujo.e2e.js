// LABORATORIO · COTIZAR real (nube real, cuenta QA, nada simulado) para las entradas que no son plano:
//   LAB_MODO=texto   → Voni "Empezar por los muebles": LAB_TEXTO → cotizar-texto (Edge según VITE_COTIZAR_TEXTO_FN)
//   LAB_MODO=manual  → Banco de precios: LAB_BUSCAR="bench 6|mesa de juntas" (una búsqueda por renglón, "Agregar")
// Después: guardado real (autosave → RPC), lectura de la nube, PDF (BORRADOR o definitivo según la compuerta),
// reapertura desde "Presupuestos anteriores" con firma campo a campo, y cuántas partidas sugeridas quedaron cobrables.
// Registra, no maquilla: cada paso deja su JSON y su captura en LAB_OUT. No emite nada.
import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const MODO = process.env.LAB_MODO; const TEXTO = process.env.LAB_TEXTO || '';
const BUSCAR = (process.env.LAB_BUSCAR || '').split('|').map((s) => s.trim()).filter(Boolean);
const SALIDA = process.env.LAB_OUT || 'test-results-prod/lab-cotizar-flujo';
const CLIENTE = process.env.LAB_CLIENTE || `(lab 10) Cotizar ${MODO} ${new Date().toISOString().slice(0, 16)}`;
const CLAVE = 'costeador-vonhaucke-v1';
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
const guarda = (n, d) => fs.writeFileSync(path.join(SALIDA, n), typeof d === 'string' ? d : JSON.stringify(d, null, 1));
const firma = (c) => ({
  cliente: c?.cliente || null,
  partidas: (c?.partidas || []).map((p) => ({ k: `${p.productoId ?? ''}|${p.piezaId ?? ''}|${p.nombre ?? ''}`, cantidad: p.cantidad, precioUnitario: p.precioUnitario ?? null, costoUnitario: p.costoUnitario ?? null, sugerido: !!(p.sugerido || p.origen === 'sugerencia'), noCobrar: !!p.noCobrar })).sort((a, b) => a.k.localeCompare(b.k)),
});

test('COTIZAR real por texto o manual: partidas → guardar → nube → PDF → reabrir idéntico', async ({ page }) => {
  test.skip(!(EMAIL && PASS && (MODO === 'texto' ? TEXTO : MODO === 'manual' ? BUSCAR.length : false)), 'Define TEST_EMAIL, TEST_PASSWORD, LAB_MODO=texto + LAB_TEXTO o LAB_MODO=manual + LAB_BUSCAR.');
  test.setTimeout(10 * 60 * 1000); fs.mkdirSync(SALIDA, { recursive: true });
  const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
  const edges = []; let nubeOrigen = null, nubeApikey = null;
  page.on('request', (req) => { const u = req.url(); if (/\/rest\/v1\/rpc\//.test(u)) { try { nubeOrigen = new URL(u).origin; nubeApikey = req.headers().apikey || nubeApikey; } catch (_e) {} } });
  page.on('response', async (res) => {
    const m = res.url().match(/\/functions\/v1\/([a-z0-9-]+)/); if (!m) return;
    const txt = await res.text().catch(() => ''); edges.push({ fn: m[1], status: res.status(), t: Date.now(), body: txt.slice(0, 200000) });
    console.log('[lab-cot] edge', m[1], res.status(), txt.length, 'bytes');
  });
  const tiempos = {}; const T = (k, t0) => { tiempos[k] = (Date.now() - t0) / 1000; };
  await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem('__lab')) { window.localStorage.setItem(k, JSON.stringify(v)); window.localStorage.setItem('__lab', '1'); } } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 30000 });

  let entrada = {};
  if (MODO === 'texto') {
    await page.getByTestId('home-cotizar').click();
    const cliente = page.getByPlaceholder('Nombre del cliente'); if (await cliente.count()) await cliente.fill(CLIENTE);
    await page.getByRole('button', { name: /Empezar por los muebles/ }).click();
    const caja = page.locator('textarea.ia-textarea').first(); await expect(caja).toBeVisible({ timeout: 15000 });
    await caja.fill(TEXTO);
    const t0 = Date.now();
    await page.getByRole('button', { name: /Armar la lista de muebles/ }).click();
    const fin = page.getByText(/Agregué \d+ mueble|No pude armar ningún mueble/).first();
    await expect(fin).toBeVisible({ timeout: 180000 }); T('interpretarSeg', t0);
    entrada = { texto: TEXTO, resultado: await fin.innerText({ timeout: 5000 }), descartadas: await page.getByTestId('sugerencias-descartadas').innerText({ timeout: 2000 }).catch(() => ''), pantalla: (await page.locator('main').innerText({ timeout: 5000 }).catch(() => '')).slice(0, 6000) };
  } else {
    await page.getByText('Banco de precios', { exact: false }).first().click();
    const caja = page.getByPlaceholder(/Busca como se te ocurra/); await expect(caja).toBeVisible({ timeout: 15000 });
    entrada = { buscar: BUSCAR, agregados: [] };
    for (const q of BUSCAR) {
      await caja.fill(q); await page.waitForTimeout(600);
      const fila = page.locator('.banco-add').first();
      if (!(await fila.count())) { entrada.agregados.push({ q, agregado: null }); continue; }
      const nombre = await fila.locator('xpath=..').locator('.banco-nombre').innerText({ timeout: 2000 }).catch(() => '');
      await fila.getByRole('button', { name: /^Agregar$/ }).click(); await page.waitForTimeout(400);
      entrada.agregados.push({ q, agregado: nombre.replace(/\s+/g, ' ').slice(0, 160) });
    }
    await page.getByRole('button', { name: /Ver mi cotización/ }).first().click();
  }
  const cotA = await leerCot(page);
  guarda('1-entrada.json', { ...entrada, partidas: cotA?.partidas || [], tiempos });
  await page.screenshot({ path: path.join(SALIDA, '1-entrada.png'), fullPage: true });
  console.log('[lab-cot] partidas', (cotA?.partidas || []).map((p) => [p.nombre, p.cantidad, p.precioUnitario ?? null, p.sugerido || null]));

  // 2) Cotización: cliente (si la pantalla lo pide aquí) y guardado real.
  const verCot = page.getByRole('button', { name: /Ver mi cotización/ });
  if (await verCot.count()) await verCot.first().click().catch(() => {});
  const cli = page.getByPlaceholder(/cliente/i).first();
  if ((await cli.count()) && !(await cli.inputValue().catch(() => ''))) await cli.fill(CLIENTE);
  const tG = Date.now();
  await expect.poll(async () => (await leerCot(page))?.id || null, { timeout: 45000 }).not.toBeNull(); T('guardarSeg', tG);
  const id = (await leerCot(page)).id;
  await page.waitForTimeout(3000);
  const leerNube = () => page.evaluate(async ([origen, apikey, idc]) => {
    const k = Object.keys(window.localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
    const tok = k ? (JSON.parse(window.localStorage.getItem(k) || '{}').access_token || null) : null;
    const r = await fetch(`${origen}/rest/v1/rpc/cotizacion_segura`, { method: 'POST', headers: { 'content-type': 'application/json', apikey, authorization: `Bearer ${tok}` }, body: JSON.stringify({ p_id: idc }) });
    const j = await r.json().catch(() => null);
    return { status: r.status, partidas: j?.partidas?.length ?? null, cliente: j?.cliente ?? null, estado: j?.estado ?? null };
  }, [nubeOrigen, nubeApikey, id]);
  const nube = nubeOrigen ? await leerNube() : { sinOrigen: true };
  guarda('2-nube.json', { id, ...nube });
  console.log('[lab-cot] nube', id, JSON.stringify(nube));

  // 3) PDF: la compuerta decide BORRADOR o definitivo; se registra el porqué.
  const btnPdf = page.getByRole('button', { name: /Descargar PDF|Descargar BORRADOR/ }).first();
  await expect(btnPdf).toBeVisible({ timeout: 20000 });
  const etiquetaPdf = await btnPdf.innerText();
  const tP = Date.now();
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), btnPdf.click()]);
  const pdfPath = path.join(SALIDA, '3-propuesta.pdf'); await descarga.saveAs(pdfPath); T('pdfSeg', tP);
  const avisoPdf = await page.locator('.alerta, .aviso').filter({ hasText: /BORRADOR|NO REGISTRADO|emitir/i }).allInnerTexts().catch(() => []);
  guarda('3-propuesta.json', { boton: etiquetaPdf, bytes: fs.statSync(pdfPath).size, avisos: avisoPdf.map((s) => s.replace(/\s+/g, ' ').slice(0, 300)) });
  await page.screenshot({ path: path.join(SALIDA, '3-propuesta.png'), fullPage: true });

  // 4) Reabrir desde otra "computadora" y comparar firma.
  await page.waitForTimeout(4000);
  const firmaAntes = firma(await leerCot(page));
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)), [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
  const tR = Date.now();
  await page.reload();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
  await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
  const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: firmaAntes.cliente || CLIENTE }).first();
  await expect(tarjeta).toBeVisible({ timeout: 20000 });
  await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
  await expect.poll(async () => (await leerCot(page))?.id || null, { timeout: 20000 }).toBe(id); T('reabrirSeg', tR);
  const firmaDespues = firma(await leerCot(page));
  const difs = [];
  const porK = (L) => Object.fromEntries(L.map((x) => [x.k, x]));
  const pa = porK(firmaAntes.partidas), pd = porK(firmaDespues.partidas);
  for (const k of new Set([...Object.keys(pa), ...Object.keys(pd)])) if (JSON.stringify(pa[k]) !== JSON.stringify(pd[k])) difs.push({ k, antes: pa[k] || null, despues: pd[k] || null });
  if (firmaAntes.cliente !== firmaDespues.cliente) difs.push({ k: 'cliente', antes: firmaAntes.cliente, despues: firmaDespues.cliente });
  const cobrablesSugeridas = firmaDespues.partidas.filter((p) => p.sugerido && !p.noCobrar).length;
  guarda('4-reabierta.json', { id, identica: difs.length === 0, diferencias: difs, cobrablesSugeridas, firmaAntes, firmaDespues, tiempos });
  guarda('edges.json', edges); guarda('pageErrors.json', pageErrors);
  console.log('[lab-cot] RESUMEN', JSON.stringify({ modo: MODO, id, partidas: firmaDespues.partidas.length, identica: difs.length === 0, cobrablesSugeridas, pdf: etiquetaPdf, tiempos, pageErrors: pageErrors.length }));
  expect(pageErrors, 'sin errores de página').toEqual([]);
  expect(difs, 'la cotización reabierta es idéntica').toEqual([]);
});
