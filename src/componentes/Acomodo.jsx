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
      const nuevas = partidasSugeridasDeAreas(areas);
      firmaRef.current = firma;
      setSugeridas(nuevas);
      if (nuevas.length) {
        // Al cambiar lectura/programa se recalcula desde cero, ahora con semántica:
        // cuarto operativo + isla interna + PAX exactos.
        const siguiente = { ...normalizado, plan: null, sugeridosPartidas: nuevas, demoAutopoblado: true };
        setAcomodoLocal(siguiente);
        setRevision((v) => v + 1);
        props.onGuardarAcomodo?.({ ...normalizado, sugeridosPartidas: nuevas, demoAutopoblado: true }, silencioso);
        return;
      }
    }

    const persistidas = sugeridas.length ? sugeridas : (acomodo?.sugeridosPartidas || []);
    const completo = { ...normalizado, ...(persistidas.length ? { sugeridosPartidas: persistidas, demoAutopoblado: true } : {}) };
    setAcomodoLocal(completo);
    props.onGuardarAcomodo?.(completo, silencioso);
  };

  return (
    <>
      {/* Hotfix visual de demo: la paleta heredaba texto negro sobre tarjeta oscura. */}
      <style>{`
        .paleta-item, .paleta-item .paleta-t { color: #f5f5f7 !important; }
        .paleta-item .ayuda, .paleta-item .gris, .paleta-cab, .paleta-cab .gris { color: #b9bac1 !important; }
        .paleta-item { text-align: left; }
        .paleta-item .paleta-t { font-weight: 700; line-height: 1.25; }
      `}</style>

      {sugeridas.length > 0 && (
        <div className="contenido no-imprimir" style={{ paddingBottom: 0 }}>
          <div className="alerta" style={{ background: '#eef6f3', borderColor: '#8bbcaf', color: '#174f45' }}>
            <span className="texto">
              <strong>✨ Programa sugerido · APP LT:</strong> Voni interpreta PAX, privados, salas, recepción e islas operativas.
              {' '}Un <strong>OPERATIVO / BENCH / ISLA de N PAX</strong> se arma como banca APP LT para N usuarios + N sillas + N gavetas.
              {' '}Todo sigue marcado <strong>SUGERIDO</strong> y <strong>no se cobra</strong> hasta confirmarlo.
            </span>
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
