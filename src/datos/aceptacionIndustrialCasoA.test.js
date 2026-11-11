// ACEPTACION INDUSTRIAL · CASO A · recuperacion e integridad (modulos REALES).
// Confirmar CAD -> recalcular -> versionar -> guardar/reabrir (round-trip) -> continuar
// sin perder confirmaciones. El conflicto de concurrencia del RPC ya se prueba contra
// Postgres real en supabase/tests/expedienteCosteoPersistencia.test.js (VERSION_CONFLICT).
import { describe, it, expect } from 'vitest';
import { expedienteIndustrialDesdeDespiece } from './expedienteIndustrialDesdeDespiece.js';
import { recostearExpediente } from './pantallaIngenieria.js';

const insumosERP = {};
const catalogoLamina = [{ id: 'lam18', calibre: 18, acero: 'negra', formato: { largoMM: 3050, anchoMM: 1220 }, precio: 571.54, certificable: true }];
const despiece = [
  { clave: 'LAT', desc: 'Lateral lamina', cantidad: 2, seccion: 'metal', largoMM: 700, anchoMM: 400 },
  { clave: 'CAJA', desc: 'Caja 3D', cantidad: 1, seccion: 'metal', fabricada: true },  // pendiente de CAD
];

describe('ACEPTACION INDUSTRIAL · CASO A (modulos reales)', () => {
  it('confirmar CAD recalcula, versiona, NO pierde confirmaciones y sobrevive save/reopen', () => {
    const v1 = expedienteIndustrialDesdeDespiece(despiece, { clave: 'CASO-A', insumosERP, catalogoLamina });
    expect(v1.version).toBe(1);
    expect(v1.costo_industrial.material.pendiente.desarrollos_3d).toContain('CAJA');

    const v2 = recostearExpediente(v1, { tipo: 'desarrollo', clave: 'CAJA', desarrollo_mm: [600, 400], fuente: 'CAD' });
    expect(v2.version).toBe(2);
    expect(v2.confirmaciones.length).toBe(1);
    expect(v2.costo_industrial.material.pendiente.desarrollos_3d).not.toContain('CAJA');

    // Guardar -> reabrir (el blob va a JSONB y vuelve): integridad exacta
    const reabierto = JSON.parse(JSON.stringify(v2));
    expect(reabierto.confirmaciones.length).toBe(1);
    expect(reabierto.inputs.piezasBOM.length).toBe(2);
    expect(reabierto.costo_industrial).toBeTruthy();

    // Continuar sobre el reabierto: otra confirmacion conserva la anterior
    const v3 = recostearExpediente(reabierto, { tipo: 'calibre', clave: 'LAT', calibre: 16 });
    expect(v3.version).toBe(3);
    expect(v3.confirmaciones.length).toBe(2);
  });

  it('dos sesiones desde la MISMA base divergen -> no se pueden fusionar en silencio (el RPC detecta el choque)', () => {
    const base = expedienteIndustrialDesdeDespiece(despiece, { clave: 'CASO-A2', insumosERP, catalogoLamina });
    const A = recostearExpediente(base, { tipo: 'desarrollo', clave: 'CAJA', desarrollo_mm: [600, 400], fuente: 'CAD' });
    const B = recostearExpediente(base, { tipo: 'calibre', clave: 'LAT', calibre: 16 });
    expect(A.version).toBe(2); expect(B.version).toBe(2);         // ambas creen ser v2
    expect(JSON.stringify(A)).not.toBe(JSON.stringify(B));        // divergen; al guardar, la 2a con versionAnterior=1 -> VERSION_CONFLICT
  });
});
