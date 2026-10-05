// ============================================================================
// ACOMODO · ADAPTADOR DEMO CEO
//
// Mantiene intacto el Acomodo productivo en AcomodoBase.jsx y añade una capa
// client-side que, al leer un plano, propone mobiliario visual por zona.
// Las sugerencias NO son partidas comerciales: precio/costo = 0 y van marcadas
// como SUGERIDO. Sirven para que el plano no quede vacío durante la demo.
// ============================================================================
import { useMemo, useRef, useState } from 'react';
import AcomodoBase from './AcomodoBase.jsx';
import { partidasSugeridasDeAreas, firmaAreasParaSugeridos } from '../datos/piezasDePrograma.js';

const esSugerida = (p) => !!p?.sugeridoPlano || String(p?.id || '').startsWith('sug-');

function areasMDe(acomodo) {
  if (Array.isArray(acomodo?.areasM)) return acomodo.areasM;
  // Compatibilidad con guardados legacy que sólo tienen áreas en mm.
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

export default function Acomodo(props) {
  const guardado = props?.estado?.cotizacion?.acomodo || null;
  const areasIniciales = areasMDe(guardado);
  const sugeridasGuardadas = Array.isArray(guardado?.sugeridosPartidas) ? guardado.sugeridosPartidas : [];
  const sugeridasIniciales = sugeridasGuardadas.length ? sugeridasGuardadas : partidasSugeridasDeAreas(areasIniciales);

  const [sugeridas, setSugeridas] = useState(sugeridasIniciales);
  // Si abrimos un plano ya guardado que aún no tenía sugerencias, forzamos una
  // única reconstrucción local para que el motor acomode reales+sugeridas.
  const [acomodoLocal, setAcomodoLocal] = useState(() => (
    sugeridasIniciales.length && !sugeridasGuardadas.length && guardado
      ? { ...guardado, plan: null, sugeridosPartidas: sugeridasIniciales, demoAutopoblado: true }
      : null
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
    const firma = firmaAreasParaSugeridos(areas);

    // Sólo regenerar si cambió realmente la geometría/programa del plano.
    if (areas.length && firma && firma !== firmaRef.current) {
      const nuevas = partidasSugeridasDeAreas(areas);
      firmaRef.current = firma;
      setSugeridas(nuevas);
      if (nuevas.length) {
        // El primer plan se calculó con las partidas que existían ANTES de leer
        // el plano. Remontamos una sola vez, conservando geometría y borrando el
        // plan viejo, para que AcomodoBase corra su planner local con el conjunto
        // reales + sugeridas. No hay llamada a IA ni costo.
        setAcomodoLocal({ ...acomodo, plan: null, sugeridosPartidas: nuevas, demoAutopoblado: true });
        setRevision((v) => v + 1);
        props.onGuardarAcomodo?.({ ...acomodo, sugeridosPartidas: nuevas, demoAutopoblado: true }, silencioso);
        return;
      }
    }

    const persistidas = sugeridas.length ? sugeridas : (acomodo?.sugeridosPartidas || []);
    const completo = { ...acomodo, ...(persistidas.length ? { sugeridosPartidas: persistidas, demoAutopoblado: true } : {}) };
    setAcomodoLocal(completo);
    props.onGuardarAcomodo?.(completo, silencioso);
  };

  return (
    <>
      {sugeridas.length > 0 && (
        <div className="contenido no-imprimir" style={{ paddingBottom: 0 }}>
          <div className="alerta" style={{ background: '#eef6f3', borderColor: '#8bbcaf', color: '#174f45' }}>
            <span className="texto">
              <strong>✨ Programa sugerido:</strong> el plano se puebla automáticamente por zona con mobiliario de referencia.
              {' '}Estas piezas están marcadas como <strong>SUGERIDAS</strong> y <strong>no se cobran</strong> hasta que las sustituyas/confirmes en la cotización.
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
