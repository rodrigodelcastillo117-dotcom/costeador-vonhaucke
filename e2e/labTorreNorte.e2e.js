// ============================================================================
//  LABORATORIO · PLANO NUEVO "OFICINAS TORRE NORTE" (ARQ-01 + MOB-01), contra el cliente publicado.
//  NO es un golden: no afirma resultados, los REGISTRA (lectura, programa, acomodo, guardado, render, PDF)
//  para compararlos con la hoja de control. Sólo corre con LAB_PLANO=/ruta/al/plano.pdf.
//  No decide nada por la persona: aplica sólo lo que la app propone con un click, deja las ambigüedades.
// ============================================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const PLANO = process.env.LAB_PLANO;
const SALIDA = process.env.LAB_OUT || 'test-results-prod/lab-torre-norte';
const CLIENTE = process.env.LAB_CLIENTE || 'Torre Norte (laboratorio)';
// Prueba de Rodrigo 19-oct: la cotización puede arrancar con lo que ya se cotizó por texto (JSON de partidas).
const PARTIDAS_INICIALES = process.env.LAB_PARTIDAS_INICIALES ? JSON.parse(fs.readFileSync(process.env.LAB_PARTIDAS_INICIALES, 'utf8')) : [];
const CLAVE = 'costeador-vonhaucke-v1';
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
const guarda = (nombre, obj) => fs.writeFileSync(path.join(SALIDA, nombre), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));

