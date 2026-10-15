// LABORATORIO · ciclo COSTEAR real (P0-C): imagen de mueble → Voni → BOM → material ERP a mano →
// costo del motor → sombra costear-servidor (paridad a centavos) → guardar expediente → biblioteca →
// reabrir → comparar. Registra, no afirma: cada paso deja su evidencia en LAB_OUT. Sólo con
// LAB_COSTEAR_IMG + TEST_EMAIL/TEST_PASSWORD (cuenta QA). Gasta 1–2 llamadas de IA.
import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { auditarLlamadasCorrida, costeableDeHoja, argumentosViteValidos, CONFIG_PLAYWRIGHT_CONGELADO } from '../src/datos/holdoutHuellas.js';
import { servidorEnPuerto } from './servidorVite.js';
// LAB_HOJA = hoja de control (lab/costear/hojas_control/*.json): fixture, respuestas CON EVIDENCIA del plano, pieza ERP a
// mano y BOM esperado. Con hoja, el laboratorio sólo contesta lo que el plano demuestra; lo demás queda por confirmar.
const HOJA = process.env.LAB_HOJA ? JSON.parse(fs.readFileSync(process.env.LAB_HOJA, 'utf8')) : null;
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD; const IMG = process.env.LAB_COSTEAR_IMG || (HOJA && (HOJA.fixture || (HOJA.texto ? 'texto' : null)));
const SALIDA = process.env.LAB_OUT || 'test-results-prod/lab-costear';
const NOMBRE = process.env.LAB_COSTEAR_NOMBRE || `Credenza Nogal (lab P0-C ${new Date().toISOString().slice(0, 16)})`;
const ERP_BUSCAR = process.env.LAB_ERP_BUSCAR || (HOJA ? HOJA.erp?.buscar : null) || 'MDF NATURAL 9 mm';
const ERP_PATRON = new RegExp(process.env.LAB_ERP_PATRON || (HOJA ? HOJA.erp?.patron : null) || 'MDF8|ESPESOR 9 mm', 'i');
const ERP_PIEZA = new RegExp((HOJA ? HOJA.erp?.pieza : null) || 'respaldo|9 mm', 'i');
const HAY_ERP_A_MANO = !HOJA || !!HOJA.erp;
const pesosNum = (t) => { const m = String(t || '').replace(/[^0-9.,-]/g, '').replace(/,/g, ''); const n = Number(m); return Number.isFinite(n) ? n : null; };
const CLAVE = 'costeador-vonhaucke-v1';
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
const guarda = (n, o) => fs.writeFileSync(path.join(SALIDA, n), typeof o === 'string' ? o : JSON.stringify(o, null, 2));

async function leerPiezas(page) {
  const filas = page.locator('.pieza'); const n = await filas.count(); const out = [];
  for (let i = 0; i < n; i++) {
    const f = filas.nth(i);
    const nombre = await f.locator('.pieza-nom').inputValue().catch(() => '');
    const sel = f.locator('select.pieza-mat');
    const material = (await sel.count()) ? await sel.evaluate((s) => s.options[s.selectedIndex]?.textContent || '') : '';
    const alertas = await f.getByTestId('alerta-material').allInnerTexts().catch(() => []);
    out.push({ nombre, material: material.trim(), alertas: alertas.map((a) => a.trim()).filter(Boolean) });
  }
  return out;
}
async function leerResultado(page) {
  const main = await page.locator('main').innerText().catch(() => '');
  const precios = await page.locator('.precio-enorme').allInnerTexts().catch(() => []);
  const margen = await page.getByTestId('costear-margen').innerText({ timeout: 1000 }).catch(() => null);
  const estado = (main.match(/COSTO (INCOMPLETO|CERTIFICADO|PRELIMINAR|VALIDADO|BLOQUEADO)[^\n]*/i) || [])[0] || null;
  const linea = (main.match(/Material \$[^\n]*/) || [])[0] || null;
  const estado3 = await page.getByTestId('estado-costo-detalle').innerText({ timeout: 1000 }).catch(() => null);
  const validadores = await page.locator('[data-testid^="validador-"]').allInnerTexts().catch(() => []);
  return { precios: precios.map((x) => x.trim()), margen, estado, estado3, validadores, linea, pendiente: /\bPendiente\b/.test(precios.join(' ')), porConfirmar: /Por confirmar/.test(precios.join(' ')) };
}

