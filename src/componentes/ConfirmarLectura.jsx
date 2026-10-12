// ============================================================================
//  CONFIRMAR LA LECTURA DEL PLANO (VH-043, mandato §4: "La IA propone; el usuario
//  confirma la interpretación crítica antes del acomodo definitivo").
//  Antes, la lectura caía directo al estado y al acomodo; una escala mal leída con
//  un layout limpio pasaba sin que nadie la viera. Aquí se enseña lo que se entendió
//  (cuartos, medidas, puestos contados, confianza, problemas, escala) y NADA se usa
//  hasta que la persona diga "sí, así es" o decida corregir / volver a subir.
// ============================================================================
export default function ConfirmarLectura({ lectura, onConfirmar, onCorregir, onCancelar }) {
  if (!lectura) return null;
  const { areas = [], resumen = {}, imagen = '', nota = '' } = lectura;
  const nivelTxt = { alta: '✓ Lectura confiable', media: '◑ Lectura con dudas', baja: '⚠ Lectura poco confiable', nula: '✗ No reconocí cuartos' }[resumen.nivel] || '';
  const puestos = areas.reduce((s, a) => s + (Number.isFinite(a.puestos) ? a.puestos : 0), 0);
  const puertasPendientes = areas.flatMap((a) => (a.puertasPendientes || []).map((pp) => ({ area: a.nombre || 'Área', x: Number(pp.x) || 0, y: Number(pp.y) || 0, ancho: Number(pp.ancho) || null, motivo: pp.motivo })));
  const puedeConfirmar = areas.length > 0;
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
          <div className="ayuda" style={{ marginBottom: 4 }}>Lo que entendí ({areas.length} área{areas.length === 1 ? '' : 's'}{puestos ? `, ${puestos} puestos contados` : ''})</div>
          <div style={{ display: 'grid', gap: 2 }} data-testid="lectura-areas">
            {areas.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0', borderBottom: '1px solid var(--linea)' }}>
                <span>{a.nombre || `Área ${i + 1}`}{a.tipo ? <span className="ayuda" style={{ display: 'inline' }}> · {a.tipo}</span> : null}{Number.isFinite(a.puestos) ? <span className="ayuda" style={{ display: 'inline' }}> · {a.puestos} puestos</span> : null}</span>
                <b style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(a.ancho).toFixed(2)}×{Number(a.largo).toFixed(2)} m</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      {resumen.problemas?.length > 0 && (
        <div className="alerta ambar" style={{ marginTop: 8 }} data-testid="lectura-problemas">
          <span className="texto">Revisa esto: {resumen.problemas.join(' · ')}</span>
        </div>
      )}
      {/* VH-097: puertas cuyo sentido de apertura NO se pudo confirmar, UNA por renglón, con su
          cuarto y posición. Confirmar la lectura NO aprueba el barrido: quedan pendientes y el
          acomodo las trata como vano sin bloquear su barrido hasta que alguien lo confirme. */}
      {puertasPendientes.length > 0 && (
        <div className="tarjeta" style={{ marginTop: 8, background: 'var(--panel)' }} data-testid="lectura-puertas-pendientes">
          <strong>Detecté {puertasPendientes.length} puerta{puertasPendientes.length === 1 ? '' : 's'} cuyo sentido de apertura no puedo confirmar.</strong>
          <div className="ayuda" style={{ marginTop: 2 }}>Revisa estas ubicaciones antes de validar el acomodo. Al confirmar la lectura, estas puertas siguen PENDIENTES (no se inventa bisagra ni sentido).</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
            {puertasPendientes.map((pp, i) => (
              <li key={i}>{pp.area} · a {pp.x.toFixed(2)} m, {pp.y.toFixed(2)} m del origen del cuarto{pp.ancho ? ` · vano ${pp.ancho.toFixed(2)} m` : ''} · {pp.motivo === 'ANCHO_PUERTA_DESCONOCIDO' ? 'sin ancho verificable' : 'sin bisagra ni sentido'}</li>
            ))}
          </ul>
        </div>
      )}
      {!resumen.problemas?.length && nota && <div className="ayuda" style={{ marginTop: 8 }}>{nota}</div>}
      <div className="fila-botones" style={{ gap: 8, marginTop: 12 }}>
        {puedeConfirmar && (
          <button className="boton primario" style={{ minHeight: 44 }} onClick={onConfirmar} data-testid="lectura-confirmar">
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
