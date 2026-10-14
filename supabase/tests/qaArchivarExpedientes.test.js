// Operación 9.5 · punto 21 · PROPUESTA_qa_archivar_expedientes.sql en PGlite con el DDL real de `expedientes` (baseline).
// Etiqueta, no borra; aborta sin cambios si el manifest no coincide con lo vivo; idempotente; rollback exacto.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { tablaDeBaseline, leer, filas } from './fixtures/erpBaseAislada.js';

const SQL = leer('supabase/migrations/PROPUESTA_qa_archivar_expedientes.sql');
const RB = SQL.split('\n').filter((l) => l.startsWith('-- RB ')).map((l) => l.slice(6)).join('\n');
const IDS_QA = [...Array(156).keys()].map((i) => i + 4).filter((id) => id !== 14 && id !== 15);
let db;
const etiquetas = async () => Object.fromEntries((await filas(db, 'select id, etiquetas from public.expedientes order by id')).map((r) => [r.id, r.etiquetas]));

describe('PROPUESTA_qa_archivar_expedientes', () => {
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(tablaDeBaseline('expedientes'));
    const vals = [
      ...[1, 2, 3, 14, 15].map((id) => `(${id}, 'direccion@vh.mx', 'Producto real ${id}', '{real}')`),
      ...IDS_QA.map((id) => `(${id}, 'qa-direccion@vonhaucke.mx', 'Lab ${id}', '{}')`),
    ];
    await db.exec(`insert into public.expedientes (id, creado_por, nombre, etiquetas) overriding system value values ${vals.join(',')}`);
  });
  afterEach(async () => { await db?.close(); });

  it('etiqueta exactamente los 154 de QA; los reales no se tocan; nada se borra', async () => {
    expect(IDS_QA).toHaveLength(154);
    await db.exec(SQL);
    const e = await etiquetas();
    expect(Object.keys(e)).toHaveLength(159);
    for (const id of IDS_QA) expect(e[id]).toEqual(['qa-archivado']);
    for (const id of [1, 2, 3, 14, 15]) expect(e[id]).toEqual(['real']);
  });

  it('idempotente: aplicarla dos veces no duplica la etiqueta', async () => {
    await db.exec(SQL); await db.exec(SQL);
    expect((await etiquetas())[100]).toEqual(['qa-archivado']);
  });

  it('si un id del manifest ya no es de QA, aborta SIN cambios', async () => {
    await db.exec(`update public.expedientes set creado_por = 'rodrigo@vh.mx' where id = 77`);
    await expect(db.exec(SQL)).rejects.toThrow(/153 de 154/);
    await db.exec('rollback').catch(() => {});
    const e = await etiquetas();
    expect(IDS_QA.filter((id) => (e[id] || []).includes('qa-archivado'))).toHaveLength(0);
  });

  it('rollback quita la etiqueta y deja todo como estaba', async () => {
    const antes = await etiquetas();
    await db.exec(SQL); await db.exec(RB);
    expect(await etiquetas()).toEqual(antes);
  });
});
