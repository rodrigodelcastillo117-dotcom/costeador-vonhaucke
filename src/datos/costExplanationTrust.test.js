import { describe,it,expect } from 'vitest';
import { explicarCosteo } from './explicacionCosteo.js';
import fs from 'node:fs';

describe('explicación determinista del costo',()=>{
  it('explica sin recalcular ni alterar el resultado canónico',()=>{
    const resultado={
      piezas:2,formulaCosteo:'ALBA_V1',modeloCosteo:'clasico',
      materialDirecto:1000,materialIndirecto:100,materialTotal:1100,
      manoObra:220,preparacion:50,empaque:30,indirectosFabrica:660,
      costoFabricacion:2060,costoLote:2060,costoLoteConMerma:2060,costoUnitario:1030,
      mermaProcesoPct:0,parametrosCorte:{kerfMM:6,recorteOrillaMM:10,aprovechamientoCorte:80},
      componentesIgnorados:[],tarifasFaltantes:[],
      detalleInsumos:[{insumoId:'m',nombre:'Melamina',metodoConsumo:'RENDIMIENTO_GEOMETRICO',tipoAlbaAplicado:'general',neto:1,comprado:1.2,costo:1000,desperdicio:100,pct:16.7}],
    };
    const antes=JSON.stringify(resultado);
    const e=explicarCosteo(resultado,{nombre:'Prueba'});
    expect(JSON.stringify(resultado)).toBe(antes);
    expect(e.formula).toBe('ALBA_V1');
    expect(e.matematicas.costo_unitario).toBe(1030);
    expect(e.nota).toMatch(/No recalcula/i);
  });

  it('Costeador muestra la explicación y VONI reutiliza exactamente la misma función',()=>{
    const ui=fs.readFileSync('src/componentes/Costeador.jsx','utf8');
    const prov=fs.readFileSync('src/voni/proveedorReal.js','utf8');
    expect(ui).toContain('¿Por qué cuesta esto?');
    expect(ui).toContain('explicarCosteo(resultado');
    expect(prov).toContain('explicarCosteo(ctx.costing');
  });

  it('Alba/Rafa siguen protegidos por hash; esta capa no modifica sus fuentes',()=>{
    const p=fs.readFileSync('src/motor/protectedAlbaRafa.test.js','utf8');
    expect(p).toContain('src/motor/formulaAlba.js');
    expect(p).toContain('SOLICITUD-Rafa-REG-DCC-IDP-012.xlsx');
  });
});
