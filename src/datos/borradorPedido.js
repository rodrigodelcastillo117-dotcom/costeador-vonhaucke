// ============================================================================
//  BORRADOR DEL PEDIDO A VONI (lo escrito en "Cuéntame qué necesita tu cliente" y aún no enviado).
//
//  Vivía sólo en el useState de CotizadorIA: ir al paso "Espacio" para subir el plano, al Inicio con "‹ Atrás"
//  o una recarga (p. ej. la de una versión nueva, datos/versionNueva.js) desmontaba la pantalla y el pedido
//  desaparecía sin una palabra (e2e/barridoResultados.e2e.js · "Atrás y pasos de Voni conservan el estado").
//  Ahora se conserva en sessionStorage: ESTA pestaña, sobrevive navegar y recargar, muere al cerrarla.
//  Se borra al empezar una cotización de cero y al salir de la sesión (App.jsx). Nunca lanza.
// ============================================================================
export const CLAVE_BORRADOR_PEDIDO = 'vh:pedidoVoni';
const MAX = 20_000;   // un pedido pegado de un correo largo cabe; un binario pegado por error, no

const porOmision = () => { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; } };

export function leerBorradorPedido(storage = porOmision()) {
  try { const t = storage?.getItem(CLAVE_BORRADOR_PEDIDO); return typeof t === 'string' ? t : ''; } catch { return ''; }
}

export function guardarBorradorPedido(texto, storage = porOmision()) {
  try {
    if (!storage) return false;
    const t = String(texto ?? '');
    if (!t.trim()) storage.removeItem(CLAVE_BORRADOR_PEDIDO);
    else storage.setItem(CLAVE_BORRADOR_PEDIDO, t.slice(0, MAX));
    return true;
  } catch {
    return false;
  }
}

export function borrarBorradorPedido(storage = porOmision()) {
  try { storage?.removeItem(CLAVE_BORRADOR_PEDIDO); } catch { /* nada que hacer */ }
}
