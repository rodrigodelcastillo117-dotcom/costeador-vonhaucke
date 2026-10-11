// VH-059: anotar atribuye la lección a la sesión y respeta la regla de aprobación de la
// base; al prompt sólo entra lo aprobado.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const estado = { email: 'ventas@vh.mx', rol: 'vendedor', inserts: [], updates: [] };
vi.mock('../nube.js', () => {
  const tabla = (nombre) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: nombre === 'permitidos' ? { rol: estado.rol } : null }), order: () => ({ limit: async () => ({ data: [] }) }) }) }),
    insert: (fila) => { estado.inserts.push(fila); return { select: () => ({ single: async () => ({ data: { id: estado.inserts.length, ...fila, creado: '2026-10-11' } }) }) }; },
    update: (patch) => ({ eq: async (_k, id) => { estado.updates.push({ id, ...patch }); return { error: null }; } }),
  });
  return { nube: { auth: { getSession: async () => ({ data: { session: estado.email ? { user: { email: estado.email } } : null } }) }, from: tabla } };
});
const ap = await import('./aprendizaje.js');

beforeEach(() => { estado.inserts.length = 0; estado.updates.length = 0; ap.olvidarQuien(); });

describe('anotar', () => {
  it('vendedor: la fila lleva su correo y queda PENDIENTE (aprobado_para_ia false); no entra al prompt', async () => {
    estado.email = 'ventas@vh.mx'; estado.rol = 'vendedor';
    const a = await ap.anotar({ tipo: 'aclaracion', texto: 'La banca lleva mamparas de 40 cm' });
    expect(a).toMatchObject({ usuario: 'ventas@vh.mx', aprobado_para_ia: false });
    expect(estado.inserts[0]).not.toHaveProperty('rol');
    expect(ap.aprendizajesTexto().join('|')).not.toMatch(/mamparas/);
    expect(ap.pendientesDeRevision().map((x) => x.texto)).toContain('La banca lleva mamparas de 40 cm');
  });
  it('Dirección: anota ya aprobado y entra al prompt', async () => {
    estado.email = 'rodrigo@vh.mx'; estado.rol = 'direccion';
    const a = await ap.anotar({ tipo: 'aclaracion', texto: 'Las recepciones llevan iluminación LED' });
    expect(a.aprobado_para_ia).toBe(true);
    expect(ap.aprendizajesTexto().join('|')).toMatch(/iluminación LED/);
  });
  it('sin sesión no se inserta nada (la RLS lo rechazaría)', async () => {
    estado.email = null;
    expect(await ap.anotar({ texto: 'algo' })).toBeNull();
    expect(estado.inserts).toHaveLength(0);
  });
  it('aprobar pasa una pendiente al prompt', async () => {
    estado.email = 'ventas@vh.mx'; estado.rol = 'vendedor';
    const a = await ap.anotar({ texto: 'Pendiente que luego se aprueba' });
    expect(ap.aprendizajesTexto().join('|')).not.toMatch(/luego se aprueba/);
    expect(await ap.aprobar(a.id)).toBe(true);
    expect(estado.updates.at(-1)).toMatchObject({ id: a.id, aprobado_para_ia: true });
    expect(ap.aprendizajesTexto().join('|')).toMatch(/luego se aprueba/);
  });
});
