import { describe, it, expect, beforeAll } from 'vitest';

// ============================================================================
//  OPERACIÓN RESCATE · COTIZAR (caso Torre Sur, plano ARQ-01 de Rodrigo, 2026-10-10)
//  Síntoma: "No pude costear: Banca doble App LT 8 usuarios · Escritorio ejecutivo
//  Eclipse 2.10 · Credenza Eclipse 2100 · Mesa de juntas App LT 2100".
//  Evidencia: con ruta/producto CANÓNICOS el motor SÍ cuesta las 4 anclas (abajo), y
//  un fuzz de TODO el catálogo que ve Voni da 0 nulls/throws. El null real sólo puede
//  venir de una ruta/producto que la IA devuelve y no existe — y eso moría MUDO.
//  Reparación: resolverRutaProducto (clave|título, id|nombre) + motivo visible.
// ============================================================================
describe('RESCATE Cotizar · anclas del plano Torre Sur', () => {
  let costearItem, catalogoIA, resolverRutaProducto, estado;
  beforeAll(async () => {
    const ln = await import('./lineas.js');
    const ins = await import('./insumos.js');
    const mc = await import('../motor/calculo.js');
    costearItem = ln.costearItem; catalogoIA = ln.catalogoIA; resolverRutaProducto = ln.resolverRutaProducto;
    estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
  });

  const ANCLAS = [
    { ruta: 'applt', producto: 'banca_doble', cantidad: 1, seleccion: [{ clave: 'usuarios', valor: '8' }, { clave: 'largoMM', valor: '1500' }], etiqueta: 'Banca doble App LT 8 usuarios, 1500 mm por puesto' },
    { ruta: 'eclipse', producto: 'escritorio', cantidad: 1, seleccion: [{ clave: 'largoMM', valor: '2100' }, { clave: 'mano', valor: 'D' }, { clave: 'finish', valor: 'chapa' }], etiqueta: 'Escritorio ejecutivo Eclipse 2.10 m, mano derecha, chapa' },
    { ruta: 'eclipse', producto: 'credenza', cantidad: 1, seleccion: [{ clave: 'largoMM', valor: '2100' }, { clave: 'finish', valor: 'chapa' }], etiqueta: 'Credenza Eclipse 2100 mm, chapa' },
    { ruta: 'applt', producto: 'mesa_juntas', cantidad: 1, seleccion: [{ clave: 'largoMM', valor: '2100' }], etiqueta: 'Mesa de juntas App LT 2100 mm para 6 personas' },
  ];

  for (const a of ANCLAS) {
    it(`Dirección: ${a.etiqueta} → partida con precio`, () => {
      const c = costearItem(estado, a);
      expect(c).toBeTruthy();
      expect(c.precioUnitario).toBeGreaterThan(0);
      expect(c.cantidad).toBe(1);
    });
    it(`Vendedor (soloVentas): ${a.etiqueta} → precio autorizado O fail-closed, nunca null`, () => {
      const c = costearItem(estado, a, { soloVentas: true });
      expect(c).toBeTruthy();
      expect(c.sinPrecioAutorizado === true || c.precioUnitario > 0).toBe(true);
    });
  }

  it('Eclipse escritorio/credenza 2.10 traen PRECIO DE CATÁLOGO real (no modelo) + IDENTIDAD Producto Maestro para Dirección', () => {
    const esc = costearItem(estado, ANCLAS[1]);
    const cre = costearItem(estado, ANCLAS[2]);
    expect(esc.precioReal).toBe(true); expect(esc.catalogo?.clave).toBeTruthy();
    expect(cre.precioReal).toBe(true); expect(cre.catalogo?.clave).toBeTruthy();
    // punto 2/3: la identidad viaja también sin soloVentas (antes sólo seller-safe)
    expect(esc.source_type).toBe('linea'); expect(esc.source_ref).toBe(esc.catalogo.clave);
    expect(esc.producto_id).toBeTruthy(); expect(esc.producto_version_id).toBeTruthy();
    expect(cre.producto_id).toBeTruthy();
    // y conserva la economía de Dirección (no se recorta como seller-safe)
    expect(esc).toHaveProperty('costoUnitario');
  });

  it('punto 5: precio EXTRAPOLADO por puesto queda marcado PROVISIONAL con su consecuencia de ingeniería', () => {
    // banca sencilla App LT: usuarios [1,2,3,4,6,8] → 5 no existe → se escala desde el escalón más cercano
    const c = costearItem(estado, { ruta: 'applt', producto: 'banca_sencilla', cantidad: 1, seleccion: [{ clave: 'usuarios', valor: '5' }, { clave: 'largoMM', valor: '1500' }] });
    expect(c).toBeTruthy();
    expect(c.precioProvisional).toBe(true);
    expect(c.escalado).toMatchObject({ puestosPedidos: 5 });
    expect(c.escalado.puestosDelEscalon).not.toBe(5);
    expect(c.precioReal).toBe(false);
    // y un escalón REAL (8) no es provisional
    const r8 = costearItem(estado, ANCLAS[0]);
    expect(r8.precioProvisional).toBe(false);
    expect(r8.escalado).toBeNull();
  });

  it('punto 4: lo que NO se pudo costear se conserva como PARTIDA PENDIENTE (precio null, nunca $0)', async () => {
    const { partidaRequerimientoPendiente, requerimientosPendientes, PENDIENTE_TIPOS } = await import('./requerimientoPendiente.js');
    const p = partidaRequerimientoPendiente({ ruta: 'applt', producto: 'escritorio_ejecutivo', cantidad: 2, etiqueta: 'Escritorio ejecutivo 2.10', seleccion: [{ clave: 'largoMM', valor: '2100' }] }, { tipo: PENDIENTE_TIPOS.SIN_COSTEAR, motivo: 'el producto "escritorio_ejecutivo" no existe en App LT' });
    expect(p.precioUnitario).toBeNull();
    expect(p.costoUnitario).toBeNull();
    expect(p.price_status).toBe('SIN_PRECIO');
    expect(p.requiere_costeo).toBe(true);
    expect(p.cantidad).toBe(2);
    expect(p.nombre).toBe('Escritorio ejecutivo 2.10');
    expect(p.motivoPendiente).toMatch(/no existe en App LT/);
    expect(requerimientosPendientes([p, { nombre: 'ok', precioUnitario: 10 }])).toHaveLength(1);
  });

  it('tolera TÍTULO de línea y NOMBRE de producto (lo que una IA puede mandar en vez de clave/id)', () => {
    expect(resolverRutaProducto('App LT', 'Banca doble')).toEqual({ ruta: 'applt', producto: 'banca_doble', motivo: null });
    expect(resolverRutaProducto('ECLIPSE', 'Escritorio Directivo')).toEqual({ ruta: 'eclipse', producto: 'escritorio', motivo: null });
    expect(resolverRutaProducto('app lt', 'MESA_JUNTAS')).toEqual({ ruta: 'applt', producto: 'mesa_juntas', motivo: null });
    const c = costearItem(estado, { ...ANCLAS[0], ruta: 'App LT', producto: 'Banca doble' });
    expect(c).toBeTruthy();
    expect(c.ruta).toBe('applt'); expect(c.producto).toBe('banca_doble');
  });

  it('lo que NO existe sigue en null (fail-closed) pero con MOTIVO', () => {
    expect(resolverRutaProducto('nolinea', 'escritorio').motivo).toMatch(/línea "nolinea" no existe/);
    expect(resolverRutaProducto('applt', 'escritorio_ejecutivo').motivo).toMatch(/producto "escritorio_ejecutivo" no existe en App LT/);
    const warn = console.warn; const warns = [];
    console.warn = (...x) => warns.push(String(x[0]));
    try { expect(costearItem(estado, { ruta: 'applt', producto: 'escritorio_ejecutivo', cantidad: 1, seleccion: [] })).toBeNull(); }
    finally { console.warn = warn; }
    expect(warns.some((w) => /no existe en App LT/.test(w))).toBe(true);
  });

  it('FUZZ: todo el catálogo que ve Voni (cada param × cada valor + crudos inválidos) → 0 nulls / 0 throws', () => {
    const cat = catalogoIA();
    const warn = console.warn; console.warn = () => {};
    const fallas = [];
    const probar = (ruta, producto, seleccion, tag) => {
      let c;
      try { c = costearItem(estado, { ruta, producto, cantidad: 1, seleccion }); }
      catch (e) { fallas.push(`THROW ${ruta}/${producto} ${tag}: ${e.message}`); return; }
      if (!c) fallas.push(`NULL ${ruta}/${producto} ${tag}`);
    };
    try {
      for (const [ruta, L] of Object.entries(cat)) {
        if (ruta.startsWith('__')) continue;
        for (const p of L.productos) {
          probar(ruta, p.id, [], 'vacío');
          for (const [k, vals] of Object.entries(p.params || {})) for (const v of vals) probar(ruta, p.id, [{ clave: k, valor: String(v) }], `${k}=${v}`);
          for (const ch of p.checks || []) probar(ruta, p.id, [{ clave: ch, valor: 'si' }], `check ${ch}`);
          for (const [k, v] of [['finish', 'Chapa de madera'], ['color', 'nogal'], ['biombo', 'si'], ['largoMM', '2.10'], ['usuarios', '8 usuarios'], ['mano', 'derecha']]) probar(ruta, p.id, [{ clave: k, valor: v }], `RAW ${k}=${v}`);
        }
      }
    } finally { console.warn = warn; }
    expect(fallas, fallas.join('\n')).toEqual([]);
  });
});
