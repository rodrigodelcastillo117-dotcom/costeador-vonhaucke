// ============================================================================
//  DB emission · exactitud monetaria a centavos (comportamiento en PGlite, 2026-10-14).
//
//  Antes: buscaba cadenas en docs/sql/emission_exact_cents_v3.sql — un archivo de DOCUMENTACIÓN que no es lo
//  desplegado; una regresión en producción (o en la fixture de producción) no la habría detectado.
//  Ahora: EJECUTA los cuerpos EXACTOS de producción (supabase/tests/fixtures/private_api_emision_prod_20261013.sql;
//  md5 contra producción verificado en supabase/tests/seguridadGateEmisionSnapshot.test.js) en PostgreSQL real
//  (PGlite) y prueba que `evaluar_emision_cotizacion` / `emitir_revision_v2` rechazan diferencias de UN centavo.
//
//  Dobles de prueba (no son SQL de producción, sólo alimentan el precio autorizado):
//  public.resolver_precio_autorizado / public.resolver_precio_especial_proyecto devuelven el precio de una tabla
//  de prueba. Lo que se prueba es la aritmética y las comparaciones del gate/emisión desplegados.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { baseAislada, uno, evaluar, emitir, DIRECCION } from '../../supabase/tests/fixtures/emisionBaseAislada.js';
import { precioConDescuento } from '../motor/comercialDinero.js';

let db;
let n = 0;

