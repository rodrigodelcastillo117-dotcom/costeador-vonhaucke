// ============================================================================
// ACOMODO · ADAPTADOR OPERATIVO
//
// Las sugerencias del plano son SOLO un fallback visual cuando todavía no
// existen partidas comerciales. Nunca se mezclan completas con muebles reales:
// ese bug duplicaba el proyecto (144 piezas) y contaminaba el reparto por cuartos.
//
// Excepción segura: si el plano detecta salas de juntas y la lista comercial
// olvidó una mesa/sillería de junta, se añaden SOLO los faltantes como preview
// SUGERIDO/noCobrar dentro del Acomodo. No alteran la cotización ni el precio.
// ============================================================================
import { useMemo, useRef, useState } from 'react';
import AcomodoBase from './AcomodoBase.jsx';
import {
  partidasSugeridasDeAreas,
  firmaAreasParaSugeridos,
  normalizarAreasPrograma,
} from '../datos/piezasDePrograma.js';
import { marcarDestinoPartida } from '../datos/destinoAcomodo.js';

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

export function elegirPartidasAcomodo(partidas = [], sugeridas = []) {
  const reales = (Array.isArray(partidas) ? partidas : [])
    .filter((p) => !esSugerida(p))
    // La nota de Voni puede orientar el destino, pero el solver operativo sólo
    // recibe piezas REALES de la cotización. Sugerencias del plano nunca se
    // convierten en muebles ni alteran cantidades/ocupación.
    .map(marcarDestinoPartida);
  if (!reales.length) return sugeridas;
  return reales;
}

export default function Acomodo(props) {
  const guardado = props?.estado?.cotizacion?.acomodo || null;
  const partidasEntrada = Array.isArray(props?.estado?.cotizacion?.partidas) ? props.estado.cotizacion.partidas : [];
  const realesEntrada = partidasEntrada.filter((p) => !esSugerida(p));
  const hayReales = realesEntrada.length > 0;

  const areasIniciales = areasMDe(guardado);
  const guardadoNormalizado = guardado ? conAreasNormalizadas(guardado, areasIniciales) : null;
  const sugeridasGuardadas = Array.isArray(guardado?.sugeridosPartidas) ? guardado.sugeridosPartidas : [];
  // P0: si ya existe una lista comercial de Voni, jamás revivimos el autopoblado
  // COMPLETO. Los únicos extras posibles son complementos de juntas calculados
  // al vuelo y no persistidos.
  const sugeridasIniciales = hayReales
    ? []
    : (sugeridasGuardadas.length ? sugeridasGuardadas : partidasSugeridasDeAreas(areasIniciales));

  const [lineaOperativa, setLineaOperativa] = useState('applt');
  const [sugeridas, setSugeridas] = useState(sugeridasIniciales);
  const [acomodoLocal, setAcomodoLocal] = useState(() => {
    if (hayReales) return limpiarSugeridos(guardadoNormalizado);
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
  const realesMarcados = hayReales ? realesEntrada.map(marcarDestinoPartida) : [];
  const complementosJuntas = hayReales ? complementosJuntasVisuales(realesMarcados, sugeridasPlanoActuales) : [];

  const estadoDemo = useMemo(() => {
    const e = props?.estado || {};
    const c = e.cotizacion || {};
    const areasAhora = areasMDe(acomodoLocal || guardadoNormalizado);
    const sugeridasParaLayout = hayReales
      ? partidasSugeridasDeAreas(areasAhora, { linea: lineaOperativa })
      : sugeridas;
    const partidas = elegirPartidasAcomodo(c.partidas, sugeridasParaLayout);
    const acomodo = partidas.some((p) => !esSugerida(p)) ? limpiarSugeridos(acomodoLocal) : acomodoLocal;
    return {
      ...e,
      cotizacion: {
        ...c,
        partidas,
        ...(acomodo ? { acomodo } : {}),
      },
    };
  }, [props?.estado, sugeridas, acomodoLocal, hayReales, lineaOperativa, guardadoNormalizado]);

  const guardarInterceptado = (acomodo, silencioso) => {
    const areas = areasMDe(acomodo);
    const normalizado = conAreasNormalizadas(acomodo, areas);

    // P0: cuando Voni ya armó partidas comerciales, el plano NO añade otro set
    // de benches/sillas/gavetas. Limpia cualquier sugerido histórico y recalcula.
    // Los complementos de juntas son sólo una vista al vuelo; nunca se guardan.
    if (hayReales) {
      setSugeridas([]);
      const limpio = limpiarSugeridos(normalizado);
      setAcomodoLocal(limpio);
      props.onGuardarAcomodo?.(limpio, silencioso);
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

      {hayReales && complementosJuntas.length > 0 && (
        <div className="contenido no-imprimir" style={{ paddingBottom: 0, width: '100%' }}>
          <div className="alerta" style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: '#fff8e6', borderColor: '#d8a800', color: '#5e4700' }}>
            <strong>⚠ La lista comercial dejó incompleta una sala de juntas.</strong>{' '}
            Para no dibujarla vacía, el acomodo añadió {complementosJuntas.reduce((s, p) => s + cantidadDe(p), 0)} pieza(s) sólo como <strong>preview SUGERIDO</strong>. No se cobran ni se agregan a la cotización; sirven para señalar exactamente qué falta confirmar/cotizar.
          </div>
        </div>
      )}

      <AcomodoBase key={`acomodo-demo-${revision}-${hayReales ? 'real' : 'sug'}`} {...props} estado={estadoDemo} onGuardarAcomodo={guardarInterceptado} />
    </>
  );
}
