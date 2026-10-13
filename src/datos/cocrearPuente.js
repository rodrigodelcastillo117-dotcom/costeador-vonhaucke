// ============================================================================
//  PUENTE COCREAR → COSTEO (COCREAR 10 · D-01)
//
//  Dirección (2026-10-13): "co-creación puede ser un mueble nuevo o cambiar medidas de uno de
//  línea; ahí sí sería costear y nosotros poner un precio, usando TODA la info que tenemos".
//
//  Dos caminos, los dos terminan en `intent._componentes` (el BOM de la revisión) y de ahí en el
//  motor de siempre (motor/calculo.js · calcular, Alba V1 × dificultad):
//
//   A) CAMBIO DE MEDIDAS DE UN MUEBLE DE LÍNEA (`bajarLineaABom`). Se parte del DESPIECE REAL que
//      la app ya genera para ese producto (LINEAS_REG · generar, el mismo de CosteadorLinea) en la
//      medida de catálogo más cercana, y se ESCALAN las piezas con la geometría (`escalarDespiece`).
//      El tablero NO se escala por regla de tres: la pieza conserva largo×ancho y el motor la cobra
//      por ACOMODO EN HOJA (piezasPorTablero + regla de producción ½/1 hoja). Probado en
//      lab/applt/estimaciones: regla de tres −22 % en cubiertas; acomodo en hoja +1 a +2 %.
//
//   B) MUEBLE NUEVO (`semillaCostearDesdeCocrear` → Costear → `aplicarRetornoCosteo`). La misma vía
//      que Costear: el asistente (análisis IA → BOM con preguntas, amarre ERP, verificación) recibe
//      nombre, medidas, materiales, funciones, descripción e imagen de referencia; al terminar
//      regresa el BOM a Cocrear como una revisión nueva, con su procedencia.
//
//  REGLAS DURAS
//   - Nada se inventa. Lo que el escalado no sabe medir queda como en el padre y se AVISA
//     (`avisos`, `conservados`); una función del concepto (electrificación, iluminación…) que el
//     despiece no trae entra como pieza PENDIENTE (sin material) → el costo queda incompleto y el
//     precio "Por confirmar", nunca $0.
//   - El precio de catálogo del mueble de línea no se toca: lo co-creado es un ESPECIAL DERIVADO
//     (conserva linaje, requiere validación de ingeniería) y su precio sale de su costo.
//   - Puro y determinista (sin red, sin fecha): misma entrada ⇒ mismo BOM ⇒ mismo spec hash.
// ============================================================================
import { LINEAS_REG, configDesde } from './lineas.js';

export const EJES = Object.freeze(['ancho_mm', 'prof_mm', 'alto_mm']);
const NOMBRE_EJE = { ancho_mm: 'ancho', prof_mm: 'fondo', alto_mm: 'alto' };

// Funciones del concepto que NO son físicas (layout del concepto A/B/C): no piden despiece.
const FUNCION_SIN_DESPIECE = /^layout_/;
const ETIQUETA_FUNCION = {
  jardinera_integrada: 'Jardinera integrada', jardinera_longitud_completa: 'Jardinera a todo el eje',
  electrificacion_integrada: 'Electrificación', divisores: 'Divisores', acustica: 'Acústica',
  iluminacion_integrada: 'Iluminación integrada', cajones: 'Cajones', cerraduras: 'Cerraduras', ruedas: 'Ruedas',
  carga_inalambrica: 'Carga inalámbrica', electronica: 'Pantalla / electrónica', curva: 'Forma curva',
  flotante: 'Base flotante', ventilacion: 'Ventilación', refuerzo_inferior: 'Refuerzo inferior',
  registro_mantenimiento: 'Registro de mantenimiento', acceso_definido: 'Sistema de acceso',
};
export const etiquetaFuncion = (f) => ETIQUETA_FUNCION[f] || String(f || '').replaceAll('_', ' ');

const r0 = (x) => Math.round(Number(x));
const pos = (x) => Number.isFinite(Number(x)) && Number(x) > 0;
const dimsDe = (d = {}) => ({
  ancho_mm: pos(d.ancho_mm) ? Number(d.ancho_mm) : null,
  prof_mm: pos(d.prof_mm) ? Number(d.prof_mm) : (pos(d.fondo_mm) ? Number(d.fondo_mm) : null),
  alto_mm: pos(d.alto_mm) ? Number(d.alto_mm) : null,
});

