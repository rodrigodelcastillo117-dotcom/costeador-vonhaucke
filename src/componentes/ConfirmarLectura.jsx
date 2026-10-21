// ============================================================================
//  CONFIRMAR LA LECTURA DEL PLANO (VH-043, mandato §4: "La IA propone; el usuario
//  confirma la interpretación crítica antes del acomodo definitivo").
//  Antes, la lectura caía directo al estado y al acomodo; una escala mal leída con
//  un layout limpio pasaba sin que nadie la viera. Aquí se enseña lo que se entendió
//  (cuartos, medidas, puestos contados, confianza, problemas, escala) y NADA se usa
//  hasta que la persona diga "sí, así es" o decida corregir / volver a subir.
// ============================================================================
import { useState } from 'react';
import PuertaConfirmar from './PuertaConfirmar.jsx';
import { confirmarPuertaEnArea, puertasSinConfirmar } from '../datos/puertasConfirmar.js';
import { noEsPlanta } from '../datos/noEsPlanta.js';

export default function ConfirmarLectura({ lectura, onConfirmar, onCorregir, onCancelar }) {
  // VH-136: las puertas que la persona confirma aquí (bisagra/sentido/doble) se aplican sobre una
  // copia de las áreas leídas; "Sí, así es" entrega ESA copia. Nada se usa antes de confirmar.
  const [areasEditadas, setAreasEditadas] = useState(null);
  const [confirmadas, setConfirmadas] = useState(0);
  // 2026-10-19 (C4, dos niveles): la persona ELIGE qué nivel se acomoda; antes siempre el primero y el
  // segundo nivel no se podía acomodar nunca. Sólo se enseñan (y se piden puertas de) las áreas de ese nivel.
  const [nivelElegido, setNivelElegido] = useState(null);
  if (!lectura) return null;
  const { resumen = {}, imagen = '', nota = '' } = lectura;
  const areas = areasEditadas || lectura.areas || [];
  const niveles = Array.isArray(resumen.niveles) ? resumen.niveles : [];
  const multinivel = niveles.length > 1;
  const nivel = multinivel ? (niveles.includes(nivelElegido) ? nivelElegido : niveles[0]) : null;
  const enNivel = (a) => !multinivel || !a?.nivel || a.nivel === nivel;
  const visibles = areas.map((a, i) => ({ a, i })).filter(({ a }) => enNivel(a));
  const confirmarPuerta = (areaIdx, idx, d) => {
    const next = areas.map((a, i) => (i === areaIdx ? confirmarPuertaEnArea(a, idx, d) : a));
    setAreasEditadas(next); setConfirmadas((n) => n + 1);
  };
  const sinConfirmar = puertasSinConfirmar(areas).filter((q) => enNivel(areas[q.areaIdx]));
  const noPlanta = noEsPlanta({ ...lectura, areas });
  const nivelTxt = noPlanta ? '✗ Esto no parece un plano de oficina' : { alta: '✓ Lectura confiable', media: '◑ Lectura con dudas', baja: '⚠ Lectura poco confiable', nula: '✗ No reconocí cuartos' }[resumen.nivel] || '';
  const puestos = visibles.reduce((s, { a }) => s + (Number.isFinite(a.puestos) ? a.puestos : 0), 0);
  const puertasPendientes = visibles.map(({ a }) => a).flatMap((a) => (a.puertasPendientes || []).map((pp) => ({ area: a.nombre || 'Área', x: Number(pp.x) || 0, y: Number(pp.y) || 0, ancho: Number(pp.ancho) || null, motivo: pp.motivo })));
  const problemasVisibles = confirmadas ? (resumen.problemas || []).filter((t) => !/puerta/i.test(t)) : (resumen.problemas || []);
  const puedeConfirmar = visibles.length > 0 && !noPlanta;
  return (
    <div className="tarjeta" style={{ marginTop: 12 }} data-testid="confirmar-lectura">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong>Esto fue lo que entendí del plano. ¿Es correcto?</strong>
        <span className="ayuda" style={{ display: 'inline' }} data-testid="lectura-nivel">
          {nivelTxt}{resumen.m2 ? ` · ${resumen.cuartos} cuarto(s), ~${resumen.m2} m²` : ''}{resumen.cotas === false ? ' · sin cotas (medidas estimadas)' : ''}
        </span>
      </div>
      {resumen.servidor && (
        <div className="ayuda" style={{ marginTop: 4 }} data-testid="lectura-servidor" data-estado={resumen.servidor.estado}>
          {resumen.servidor.texto}{resumen.servidor.requestId ? ` · ref. ${resumen.servidor.requestId}` : ''}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: imagen ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr', gap: 10, marginTop: 8 }}>
        {imagen && (
          <div>
            <div className="ayuda" style={{ marginBottom: 4 }}>Tu plano (original)</div>
            <img src={imagen} alt="Plano original subido" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--linea)', display: 'block' }} />
          </div>
        )}
        <div>
          <div className="ayuda" style={{ marginBottom: 4 }}>Lo que entendí{multinivel ? ` en ${nivel}` : ''} ({visibles.length} área{visibles.length === 1 ? '' : 's'}{puestos ? `, ${puestos} puestos contados` : ''})</div>
          <div style={{ display: 'grid', gap: 2 }} data-testid="lectura-areas">
            {visibles.map(({ a, i }) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0', borderBottom: '1px solid var(--linea)' }}>
                <span>{a.nombre || `Área ${i + 1}`}{a.tipo ? <span className="ayuda" style={{ display: 'inline' }}> · {a.tipo}</span> : null}{Number.isFinite(a.puestos) ? <span className="ayuda" style={{ display: 'inline' }}> · {a.puestos} puestos</span> : null}</span>
                <b style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(a.ancho).toFixed(2)}×{Number(a.largo).toFixed(2)} m</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      {(resumen.columnas > 0 || (resumen.niveles || []).length > 1) && (
        <div className="ayuda" style={{ marginTop: 6 }} data-testid="lectura-estructura">
          {resumen.columnas > 0 && <span>{resumen.columnas} columna{resumen.columnas === 1 ? '' : 's'} estructural{resumen.columnas === 1 ? '' : 'es'} leída{resumen.columnas === 1 ? '' : 's'} (no son muebles; el acomodo las respeta). </span>}
          {multinivel && <span>El documento trae {niveles.length} niveles. Se acomoda <strong>uno a la vez</strong>; el otro nivel se cotiza como otro proyecto (sube el mismo plano y elige ese nivel).</span>}
        </div>
      )}
      {multinivel && (
        <div className="fila-botones" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="Nivel a acomodar" data-testid="lectura-niveles">
          <span className="ayuda" style={{ display: 'inline', alignSelf: 'center' }}>Nivel a acomodar:</span>
          {niveles.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={n === nivel} className={n === nivel ? 'boton primario' : 'boton'}
              style={{ minHeight: 40 }} onClick={() => setNivelElegido(n)} data-testid="lectura-nivel-opcion" data-nivel={n}>
              {n} · {areas.filter((a) => a?.nivel === n).length} área(s)
            </button>
          ))}
        </div>
      )}
      {noPlanta && (
        <div className="alerta roja" style={{ marginTop: 8 }} data-testid="lectura-no-planta">
          <span className="texto">Esto no parece un plano de oficina ({noPlanta.motivo}). Sube la planta arquitectónica del cliente o dibuja la oficina. Si lo que quieres es costear este mueble, usa <strong>Costear</strong>.</span>
        </div>
      )}
      {problemasVisibles.length > 0 && (
        <div className="alerta ambar" style={{ marginTop: 8 }} data-testid="lectura-problemas">
          <span className="texto">Revisa esto: {problemasVisibles.join(' · ')}</span>
        </div>
      )}
      {/* VH-097: puertas cuyo sentido de apertura NO se pudo confirmar, UNA por renglón, con su
          cuarto y posición. Confirmar la lectura NO aprueba el barrido: quedan pendientes y el
          acomodo las trata como vano sin bloquear su barrido hasta que alguien lo confirme. */}
      {(puertasPendientes.length > 0 || sinConfirmar.length > 0) && (
        <div className="tarjeta" style={{ marginTop: 8, background: 'var(--panel)' }} data-testid="lectura-puertas-pendientes">
          {sinConfirmar.length > 0 ? (<>
            <strong>Detecté {sinConfirmar.length} puerta{sinConfirmar.length === 1 ? '' : 's'} cuyo sentido de apertura no puedo confirmar. Dime tú cómo abre{sinConfirmar.length === 1 ? '' : 'n'}.</strong>
            <div className="ayuda" style={{ marginTop: 2 }}>Si no lo confirmas, la puerta sigue PENDIENTE (no se inventa bisagra ni sentido) y el acomodo queda en revisión. Un acceso ancho suele ser doble: dos hojas que abren al mismo lado.</div>
            {sinConfirmar.map((q) => (
              <PuertaConfirmar key={`${q.areaIdx}:${q.idx}`} puerta={q.puerta} area={areas[q.areaIdx]}
                onConfirmar={(d) => confirmarPuerta(q.areaIdx, q.idx, d)} />
            ))}
          </>) : (
            <strong>✓ {confirmadas} puerta{confirmadas === 1 ? '' : 's'} confirmada{confirmadas === 1 ? '' : 's'} por ti. Se usa{confirmadas === 1 ? '' : 'n'} al confirmar la lectura.</strong>
          )}
        </div>
      )}
      {!resumen.problemas?.length && nota && <div className="ayuda" style={{ marginTop: 8 }}>{nota}</div>}
      <div className="fila-botones" style={{ gap: 8, marginTop: 12 }}>
        {puedeConfirmar && (
          <button className="boton primario" style={{ minHeight: 44 }} onClick={() => onConfirmar(areasEditadas ? { ...lectura, areas: areasEditadas } : undefined, { nivel })} data-testid="lectura-confirmar">
            Sí, así es: usar esta lectura
          </button>
        )}
        {onCorregir && (
          <button className="boton" style={{ minHeight: 44 }} onClick={onCorregir} data-testid="lectura-corregir">
            No: lo dibujo yo
          </button>
        )}
        <button className="boton fantasma" style={{ minHeight: 44 }} onClick={onCancelar} data-testid="lectura-cancelar">
          Volver a subir el plano
        </button>
      </div>
    </div>
  );
}