test('COSTEAR real: imagen → BOM → ERP a mano → costo → sombra → guardar → reabrir', async ({ page }, testInfo) => {
  test.skip(!(EMAIL && PASS && IMG), 'Define TEST_EMAIL, TEST_PASSWORD y LAB_COSTEAR_IMG.');
  test.setTimeout(12 * 60 * 1000); fs.mkdirSync(SALIDA, { recursive: true });
  const edges = []; const rest = []; const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('response', async (res) => {
    const u = res.url();
    const m = u.match(/\/functions\/v1\/([a-z0-9-]+)/);
    if (m) { let j = null; try { j = await res.json(); } catch (_e) {} let req = null; try { req = m[1].startsWith('costear-servidor') ? JSON.parse(res.request().postData() || 'null') : null; } catch (_e) {} edges.push({ fn: m[1], status: res.status(), body: j, req }); console.log('[lab-costear] edge', m[1], res.status(), JSON.stringify(j || {}).slice(0, 300)); return; }
    if (/\/rest\/v1\/expedientes/.test(u) && res.request().method() !== 'GET') { let j = null; try { j = await res.json(); } catch (_e) {} rest.push({ method: res.request().method(), status: res.status(), body: j }); console.log('[lab-costear] expedientes', res.request().method(), res.status(), JSON.stringify(j || {}).slice(0, 200)); }
  });
  await page.addInitScript(() => { try { const k = 'costeador-vonhaucke-v1'; const s = JSON.parse(window.localStorage.getItem(k) || '{}'); s.onboardingVisto = true; window.localStorage.setItem(k, JSON.stringify(s)); } catch (_e) {} });
  await page.goto('/');
  // Holdout v4 (P1-04): el SHA que sirve el navegador es el que se congeló (correr.sh exporta LAB_GIT_SHA).
  const textoVersion = await page.getByText(/^v\S+ · \S+$/).first().innerText().catch(() => '');
  const shaApp = (textoVersion.match(/ · (\S+)$/) || [])[1] || null;
  // v5.3 (P1): `reintento` queda en la evidencia y, con hoja (holdout), un reintento FALLA: la evidencia sólo puede salir del
  // primer intento, sin importar `retries` del config, `--retries` o `CI=1`.
  // También el árbol de git (sin cambios sin commit) y el import.meta.env que el servidor de desarrollo inyecta de verdad
  // (cubre .env ignorados por git y variables VITE_ extra al lanzar Vite). Los valores con pinta de secreto no se guardan.
  let arbolLimpio = null; try { arbolLimpio = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim() === ''; } catch (_e) {}
  let entornoVite = null;
  try {
    const fuente = await (await page.request.get('/src/datos/conflictoGuardado.js')).text();
    const m = fuente.match(/import\.meta\.env = (\{[^;]*\});/);
    if (m) entornoVite = Object.fromEntries(Object.entries(JSON.parse(m[1])).map(([k, v]) => [k, /KEY|SECRET|TOKEN|PASS/i.test(k) ? '<redactado>' : v]));
  } catch (_e) {}
  // v5.4: el config que Playwright CARGÓ (un playwright.config.ts sin versionar le gana al .js congelado) y el servidor que
  // contestó (con reuseExistingServer puede ser de otro checkout).
  let raiz = null; try { raiz = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch (_e) {}
  const configPlaywright = raiz && testInfo.config.configFile ? path.relative(raiz, testInfo.config.configFile) : null;
  let servidor = null; try { servidor = raiz ? servidorEnPuerto(new URL(page.url()).port || 80, raiz) : null; } catch (_e) {}
  guarda('0-binario.json', { shaApp, shaGit: process.env.LAB_GIT_SHA || null, baseURL: page.url(), fecha: new Date().toISOString(), reintento: testInfo.retry, arbolLimpio, entornoVite, configPlaywright, servidor });
  if (HOJA) {
    expect(testInfo.retry, 'holdout: la evidencia sólo vale del primer intento (sin reintentos)').toBe(0);
    expect(arbolLimpio, 'holdout: el árbol de git tiene cambios sin commit').toBe(true);
    expect(configPlaywright, 'holdout: Playwright no cargó el config congelado').toBe(CONFIG_PLAYWRIGHT_CONGELADO);
    expect(servidor?.mismoCheckout, 'holdout: el servidor de Vite no es de este checkout').toBe(true);
    expect(argumentosViteValidos(servidor?.argumentos), `holdout: Vite lanzado con argumentos no permitidos (${servidor?.argumentos?.join(' ')})`).toBe(true);
  }
  if (process.env.LAB_GIT_SHA) expect(shaApp, 'el navegador no sirve el SHA congelado').toBe(process.env.LAB_GIT_SHA);
  await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 30000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
  await page.getByTestId('home-costear').click();
  await expect(page.getByTestId('costear-archivo')).toBeAttached({ timeout: 15000 });

  // 0) Lote (hoja.piezas): "¿Cuántas piezas iguales?" antes de analizar, como lo haría la persona.
  const LOTE = Math.max(1, Number(HOJA?.piezas) || 1);
  for (let i = 1; i < LOTE; i++) await page.getByRole('button', { name: 'mas' }).click();
  // 1) Imagen/PDF → Voni (analizar-mueble). La subida dispara el análisis. Con hoja.texto (sin archivo) se
  //    describe el mueble y se pulsa "Analizar con Voni" (flujo de texto, misma Edge).
  const esperaAn = page.waitForResponse((r) => r.url().includes('/functions/v1/analizar-mueble'), { timeout: 180000 });
  const t0 = Date.now();
  if (HOJA?.texto) {
    await page.locator('#costear-descripcion').fill(HOJA.texto);
    await page.getByRole('button', { name: /Analizar con Voni/ }).click();
  } else await page.getByTestId('costear-archivo').setInputFiles(IMG);
  const an = await esperaAn; const anBody = await an.json().catch(() => null);
  const tiempos = { analizarSeg: (Date.now() - t0) / 1000 };
  console.log('[lab-costear] analizar-mueble', an.status(), 'en', tiempos.analizarSeg.toFixed(0), 's · piezas', anBody?.propuesta?.piezas?.length, '· lote', LOTE);
  await expect(page.locator('.pieza').first()).toBeVisible({ timeout: 150000 });   // análisis + verificación pueden sumar >60 s
  tiempos.bomVisibleSeg = (Date.now() - t0) / 1000;
  await page.waitForTimeout(5000);   // verificación / amarre ERP automático
  const piezas1 = await leerPiezas(page); const res1 = await leerResultado(page);
  guarda('1-bom-inicial.json', { piezas: piezas1, resultado: res1, analizar: { status: an.status(), piezas: anBody?.propuesta?.piezas?.length, producto: anBody?.propuesta?.producto, uso: anBody?.uso }, tiempos, lote: LOTE, entrada: HOJA?.texto ? 'texto' : (/\.pdf$/i.test(String(IMG)) ? 'pdf' : 'imagen') });
  await page.screenshot({ path: path.join(SALIDA, '1-bom-inicial.png'), fullPage: true });
  console.log('[lab-costear] BOM inicial', JSON.stringify({ piezas: piezas1.length, pendientes: piezas1.filter((p) => p.alertas.some((a) => /⚠ /.test(a))).map((p) => p.nombre), resultado: res1 }));

  // 2) Material ERP a mano para la pieza pendiente (respaldo MDF 9 mm → ERP MDF NATURAL 9 mm).
  let erp = { intentado: false };
  const filas = page.locator('.pieza'); const n = await filas.count();
  let idx = -1;
  if (HAY_ERP_A_MANO) for (let i = 0; i < n; i++) { const nom = (await filas.nth(i).locator('.pieza-nom').inputValue().catch(() => '')).toLowerCase(); if (ERP_PIEZA.test(nom)) { idx = i; break; } }
  if (HAY_ERP_A_MANO && idx < 0 && !HOJA) for (let i = 0; i < n; i++) { const al = await filas.nth(i).getByTestId('alerta-material').allInnerTexts().catch(() => []); if (al.some((a) => /⚠ /.test(a))) { idx = i; break; } }
  if (idx >= 0 && (await filas.nth(idx).getByTestId('buscar-insumo-abrir').count())) {
    erp.intentado = true; erp.pieza = await filas.nth(idx).locator('.pieza-nom').inputValue();
    await filas.nth(idx).getByTestId('buscar-insumo-abrir').click();
    const caja = filas.nth(idx).getByTestId('buscador-insumo').locator('input[type=search]');
    await caja.fill(ERP_BUSCAR);
    const lista = filas.nth(idx).locator('.buscador-insumo-lista li');
    await expect(lista.first()).toBeVisible({ timeout: 20000 }).catch(() => {});
    erp.resultados = await lista.allInnerTexts().catch(() => []);
    const li = lista.filter({ hasText: ERP_PATRON }).first();
    if (await li.count()) { erp.elegido = (await li.innerText()).replace(/\s+/g, ' ').slice(0, 160); await li.getByRole('button', { name: /^Usar$/ }).click(); await page.waitForTimeout(3000); }
    else erp.elegido = null;
  }
  const piezas2 = await leerPiezas(page); const res2 = await leerResultado(page);
  guarda('2-tras-erp.json', { erp, piezas: piezas2, resultado: res2 });
  await page.screenshot({ path: path.join(SALIDA, '2-tras-erp.png'), fullPage: true });
  console.log('[lab-costear] tras ERP', JSON.stringify({ erp: { ...erp, resultados: (erp.resultados || []).length }, resultado: res2 }));

  // 2b) Preguntas de Voni (decisiones de material que el catálogo no resuelve solo). En el laboratorio las
  //     contesta la cuenta QA (rol Dirección) con la opción realista de taller y queda registrado como decisión
  //     humana, no como dato del plano: 18 mm pedido → "MDF 19 + chapa" (alternativa de casa), chapa natural,
  //     base "Patas + travesaños", respaldo "MDF 9 mm".
  const respuestas = [];
  // Cada pregunta trae chips (radio) o un número. Decisión humana del laboratorio: en radios se elige la opción
  // que conserva lo pedido (nogal/chapa/19 mm como alternativa de casa) o la primera que no sea "Otro"; en números,
  // lo que dice el plano del fixture (2 divisiones internas, 4 niveladores).
  const bloques = page.locator('div:has(> div > span.chip:text-matches("^IMPACTO"))');
  const nB = await bloques.count();
  for (let i = 0; i < nB; i++) {
    const bq = bloques.nth(i); const pregunta = (await bq.locator('div[style*="font-weight: 600"]').first().innerText().catch(() => '')).trim();
    // La pieza que ya se resolvió a mano con el ERP (respaldo 9 mm) no se vuelve a decidir aquí: la IA no ve el ERP.
    if (erp.elegido && /respaldo|(^|[^0-9])9 ?mm/i.test(pregunta)) { respuestas.push({ pregunta, elegido: '(sin responder: ya resuelta con ERP)' }); continue; }
    const chips = bq.locator('button.chip');
    const num = bq.locator('input[type=number]');
    if (HOJA) {
      // Sólo lo que el plano demuestra (hoja de control). Sin evidencia → no se contesta (queda por confirmar).
      const candidatas = (HOJA.respuestas || []).filter((x) => new RegExp(x.patron, 'i').test(pregunta));
      if (!candidatas.length) { respuestas.push({ pregunta, elegido: '(sin responder: el plano no lo dice)' }); continue; }
      if (await chips.count()) {
        const textos = (await chips.allInnerTexts()).map((t) => t.trim());
        // Se prueba cada respuesta con evidencia que aplica a la pregunta hasta que una opción coincida.
        let op = null, r = candidatas[0];
        for (const x of candidatas) { const o = x.opcion ? textos.find((t) => new RegExp(x.opcion, 'i').test(t)) : null; if (o) { op = o; r = x; break; } }
        if (op) { await chips.filter({ hasText: new RegExp('^' + op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click(); respuestas.push({ pregunta, elegido: op, opciones: textos, evidencia: r.evidencia }); }
        else respuestas.push({ pregunta, elegido: '(sin responder: ninguna opción coincide con el plano)', opciones: textos, evidencia: r.evidencia });
      } else if ((await num.count()) && candidatas.some((x) => x.valor != null)) { const r = candidatas.find((x) => x.valor != null); await num.fill(String(r.valor)); respuestas.push({ pregunta, elegido: String(r.valor), evidencia: r.evidencia }); }
      else respuestas.push({ pregunta, elegido: '(sin responder)', evidencia: candidatas[0].evidencia });
      continue;
    }
    if (await chips.count()) {
      const textos = (await chips.allInnerTexts()).map((t) => t.trim());
      const noVale = (t) => /^otro$|por definir|pendiente/i.test(t);
      let elegido = textos.find((t) => /nogal|chapa|19/i.test(t) && !noVale(t)) || textos.find((t) => !noVale(t)) || null;
      if (elegido) { await chips.filter({ hasText: new RegExp('^' + elegido.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click(); respuestas.push({ pregunta, elegido, opciones: textos }); }
    } else if (await num.count()) {
      // Datos del plano del fixture (no inventados): 3 módulos con 1 entrepaño c/u, 2 divisiones, base PTR marco
      // 2×(1.80+0.45) + 4 patas de 0.10 ≈ 5 m, 6 bisagras, 3 jaladeras, 4 niveladores.
      const v = /divis/i.test(pregunta) ? '2' : /entrepa/i.test(pregunta) ? '3' : /nivelador|pata/i.test(pregunta) ? '4' : /ptr|desarrollo|metros|tubo/i.test(pregunta) ? '5' : /bisagra/i.test(pregunta) ? '6' : /jaladera/i.test(pregunta) ? '3' : /puerta/i.test(pregunta) ? '3' : null;
      if (v) { await num.fill(v); respuestas.push({ pregunta, elegido: v }); }
    }
  }
  const aplicar = page.getByRole('button', { name: /Aplicar respuestas y recalcular/ });
  if (respuestas.some((r) => !/sin responder/.test(String(r.elegido))) && (await aplicar.count())) {
    // Aplicar manda las respuestas a la IA (responderDespiece): otra llamada a analizar-mueble, 20–60 s.
    const esperaRe = page.waitForResponse((r) => r.url().includes('/functions/v1/analizar-mueble'), { timeout: 180000 }).catch(() => null);
    await aplicar.click(); const re = await esperaRe; console.log('[lab-costear] recalculo', re ? re.status() : 'sin respuesta');
    await page.waitForTimeout(5000);
  }
  console.log('[lab-costear] respuestas', JSON.stringify(respuestas));

  // 3) Confirmación humana (QA = Dirección) de los materiales propuestos por regla, si la app lo ofrece.
  let confirmacion = { ofrecida: false, respuestas };
  const btnConf = page.getByTestId('piloto-confirmar');
  if (await btnConf.count()) { confirmacion = { ofrecida: true, texto: await btnConf.first().innerText() }; await btnConf.first().click(); await page.waitForTimeout(3000); }
  // VH-158: lo que DIFIERE de lo pedido no entra al bloque. El laboratorio lo registra y, por omisión, NO lo
  // acepta (la cuenta QA no simula decisiones de diseño). LAB_ACEPTAR_DIFERENCIAS=1 sólo para medir mecánica.
  const conDif = page.getByTestId('piloto-con-diferencia');
  confirmacion.diferencias = (await conDif.count()) ? await conDif.first().innerText() : '';
  confirmacion.diferenciasAceptadas = 0;
  if (process.env.LAB_ACEPTAR_DIFERENCIAS === '1') {
    for (let k = 0; k < 20 && (await page.getByTestId('confirmar-con-diferencia').count()); k++) { await page.getByTestId('confirmar-con-diferencia').first().click(); await page.waitForTimeout(800); confirmacion.diferenciasAceptadas++; }
  }
  const piezas3 = await leerPiezas(page); const res3 = await leerResultado(page);
  guarda('3-tras-confirmar.json', { confirmacion, piezas: piezas3, resultado: res3 });
  await page.screenshot({ path: path.join(SALIDA, '3-tras-confirmar.png'), fullPage: true });
  console.log('[lab-costear] tras confirmar', JSON.stringify({ confirmacion, resultado: res3 }));

  // 3b) Paso Precio (la pantalla va por pasos: 0 describir · 1 despiece/materiales · 3 precio + biblioteca).
  // "Ver precio ›" salta directo al paso 3; si no está, "Siguiente ›" avanza un paso a la vez (máx. 3).
  await expect(page.getByRole('button', { name: /Ver precio|Siguiente/ }).first()).toBeVisible({ timeout: 60000 });
  for (let k = 0; k < 3 && !(await page.locator('.precio-enorme').count()); k++) {
    const vp = page.getByRole('button', { name: /Ver precio/ }); const sg = page.getByRole('button', { name: /Siguiente/ });
    if (await vp.count()) await vp.first().click(); else if (await sg.count()) await sg.first().click(); else break;
    await page.waitForTimeout(1500);
  }
  await expect(page.locator('.precio-enorme').first()).toBeVisible({ timeout: 20000 });
  const res3b = await leerResultado(page); const piezas3b = await leerPiezas(page);
  guarda('3b-precio.json', { resultado: res3b, piezas: piezas3b });
  await page.screenshot({ path: path.join(SALIDA, '3b-precio.png'), fullPage: true });
  console.log('[lab-costear] precio', JSON.stringify(res3b));
  Object.assign(res3, res3b);

  // 4) Sombra: la última respuesta de costear-servidor vs el costo en pantalla.
  await page.waitForTimeout(6000);
  // Holdout v4 (P1-03): la Edge de costeo EXACTA (no `startsWith`: costear-servidor de producción también empieza así).
  // v5.2: con hoja (holdout/ciego) la Edge de costeo es SIEMPRE la RC; LAB_COSTEAR_FN sólo aplica al laboratorio sin hoja.
  const FN_COSTEO = HOJA ? 'costear-servidor-rc' : (process.env.LAB_COSTEAR_FN || 'costear-servidor-rc');
  const costeoAjeno = edges.filter((e) => e.fn.startsWith('costear-servidor') && e.fn !== FN_COSTEO).map((e) => e.fn);
  expect(costeoAjeno, `se costeó con otra Edge que ${FN_COSTEO}`).toEqual([]);
  const srv = edges.filter((e) => e.fn === FN_COSTEO).pop();
  const costoCliente = res3.precios.length && !res3.pendiente ? pesosNum(res3.precios[0]) : null;
  const costoSrv = srv?.body?.costoUnitario ?? srv?.body?.resultado?.costoUnitario ?? srv?.body?.costo?.costoUnitario ?? null;
  const paridad = { costoCliente, costoSrv, estadoSrv: srv?.body?.estado ?? srv?.body?.estadoCosto ?? null, iguales: costoCliente != null && costoSrv != null ? Math.round(costoCliente * 100) === Math.round(Number(costoSrv) * 100) : null, llamadasSrv: edges.filter((e) => e.fn === FN_COSTEO).length };
  guarda('4-paridad.json', { paridad, servidor: srv?.body ?? null });
  console.log('[lab-costear] paridad', JSON.stringify(paridad));

  // 4b) DIFICULTAD (Dirección 2026-10-13): "más difícil sube, más fácil baja". Atrás al paso de mano de obra,
  // elige DIFÍCIL, vuelve al precio, mide costo y paridad con el servidor, y regresa a NORMAL (lo que se guarda
  // después es el costo normal de siempre). Registra; la aserción dura vive en las pruebas unitarias.
  if (costoCliente != null) {
    const dif = { costoNormal: costoCliente };
    const irA = async (rx) => { for (let k = 0; k < 4 && !(await page.getByTestId('costear-dificultad').count()); k++) { await page.locator('.asistente').getByRole('button', { name: rx }).first().click({ timeout: 10000 }); await page.waitForTimeout(800); } };
    await irA(/Atrás/);
    if (await page.getByTestId('costear-dificultad').count()) {
      await page.getByTestId('dificultad-dificil').click({ timeout: 10000 });
      dif.marcado = await page.getByTestId('dificultad-dificil').getAttribute('aria-checked');
      const n0 = edges.filter((e) => e.fn.startsWith('costear-servidor')).length;
      for (let k = 0; k < 3 && !(await page.locator('.precio-enorme').count()); k++) { const vp = page.locator('.asistente').getByRole('button', { name: /Ver precio|Siguiente/ }); if (await vp.count()) await vp.first().click({ timeout: 10000 }); await page.waitForTimeout(1200); }
      const rd = await leerResultado(page);
      dif.costoDificil = rd.precios.length && !rd.pendiente ? pesosNum(rd.precios[0]) : null;
      // Espera la respuesta del servidor CON la dificultad (no un tiempo fijo: el edge a veces tarda > 6 s).
      for (let t = 0; t < 40 && !edges.slice(n0).some((e) => e.fn.startsWith('costear-servidor') && e.req?.pieza?.dificultad); t++) await page.waitForTimeout(500);
      const srvD = edges.filter((e) => e.fn.startsWith('costear-servidor')).slice(n0).filter((e) => e.req?.pieza?.dificultad).pop();
      dif.reqDificultad = srvD?.req?.pieza?.dificultad ?? null;
      dif.costoSrvDificil = srvD?.body?.costo?.costoUnitario ?? srvD?.body?.costoUnitario ?? null;
      dif.sube = dif.costoDificil != null && dif.costoDificil > dif.costoNormal;
      dif.paridad = dif.costoDificil != null && dif.costoSrvDificil != null ? Math.round(dif.costoDificil * 100) === Math.round(Number(dif.costoSrvDificil) * 100) : null;
      await page.screenshot({ path: path.join(SALIDA, '4b-dificil.png'), fullPage: true });
      await irA(/Atrás/);
      await page.getByTestId('dificultad-normal').click({ timeout: 10000 });
      for (let k = 0; k < 3 && !(await page.locator('.precio-enorme').count()); k++) { const vp = page.locator('.asistente').getByRole('button', { name: /Ver precio|Siguiente/ }); if (await vp.count()) await vp.first().click({ timeout: 10000 }); await page.waitForTimeout(1200); }
      const rn = await leerResultado(page);
      dif.costoDeVueltaNormal = rn.precios.length && !rn.pendiente ? pesosNum(rn.precios[0]) : null;
      dif.regresaIgual = dif.costoDeVueltaNormal === dif.costoNormal;
    } else dif.error = 'no se encontró el selector de dificultad';
    guarda('4b-dificultad.json', dif);
    console.log('[lab-costear] dificultad', JSON.stringify(dif));
  }

  // 5) Guardar expediente en la biblioteca.
  const btnGuardar = page.getByRole('button', { name: /^(Guardar|Actualizar) en biblioteca$/ }).first();
  await expect(btnGuardar).toBeVisible({ timeout: 10000 });
  const bloqueG = page.locator('div', { has: page.locator('strong', { hasText: 'Guardar en biblioteca' }) }).last();
  await bloqueG.locator('input[type=text]').first().fill(NOMBRE);
  const esperaExp = page.waitForResponse((r) => /\/rest\/v1\/expedientes/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
  await btnGuardar.click();
  const rExp = await esperaExp; let expId = null; try { const j = await rExp?.json(); expId = Array.isArray(j) ? j[0]?.id : j?.id; } catch (_e) {}
  await page.waitForTimeout(2000);
  const msg = await page.locator('main').innerText();
  const guardado = { status: rExp?.status() ?? null, id: expId ?? null, mensaje: (msg.match(/Guardad[oa][^\n]*|Actualizad[oa][^\n]*|No se pudo[^\n]*/) || [])[0] || null };
  guarda('5-guardado.json', guardado); console.log('[lab-costear] guardado', JSON.stringify(guardado));
  await page.screenshot({ path: path.join(SALIDA, '5-guardado.png'), fullPage: true });

  // 6) Biblioteca → reabrir → comparar.
  await page.getByRole('button', { name: /Ver biblioteca/ }).click();
  await expect(page.getByText('Biblioteca de productos')).toBeVisible({ timeout: 15000 });
  const item = page.getByRole('button', { name: new RegExp(NOMBRE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();
  await expect(item).toBeVisible({ timeout: 20000 });
  const tarjetaTxt = await item.innerText();
  await item.click();
  await expect(page.locator('.pieza').first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(4000);
  const piezasR1 = await leerPiezas(page);
  for (let k = 0; k < 3 && !(await page.locator('.precio-enorme').count()); k++) {
    const vp = page.getByRole('button', { name: /Ver precio/ }); const sg = page.getByRole('button', { name: /Siguiente/ });
    if (await vp.count()) await vp.first().click(); else if (await sg.count()) await sg.first().click(); else break;
    await page.waitForTimeout(1500);
  }
  await expect(page.locator('.precio-enorme').first()).toBeVisible({ timeout: 20000 }).catch(() => {});
  const resR = await leerResultado(page); const piezasR = piezasR1.length ? piezasR1 : await leerPiezas(page);
  const mismoBom = JSON.stringify(piezas3.map((p) => [p.nombre, p.material])) === JSON.stringify(piezasR.map((p) => [p.nombre, p.material]));
  const reabierta = { tarjeta: tarjetaTxt.replace(/\s+/g, ' ').slice(0, 200), piezas: piezasR.length, mismoBom, costoAntes: res3.precios[0] || null, costoDespues: resR.precios[0] || null, mismoCosto: (res3.precios[0] || null) === (resR.precios[0] || null), resultado: resR, pageErrors: pageErrors.length };
  guarda('6-reabierta.json', { reabierta, piezas: piezasR });
  await page.screenshot({ path: path.join(SALIDA, '6-reabierta.png'), fullPage: true });

  // 7) Transferencia a Cotizar: "Ver detalle completo (Alba V1)" → Costeador → "Agregar a la cotización".
  //    El botón sólo se habilita con costo COMPLETO; si está deshabilitado se registra el motivo (no es PASS).
  const transfer = { intentado: false };
  const verDet = page.getByRole('button', { name: /Ver detalle completo/ });
  if (await verDet.count()) {
    await verDet.first().click(); await page.waitForTimeout(2500);
    const btnAdd = page.getByRole('button', { name: /Agregar a la cotización/ });
    transfer.intentado = (await btnAdd.count()) > 0;
    if (transfer.intentado) {
      transfer.habilitado = await btnAdd.first().isEnabled();
      transfer.title = await btnAdd.first().getAttribute('title').catch(() => null);
      const antes = ((await leerCot(page))?.partidas || []).length;
      if (transfer.habilitado) {
        const nSrv = edges.filter((e) => e.fn.startsWith('costear-servidor')).length;
        await btnAdd.first().click();
        await expect.poll(() => edges.filter((e) => e.fn.startsWith('costear-servidor')).length, { timeout: 60000 }).toBeGreaterThan(nSrv).catch(() => {});
        await page.waitForTimeout(3000);
        const srv2 = edges.filter((e) => e.fn.startsWith('costear-servidor')).pop();
        const cot = await leerCot(page); const partidas = cot?.partidas || [];
        const nueva = partidas[partidas.length - 1] || null;
        transfer.partidasAntes = antes; transfer.partidasDespues = partidas.length;
        transfer.partida = nueva ? { nombre: nueva.nombre, cantidad: nueva.cantidad, costoUnitario: nueva.costoUnitario, precioUnitario: nueva.precioUnitario, cost_status: nueva.cost_status, fuente_costo: nueva.fuente_costo } : null;
        transfer.servidor = srv2 ? { estado: srv2.body?.estado, costoUnitario: srv2.body?.costoUnitario, precioVenta: srv2.body?.precioVenta, fuenteCosto: srv2.body?.fuenteCosto } : null;
        transfer.paridad = nueva && srv2?.body?.costoUnitario != null && nueva.costoUnitario != null ? Math.round(Number(nueva.costoUnitario) * 100) === Math.round(Number(srv2.body.costoUnitario) * 100) : null;
      }
      transfer.main = (await page.locator('main').innerText()).slice(0, 6000);
    }
    await page.screenshot({ path: path.join(SALIDA, '7-transferencia.png'), fullPage: true });
  }
  guarda('7-transferencia.json', transfer);
  console.log('[lab-costear] transferencia', JSON.stringify({ ...transfer, main: undefined }));
  // Holdout v5.1: el request_id de cada llamada de IA va aparte (el body se recorta a 6000 caracteres y lo perdía): el
  // verificador compara estas llamadas crudas con el resumen llamadas.json.
  const guardarCrudas = () => guarda('edges.json', edges.map((e) => ({ ...e, ...(/^analizar-mueble/.test(e.fn) ? { request_id: e.body?.request_id ?? null } : {}),
    body: JSON.stringify(e.body || {}).slice(0, 6000), req: e.req ? JSON.stringify(e.req).slice(0, 6000) : null })));
  guardarCrudas();
  const ultimoSrv = edges.filter((e) => e.fn.startsWith('costear-servidor')).pop();
  guarda('8-dto-servidor.json', { req: ultimoSrv?.req ?? null, res: ultimoSrv?.body ?? null });
  if (HOJA) {
    // Corrección técnica del BOM FINAL (el que costeó el servidor) contra la hoja de control del fixture.
    const { compararConHoja, componentesDeDto } = await import('./hojaControl.js');
    const hc = compararConHoja(componentesDeDto({ req: ultimoSrv?.req ?? null }), HOJA);
    guarda('9-hoja-control.json', { producto: HOJA.producto, ...hc, estadoServidor: ultimoSrv?.body?.estado ?? null, respuestas });
    console.log('[lab-costear] hoja de control', JSON.stringify(hc.resumen), JSON.stringify(hc.filas.filter((f) => f.estado !== 'PASS').map((f) => `${f.estado} ${f.clave}: ${f.motivos.join(' · ')}`)));
  }
  console.log('[lab-costear] reabierta', JSON.stringify(reabierta));
  // Holdout v5 (cierre pre-deploy): auditoría de TODAS las llamadas de la corrida, AL FINAL (no a mitad del test).
  // Cada llamada de IA lleva su request_id (una sin ID se queda como null: nunca se filtra); toda llamada costear-servidor*
  // fue EXACTAMENTE la RC; un caso costeable tuvo ≥ 1 llamada RC. El verificador (--corrida) lee llamadas.json.
  // v5.2 (reauditoría GO/NO-GO): ASSERT FINAL. `edges` junta toda respuesta de la página desde el primer paso (análisis,
  // costeo, transferencia a Cotizar, reapertura y recosteo); antes de auditar se espera a que la red quede en reposo para
  // que ninguna llamada tardía quede fuera. Con hoja (holdout/ciego) la Edge esperada es SIEMPRE costear-servidor-rc (no
  // LAB_COSTEAR_FN) y `costeable` sale de la HOJA (costeableDeHoja), no de una variable de entorno: LAB_COSTEABLE ya no
  // existe. El E2E declara qué hoja corrió (ruta + sha256) y el verificador la vuelve a leer de git en el SHA servido.
  await page.waitForLoadState('networkidle').catch(() => {});
  guardarCrudas();   // otra vez al final, en el mismo instante que la auditoría: crudas y resumen salen del mismo `edges`
  const hojaDeclarada = process.env.LAB_HOJA ? { ruta: path.relative(process.cwd(), path.resolve(process.env.LAB_HOJA)).split(path.sep).join('/'),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(process.env.LAB_HOJA)).digest('hex') } : null;
  const auditoria = auditarLlamadasCorrida(edges, { fnCosteo: HOJA ? 'costear-servidor-rc' : FN_COSTEO, costeable: HOJA ? costeableDeHoja(HOJA) : true, hoja: hojaDeclarada });
  guarda('llamadas.json', auditoria);
  guarda('ia_requests.json', auditoria.ia);
  expect(auditoria.costeo.ajenas, 'toda llamada costear-servidor* de la hoja (incluidas transferencia, reapertura y recosteo) fue costear-servidor-rc').toEqual([]);
  expect(auditoria.motivos, 'auditoría de llamadas de la corrida').toEqual([]);
  // Nada llega después de la auditoría final: si llegó, la evidencia escrita no es la corrida completa.
  const nAuditadas = edges.length; await page.waitForTimeout(3000);
  expect(edges.slice(nAuditadas).map((e) => e.fn), 'llamadas a Edge después de la auditoría final').toEqual([]);
});