// ---------------------------------------------------------------------------
//  Productos de línea que se pueden escalar: los que declaran su medida base en la app
//  (largos[/fondos] o diámetros) y son UN cuerpo. Las bancas por usuario crecen por MÓDULOS
//  (más usuarios), no estirando la cubierta, y el escritorio en L tiene dos cuerpos: ésos se
//  configuran en su costeador de línea o se pasan a Costear.
// ---------------------------------------------------------------------------
export function esProductoEscalable(p) {
  if (!p || p.usuarios || p.largosLateral) return false;
  return (Array.isArray(p.largos) && p.largos.length > 0) || (Array.isArray(p.diametros) && p.diametros.length > 0);
}

export function lineasEscalables(registro = LINEAS_REG) {
  return Object.entries(registro)
    .map(([ruta, l]) => ({
      ruta, titulo: l.titulo,
      productos: (l.productos || []).filter(esProductoEscalable).map((p) => ({
        id: p.id, nombre: p.nombre, largos: p.largos || null, fondos: p.fondos || null, diametros: p.diametros || null,
      })),
    }))
    .filter((l) => l.productos.length > 0);
}

/** Envolvente base (mm) del producto de línea en la config de catálogo usada. Lo no declarado queda null. */
export function envolventeBase(producto, config) {
  if (Array.isArray(producto?.diametros) && producto.diametros.length) {
    const d = pos(config?.diametroMM) ? Number(config.diametroMM) : null;
    return { ancho_mm: d, prof_mm: d, alto_mm: null };
  }
  return {
    ancho_mm: pos(config?.largoMM) ? Number(config.largoMM) : null,
    prof_mm: pos(config?.fondoMM) ? Number(config.fondoMM) : null,
    alto_mm: pos(producto?.altoMM) ? Number(producto.altoMM) : null,
  };
}

/**
 * El PADRE: el despiece real del producto de línea en la medida de catálogo más cercana a la pedida.
 * @returns {{ok:true, ruta, linea, productoId, productoNombre, nombre, config, componentes, base, claves}|{ok:false, motivo}}
 */
export function padreDeLinea({ ruta, productoId, dims = {} } = {}, registro = LINEAS_REG) {
  const l = registro?.[ruta];
  const p = l?.productos?.find((x) => x.id === productoId);
  if (!l || !p) return { ok: false, motivo: 'Ese producto de línea no existe en la app.' };
  if (!esProductoEscalable(p)) {
    return { ok: false, motivo: `${l.titulo} · ${p.nombre}: no declara una medida base escalable (crece por módulos o por usuarios). Configúralo en su costeador de línea o pásalo a Costear.` };
  }
  const d = dimsDe(dims);
  const sel = Array.isArray(p.diametros) && p.diametros.length ? { diametroMM: d.ancho_mm } : { largoMM: d.ancho_mm, fondoMM: d.prof_mm };
  let config, g;
  try {
    config = configDesde(p, sel);
    g = l.generar(config);
  } catch (e) {
    return { ok: false, motivo: `No se pudo generar el despiece de ${l.titulo} · ${p.nombre}: ${String(e?.message || e)}` };
  }
  const componentes = Array.isArray(g?.componentes) ? g.componentes : [];
  if (!componentes.length) return { ok: false, motivo: `${l.titulo} · ${p.nombre} no tiene despiece en la app.` };
  return {
    ok: true, ruta, linea: l.titulo, productoId: p.id, productoNombre: p.nombre, nombre: g.nombre || `${l.titulo} ${p.nombre}`,
    config, componentes: JSON.parse(JSON.stringify(componentes)), base: envolventeBase(p, config), claves: g.claves || [],
  };
}

