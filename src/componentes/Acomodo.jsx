// ============================================================================
// ACOMODO · ADAPTADOR OPERATIVO
//
// Las sugerencias del plano son SOLO un fallback visual cuando todavía no
// existen partidas comerciales. Nunca se mezclan completas con muebles reales:
// ese bug duplicaba el proyecto (144 piezas) y contaminaba el reparto por cuartos.
//
// Si el plano detecta una posible carencia del programa comercial, se muestra
// únicamente como AVISO. Nunca se inyecta una pieza sugerida al solver real.
// ============================================================================
import { useMemo, useRef, useState } from 'react';
import AcomodoBase from './AcomodoBase.jsx';
import {
  partidasSugeridasDeAreas,
  firmaAreasParaSugeridos,
  normalizarAreasPrograma,
  completarProgramaVisual,
} from '../datos/piezasDePrograma.js';
import { marcarDestinoPartida } from '../datos/destinoAcomodo.js';
import { expandirPiezas } from '../datos/espacio.js';
import { validarCoherenciaPrograma } from '../datos/coherenciaPrograma.js';

const esSugerida = (p) => !!p?.sugeridoPlano || String(p?.id || '').startsWith('sug-');
const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cantidadDe = (p) => Math.max(1, Math.round(Number(p?.cantidad) || 1));
const textoPartida = (p) => norm(`${p?.nombre || ''} ${p?.nota || ''} ${p?.ruta || ''} ${p?.zonaSugerida || ''} ${p?.piezaId || ''}`);
const esMesaJuntas = (p) => /mesa|table/.test(textoPartida(p)) && /junta|consejo|board|reunion|meeting|vh-dest-mtg/.test(textoPartida(p));
const esSillaJuntas = (p) => /silla|asiento|chair|seat/.test(textoPartida(p)) && /junta|consejo|board|reunion|meeting|vh-dest-mtg/.test(textoPartida(p));
const esSillaVisitaAmbigua = (p) => {
  const t = textoPartida(p);
  if (/vh-dest-(?:mtg|prv|rcp|opn)/.test(t)) return false;
  return /silla|asiento|chair|seat/.test(t) && /visita|espera|confidente|sonata|concerto|delta|re570gt/.test(t);
};

function tomarCantidad(lineas, faltan, sufijo) {
  const out = [];
  let pendiente = Math.max(0, Math.round(faltan || 0));
  for (const p of lineas) {
    if (pendiente <= 0) break;
    const q = Math.min(cantidadDe(p), pendiente);
    out.push({ ...p, id: `${p.id}-${sufijo}-${out.length + 1}`, cantidad: q, previewFaltante: true });
    pendiente -= q;
  }
  return out;
}

// Completa ÚNICAMENTE huecos inequívocos de salas de juntas. Es deliberadamente
// conservador: no rellena open/privados/recepción cuando ya hay partidas reales.
// Si hay sillas de visita ambiguas no inventa más sillas; deja que el destino
// semántico/nota las reparta antes de crear un duplicado visual.
export function complementosJuntasVisuales(realesMarcados = [], sugeridasPlano = []) {
  const objetivoMesas = sugeridasPlano.filter(esMesaJuntas);
  const objetivoSillas = sugeridasPlano.filter(esSillaJuntas);
  if (!objetivoMesas.length && !objetivoSillas.length) return [];

  const mesasObjetivo = objetivoMesas.reduce((s, p) => s + cantidadDe(p), 0);
  const sillasObjetivo = objetivoSillas.reduce((s, p) => s + cantidadDe(p), 0);
  const mesasReales = realesMarcados.filter(esMesaJuntas).reduce((s, p) => s + cantidadDe(p), 0);
  const sillasReales = realesMarcados.filter(esSillaJuntas).reduce((s, p) => s + cantidadDe(p), 0);
  const sillasAmbiguas = realesMarcados.filter(esSillaVisitaAmbigua).reduce((s, p) => s + cantidadDe(p), 0);

  const extras = [];
  if (mesasReales < mesasObjetivo) {
    extras.push(...tomarCantidad(objetivoMesas, mesasObjetivo - mesasReales, 'gap-mesa'));
  }
  if (sillasReales < sillasObjetivo && sillasAmbiguas === 0) {
    extras.push(...tomarCantidad(objetivoSillas, sillasObjetivo - sillasReales, 'gap-silla'));
  }
  return extras;
}

