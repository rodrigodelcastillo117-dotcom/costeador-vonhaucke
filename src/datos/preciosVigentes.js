// ============================================================================
//  PRECIOS VIGENTES — de dónde saca el costeo el precio de cada insumo.
// ----------------------------------------------------------------------------
//  Antes, al entrar con usuario, la app REEMPLAZABA todo su catálogo con la
//  copia guardada en `config` (92 insumos del 2026-08-11, varios con la unidad
//  vieja: el MDF por m² y sin fracción de hoja). Así se perdían los ~170 insumos
//  restantes y se costeaba con precios viejos.
//
//  Ahora, para quien ve costos (Dirección/Diseño):
//    1. La FORMA de cada insumo (unidad, formato, fracción, merma) sale de la
//       semilla del código.
//    2. El PRECIO sale del catálogo de la base (`catalogo_vigente`, detrás de
//       RLS), siempre que la unidad de la base sea la misma que la del código.
//    3. Un precio editado en la pantalla Precios (queda en `config` con su
//       fecha) gana solo si es MÁS NUEVO que el de la base y trae la misma unidad.
//    4. Un insumo que solo existe en `config` (alta manual) se conserva tal cual.
//    5. Un insumo que solo existe en la base (alta desde compras) entra con su
//       unidad de compra, sin formato ni fracción de hoja.
//
//  Al vendedor no se le aplica nada de esto: sigue recibiendo la config
//  sanitizada del servidor, sin precios.
// ============================================================================

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
const fecha = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');

/**
 * @param {Record<string, object>} semilla   mapa id -> insumo del código
 * @param {Record<string, object>} compartido  config.datos.insumos (puede venir vacío)
 * @param {Array<object>} vigentes  filas de `precios_vigentes_costeo()`:
 *   { insumo_id, nombre, seccion, precio, unidad_costeo, estado, certificable, fuente, vigente_desde }
 * @returns {{ insumos: Record<string, object>, resumen: object }}
 */
export function fusionarInsumos(semilla, compartido = {}, vigentes = []) {
  const insumos = { ...semilla };
  const resumen = { desdeBD: [], altasDesdeBD: [], unidadDistinta: [], sinFormaEnCodigo: [], editadosEnApp: [], soloEnConfig: [] };

  for (const f of vigentes || []) {
    const id = f?.insumo_id;
    const base = id ? insumos[id] : null;
    if (!base) {
      // Alta hecha en la base (p. ej. material de compras que el código no
      // tiene): se costea por su unidad de compra, sin formato ni fracción.
      const precio = num(f?.precio);
      if (!id || !f.unidad_costeo || !(precio > 0)) { if (id) resumen.sinFormaEnCodigo.push(id); continue; }
      insumos[id] = {
        id, nombre: f.nombre || id, seccion: f.seccion || 'consumibles', unidad: f.unidad_costeo,
        clase: 'directa', mermaCorte: 0, inventario: false, veta: false, fraccion: false, proveedor: '',
        precio, precioBase: precio, actualizado: fecha(f.vigente_desde), fuente: f.fuente || '',
        estadoPrecio: f.estado || null, certificable: !!f.certificable, origenPrecio: 'catalogo_bd', altaEnBD: true,
      };
      resumen.altasDesdeBD.push(id);
      continue;
    }
    if (f.unidad_costeo && f.unidad_costeo !== base.unidad) {
      resumen.unidadDistinta.push({ id, codigo: base.unidad, bd: f.unidad_costeo });
      continue;
    }
    const precio = num(f.precio);
    if (!(precio > 0)) continue;
    insumos[id] = {
      ...base,
      precio,
      precioBase: precio,
      actualizado: fecha(f.vigente_desde) || base.actualizado,
      fuente: f.fuente || base.fuente,
      estadoPrecio: f.estado || null,
      certificable: !!f.certificable,
      origenPrecio: 'catalogo_bd',
    };
    resumen.desdeBD.push(id);
  }

  for (const [id, c] of Object.entries(compartido || {})) {
    if (!c || typeof c !== 'object') continue;
    const base = insumos[id];
    if (!base) { insumos[id] = c; resumen.soloEnConfig.push(id); continue; }
    const precio = num(c.precio);
    if (c.unidad !== base.unidad || !(precio > 0)) continue;
    if (fecha(c.actualizado) > fecha(base.actualizado)) {
      insumos[id] = { ...base, precio, precioBase: precio, actualizado: fecha(c.actualizado), origenPrecio: 'editado_en_app' };
      resumen.editadosEnApp.push(id);
    }
  }

  return { insumos, resumen };
}

const sinAcentos = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const VACIAS = new Set(['cuanto', 'cuesta', 'cuestan', 'precio', 'precios', 'costo', 'costos', 'vale', 'valen', 'del', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'que', 'hoja', 'por', 'kg', 'metro', 'materia', 'prima', 'material', 'a', 'en', 'y', 'mm']);

/** Busca filas de precios vigentes por palabras de la consulta (todas deben aparecer). */
export function buscarPreciosMaterial(filas = [], consulta = '', limite = 8) {
  const palabras = sinAcentos(consulta).split(/[^a-z0-9]+/).filter((w) => w && !VACIAS.has(w));
  if (!palabras.length) return [];
  return (filas || [])
    .filter((f) => { const t = sinAcentos(`${f?.insumo_id} ${f?.nombre}`); return palabras.every((w) => t.includes(w)); })
    .slice(0, limite)
    .map((f) => ({ id: f.insumo_id, nombre: f.nombre || f.insumo_id, unidad: f.unidad_costeo, precio: Number(f.precio),
      vigente_desde: f.vigente_desde, estado: f.estado, fuente: f.fuente }));
}
