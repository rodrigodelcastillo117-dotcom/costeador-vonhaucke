import { test, expect } from '@playwright/test';

// ============================================================================
//  VH-090 / VH-091 (2026-10-12) · caso real de la cotización 757 en navegador:
//  el programa del plano YA está aplicado (fuente CONFIRMADO_PROGRAMA) con la mesa
//  mj-900x900 y el brief cambió a 1200×1200 → conflicto programa-vs-programa.
//  Antes: "Aplicar" muerto y sin salida. Ahora: "Sustituir por el propuesto" por
//  renglón; la mesa de 900 sale y entra la de 1200; nada se duplica.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);
const CLAVE = 'costeador-vonhaucke-v1';

const SEMILLA = {
  onboardingVisto: true,
  cotizacion: {
    partidas: [
      { id: 'prog-mj', bancoId: 'mj-900x900-melamina', piezaId: 'mj-900x900-melamina', nombre: 'Mesa de juntas', cantidad: 1, precioUnitario: 4260,
        relation_role: 'ANCHOR_MEETING', rol: 'juntas', instance_id: 'inst:req:SALA DE CONSEJO:juntas:0:#0', functional_group_id: 'fg:req:SALA DE CONSEJO:juntas:0:#0',
        requirement_id: 'req:SALA DE CONSEJO:juntas:0', zone_id: 'SALA DE CONSEJO', w: 900, d: 900, source: 'CONFIRMADO_PROGRAMA', sinPrecioAutorizado: true },
      { id: 'prog-son', bancoId: 'silla-sonata', piezaId: 'silla-sonata', nombre: 'Silla SONATA (visita 4 pts)', cantidad: 4, precioUnitario: 2420,
        relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', rol: 'juntas', anchor_instance_id: 'inst:req:SALA DE CONSEJO:juntas:0:#0',
        functional_group_id: 'fg:req:SALA DE CONSEJO:juntas:0:#0', source: 'CONFIRMADO_PROGRAMA', sinPrecioAutorizado: true },
    ],
    programaBrief: { linea: 'App LT', juntas: [{ requested_dimensions: { w: 1200, d: 1200 } }] },
    acomodo: { areasM: [{ nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2 }] },
  },
};

const leerPartidas = (page) => page.evaluate((clave) => {
  try { return (JSON.parse(window.localStorage.getItem(clave))?.cotizacion?.partidas) || []; } catch (_e) { return []; }
}, CLAVE);
const idsBanco = (ps) => ps.map((p) => p.bancoId || p.piezaId);

test.describe('VH-091 · conflicto programa-vs-programa con salida', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD.');

  test('"Sustituir por el propuesto" cambia la mesa de 900 por la de 1200 sin duplicar sillas', async ({ page }) => {
    await page.addInitScript(([clave, estado]) => {
      try { if (!window.localStorage.getItem(clave)) window.localStorage.setItem(clave, JSON.stringify(estado)); } catch (_e) {}
    }, [CLAVE, SEMILLA]);
    await page.goto('/');
    await page.fill('#email-login', EMAIL);
    await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    await page.getByTestId('home-cotizar').click();
    await page.getByText(/^Muebles$/).first().click();

    await expect(page.getByText(/Programa detectado del plano/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Conflicto \(decide tú\)/i)).toBeVisible();
    // Nunca el id interno en pantalla: etiqueta humana + nombres.
    await expect(page.getByText(/Mesa de juntas 1: ya tienes/i)).toBeVisible();
    await expect(page.getByText(/juntas\|ANCHOR_MEETING/)).toHaveCount(0);

    const sustituir = page.getByRole('button', { name: /Sustituir por el propuesto/i });
    await expect(sustituir).toBeEnabled();
    await sustituir.click();

    await expect.poll(async () => idsBanco(await leerPartidas(page)).includes('mj-900x900-melamina')).toBe(false);
    const desp = await leerPartidas(page);
    expect(desp.filter((p) => String(p.bancoId || p.piezaId).startsWith('mj-'))).toHaveLength(1);
    expect(String(desp.find((p) => String(p.bancoId || p.piezaId).startsWith('mj-')).bancoId)).toMatch(/^mj-1200x1200/);
    // Las 4 SONATA existentes cubren el MEETING_SEAT: no se agregan sillas nuevas.
    expect(desp.filter((p) => p.relation_role === 'MEETING_SEAT')).toHaveLength(1);
    expect(desp.find((p) => p.relation_role === 'MEETING_SEAT').cantidad).toBe(4);
    // El conflicto desapareció de la pantalla.
    await expect(page.getByText(/Conflicto \(decide tú\)/i)).toHaveCount(0);
  });
});
