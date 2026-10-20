// LABORATORIO · reabrir un presupuesto con acomodo y generar los renders por área contra la edge
// configurada (producción o `generar-render-rc` vía VITE_GENERAR_RENDER_FN). Registra, no afirma:
// cuántas llamadas, cuántas pasaron el auditor, qué falló y si llegaron las referencias de producto.
import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const CLIENTE = process.env.LAB_CLIENTE; const SALIDA = process.env.LAB_OUT || 'test-results-prod/lab-render';
const CLAVE = 'costeador-vonhaucke-v1';
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
test('reabrir y generar renders por área', async ({ page }) => {
  test.skip(!(EMAIL && PASS && CLIENTE), 'Define TEST_EMAIL, TEST_PASSWORD y LAB_CLIENTE.');
  test.setTimeout(15 * 60 * 1000); fs.mkdirSync(SALIDA, { recursive: true });
  const edges = []; const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('response', async (res) => {
    const m = res.url().match(/\/functions\/v1\/([a-z0-9-]+)/); if (!m || !/render/.test(m[1])) return;
    const txt = await res.text().catch(() => ''); let j = null; try { j = JSON.parse(txt); } catch (_e) {}
    edges.push({ fn: m[1], status: res.status(), ok: j?.ok ?? null, code: j?.code ?? null, error: j?.error ?? null, audit: j?.audit ?? null, referencias: j?.referencias ?? null, con_dibujo: j?.con_dibujo ?? null, conteo: j?.conteo ?? null, conteoTexto: j?.conteoTexto ?? null, model: j?.model ?? null, bytes: j?.bytes ?? null });
    console.log('[lab-render] edge', m[1], res.status(), JSON.stringify({ ok: j?.ok, code: j?.code, referencias: j?.referencias, con_dibujo: j?.con_dibujo, conteoTexto: j?.conteoTexto, audit: j?.audit && { pass: j.audit.pass, layout: j.audit.layout_match, extra: j.audit.extra_objects, reasons: j.audit.reasons } }));
  });
  await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem('__lab')) { window.localStorage.setItem(k, JSON.stringify(v)); window.localStorage.setItem('__lab', '1'); } } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
  await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
  const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).first();
  await expect(tarjeta).toBeVisible({ timeout: 20000 });
  await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
  await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.colocacion?.length ?? 0, { timeout: 30000 }).toBeGreaterThan(0);
  // Un presupuesto reabierto cae en la vista clásica: el acomodo se abre con "Ver el acomodo en 3D";
  // si la app está en el flujo por pasos, el paso Acomodo de Voni.
  const ver3d = page.getByRole('button', { name: /Ver el acomodo en 3D/ });
  const stepAcomodo = page.getByTestId('voni-paso-acomodo');
  if (await ver3d.count()) await ver3d.first().click();
  else { await expect(stepAcomodo).toBeEnabled({ timeout: 15000 }); await stepAcomodo.click(); }
  const btnRender = page.getByRole('button', { name: /Generar las \d+ áreas|Generar la imagen del área/ });
  await expect(btnRender.first()).toBeVisible({ timeout: 20000 });
  const etiqueta = await btnRender.first().innerText();
  const tr = Date.now(); await btnRender.first().click();
  await expect(page.getByRole('button', { name: /Volver a generar|Generar las \d+ áreas|Generar la imagen del área/ })).toBeEnabled({ timeout: 10 * 60 * 1000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const cot = await leerCot(page);
  const resumen = {
    cliente: CLIENTE, boton: etiqueta, segundos: Math.round((Date.now() - tr) / 1000),
    fn: [...new Set(edges.map((e) => e.fn))], llamadas: edges.length, validas: edges.filter((e) => e.ok === true).length,
    fallas: edges.filter((e) => e.ok !== true).map((e) => e.code || (e.error || '').slice(0, 80)),
    referencias: edges.map((e) => e.referencias), con_dibujo: edges.map((e) => e.con_dibujo),
    imagenes: await page.locator('img[alt*="área"], img[alt*="area"], figure img').count(),
    escenasGuardadas: (cot?.acomodo?.escenas || []).length, pageErrors: pageErrors.length,
  };
  // Cinco etapas (Dirección 13-oct): generada · validada · persistida · reabierta · en PDF. Ninguna se infiere de otra.
  const etapas = { generadas: edges.filter((e) => e.status === 200 && (e.ok === true || e.code === 'RENDER_QA_FAILED')).length, validadas: edges.filter((e) => e.ok === true && e.audit?.pass === true).length, persistidas: 0, reabiertas: 0, enPdf: null };
  // Hay varios "Guardar en la propuesta" (staging de áreas/plan y el de las ESCENAS). El de las escenas vive en la
  // misma fila que "Volver a generar"; antes se pulsaba el primero (áreas/plan) y las escenas nunca se guardaban.
  const filaEscenas = page.locator('.fila-botones', { has: page.getByRole('button', { name: /Volver a generar/ }) });
  const guardar = filaEscenas.getByRole('button', { name: /Guardar en la propuesta/ });
  etapas.botonGuardarEscenas = await guardar.count();
  if (etapas.botonGuardarEscenas) { await guardar.first().click(); await page.waitForTimeout(2500); }
  // La app guarda cada escena como { nombre, m2, img } (img = dataURL local; al subir a la nube → URL de Storage).
  const imgDe = (e) => (e && (e.img || e.url || e.imagen || e.dataUrl)) || '';
  await expect.poll(async () => ((await leerCot(page))?.acomodo?.escenas || []).filter(imgDe).length, { timeout: 20000 }).toBeGreaterThan(0).catch(() => {});
  const escenas = (await leerCot(page))?.acomodo?.escenas || [];
  etapas.persistidas = escenas.filter(imgDe).length;
  etapas.escenas = escenas.map((e) => ({ area: e.area || e.nombre || null, img: String(imgDe(e)).slice(0, 90) }));
  // Espera a que el autosave suba las imágenes a Storage y guarde la fila (la reapertura lee la NUBE).
  await page.waitForTimeout(12000);
  // Reabrir desde otra pestaña (misma cuenta) y comprobar que las escenas vuelven y sus URLs cargan.
  const id = (await leerCot(page))?.id;
  if (id && etapas.persistidas) {
    const ctx2 = await page.context().browser().newContext(); const p2 = await ctx2.newPage();
    await p2.addInitScript(([k, v]) => { try { window.localStorage.setItem(k, JSON.stringify(v)); window.localStorage.setItem('__lab', '1'); } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
    await p2.goto('/'); await p2.fill('#email-login', EMAIL); await p2.fill('#pass-login', PASS); await p2.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(p2.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
    await p2.getByText('Presupuestos anteriores', { exact: false }).first().click();
    const t2 = p2.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).first(); await expect(t2).toBeVisible({ timeout: 20000 }); await t2.getByRole('button', { name: /^Abrir$/ }).click();
    await expect.poll(async () => (await leerCot(p2))?.id || null, { timeout: 30000 }).toBe(id);
    const esc2 = (await leerCot(p2))?.acomodo?.escenas || [];
    let cargan = 0;
    let enLinea = 0;
    // Se carga cada imagen EN EL NAVEGADOR reabierto (lo que ve la persona). p2.request.get no sirve aquí: su
    // cliente HTTP no pasa por la configuración del navegador y daba 0 aunque las URLs respondan 200.
    const urls = esc2.map(imgDe).filter((u) => /^https?:/.test(u)); enLinea = esc2.map(imgDe).filter((u) => /^data:image\//.test(u)).length;
    const okImgs = await p2.evaluate((us) => Promise.all(us.map((u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth > 0); i.onerror = () => r(false); i.src = u; }))), urls).catch(() => []);
    cargan = okImgs.filter(Boolean).length;
    etapas.reabiertas = cargan; etapas.reabiertasEscenas = esc2.length; etapas.reabiertasEnLinea = enLinea;
    // PDF desde la cotización reabierta: ¿incluye las imágenes? (bytes y, si hay pdftotext, conteo de /Image)
    const btnPdf = p2.getByRole('button', { name: /Descargar PDF|Descargar BORRADOR/ });
    if (await btnPdf.count()) {
      const ver3d = p2.getByRole('button', { name: /Ver la propuesta|Propuesta/ }); if (await ver3d.count()) { /* ya estamos en la vista clásica */ }
      const [d] = await Promise.all([p2.waitForEvent('download', { timeout: 120000 }), btnPdf.first().click()]).catch(() => [null]);
      if (d) { const out = path.join(SALIDA, 'propuesta.pdf'); await d.saveAs(out); const buf = fs.readFileSync(out); etapas.enPdf = { bytes: buf.length, imagenesEnPdf: (buf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length }; }
    }
    await ctx2.close();
  }
  fs.writeFileSync(path.join(SALIDA, 'edges.json'), JSON.stringify(edges, null, 2));
  fs.writeFileSync(path.join(SALIDA, 'resumen.json'), JSON.stringify({ ...resumen, etapas }, null, 2));
  await page.screenshot({ path: path.join(SALIDA, 'render.png'), fullPage: true });
  console.log('[lab-render]', JSON.stringify(resumen));
  console.log('[lab-render] ETAPAS', JSON.stringify(etapas));
});