test.describe('LAB · plano Torre Norte', () => {
  test.skip(!(EMAIL && PASS && PLANO), 'Define TEST_EMAIL, TEST_PASSWORD y LAB_PLANO.');
  test.setTimeout(25 * 60 * 1000);

  test('ARQ-01 + MOB-01: lectura → programa → acomodo → guardar → render → PDF → reabrir', async ({ page }) => {
    fs.mkdirSync(SALIDA, { recursive: true });
    const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    const edges = {}; let nubeOrigen = null, nubeApikey = null;
    page.on('request', (req) => { const u = req.url(); if (/\/rest\/v1\/rpc\//.test(u)) { try { nubeOrigen = new URL(u).origin; nubeApikey = req.headers().apikey || nubeApikey; } catch (_e) {} } });
    page.on('response', async (res) => {
      const u = res.url(); const m = u.match(/\/functions\/v1\/([a-z-]+)/); if (!m) return;
      const txt = await res.text().catch(() => '');
      (edges[m[1]] = edges[m[1]] || []).push({ status: res.status(), t: new Date().toISOString(), body: txt.slice(0, 400000) });
      console.log('[lab] edge', m[1], 'HTTP', res.status(), txt.length, 'bytes');
    });

    // 0) Cotización de prueba VACÍA.
    await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem('__lab')) { window.localStorage.setItem(k, JSON.stringify(v)); window.localStorage.setItem('__lab', '1'); } } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: PARTIDAS_INICIALES, cliente: CLIENTE } }]);
    await page.goto('/');
    await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
    await page.getByTestId('home-cotizar').click();
    const cliente = page.getByPlaceholder('Nombre del cliente');
    if (await cliente.count()) { await cliente.fill(CLIENTE); }

    // 1) Subir el PDF (ambas láminas en un archivo) SIN hoja de respuestas.
    const t0 = Date.now();
    await page.getByTestId('cotizar-plano').setInputFiles(PLANO);
    const gate = page.getByTestId('confirmar-lectura');
    const errorPlano = page.locator('text=/No se pudo procesar|no pude leer|Para que la lectura sea estable/i');
    await expect(gate.or(errorPlano).first()).toBeVisible({ timeout: 120000 });
    const tLectura = (Date.now() - t0) / 1000;
    if (!(await gate.count())) { guarda('ERROR_lectura.txt', await page.locator('main').innerText()); throw new Error('la lectura del plano falló: ' + (await errorPlano.first().innerText())); }
    const lectura = {
      segundos: tLectura,
      nivel: await page.getByTestId('lectura-nivel').innerText({ timeout: 1500 }).catch(() => ''),
      areas: await page.getByTestId('lectura-areas').innerText({ timeout: 1500 }).catch(() => ''),
      servidor: await page.getByTestId('lectura-servidor').innerText({ timeout: 1500 }).catch(() => ''),
      problemas: await page.getByTestId('lectura-problemas').innerText({ timeout: 1500 }).catch(() => ''),
      gate: await gate.innerText(),
    };
    guarda('1-lectura-gate.json', lectura);
    await page.screenshot({ path: path.join(SALIDA, '1-lectura-gate.png'), fullPage: true });
    console.log('[lab] lectura en', tLectura.toFixed(1), 's ·', lectura.nivel.replace(/\s+/g, ' '));

    // 1b) VH-136: si la compuerta ofrece confirmar puertas pendientes, se confirma como lo dice el plano
    //     (D08 = acceso doble de 1.80 m que abre hacia adentro). Es la decisión de la persona, registrada.
    const ctrls = page.getByTestId('puerta-confirmar');
    const nCtrl = await ctrls.count();
    const puertasConfirmadas = [];
    for (let i = 0; i < nCtrl; i++) {
      const c = ctrls.first();                     // al confirmar, el control desaparece de la lista
      const texto = await c.innerText();
      const doble = /doble/i.test(texto) && /vano (1\.[4-9]|[2-9])/.test(texto);
      await c.getByRole('button', { name: doble ? /Doble \(dos hojas\)/ : /Una hoja/ }).click();
      await c.getByRole('button', { name: /Hacia adentro/ }).click();
      await c.getByTestId('puerta-confirmar-ok').click();
      puertasConfirmadas.push({ texto: texto.replace(/\s+/g, ' ').slice(0, 200), doble, abre: 'adentro' });
    }
    guarda('1b-puertas-confirmadas.json', puertasConfirmadas);
    console.log('[lab] puertas confirmadas por la persona:', JSON.stringify(puertasConfirmadas));
    await page.screenshot({ path: path.join(SALIDA, '1b-puertas.png'), fullPage: true });

    // 2) Confirmar la lectura → paso 2 (Muebles): qué áreas quedaron y qué propone el programa del plano.
    await page.getByTestId('lectura-confirmar').click();
    await expect(gate).toBeHidden();
    await expect.poll(async () => (await leerCot(page))?.acomodo?.areasM?.length || 0, { timeout: 15000 }).toBeGreaterThan(0);
    const cotA = await leerCot(page);
    guarda('2-acomodo-tras-lectura.json', cotA.acomodo);
    console.log('[lab] puertas en estado:', JSON.stringify((cotA.acomodo.areasM || []).map((a) => [a.nombre, (a.puertas || []).map((q) => [q.x, q.y, q.ancho, q.tieneBarrido, q.sentido, q.doble || false]), (a.puertasPendientes || []).length])));
    await page.waitForTimeout(1500);
    const paso2 = await page.locator('main').innerText();
    guarda('2-paso2-muebles.txt', paso2);
    await page.screenshot({ path: path.join(SALIDA, '2-paso2-muebles.png'), fullPage: true });
    const panel = page.getByTestId('duplicados-programa');
    const panelTxt = (await panel.count()) ? await panel.first().innerText() : '(sin panel de programa)';
    guarda('2-programa-panel.txt', panelTxt);
    console.log('[lab] programa propuesto:', panelTxt.replace(/\s+/g, ' ').slice(0, 900));
    // 3) Aplicar sólo lo que la app propone con UN click (sin escribir muebles): ambigüedades se dejan registradas.
    const boton = page.getByRole('button', { name: /Aplicar programa detectado|Fusionar \d+ duplicado|Vincular lo que ya tengo/i });
    const antes = (await leerCot(page)).partidas.length;
    if ((await boton.count()) && (await boton.first().isEnabled().catch(() => false))) { await boton.first().click(); await page.waitForTimeout(1500); }
    // Un renglón que el plano reparte entre varios muebles (16 WIN para 2 bancos de 8): la persona aprieta "Repartir".
    const reparto = page.getByTestId('reparto-programa');
    const repartos = [];
    for (let i = 0; i < 4 && (await reparto.count()); i++) {
      const t = await reparto.first().innerText();
      repartos.push(t);
      console.log('[lab] reparto:', t.replace(/\s+/g, ' '));
      await reparto.first().getByRole('button', { name: /^Repartir/ }).click();
      await page.waitForTimeout(1500);
    }
    guarda('3-repartos.json', repartos);
    const cotB = await leerCot(page);
    guarda('3-partidas-tras-programa.json', cotB.partidas);
    console.log('[lab] partidas', antes, '→', cotB.partidas.length, JSON.stringify(cotB.partidas.map((p) => [p.nombre, p.cantidad, p.relation_role || null, p.precioUnitario ?? null])));
    const panel2 = (await panel.count()) ? await panel.first().innerText() : '';
    guarda('3-programa-panel-despues.txt', panel2);
    await page.screenshot({ path: path.join(SALIDA, '3-tras-programa.png'), fullPage: true });

    // 4) Acomodo con el solver real.
    const stepAcomodo = page.getByTestId('voni-paso-acomodo');
    await expect(stepAcomodo).toBeEnabled({ timeout: 15000 });
    await stepAcomodo.click();
    const acomodar = page.getByTestId('acomodo-acomodar');
    await expect(acomodar).toBeVisible({ timeout: 20000 });
    const acomodarOk = await acomodar.isEnabled().catch(() => false);
    console.log('[lab] botón Acomodar habilitado:', acomodarOk);
    if (acomodarOk) {
      await acomodar.click();
      await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.colocacion?.length ?? -1, { timeout: 120000 }).toBeGreaterThanOrEqual(0);
    }
    await page.waitForTimeout(2500);
    const cotC = await leerCot(page);
    guarda('4-acomodo.json', cotC.acomodo);
    const ver = page.getByTestId('veredicto-acomodo');
    // innerText SIN timeout espera para siempre si el elemento no existe (p. ej. sin diagnóstico cuando todo cupo).
    const veredicto = (await ver.count()) ? { estado: await ver.getAttribute('data-estado'), texto: await ver.innerText({ timeout: 3000 }).catch(() => '') } : null;
    const diag = await page.getByTestId('diagnostico-acomodo').innerText({ timeout: 3000 }).catch(() => '');
    guarda('4-veredicto.json', { veredicto, diagnostico: diag, main: await page.locator('main').innerText() });
    await page.screenshot({ path: path.join(SALIDA, '4-acomodo.png'), fullPage: true });
    const planta = page.getByRole('button', { name: /^Planta$/ });
    if (await planta.count()) { await planta.click(); await page.waitForTimeout(800); await page.screenshot({ path: path.join(SALIDA, '4-acomodo-planta.png'), fullPage: true }); }
    console.log('[lab] acomodo: colocadas', cotC.acomodo?.plan?.colocacion?.length ?? null, 'status', cotC.acomodo?.plan?.layoutSpec?.status, 'veredicto', veredicto?.estado);

    // 5) Guardado real (autosave) y lectura de la nube.
    await expect.poll(async () => (await leerCot(page))?.id || null, { timeout: 30000 }).not.toBeNull();
    const id = (await leerCot(page)).id;
    const leerNube = () => page.evaluate(async ([origen, apikey, idc]) => {
      const k = Object.keys(window.localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
      const tok = k ? (JSON.parse(window.localStorage.getItem(k) || '{}').access_token || null) : null;
      const r = await fetch(`${origen}/rest/v1/rpc/cotizacion_segura`, { method: 'POST', headers: { 'content-type': 'application/json', apikey, authorization: `Bearer ${tok}` }, body: JSON.stringify({ p_id: idc }) });
      const j = await r.json().catch(() => null);
      return { status: r.status, partidas: j?.partidas?.length ?? null, colocadas: j?.acomodo?.plan?.colocacion?.length ?? null, areas: j?.acomodo?.areasM?.length ?? null, cliente: j?.cliente };
    }, [nubeOrigen, nubeApikey, id]);
    await expect.poll(async () => (await leerNube()).colocadas, { timeout: 40000 }).toBe(cotC.acomodo?.plan?.colocacion?.length ?? null);
    const nube = await leerNube();
    guarda('5-nube.json', { id, ...nube });
    console.log('[lab] nube id', id, JSON.stringify(nube));

    // 6) Render por área (edge real; puede tardar). Tope 8 minutos.
    const btnRender = page.getByRole('button', { name: /Generar las \d+ áreas|Generar la imagen del área/ });
    let render = { intentado: false };
    if (process.env.LAB_SIN_RENDER === '1') render.omitido = 'LAB_SIN_RENDER=1 (renders medidos aparte: lab/noche/render_v6)';
    else if (await btnRender.count()) {
      render.intentado = true; const tr = Date.now();
      await btnRender.first().click();
      await expect(page.getByRole('button', { name: /Volver a generar|Generar las \d+ áreas|Generar la imagen del área/ })).toBeEnabled({ timeout: 8 * 60 * 1000 }).catch(() => {});
      render.segundos = (Date.now() - tr) / 1000;
      render.imagenes = await page.locator('img[alt*="área"], img[alt*="area"], figure img').count();
      render.escenasGuardadas = ((await leerCot(page))?.acomodo?.escenas || []).length;
      render.llamadas = (edges['generar-render'] || []).map((e) => e.status);
      // El "Guardar en la propuesta" de las ESCENAS vive junto a "Volver a generar" (hay otros dos para áreas/plan).
      const filaEsc = page.locator('.fila-botones', { has: page.getByRole('button', { name: /Volver a generar/ }) });
      const guardar = filaEsc.getByRole('button', { name: /Guardar en la propuesta/ });
      if (await guardar.count()) { await guardar.first().click(); render.guardado = true; await page.waitForTimeout(2500); }
      render.escenasGuardadas = ((await leerCot(page))?.acomodo?.escenas || []).filter((e) => e && (e.img || e.url)).length;
      await page.screenshot({ path: path.join(SALIDA, '6-render.png'), fullPage: true });
    }
    guarda('6-render.json', render);
    console.log('[lab] render', JSON.stringify(render));

    // 7) Propuesta y PDF.
    await page.getByTestId('acomodo-salida').click().catch(async () => page.getByTestId('voni-continuar-propuesta').click());
    const btnPdf = page.getByRole('button', { name: /Descargar PDF|Descargar BORRADOR/ });
    await expect(btnPdf).toBeVisible({ timeout: 20000 });
    const etiquetaPdf = await btnPdf.innerText();
    const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), btnPdf.click()]);
    const pdfPath = path.join(SALIDA, '7-propuesta.pdf'); await descarga.saveAs(pdfPath);
    guarda('7-propuesta.json', { boton: etiquetaPdf, bytes: fs.statSync(pdfPath).size, main: await page.locator('main').innerText() });
    await page.screenshot({ path: path.join(SALIDA, '7-propuesta.png'), fullPage: true });
    console.log('[lab] PDF', etiquetaPdf, fs.statSync(pdfPath).size, 'bytes');

    // 8) Reabrir desde otra "computadora". Antes se guarda la FIRMA de lo que quedó (identidad de cada partida y
    //    posición de cada mueble) para comparar campo a campo, no sólo conteos.
    await page.waitForTimeout(4000);   // último autosave
    const firma = (c) => ({
      partidas: (c?.partidas || []).map((p) => ({ k: `${p.productoId ?? ''}|${p.piezaId ?? ''}|${p.nombre ?? ''}`, cantidad: p.cantidad, precioUnitario: p.precioUnitario ?? null, costoUnitario: p.costoUnitario ?? null, sugerido: !!(p.sugerido || p.sugeridoPlano), noCobrar: !!p.noCobrar })).sort((a, b) => a.k.localeCompare(b.k)),
      colocacion: (c?.acomodo?.plan?.colocacion || []).map((x) => ({ id: x.id, area: x.area, x: Math.round(x.x), y: Math.round(x.y), rot: x.rot || 0, side: x.side || null })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
      escenas: (c?.acomodo?.escenas || []).map((e) => e.nombre || e.area || null),
    });
    const firmaAntes = firma(await leerCot(page));
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)), [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
    await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
    const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).first();
    await expect(tarjeta).toBeVisible({ timeout: 20000 });
    await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
    await expect.poll(async () => (await leerCot(page))?.id || null, { timeout: 20000 }).toBe(id);
    const cotD = await leerCot(page);
    const firmaDespues = firma(cotD);
    const difs = [];
    const porK = (L) => Object.fromEntries(L.map((x) => [x.k, x]));
    const pa = porK(firmaAntes.partidas), pd = porK(firmaDespues.partidas);
    for (const k of new Set([...Object.keys(pa), ...Object.keys(pd)])) if (JSON.stringify(pa[k]) !== JSON.stringify(pd[k])) difs.push({ tipo: 'partida', k, antes: pa[k] || null, despues: pd[k] || null });
    const ca = Object.fromEntries(firmaAntes.colocacion.map((x) => [x.id, x])), cd = Object.fromEntries(firmaDespues.colocacion.map((x) => [x.id, x]));
    for (const k of new Set([...Object.keys(ca), ...Object.keys(cd)])) if (JSON.stringify(ca[k]) !== JSON.stringify(cd[k])) difs.push({ tipo: 'colocacion', k, antes: ca[k] || null, despues: cd[k] || null });
    if (JSON.stringify(firmaAntes.escenas) !== JSON.stringify(firmaDespues.escenas)) difs.push({ tipo: 'escenas', antes: firmaAntes.escenas, despues: firmaDespues.escenas });
    const cobrablesSugeridas = firmaDespues.partidas.filter((p) => p.sugerido && !p.noCobrar).length;
    guarda('8-reabierta.json', { id: cotD.id, partidas: cotD.partidas.length, colocadas: cotD.acomodo?.plan?.colocacion?.length ?? null, areas: cotD.acomodo?.areasM?.length ?? null, escenas: (cotD.acomodo?.escenas || []).length, identica: difs.length === 0, diferencias: difs, cobrablesSugeridas, firmaAntes, firmaDespues });
    console.log('[lab] identidad tras reabrir', JSON.stringify({ identica: difs.length === 0, diferencias: difs.length, cobrablesSugeridas }));
    guarda('edges.json', edges);
    guarda('pageErrors.json', pageErrors);
    console.log('[lab] reabierta', JSON.stringify({ partidas: cotD.partidas.length, colocadas: cotD.acomodo?.plan?.colocacion?.length ?? null, errores: pageErrors.length }));
  });
});