function areasMCrudas(acomodo) {
  if (Array.isArray(acomodo?.areasM)) return acomodo.areasM;
  if (Array.isArray(acomodo?.areas)) {
    return acomodo.areas.map((a) => ({
      ...a,
      ancho: (Number(a?.ancho) || 0) / 1000,
      largo: (Number(a?.largo) || 0) / 1000,
      poly: Array.isArray(a?.poly) ? a.poly.map(([x, y]) => [x / 1000, y / 1000]) : a?.poly,
    }));
  }
  return [];
}

function areasMDe(acomodo) {
  return normalizarAreasPrograma(areasMCrudas(acomodo));
}

function conAreasNormalizadas(acomodo, areas) {
  return { ...acomodo, areasM: areas };
}

function limpiarSugeridos(acomodo) {
  if (!acomodo) return acomodo;
  const teniaSugeridos = !!acomodo.demoAutopoblado || (Array.isArray(acomodo.sugeridosPartidas) && acomodo.sugeridosPartidas.length > 0);
  const { sugeridosPartidas, demoAutopoblado, lineaOperativa, ...resto } = acomodo;
  // Un plan calculado con sugeridos ya no es válido para las partidas reales.
  return teniaSugeridos ? { ...resto, plan: null } : resto;
}

export function sanearAcomodoContraPartidas(acomodo, partidasReales = []) {
  if (!acomodo?.plan) return acomodo;
  const piezas = expandirPiezas(partidasReales);
  const ids = new Set((piezas || []).map((p) => String(p.id)));
  const coloc = Array.isArray(acomodo.plan?.colocacion) ? acomodo.plan.colocacion : [];
  const layoutSpec = acomodo.plan?.layoutSpec || acomodo.layoutSpec || null;
  const tieneAjena = coloc.some((x) => !ids.has(String(x?.id || '')));
  const requested = Number(layoutSpec?.requested);
  const cuentaIncompatible = Number.isFinite(requested) && requested !== ids.size;
  if (!tieneAjena && !cuentaIncompatible) return acomodo;
  const { render3d, escenas, ...rest } = acomodo;
  return {
    ...rest,
    plan: null,
    layoutValidado: false,
    layoutEstado: 'STALE_PROGRAM',
    layoutMotivo: 'El acomodo guardado pertenece a otra lista de muebles; se recalculará con la cotización actual.',
  };
}

export function elegirPartidasAcomodo(partidas = [], sugeridas = []) {
  const reales = (Array.isArray(partidas) ? partidas : [])
    .filter((p) => !esSugerida(p))
    .map(marcarDestinoPartida);
  // En una cotización real, el solver recibe EXCLUSIVAMENTE muebles reales.
  // Las sugerencias del plano son diagnóstico; jamás piezas fantasma.
  if (reales.length) return reales;
  return (Array.isArray(sugeridas) ? sugeridas : []).filter(Boolean);
}