// ---------------------------------------------------------------------------
//  ESCALADO GEOMÉTRICO DE UN DESPIECE
//  Para cada medida de una pieza se busca el eje de la envolvente que sigue (ancho/fondo/alto):
//   · ABARCA     (±2 % del eje)            → toma la medida nueva del eje           (cubierta L×F)
//   · HOLGURA    (60 %–102 % del eje)      → conserva la holgura: medida + Δeje      (riel = L − 300)
//   · PROPORCIÓN (25 %–60 % del eje)       → medida × (eje nuevo / eje base)         (puerta de 2)
//   · FIJA       (< 25 % o sin eje)        → no cambia                               (placas, herrajes)
//  El largo y el ancho de una misma pieza no pueden seguir el mismo eje (se asigna primero el
//  que mejor coincide). Una cantidad lineal (m) igual al PERÍMETRO de una pieza rectangular del
//  despiece (canto) se recalcula con el perímetro nuevo. Una cantidad lineal o de área SIN
//  geometría se conserva tal cual y se avisa: no se sabe qué eje sigue (no se inventa).
//  Las piezas por unidad (herrajes, chapas) se conservan: no dependen de la medida.
// ---------------------------------------------------------------------------
function candidatosEje(d, base, { excluir = null, solo = EJES } = {}) {
  const out = [];
  for (const k of solo) {
    if (k === excluir || !pos(base[k])) continue;
    out.push({ k, B: base[k], r: Math.abs(d - base[k]) / base[k] });
  }
  return out.sort((a, b) => a.r - b.r);
}
function reglaMedida(d, cand, nueva) {
  if (!cand) return { tipo: 'fija', valor: d };
  const N = pos(nueva[cand.k]) ? nueva[cand.k] : cand.B;
  if (cand.r <= 0.02) return { tipo: 'abarca', eje: cand.k, valor: r0(d + (N - cand.B)) };
  if (d <= cand.B * 1.02 && d >= 0.6 * cand.B) return { tipo: 'holgura', eje: cand.k, valor: r0(d + (N - cand.B)) };
  // Proporción sólo para "mitades" (dos puertas, dos compartimentos): fuera de esa banda una
  // medida chica (tira, tapa, frente) no se estira con el mueble.
  if (d < 0.6 * cand.B && d >= 0.4 * cand.B) return { tipo: 'proporcional', eje: cand.k, valor: r0(d * (N / cand.B)) };
  return { tipo: 'fija', valor: d };
}
// Piezas VERTICALES (por su nombre): una de sus medidas es la ALTURA. Sin esto, con un padre que no
// declara su alto, el alto de un costado (590) "coincidía" con el fondo (600) y se escalaba mal.
const sinAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// De FRENTE (su medida horizontal sigue el ANCHO) o de LADO (sigue el FONDO).
const RE_DE_FRENTE = /\b(respaldo|trasero|puerta|frente|faldon|panel|biombo|mampara|zoclo|copete|modesty)\b/;
const RE_DE_LADO = /\b(lateral(es)?|costado|divisor)\b/;
/** 'ancho_mm' | 'prof_mm' | null — el eje que sigue la medida horizontal de una pieza vertical. */
export function ejeDePiezaVertical(nombre) {
  const t = sinAcento(nombre);
  if (RE_DE_LADO.test(t)) return 'prof_mm';
  if (RE_DE_FRENTE.test(t)) return 'ancho_mm';
  return null;
}
export const esPiezaVertical = (nombre) => ejeDePiezaVertical(nombre) != null;

// Asigna largo y ancho a ejes distintos: primero la medida con la mejor coincidencia.
function reglasRectangulo(l, a, base, nueva, { vertical = null } = {}) {
  if (vertical) {
    // La medida que mejor coincide con su eje horizontal (ancho si es de frente, fondo si es de lado)
    // sigue ese eje; la otra es la ALTURA (sigue el alto sólo si el padre lo declara).
    const cl = candidatosEje(l, base, { solo: [vertical] }), ca = candidatosEje(a, base, { solo: [vertical] });
    const largoHorizontal = !ca.length || (cl.length && cl[0].r <= ca[0].r);
    const altura = (d) => reglaMedida(d, candidatosEje(d, base, { solo: ['alto_mm'] })[0] || null, nueva);
    return largoHorizontal
      ? [reglaMedida(l, cl[0] || null, nueva), altura(a)]
      : [altura(l), reglaMedida(a, ca[0] || null, nueva)];
  }
  const cl = candidatosEje(l, base), ca = candidatosEje(a, base);
  const primeroLargo = !ca.length || (cl.length && (cl[0].r < ca[0].r || (cl[0].r === ca[0].r)));
  if (primeroLargo) {
    const rl = reglaMedida(l, cl[0] || null, nueva);
    const ca2 = rl.eje ? candidatosEje(a, base, { excluir: rl.eje }) : ca;
    return [rl, reglaMedida(a, ca2[0] || null, nueva)];
  }
  const ra = reglaMedida(a, ca[0] || null, nueva);
  const cl2 = ra.eje ? candidatosEje(l, base, { excluir: ra.eje }) : cl;
  return [reglaMedida(l, cl2[0] || null, nueva), ra];
}
const perimetroM = (c) => (2 * (Number(c.largoMM) + Number(c.anchoMM))) / 1000;
const unidadDe = (c, insumos) => String((insumos?.[c.insumoId] || c.insumo || {}).unidad || '').toLowerCase();
const esLineal = (u) => ['m', 'ml', 'metro', 'metros', 'm lineal'].includes(u);
const esArea = (u) => ['m2', 'm²', 'mt2'].includes(u);
const textoRegla = (rg) => (rg.tipo === 'fija' ? 'fija' : `${rg.tipo} · ${NOMBRE_EJE[rg.eje]}`);

