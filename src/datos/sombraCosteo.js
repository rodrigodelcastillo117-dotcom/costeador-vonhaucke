// ============================================================================
//  REGISTRO "SOMBRA" cliente vs servidor (tabla shadow_costeo) · una sola forma
//
//  VH-073 (2026-10-11). La comparación sombra lleva desde el 2026-10-03 registrando
//  `estado_servidor: 'error'` con `campos_recibidos: [ok,error,status]` y NADA más:
//  26 de 41 filas son errores 400 cuyo motivo no se guardó (medido). Sin el texto
//  del error la tabla no sirve para lo único que existe: saber por qué el servidor
//  y el navegador no coinciden. Aquí el motivo viaja en `nota` (texto, ya existe)
//  y el código en `estado_servidor`, sin tocar el esquema. Puro.
// ============================================================================

import { dinero } from '../motor/dinero.js';

const recorta = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * @param {object|null} srv  respuesta de nube.costearServidor (ok:true con estado/precioVenta/costo, o ok:false con error/code/status/issues)
 * @param {{inputHash:string, precioCliente:number, costoCliente:number, nombre?:string}} local
 * @returns {object} fila para shadow_costeo
 */
export function filaSombra(srv, { inputHash, precioCliente, costoCliente, nombre = '' }) {
  const fallo = !srv || srv.ok === false;
  const precioSrv = !fallo && Number.isFinite(Number(srv?.precioVenta)) ? Number(srv.precioVenta) : null;
  const costoSrv = !fallo && Number.isFinite(Number(srv?.costo?.costoUnitario)) ? Number(srv.costo.costoUnitario) : null;
  // VH-170: precio pendiente (null) no es $0: sin precio no hay diferencia de precio que registrar.
  const pc = precioCliente == null || precioCliente === '' ? NaN : Math.round(Number(precioCliente));
  const codigo = fallo ? recorta(srv?.code || (srv?.status ? `HTTP_${srv.status}` : 'SIN_RESPUESTA'), 40) : null;
  const motivo = fallo
    ? recorta(srv?.error || srv?.issues?.[0]?.msg || 'sin detalle', 160)
    : null;
  return {
    input_hash: inputHash,
    motor_version: srv?.versionMotor || null,
    version_catalogo: srv?.versionCatalogo || null,
    // Antes: 'error' a secas. Ahora el código viaja aquí para poder agrupar.
    estado_servidor: fallo ? `error:${codigo}` : (srv?.estado || null),
    http_status: srv?.status ?? (fallo ? null : 200),
    precio_cliente: Number.isFinite(pc) ? pc : null,
    precio_servidor: precioSrv,
    costo_cliente: Number.isFinite(Number(costoCliente)) ? Math.round(Number(costoCliente)) : null,
    costo_servidor: costoSrv,
    diff: precioSrv != null && Number.isFinite(pc) ? pc - precioSrv : null,
    campos_recibidos: srv && typeof srv === 'object' ? Object.keys(srv) : null,
    // nombre del mueble + motivo del fallo (si lo hubo), en la única columna de texto libre.
    nota: [recorta(nombre, 120) || null, motivo ? `ERR ${motivo}` : null].filter(Boolean).join(' · ') || null,
  };
}

/**
 * Lado CLIENTE de la sombra, tal como lo arma AsistenteEspecial (extraído 2026-10-14, refactor puro):
 * precio y costo a CENTAVOS con dinero(), nunca Math.round al peso. Probado en moneyBoundaries.test.js.
 */
export function entradaSombraCliente({ inputHash, precio, costoUnitario, nombre }) {
  return { inputHash, precioCliente: dinero(precio), costoCliente: dinero(costoUnitario), nombre };
}
