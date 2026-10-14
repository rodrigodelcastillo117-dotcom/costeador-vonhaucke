// ============================================================================
//  SEG-01c · fila AUTORITATIVA de costeos_servidor (lógica pura, la usa la Edge costear-servidor-rc y las pruebas).
//
//  Una sola función arma lo que la Edge inserta, para que la prueba del pipeline real (Costear → intent → Edge →
//  partida → guardar → adjuntar) registre el costeo EXACTAMENTE como en producción. Las autoridades de origen salen
//  de la intención SANEADA que costeó el motor (validarIntentCosteo), nunca de un objeto paralelo del navegador:
//    · promesa_origen      = intent.promesa (lo declarado + materiales/piezas del despiece costeado)
//    · spec_tecnica_origen = spec_tecnica_v1(piezaEfectiva): la pieza EXACTA que recibió calcular() (intención saneada con
//      los componentes reconciliados contra el catálogo autoritativo; cierre GO). Sin piezaEfectiva no hay spec ⇒ no vincula.
//  Versión y huella las sella el trigger de la base (re-proyectando en SQL); aquí sólo se declara 'v1'.
// ============================================================================
import { specTecnicaDeCosteo, SPEC_VERSION } from './specTecnica.js';
import { PROMESA_VERSION } from './promesaComercial.js';

/**
 * @param {object} p
 * @param {object} p.intent            intent saneado (validarIntentCosteo(...).intent)
 * @param {object} p.piezaEfectiva     la pieza que recibió calcular() (costearConMotor(...).piezaEfectiva)
 * @param {number} p.n                 piezas costeadas
 * @param {string} p.email @param {string} p.rol
 * @param {string} p.bomHash           huella INFORMATIVA (FNV, no autoridad)
 * @param {number} p.costoUnitario     costo del motor del servidor, en pesos con centavos
 * @param {string} p.estado @param {boolean} p.aprobacionHumana
 * @param {{versionMotor?:string, versionCatalogo?:string, fuenteCosto?:string}} p.meta
 * @param {Array} p.precios @param {Array} p.warnings @param {string[]} p.insumosUsados @param {string|null} p.baseCostoHuella
 */
export function filaCosteoServidor({ intent, piezaEfectiva, n, email, rol, bomHash, costoUnitario, estado, aprobacionHumana, meta = {}, precios = [], warnings = [], insumosUsados = [], baseCostoHuella = null }) {
  const spec = specTecnicaDeCosteo(piezaEfectiva);
  return {
    creado_por: email, rol, bom_hash: bomHash, cantidad: n, costo_unitario: costoUnitario,
    estado, aprobacion_humana: aprobacionHumana, version_motor: meta.versionMotor ?? null, version_catalogo: meta.versionCatalogo ?? null,
    fuente_costo: meta.fuenteCosto ?? null, precios, warnings,
    insumos_usados: insumosUsados, base_costo_huella: baseCostoHuella,
    // rev3: identidad declarada EN LA MISMA solicitud que el despiece, y el despiece costeado (auditoría).
    identidad_origen: intent?.identidad ?? null, componentes_costeados: piezaEfectiva?.componentes ?? [],
    // rev4: promesa comercial de origen. Sin promesa, el costeo no vincula.
    promesa_origen: intent?.promesa ?? null, promesa_version: intent?.promesa ? PROMESA_VERSION : null,
    // rev5 (cierre GO): especificación técnica de origen = la pieza EFECTIVA del motor. Fuera de contrato ⇒ null ⇒ no vincula.
    spec_tecnica_origen: spec, spec_tecnica_version: spec ? SPEC_VERSION : null,
  };
}