/**
 * @param componentes  despiece del padre (no se muta)
 * @param base         envolvente del padre {ancho_mm, prof_mm, alto_mm} (null = no declarado)
 * @param nueva        envolvente pedida
 * @returns {{componentes, trazas, conservados, avisos, confianza:'media'|'baja', ejesSinBase:string[]}}
 */
export function escalarDespiece(componentes = [], base = {}, nueva = {}, { insumos = {} } = {}) {
  const B = dimsDe(base), N = dimsDe(nueva);
  const trazas = [], conservados = [], avisos = [];
  const ejesSinBase = EJES.filter((k) => !pos(B[k]) && pos(N[k]));
  const rects = (componentes || []).filter((c) => pos(c?.largoMM) && pos(c?.anchoMM));
  const escaladoDe = new Map();   // pieza base → [l', a'] (para recalcular perímetros)

  const out = (componentes || []).map((c0) => {
    const c = { ...c0 };
    if (c.excluida) return c;
    if (pos(c.largoMM) && pos(c.anchoMM)) {
      const [rl, ra] = reglasRectangulo(Number(c.largoMM), Number(c.anchoMM), B, N, { vertical: ejeDePiezaVertical(c0.nombre) });
      escaladoDe.set(c0, [rl.valor, ra.valor]);
      if (rl.valor !== Number(c.largoMM) || ra.valor !== Number(c.anchoMM)) {
        trazas.push({ pieza: c0.nombre || c0.insumoId || 'Pieza', de: `${c.largoMM}×${c.anchoMM}`, a: `${rl.valor}×${ra.valor}`, regla: `${textoRegla(rl)} / ${textoRegla(ra)}` });
        c.largoMM = rl.valor; c.anchoMM = ra.valor;
        c.nombre = `${c0.nombre || 'Pieza'} → ${rl.valor}×${ra.valor} mm (escalada)`;
      }
      if (Number(c.hojas) > 0) avisos.push(`${c0.nombre || 'Pieza'}: traía fracción de hoja fija (${c.hojas}); se conservó. Revísala con la medida nueva.`);
      return c;
    }
    if (pos(c.largoMM) && !pos(c.anchoMM)) {
      const rg = reglaMedida(Number(c.largoMM), candidatosEje(Number(c.largoMM), B)[0] || null, N);
      if (rg.valor !== Number(c.largoMM)) {
        trazas.push({ pieza: c0.nombre || 'Pieza', de: `${c.largoMM}`, a: `${rg.valor}`, regla: textoRegla(rg) });
        c.largoMM = rg.valor;
        c.nombre = `${c0.nombre || 'Pieza'} → ${rg.valor} mm (escalada)`;
      }
      return c;
    }
    const u = unidadDe(c, insumos);
    const cant = Number(c.cantidad);
    if (pos(cant) && esLineal(u)) {
      // ¿Es el perímetro de una pieza rectangular del despiece? (canto, perfil de orilla)
      // Se toma la MEJOR coincidencia (no la primera): primero la pieza que el canto nombra
      // ("Canto · Credenza · puerta" → la puerta), luego la de menor diferencia. Tolerancia 0.5 %.
      const nombreC = sinAcento(c0.nombre);
      const tol = Math.max(0.005, cant * 0.005);
      const opciones = [];
      for (const r of rects) {
        for (const m of new Set([Number(r.piezas) || 1, Number(r.cantidad) || 1])) {
          const dif = Math.abs(perimetroM(r) * m - cant);
          if (dif <= tol) opciones.push({ r, m, dif, nombrada: !!r.nombre && nombreC.includes(sinAcento(r.nombre)) });
        }
      }
      opciones.sort((x, y) => (y.nombrada - x.nombrada) || (x.dif - y.dif));
      const p = opciones[0]?.r || null;
      if (p) {
        const m = opciones[0].m;
        const [l2, a2] = escaladoDe.get(p) || reglasRectangulo(Number(p.largoMM), Number(p.anchoMM), B, N, { vertical: ejeDePiezaVertical(p.nombre) }).map((x) => x.valor);
        const nuevo = Math.round(((2 * (l2 + a2)) / 1000) * m * 1000) / 1000;
        if (Math.abs(nuevo - cant) > 1e-9) {
          trazas.push({ pieza: c0.nombre || 'Pieza', de: `${cant} m`, a: `${nuevo} m`, regla: `perímetro de ${p.nombre || 'la pieza'}` });
          c.cantidad = nuevo;
        }
        return c;
      }
    }
    if (pos(cant) && (esLineal(u) || esArea(u) || !u)) {
      conservados.push({ pieza: c0.nombre || c0.insumoId || 'Pieza', cantidad: cant, unidad: u || '?' });
    }
    return c;
  });

  if (conservados.length) avisos.push(`${conservados.length} pieza(s) sin geometría en el despiece del padre conservan su cantidad (ESTIMADO): ${conservados.map((x) => x.pieza).slice(0, 4).join(', ')}${conservados.length > 4 ? '…' : ''}. Diseño debe revisarlas.`);
  for (const k of ejesSinBase) avisos.push(`El padre no declara su ${NOMBRE_EJE[k]}: ese eje no se escaló (se conserva la estructura del padre).`);
  const ratios = EJES.filter((k) => pos(B[k]) && pos(N[k])).map((k) => N[k] / B[k]);
  const grande = ratios.some((x) => x < 0.6 || x > 1.6);
  if (grande) avisos.push('El cambio de medida es mayor al 40 %: el escalado deja de ser confiable. Conviene pasarlo a Costear.');
  return { componentes: out, trazas, conservados, avisos, confianza: grande || conservados.length || ejesSinBase.length ? 'baja' : 'media', ejesSinBase };
}

