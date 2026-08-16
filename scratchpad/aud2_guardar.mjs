// ============================================================================
//  AUD2 — ¿el especial se GUARDA, SOBREVIVE la recarga, y se puede REABRIR
//  y CLONAR? Usa el almacen REAL (src/almacen.js) con un localStorage de
//  mentiras, y la logica REAL de onGuardarPieza copiada de App.jsx:461.
//  No toca src/.
// ============================================================================
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { cargar, guardar } = await import('../src/almacen.js');
const { calcular, PARAMETROS_DEFAULT } = await import('../src/motor/calculo.js');
const { PIEZAS_SEMILLA } = await import('../src/datos/piezas.js');

let idc = 0;
const idNuevo = (p) => `${p}_${++idc}`;

const L = (...a) => console.log(...a);
const ok = (b) => (b ? 'SI' : '** NO **');

// --------------------------------------------------------------------------
// El especial: encargo 3, mostrador retail 2.40 m con vitrina, LED y logo.
const costeo = {
  piezaId: null,
  nombre: 'Mostrador retail 2.40 m con vitrina y LED',
  linea: null, piezas: 1,
  componentes: [
    { nombre: 'Cuerpo MDF 19', insumoId: 'mdf', largoMM: 2400, anchoMM: 900, piezas: 3 },
    { nombre: 'Cubierta laminado', insumoId: 'laminado', largoMM: 2400, anchoMM: 600, piezas: 1 },
    { nombre: 'Vitrina cristal', insumoId: 'cristal-flotado', largoMM: 2400, anchoMM: 500, piezas: 3 },
    { nombre: 'Logo acrilico', insumoId: 'acrilico', largoMM: 800, anchoMM: 300, piezas: 1 },
    { nombre: 'Tira LED 5 m', insumoId: '', cantidad: 5 },   // <-- SIN MATERIAL, a proposito
  ],
  modoManoObra: 'porcentaje', factorDirecta: 70, factorIndirecta: 12,
  preparacionHoras: 0, margen: 30,
  horas: { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0 },
};

L('\n=== PASO 1 · arranque limpio (cargar() sin nada en localStorage) ===');
let estado = cargar();
const semillaN = Object.keys(estado.piezas || {}).length;
L(`piezas de fabrica: ${semillaN}  (PIEZAS_SEMILLA=${PIEZAS_SEMILLA.length})`);
L(`estado.piezas es ARREGLO? ${Array.isArray(estado.piezas)}   es OBJETO? ${typeof estado.piezas === 'object' && !Array.isArray(estado.piezas)}`);

L('\n=== PASO 2 · costear y GUARDAR (logica literal de App.jsx:461) ===');
const resultado = calcular(costeo, 1, estado.insumos, estado.parametros);
L(`costo unitario = $${Math.round(resultado.costoUnitario).toLocaleString('es-MX')}`);

let tronó = null;
try {
  const id = costeo.piezaId || idNuevo('pieza');
  const pieza = { ...costeo, id, piezaId: id, costoUnitario: resultado?.costoUnitario ?? null };
  estado = { ...estado, piezas: { ...(estado.piezas || {}), [id]: pieza } };
  guardar(estado);                       // el useEffect de App.jsx:331
  L(`guardarPieza NO tronó. id=${id}`);
} catch (e) {
  tronó = e;
  L(`** TRONÓ **: ${e.message}`);
}
L(`¿el boton de guardar ya sirve? ${ok(!tronó)}`);

L('\n=== PASO 3 · RECARGAR la app (cargar() otra vez, del localStorage) ===');
const recargado = cargar();
const nuevas = Object.values(recargado.piezas || {}).filter((p) => !p.linea && !PIEZAS_SEMILLA.some((s) => s.id === p.id));
L(`piezas tras recargar: ${Object.keys(recargado.piezas).length} (antes de guardar: ${semillaN})`);
L(`¿sobrevivió la recarga? ${ok(nuevas.length === 1)}  -> ${JSON.stringify(nuevas.map((p) => p.nombre))}`);
L(`¿trae su despiece completo? ${ok((nuevas[0]?.componentes || []).length === 5)} (${(nuevas[0]?.componentes || []).length} componentes)`);

L('\n=== PASO 4 · ¿se puede volver a ABRIR? ¿hay quien LEA estado.piezas? ===');
// Lo que el Catalogo realmente lee:
const cat = await import('../src/componentes/Catalogo.jsx').catch(() => null);
L('Catalogo.jsx importa PIEZAS_SEMILLA (recetas fijas del codigo), NO estado.piezas.');
L('recetaDe() -> PIEZAS_SEMILLA.find(...)   [Catalogo.jsx:15]');
const enCatalogo = PIEZAS_SEMILLA.some((p) => p.id === nuevas[0]?.id);
L(`¿el especial guardado aparece en el Catalogo? ${ok(enCatalogo)}`);
L(`¿existe boton "clonar/duplicar" en alguna pantalla? -> ver grep abajo`);

L('\n=== PASO 5 · marca de especial ===');
L(`¿la pieza guardada se distingue de una de fabrica? campo esEspecial = ${JSON.stringify(nuevas[0]?.esEspecial)}`);
L(`¿tiene fecha de guardado? guardadaEl = ${JSON.stringify(nuevas[0]?.guardadaEl)}`);
L(`campos guardados: ${Object.keys(nuevas[0] || {}).join(', ')}`);

L('\n=== PASO 6 · la pieza SIN MATERIAL ===');
const sinMat = costeo.componentes.filter((c) => !c.insumoId);
L(`componentes sin material: ${sinMat.length} -> ${JSON.stringify(sinMat.map((c) => c.nombre))}`);
const conLed = { ...costeo, componentes: costeo.componentes.filter((c) => c.insumoId) };
const rSin = calcular(conLed, 1, estado.insumos, estado.parametros);
L(`costo CON el renglon de LED en la lista: $${Math.round(resultado.costoUnitario).toLocaleString('es-MX')}`);
L(`costo SIN el renglon de LED:             $${Math.round(rSin.costoUnitario).toLocaleString('es-MX')}`);
L(`diferencia: $${Math.round(resultado.costoUnitario - rSin.costoUnitario)}  -> el LED aporta CERO y nadie avisa`);
L(`renglones que el motor devuelve: ${resultado.detalle?.length ?? resultado.compras?.length ?? '?'} de ${costeo.componentes.length} capturados`);
