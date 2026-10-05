import { describe, it, expect, beforeAll } from 'vitest';
import { configDesde } from './lineas.js';

// ---------------------------------------------------------------------------
//  SELLER-SAFE (C3.4 / Principio #2 VH): con `opciones.soloVentas`, costearItem
//  NUNCA devuelve economía interna (costo/margen/factores/horas) y NUNCA inventa
//  un precio de modelo: si el precio no es AUTORIZADO (catálogo/price-book), cae
//  fail-closed (`sinPrecioAutorizado`), jamás $0 silencioso. Dirección/Diseño
//  (sin la opción) conservan el comportamiento idéntico de siempre.
// ---------------------------------------------------------------------------
const CLAVES_ECONOMIA = /^(costo.*|margen|utilidad|materialtotal|manoobra|indirectos.*|precioproveedor|precioreal|costoderivado|factordirecta|factorindirecta|horas|preparacionhoras)$/;
function escaneaEconomia(obj, hits = [], ruta = '') {
  if (obj == null || typeof obj !== 'object') return hits;
  if (Array.isArray(obj)) { obj.forEach((v, i) => escaneaEconomia(v, hits, `${ruta}[${i}]`)); return hits; }
  for (const [k, v] of Object.entries(obj)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    // precioReal (bandera booleana "es de papel") NO es dinero; sólo se vigila como valor numérico.
    if (CLAVES_ECONOMIA.test(norm) && norm !== 'precioreal') hits.push(`${ruta}.${k}`);
    escaneaEconomia(v, hits, `${ruta}.${k}`);
  }
  return hits;
}