// ---------------------------------------------------------------------------
//  Funciones del concepto sin despiece → piezas PENDIENTES (bloquean el costo, nunca $0).
// ---------------------------------------------------------------------------
export function piezaPendienteDeFuncion(f) {
  return { insumoId: '', nombre: `${etiquetaFuncion(f)} (sin despiece)`, material_solicitado: etiquetaFuncion(f), material_match: 'PENDING_MATERIAL', cantidad: 1, _funcion: f };
}

/** Sincroniza las piezas pendientes con las funciones vigentes del intent. No toca las demás piezas. */
export function sincronizarFuncionesPendientes(intent) {
  if (!intent || !Array.isArray(intent._componentes) || !intent._puente) return intent;
  const cubiertas = new Set(intent._puente.funciones_cubiertas || []);
  const quiere = (intent.caracteristicas || []).filter((f) => !FUNCION_SIN_DESPIECE.test(f) && !cubiertas.has(f));
  const reales = intent._componentes.filter((c) => !c?._funcion);
  const pendientes = quiere.map((f) => piezaPendienteDeFuncion(f));
  const actual = intent._componentes.filter((c) => c?._funcion).map((c) => c._funcion);
  if (actual.length === quiere.length && actual.every((f, i) => f === quiere[i])) return intent;
  return { ...intent, _componentes: [...reales, ...pendientes] };
}

/**
 * CAMINO A · Cambio de medidas de un mueble de línea → BOM escalado (nueva revisión del intent).
 * @returns {{ok:true, intent, padre, escalado}|{ok:false, motivo}}
 */
