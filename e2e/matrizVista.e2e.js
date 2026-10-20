// ============================================================================
//  MATRIZ DE VISTA OBLIGATORIA (auditoría externa, 2026-10-19).
//  Cada pantalla crítica que se abre desde el Inicio, por rol (Dirección, Diseño, Ventas), en 3 viewports
//  (390×844, 768×1024, 1440×900) y 2 temas del sistema (claro / oscuro vía `page.emulateMedia({ colorScheme })`;
//  la app es "VH Terminal" oscura por tokens en :root y `prefers-color-scheme: dark` ajusta chips y Cocrear).
//  Aserciones por pantalla × viewport × tema:
//   1. Sin desborde horizontal: `scrollWidth <= innerWidth + 2`. Como html/body llevan `overflow-x: clip`
//      (estilos.css), el scrollWidth casi nunca crece: lo que se sale queda RECORTADO. Por eso también falla
//      todo elemento visible que se salga del viewport sin un ancestro que lo recorte/desplace a propósito
//      (overflow-x ≠ visible). Se reporta el culpable más externo.
//   2. Contraste WCAG contra el primer fondo opaco de sus ancestros (compone capas translúcidas y degradados;
//      con imagen de fondo el contraste es indeterminado y sólo se cuenta). < 3 = FALLO; 3–4.5 en texto normal
//      = AVISO (no falla todavía). Excluye deshabilitados, aria-hidden y SVG.
//   3. CTA: cada `button`/`a[href]` visible, tras scrollIntoView, recibe el clic en su centro
//      (`elementFromPoint` = él o un descendiente) → nada lo tapa (FAB de Voni, barras fijas). En 390:
//      objetivo táctil < 24 px = FALLO, < 32 px = AVISO (enlaces en línea dentro de texto, exentos: WCAG 2.5.8).
//   4. Ninguna excepción de página ni console.error inesperado.
//   5. Captura test-results/matriz/<rol>-<pantalla>-<viewport>-<tema>.png (fullPage).
//  + IMPRESIÓN: con tema oscuro activo, `emulateMedia({ media: 'print' })` y los contenedores de documento
//    (.ficha-pdf / .hoja / .cot-cliente) deben quedar en papel blanco y tinta oscura (regresión permanente del
//    override de estilos.css "PROTECCIÓN CLIENTE / IMPRESIÓN").
//  Reporte: test-results/matriz/reporte.json (pantalla, viewport, tema, tipo, nivel, detalle).
//  Corre contra la nube falsa (e2e/nubeFalsa.js). Nada toca producción.
// ============================================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'rodrigo@vh.mx': 'direccion', 'diseno@vh.mx': 'diseno', 'ventas@vh.mx': 'vendedor' };
const VIEWPORTS = { 390: { width: 390, height: 844 }, 768: { width: 768, height: 1024 }, 1440: { width: 1440, height: 900 } };
const TEMAS = { claro: 'light', oscuro: 'dark' };
const PARTIDA = { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 2, precioUnitario: 48000 };
const PARTIDA2 = { id: 'p2', nombre: 'Silla operativa Ergonova 4 con brazos ajustables', cantidad: 6, precioUnitario: 7450 };
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const DIR = path.join('test-results', 'matriz');
const DIR_PARCIAL = path.join(DIR, 'parcial');

// console.error que NO son defecto de la vista (se documenta la razón de cada uno):
const CONSOLA_ESPERADA = [
  // La nube falsa sólo contesta lo que la app pide a Supabase; imágenes de storage (renders) no existen → 404 del navegador.
  /Failed to load resource/i,
];

// Exclusiones EXPLÍCITAS de desborde (contenedores que el diseño hace desplazar o recortar a propósito). Se
// aplican por selector CSS del elemento culpable; cada una con su razón. (Vacía si no hace falta ninguna.)
const EXCLUSIONES_DESBORDE = [];

