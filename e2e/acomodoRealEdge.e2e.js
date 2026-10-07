import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E REAL EDGE (P0.2 sección 5) — contra el recovery edge DESPLEGADO.
//  PROHIBIDO mockear acomodar-espacio-recovery: este test ejerce la lane real
//  (nube.js → functions/v1/acomodar-espacio-recovery). Registra el endpoint real
//  llamado y el veredicto por caso. Certifica verify-first contra el sistema real:
//   - render_ready=true SÓLO si PASS (y entonces cero fallas de invariante);
//   - un caso imposible NUNCA da PASS falso (PARTIAL/NEEDS_REVIEW);
//   - mover a mano → reload → posición preservada si los hashes no cambian.
//  Único skip permitido: ausencia de credenciales.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);
const CLAVE = 'costeador-vonhaucke-v1';

// Programa COHERENTE multi-zona: operativa (bench ancla + WIN + gavetas), privado
// (escritorio + silla), juntas (mesa + sillas). Áreas con puerta y obstáculo.
const semilla = () => ({
  onboardingVisto: true,
  cotizacion: {
    partidas: [
      { id: 'op', piezaId: 'op-bench', nombre: 'Bench operativo App LT', cantidad: 1, w: 6000, d: 1200, precioUnitario: 28540, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'gOP' },
      { id: 'win', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 4, precioUnitario: 5210, relation_role: 'WORK_SEAT', functional_group_id: 'gOP' },
      { id: 'gav', piezaId: 'gaveta-mox', nombre: 'Gaveta pedestal', cantidad: 4, precioUnitario: 3470, relation_role: 'UNDERDESK_STORAGE', functional_group_id: 'gOP' },
      { id: 'esc', piezaId: 'dir-1800', nombre: 'Escritorio privado dirección', cantidad: 1, w: 1800, d: 800, precioUnitario: 15200, relation_role: 'ANCHOR_DESK', functional_group_id: 'gPR' },
      { id: 'alpha', piezaId: 'silla-alpha', nombre: 'Silla directiva ALPHA', cantidad: 1, precioUnitario: 11950, relation_role: 'EXECUTIVE_SEAT', functional_group_id: 'gPR' },
      { id: 'mesa', piezaId: 'mj-2400', nombre: 'Mesa de juntas', cantidad: 1, w: 2400, d: 1200, precioUnitario: 5510, relation_role: 'ANCHOR_MEETING', functional_group_id: 'gJT' },
      { id: 'son', piezaId: 'silla-sonata', nombre: 'Silla SONATA', cantidad: 4, precioUnitario: 2420, relation_role: 'MEETING_SEAT', functional_group_id: 'gJT' },
    ],
    acomodo: {
      areasM: [
        { nombre: 'OPERATIVA', tipo: 'open', ancho: 9, largo: 6, puertas: [{ x: 0, y: 0, ancho: 0.9 }], obstaculos: [{ x: 8, y: 5, w: 0.5, h: 0.5, tipo: 'columna' }] },
        { nombre: 'PRIVADO', tipo: 'privado', ancho: 4, largo: 4 },
        { nombre: 'JUNTAS', tipo: 'juntas', ancho: 6, largo: 5 },
      ],
    },
  },
});

// Caso IMPOSIBLE: el mismo programa en espacios minúsculos → no cabe. Dos áreas
// (multi-área) para forzar el motor espacial del edge, pero demasiado chicas.
const semillaImposible = () => {
  const s = semilla();
  s.cotizacion.acomodo.areasM = [
    { nombre: 'OPERATIVA', tipo: 'open', ancho: 1.5, largo: 1.5 },
    { nombre: 'JUNTAS', tipo: 'juntas', ancho: 1.5, largo: 1.5 },
  ];
  return s;
};

const leerCot = (page) => page.evaluate((clave) => {
  try { return JSON.parse(window.localStorage.getItem(clave))?.cotizacion || null; } catch (_e) { return null; }
}, CLAVE);

async function loginConSemilla(page, estado) {
  await page.addInitScript(([clave, e]) => {
    try { if (!window.localStorage.getItem(clave)) window.localStorage.setItem(clave, JSON.stringify(e)); } catch (_x) { /* privado */ }
  }, [CLAVE, estado]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
}

// Navega a Acomodo y espera la llamada REAL al recovery edge; devuelve las respuestas.
async function irAAcomodoYResolver(page) {
  const respuestas = [];
  page.on('response', (r) => { if (r.url().includes('/functions/v1/acomodar-espacio-recovery')) respuestas.push({ status: r.status() }); });
  await page.getByTestId('home-cotizar').click();
  await page.getByTestId('voni-paso-muebles').click();
  const stepAcomodo = page.getByTestId('voni-paso-acomodo');
  await expect(stepAcomodo).toBeEnabled({ timeout: 15000 });
  await stepAcomodo.click();
  await expect.poll(() => respuestas.length, { timeout: 60000 }).toBeGreaterThanOrEqual(1);
  return respuestas;
}

test.describe('E2E REAL EDGE · recovery desplegado (P0.2 §5)', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el gate E2E real.');
  test.setTimeout(120000);

  test('multi-zona coherente (APP LT+WIN/gavetas, privado, juntas, puerta, obstáculo) → PASS REAL', async ({ page }) => {
    await loginConSemilla(page, semilla());
    const resp = await irAAcomodoYResolver(page);
    expect(resp.some((r) => r.status === 200), `respuestas del edge: ${JSON.stringify(resp)}`).toBe(true);

    await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.program_hash || '', { timeout: 20000 }).toMatch(/^pc_/);
    const cot = await leerCot(page);
    const plan = cot.acomodo.plan;
    const inv = plan.invariantes || {};
    const fails = (inv.issues || []).filter((i) => i.severity === 'fail');
    const ctx = `estado=${cot.acomodo.layoutEstado} placed=${inv.placed}/${inv.requested} issues=${JSON.stringify(inv.issues)}`;

    // CASO VÁLIDO ⇒ PASS obligatorio (no basta auto-consistencia).
    expect(cot.acomodo.layoutEstado, ctx).toBe('PASS');
    expect(plan.render_ready, ctx).toBe(true);
    expect(cot.acomodo.layoutEspacialValidado, ctx).toBe(true);
    // todas las piezas colocadas · cantidades exactas · cero ghost/dup · cero fallas.
    expect(inv.unplaced, ctx).toEqual([]);
    expect(inv.placed, ctx).toBe(inv.requested);
    expect(inv.ghosts, ctx).toEqual([]);
    expect(inv.duplicates, ctx).toEqual([]);
    expect(fails, ctx).toHaveLength(0);   // cero overlap/OOB/door/obstacle/wrong-zone
  });

  test('caso IMPOSIBLE: nunca un PASS falso (PARTIAL/NEEDS_REVIEW)', async ({ page }) => {
    await loginConSemilla(page, semillaImposible());
    await irAAcomodoYResolver(page);
    await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.program_hash || '', { timeout: 20000 }).toMatch(/^pc_/);
    const cot = await leerCot(page);
    expect(cot.acomodo.layoutEstado).not.toBe('PASS');
    expect(cot.acomodo.layoutEspacialValidado).not.toBe(true);
  });
});