export function bajarLineaABom(intent, { ruta, productoId, dificultad } = {}, { insumos = {}, registro = LINEAS_REG } = {}) {
  if (!intent) return { ok: false, motivo: 'No hay concepto que bajar a BOM.' };
  const nueva = dimsDe(intent.dimensiones || {});
  if (!pos(nueva.ancho_mm)) return { ok: false, motivo: 'Falta el ancho del mueble: sin medida no hay despiece (no se inventa).' };
  const padre = padreDeLinea({ ruta, productoId, dims: nueva }, registro);
  if (!padre.ok) return padre;
  const cambia = EJES.some((k) => pos(padre.base[k]) && pos(nueva[k]) && Math.abs(padre.base[k] - nueva[k]) >= 1);
  if (!cambia) {
    return { ok: false, mismaMedida: true, motivo: `Es ${padre.nombre} tal cual, en medida de catálogo: cotízalo desde su línea (precio de lista). Cocrear sólo costea lo que cambia.` };
  }
  const esc = escalarDespiece(padre.componentes, padre.base, nueva, { insumos });
  const base = {
    ...intent,
    _componentes: esc.componentes,
    _dificultad: dificultad ?? intent._dificultad ?? undefined,
    // Linaje (§17): especial DERIVADO de un producto real; conserva padre, versión (config) y medidas.
    _linaje: {
      id: `${padre.ruta}:${padre.productoId}`,
      version: [padre.base.ancho_mm, padre.base.prof_mm].filter(Boolean).join('x') || null,
      nombre: padre.nombre,
      ruta: padre.ruta, producto: padre.productoId,
      dimensiones: { ancho_mm: padre.base.ancho_mm, prof_mm: padre.base.prof_mm, alto_mm: padre.base.alto_mm },
    },
    _puente: {
      tipo: 'linea_escalada',
      metodo: 'Despiece real del padre + escalado geométrico; el tablero se cobra por acomodo en hoja (motor), no por regla de tres.',
      ruta: padre.ruta, producto: padre.productoId, padre: padre.nombre, linea: padre.linea,
      base: padre.base, medidas: nueva,
      trazas: esc.trazas, conservados: esc.conservados, avisos: esc.avisos, confianza: esc.confianza,
      funciones_cubiertas: [],
    },
  };
  if (base._dificultad === undefined) delete base._dificultad;
  return { ok: true, intent: sincronizarFuncionesPendientes(base), padre, escalado: esc };
}

/** Re-escala automáticamente el BOM de línea cuando cambian las medidas del concepto. */
export function reescalarSiAplica(intent, { insumos = {}, registro = LINEAS_REG } = {}) {
  const pz = intent?._puente;
  if (!pz || pz.tipo !== 'linea_escalada') return { intent, cambio: false };
  const d = dimsDe(intent.dimensiones || {});
  const iguales = EJES.every((k) => (pz.medidas?.[k] ?? null) === (d[k] ?? null));
  if (iguales) return { intent: sincronizarFuncionesPendientes(intent), cambio: false };
  const r = bajarLineaABom(intent, { ruta: pz.ruta, productoId: pz.producto, dificultad: intent._dificultad }, { insumos, registro });
  if (r.ok) return { intent: r.intent, cambio: true };
  // Volvió a la medida de catálogo o el padre ya no aplica: el BOM escalado deja de valer.
  const { _componentes, _puente, _linaje, ...resto } = intent;
  return { intent: resto, cambio: true, motivo: r.motivo };
}

// ---------------------------------------------------------------------------
//  CAMINO B · Mueble nuevo → Costear (asistente) → de regreso con BOM.
// ---------------------------------------------------------------------------
const MAT_TXT = { nogal: 'nogal', roble: 'roble', encino: 'encino', maple: 'maple', laminado: 'laminado / melamina', solid_surface: 'solid surface', cristal: 'cristal', metal: 'metal', piedra: 'piedra' };

/**
 * Lo que Cocrear le entrega al asistente de Costear. Sólo datos técnicos/descriptivos (nada de dinero).
 * @param imagen  {base64, mediaType, dataUrl?, url?} imagen de referencia (opcional)
 */