describe('seller-safe: el vendedor no recibe economía interna', () => {
  let costearItem, catalogoIA, estado;
  beforeAll(async () => {
    const ln = await import('./lineas.js');
    const ins = await import('./insumos.js');
    const mc = await import('../motor/calculo.js');
    costearItem = ln.costearItem; catalogoIA = ln.catalogoIA;
    estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
  });

  it('Dirección/Diseño (sin soloVentas): el comportamiento es idéntico (trae costoUnitario)', () => {
    const c = costearItem(estado, { ruta: 'applt', producto: 'banca_doble', cantidad: 1, seleccion: [{ clave: 'usuarios', valor: '6' }, { clave: 'largoMM', valor: '1500' }] });
    expect(c).toBeTruthy();
    expect(c).toHaveProperty('costoUnitario');   // economía presente para veCostos
  });

  it('TODOS los productos en soloVentas: 0 keys de economía, y precio autorizado O fail-closed (nunca $0)', () => {
    const cat = catalogoIA();
    const fugas = [];
    const silenciosos = [];
    let evaluados = 0, conPrecio = 0, failClosed = 0;
    for (const ruta of Object.keys(cat)) {
      if (ruta.startsWith('__')) continue;           // __banco no pasa por costearItem
      for (const p of cat[ruta].productos || []) {
        let c; try { c = costearItem(estado, { ruta, producto: p.id, cantidad: 1, seleccion: [] }, { soloVentas: true }); } catch (e) { continue; }
        if (!c) continue;
        evaluados++;
        const hits = escaneaEconomia(c);
        if (hits.length) fugas.push(`${ruta}/${p.id}: ${hits.join(',')}`);
        if (c.sinPrecioAutorizado) { failClosed++; }
        else if (c.precioUnitario > 0) { conPrecio++; }
        else { silenciosos.push(`${ruta}/${p.id} precio=${c.precioUnitario}`); }  // $0 o undefined: PROHIBIDO
      }
    }
    expect(fugas).toEqual([]);         // Principio #2: cero economía interna
    expect(silenciosos).toEqual([]);   // Principio #1: cero precio silencioso $0
    expect(evaluados).toBeGreaterThan(50);
    // Señal informativa: cuántos resuelven a precio autorizado vs fail-closed.
    expect(conPrecio + failClosed).toBe(evaluados);
  });

  it('SIN insumos (vendedor real tras el cutover de config): sigue dando precio autorizado O fail-closed, nunca $0, 0 economía', () => {
    const estadoVendedor = { insumos: {}, parametros: {}, piezas: {} };  // config_para_rol no manda costos
    const cat = catalogoIA();
    const fugas = [];
    const silenciosos = [];
    let evaluados = 0;
    for (const ruta of Object.keys(cat)) {
      if (ruta.startsWith('__')) continue;
      for (const p of cat[ruta].productos || []) {
        let c; try { c = costearItem(estadoVendedor, { ruta, producto: p.id, cantidad: 1, seleccion: [] }, { soloVentas: true }); } catch (e) { continue; }
        if (!c) continue;
        evaluados++;
        if (escaneaEconomia(c).length) fugas.push(`${ruta}/${p.id}`);
        if (!c.sinPrecioAutorizado && !(c.precioUnitario > 0)) silenciosos.push(`${ruta}/${p.id} precio=${c.precioUnitario}`);
      }
    }
    expect(fugas).toEqual([]);
    expect(silenciosos).toEqual([]);     // nunca $0 silencioso aunque no haya insumos
    expect(evaluados).toBeGreaterThan(50);
  });

  it('un item de catálogo en soloVentas trae precio pero NO costo', () => {
    const c = costearItem(estado, { ruta: 'applt', producto: 'banca_doble', cantidad: 1, seleccion: [{ clave: 'usuarios', valor: '6' }, { clave: 'largoMM', valor: '1200' }] }, { soloVentas: true });
    expect(c.sellerSafe).toBe(true);
    expect(c.costoUnitario).toBeUndefined();
    expect(c.margen).toBeUndefined();
    if (!c.sinPrecioAutorizado) expect(c.precioUnitario).toBeGreaterThan(0);
    if (c.catalogo) expect(c.catalogo.full).toBeUndefined();   // 'full' = precio 2 (base de costo)
  });

  it('LÍNEA V2: un item de catálogo resuelto trae identidad de Producto Maestro, y snapshot == precio mostrado', () => {
    const cat = catalogoIA();
    let conIdentidad = 0;
    for (const ruta of Object.keys(cat)) {
      if (ruta.startsWith('__')) continue;
      for (const p of cat[ruta].productos || []) {
        let c; try { c = costearItem(estado, { ruta, producto: p.id, cantidad: 1, seleccion: [] }, { soloVentas: true }); } catch (e) { continue; }
        if (!c || c.sinPrecioAutorizado) continue;
        if (c.producto_id != null) {
          conIdentidad++;
          expect(c.lista_precio_item_id).toBeTruthy();
          expect(c.precio_lista_snapshot).toBe(c.precioUnitario);  // snapshot == precio mostrado (al peso)
          expect(c.source_ref).toBeTruthy();
        }
      }
    }
    expect(conIdentidad).toBeGreaterThan(0);  // al menos algunos resuelven identidad V2
  });
});

// ---------------------------------------------------------------------------
//  LO QUE NO EXISTE YA NO SE SUSTITUYE EN SILENCIO (auditoría de Voni, 2026-08-16).
//  Si Voni pedía "bench de 8 usuarios" y ese producto sólo existe de 2 o de 6,
//  la app cotizaba DOS y no decía nada: el vendedor pedía 8 puestos y se llevaba
//  el precio de 2. Es el peor tipo de error —silencioso y caro—, y por eso estas
//  pruebas son de las que no se deben borrar.
// ---------------------------------------------------------------------------
const PRODUCTO = {
  id: 'bench',
  selects: [{ key: 'usuarios', label: 'Usuarios', opciones: [{ id: '2' }, { id: '6' }] }],
  largos: [1200, 1500, 1800],
};

