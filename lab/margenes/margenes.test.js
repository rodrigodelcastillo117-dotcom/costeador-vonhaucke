// Corre con: npx vitest run lab/margenes/margenes.test.js  — genera lab/margenes/margenes.json
import { it } from 'vitest';
import fs from 'node:fs';
import { PRECIOS_VENTA, precioDeLista } from '../../src/datos/preciosVenta.js';
import { LINEAS_REG, configDesde } from '../../src/datos/lineas.js';
import { calcular, modeloParaPieza, PARAMETROS_DEFAULT } from '../../src/motor/calculo.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../../src/datos/insumos.js';

it('margenes', () => {
  const insumos = mapaInsumos(INSUMOS_SEMILLA);
  const filas = [];
  for (const f of PRECIOS_VENTA) {
    const L = LINEAS_REG[f.linea]; const prod = L?.productos.find((p) => p.id === f.producto);
    const venta = Math.round(precioDeLista(f.lista) * 100) / 100;
    if (!prod) { filas.push({ ...f, venta, error: 'sin producto en el registro' }); continue; }
    const cfg = configDesde(prod, { largoMM: f.largoMM, fondoMM: f.fondoMM, usuarios: f.usuarios, biombo: f.biombo, ...(f.sel || {}) });
    let g; try { g = L.generar(cfg); } catch (e) { filas.push({ ...f, venta, error: String(e.message) }); continue; }
    const { par } = modeloParaPieza(PARAMETROS_DEFAULT, g);
    const r = calcular(g, 1, insumos, par);
    const fab = r.costoFabricacion ?? r.costoUnitario;
    filas.push({ linea: f.linea, producto: f.producto, largoMM: f.largoMM, fondoMM: f.fondoMM, usuarios: f.usuarios, biombo: f.biombo, sel: f.sel || null, fuente: f.fuente,
      venta, costoFabricacionModelo: Math.round(fab * 100) / 100, costoTotalModelo: Math.round(r.costoUnitario * 100) / 100,
      margenSobreFabricacion: Math.round(((venta - fab) / venta) * 1000) / 10, estadoCosto: r.estadoCosto, pendientes: r.pendientes?.length || 0,
      modelo: g.modeloCosteo || 'clasico', claves: g.claves || [] });
  }
  fs.writeFileSync('lab/margenes/margenes.json', JSON.stringify(filas, null, 1));
  for (const x of filas) console.log('M', [x.linea, x.producto, x.largoMM, x.fondoMM, x.usuarios, x.biombo, x.sel ? JSON.stringify(x.sel) : '', 'venta', x.venta, 'fab', x.costoFabricacionModelo, 'tot', x.costoTotalModelo, 'mg', x.margenSobreFabricacion + '%', x.estadoCosto, x.error || ''].join(' | '));
});
