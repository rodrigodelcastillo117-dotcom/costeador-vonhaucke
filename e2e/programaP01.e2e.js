import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E REAL P0.1 (audit #1/#2/#3/#6/#8) — navegador, botón, React state, doble
//  gate real + refresh. Caso roto de Rodrigo: cotización PARCIAL real
//  (10 WIN + 10 gavetas + ALPHA + 2 CONCERTO + mesa 1200×1200 + 4 SONATA +
//  recepción + archivero), FALTAN el bench APP LT y el privado (Eclipse Drift).
//
//  SIN escapes: el único skip permitido es la ausencia de credenciales. Si Home
//  no abre, Muebles/CTA no aparecen, o el botón desaparece cuando no debe → FAIL.
//  Se verifica ESTADO PERSISTIDO (localStorage) + UI visible.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);

const CLAVE = 'costeador-vonhaucke-v1';
const ESTADO_SEMILLA = {
  onboardingVisto: true,                           // sin modal de guía (determinista, #9)
  cotizacion: {
    partidas: [
      { id: 'e-win', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 10, precioUnitario: 5210 },
      { id: 'e-gav', piezaId: 'gaveta-mox', nombre: 'Mox · Gaveta pedestal', cantidad: 10, precioUnitario: 3470 },
      { id: 'e-alpha', piezaId: 'silla-alpha', nombre: 'Silla directiva ALPHA', cantidad: 1, precioUnitario: 11950 },
      { id: 'e-conc', piezaId: 'silla-concerto', nombre: 'Silla de visita CONCERTO', cantidad: 2, precioUnitario: 5140 },
      { id: 'e-mesa', piezaId: 'mj-1200x1200-melamina', nombre: 'Mesa de juntas', cantidad: 1, precioUnitario: 5510 },
      { id: 'e-son', piezaId: 'silla-sonata', nombre: 'Silla de juntas SONATA', cantidad: 4, precioUnitario: 2420 },
      { id: 'e-rec', piezaId: 'rec-2420x830', nombre: 'Módulo recepción', cantidad: 1, precioUnitario: 29920 },
      { id: 'e-arch', piezaId: 'arch-modulor-2p-900', nombre: 'Archivero Modulor', cantidad: 1, precioUnitario: 7230 },
    ],
    // Brief estructurado: privado pide Eclipse Drift; juntas 1200×1200.
    programaBrief: {
      linea: 'App LT', operativosStorage: true,
      privados: [{ requested_models: { anchor: 'Eclipse Drift 2.10' } }],
      juntas: [{ requested_dimensions: { w: 1200, d: 1200 } }],
    },
    acomodo: {
      areasM: [
        { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2 },
        { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2, puestos: 4 },
        { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 10 },
        { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 4, largo: 2.4 },
      ],
    },
  },
};

const leerPartidas = (page) => page.evaluate((clave) => {
  try { return (JSON.parse(window.localStorage.getItem(clave))?.cotizacion?.partidas) || []; } catch (_e) { return []; }
}, CLAVE);

const cuenta = (partidas, piezaId) => partidas.filter((p) => p.piezaId === piezaId || p.bancoId === piezaId).length;
const cantidadDe = (partidas, piezaId) => partidas.filter((p) => p.piezaId === piezaId || p.bancoId === piezaId).reduce((s, p) => s + (p.cantidad || 0), 0);

test.describe('E2E P0.1 · caso roto de Rodrigo (navegador real)', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el gate E2E real.');

  test('muestra APP LT faltante, Drift pendiente y BLOQUEA aplicar hasta resolver', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    // Siembra SÓLO si no hay estado aún: addInitScript corre en CADA navegación
    // (incl. reload), así que sin este guard el refresh re-sembraría el estado
    // original y borraría lo aplicado. Con el guard, el reload conserva la verdad.
    await page.addInitScript(([clave, estado]) => {
      try { if (!window.localStorage.getItem(clave)) window.localStorage.setItem(clave, JSON.stringify(estado)); } catch (_e) { /* modo privado */ }
    }, [CLAVE, ESTADO_SEMILLA]);

    await page.goto('/');
    await page.fill('#email-login', EMAIL);
    await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });

    // COTIZAR → VONI → PASO 2 (Muebles). Estricto: si no abre, FALLA.
    await page.getByTestId('home-cotizar').click();
    await page.getByText(/^Muebles$/).first().click();

    // El panel del programa detectado DEBE aparecer con el APP LT por agregar.
    await expect(page.getByText(/Programa detectado del plano/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Por agregar/i)).toBeVisible();
    await expect(page.getByText(/App LT 10 usuarios|6000|Bench operativo/i).first()).toBeVisible();
    // Drift pendiente, nunca sustituido en la propuesta.
    await expect(page.getByText(/Pendiente de confirmar/i)).toBeVisible();
    await expect(page.getByText(/drift/i).first()).toBeVisible();

    // Estado ANTES: no hay bench, WIN=10.
    const antes = await leerPartidas(page);
    expect(cuenta(antes, 'op-10u-6000x1200-cristal')).toBe(0);
    expect(cantidadDe(antes, 'silla-win')).toBe(10);

    // R10/R15: NEEDS_CONFIRMATION es un GATE REAL. Drift sigue sin identidad
    // confirmada, por lo que Voni puede MOSTRAR el APP LT resuelto, pero NO aplicarlo.
    const aplicar = page.getByRole('button', { name: /Aplicar programa detectado/i });
    await expect(aplicar).toBeDisabled();
    await expect(page.getByText(/NEEDS_REVIEW|pendiente de confirmar/i).first()).toBeVisible();

    // Ningún write parcial silencioso: APP LT sigue sin entrar hasta resolver Drift;
    // las partidas ya existentes permanecen intactas.
    const bloqueado = await leerPartidas(page);
    expect(cuenta(bloqueado, 'op-10u-6000x1200-cristal')).toBe(0);
    expect(cantidadDe(bloqueado, 'silla-win')).toBe(10);
    expect(cantidadDe(bloqueado, 'gaveta-mox')).toBe(10);
    expect(cuenta(bloqueado, 'arch-modulor-2p-900')).toBe(1);
    expect(cuenta(bloqueado, 'mj-1200x1200-melamina')).toBe(1);

    // REFRESH → el gate y el estado original persisten; no hubo confirmación implícita.
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    await expect.poll(async () => cuenta(await leerPartidas(page), 'op-10u-6000x1200-cristal')).toBe(0);
    await expect.poll(async () => cantidadDe(await leerPartidas(page), 'silla-win')).toBe(10);

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