// ---------------------------------------------------------------------------------------------------------
//  Auditoría en la página (una sola función serializable; no usa nada de afuera).
// ---------------------------------------------------------------------------------------------------------
function auditarEnPagina({ movil, exclusionesDesborde, alcance }) {
  const W = window.innerWidth, H = window.innerHeight;
  const hallazgos = [];
  const desc = (el) => {
    if (!el || el.nodeType !== 1) return String(el);
    const cls = (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
    const tid = el.getAttribute('data-testid');
    const txt = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls.length ? '.' + cls.join('.') : ''}${tid ? `[data-testid=${tid}]` : ''}${txt ? ` "${txt}"` : ''}`;
  };
  const visible = (el) => {
    if (!el.checkVisibility || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const raiz = alcance ? document.querySelector(alcance) : document.body;
  if (!raiz) return { hallazgos, stats: {} };

  // ---- 1. Desborde horizontal ----
  const sw = document.documentElement.scrollWidth;
  const recortaX = (el) => { const o = getComputedStyle(el).overflowX; return o !== 'visible'; };
  const culpables = [];
  for (const el of raiz.querySelectorAll('*')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= W + 2 && r.left >= -2) continue;
    // ¿Lo recorta o desplaza un ancestro a propósito (por debajo de body/html)?
    let p = el.parentElement, recortado = false;
    while (p && p !== document.body && p !== document.documentElement) { if (recortaX(p)) { recortado = true; break; } p = p.parentElement; }
    if (recortado) continue;
    if (exclusionesDesborde.some((s) => el.matches(s) || el.closest(s))) continue;
    culpables.push(el);
  }
  const externos = culpables.filter((el) => !culpables.includes(el.parentElement));
  if (sw > W + 2 || externos.length) {
    const top = externos
      .map((el) => { const r = el.getBoundingClientRect(); return { el: desc(el), izq: Math.round(r.left), der: Math.round(r.right), ancho: Math.round(r.width) }; })
      .sort((a, b) => (b.der - W + Math.max(0, -b.izq)) - (a.der - W + Math.max(0, -a.izq)))
      .slice(0, 6);
    hallazgos.push({ tipo: 'desborde', nivel: 'FALLO', detalle: { scrollWidth: sw, innerWidth: W, culpables: top, total: externos.length } });
  }

  // ---- 2. Contraste ----
  const parse = (c) => {
    if (!c) return null;
    let m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) { let a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [+m[1], +m[2], +m[3], a]; }
    m = c.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
    if (m) { let a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [m[1] * 255, m[2] * 255, m[3] * 255, a]; }
    return null;
  };
  const sobre = (fg, bg) => { const a = fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const coloresDe = (img) => (img.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)/g) || []).map(parse).filter(Boolean);
  // Capas de fondo del elemento hacia arriba, hasta la primera opaca. Devuelve fondos candidatos (degradados → varios).
  const fondos = (el) => {
    const capas = []; let opac = 1;
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (p !== el) opac *= parseFloat(cs.opacity) || 1;
      const img = cs.backgroundImage;
      if (img && img !== 'none') {
        if (/url\(/.test(img)) return { indeterminado: true, por: desc(p) };
        const cols = coloresDe(img);
        if (cols.length) { capas.push({ grad: cols }); if (cols.every((c) => c[3] >= 0.99)) break; }
      }
      const bc = parse(cs.backgroundColor);
      if (bc && bc[3] > 0) { capas.push({ color: bc }); if (bc[3] >= 0.99) break; }
    }
    let cands = [[255, 255, 255, 1]];
    for (const c of capas.reverse()) {
      if (c.color) cands = cands.map((b) => sobre(c.color, b));
      else cands = cands.flatMap((b) => c.grad.map((g) => sobre(g, b))).slice(0, 12);
    }
    return { cands };
  };
  const vistos = new Map();
  let indeterminados = 0, revisados = 0;
  for (const el of raiz.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'option', 'textarea', 'select', 'svg', 'title'].includes(tag)) continue;
    if (el.closest('svg, [aria-hidden="true"], [disabled], [aria-disabled="true"], fieldset:disabled')) continue;
    if (el.matches(':disabled')) continue;
    const propio = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!propio || !/[\p{L}\p{N}]/u.test(propio)) continue;
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const fill = parse(cs.webkitTextFillColor || cs.color);
    let fg = parse(cs.color);
    if (!fg || (fill && fill[3] === 0)) continue;           // texto con degradado (background-clip:text): no medible así
    if (fg[3] === 0) continue;
    const f = fondos(el);
    revisados++;
    if (f.indeterminado) { indeterminados++; continue; }
    const tam = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight, 10) || 400;
    const grande = tam >= 24 || (tam >= 18.66 && peso >= 700);
    let peor = Infinity, peorBg = null;
    for (const bg of f.cands) { const r = ratio(sobre(fg, bg), bg); if (r < peor) { peor = r; peorBg = bg; } }
    const minimo = grande ? 3 : 4.5;
    if (peor >= minimo) continue;
    const nivel = peor < 3 ? 'FALLO' : 'AVISO';
    const clave = `${nivel}|${desc(el).replace(/".*$/, '')}|${hex(fg)}|${hex(peorBg)}`;
    const v = vistos.get(clave);
    if (v) { v.detalle.repeticiones++; continue; }
    const h = { tipo: 'contraste', nivel, detalle: { el: desc(el), texto: propio.slice(0, 60), ratio: Math.round(peor * 100) / 100, minimo, color: hex(fg), fondo: hex(peorBg), fontSize: tam, peso, repeticiones: 1 } };
    vistos.set(clave, h); hallazgos.push(h);
  }

  // ---- 3. CTA tapados / objetivo táctil ----
  const x0 = window.scrollX, y0 = window.scrollY;
  let ctas = 0;
  for (const el of raiz.querySelectorAll('button, a[href], [role="button"]')) {
    if (el.closest('[aria-hidden="true"], .cot-cliente:not(.activa)')) continue;
    if (!visible(el)) continue;
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    ctas++;
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > W || cy > H) {
      hallazgos.push({ tipo: 'cta-inalcanzable', nivel: 'FALLO', detalle: { el: desc(el), centro: [Math.round(cx), Math.round(cy)] } });
    } else {
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || !(hit === el || el.contains(hit))) {
        hallazgos.push({ tipo: 'cta-tapado', nivel: 'FALLO', detalle: { el: desc(el), tapadoPor: desc(hit), centro: [Math.round(cx), Math.round(cy)] } });
      }
    }
    if (movil) {
      const cs = getComputedStyle(el);
      const enLinea = el.tagName === 'A' && cs.display === 'inline' && (el.parentElement?.innerText || '').trim().length > (el.innerText || '').trim().length;
      if (!enLinea && (r.width < 32 || r.height < 32)) {
        const nivel = r.width < 24 || r.height < 24 ? 'FALLO' : 'AVISO';
        hallazgos.push({ tipo: 'objetivo-tactil', nivel, detalle: { el: desc(el), ancho: Math.round(r.width), alto: Math.round(r.height) } });
      }
    }
  }
  window.scrollTo({ left: x0, top: y0, behavior: 'instant' });
  return { hallazgos, stats: { revisados, indeterminados, ctas, scrollWidth: sw, innerWidth: W } };
}

