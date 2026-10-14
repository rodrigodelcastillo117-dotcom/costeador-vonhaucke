// ============================================================================
//  COSTEO → PARTIDA COMERCIAL (lógica pura extraída de App.jsx, 2026-10-14).
//
//  Antes vivía dentro del componente (`onAgregarCotizacion` y `partidaDeCosteo`) y sólo la
//  "protegían" pruebas que buscaban TEXTO en App.jsx. Ahora es la MISMA lógica (refactor puro:
//  mismas salidas, mismo orden de efectos) pero ejecutable con datos, de modo que una regresión
//  (aceptar el costo del cliente, tolerar ±1 centavo, sembrar $0, derivar costo del precio)
//  hace fallar una prueba de comportamiento, no sólo un `toContain`.
//
//  App.jsx sigue siendo dueño de los efectos (mostrarAviso, sumarPartidas, setEstado).
// ============================================================================
import { calcular as calcularMotor, modeloParaPieza as modeloMotor, pendientesDeCosteo as pendientesMotor } from '../motor/calculo.js';
import { aCentavosEnteros, dinero } from '../motor/dinero.js';
import { crearPartida } from './partida.js';
import { identidadDeCosteo, intentDesdePieza, validarIntentCosteo, promesaDeclaradaDeCosteo } from './validarIntentCosteo.js';
import { promesaDeOrigen } from './promesaComercial.js';
import { specTecnicaDeCosteo } from './specTecnica.js';

/**
 * GATE AUTORITATIVO de "Costear especial → Agregar a cotización".
 * El servidor recalcula con la configuración real; sólo si su costo coincide AL CENTAVO con el del
 * cliente y no está incompleto/bloqueado, se arma la partida con el COSTO DEL SERVIDOR.
 *
 * @param {object} p
 * @param {object} p.costeo            el mueble (estado del Costeador)
 * @param {object} p.resultado         cálculo del cliente (`costoUnitario`, `componentesIgnorados`, `componentesExcluidos`)
 * @param {number} p.precio            precio unitario elegido
 * @param {number} p.margen            margen elegido
 * @param {(costeo:object, n:number)=>Promise<object>} p.costearServidor   nube.costearServidor
 * @param {()=>string[]} p.pendientes  perezoso: pendientes del costeo (sólo si `resultado` no los trae)
 * @param {()=>string} p.nuevoId       generador de id de partida
 * @returns {Promise<{ok:false,error:string,avisoMs:number}|{ok:true,partida:object,costoUnitario:number,estado:string|null}>}
 */
export async function partidaAutoritativaDeCosteo({ costeo, resultado, precio, margen, costearServidor, pendientes, nuevoId }) {
  const n = Math.max(1, Number(costeo.piezas) || 1);

  // Un centavo de diferencia implica estado no reproducible y falla cerrado.
  let autoridad;
  try {
    autoridad = await costearServidor(costeo, n);
  } catch (_e) {
    return { ok: false, error: 'No se agregó: no pude verificar el costo con el servidor.', avisoMs: 8000 };
  }
  if (!autoridad?.ok) {
    return { ok: false, error: 'No se agregó: ' + (autoridad?.error || 'el servidor no pudo verificar este costeo.'), avisoMs: 8000 };
  }
  if (autoridad.estado === 'incompleto' || autoridad.estado === 'bloqueado') {
    const motivos = (Array.isArray(autoridad.warnings) ? autoridad.warnings : []).slice(0, 3).join(' · ');
    return { ok: false, error: `No se agregó: el servidor marca el costo como ${autoridad.estado}${motivos ? ` — ${motivos}` : ''}.`, avisoMs: 8000 };
  }

  const costoClienteRaw = resultado?.costoUnitario;
  const costoServidorRaw = autoridad?.costo?.costoUnitario;
  const clienteC = aCentavosEnteros(costoClienteRaw);
  const servidorC = aCentavosEnteros(costoServidorRaw);
  if (clienteC == null || servidorC == null) {
    return { ok: false, error: 'No se agregó: el costo no es finito o no quedó certificado.', avisoMs: 8000 };
  }
  if (clienteC !== servidorC) {
    const delta = Math.abs(clienteC - servidorC) / 100;
    return { ok: false, error: `No se agregó: cliente y servidor difieren $${delta.toFixed(2)}. Recarga y vuelve a costear.`, avisoMs: 9000 };
  }

  const costoServidor = dinero(costoServidorRaw);
  const sinMat = Array.isArray(resultado?.componentesIgnorados)
    ? resultado.componentesIgnorados
    : pendientes();
  // SEG-01c rev3: nombre y medidas son EXACTAMENTE la identidad que viajó al servidor con el despiece.
  const idt = identidadDeCosteo(costeo);
  // SEG-01c rev4: la promesa comercial de la partida sale de la MISMA función y los MISMOS datos que la promesa de
  // origen que el servidor selló con el costeo (lo declarado + materiales y piezas del despiece costeado).
  // Si la intención no valida (el servidor real la habría rechazado), la promesa sale de la misma función sobre el
  // despiece tal cual: si no coincide con la que selló el servidor, el vínculo falla cerrado.
  const v = validarIntentCosteo(intentDesdePieza(costeo, n));
  const promesa = (v.ok ? v.intent.promesa : null) ?? promesaDeOrigen(promesaDeclaradaDeCosteo(costeo), costeo.componentes);
  const partida = {
    id: nuevoId(),
    piezaId: costeo.piezaId || null,
    nombre: idt.nombre,
    ruta: costeo.ruta || null,
    productoId: costeo.productoId || null,
    w: idt.w, d: idt.d,
    cantidad: n,
    costoUnitario: costoServidor,
    costoPendiente: false,
    costoEstado: autoridad.estado || null,
    // SEG-01c: la emisión verifica en el servidor que este costo es el que registró costear-servidor.
    costeoId: autoridad.costeoId || null,
    bomHash: autoridad.bomHash || null,
    versionMotor: autoridad.versionMotor || null,
    versionCatalogo: autoridad.versionCatalogo || null,
    precioUnitario: precio,
    margen,
    piezasSinMaterial: sinMat.length,
    nombresSinMaterial: sinMat,
    // Lo que se promete (promesa_comercial_v1): materiales del despiece, piezas incluidas y excluidas.
    materiales: promesa.materiales ?? [],
    piezas: promesa.piezas ?? [],
    nombresExcluidos: promesa.nombresExcluidos ?? [],
    // SEG-01c rev5: el despiece EXACTO que se costeó (spec_tecnica_v1 de la MISMA pieza saneada que recibió el servidor).
    // adjuntar la re-proyecta en SQL y exige la huella que el servidor selló con el costeo. Sin intención válida no hay
    // especificación y el vínculo falla cerrado.
    especificacion_tecnica: v.ok ? specTecnicaDeCosteo(v.intent.pieza) : null,
  };
  return { ok: true, partida, costoUnitario: costoServidor, estado: autoridad.estado };
}

