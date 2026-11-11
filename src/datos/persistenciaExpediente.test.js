import { describe, it, expect } from 'vitest';
import { guardarExpediente, reabrirExpediente } from './persistenciaExpediente.js';

// Contrato CLIENTE de la concurrencia optimista (P2 auditoria 212caeb). El RPC real ya se
// prueba contra Postgres en supabase/tests/expedienteCosteoPersistencia.test.js (VERSION_CONFLICT);
// esto atrapa una regresion del cliente/panel que OMITA la version y provoque sobrescritura.
describe('persistenciaExpediente · contrato cliente del RPC (concurrencia)', () => {
  it('guardarExpediente REENVIA p_version_anterior a la RPC', async () => {
    let args = null;
    const svc = { rpc: async (_fn, a) => { args = a; return { data: { ok: true, version: 2 }, error: null }; } };
    const r = await guardarExpediente(svc, { clave: 'X', expediente: { a: 1 }, versionAnterior: 1 });
    expect(args.p_version_anterior).toBe(1);   // si el panel/cliente lo omite, esto rompe
    expect(args.p_clave).toBe('X');
    expect(r.version).toBe(2);
  });
  it('primer guardado: versionAnterior null se pasa como null (no se inventa una version)', async () => {
    let args = null;
    const svc = { rpc: async (_fn, a) => { args = a; return { data: { ok: true, version: 1 }, error: null }; } };
    await guardarExpediente(svc, { clave: 'X', expediente: {} });
    expect(args.p_version_anterior).toBe(null);
  });
  it('propaga el error del RPC (VERSION_CONFLICT) en vez de tragarlo', async () => {
    const svc = { rpc: async () => ({ data: null, error: { message: 'VERSION_CONFLICT' } }) };
    await expect(guardarExpediente(svc, { clave: 'X', expediente: {} })).rejects.toThrow(/VERSION_CONFLICT/);
  });
  it('reabrirExpediente usa la RPC reabrir_expediente_costeo con la clave', async () => {
    let fn = null, args = null;
    const svc = { rpc: async (f, a) => { fn = f; args = a; return { data: { version: 3, expediente: {} }, error: null }; } };
    await reabrirExpediente(svc, 'CLAVE-1');
    expect(fn).toBe('reabrir_expediente_costeo'); expect(args.p_clave).toBe('CLAVE-1');
  });
});