async function sembrar(partidas) {
  const { id } = await uno(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, folio, partidas, total, piezas) values ($1, 'Cliente', $2, $3::jsonb, 1, 1) returning id`,
    [DIRECCION, `COT-C${++n}`, JSON.stringify(partidas)]);
  return id;
}
// Snapshot con totales EXPLÍCITOS (para poder desviarlos un centavo a propósito).
const snap = (partidas, { precioLista, iva = 0, total = precioLista + iva }) => ({
  cliente: 'Cliente', folio: 'COT', partidas,
  totales: { precioLista, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva }, total,
});
const legacy = (precioUnitario, cantidad, costoUnitario = 200, id = 'p1') =>
  ({ id, nombre: `Mueble ${id}`, cantidad, precioUnitario, costoUnitario });

describe('DB emission · exactitud monetaria a centavos (SQL desplegado en PGlite)', () => {
  beforeAll(async () => {
    db = await baseAislada();
    await db.exec(`
      insert into public.productos values (10, 'catalogo', 20), (11, 'expediente', 21);
      insert into public.producto_versiones values (20, 10, 'aprobado'), (21, 11, 'aprobado');
      insert into public.producto_version_economia values (20, 500);
      insert into public.lista_precio_items values (5, 100);
      create table public.test_precio (pid bigint primary key, precio_lista numeric not null);
      create table public.test_especial (pid bigint primary key, precio_lista numeric not null);
      create function public.resolver_precio_autorizado(p_pid bigint, p_pvid bigint, p_var bigint, p_fecha date, p_moneda text)
        returns jsonb language sql stable as $$
        select coalesce((select jsonb_build_object('ok', true, 'precio_lista', t.precio_lista, 'lista_precio_item_id', 5)
                         from public.test_precio t where t.pid = p_pid), jsonb_build_object('ok', false, 'motivo', 'SIN_PRECIO')) $$;
      create function public.resolver_precio_especial_proyecto(p_pid bigint, p_pvid bigint, p_fecha date, p_moneda text)
        returns jsonb language sql stable as $$
        select coalesce((select jsonb_build_object('ok', true, 'precio_lista', t.precio_lista, 'commercial_state', 'AUTHORIZED_PROJECT_SPECIAL',
                                                   'economia_estado', 'CERTIFIED', 'costo_interno', 400)
                         from public.test_especial t where t.pid = p_pid), jsonb_build_object('ok', false, 'motivo', 'SIN_ESPECIAL')) $$;
      insert into public.test_precio values (10, 1000.10);
      insert into public.test_especial values (11, 2000.10);
    `);
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('control: precioLista y total exactos al centavo ⇒ se emite la revisión', async () => {
    const p = [legacy(9999.99, 3, 6000)];
    const id = await sembrar(p);
    const s = snap(p, { precioLista: 29999.97, iva: 4799.99 });
    expect((await evaluar(db, DIRECCION, id, s)).state).toBe('ALLOWED');
    const r = await emitir(db, DIRECCION, id, s);
    expect(r).toMatchObject({ nueva: true, revision: 1, v: 2 });
    expect(Number(r.total)).toBe(34799.96);
  });

  it('precioLista desviado UN centavo (o redondeado al peso) ⇒ emitir_revision_v2 lo rechaza (sin tolerancia ±$1)', async () => {
    for (const precioLista of [29999.96, 29999.98, 30000]) {
      const p = [legacy(9999.99, 3, 6000)];
      const id = await sembrar(p);
      await expect(emitir(db, DIRECCION, id, snap(p, { precioLista, iva: 0 })), String(precioLista))
        .rejects.toThrow(/precioLista \([\d.]+\) no coincide con la suma de partidas \(29999\.97\)/);
    }
  });

  it('cada importe se redondea a centavo ANTES de sumar: Σ round(pu×cant, 2), no round(Σ)', async () => {
    // 333.335 × 3 = 1000.005 → 1000.01 por renglón; dos renglones = 2000.02 (round de la suma daría 2000.01).
    const p = [legacy(333.335, 3, 200, 'a'), legacy(333.335, 3, 200, 'b')];
    const malo = await sembrar(p);
    await expect(emitir(db, DIRECCION, malo, snap(p, { precioLista: 2000.01 }))).rejects.toThrow(/no coincide con la suma de partidas \(2000\.02\)/);
    const bueno = await sembrar(p);
    expect((await emitir(db, DIRECCION, bueno, snap(p, { precioLista: 2000.02 }))).nueva).toBe(true);
  });

  it('el total debe ser la suma EXACTA del desglose: un centavo de más ⇒ rechazo', async () => {
    const p = [legacy(1000.01, 1)];
    const id = await sembrar(p);
    await expect(emitir(db, DIRECCION, id, snap(p, { precioLista: 1000.01, iva: 160, total: 1160.02 })))
      .rejects.toThrow(/el total \(1160\.02\) no es la suma exacta del desglose \(1160\.01\)/);
  });

  it('producto canónico con descuento: precioUnitario debe ser round(lista×(1−d), 2) AL CENTAVO', async () => {
    // lista 1000.10, 5% ⇒ 950.095 ⇒ round(·,2) = 950.10 en PostgreSQL (half away from zero).
    const linea = (precioUnitario) => [{ id: 'c1', nombre: 'Escritorio APP', producto_id: 10, producto_version_id: 20, lista_precio_item_id: 5, descuento: 5, cantidad: 1, precioUnitario }];
    const bien = linea(950.10);
    const id = await sembrar(bien);
    expect((await emitir(db, DIRECCION, id, snap(bien, { precioLista: 950.10 }))).nueva).toBe(true);
    for (const pu of [950.09, 950.11, 950]) {
      const p = linea(pu);
      const id2 = await sembrar(p);
      await expect(emitir(db, DIRECCION, id2, snap(p, { precioLista: pu })), String(pu))
        .rejects.toThrow(/precioUnitario \([\d.]+\) != precio autoritativo \(950\.10\) en producto 10/);
    }
  });

  it('especial de proyecto: el gate bloquea un precio a UN centavo del autoritativo', async () => {
    // especial 2000.10, 5% ⇒ 1900.095 ⇒ 1900.10.
    const linea = (precioUnitario) => [{ id: 'e1', nombre: 'Mesa especial', producto_id: 11, producto_version_id: 21, descuento: 5, cantidad: 1, precioUnitario }];
    const ok = linea(1900.10);
    expect((await evaluar(db, DIRECCION, await sembrar(ok), snap(ok, { precioLista: 1900.10 }))).state).toBe('ALLOWED');
    for (const pu of [1900.09, 1900.11, 1900]) {
      const p = linea(pu);
      const g = await evaluar(db, DIRECCION, await sembrar(p), snap(p, { precioLista: pu }));
      expect(g.state, String(pu)).toBe('BLOCKED');
      expect(g.reasons).toContain('linea_1_precio_especial_no_autoritativo');
    }
  });

  it('paridad JS↔SQL en descuentos que NO caen en medio centavo: el precio de comercialDinero se emite', async () => {
    await db.exec(`update public.test_precio set precio_lista = 1234.56 where pid = 10`);
    try {
      const pu = precioConDescuento(1234.56, 7.5);                 // 1141.968 ⇒ 1141.97 en ambos lados
      const p = [{ id: 'c2', nombre: 'Escritorio APP', producto_id: 10, producto_version_id: 20, lista_precio_item_id: 5, descuento: 7.5, cantidad: 1, precioUnitario: pu }];
      expect((await emitir(db, DIRECCION, await sembrar(p), snap(p, { precioLista: pu }))).nueva).toBe(true);
    } finally { await db.exec(`update public.test_precio set precio_lista = 1000.10 where pid = 10`); }
  });

  // HALLAZGO 2026-10-14 (LATENTE): en medio centavo exacto JS y SQL redondean distinto. comercialDinero.precioConDescuento
  // (lo usa la Edge cotizar-servidor) redondea el DESCUENTO half-up a centavo y lo resta: 1000.10 al 5% ⇒ 950.09.
  // emitir_revision_v2 desplegado hace round(lista×(1−d),2) half-away-from-zero ⇒ 950.10 y rechaza 950.09.
  // Hoy la UI aplica el descuento GLOBAL (totales), no por renglón, así que las líneas canónicas viajan con d=0 y
  // no lo disparan; aparece en cuanto una línea traiga `descuento` propio. it.fails: exige la paridad (correcto) y
  // hoy falla — queda VISIBLE. Al alinear ambos lados (decisión de Dirección/Ingeniería), vitest avisa: quitar `.fails`.
  it.fails('paridad JS↔SQL en medio centavo: el precio que calcula comercialDinero debe poder emitirse', async () => {
    const pu = precioConDescuento(1000.10, 5);
    const p = [{ id: 'c3', nombre: 'Escritorio APP', producto_id: 10, producto_version_id: 20, lista_precio_item_id: 5, descuento: 5, cantidad: 1, precioUnitario: pu }];
    const r = await emitir(db, DIRECCION, await sembrar(p), snap(p, { precioLista: pu }));
    expect(r.nueva).toBe(true);
  });
});
