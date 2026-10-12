// ============================================================================
//  COMPUERTA ÚNICA DE EMISIÓN (mandato §4/§11 · VH-047)
//
//  La AUTORIDAD es el servidor: `private_api.evaluar_emision_cotizacion` decide
//  BLOCKED / ECONOMICS_INCOMPLETE / APPROVAL_REQUIRED / ALLOWED y `emitir_revision_v2`
//  no registra nada si no es ALLOWED. El cliente NO reinventa esa decisión: la
//  PROYECTA. Este módulo es el espejo local —mismos estados, mismos códigos de
//  razón (`linea_N_cantidad_invalida`, `linea_N_sin_product_version_id`,
//  `linea_N_costo_no_certificado`…)— para que el vendedor vea ANTES de guardar lo
//  mismo que el servidor le va a decir, y para lo que sólo el cliente sabe
//  (piezas sin material, exclusiones sin confirmar).
//
//  Antes había cuatro evaluadores con cuatro vocabularios: senales.bloqueosDeEmision
//  (CANTIDAD_INVALIDA…), voniContext.porQueNoPuedoEmitir, los checks sueltos de
//  Cotizacion.jsx (excluidas) y partida.validarPartida. Hoy todos derivan de aquí.
//
//  Lo que el cliente NO puede saber (costo oficial de la ProductVersion, precio
//  autorizado, aprobación de Dirección, política comercial) lo trae el servidor y
//  `combinarGate` lo funde: gana la severidad mayor y se unen las razones.
// ============================================================================

export const SEVERIDAD = { ALLOWED: 0, APPROVAL_REQUIRED: 1, ECONOMICS_INCOMPLETE: 2, BLOCKED: 3 };
export const ESTADOS = Object.keys(SEVERIDAD);

const txt = (x) => (x == null ? '' : String(x).trim());
const esEntero = (s) => /^[0-9]+$/.test(s);
const finitoPos = (x) => Number.isFinite(x) && x > 0;

/** Lectura de identidad EXACTAMENTE como el servidor (tres grafías, numéricas). */
export function identidadServidor(p) {
  const pidTxt = txt(p.producto_id) || txt(p.productoId) || txt(p.product_id);
  const pvidTxt = txt(p.producto_version_id) || txt(p.productoVersionId) || txt(p.product_version_id);
  return { pidTxt, pvidTxt, pid: esEntero(pidTxt) ? Number(pidTxt) : null, pvid: esEntero(pvidTxt) ? Number(pvidTxt) : null };
}

/** Estado del costo de un renglón con la clave que lee el servidor (`costoEstado`). */
export const costoEstadoDe = (p) => txt(p?.costoEstado ?? p?.estadoCosto).toLowerCase();

/**
 * Evalúa localmente, con la forma del servidor.
 * @returns {{ok:boolean, estado:string, motivos:string[], economics:string[], excluidas:string[], origen:'local'}}
 */
export function evaluarEmisionLocal({ partidas = [], confirmoExcluidas = false } = {}) {
  const motivos = []; const economics = [];
  const ps = Array.isArray(partidas) ? partidas : [];
  if (!ps.length) motivos.push('sin_partidas');
  ps.forEach((p0, i) => {
    const p = p0 || {}; const n = i + 1;
    if (!finitoPos(p.cantidad)) motivos.push(`linea_${n}_cantidad_invalida`);
    if (!finitoPos(p.precioUnitario)) motivos.push(`linea_${n}_precio_invalido`);
    // Identidad de Producto Maestro: mismas reglas que el servidor.
    const { pidTxt, pvidTxt, pid, pvid } = identidadServidor(p);
    if (pidTxt && pid == null && pvidTxt) motivos.push(`linea_${n}_producto_id_invalido`);
    if (pvidTxt && pvid == null) motivos.push(`linea_${n}_producto_version_id_invalido`);
    if (pid != null && pvid == null) motivos.push(`linea_${n}_sin_product_version_id`);
    if (pid == null && pvid != null) motivos.push(`linea_${n}_sin_product_id`);
    // Sólo el cliente lo sabe: piezas del despiece sin material ⇒ costo falso.
    if ((Number(p.piezasSinMaterial) || 0) > 0) motivos.push(`linea_${n}_sin_material`);
    // Veredicto del costeo (líneas sin ProductVersion): el servidor lee `costoEstado`.
    if (pid == null) {
      const ce = costoEstadoDe(p);
      if (ce === 'preliminar') economics.push(`linea_${n}_costo_preliminar_no_certificado`);
      else if (ce === 'incompleto' || ce === 'bloqueado') economics.push(`linea_${n}_costo_no_certificado`);
    }
  });
  const excluidas = [...new Set(ps.flatMap((p) => (Array.isArray(p?.nombresExcluidos) ? p.nombresExcluidos : [])))];
  if (excluidas.length && !confirmoExcluidas) motivos.push('piezas_excluidas_sin_confirmar');
  const estado = motivos.length ? 'BLOCKED' : economics.length ? 'ECONOMICS_INCOMPLETE' : 'ALLOWED';
  return { ok: estado === 'ALLOWED', estado, motivos, economics, excluidas, origen: 'local' };
}

/** Normaliza lo que devuelve `cotizacion_emitible` (o null) a la misma forma. */
export function gateServidor(g) {
  if (!g || !g.estado || g.estado === 'DESCONOCIDO' || !(g.estado in SEVERIDAD)) return null;
  return { ok: g.estado === 'ALLOWED', estado: g.estado, motivos: [...(g.motivos || [])], economics: [...(g.economics || [])], hash: g.hash || null, origen: 'servidor' };
}

