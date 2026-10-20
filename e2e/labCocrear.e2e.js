// LABORATORIO · ciclo COCREAR real (estándar C, auditoría COCREAR_VONI_10): brief (texto, opcional imagen) →
// VONI Council propone → concepto A/B/C → ajustes → estados que muestra la UI (conceptual / validado / listo para
// fabricar, costo, BOM) → (render sólo con LAB_COC_RENDER=1) → GUARDAR → recargar → REABRIR desde la lista →
// comparar campo a campo. Nube real, Edge real, sin mocks de respuesta. Registra, no maquilla: cada paso deja
// JSON + captura + tiempo en LAB_OUT.
//
// Intervenciones de red del laboratorio (todas quedan en el JSON, ninguna simula una respuesta):
//  1) ETIQUETA: Cocrear no deja nombrar el expediente (el nombre lo deriva `descripcionCorta`, p.ej. "Mesa 2.40 m ·
//     nogal"). Para cumplir la regla de laboratorio (sólo escribir expedientes "(lab 10) COC…") se antepone la
//     etiqueta a `p_payload.nombre` en la petición `guardar_cocrear_seguro`. Nada más del payload se toca.
//  2) COSTO: sin LAB_COC_RENDER=1 la llamada `generar-render*` se ABORTA (la app la dispara sola al elegir concepto).
//     Con LAB_COC_RENDER=1 se permiten como máximo LAB_COC_RENDER_MAX (2) llamadas.
//  3) SEGURIDAD: `registrar_producto_desde_expediente` y `registrar_render_canonico` se abortan siempre (crearían
//     producto real). El lab nunca pulsa "Convertir en partida", "Validar ingeniería", Registrar, Cotizar ni Emitir.
//
// Variables: TEST_EMAIL/TEST_PASSWORD (cuenta QA), LAB_COC_ID, LAB_COC_BRIEF, LAB_COC_IMG (opcional),
// LAB_COC_AJUSTES (json: {dimensiones:{ancho_mm,prof_mm,alto_mm}, familia, material, tono, funciones:[...], voni:"frase"}),
// LAB_COC_ESPERADO (json opcional: lo que el brief pide, p.ej. {ancho_mm,prof_mm,alto_mm,familia,capacidad}),
// LAB_COC_CONCEPTO (A|B|C, por defecto A), LAB_COC_RENDER=1, LAB_OUT (carpeta).
import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';

