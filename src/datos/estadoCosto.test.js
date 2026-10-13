import { describe, it, expect } from 'vitest';
import { clasificarCosto } from './estadoCosto.js';

const em = (bloqueos = {}, pendientes = []) => ({ bloqueos: { datos_faltantes: [], formato_incompatible: [], tarifas_faltantes: [], materiales_por_confirmar: [], costo_invalido: false, ...bloqueos }, pendientes });
const SRV_OK = { estado: 'certificado', aprobacionHumana: true, bomVigente: true };

describe('estado del costo en tres niveles', () => {
  it('BLOQUEADO: pieza sin material (credenza lab: "Canto visible")', () => {
    const r = clasificarCosto({ emision: em({ datos_faltantes: ['Canto visible'] }), servidor: SRV_OK });
    expect(r.estado).toBe('bloqueado'); expect(r.motivos[0]).toMatch(/Canto visible/);
  });
  it('BLOQUEADO: validador de Ingeniería en rojo o lectura de la IA incompleta', () => {
    expect(clasificarCosto({ emision: em({}, ['Estructura: «Soporte» es una pieza…']), servidor: SRV_OK }).estado).toBe('bloqueado');
    expect(clasificarCosto({ emision: em({}, ['Lectura de la IA incompleta: una pieza']), servidor: SRV_OK }).estado).toBe('bloqueado');
  });
  it('PRELIMINAR: materiales propuestos sin confirmar (gabinete lab: bisagra, jaladera…)', () => {
    const r = clasificarCosto({ emision: em({ materiales_por_confirmar: ['Bisagra', 'Jaladera'] }), servidor: SRV_OK });
    expect(r.estado).toBe('preliminar'); expect(r.motivos[0]).toMatch(/2 material/);
  });
  it('PRELIMINAR: sin validación del servidor, o validación de otro BOM', () => {
    expect(clasificarCosto({ emision: em(), servidor: null }).estado).toBe('preliminar');
    expect(clasificarCosto({ emision: em(), servidor: { ...SRV_OK, bomVigente: false } }).estado).toBe('preliminar');
  });
  it('PRELIMINAR: servidor "certificado" pero sin aprobación humana declarada (hoy: precios aprobados por la cuenta QA)', () => {
    const r = clasificarCosto({ emision: em(), servidor: { estado: 'certificado', bomVigente: true } });
    expect(r.estado).toBe('preliminar'); expect(r.motivos[0]).toMatch(/firma humana/);
  });
  it('VALIDADO sólo con todo confirmado + servidor certificado + aprobación humana', () => {
    expect(clasificarCosto({ emision: em(), servidor: SRV_OK })).toEqual({ estado: 'validado', etiqueta: 'COSTO VALIDADO', motivos: [] });
  });
});