/**
 * Partida desde un costeo ("Cotizar de línea", Asistente, módulo con add-ons).
 *
 * VENDEDOR (seller-safe): NO se corre el motor de costo en su navegador ni se siembra costo/margen en
 * el estado. El precio sale del catálogo autorizado y la emisión revalida en el servidor por identidad
 * (producto_id). Quien ve costos: el costo explícito o el `costoOficial` del motor; si el motor falla o
 * no da costo, el costo queda DESCONOCIDO (null + costoPendiente), nunca derivado del precio ni $0.
 *
 * @param {object} p  { costeo, cantidad, precioUnitario, margen, costoUnitario, veCostos, insumos, parametros }
 * @param {object} [deps]  inyectables para pruebas: { calcular, modeloParaPieza, pendientesDeCosteo }
 */
export function partidaDeCosteo({ costeo, cantidad, precioUnitario, margen, costoUnitario, veCostos, insumos, parametros }, deps = {}) {
  const calcular = deps.calcular || calcularMotor;
  const modeloParaPieza = deps.modeloParaPieza || modeloMotor;
  const pendientesDeCosteo = deps.pendientesDeCosteo || pendientesMotor;
  const n = Math.max(1, Number(cantidad) || 1);
  let costo = null;
  let margenEf = null;
  let costoDerivado = false;
  if (veCostos) {
    costo = costoUnitario != null && Number.isFinite(Number(costoUnitario))
      ? Number(costoUnitario)
      : null;
    if (costo == null) {
      try {
        const calculado = calcular(costeo, n, insumos, modeloParaPieza(parametros, costeo).par).costoOficial;
        costo = calculado != null && Number.isFinite(Number(calculado)) ? Number(calculado) : null;
      } catch (_e) {
        // FAIL-CLOSED: jamás derivar costo desde precio/margen ni sustituir por $0.
        costo = null;
      }
    }
    margenEf = costo != null && Number.isFinite(margen) ? margen : null;
  }
  return crearPartida({
    piezaId: costeo.piezaId || null,
    nombre: costeo.nombre,
    ruta: costeo.ruta || null,
    productoId: costeo.productoId || null,
    // Identidad de Producto Maestro (Línea V2 / Cocrear): el contrato unifica grafías.
    producto_id: costeo.producto_id ?? null,
    producto_version_id: costeo.productVersionId || costeo.producto_version_id || null,
    source_type: costeo.source_type ?? null, source_ref: costeo.source_ref ?? null,
    lista_precio_item_id: costeo.lista_precio_item_id ?? null,
    precio_lista_snapshot: costeo.precio_lista_snapshot ?? null,
    catalogo: costeo.catalogo ?? null,
    // Imagen canónica del especial co-diseñado (URL de Storage, nunca base64).
    render: costeo.render || null,
    w: costeo.w || null, d: costeo.d || null,
    cantidad: n,
    costoUnitario: costo,
    costoPendiente: veCostos && costo == null,
    costoDerivado,
    precioUnitario,
    margen: margenEf,
    config: costeo.config || null,
    precioReal: !!costeo.precioReal,
    // Mismo candado que ya trae `costearItem()` (camino de Voni) para el camino manual.
    candadoUsuarios: !!(costeo.config?.usuarios && n > 1),
    requiereProyectista: !!(costeo.config?.usuarios && Number(costeo.config.usuarios) > 14),
    // Completitud del costeo SOLO para quien ve costos: una sola definición de "pendiente" (la misma
    // lista que vuelve INCOMPLETO al motor). El vendedor no corre el motor (revalida por identidad).
    ...(veCostos
      ? (() => { const s = pendientesDeCosteo(costeo, insumos, modeloParaPieza(parametros, costeo).par); return { piezasSinMaterial: s.length, nombresSinMaterial: s }; })()
      : { piezasSinMaterial: 0, nombresSinMaterial: [] }),
    // Piezas EXCLUIDAS ($0 por decisión): no es economía → viaja siempre (cláusula en el PDF).
    nombresExcluidos: (costeo.componentes || []).filter((c) => c && c.excluida).map((c) => c.nombre || 'Partida excluida'),
  }, { veCostos, origen: costeo.producto_version_id || costeo.productVersionId ? 'cocrear' : (costeo.ruta ? 'linea' : 'costeo') });
}
