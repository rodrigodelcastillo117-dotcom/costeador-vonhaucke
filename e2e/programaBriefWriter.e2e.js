import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E GATE J (audit #17) — CERTIFICA EL *WRITER* DE ProgramBrief EN NAVEGADOR.
//
//  Desde el TEXTO REAL: se route-mockea cotizar-texto con el SCHEMA REAL v10
//  (items{ruta,producto,cantidad,seleccion[{clave,valor}],etiqueta,…} +
//  banco{id,cantidad,…}; additionalProperties:false — SIN rol/linea/dims/w/d).
//  El usuario escribe en CotizadorIA → interpretar() construye el ProgramBrief
//  VERSIONADO con briefDePropuesta() y lo persiste en cotizacion.programaBrief;
//  Voni paso 2 lo CONSUME (reqBrief + FloorSpec → propuestaPrograma) y el privado
//  Eclipse Drift queda PENDIENTE de confirmar (nunca sustituido).
//
//  NO hay llamada a Claude: la Edge está interceptada. El único skip permitido es
//  la ausencia de credenciales (login real). Si el writer no persiste el brief, o
//  Voni no lo consume → FAIL.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
const hayCreds = !!(EMAIL && PASS);

const CLAVE = 'costeador-vonhaucke-v1';

// FloorSpec SOLO (sin partidas, sin programaBrief): el brief debe nacer del
// writer, no de la semilla. Mismo plano del caso de Rodrigo.
const ESTADO_SEMILLA = {
  onboardingVisto: true,
  cotizacion: {
    acomodo: {
      areasM: [
        { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2 },
        { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 10 },
      ],
    },
  },
};

// Respuesta REAL v10 de cotizar-texto (lo que la Edge garantiza; nada más).
const RESPUESTA_V10 = {
  ok: true,
  propuesta: {
    items: [
      {
        ruta: 'App LT', producto: 'Bench operativo', cantidad: 1,
        seleccion: [{ clave: 'ancho', valor: '6000' }, { clave: 'largo', valor: '1200' }],
        etiqueta: 'Bench operativo App LT 10 usuarios', confianza: 'alta', nota: null, material_override: null,
      },
      {
        ruta: 'Eclipse', producto: 'Escritorio privado dirección', cantidad: 1,
        seleccion: [], etiqueta: 'Eclipse Drift 2.10', confianza: 'media', nota: null, material_override: null,
      },
    ],
    banco: [
      { id: 'silla-win', cantidad: 10, etiqueta: 'Silla operativa WIN', nota: null, sugerido: false },
      { id: 'gaveta-mox', cantidad: 10, etiqueta: 'Gaveta pedestal', nota: null, sugerido: false },
    ],
    resumen: 'Entendí: 10 puestos operativos App LT con sillas WIN y gavetas, más un privado Eclipse Drift.',
    preguntas: [],
    noEncontrado: [],
  },
};

const leerBrief = (page) => page.evaluate((clave) => {
  try { return JSON.parse(window.localStorage.getItem(clave))?.cotizacion?.programaBrief || null; } catch (_e) { return null; }
}, CLAVE);

test.describe('E2E P0.1 · gate J — el writer de ProgramBrief (navegador real)', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el gate E2E real.');

  test('texto → CotizadorIA escribe el brief versionado y Voni paso 2 lo consume (sin Claude)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

    // Semilla idempotente (no re-siembra en reload).
    await page.addInitScript(([clave, estado]) => {
      try { if (!window.localStorage.getItem(clave)) window.localStorage.setItem(clave, JSON.stringify(estado)); } catch (_e) { /* modo privado */ }
    }, [CLAVE, ESTADO_SEMILLA]);

    // INTERCEPTA la Edge: NADA sale a Claude. Preflight OK + POST con el v10.
    let golpes = 0;
    await page.route('**/functions/v1/cotizar-texto', async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      }
      golpes += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(RESPUESTA_V10),
      });
    });

    await page.goto('/');
    await page.fill('#email-login', EMAIL);
    await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });

    // COTIZAR → VONI → PASO 2 (Muebles): aquí vive el CotizadorIA que escribe.
    await page.getByTestId('home-cotizar').click();
    await page.getByText(/^Muebles$/).first().click();

    // ANTES de escribir: no hay brief persistido (debe nacer del writer).
    expect(await leerBrief(page)).toBeNull();

    // El usuario describe el pedido y Voni "interpreta" (mock v10, sin Claude).
    const ta = page.locator('textarea.ia-textarea');
    await expect(ta).toBeVisible({ timeout: 15000 });
    await ta.fill('10 puestos operativos App LT con sillas WIN y gavetas; un privado Eclipse Drift 2.10.');
    await page.getByRole('button', { name: /Armar la lista de muebles/i }).click();

    // El writer corrió a través de la UI real (se agregaron muebles del banco).
    await expect(page.getByText(/Agregu[ée] .* muebles? a tu proyecto/i)).toBeVisible({ timeout: 15000 });

    // GATE J — el brief VERSIONADO quedó persistido con el contrato esperado.
    await expect.poll(async () => (await leerBrief(page))?.version).toBe(1);
    const brief = await leerBrief(page);
    expect(brief.source).toBe('cotizar-texto');
    expect(String(brief.interpretation_id || '')).toMatch(/^int-/);
    expect(brief.source_text_hash).toBeTruthy();
    expect(brief.interpreted_at).toBeTruthy();
    const req = brief.requirements;
    expect(req.linea).toBe('App LT');                       // de la ruta del item OPERATIVO
    expect(req.operativoSeatModel).toBe('silla-win');       // banco WORK_SEAT por id
    expect(req.operativosStorage).toBe(true);               // gaveta → STORAGE (evidencia, no inventado)
    expect(req.privados?.[0]?.requested_models?.anchor).toBe('Eclipse Drift 2.10');
    expect(req.juntas).toEqual([]);                         // UNKNOWN ≠ fabricado

    // CONSUMO en Voni paso 2: el brief (Drift) + FloorSpec → privado PENDIENTE,
    // y el bench App LT "Por agregar". Esto NO aparecería sin consumir el brief.
    await expect(page.getByText(/Programa detectado del plano/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Pendiente de confirmar/i)).toBeVisible();
    await expect(page.getByText(/drift/i).first()).toBeVisible();
    await expect(page.getByText(/App LT 10 usuarios|6000|Bench operativo/i).first()).toBeVisible();

    // Certezas duras: la Edge fue interceptada (sin Claude) y sin errores de página.
    expect(golpes, 'cotizar-texto debió llamarse exactamente por el mock').toBeGreaterThanOrEqual(1);
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