export function semillaCostearDesdeCocrear(intent, { brief = '', nombre = '', expedienteId = null, imagen = null } = {}) {
  const d = dimsDe(intent?.dimensiones || {});
  const medidas = [d.ancho_mm && `${d.ancho_mm} mm de ancho`, d.prof_mm && `${d.prof_mm} mm de fondo`, d.alto_mm && `${d.alto_mm} mm de alto`].filter(Boolean).join(', ');
  const mats = (intent?.materiales || []).map((m) => `${MAT_TXT[m.material] || m.material}${m.tono ? ` ${m.tono}` : ''}`).filter(Boolean);
  const funciones = (intent?.caracteristicas || []).filter((f) => !FUNCION_SIN_DESPIECE.test(f)).map(etiquetaFuncion);
  const cap = intent?.capacidad_personas || intent?.capacidad?.personas || null;
  const texto = String(brief || intent?._brief || '').trim();
  const partes = [
    texto,
    medidas && `Medidas: ${medidas}.`,
    mats.length && `Materiales: ${mats.join(', ')}.`,
    funciones.length && `Funciones: ${funciones.join(', ')}.`,
    cap && `Capacidad: ${cap} personas.`,
    intent?._concepto_nombre && `Concepto elegido: ${intent._concepto_nombre}.`,
  ].filter(Boolean);
  return {
    origen: 'cocrear',
    expedienteId: expedienteId ?? null,
    nombre: String(nombre || intent?._concepto_nombre || 'Producto co-creado').slice(0, 120),
    descripcion: partes.join(' ').slice(0, 1800),
    medidas: d,
    materiales: mats,
    funciones: (intent?.caracteristicas || []).filter((f) => !FUNCION_SIN_DESPIECE.test(f)),
    dificultad: intent?._dificultad ?? null,
    imagen: imagen && (imagen.base64 || imagen.url) ? { base64: imagen.base64 || null, mediaType: imagen.mediaType || 'image/jpeg', url: imagen.url || null } : null,
  };
}

// Campos técnicos que el BOM de Costear puede traer de regreso (ninguno económico: el costo lo
// recalcula el motor y el servidor; un `precio`/`insumo` inline no regresa).
const CAMPOS_RETORNO = ['insumoId', 'nombre', 'cantidad', 'largoMM', 'anchoMM', 'espesorMM', 'piezas', 'hojas', 'material_solicitado', 'material_match', 'material_confirmado', 'engineering_override', 'override_motivo', 'areaPintadaM2', 'tubular', 'excluida', 'excluida_motivo', 'semantic_role', 'graph_node_id'];

/**
 * Regreso de Costear: el BOM entra a Cocrear como nueva revisión, con procedencia.
 * @param retorno {componentes, dificultad?, nombre?, analysisId?, fuente?}
 */
export function aplicarRetornoCosteo(intent, retorno = {}) {
  const comps = (Array.isArray(retorno?.componentes) ? retorno.componentes : [])
    .filter((c) => c && typeof c === 'object')
    .map((c) => Object.fromEntries(CAMPOS_RETORNO.filter((k) => c[k] != null).map((k) => [k, c[k]])));
  if (!comps.length) return { ok: false, motivo: 'Costear regresó sin despiece: no hay BOM que aplicar.' };
  const { _linaje, ...sinLinaje } = intent || {};
  const next = {
    ...sinLinaje,
    _componentes: comps,
    _puente: {
      tipo: 'costear',
      metodo: 'Despiece del asistente de Costear (análisis IA + confirmaciones + amarre ERP).',
      nombre: retorno.nombre || null,
      analysis_id: retorno.analysisId ?? null,
      medidas: dimsDe(intent?.dimensiones || {}),
      // Lo que se describió al pasar a Costear ya viene dentro del despiece.
      funciones_cubiertas: (intent?.caracteristicas || []).filter((f) => !FUNCION_SIN_DESPIECE.test(f)),
      avisos: [],
    },
  };
  const dif = retorno.dificultad && retorno.dificultad !== 'normal' ? retorno.dificultad : null;
  if (dif) next._dificultad = dif; else delete next._dificultad;
  return { ok: true, intent: next };
}

/**
 * ¿El BOM sigue representando las medidas actuales? Un despiece de Costear es para las medidas que
 * se le describieron: si después cambian, ya no aplica (no se escala en silencio).
 */
export function despieceVigente(intent) {
  const pz = intent?._puente;
  if (!pz || !Array.isArray(intent?._componentes) || !intent._componentes.length) return true;
  if (pz.tipo !== 'costear') return true;
  const d = dimsDe(intent.dimensiones || {});
  return EJES.every((k) => (pz.medidas?.[k] ?? null) === (d[k] ?? null));
}