// ---------------------------------------------------------------------------------------------------------
//  Reporte: cada test escribe su parcial y re-arma reporte.json con todos los parciales que existan.
// ---------------------------------------------------------------------------------------------------------
function rearmarReporte() {
  for (let intento = 0; intento < 3; intento++) {
    const archivos = fs.existsSync(DIR_PARCIAL) ? fs.readdirSync(DIR_PARCIAL).filter((f) => f.endsWith('.json')).sort() : [];
    const parciales = archivos.map((f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR_PARCIAL, f), 'utf8')); } catch (_e) { return null; } }).filter(Boolean);
    const hallazgos = parciales.flatMap((p) => p.hallazgos);
    const resumen = {
      combinaciones: parciales.reduce((n, p) => n + p.pantallas.length, 0),
      fallos: hallazgos.filter((h) => h.nivel === 'FALLO').length,
      avisos: hallazgos.filter((h) => h.nivel === 'AVISO').length,
      porTipo: hallazgos.reduce((m, h) => { const k = `${h.tipo}:${h.nivel}`; m[k] = (m[k] || 0) + 1; return m; }, {}),
    };
    const tmp = path.join(DIR, `.reporte-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ generado: new Date().toISOString(), resumen, corridas: parciales.map((p) => ({ rol: p.rol, viewport: p.viewport, tema: p.tema, pantallas: p.pantallas, errores: p.errores })), hallazgos }, null, 2));
    fs.renameSync(tmp, path.join(DIR, 'reporte.json'));
    const despues = fs.existsSync(DIR_PARCIAL) ? fs.readdirSync(DIR_PARCIAL).filter((f) => f.endsWith('.json')).length : 0;
    if (despues === archivos.length) return;
  }
}

async function entrar(browser, email, { viewport, tema }) {
  const nube = crearNubeFalsa({ usuarios: USUARIOS });
  // Presupuesto anterior sembrado para que "Presupuestos anteriores" tenga una tarjeta real.
  nube.sembrarFila({ usuario: email, cliente: 'Matriz Corporativo SA de CV', partidas: [PARTIDA, PARTIDA2], total: 140700, piezas: 8 });
  const context = await browser.newContext({ viewport });
  await nube.instalar(context);
  await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__sembrado__')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__sembrado__', '1'); } },
    { k: CLAVE_LOCAL, v: estadoLocal({ cotizacion: { cliente: 'Matriz Corporativo SA de CV', folio: 'VH-MATRIZ-01', partidas: [PARTIDA, PARTIDA2] } }) });
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: tema, reducedMotion: 'reduce' });
  const errores = [];
  page.on('pageerror', (e) => errores.push({ tipo: 'pageerror', texto: String(e?.message || e).slice(0, 300) }));
  page.on('console', (m) => { if (m.type() === 'error' && !CONSOLA_ESPERADA.some((r) => r.test(m.text()))) errores.push({ tipo: 'console.error', texto: m.text().slice(0, 300) }); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto('/');
  await page.fill('#email-login', email);
  await page.fill('#pass-login', 'prueba-123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
  // Estado final de cada vista (sin fades a medio camino que falseen el contraste).
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}' });
  return { context, page, errores, nube };
}

async function asentar(page) {
  await page.waitForTimeout(600);
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
}

async function irInicio(page) {
  const enInicio = () => page.getByTestId('home-cotizar').isVisible().catch(() => false);
  for (let k = 0; k < 4 && !(await enInicio()); k++) {
    const boton = page.getByRole('button', { name: /^Inicio$/ }).first();
    if (await boton.isVisible().catch(() => false)) await boton.click().catch(() => {});
    else await page.locator('header .marca, header button').first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId('home-cotizar')).toBeVisible({ timeout: 10000 });
}

const atajo = (page, titulo) => page.locator('button.vh-atajo', { hasText: titulo }).first();

for (const [email, rol] of Object.entries(USUARIOS)) {
  const veCostos = rol !== 'vendedor';
  for (const [vp, viewport] of Object.entries(VIEWPORTS)) {
    for (const [tema, esquema] of Object.entries(TEMAS)) {
      test(`matriz · ${rol} · ${vp} · ${tema}`, async ({ browser }) => {
        test.setTimeout(6 * 60_000);
        const { context, page, errores } = await entrar(browser, email, { viewport, tema: esquema });
        const pantallas = [];
        const hallazgos = [];
        fs.mkdirSync(DIR_PARCIAL, { recursive: true });

        const auditar = async (pantalla, opciones = {}) => {
          await asentar(page);
          const antes = errores.length;
          const r = await page.evaluate(auditarEnPagina, { movil: vp === '390', exclusionesDesborde: EXCLUSIONES_DESBORDE, alcance: opciones.alcance || null });
          await page.screenshot({ path: path.join(DIR, `${rol}-${pantalla}-${vp}-${tema}.png`), fullPage: true });
          const nuevos = errores.slice(antes);
          const hs = [...r.hallazgos, ...nuevos.map((e) => ({ tipo: e.tipo, nivel: 'FALLO', detalle: e }))]
            .map((h) => ({ rol, pantalla, viewport: vp, tema, ...h }));
          hallazgos.push(...hs);
          pantallas.push({ pantalla, ...r.stats, fallos: hs.filter((h) => h.nivel === 'FALLO').length, avisos: hs.filter((h) => h.nivel === 'AVISO').length });
        };

        // Inicio
        await irInicio(page);
        await auditar('inicio');

        // Cotizar de línea (vista del Inicio) + Insumos (Precios de materiales, sólo quien ve costos)
        await atajo(page, 'Cotizar de línea').click();
        await auditar('cotizar-linea');
        if (veCostos) {
          await page.locator('button.grupo-acc-h', { hasText: 'Herramientas' }).click();
          await page.getByRole('button', { name: /Precios de materiales/ }).first().click();
          await expect(page.getByRole('heading', { name: /Costo hora de taller/i }).first()).toBeVisible({ timeout: 10000 });
          await auditar('insumos');
        }

        // Costear manual / Costear con IA (sólo Diseño y Dirección)
        if (veCostos) {
          await irInicio(page);
          await atajo(page, 'Costeo manual').click();
          await auditar('costear-manual');
          await irInicio(page);
          await page.getByTestId('home-costear').click();
          await auditar('costear-ia');
        }

        // Cotizar / Voni: paso 1 → lectura del plano (nube falsa) → confirmar → 2 → 3 (acomodo con las áreas leídas) → 4
        await irInicio(page);
        await page.getByTestId('home-cotizar').click();
        await expect(page.getByTestId('voni-paso-espacio')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('voni-paso-espacio').click();
        await auditar('voni-1-espacio');
        const ruta = path.join(mkdtempSync(path.join(tmpdir(), 'matriz-plano-')), 'plano.png');
        writeFileSync(ruta, PNG_1x1);
        await page.locator('input[type=file][accept*="pdf"]').first().setInputFiles(ruta);
        await expect(page.getByTestId('confirmar-lectura')).toBeVisible({ timeout: 15000 });
        await auditar('lectura-plano');
        await page.getByTestId('lectura-confirmar').click();
        await expect(page.getByTestId('confirmar-lectura')).toBeHidden();
        await page.getByTestId('voni-paso-muebles').click();
        await auditar('voni-2-muebles');
        // Resultado de CotizadorIA ("Agregué N muebles a tu proyecto."): la nube falsa contesta cotizar-texto sin LLM.
        await page.getByRole('button', { name: /Armar el proyecto|Armar la lista de muebles/ }).first().click();
        await expect(page.locator('.tarjeta.agregado-ok strong')).toBeVisible({ timeout: 15000 });
        await auditar('voni-2-resultado');
        await page.getByTestId('voni-paso-acomodo').click();
        await expect(page.getByTestId('voni-continuar-propuesta')).toBeVisible({ timeout: 10000 });
        await auditar('voni-3-acomodo');
        await page.getByTestId('voni-continuar-propuesta').click();
        await auditar('voni-4-propuesta');

        // Propuesta (Proyecto actual): vista interna y la que ve el cliente
        await irInicio(page);
        await page.getByTestId('home-retomar').click();
        await expect(page.locator('.cot-cliente')).toHaveCount(1, { timeout: 10000 });
        if (veCostos) {
          await auditar('propuesta');
          await page.getByRole('button', { name: 'Como la ve el cliente' }).click();
        }
        await expect(page.locator('.cot-cliente.activa')).toBeVisible();
        await auditar('propuesta-cliente');

        // Cocrear
        await irInicio(page);
        await page.getByTestId('home-cocrear').click();
        await auditar('cocrear');

        // Archivo / Presupuestos anteriores
        await irInicio(page);
        await atajo(page, 'Presupuestos anteriores').click();
        await auditar('archivo');

        // Usuarios (sólo Dirección)
        if (rol === 'direccion') {
          await irInicio(page);
          await atajo(page, 'Usuarios y accesos').click();
          await auditar('usuarios');
        }

        fs.writeFileSync(path.join(DIR_PARCIAL, `${rol}-${vp}-${tema}.json`), JSON.stringify({ rol, viewport: vp, tema, pantallas, hallazgos, errores }, null, 2));
        rearmarReporte();
        await context.close();
        const fallos = hallazgos.filter((h) => h.nivel === 'FALLO');
        expect(fallos, JSON.stringify(fallos.slice(0, 25), null, 2)).toEqual([]);
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
//  IMPRESIÓN: con el tema oscuro activo, el documento al cliente imprime en papel blanco y tinta oscura.
// ---------------------------------------------------------------------------------------------------------
for (const [email, rol] of Object.entries(USUARIOS)) {
  test(`impresión · ${rol}: propuesta con partidas en print = fondo blanco y texto oscuro (tema oscuro activo)`, async ({ browser }) => {
    test.setTimeout(2 * 60_000);
    const { context, page, errores } = await entrar(browser, email, { viewport: VIEWPORTS[1440], tema: 'dark' });
    await irInicio(page);
    await page.getByTestId('home-retomar').click();
    await expect(page.locator('.cot-cliente')).toHaveCount(1, { timeout: 10000 });
    await asentar(page);
    // Pantalla en oscuro de verdad antes de imprimir (si no, la prueba no prueba nada).
    const fondoPantalla = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    await asentar(page);
    const r = await page.evaluate(() => {
      const parse = (c) => { const m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const fondoEfectivo = (el) => { for (let p = el; p; p = p.parentElement) { const c = parse(getComputedStyle(p).backgroundColor); if (c && c[3] >= 0.99) return c; } return [255, 255, 255, 1]; };
      const out = [];
      for (const sel of ['.ficha-pdf', '.hoja', '.cot-cliente']) {
        for (const el of document.querySelectorAll(sel)) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none') { out.push({ sel, visible: false }); continue; }
          const bg = fondoEfectivo(el), fg = parse(cs.color);
          // Texto principal del documento (títulos, nombres, importes): todos oscuros sobre el papel.
          const textos = Array.from(el.querySelectorAll('h1,h2,h3,b,strong,.propx-nombre,.propx-importe,.propx-cover-tit')).filter((x) => (x.textContent || '').trim() && x.getClientRects().length)
            .map((x) => { const c = parse(getComputedStyle(x).color); const b = fondoEfectivo(x); return { el: x.className || x.tagName, lumTexto: c ? lum(c) : null, lumFondo: lum(b) }; });
          out.push({ sel, visible: true, fondo: bg, lumFondo: lum(bg), color: fg, lumTexto: fg ? lum(fg) : null, textos });
        }
      }
      return { out, body: getComputedStyle(document.body).backgroundColor };
    });
    fs.mkdirSync(DIR, { recursive: true });
    await page.screenshot({ path: path.join(DIR, `${rol}-impresion-1440-oscuro.png`), fullPage: true });
    fs.writeFileSync(path.join(DIR, `impresion-${rol}.json`), JSON.stringify({ fondoPantalla, ...r }, null, 2));
    await context.close();

    expect(fondoPantalla, 'el tema oscuro debe estar activo en pantalla antes de imprimir').not.toBe('rgb(255, 255, 255)');
    const visibles = r.out.filter((x) => x.visible);
    expect(visibles.map((x) => x.sel), 'el documento al cliente (.cot-cliente) debe imprimirse').toContain('.cot-cliente');
    for (const x of visibles) {
      expect(x.lumFondo, `${x.sel}: fondo blanco al imprimir`).toBeGreaterThan(0.95);
      expect(x.lumTexto, `${x.sel}: texto oscuro al imprimir`).toBeLessThan(0.05);
      for (const t of x.textos) {
        if (t.lumFondo < 0.5) continue;   // texto sobre una banda oscura a propósito (total en negro): no es "papel"
        expect(t.lumTexto, `${x.sel} ${t.el}: texto oscuro sobre papel`).toBeLessThan(0.2);
      }
    }
    expect(errores.filter((e) => e.tipo === 'pageerror')).toEqual([]);
  });
}

// ---------------------------------------------------------------------------------------------------------
//  CANARIO del auditor: si el detector se rompe (p. ej. por el `overflow-x: clip` de html/body), la matriz
//  pasaría en verde sin revisar nada. Aquí se le planta un defecto de cada tipo y TIENE que verlos.
// ---------------------------------------------------------------------------------------------------------
test('canario · el auditor detecta desborde recortado, contraste < 3, CTA tapado y objetivo táctil chico', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;overflow-x:clip;background:#141210;color:#ECE9E4;font:16px sans-serif}
    .ancho{width:600px;height:40px;background:#333}
    .desplaza{overflow-x:auto}.desplaza div{width:900px;height:20px}
    .bajo{color:#3a3a3a}.fab{position:fixed;right:0;bottom:0;width:200px;height:120px;background:#E5484D}
    </style></head><body><main>
    <div class="ancho">se sale</div>
    <div class="desplaza"><div>tabla desplazable a propósito</div></div>
    <p class="bajo">texto casi invisible</p>
    <button style="width:20px;height:20px">x</button>
    <div style="height:1200px"></div><div style="text-align:right"><button style="width:120px;height:60px">Tapado</button></div>
    <div class="fab">FAB</div></main></body></html>`);
  const r = await page.evaluate(auditarEnPagina, { movil: true, exclusionesDesborde: [], alcance: null });
  const tipos = r.hallazgos.filter((h) => h.nivel === 'FALLO').map((h) => h.tipo);
  expect(tipos).toContain('desborde');
  expect(JSON.stringify(r.hallazgos.find((h) => h.tipo === 'desborde').detalle.culpables)).toContain('ancho');
  expect(JSON.stringify(r.hallazgos.find((h) => h.tipo === 'desborde').detalle.culpables)).not.toContain('desplaza');
  expect(r.hallazgos.some((h) => h.tipo === 'contraste' && h.nivel === 'FALLO' && /casi invisible/.test(h.detalle.texto))).toBe(true);
  expect(r.hallazgos.some((h) => h.tipo === 'cta-tapado' && /Tapado/.test(h.detalle.el))).toBe(true);
  expect(r.hallazgos.some((h) => h.tipo === 'objetivo-tactil' && h.nivel === 'FALLO')).toBe(true);
});
