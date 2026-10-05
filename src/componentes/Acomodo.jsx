// ============================================================================
// ACOMODO · ADAPTADOR DEMO CEO
//
// Mantiene intacto el Acomodo productivo en AcomodoBase.jsx y añade una capa
// client-side que entiende programa del plano y propone mobiliario visual.
// Las sugerencias NO son partidas comerciales: precio/costo = 0.
// ============================================================================
import { useMemo, useRef, useState } from 'react';
import AcomodoBase from './AcomodoBase.jsx';
import {
  partidasSugeridasDeAreas,
  firmaAreasParaSugeridos,
  normalizarAreasPrograma,
} from '../datos/piezasDePrograma.js';

const esSugerida = (p) => !!p?.sugeridoPlano || String(p?.id || '').startsWith('sug-');

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

export default function Acomodo(props) {
  const guardado = props?.estado?.cotizacion?.acomodo || null;
  const areasIniciales = areasMDe(guardado);
  const guardadoNormalizado = guardado ? conAreasNormalizadas(guardado, areasIniciales) : null;
  const sugeridasGuardadas = Array.isArray(guardado?.sugeridosPartidas) ? guardado.sugeridosPartidas : [];
  const sugeridasIniciales = sugeridasGuardadas.length ? sugeridasGuardadas : partidasSugeridasDeAreas(areasIniciales);

  // Hoy la línea aprobada para el flujo automático es APP LT. Dejamos la
  // pregunta visible para que Voni no "elija" una familia en silencio. Cuando
  // se habiliten otras familias, este selector ya es el punto de extensión.
  const [lineaOperativa, setLineaOperativa] = useState('applt');
  const [sugeridas, setSugeridas] = useState(sugeridasIniciales);
  const [acomodoLocal, setAcomodoLocal] = useState(() => (
    sugeridasIniciales.length && guardadoNormalizado
      ? { ...guardadoNormalizado, plan: sugeridasGuardadas.length ? guardadoNormalizado.plan : null, sugeridosPartidas: sugeridasIniciales, demoAutopoblado: true }
      : guardadoNormalizado
  ));
  const [revision, setRevision] = useState(() => (sugeridasIniciales.length && !sugeridasGuardadas.length ? 1 : 0));
  const firmaRef = useRef(firmaAreasParaSugeridos(areasIniciales));

  const estadoDemo = useMemo(() => {
    const e = props?.estado || {};
    const c = e.cotizacion || {};
    const reales = (c.partidas || []).filter((p) => !esSugerida(p));
    return {
      ...e,
      cotizacion: {
        ...c,
        partidas: [...reales, ...sugeridas],
        ...(acomodoLocal ? { acomodo: acomodoLocal } : {}),
      },
    };
  }, [props?.estado, sugeridas, acomodoLocal]);

  const guardarInterceptado = (acomodo, silencioso) => {
    const areas = areasMDe(acomodo);
    const normalizado = conAreasNormalizadas(acomodo, areas);
    const firma = firmaAreasParaSugeridos(areas);

    if (areas.length && firma && firma !== firmaRef.current) {
      const nuevas = partidasSugeridasDeAreas(areas, { linea: lineaOperativa });
      firmaRef.current = firma;
      setSugeridas(nuevas);
      if (nuevas.length) {
        // Al cambiar lectura/programa se recalcula desde cero, ahora con semántica:
        // cuarto operativo + isla interna + PAX exactos.
        const siguiente = { ...normalizado, plan: null, sugeridosPartidas: nuevas, demoAutopoblado: true, lineaOperativa };
        setAcomodoLocal(siguiente);
        setRevision((v) => v + 1);
        props.onGuardarAcomodo?.({ ...normalizado, sugeridosPartidas: nuevas, demoAutopoblado: true, lineaOperativa }, silencioso);
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
      {/* Guardrails visuales de demo: contraste alto + rótulos de plano discretos. */}
      <style>{`
        .paleta-item, .paleta-item .paleta-t { color: #f5f5f7 !important; }
        .paleta-item .ayuda, .paleta-item .gris, .paleta-cab, .paleta-cab .gris { color: #b9bac1 !important; }
        .paleta-item { text-align: left; }
        .paleta-item .paleta-t { font-weight: 700; line-height: 1.25; }
        svg.plano text[paint-order="stroke"] { font-size: 220px !important; stroke-width: 52px !important; }
      `}</style>

      {sugeridas.length > 0 && (
        <div className="contenido no-imprimir" style={{ paddingBottom: 0 }}>
          <div className="alerta" style={{ background: '#eef6f3', borderColor: '#8bbcaf', color: '#174f45' }}>
            <span className="texto">
              <strong>✨ Voni entendió el programa del plano.</strong>
              {' '}OPERATIVO / BENCH / ISLA de <strong>N PAX</strong> = banca para N usuarios + N sillas + N gavetas; salas de juntas = mesa dimensionada + sus sillas; privados, recepción y servicios se tratan por separado.
              {' '}Todo sigue marcado <strong>SUGERIDO</strong> y <strong>no se cobra</strong> hasta confirmarlo.
            </span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              <strong style={{ color: '#174f45' }}>Voni: ¿qué línea operativa quieres usar?</strong>
              <select
                value={lineaOperativa}
                onChange={(e) => setLineaOperativa(e.target.value)}
                style={{ minHeight: 40, borderRadius: 8, padding: '0 12px', border: '1px solid #8bbcaf', background: '#fff', color: '#174f45', fontWeight: 700 }}>
                <option value="applt">APP LT · 1.50 m por puesto</option>
              </select>
              <span style={{ color: '#356b62' }}>Hoy sólo APP LT está habilitada para que la demo sea determinista.</span>
            </div>
          </div>
        </div>
      )}
      <AcomodoBase
        key={`acomodo-demo-${revision}`}
        {...props}
        estado={estadoDemo}
        onGuardarAcomodo={guardarInterceptado}
      />
    </>
  );
}