const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const ID = process.env.LAB_COC_ID || 'X';
const BRIEF = process.env.LAB_COC_BRIEF || '';
const IMG = process.env.LAB_COC_IMG || null;
const AJ = process.env.LAB_COC_AJUSTES ? JSON.parse(process.env.LAB_COC_AJUSTES) : null;
const ESPERADO = process.env.LAB_COC_ESPERADO ? JSON.parse(process.env.LAB_COC_ESPERADO) : null;
const CONCEPTO = (process.env.LAB_COC_CONCEPTO || 'A').toUpperCase();
const RENDER = process.env.LAB_COC_RENDER === '1';
const RENDER_MAX = Number(process.env.LAB_COC_RENDER_MAX || 2);
const SALIDA = process.env.LAB_OUT || `test-results-prod/lab-cocrear/${ID}`;
const hhmm = new Date().toISOString().slice(11, 16).replace(':', '');
const ETIQUETA = `(lab 10) COC-${ID} ${hhmm}`;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const guarda = (n, o) => fs.writeFileSync(path.join(SALIDA, n), typeof o === 'string' ? o : JSON.stringify(o, null, 2));
const recorta = (s, n = 400) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n)}…(${s.length} car.)` : s);
// Quita base64 y cadenas largas de un objeto de red antes de guardarlo (capturas pequeñas, JSON legible).
const limpio = (o, n = 600) => JSON.parse(JSON.stringify(o ?? null, (k, v) => (typeof v === 'string' ? (/^data:|^[A-Za-z0-9+/=]{2000,}$/.test(v) ? `[omitido ${v.length} car.]` : recorta(v, n)) : v)));

// Cierre ChatGPT (P1-CERT-COC-01): en Costear, la persona RESUELVE materiales antes de regresar a Cocrear. El laboratorio
// hace lo mismo que Diseño, sin inventar equivalencias: (1) confirma los propuestos por regla; (2) acepta diferencias con
// confirmación humana explícita (botón de la app); (3) a la pieza SIN material le elige del catálogo REAL un insumo de la
// MISMA familia que pide (select curado; si no, buscador ERP). Si no existe ninguno de esa familia → BLOCKED_DATA con el
// dato exacto que falta. Nunca elige "el primero que salga" de otra familia.
const FAMILIAS = [
  // Orden: lo específico primero (una "cubierta de cuarzo" es cuarzo, no tablero).
  { re: /cuarzo|solid surface|superficie s[oó]lida|corian/i, opt: /cuarzo|solid|superficie/i, erp: 'cuarzo' },
  { re: /cristal|vidrio/i, opt: /cristal|vidrio/i, erp: 'cristal' },
  { re: /vinil|tela|tapiz|piel/i, opt: /vinil|tela|tapiz|piel/i, erp: 'vinil' },
  { re: /espuma|hule|poliuretano/i, opt: /espuma|hule|poliuretano/i, erp: 'espuma' },
  { re: /\bcanto\b|cubrecanto/i, opt: /canto/i, erp: 'canto' },
  { re: /pintura|electrost/i, opt: /pintura/i, erp: 'pintura' },
  { re: /bisagra/i, opt: /bisagra/i, erp: 'bisagra' },
  { re: /corredera|riel/i, opt: /corredera|riel/i, erp: 'corredera' },
  { re: /jaladera|tirador/i, opt: /jaladera|tirador/i, erp: 'jaladera' },
  { re: /nivelador|regat/i, opt: /nivelador|regat/i, erp: 'nivelador' },
  { re: /tornill|minifix|taquete|herraje|ensamble/i, opt: /tornill|herraje|minifix/i, erp: 'tornillo' },
  { re: /\bled\b|ilumin/i, opt: /\bled\b/i, erp: 'LED' },
  { re: /el[eé]ctric|acometida|byrne|contacto|portacables/i, opt: /el[eé]ctric|contacto|byrne|portacable/i, erp: 'eléctrico' },
  { re: /\bptr\b|tubular|tubo|perfil|estructura met|marco met|bastidor|travesa|patas? (de )?(acero|metal)/i, opt: /\bptr\b|tubular|tubo|perfil/i, erp: 'PTR' },
  { re: /l[aá]mina|placa|cal\.?\s?1[0-8]\b|charola/i, opt: /l[aá]mina|placa/i, erp: 'lámina' },
  { re: /melamin/i, opt: /melamin/i, erp: 'melamina' },
  { re: /\bchapa\b/i, opt: /chapa/i, erp: 'chapa' },
  // Tablero estructural (lateral, cubierta, entrepaño, costado, fondo, respaldo, puerta, faldón, división, piso, nogal/roble):
  // la base de fabricación es MDF; el acabado (chapa) va como pieza propia cuando el despiece la trae.
  { re: /\bmdf\b|aglomerad|tablero|triplay|nogal|roble|encino|madera|lateral|cubierta|entrepa|costado|fondo|respaldo|piso|divisi|puerta|fald[oó]n|panel|duela|tapa/i, opt: /\bmdf\b|triplay|tablero/i, erp: 'MDF' },
];
async function resolverMateriales(page) {
  const out = { confirmados: 0, diferenciasAceptadas: 0, elegidos: [], bloqueados: [] };
  const PENDIENTE = /sin precio certificado|Material pendiente|Costo pendiente|Varios materiales posibles|Sustituci[oó]n requiere/i;
  const confirmarTodo = async () => {
    if (await page.getByTestId('piloto-confirmar').count()) { await page.getByTestId('piloto-confirmar').first().click(); await page.waitForTimeout(1500); out.confirmados++; }
    for (let k = 0; k < 30 && (await page.getByTestId('confirmar-con-diferencia').count()); k++) { await page.getByTestId('confirmar-con-diferencia').first().click(); await page.waitForTimeout(400); out.diferenciasAceptadas++; }
  };
  await confirmarTodo();
  const filas = page.locator('.pieza');
  const n = await filas.count();
  const alertasDe = async (f) => (await f.getByTestId('alerta-material').allInnerTexts().catch(() => [])).join(' ');
  for (let i = 0; i < n; i++) {
    const f = filas.nth(i);
    const sel = f.locator('select.pieza-mat');
    if (!(await sel.count())) continue;
    const val = await sel.inputValue().catch(() => '');
    let alerta = await alertasDe(f);
    if (val && !PENDIENTE.test(alerta)) continue;          // ya costeable
    const nombre = await f.locator('.pieza-nom').inputValue().catch(() => '');
    const fam = FAMILIAS.find((x) => x.re.test(`${nombre} ${alerta}`));
    if (!fam) { out.bloqueados.push({ pieza: nombre, motivo: 'familia de material no reconocible: no se elige nada a ciegas' }); continue; }
    // 1) Opciones del catálogo curado de la MISMA familia, distintas de la actual; se verifica que la alerta se vaya.
    const opciones = (await sel.locator('option').evaluateAll((os) => os.map((o) => ({ v: o.value, t: o.textContent || '' }))).catch(() => []))
      .filter((o) => o.v && o.v !== val && fam.opt.test(o.t));
    let listo = null;
    for (const op of opciones.slice(0, 6)) {
      await sel.selectOption(op.v); await page.waitForTimeout(700);
      alerta = await alertasDe(f);
      if (!PENDIENTE.test(alerta)) { listo = { insumo: op.t.trim(), via: 'catalogo' }; break; }
    }
    // 2) Buscador ERP de la misma familia.
    if (!listo && (await f.getByTestId('buscar-insumo-abrir').count())) {
      await f.getByTestId('buscar-insumo-abrir').click();
      await f.getByTestId('buscador-insumo').locator('input[type=search]').fill(fam.erp);
      await page.waitForTimeout(2500);
      const lis = f.locator('.buscador-insumo-lista li').filter({ hasText: fam.opt });
      const k = Math.min(await lis.count(), 4);
      for (let j = 0; j < k && !listo; j++) {
        const li = lis.nth(j); const t = (await li.innerText()).replace(/\s+/g, ' ').slice(0, 120);
        await li.getByRole('button', { name: /^Usar$/ }).click(); await page.waitForTimeout(900);
        alerta = await alertasDe(f);
        if (!PENDIENTE.test(alerta)) listo = { insumo: t, via: 'erp' };
        else if (j + 1 < k && (await f.getByTestId('buscar-insumo-abrir').count())) { await f.getByTestId('buscar-insumo-abrir').click(); await f.getByTestId('buscador-insumo').locator('input[type=search]').fill(fam.erp); await page.waitForTimeout(2000); }
      }
    }
    if (listo) out.elegidos.push({ pieza: nombre, familia: fam.erp, ...listo });
    else out.bloqueados.push({ pieza: nombre, motivo: `no hay insumo real CON PRECIO de la familia «${fam.erp}» en el catálogo/ERP`, alerta: alerta.slice(0, 160) });
  }
  await confirmarTodo();
  return out;
}

async function captura(page, n) {
  const f = `${n}.jpg`;
  await page.screenshot({ path: path.join(SALIDA, f), fullPage: true, type: 'jpeg', quality: 45 }).catch(() => {});
  return f;
}

// Texto de error del render (párrafo rojo #ff9d93 bajo el lienzo).
const errorRender = (page) => page.evaluate(() => [...document.querySelectorAll('.c3-studio p')].find((p) => getComputedStyle(p).color === 'rgb(255, 157, 147)')?.textContent || null).catch(() => null);

// Lo que el estudio muestra (sólo la UI: lo que una persona ve).
async function leerEstudio(page) {
  const main = await page.locator('main').first().innerText().catch(async () => page.locator('body').innerText());
  const val = async (txt) => page.locator('label', { hasText: new RegExp(`^${txt}`) }).locator('input').first().inputValue({ timeout: 2000 }).catch(() => null);
  const linea = (re) => (main.match(re) || [])[1]?.trim() || null;   // ojo: las etiquetas usan text-transform:uppercase → regex /i
  const botonesSel = await page.evaluate(() => [...document.querySelectorAll('.c3-studio button')].filter((b) => /2px solid/.test(b.getAttribute('style') || '')).map((b) => b.textContent.trim()));
  const funciones = await page.evaluate(() => [...document.querySelectorAll('.c3-studio button')].map((b) => b.textContent.trim()).filter((t) => t.startsWith('✓ ')).map((t) => t.slice(2)));
  const historia = await page.locator('.c3-history button').allInnerTexts().catch(() => []);
  const img = page.locator('.c3-hero img').first();
  const imgSrc = (await img.count()) ? await img.getAttribute('src') : null;
  const btn = async (re) => { const b = page.getByRole('button', { name: re }).first(); if (!(await b.count())) return { existe: false }; return { existe: true, habilitado: await b.isEnabled(), texto: (await b.innerText()).trim() }; };
  const titulo = await page.locator('.coc3 strong').first().innerText().catch(() => null);
  return {
    titulo,
    rev: linea(/REV\s+(\d+)/),
    tipologia: await page.locator('.c3-studio select').first().inputValue().catch(() => null),
    dimensiones: { ancho_mm: Number(await val('Ancho')), prof_mm: Number(await val('Fondo')), alto_mm: Number(await val('Alto')) },
    capacidadInput: await page.locator('.c3-studio input[type=number][min="2"]').first().inputValue({ timeout: 500 }).catch(() => null),
    seleccionMaterialTono: botonesSel,
    funciones,
    historia: historia.map((h) => h.trim()),
    render: { hayImagen: !!imgSrc, origen: imgSrc ? (imgSrc.startsWith('data:') ? 'dataUrl' : imgSrc.startsWith('http') ? 'url' : 'otro') : null, src: imgSrc ? recorta(imgSrc, 140) : null, vencido: /render está vencido/.test(main), sinRender: /Sin render de esta revisión/.test(main) },
    verdadIndustrial: {
      costo: linea(/Costo calculado:\s*([^\n]+)/), estadoMotor: linea(/Estado motor:\s*([^\n]+)/),
      componentesBOM: linea(/Componentes BOM:\s*([^\n]+)/), ingenieria: linea(/Ingenier[ií]a:\s*([^\n]+)/),
    },
    modelo3D: (main.match(/(MODELO TÉCNICO[^\n]*|Modelo conceptual[^\n]*)/g) || []).slice(0, 3),
    estimadoDiseno: linea(/Estimado de diseño · evidencia real\s*\n([^\n]+)/i),
    referenciaComercial: linea(/Referencia comercial real\s*\n([^\n]+)/i),
    botones: {
      guardar: await btn(/^(Guardar|✓ Guardado|Guardando…)$/),
      validarIngenieria: await btn(/Validar ingeniería/),
      convertirEnPartida: await btn(/Convertir en partida|En cotización/),
      generarRender: await btn(/^(Generar render|Regenerar|Generando…)$/),
    },
    // ¿La UI distingue los tres estados del estándar C? Se busca el TEXTO visible, no el código.
    estadosVisibles: {
      conceptual: /modelo conceptual/i.test(main), ingenieria: linea(/Ingenier[ií]a:\s*([^\n]+)/), validado: /Ingenier[ií]a:\s*VALIDADA/.test(main), requiereValidacion: /REQUIERE VALIDACIÓN/.test(main),
      listoParaFabricar: /listo para (fabricar|fabricaci[oó]n|producci[oó]n)/i.test(main), preliminar: /preliminar/i.test(main), certificado: /certificad/i.test(main),
    },
    mensaje: linea(/Aplicar con VONI\s*\n([^\n]+)/),
    textoPrincipal: recorta(main, 7000),
  };
}

test('COCREAR real: brief → concepto → ajustes → estados → guardar → recargar → reabrir → comparar', async ({ page }) => {
  test.skip(!(EMAIL && PASS && BRIEF), 'Define TEST_EMAIL, TEST_PASSWORD y LAB_COC_BRIEF.');
  test.setTimeout(32 * 60 * 1000); fs.mkdirSync(SALIDA, { recursive: true });   // con resolución de materiales + reabrir con costo (cierre ChatGPT)
  const T0 = Date.now(); const tiempos = {}; const marca = (k, desde) => { tiempos[k] = Math.round((Date.now() - desde) / 100) / 10; return tiempos[k]; };
  const red = []; const pageErrors = []; const consoleErrors = []; const pasos = []; const intervenciones = [];
  const r = { id: ID, etiqueta: ETIQUETA, brief: BRIEF, imagen: IMG, ajustes: AJ, esperado: ESPERADO, concepto: CONCEPTO, renderPedido: RENDER, inicio: new Date(T0).toISOString(), baseURL: 'http://localhost:5173' };
  const paso = (nombre, datos) => { pasos.push({ paso: nombre, t: Math.round((Date.now() - T0) / 100) / 10, ...datos }); console.log(`[lab-cocrear ${ID}] ${nombre}`, JSON.stringify(datos || {}).slice(0, 300)); };
  let llamadasRender = 0; let guardadoReq = null; let guardadoResp = null; let reabiertoResp = null; const council = [];

  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(recorta(m.text(), 300)); });
  page.on('response', async (res) => {
    const u = res.url(); const m = u.match(/\/functions\/v1\/([a-z0-9-]+)|\/rest\/v1\/rpc\/([a-z0-9_]+)/);
    if (!m) return; const fn = m[1] || m[2];
    if (!/voni|render|cocrear|registrar|analizar|producto|buscar/.test(fn)) return;
    let j = null; try { j = await res.json(); } catch (_e) {}
    const e = { t: Math.round((Date.now() - T0) / 100) / 10, fn, status: res.status(), ok: j?.ok ?? null, error: j?.error ? recorta(String(j.error), 300) : null };
    red.push(e);
    if (/^voni-council/.test(fn)) council.push({ ...e, body: limpio(j, 1500) });
    if (fn === 'cocrear_seguro') reabiertoResp = j;
    if (fn === 'guardar_cocrear_seguro') guardadoResp = j;
  });
  page.on('requestfailed', (q) => { const u = q.url(); if (/functions\/v1|rest\/v1\/rpc/.test(u)) red.push({ t: Math.round((Date.now() - T0) / 100) / 10, fn: u.replace(/^.*\/(functions\/v1|rest\/v1\/rpc)\//, ''), fallo: q.failure()?.errorText || 'failed' }); });

  // (3) Seguridad: nada que cree producto real.
  await page.route(/\/rest\/v1\/rpc\/(registrar_producto_desde_expediente|registrar_render_canonico)/, (route) => { intervenciones.push({ tipo: 'seguridad-abortado', url: route.request().url() }); return route.abort('blockedbyclient'); });
  // (2) Costo: render sólo si se pidió.
  await page.route(/\/functions\/v1\/generar-render/, (route) => {
    llamadasRender += 1;
    if (RENDER && llamadasRender <= RENDER_MAX) { intervenciones.push({ tipo: 'render-permitido', n: llamadasRender }); return route.continue(); }
    intervenciones.push({ tipo: 'render-abortado-por-costo', n: llamadasRender, motivo: RENDER ? `excede LAB_COC_RENDER_MAX=${RENDER_MAX}` : 'LAB_COC_RENDER≠1' });
    return route.abort('blockedbyclient');
  });
  // (1) Etiqueta del expediente.
  await page.route(/\/rest\/v1\/rpc\/guardar_cocrear_seguro/, async (route) => {
    const q = route.request(); let body = null; try { body = JSON.parse(q.postData() || 'null'); } catch (_e) {}
    if (!body?.p_payload) { intervenciones.push({ tipo: 'etiqueta-no-aplicada', motivo: 'payload ilegible' }); return route.continue(); }
    const original = body.p_payload.nombre;
    body.p_payload.nombre = `${ETIQUETA} · ${original || 'Cocreación'}`;
    guardadoReq = body;
    intervenciones.push({ tipo: 'etiqueta', nombreOriginal: original, nombreEscrito: body.p_payload.nombre, expedienteId: body.p_expediente_id ?? null });
    return route.continue({ postData: JSON.stringify(body) });
  });

  const resultado = { checks: {}, comparacion: null };
  try {
    // 0) Entrar (onboarding marcado como visto, como en los demás labs).
    let t = Date.now();
    await page.addInitScript(() => { try { const k = 'costeador-vonhaucke-v1'; const s = JSON.parse(window.localStorage.getItem(k) || '{}'); s.onboardingVisto = true; window.localStorage.setItem(k, JSON.stringify(s)); } catch (_e) {} });
    await page.goto('/');
    await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
    if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
    marca('loginSeg', t);

    // 1) Cocrear desde cero (pantalla de inicio, sin reabrir nada).
    t = Date.now();
    await page.getByTestId('home-cocrear').click();
    await expect(page.getByText('¿Qué quieres crear?')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);   // lista de guardadas
    const guardadasAntes = await page.locator('.coc3 button').filter({ hasText: 'reabrir' }).allInnerTexts().catch(() => []);
    marca('abrirCocrearSeg', t);
    paso('1-inicio', { guardadasVisibles: guardadasAntes.length, guardadasLab10: guardadasAntes.filter((x) => x.includes('(lab 10)')).length, captura: await captura(page, '01-inicio') });

    // 2) Brief (+ imagen si la UI la admite).
    await page.locator('.coc3 textarea').first().fill(BRIEF);
    const inputsArchivo = await page.locator('input[type=file]').count();
    r.imagenSoportada = inputsArchivo > 0;
    if (IMG) {
      if (inputsArchivo > 0) { await page.locator('input[type=file]').first().setInputFiles(IMG); paso('2-imagen', { subida: true, archivo: IMG }); } else paso('2-imagen', { subida: false, motivo: 'La pantalla de Cocrear no tiene ningún <input type=file>: no hay forma de dar una imagen de referencia. Se continúa sólo con el texto.', archivo: IMG });
    }
    t = Date.now();
    await page.getByRole('button', { name: /Crear conceptos con VONI/ }).click();
    await expect(page.getByText('Tres direcciones, una misma intención')).toBeVisible({ timeout: 240000 });
    marca('conceptosSeg', t);
    const txtConceptos = await page.locator('main').first().innerText();
    const loQueEntendimos = (txtConceptos.match(/Lo que entendimos\s*\n([\s\S]*?)Análisis VONI Council/i) || [])[1]?.trim() || null;
    const councilUI = (txtConceptos.match(/Análisis VONI Council\s*\n([^\n]+)/i) || [])[1]?.trim() || null;
    const conceptos = await page.locator('.c3-cards h2').allInnerTexts();
    paso('2-conceptos', {
      loQueEntendimos, councilUI: recorta(councilUI, 1200), councilNoDisponible: /Council no disponible/.test(txtConceptos),
      esProyecto: /Esto es un PROYECTO completo/.test(txtConceptos), candidatosCatalogo: (txtConceptos.match(/Primero · ¿ya existe en Von Haucke\?[\s\S]*?Elige una dirección/i) || [''])[0].slice(0, 600),
      conceptos, captura: await captura(page, '02-conceptos'),
    });

    // 3) Elegir concepto → estudio (la app dispara un render automático aquí).
    t = Date.now();
    const idx = Math.max(0, ['A', 'B', 'C'].indexOf(CONCEPTO));
    await page.locator('.c3-cards').getByRole('button', { name: /Desarrollar/ }).nth(idx).click();
    await expect(page.locator('.c3-studio')).toBeVisible({ timeout: 20000 });
    marca('estudioSeg', t);
    t = Date.now();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: 'Generando…' })).toHaveCount(0, { timeout: 300000 });
    marca('renderAutomaticoSeg', t);
    await page.waitForTimeout(800);
    const estudio1 = await leerEstudio(page);
    const renderErr1 = await errorRender(page);
    paso('3-estudio', { renderAutomatico: { llamadas: llamadasRender, hayImagen: estudio1.render.hayImagen, error: renderErr1 }, estado: { ...estudio1, textoPrincipal: undefined }, captura: await captura(page, '03-estudio') });

    // 4) Ajustes (sólo lo que la UI permite: medidas, tipología, material, tono, funciones, VONI co-diseñador).
    const ajustesAplicados = [];
    if (AJ) {
      t = Date.now();
      if (AJ.familia) { await page.locator('.c3-studio select').first().selectOption(AJ.familia).then(() => ajustesAplicados.push({ familia: AJ.familia, ok: true }), (e) => ajustesAplicados.push({ familia: AJ.familia, ok: false, error: String(e).slice(0, 160) })); }
      for (const [k, lbl] of [['ancho_mm', 'Ancho'], ['prof_mm', 'Fondo'], ['alto_mm', 'Alto']]) {
        if (AJ.dimensiones?.[k] == null) continue;
        const inp = page.locator('label', { hasText: new RegExp(`^${lbl}`) }).locator('input').first();
        await inp.fill(String(AJ.dimensiones[k]));
        await page.waitForTimeout(300);
        ajustesAplicados.push({ [k]: AJ.dimensiones[k], leido: Number(await inp.inputValue()) });
      }
      if (AJ.capacidad) {
        const cap = page.locator('.c3-studio input[type=number][min="2"]').first();
        if (await cap.count()) { await cap.fill(String(AJ.capacidad)); ajustesAplicados.push({ capacidad: AJ.capacidad, ok: true }); } else ajustesAplicados.push({ capacidad: AJ.capacidad, ok: false, motivo: 'la UI sólo muestra "Personas / puestos" en la tipología operativo_colaborativo' });
      }
      if (AJ.material) { const b = page.locator('.c3-studio').getByRole('button', { name: AJ.material, exact: true }).first(); if (await b.count()) { await b.click(); ajustesAplicados.push({ material: AJ.material, ok: true }); } else ajustesAplicados.push({ material: AJ.material, ok: false, motivo: 'material no ofrecido por la UI' }); }
      if (AJ.tono) { const b = page.locator('.c3-studio').getByRole('button', { name: AJ.tono, exact: true }).first(); if (await b.count()) { await b.click(); ajustesAplicados.push({ tono: AJ.tono, ok: true }); } else ajustesAplicados.push({ tono: AJ.tono, ok: false }); }
      for (const f of AJ.funciones || []) {
        const b = page.locator('.c3-studio').getByRole('button', { name: new RegExp(`^\\+ ${escRe(f)}$`) }).first();
        if (await b.count()) { await b.click(); ajustesAplicados.push({ funcion: f, ok: true }); } else ajustesAplicados.push({ funcion: f, ok: false, motivo: 'función no ofrecida o ya activa' });
      }
      if (AJ.voni) {
        const tv = Date.now(); const nCouncil = council.length;
        await page.locator('textarea[placeholder^="Ej. Haz la jardinera"]').fill(AJ.voni);
        await page.getByRole('button', { name: 'Aplicar con VONI' }).click();
        await expect(page.getByRole('button', { name: 'Analizando…' })).toHaveCount(0, { timeout: 240000 });
        await page.waitForTimeout(500);
        const main = await page.locator('main').first().innerText();
        ajustesAplicados.push({ voni: AJ.voni, seg: Math.round((Date.now() - tv) / 100) / 10, respuestaUI: recorta((main.match(/Aplicar con VONI\s*\n([^\n]+)/) || [])[1] || null, 1500), councilLlamado: council.length > nCouncil });
      }
      marca('ajustesSeg', t);
    }
    const estudio2 = await leerEstudio(page);
    paso('4-ajustes', { ajustesAplicados, estado: { ...estudio2, textoPrincipal: undefined }, captura: await captura(page, '04-ajustes') });

    // 4b) Render explícito SÓLO si se pidió y la revisión actual no tiene uno vigente.
    if (RENDER && (!estudio2.render.hayImagen || estudio2.render.vencido)) {
      t = Date.now();
      const b = page.getByRole('button', { name: /^(Generar render|Regenerar)$/ }).first();
      if (await b.count() && await b.isEnabled()) {
        await b.click(); await page.waitForTimeout(1500);
        await expect(page.getByRole('button', { name: 'Generando…' })).toHaveCount(0, { timeout: 300000 });
        marca('renderExplicitoSeg', t);
      }
      const est = await leerEstudio(page);
      const err = await errorRender(page);
      paso('4b-render', { llamadas: llamadasRender, hayImagen: est.render.hayImagen, origen: est.render.origen, vencido: est.render.vencido, error: err, captura: await captura(page, '05-render') });
    }

    // 5) GUARDAR.
    const antes = await leerEstudio(page);
    t = Date.now();
    const guardar = page.getByRole('button', { name: /^Guardar$/ }).first();
    r.guardarHabilitado = await guardar.isEnabled();
    await guardar.click();
    await expect(page.getByText(/Co-creación guardada|No se pudo guardar/).first()).toBeVisible({ timeout: 30000 });
    marca('guardarSeg', t);
    const msgGuardar = (await page.getByText(/Co-creación guardada|No se pudo guardar/).first().innerText()).slice(0, 300);
    const p = guardadoReq?.p_payload || null;
    paso('5-guardar', {
      mensaje: msgGuardar, respuesta: limpio(guardadoResp),
      payload: p ? {
        nombre: p.nombre, familia: p.familia, spec: p.spec, brief: p.brief, costSnapshot: p.costSnapshot, render: p.render, specHash: p.specHash,
        historia: (p.historia || []).map((h) => `R${h.rev} · ${h.label}`), intentClaves: Object.keys(p.intent || {}),
        componentes: (p.spec?.componentes || []).length, bytes: JSON.stringify(p).length,
        engineering: { validated: p.intent?._engineering_validated ?? null, validation: p.intent?._engineering_validation ?? null },
      } : null,
      captura: await captura(page, '06-guardado'),
    });

    // 6) Recargar → lista → REABRIR (desde la lista, como una persona).
    t = Date.now();
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
    await page.getByTestId('home-cocrear').click();
    await expect(page.getByText('¿Qué quieres crear?')).toBeVisible({ timeout: 20000 });
    const tarjeta = page.getByRole('button', { name: new RegExp(escRe(ETIQUETA)) }).first();
    let enLista = true;
    await expect(tarjeta).toBeVisible({ timeout: 20000 }).catch(() => { enLista = false; });
    const lista = await page.locator('.coc3 button').filter({ hasText: 'reabrir' }).allInnerTexts().catch(() => []);
    const posicion = lista.findIndex((x) => x.includes(ETIQUETA));
    paso('6-lista', { enLista, posicion, total: lista.length, textoTarjeta: posicion >= 0 ? lista[posicion].replace(/\s+/g, ' ') : null, captura: await captura(page, '07-lista') });
    let despues = null;
    if (enLista) {
      await tarjeta.click();
      await expect(page.locator('.c3-studio')).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(2500);
      marca('reabrirSeg', t);
      despues = await leerEstudio(page);
      paso('7-reabierto', { estado: { ...despues, textoPrincipal: undefined }, respuestaServidor: limpio({ ...(reabiertoResp || {}), cocrear: reabiertoResp?.cocrear ? { nombre: reabiertoResp.cocrear.nombre, brief: reabiertoResp.cocrear.brief, render: reabiertoResp.cocrear.render, costSnapshot: reabiertoResp.cocrear.costSnapshot, specHash: reabiertoResp.cocrear.specHash, historia: (reabiertoResp.cocrear.historia || []).length } : null }), captura: await captura(page, '08-reabierto') });
    }

    // 7) Comparación campo a campo (UI antes de guardar vs UI reabierta; payload enviado vs payload devuelto).
    // jsonb no conserva el orden de llaves: se compara con llaves ordenadas.
    const estable = (o) => (Array.isArray(o) ? o.map(estable) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, estable(o[k])])) : o);
    const eq = (a, b) => JSON.stringify(estable(a)) === JSON.stringify(estable(b));
    const rc = reabiertoResp?.cocrear || null;
    const fila = (campo, a, b) => ({ campo, antes: a, despues: b, igual: eq(a, b) });
    resultado.comparacion = despues ? [
      fila('titulo', antes.titulo, despues.titulo),
      fila('rev', antes.rev, despues.rev),
      fila('tipologia', antes.tipologia, despues.tipologia),
      fila('dimensiones', antes.dimensiones, despues.dimensiones),
      fila('material/tono seleccionados', antes.seleccionMaterialTono, despues.seleccionMaterialTono),
      fila('funciones', antes.funciones, despues.funciones),
      fila('historia (chips)', antes.historia, despues.historia),
      fila('verdad industrial', antes.verdadIndustrial, despues.verdadIndustrial),
      fila('estados visibles', antes.estadosVisibles, despues.estadosVisibles),
      fila('render visible', { hay: antes.render.hayImagen, origen: antes.render.origen }, { hay: despues.render.hayImagen, origen: despues.render.origen }),
      fila('intención (payload enviado vs devuelto)', p?.intent ?? null, rc?.intent ?? null),
      fila('brief (payload)', p?.brief ?? null, rc?.brief ?? null),
      fila('historia (payload)', (p?.historia || []).length, (rc?.historia || []).length),
      fila('firma render (payload)', p?.render ?? null, rc?.render ?? null),
      fila('costSnapshot (payload)', p?.costSnapshot ?? null, rc?.costSnapshot ?? null),
      fila('render_aislado_url (servidor)', null, reabiertoResp?.render_aislado_url ?? null),
    ] : null;

    // 8) Hechos para la clasificación (estándar C). El veredicto final se escribe a mano en LEEME con esta evidencia.
    const ui = despues || antes; const c = resultado.checks;
    c.conceptoPropuesto = conceptos.length > 0;
    c.councilRespondio = council.some((x) => x.status === 200 && x.ok !== false);
    c.bomComponentes = Number(String(antes.verdadIndustrial.componentesBOM || '0').replace(/\D/g, '')) || 0;
    c.costoConocido = !!antes.verdadIndustrial.costo && !/Pendiente/.test(antes.verdadIndustrial.costo);
    c.estadoMotor = antes.verdadIndustrial.estadoMotor;
    c.distingueConceptualValidadoListo = { conceptual: ui.estadosVisibles.conceptual, ingenieria: ui.estadosVisibles.ingenieria, listoParaFabricar: ui.estadosVisibles.listoParaFabricar };
    c.validarIngenieriaHabilitado = antes.botones.validarIngenieria.habilitado ?? null;
    c.convertirEnPartidaHabilitado = antes.botones.convertirEnPartida.habilitado ?? null;
    c.guardado = /Co-creación guardada/.test(msgGuardar);
    c.reabiertoDesdeLista = !!despues;
    c.reaperturaIdentica = resultado.comparacion ? resultado.comparacion.filter((x) => !x.campo.startsWith('render') && !x.campo.startsWith('firma render') && !x.campo.startsWith('render_aislado')).every((x) => x.igual) : false;
    c.camposDistintos = resultado.comparacion ? resultado.comparacion.filter((x) => !x.igual).map((x) => x.campo) : null;
    c.renderAntesDeGuardar = antes.render.hayImagen;
    c.renderTrasReabrir = despues ? despues.render.hayImagen : null;
    c.llamadasRender = llamadasRender;
    c.imagenReferenciaSoportada = IMG ? r.imagenSoportada : null;
    if (ESPERADO) {
      const d = estudio1.dimensiones; const dif = {};
      for (const k of ['ancho_mm', 'prof_mm', 'alto_mm']) if (ESPERADO[k] != null) dif[k] = { pedido: ESPERADO[k], interpretado: d[k], ok: d[k] === ESPERADO[k] };
      if (ESPERADO.familia) dif.familia = { pedido: ESPERADO.familia, interpretado: estudio1.tipologia, ok: estudio1.tipologia === ESPERADO.familia };
      if (ESPERADO.capacidad) { const cap = (loQueEntendimos || '').match(/Capacidad:\s*([^\n]+)/)?.[1] || null; dif.capacidad = { pedido: ESPERADO.capacidad, interpretado: cap, ok: new RegExp(`\\b${ESPERADO.capacidad}\\b`).test(cap || '') }; }
      c.briefInterpretado = dif;
    }
    if (AJ?.dimensiones && despues) c.ajustesConservados = Object.fromEntries(Object.entries(AJ.dimensiones).map(([k, v]) => [k, { pedido: v, reabierto: despues.dimensiones[k], ok: despues.dimensiones[k] === v }]));
    // Inyección: ¿la UI o el Council afirmaron "listo para fabricar" o costo $1?
    const textoTodo = `${ui.textoPrincipal}\n${council.map((x) => JSON.stringify(x.body)).join('\n')}`;
    c.inyeccion = { uiDiceListoParaFabricar: ui.estadosVisibles.listoParaFabricar, uiCostoUnPeso: /\$\s?1(\.00)?\b(?![\d,])/.test(ui.textoPrincipal), councilMencionaListo: /listo para fabric/i.test(council.map((x) => JSON.stringify(x.body)).join(' ')), councilMencionaCostoUno: /\$\s?1(\.00)?\b(?![\d,])|costo (de )?1\b/i.test(council.map((x) => JSON.stringify(x.body)).join(' ')), ingenieriaValidadaPayload: p?.intent?._engineering_validated === true, textoBuscado: textoTodo.length };
    // 9) Mueble NUEVO (certificación 18-oct): el camino completo a despiece y costo del servidor, que antes el laboratorio
    //    no recorría: Pasar a Costear → Analizar con Voni → Regresar a Cocrear con el despiece → Guardar → Costear en el servidor.
    if (process.env.LAB_COC_BAJAR_BOM === '1') {
      const bb = { intentado: true };
      try {
        const pasar = page.getByRole('button', { name: /Pasar a Costear/ }).first();
        bb.pasarHabilitado = await pasar.isEnabled().catch(() => false);
        if (bb.pasarHabilitado) {
          t = Date.now();
          await pasar.click();
          await expect(page.getByTestId('costear-desde-cocrear')).toBeVisible({ timeout: 30000 });
          bb.descripcion = (await page.locator('#costear-descripcion').inputValue().catch(() => '')).slice(0, 400);
          const esperaAn = page.waitForResponse((x) => x.url().includes('/functions/v1/analizar-mueble'), { timeout: 240000 });
          await page.getByRole('button', { name: /Analizar con Voni/ }).click();
          let an = await esperaAn; bb.analizarStatus = an.status();
          if (an.status() >= 500) {   // fallo pasajero de la IA: una persona vuelve a apretar "Analizar" (una vez)
            await page.waitForTimeout(5000);
            const reintento = page.waitForResponse((x) => x.url().includes('/functions/v1/analizar-mueble'), { timeout: 240000 });
            await page.getByRole('button', { name: /Analizar con Voni/ }).click();
            an = await reintento; bb.analizarReintento = an.status(); bb.analizarStatus = an.status();
          }
          const volver = page.getByTestId('costear-volver-cocrear');
          await expect(volver).toBeEnabled({ timeout: 120000 });
          bb.piezasEnCostear = Number(((await volver.innerText()).match(/\((\d+) piezas\)/) || [])[1] || 0);
          bb.materiales = await resolverMateriales(page);
          await captura(page, '09a-materiales-resueltos');
          await volver.click();
          await expect(page.locator('.c3-studio')).toBeVisible({ timeout: 30000 });
          await page.waitForTimeout(1500);
          await page.getByRole('button', { name: /^Guardar$/ }).first().click();
          await expect(page.getByText(/Co-creación guardada|No se pudo guardar/).first()).toBeVisible({ timeout: 30000 });
          const esperaCs = page.waitForResponse((x) => x.url().includes('/functions/v1/costear-servidor'), { timeout: 120000 }).catch(() => null);
          await page.getByRole('button', { name: /^Costear en el servidor$/ }).click();
          const cs = await esperaCs; bb.costearStatus = cs?.status() ?? null;
          try { const j = await cs?.json(); bb.costearRespuesta = { ok: j?.ok, estado: j?.estado, code: j?.code, error: j?.error, costo: j?.costo?.costoUnitario ?? null, precio: j?.precioVenta ?? null, warnings: (j?.warnings || []).slice(0, 5) }; } catch (_e) { /* sin cuerpo */ }
          await page.waitForTimeout(2000);
          const main = await page.locator('main').first().innerText();
          bb.panel = { componentes: Number((main.match(/Componentes BOM:\s*(\d+)/) || [])[1] || 0), servidor: (main.match(/Servidor:\s*([^\n]+)/) || [])[1] || null,
            costoServidor: (main.match(/Costo del servidor:\s*([^\n]+)/) || [])[1] || null, precio: (main.match(/Precio sugerido:\s*([^\n]+)/) || [])[1] || null };
          marca('bajarBomSeg', t);
          await captura(page, '09-bom-costeado');
          bb.convertirEnPartidaHabilitado = await page.getByRole('button', { name: /Convertir en partida|Agregar a (la )?cotizaci/ }).first().isEnabled().catch(() => null);
          // Persistencia de la economía: guardar → recargar → reabrir → mismo costo/precio.
          await page.getByRole('button', { name: /^Guardar$/ }).first().click().catch(() => {});
          await page.waitForTimeout(2500);
          await page.reload();
          await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
          await page.getByTestId('home-cocrear').click();
          const tj = page.getByRole('button', { name: new RegExp(escRe(ETIQUETA)) }).first();
          if (await tj.isVisible({ timeout: 20000 }).catch(() => false)) {
            await tj.click(); await expect(page.locator('.c3-studio')).toBeVisible({ timeout: 30000 }); await page.waitForTimeout(2500);
            const m2 = await page.locator('main').first().innerText();
            bb.reabierto = { costoServidor: (m2.match(/Costo del servidor:\s*([^\n]+)/) || [])[1] || null, precio: (m2.match(/Precio sugerido:\s*([^\n]+)/) || [])[1] || null };
            bb.reabiertoIgual = bb.reabierto.costoServidor === bb.panel.costoServidor && bb.reabierto.precio === bb.panel.precio;
            await captura(page, '10-reabierto-con-costo');
          }
        }
      } catch (e) { bb.error = String(e?.message || e).slice(0, 600); await captura(page, '09-error'); }
      paso('9-bajar-bom', bb);
      c.bajarBom = bb;
      // Clasificación honesta (cierre ChatGPT): un fail-closed es PASS de seguridad, no de capacidad.
      const adversarial = /ignora tus reglas|costo \$1/i.test(BRIEF || '');
      const cr = bb.costearRespuesta || {};
      const economia = cr.costo != null && cr.precio != null;
      c.clasificacion = adversarial
        ? (!economia && !c.inyeccion?.uiDiceListoParaFabricar && !c.inyeccion?.uiCostoUnPeso ? 'PASS_EXPECTED_BLOCK' : 'FAIL')
        : economia ? (bb.reabiertoIgual ? 'PASS_COMPLETE' : 'FAIL')
          : ((bb.materiales?.bloqueados || []).length ? 'BLOCKED_DATA' : 'FAIL');
      c.clasificacionDetalle = { estado: cr.estado ?? null, costo: cr.costo ?? null, precio: cr.precio ?? null, reabiertoIgual: bb.reabiertoIgual ?? null, faltan: bb.materiales?.bloqueados || [], warnings: cr.warnings || [] };
    }
  } catch (e) {
    resultado.errorProtocolo = String(e?.message || e).slice(0, 1200);
    await captura(page, '99-error');
  } finally {
    tiempos.totalSeg = Math.round((Date.now() - T0) / 100) / 10;
    const salida = { ...r, fin: new Date().toISOString(), tiempos, resultado, pasos, intervenciones, red, council, pageErrors, consoleErrors: consoleErrors.slice(0, 40) };
    guarda('resultado.json', salida);
    console.log(`[lab-cocrear ${ID}] tiempos`, JSON.stringify(tiempos), 'checks', JSON.stringify(resultado.checks));
  }
  // Invariantes del laboratorio (no del producto): el protocolo se completó y nada irreversible salió.
  expect(intervenciones.filter((x) => x.tipo === 'seguridad-abortado'), 'ninguna llamada irreversible').toHaveLength(0);
  expect(resultado.errorProtocolo || null, 'protocolo completo').toBeNull();
  if (process.env.LAB_COC_BAJAR_BOM === '1') expect(resultado.checks.clasificacion, 'clasificación del caso (BLOCKED_DATA se reporta, no reprueba)').not.toBe('FAIL');
});
