// ============================================================================
//  LABORATORIO · RECORRIDOS COMBINADOS (2026-10-19), contra el cliente publicado y la nube real (cuenta QA).
//  La prueba E2E de Rodrigo (cot. 3354) falló en una COMBINACIÓN que ningún lab cubría: cotizar por texto y DESPUÉS
//  subir el plano. Cada pieza funcionaba sola. Aquí se recorre como lo haría un vendedor y un AUDITOR revisa lo que
//  Rodrigo revisó a ojo, en cada pantalla:
//   · letra ilegible (contraste < 3:1), códigos internos en pantalla (p-…, inst:, ANCHOR_…), excepciones;
//   · sillas de trabajo = puestos del plano; ALPHA sólo en privados; una mesa por sala de juntas;
//   · nada "se sale de su cuarto", nada "sobra", invariantes del acomodo;
//   · los botones de decisión hacen algo (Repartir quita su tarjeta; Conservar cambia el estado);
//   · al reabrir desde la nube, el plano no vuelve a pedir lo que ya se aplicó.
//  LAB_RECORRIDO = texto-plano | plano-texto | plano-reabrir. Hallazgos en LAB_OUT/hallazgos.json; falla si hay alguno.
// ============================================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const RECORRIDO = process.env.LAB_RECORRIDO || 'texto-plano';
const PLANO = process.env.LAB_PLANO;
const CONTROL = process.env.LAB_CONTROL ? JSON.parse(fs.readFileSync(process.env.LAB_CONTROL, 'utf8')) : null;
const SALIDA = process.env.LAB_OUT || `test-results-prod/lab-recorridos-${RECORRIDO}`;
const CLIENTE = process.env.LAB_CLIENTE || `LAB recorrido ${RECORRIDO}`;
const TEXTO = process.env.LAB_TEXTO || 'Oficina con 16 puestos operativos con sillas WIN, una recepción Ergonova 4 para 1 persona con su silla, una oficina de dirección con escritorio y su silla, una sala de consejo para 10 personas y una sala creativa para 6 personas.';
const CLAVE = 'costeador-vonhaucke-v1';

const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
const guarda = (n, d) => fs.writeFileSync(path.join(SALIDA, n), typeof d === 'string' ? d : JSON.stringify(d, null, 1));
const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Puestos y asientos que dibuja el plano (hoja de control del corpus).
function esperadoDelPlano() {
  const areas = (CONTROL?.paginas || []).flatMap((p) => p.areas || []);
  const de = (tipo) => areas.filter((a) => a.tipo === tipo);
  return {
    operativos: de('open').reduce((s, a) => s + (a.puestos || 0), 0),
    privados: de('privado').reduce((s, a) => s + (a.puestos || 0), 0),
    recepcion: de('recepcion').reduce((s, a) => s + (a.puestos || 0), 0),
    salas: de('juntas').map((a) => a.nombre),
  };
}

