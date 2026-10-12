// Preparación CANÓNICA del costeo vivo.
// Costeador, VONI y cualquier auditor usan exactamente la misma pieza virtual,
// parámetros efectivos y selección de modelo. No modifica fórmulas Alba/Rafa.
import { calcular, modeloParaPieza } from './calculo.js';

export function parametrosEfectivosCosteo(estado = {}, costeo = {}) {
  const base = estado.parametros || {};
  return {
    ...base,
    factorIndirectosFabrica: costeo.factorIndirectosFabrica ?? base.factorIndirectosFabrica,
    mermaProceso: costeo.mermaProceso ?? base.mermaProceso,
    empaquePorPieza: costeo.empaquePorPieza ?? base.empaquePorPieza,
  };
}

export function piezaVirtualDeCosteo(costeo = {}) {
  return {
    nombre: costeo.nombre,
    componentes: costeo.componentes || [],
    horas: costeo.horas,
    modoManoObra: costeo.modoManoObra,
    modeloCosteo: costeo.modeloCosteo,
    factorDirecta: costeo.factorDirecta,
    factorIndirecta: costeo.factorIndirecta,
    preparacionHoras: costeo.preparacionHoras,
  };
}

export function calcularCosteoVivo(estado = {}, costeo = {}) {
  const piezaVirtual = piezaVirtualDeCosteo(costeo);
  const parBase = parametrosEfectivosCosteo(estado, costeo);
  const modelo = modeloParaPieza(parBase, piezaVirtual);
  const resultado = calcular(
    piezaVirtual,
    Math.max(1, Number(costeo.piezas) || 1),
    estado.insumos || {},
    modelo.par,
  );
  return {
    piezaVirtual,
    parBase,
    par: modelo.par,
    esIntelisis: modelo.esIntelisis,
    resultado,
  };
}
