// ============================================================================
//  ROLES · una sola lectura, espejo del servidor (VH-054)
//
//  El servidor emite tres roles en `permitidos.rol`: direccion, diseno, vendedor, y
//  decide con dos funciones (ver supabase/schema/baseline/08_private_api.sql):
//    puede_ver_economia()  → sólo direccion   (economía de cotizaciones/revisiones)
//    puede_editar_config() → direccion|diseno (config completa con costos de insumos)
//  En el cliente había TRES filtros que no coincidían: voni/permisos.js daba economía
//  a 'costeador' y 'cfo' (roles que el servidor nunca emite), datos/voni.js aceptaba
//  'admin' por regex de subcadena, y voniContext.js sólo direccion. Un rol que el
//  cliente se declare a sí mismo no puede dar permisos: aquí todo lo desconocido cae
//  a vendedor (mínimo privilegio) y las dos preguntas se contestan igual que la base.
// ============================================================================
export const ROLES_SERVIDOR = Object.freeze(['direccion', 'diseno', 'vendedor']);

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Normaliza cualquier grafía ('Dirección', 'DISEÑO', 'ventas') a un rol del servidor; lo desconocido es vendedor. */
export function normalizarRol(rol) {
  const r = sinAcentos(rol);
  if (r === 'direccion') return 'direccion';
  if (r === 'diseno') return 'diseno';
  return 'vendedor';   // 'ventas', 'vendedor', 'cfo', 'costeador', 'admin', '', null → mínimo privilegio
}

/** Espejo de private_api.puede_ver_economia(): economía de cotizaciones y revisiones. */
export const veEconomiaCotizacion = (rol) => normalizarRol(rol) === 'direccion';

/** Espejo de private_api.puede_editar_config() / config_para_rol: costos de insumos y despiece. */
export const veCostosCosteo = (rol) => ['direccion', 'diseno'].includes(normalizarRol(rol));
export const editaConfig = veCostosCosteo;

export const esVendedor = (rol) => normalizarRol(rol) === 'vendedor';