describe('configuración que no existe', () => {
  it('toma el valor MÁS CERCANO, no el primero de la lista', () => {
    const avisos = [];
    const c = configDesde(PRODUCTO, { usuarios: '8' }, avisos);
    expect(c.usuarios).toBe('6');          // no '2'
  });

  it('AVISA de lo que ajustó', () => {
    const avisos = [];
    configDesde(PRODUCTO, { usuarios: '8' }, avisos);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/8/);
    expect(avisos[0]).toMatch(/6/);
  });

  it('no avisa cuando lo pedido SÍ existe', () => {
    const avisos = [];
    const c = configDesde(PRODUCTO, { usuarios: '6', largoMM: 1500 }, avisos);
    expect(c.usuarios).toBe('6');
    expect(c.largoMM).toBe(1500);
    expect(avisos).toHaveLength(0);
  });

  it('una medida rara cae en la más cercana y lo dice', () => {
    const avisos = [];
    const c = configDesde(PRODUCTO, { largoMM: 1600 }, avisos);
    expect(c.largoMM).toBe(1500);
    expect(avisos.join(' ')).toMatch(/1600/);
  });

  it('con texto basura no truena: usa el primero y avisa', () => {
    const avisos = [];
    const c = configDesde(PRODUCTO, { usuarios: 'banana' }, avisos);
    expect(c.usuarios).toBe('2');
    expect(avisos).toHaveLength(1);
  });

  it('sin pasarle `avisos` se comporta como siempre', () => {
    expect(() => configDesde(PRODUCTO, { usuarios: '8' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
//  BENCH CON MÁS PUESTOS DE LOS QUE OFRECE EL PRODUCTO (Rodrigo, 2026-08-16):
//  "si tenemos el precio de 6 usuarios, divide entre 6: eso da cuánto es por
//  usuario. Si son 8, precio de 1 usuario × 8."
//  Antes se cotizaba OTRA cosa (2 o 6 puestos) y el cliente recibía el precio de
//  algo que no pidió.
// ---------------------------------------------------------------------------
describe('cotizar más puestos de los que arma el producto', () => {
  let costearItem, estado;
  beforeAll(async () => {
    const ln = await import('./lineas.js');
    const ins = await import('./insumos.js');
    const mc = await import('../motor/calculo.js');
    costearItem = ln.costearItem;
    estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
  });
  const bench = (u) => costearItem(estado, {
    ruta: 'rio', producto: 'bench_recto_doble', cantidad: 1,
    seleccion: [{ clave: 'usuarios', valor: String(u) }, { clave: 'largo', valor: '1500' }],
  });

  // 2026-08-16: Río ya arma 4/8/10/12 usuarios de verdad (antes sólo 2 y 6, y el
  // ancla del papel —bench doble de 8— era inalcanzable). Con la corrida real, el
  // precio POR PUESTO BAJA al alargarla, que es justo lo que hacen los
  // presupuestos: la estructura de los extremos se reparte entre más gente.
  it('el precio por puesto BAJA al alargar la corrida, y nunca se dispara', () => {
    const p6 = bench(6).precioUnitario / 6;
    const p8 = bench(8).precioUnitario / 8;
    const p12 = bench(12).precioUnitario / 12;
    expect(p8).toBeLessThan(p6);
    expect(p12).toBeLessThan(p8);
    expect(p12).toBeGreaterThan(p6 * 0.6);   // baja, pero no se desploma
  });

  // El escalón sigue existiendo para lo que de verdad no se arma: 20 usuarios no
  // es una opción de ningún bench, y ahí el precio por puesto sí debe mantenerse.
  it('pedir muchos más puestos de los que existen se cotiza por puesto', () => {
    const veinte = bench(20);
    const p12 = bench(12).precioUnitario / 12;
    expect(veinte.precioUnitario / 20).toBeCloseTo(p12, 0);
  });

  it('cotizar 8 cuesta MÁS que cotizar 6, no menos', () => {
    expect(bench(8).precioUnitario).toBeGreaterThan(bench(6).precioUnitario);
  });

  it('la huella crece con los puestos', () => {
    expect(bench(12).w).toBeGreaterThan(bench(8).w);
    expect(bench(8).w).toBeGreaterThan(bench(6).w);
  });

  it('el nombre dice los puestos que se cotizaron', () => {
    expect(bench(8).nombre).toMatch(/8/);
  });

  it('avisa que se cotizó a partir de otro escalón', () => {
    expect(bench(20).avisos.join(' ')).toMatch(/por puesto/);
    expect(bench(6).avisos).toHaveLength(0);
    expect(bench(8).avisos).toHaveLength(0);   // 8 ya es una opción real
  });
});

// ---------------------------------------------------------------------------
//  "cantidad" NO ES "total de gente" (Rodrigo, 2026-08-19, encontrado en
//  producción): "30 puestos en bench App LT" se cotizó con usuarios:12
//  (opción válida, sin escalar) y cantidad:30 — eso cobró y contó 30 BANCAS
//  de 12 (360 personas, 12× el precio) en vez de UNA banca de 30 personas.
//  El escalón (arriba) ya cobra bien cuando usuarios:30/cantidad:1; esta
//  prueba cubre la mezcla ambigua que causó el sobrecobro real.
// ---------------------------------------------------------------------------
describe('candado: cantidad de bancas vs. total de gente', () => {
  let costearItem, estado;
  beforeAll(async () => {
    const ln = await import('./lineas.js');
    const ins = await import('./insumos.js');
    const mc = await import('../motor/calculo.js');
    costearItem = ln.costearItem;
    estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
  });
  const item = (usuarios, cantidad) => costearItem(estado, {
    ruta: 'applt', producto: 'banca_doble', cantidad,
    seleccion: [{ clave: 'usuarios', valor: String(usuarios) }, { clave: 'largoMM', valor: '1500' }],
  });

  it('30 personas correctamente (usuarios:30, cantidad:1): sin aviso de candado, precio de UNA banca escalada', () => {
    const c = item(30, 1);
    expect(c.avisos.join(' ')).not.toMatch(/unidades, no personas/i);
    expect(c.nombre).toMatch(/30/);
  });

  it('la mezcla ambigua (usuarios:12 válido + cantidad:30) avisa del sobrecobro, no lo esconde', () => {
    const correcto = item(30, 1);
    const ambiguo = item(12, 30);
    expect(ambiguo.avisos.join(' ')).toMatch(/unidades, no personas/i);
    expect(ambiguo.avisos.join(' ')).toMatch(/360/);
    // Y de verdad cobra 12× lo que cobra la forma correcta — el aviso no es
    // cosmético, hay dinero real de diferencia.
    expect(ambiguo.precioUnitario * ambiguo.cantidad)
      .toBeCloseTo(correcto.precioUnitario * correcto.cantidad * 12, -2);
  });

  it('cantidad:1 con usuarios válido nunca avisa (caso normal, un solo bench)', () => {
    expect(item(12, 1).avisos.join(' ')).not.toMatch(/unidades, no personas/i);
  });

  // La condición ahora también viaja como dato (`candadoUsuarios`), no sólo
  // como texto del aviso — así la pantalla puede exigir confirmación sin
  // tener que parsear español.
  it('candadoUsuarios es true exactamente en la mezcla ambigua, false en los casos normales', () => {
    expect(item(12, 30).candadoUsuarios).toBe(true);
    expect(item(30, 1).candadoUsuarios).toBe(false);
    expect(item(12, 1).candadoUsuarios).toBe(false);
  });
});

// ---------------------------------------------------------------------------
//  TECHO DE CORDURA EN USUARIOS (Rodrigo, 2026-08-20): "normalmente se
//  manejan en pares, nunca he visto uno de más de 14; en ese caso se tiene
//  que cotizar con un proyectista". No topa el precio (sigue siendo la mejor
//  referencia disponible) ni bloquea el renglón — lo marca para que un
//  humano lo revise antes de llegar al cliente.
// ---------------------------------------------------------------------------
describe('techo de cordura: pedidos de más de 14 usuarios', () => {
  let costearItem, estado;
  beforeAll(async () => {
    const ln = await import('./lineas.js');
    const ins = await import('./insumos.js');
    const mc = await import('../motor/calculo.js');
    costearItem = ln.costearItem;
    estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
  });
  const item = (usuarios) => costearItem(estado, {
    ruta: 'applt', producto: 'banca_doble', cantidad: 1,
    seleccion: [{ clave: 'usuarios', valor: String(usuarios) }, { clave: 'largoMM', valor: '1500' }],
  });

  it('14 o menos: no requiere proyectista', () => {
    expect(item(14).requiereProyectista).toBe(false);
    expect(item(12).requiereProyectista).toBe(false);
  });

  it('más de 14: requiere proyectista, pero sigue trayendo un precio de referencia', () => {
    const c = item(30);
    expect(c.requiereProyectista).toBe(true);
    expect(c.avisos.join(' ')).toMatch(/proyectista/);
    expect(c.precioUnitario).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
//  HUELLAS (auditoría de Voni, 2026-08-16). La pieza de MÁS ÁREA del despiece no
//  es la huella: en un mueble de caja es el cuerpo desarrollado (costados, fondo
//  y entrepaños en un solo tablero). La credenza Cirque salía de 1.80 × 1.50 m
//  de fondo cuando mide 0.60, y con eso el acomodo reserva metro y medio de paso
//  y dice que no cabe. El sillón Pac salía en 0 × 0 y ni se dibujaba.
// ---------------------------------------------------------------------------
describe('huella de cada mueble', () => {
  let costearItem, catalogoIA, estado;
  beforeAll(async () => {
    const ln = await import('./lineas.js');
    const ins = await import('./insumos.js');
    const mc = await import('../motor/calculo.js');
    costearItem = ln.costearItem; catalogoIA = ln.catalogoIA;
    estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
  });

  it('la credenza mide 0.60 de fondo, no 1.50', () => {
    const c = costearItem(estado, { ruta: 'cirque', producto: 'credenza', cantidad: 1, seleccion: [{ clave: 'medida', valor: '1800' }] });
    expect(c.w).toBe(1800);
    expect(c.d).toBe(600);
  });

  it('un sillón sin medidas en el despiece las saca de su nombre', () => {
    const c = costearItem(estado, { ruta: 'pac', producto: 'sillon', cantidad: 1, seleccion: [] });
    expect(c.w).toBeGreaterThan(0);
    expect(c.d).toBeGreaterThan(0);
  });

  it('NINGUNO de los 118 productos queda sin huella o con un fondo imposible', () => {
    const cat = catalogoIA();
    const malas = [];
    for (const ruta of Object.keys(cat)) {
      for (const p of cat[ruta].productos || []) {
        let c; try { c = costearItem(estado, { ruta, producto: p.id, cantidad: 1, seleccion: [] }); } catch (e) { continue; }
        if (!c) continue;
        if (!c.w || !c.d) malas.push(`${ruta}/${p.id} sin huella`);
        else if (Math.min(c.w, c.d) > 1500) malas.push(`${ruta}/${p.id} fondo ${Math.min(c.w, c.d)} mm`);
      }
    }
    expect(malas).toEqual([]);
  });

  // P0 (audit externo 2026-09-24): la rama de coincidencia con catálogo (precio
  // REAL) omitía `cantidad`, y los totales hacen precio × (cantidad||0) → el
  // renglón se perdía ($0). Ninguna rama de costearItem debe soltar la cantidad.
  it('P0: costearItem NUNCA pierde la cantidad (ni en la rama de catálogo)', () => {
    const cat = catalogoIA();
    const malas = [];
    for (const ruta of Object.keys(cat)) {
      for (const p of cat[ruta].productos || []) {
        let c; try { c = costearItem(estado, { ruta, producto: p.id, cantidad: 3, seleccion: [] }); } catch (e) { continue; }
        if (!c) continue;
        if (c.cantidad !== 3) malas.push(`${ruta}/${p.id} cantidad=${c.cantidad}${c.precioReal ? ' (catálogo)' : ''}`);
      }
    }
    expect(malas).toEqual([]);
  });
});