/**
 * Servidor + local: severidad mayor, razones unidas (sin duplicar). Si el servidor
 * no respondió (DESCONOCIDO), vale lo local y se marca `servidorConsultado:false`:
 * el fail-closed real vive en la DB, que vuelve a evaluar al registrar.
 */
export function combinarGate(local, servidor) {
  const s = gateServidor(servidor);
  const l = local || evaluarEmisionLocal({});
  if (!s) return { ...l, servidorConsultado: false };
  const estado = SEVERIDAD[s.estado] >= SEVERIDAD[l.estado] ? s.estado : l.estado;
  const u = (a, b) => [...new Set([...(a || []), ...(b || [])])];
  return { ok: estado === 'ALLOWED', estado, motivos: u(s.motivos, l.motivos), economics: u(s.economics, l.economics), excluidas: l.excluidas || [], hash: s.hash, origen: 'servidor+local', servidorConsultado: true };
}

// --------------------------------------------------------------------------
//  Detalle humano por código (para "¿por qué no puedo emitir?"). Seller-safe.
// --------------------------------------------------------------------------
const CODIGO_LEGADO = {
  cantidad_invalida: 'CANTIDAD_INVALIDA', precio_invalido: 'PRECIO_INVALIDO', sin_material: 'SIN_MATERIAL',
  sin_product_version_id: 'SIN_PRODUCT_VERSION_ID', sin_product_id: 'SIN_PRODUCT_ID',
  producto_id_invalido: 'PRODUCTO_ID_INVALIDO', producto_version_id_invalido: 'PRODUCTO_VERSION_ID_INVALIDO',
  piezas_excluidas_sin_confirmar: 'EXCLUIDAS_SIN_CONFIRMAR', sin_partidas: 'SIN_PARTIDAS',
  // Veredicto del costeo (línea viva 2026-10-08): preliminar bloquea la emisión definitiva.
  costo_preliminar_no_certificado: 'COSTO_PRELIMINAR', costo_no_certificado: 'COSTO_NO_CERTIFICABLE',
};

export function detalleBloqueo(code, partidas = []) {
  const m = /^linea_(\d+)_(.+)$/.exec(String(code || ''));
  const n = m ? Number(m[1]) : null;
  const k = m ? m[2] : String(code || '');
  const p = n ? (partidas[n - 1] || {}) : null;
  const etq = p ? (p.nombre || `Renglón ${n}`) : null;
  const base = { code: CODIGO_LEGADO[k] || k.toUpperCase(), codigo: code, pieza: etq, linea: n, nivel: 'blocker' };
  switch (k) {
    case 'cantidad_invalida': return { ...base,
      titulo: `"${etq}" no tiene una cantidad válida.`,
      porque: 'Sin una cantidad positiva ese renglón no suma al total (cuenta como 0) y el total sería falso.',
      corregir: `Pon una cantidad mayor a 0 en "${etq}".` };
    case 'precio_invalido': return { ...base,
      titulo: `"${etq}" no tiene un precio válido.`,
      porque: 'Un precio en 0 o no finito (margen imposible, costo incompleto) regala el renglón o rompe el total.',
      corregir: `Revisa el costeo de "${etq}": que su costo esté completo y el margen sea válido (<100%).` };
    case 'sin_material': {
      const nSin = Number(p?.piezasSinMaterial) || 0;
      const cuales = Array.isArray(p?.nombresSinMaterial) && p.nombresSinMaterial.length ? ` (${p.nombresSinMaterial.join(', ')})` : '';
      return { ...base,
        titulo: `"${etq}" tiene ${nSin} ${nSin === 1 ? 'pieza' : 'piezas'} sin material asignado${cuales}: se costea en $0. Asígnale material o quítala antes de emitir.`,
        porque: 'Una pieza sin material se costea en $0, así que el costo y el margen de ese renglón son mentira.',
        corregir: `Asígnale material${cuales || ' a esas piezas'} o quítalas de "${etq}".` };
    }
    case 'sin_product_version_id': case 'producto_version_id_invalido': return { ...base,
      titulo: `"${etq}" apunta a un producto sin versión canónica.`,
      porque: 'El servidor valida el precio contra la versión exacta del producto; sin ella no puede autorizarlo.',
      corregir: `Quita "${etq}" y vuelve a agregarla desde su ficha.` };
    case 'sin_product_id': case 'producto_id_invalido': return { ...base,
      titulo: `"${etq}" trae una versión de producto sin producto.`,
      porque: 'La identidad del renglón está incompleta y el servidor no puede resolver su precio autorizado.',
      corregir: `Quita "${etq}" y vuelve a agregarla desde su ficha.` };
    case 'piezas_excluidas_sin_confirmar': return { ...base,
      titulo: 'Hay piezas excluidas del costeo sin confirmar.',
      porque: 'Lo excluido corre por cuenta del cliente; debe quedar dicho antes de emitir.',
      corregir: 'Marca la confirmación de piezas excluidas.' };
    case 'sin_partidas': return { ...base,
      titulo: 'La cotización no tiene partidas todavía.', porque: 'No hay nada que emitir.', corregir: 'Agrega al menos un mueble.' };
    default: return { ...base, titulo: `${etq ? `"${etq}": ` : ''}${k.replace(/_/g, ' ')}.`, porque: null, corregir: null };
  }
}