test(`recorrido ${RECORRIDO}: lo que revisa una persona, en cada pantalla`, async ({ page }) => {
  test.skip(!(EMAIL && PASS && PLANO), 'Define TEST_EMAIL, TEST_PASSWORD y LAB_PLANO.');
  test.setTimeout(30 * 60 * 1000);
  fs.mkdirSync(SALIDA, { recursive: true });
  const hallazgos = [];
  const hallazgo = (etapa, tipo, detalle) => { hallazgos.push({ etapa, tipo, detalle }); console.log('[recorrido] HALLAZGO', etapa, tipo, JSON.stringify(detalle).slice(0, 400)); };
  const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const edges = [];
  page.on('response', async (res) => { const m = res.url().match(/\/functions\/v1\/([a-z0-9-]+)/); if (m) { edges.push({ fn: m[1], status: res.status() }); if (res.status() >= 500) hallazgo('edge', 'EDGE_5XX', { fn: m[1], status: res.status() }); } });
  const esperado = esperadoDelPlano();
  let n = 0;

  // ---------------- AUDITOR: lo que Rodrigo vio a ojo ----------------
  async function auditar(etapa) {
    n += 1;
    await page.waitForTimeout(800);
    const pre = `${String(n).padStart(2, '0')}-${etapa}`;
    await page.screenshot({ path: path.join(SALIDA, `${pre}.png`), fullPage: true });
    const texto = await page.locator('main').innerText({ timeout: 5000 }).catch(() => '');
    guarda(`${pre}.txt`, texto);
    const codigos = texto.match(/«?p-\d{6,}[^\s»]*»?|inst:req:[^\s)]*|\b(ANCHOR_[A-Z]+|WORK_SEAT|MEETING_SEAT|SPLIT_REQUIRED|SLOT_OCUPADO[A-Z_]*|OUT_OF_BOUNDS)\b/g);
    if (codigos) hallazgo(etapa, 'CODIGO_INTERNO_EN_PANTALLA', [...new Set(codigos)].slice(0, 8));
    for (const [re, tipo] of [[/se sale de su cuarto/i, 'SE_SALE_DEL_CUARTO'], [/sobran? \d+/i, 'SOBRAN'], [/se atoró/i, 'PANTALLA_ATORADA'], [/undefined|NaN|\[object Object\]/, 'VALOR_ROTO']]) {
      const m = texto.match(re); if (m) hallazgo(etapa, tipo, texto.slice(Math.max(0, m.index - 160), m.index + 200).replace(/\s+/g, ' '));
    }
    // Contraste WCAG (texto que se ve en pantalla, contra el primer fondo opaco de sus ancestros).
    const ilegibles = await page.evaluate(() => {
      const rgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x)); return { r, g, b, a }; };
      const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const fondo = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
      const out = [];
      const raiz = document.querySelector('main') || document.body;
      for (const el of raiz.querySelectorAll('*')) {
        const propio = [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join(' ').trim();
        if (!propio) continue;
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.3 || r.width < 2 || r.height < 2) continue;
        if (el.closest('[aria-hidden="true"], button:disabled')) continue;
        const fg = rgb(cs.color); if (!fg) continue;
        const bg = fondo(el);
        const L1 = lum(fg), L2 = lum(bg);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        if (ratio < 3) out.push({ texto: propio.slice(0, 80), ratio: Math.round(ratio * 100) / 100, color: cs.color, fondo: `rgb(${bg.r}, ${bg.g}, ${bg.b})` });
      }
      return out.slice(0, 15);
    });
    if (ilegibles.length) hallazgo(etapa, 'LETRA_ILEGIBLE', ilegibles);
    // Tarjeta de conflicto sin datos ("—" en ambos lados del producto): Rodrigo no podía decidir nada.
    for (const t of await page.getByTestId('conflicto-programa').allInnerTexts().catch(() => [])) {
      if (/Producto\s+—\s+—/.test(t.replace(/\s+/g, ' '))) hallazgo(etapa, 'CONFLICTO_VACIO', t.replace(/\s+/g, ' ').slice(0, 300));
    }
  }

  // Sillas del proyecto contra los puestos del plano.
  function auditarSillas(etapa, partidas) {
    const sum = (re, no) => partidas.filter((p) => re.test(norm(p.nombre)) && !(no && no.test(norm(p.nombre))) && !p.noCobrar).reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    const trabajo = sum(/silla/, /junta|consejo|concerto|sonata|visita|delta|alpha|directiv|ejecutiv/);
    const alpha = sum(/alpha|directiv|ejecutiv/);
    const esperadas = esperado.operativos + esperado.recepcion;
    const r = { trabajo, esperadas, alpha, privados: esperado.privados };
    guarda(`sillas-${etapa}.json`, { ...r, partidas: partidas.map((p) => [p.nombre, p.cantidad, p.relation_role || null, p.anchor_role || null]) });
    if (trabajo !== esperadas) hallazgo(etapa, 'SILLAS_DE_TRABAJO_NO_CUADRAN', r);
    if (alpha > esperado.privados) hallazgo(etapa, 'ALPHA_DE_MAS', r);
    return r;
  }

  // Programa del plano: aplicar, y cada decisión que la app ofrezca debe HACER algo.
  async function aplicarPrograma(etapa) {
    const boton = page.getByRole('button', { name: /Aplicar programa detectado|Fusionar \d+ duplicado|Vincular lo que ya tengo/i });
    if ((await boton.count()) && (await boton.first().isEnabled().catch(() => false))) { await boton.first().click(); await page.waitForTimeout(1500); }
    for (let i = 0; i < 6; i++) {
      const rep = page.getByTestId('reparto-programa');
      if (!(await rep.count())) break;
      const antes = await rep.count(); const t = await rep.first().innerText();
      await rep.first().getByRole('button', { name: /^Repartir/ }).click(); await page.waitForTimeout(1500);
      if ((await page.getByTestId('reparto-programa').count()) >= antes) { hallazgo(etapa, 'BOTON_SIN_EFECTO', { boton: 'Repartir', tarjeta: t.replace(/\s+/g, ' ').slice(0, 300) }); break; }
    }
    for (let i = 0; i < 6; i++) {
      const c = page.getByTestId('conflicto-programa');
      if (!(await c.count())) break;
      const antes = await c.count(); const t = await c.first().innerText();
      // Lo que haría una persona con la recepción/escritorio que eligió: conservar el suyo.
      await c.first().getByRole('button', { name: /Conservar el mío/ }).click(); await page.waitForTimeout(800);
      if ((await page.getByTestId('conflicto-programa').count()) >= antes) { hallazgo(etapa, 'BOTON_SIN_EFECTO', { boton: 'Conservar el mío', tarjeta: t.replace(/\s+/g, ' ').slice(0, 300) }); break; }
    }
    await auditar(`${etapa}-programa`);
  }

  async function subirPlano(etapa) {
    await page.getByTestId('voni-paso-espacio').click().catch(() => {});
    await page.getByTestId('cotizar-plano').setInputFiles(PLANO);
    const gate = page.getByTestId('confirmar-lectura');
    await expect(gate.or(page.locator('text=/No se pudo procesar|no pude leer/i')).first()).toBeVisible({ timeout: 150000 });
    if (!(await gate.count())) { hallazgo(etapa, 'LECTURA_FALLO', await page.locator('main').innerText()); throw new Error('la lectura del plano falló'); }
    await auditar(`${etapa}-lectura`);
    const ctrls = page.getByTestId('puerta-confirmar');
    for (let i = 0, k = await ctrls.count(); i < k; i++) {
      const c = ctrls.first(); const t = await c.innerText();
      const doble = /doble/i.test(t) && /vano (1\.[4-9]|[2-9])/.test(t);
      await c.getByRole('button', { name: doble ? /Doble \(dos hojas\)/ : /Una hoja/ }).click();
      await c.getByRole('button', { name: /Hacia adentro/ }).click();
      await c.getByTestId('puerta-confirmar-ok').click();
    }
    await page.getByTestId('lectura-confirmar').click();
    await expect(gate).toBeHidden();
    await expect.poll(async () => (await leerCot(page))?.acomodo?.areasM?.length || 0, { timeout: 20000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    await auditar(`${etapa}-muebles`);
  }

  async function describirTexto(etapa) {
    await page.getByTestId('voni-paso-muebles').click().catch(() => {});
    const volver = page.getByRole('button', { name: /Volver a describir o agregar más/ });
    if (await volver.count()) await volver.first().click();
    const caja = page.locator('textarea.ia-textarea').first(); await expect(caja).toBeVisible({ timeout: 15000 });
    await caja.fill(TEXTO);
    await page.getByRole('button', { name: /Armar la lista de muebles|Volver a interpretar/ }).first().click();
    await expect(page.getByText(/Agregué \d+ mueble|No pude armar ningún mueble/).first()).toBeVisible({ timeout: 180000 });
    await auditar(`${etapa}-texto`);
  }

  async function acomodar(etapa) {
    await page.getByTestId('voni-paso-acomodo').click();
    const b = page.getByTestId('acomodo-acomodar'); await expect(b).toBeVisible({ timeout: 20000 });
    if (await b.isEnabled().catch(() => false)) {
      await b.click();
      await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.colocacion?.length ?? -1, { timeout: 150000 }).toBeGreaterThanOrEqual(0);
    } else hallazgo(etapa, 'ACOMODAR_DESHABILITADO', (await page.locator('main').innerText()).slice(0, 600));
    await page.waitForTimeout(2500);
    const cot = await leerCot(page); const ac = cot?.acomodo || {}; const plan = ac.plan || {};
    guarda(`acomodo-${etapa}.json`, ac);
    const piezas = new Map((plan.piezas || []).map((p) => [p.id, p]));
    const areas = ac.areasM || [];
    // Una mesa por sala de juntas.
    areas.forEach((a, i) => {
      if (a.tipo !== 'juntas') return;
      const mesas = (plan.colocacion || []).filter((c) => c.area === i && (piezas.get(c.id)?.relation_role === 'ANCHOR_MEETING' || /ANCHOR_MEETING/.test(c.id)));
      if (mesas.length !== 1) hallazgo(etapa, 'MESAS_POR_SALA', { sala: a.nombre, mesas: mesas.length });
    });
    // Sillas de recepción colocadas contra los puestos de la recepción.
    areas.forEach((a, i) => {
      if (a.tipo !== 'recepcion' || !a.puestos) return;
      const sillas = (plan.colocacion || []).filter((c) => c.area === i && piezas.get(c.id)?.relation_role === 'WORK_SEAT').length;
      if (sillas > a.puestos) hallazgo(etapa, 'SILLAS_RECEPCION_DE_MAS', { area: a.nombre, puestos: a.puestos, sillas });
    });
    const inv = plan.invariantes;
    const fallas = Array.isArray(inv) ? inv.filter((x) => x && x.ok === false) : (inv && Array.isArray(inv.fallas) ? inv.fallas : []);
    if (fallas.length) hallazgo(etapa, 'INVARIANTES_ACOMODO', fallas.slice(0, 6));
    const sinColocar = [...(plan.no_cupieron || []), ...(plan.unassigned || [])];
    guarda(`sin-colocar-${etapa}.json`, sinColocar);
    console.log('[recorrido] acomodo', etapa, 'colocadas', (plan.colocacion || []).length, 'sin colocar', sinColocar.length);
    await auditar(`${etapa}-acomodo`);
  }

  async function reabrir(etapa) {
    await expect.poll(async () => (await leerCot(page))?.id || null, { timeout: 45000 }).not.toBeNull();
    await page.waitForTimeout(5000);
    const antes = await leerCot(page);
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)), [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });
    await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
    const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).first();
    await expect(tarjeta).toBeVisible({ timeout: 20000 });
    await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
    await expect.poll(async () => (await leerCot(page))?.id || null, { timeout: 20000 }).toBe(antes.id);
    const despues = await leerCot(page);
    const firma = (c) => (c?.partidas || []).map((p) => `${p.nombre}|${p.cantidad}|${p.precioUnitario ?? ''}`).sort().join('\n');
    if (firma(antes) !== firma(despues)) hallazgo(etapa, 'REABIERTA_DISTINTA', { antes: firma(antes), despues: firma(despues) });
    await auditar(`${etapa}-reabierta`);
    // Volver al paso de muebles de Voni: el plano ya aplicado no debe volver a pedir nada.
    await page.getByTestId('home-cotizar').click().catch(() => {});
    await page.getByTestId('voni-paso-muebles').click().catch(() => {});
    await page.waitForTimeout(1500);
    const revisar = page.getByRole('button', { name: /Revisar lo que entendí/ });
    if (await revisar.count()) { await revisar.first().click(); await page.waitForTimeout(1000); }
    const pide = await page.getByRole('button', { name: /Aplicar programa detectado/ }).count();
    const reps = await page.getByTestId('reparto-programa').count();
    if (pide || reps) hallazgo(etapa, 'REABRIR_VUELVE_A_PEDIR', { aplicar: pide, repartos: reps });
    await auditar(`${etapa}-reabierta-muebles`);
  }

  // ---------------- RECORRIDO ----------------
  await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem('__lab')) { window.localStorage.setItem(k, JSON.stringify(v)); window.localStorage.setItem('__lab', '1'); } } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [], cliente: CLIENTE } }]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 30000 });
  await auditar('inicio');
  await page.getByTestId('home-cotizar').click();
  const cliente = page.getByPlaceholder('Nombre del cliente'); if (await cliente.count()) await cliente.fill(CLIENTE);

  if (RECORRIDO === 'texto-plano') {
    await page.getByRole('button', { name: /Empezar por los muebles/ }).click();
    await describirTexto('1');
    auditarSillas('1-texto', (await leerCot(page)).partidas || []);
    await subirPlano('2');
    await aplicarPrograma('2');
    auditarSillas('2-programa', (await leerCot(page)).partidas || []);
    await acomodar('3');
    await reabrir('4');
  } else if (RECORRIDO === 'plano-texto') {
    await subirPlano('1');
    await aplicarPrograma('1');
    auditarSillas('1-programa', (await leerCot(page)).partidas || []);
    await describirTexto('2');
    await aplicarPrograma('2b');
    auditarSillas('2-texto', (await leerCot(page)).partidas || []);
    await acomodar('3');
    await reabrir('4');
  } else {
    await subirPlano('1');
    await aplicarPrograma('1');
    auditarSillas('1-programa', (await leerCot(page)).partidas || []);
    await acomodar('2');
    await reabrir('3');
    await aplicarPrograma('3b');
    auditarSillas('3-reaplicado', (await leerCot(page)).partidas || []);
  }

  pageErrors.forEach((e) => hallazgo('pagina', 'EXCEPCION_JS', e.slice(0, 300)));
  guarda('hallazgos.json', hallazgos); guarda('edges.json', edges);
  console.log('[recorrido] RESUMEN', RECORRIDO, JSON.stringify(hallazgos.map((h) => `${h.etapa}:${h.tipo}`)));
  expect(hallazgos, 'el auditor no encontró nada que una persona marcaría').toEqual([]);
});
