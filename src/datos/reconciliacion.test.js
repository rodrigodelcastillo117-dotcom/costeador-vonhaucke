// Reconciliación de alcance por zona: FAIL-CLOSED ante cobertura desconocida.
// Un requerido conocido con cotizado/acomodado AUSENTE (null) NO es 'ok' (antes lo era, más permisivo
// que un 0 explícito) — debe ser 'revisar', para que hayDiscrepancia no quede vacío por un faltante.
import { describe, it, expect } from 'vitest';
import { reconciliar, resumenReconciliacion } from './reconciliacion.js';

describe('reconciliar · fail-closed ante cobertura desconocida', () => {
  it('requerido conocido pero acomodado AUSENTE ⇒ revisar (no ok)', () => {
    expect(reconciliar([{ nombre: 'Juntas', requerido: 5, cotizado: 5 }])[0].estado).toBe('revisar');
  });
  it('requerido conocido pero cotizado AUSENTE ⇒ revisar', () => {
    expect(reconciliar([{ nombre: 'Z', requerido: 5, acomodado: 5 }])[0].estado).toBe('revisar');
  });
  it('un faltante (null) NO es menos grave que un 0 explícito', () => {
    expect(reconciliar([{ nombre: 'Z', requerido: 5, cotizado: 0, acomodado: 0 }])[0].estado).toBe('falta');
    expect(reconciliar([{ nombre: 'Z', requerido: 5 }])[0].estado).not.toBe('ok');
  });
  it('los tres presentes y en acuerdo ⇒ ok (sin regresión)', () => {
    expect(reconciliar([{ nombre: 'Open', requerido: 80, cotizado: 80, acomodado: 80 }])[0].estado).toBe('ok');
  });
  it('bajo/alto conocidos siguen dando falta/sobra', () => {
    expect(reconciliar([{ nombre: 'Z', requerido: 12, cotizado: 12, acomodado: 10 }])[0].estado).toBe('falta');
    expect(reconciliar([{ nombre: 'Z', requerido: 5, cotizado: 7, acomodado: 7 }])[0].estado).toBe('sobra');
  });
  it('resumen: una zona con cobertura desconocida cuenta como discrepancia', () => {
    const r = resumenReconciliacion([{ nombre: 'Juntas', requerido: 5, cotizado: 5 }]);
    expect(r.hayDiscrepancia).toBe(true);
    expect(r.porRevisar).toBe(1);
  });
});
