// META-PRUEBA del gate de certificación (P1-LAB-COC-09, cierre ChatGPT v3). Falla A PROPÓSITO en el primer intento y
// pasaría en el reintento. Bajo el runner de certificación (retries=0) el job TIENE que salir en rojo; si sale verde,
// la certificación podría esconder un FAIL detrás de un reintento. Sólo se carga a pedido (LAB_META=1).
import { test, expect } from '@playwright/test';

test('meta: un primer intento FAIL no puede volverse verde con un reintento', async ({}, testInfo) => {
  expect(testInfo.retry, 'primer intento: falla a propósito (el reintento pasaría)').toBeGreaterThan(0);
});