export default function Acomodo(props) {
  const guardado = props?.estado?.cotizacion?.acomodo || null;
  const partidasEntrada = Array.isArray(props?.estado?.cotizacion?.partidas) ? props.estado.cotizacion.partidas : [];
  const realesEntrada = partidasEntrada.filter((p) => !esSugerida(p));
  const hayReales = realesEntrada.length > 0;

  const areasIniciales = areasMDe(guardado);
  const guardadoNormalizadoBase = guardado ? conAreasNormalizadas(guardado, areasIniciales) : null;
  const sugeridasGuardadas = Array.isArray(guardado?.sugeridosPartidas) ? guardado.sugeridosPartidas : [];
  const sugeridasProgramaIniciales = partidasSugeridasDeAreas(areasIniciales, { linea: 'applt' });
  const programaInicial = hayReales
    ? completarProgramaVisual(realesEntrada, sugeridasProgramaIniciales)
    : { partidas: sugeridasGuardadas.length ? sugeridasGuardadas : sugeridasProgramaIniciales, sugerencias: sugeridasGuardadas.length ? sugeridasGuardadas : sugeridasProgramaIniciales };
  const guardadoNormalizado = hayReales
    ? sanearAcomodoContraPartidas(guardadoNormalizadoBase, realesEntrada)
    : guardadoNormalizadoBase;
  const sugeridasIniciales = hayReales
    ? programaInicial.sugerencias
    : (sugeridasGuardadas.length ? sugeridasGuardadas : sugeridasProgramaIniciales);

  const [lineaOperativa, setLineaOperativa] = useState('applt');
  const [sugeridas, setSugeridas] = useState(sugeridasIniciales);
  const [acomodoLocal, setAcomodoLocal] = useState(() => {
    if (hayReales) return guardadoNormalizado;
    return sugeridasIniciales.length && guardadoNormalizado
      ? { ...guardadoNormalizado, plan: sugeridasGuardadas.length ? guardadoNormalizado.plan : null, sugeridosPartidas: sugeridasIniciales, demoAutopoblado: true }
      : guardadoNormalizado;
  });
  const [revision, setRevision] = useState(() => (sugeridasIniciales.length && !sugeridasGuardadas.length ? 1 : 0));
  const firmaRef = useRef(firmaAreasParaSugeridos(areasIniciales));

  const areasActuales = areasMDe(acomodoLocal || guardadoNormalizado);
  const sugeridasPlanoActuales = hayReales
    ? partidasSugeridasDeAreas(areasActuales, { linea: lineaOperativa })
    : sugeridas;
  const programaVisual = hayReales
    ? completarProgramaVisual(realesEntrada, sugeridasPlanoActuales)
    : { reales: [], sugerencias: sugeridasPlanoActuales, partidas: sugeridasPlanoActuales, programaCompleto: false };
  const sugerenciasFaltantes = programaVisual.sugerencias || [];
  const coherenciaPrograma = hayReales ? validarCoherenciaPrograma(realesEntrada) : { ok: true, bloqueos: [] };

  const estadoDemo = useMemo(() => {
    const e = props?.estado || {};
    const c = e.cotizacion || {};
    const areasAhora = areasMDe(acomodoLocal || guardadoNormalizado);
    const sugeridasParaLayout = hayReales
      ? partidasSugeridasDeAreas(areasAhora, { linea: lineaOperativa })
      : sugeridas;
    const partidas = elegirPartidasAcomodo(c.partidas, sugeridasParaLayout);
    // Si faltan anclas comerciales duras, un plan viejo deja de ser evidencia:
    // no lo revivimos visualmente ni reutilizamos su render.
    const acomodo = hayReales && !coherenciaPrograma.ok && acomodoLocal
      ? { ...acomodoLocal, plan: null, render3d: '', layoutValidado: false, layoutEstado: 'PROGRAM_INCOMPLETE' }
      : acomodoLocal;
    return {
      ...e,
      cotizacion: {
        ...c,
        partidas,
        ...(acomodo ? { acomodo } : {}),
      },
    };
  }, [props?.estado, sugeridas, acomodoLocal, hayReales, lineaOperativa, guardadoNormalizado, coherenciaPrograma.ok]);

  const guardarInterceptado = (acomodo, silencioso) => {
    const areas = areasMDe(acomodo);
    const normalizado = conAreasNormalizadas(acomodo, areas);

    // Con partidas comerciales, VONI completa el PROGRAMA VISUAL del plano.
    // Las piezas faltantes viven sólo como metadata SUGERIDA/noCobrar; jamás
    // entran a cotizacion.partidas ni a los totales.
    if (hayReales) {
      const nuevasPrograma = partidasSugeridasDeAreas(areas, { linea: lineaOperativa });
      const programa = completarProgramaVisual(realesEntrada, nuevasPrograma);
      setSugeridas(programa.sugerencias);
      const completo = {
        ...normalizado,
        sugeridosPartidas: programa.sugerencias,
        programaPropuesto: programa.sugerencias.length > 0,
        lineaOperativa,
      };
      setAcomodoLocal(completo);
      props.onGuardarAcomodo?.(completo, silencioso);
      return;
    }

    const firma = firmaAreasParaSugeridos(areas);
    if (areas.length && firma && firma !== firmaRef.current) {
      const nuevas = partidasSugeridasDeAreas(areas, { linea: lineaOperativa });
      firmaRef.current = firma;
      setSugeridas(nuevas);
      if (nuevas.length) {
        const siguiente = { ...normalizado, plan: null, sugeridosPartidas: nuevas, demoAutopoblado: true, lineaOperativa };
        setAcomodoLocal(siguiente);
        setRevision((v) => v + 1);
        props.onGuardarAcomodo?.(siguiente, silencioso);
        return;
      }
    }

    const persistidas = sugeridas.length ? sugeridas : (acomodo?.sugeridosPartidas || []);
    const completo = {
      ...normalizado,
      ...(persistidas.length ? { sugeridosPartidas: persistidas, demoAutopoblado: true, lineaOperativa } : {}),
    };
    setAcomodoLocal(completo);
    props.onGuardarAcomodo?.(completo, silencioso);
  };

  return (
    <>
      <style>{`
        .paleta-item, .paleta-item .paleta-t { color: #f5f5f7 !important; }
        .paleta-item .ayuda, .paleta-item .gris, .paleta-cab, .paleta-cab .gris { color: #b9bac1 !important; }
        .paleta-item { text-align: left; }
        .paleta-item .paleta-t { font-weight: 700; line-height: 1.25; }
        svg.plano text[paint-order="stroke"] { font-size: 220px !important; stroke-width: 52px !important; }
        .masmenos button,
        button[aria-label="sumar"], button[aria-label="restar"],
        button[title="sumar"], button[title="restar"] { color: #f5f5f7 !important; }
      `}</style>

      {!hayReales && sugeridas.length > 0 && (
        <div className="contenido no-imprimir" style={{ paddingBottom: 0, width: '100%' }}>
          <div className="alerta" style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: '#eef6f3', borderColor: '#8bbcaf', color: '#174f45' }}>
            <div style={{ display: 'block', width: '100%', lineHeight: 1.45 }}>
              <strong>✨ Voni entendió el programa del plano.</strong>{' '}
              OPERATIVO / BENCH / ISLA de <strong>N PAX</strong> = banca para N usuarios + N sillas + N gavetas; salas de juntas = mesa dimensionada + sus sillas; privados, recepción y servicios se tratan por separado.{' '}
              Todo sigue marcado <strong>SUGERIDO</strong> y <strong>no se cobra</strong> hasta confirmarlo.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, width: '100%' }}>
              <strong style={{ color: '#174f45' }}>Voni: ¿qué línea operativa quieres usar?</strong>
              <select value={lineaOperativa} onChange={(e) => setLineaOperativa(e.target.value)}
                style={{ minHeight: 40, width: 'min(100%, 480px)', borderRadius: 8, padding: '0 12px', border: '1px solid #8bbcaf', background: '#fff', color: '#174f45', fontWeight: 700 }}>
                <option value="applt">APP LT · 1.50 m por puesto</option>
              </select>
              <span style={{ color: '#356b62' }}>APP LT está fijada para que el acomodo sea determinista.</span>
            </div>
          </div>
        </div>
      )}

      {hayReales && sugerenciasFaltantes.length > 0 && (
        <div className="contenido no-imprimir" style={{ paddingBottom: 0, width: '100%' }}>
          <div className="alerta" style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: '#fff8e6', borderColor: '#d8a800', color: '#5e4700' }}>
            <strong>✨ VONI detectó posibles faltantes del programa.</strong>{' '}
            Propuso <strong>{sugerenciasFaltantes.reduce((s, p) => s + cantidadDe(p), 0)} pieza(s)</strong> que todavía no están cotizadas.
            <strong>No se meten al acomodo real.</strong> Siguen <strong>SUGERIDAS · NO COTIZADAS</strong> hasta que alguien las confirme/agregue.
            <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
              {sugerenciasFaltantes.slice(0, 8).map((p) => (
                <div key={p.id}>• {p.cantidad}× {p.nombre}{p.zonaSugerida ? ' → ' + p.zonaSugerida : ''}</div>
              ))}
              {sugerenciasFaltantes.length > 8 && <div>• +{sugerenciasFaltantes.length - 8} renglón(es) sugeridos</div>}
            </div>
            <div style={{ marginTop: 8 }}>El acomodo real usa únicamente lo cotizado. Si falta un ancla funcional, se bloquea y te dice exactamente qué agregar.</div>
          </div>
        </div>
      )}

      <AcomodoBase key={`acomodo-demo-${revision}-${hayReales ? 'real' : 'sug'}`} {...props} estado={estadoDemo}
        pendientesPrograma={sugerenciasFaltantes}
        bloqueosPrograma={coherenciaPrograma.bloqueos}
        onGuardarAcomodo={guardarInterceptado} />
    </>
  );
}
