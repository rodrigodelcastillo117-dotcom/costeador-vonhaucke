// ============================================================================
//  ¿DÓNDE VA A IR ESTO?  ·  lo primero que se pregunta en un proyecto.
//
//  Rodrigo: "que primero REALMENTE sea el plano que quieres; si no hay, que
//  mínimo pregunte cuántos m²". Antes la app se inventaba "Mi espacio 13 ×
//  14.03 m" y acomodaba encima sin preguntar. Un número con dos decimales que
//  nadie escribió es lo que hace que una propuesta se lea como adivinada.
//
//  Tres caminos, en el orden en que valen: el plano REAL, el dibujo, y —sólo si
//  no hay nada— los metros cuadrados. Y los m² se piden como se hablan en una
//  llamada: 50 · 100 · 200 · 400 …, o corriendo la barra, o escribiéndolos.
// ============================================================================
import { useState } from 'react';
import { M2_TIPICOS, M2_MIN, M2_MAX, areasDeM2, totalM2, limpiaM2, ladosDe, m2QueNecesita } from '../datos/espacioNuevo.js';

const PISOS = [
  { v: 0.5, t: 'Medio piso' },
  { v: 1, t: '1 piso' },
  { v: 2, t: '2 pisos' },
  { v: 3, t: '3 pisos' },
  { v: 4, t: '4 pisos' },
];

export default function EmpezarEspacio({ piezas = [], onListo, onSubirPlano, onDibujar, subiendo = false }) {
  const [m2, setM2] = useState(200);
  const [pisos, setPisos] = useState(1);
  const [verM2, setVerM2] = useState(false);

  const total = totalM2(m2, pisos);
  const areas = areasDeM2(m2, pisos);
  const necesita = m2QueNecesita(piezas);
  const lados = ladosDe(pisos <= 0.5 ? m2 / 2 : m2);
  // Aviso, NO bloqueo: es su proyecto y él sabe. Pero decirlo antes de mandar
  // la propuesta vale más que descubrirlo con el cliente enfrente.
  const apretado = piezas.length > 0 && total < necesita;

  return (
    <div className="tarjeta empezar">
      <h2 style={{ marginTop: 0 }}>¿Dónde va a ir esto?</h2>
      <p className="ayuda columna-texto">
        Entre más de verdad sea el espacio, más de verdad es la propuesta.
        {piezas.length > 0 && <> Lo que llevas cotizado pide como <strong>{necesita} m²</strong> para poder caminarse.</>}
      </p>

      <div className="empezar-caminos">
        <button className="boton primario empezar-camino" onClick={onSubirPlano} disabled={subiendo}>
          <b>Subir el plano del cliente</b>
          <span>PDF o foto. Es lo que da el acomodo exacto.</span>
        </button>
        <button className="boton empezar-camino" onClick={onDibujar} disabled={subiendo}>
          <b>Dibujar la oficina</b>
          <span>Si tienes las medidas pero no el archivo.</span>
        </button>
        <button className={`boton empezar-camino ${verM2 ? 'tinta' : ''}`} onClick={() => setVerM2((v) => !v)} disabled={subiendo}>
          <b>Todavía no hay plano</b>
          <span>Dime nada más cuántos metros son.</span>
        </button>
      </div>

      {verM2 && (
        <div className="empezar-m2">
          <h3>¿Cuántos metros cuadrados?</h3>
          <div className="fila-botones" style={{ flexWrap: 'wrap', gap: 8 }}>
            {M2_TIPICOS.map((v) => (
              <button key={v} className={`boton ${m2 === v ? 'primario' : 'fantasma'}`}
                style={{ minHeight: 42 }} onClick={() => setM2(v)}>{v} m²</button>
            ))}
          </div>

          <label className="empezar-barra">
            <input type="range" min={M2_MIN} max={M2_MAX} step={10} value={m2}
              onChange={(e) => setM2(limpiaM2(e.target.value))} aria-label="Metros cuadrados por piso" />
          </label>

          <div className="fila-botones" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label className="ayuda" htmlFor="m2-exacto">O escríbelos:</label>
            <input id="m2-exacto" type="number" inputMode="numeric" min={M2_MIN} max={M2_MAX}
              value={m2} onChange={(e) => setM2(limpiaM2(e.target.value))} style={{ width: 110 }} />
            <span className="ayuda">m² por piso</span>
          </div>

          <h3 style={{ marginTop: 18 }}>¿En cuántos pisos?</h3>
          <div className="fila-botones" style={{ flexWrap: 'wrap', gap: 8 }}>
            {PISOS.map((p) => (
              <button key={p.v} className={`boton ${pisos === p.v ? 'primario' : 'fantasma'}`}
                style={{ minHeight: 42 }} onClick={() => setPisos(p.v)}>{p.t}</button>
            ))}
          </div>
          <p className="ayuda columna-texto" style={{ marginTop: 6 }}>
            Cada piso entra como un espacio aparte, con sus propias medidas y su propio acomodo.
            <strong> Medio piso</strong> es media planta de la torre: el vecino pone el muro, así que
            va como <em>una</em> planta de la mitad.
          </p>

          <div className={`empezar-resumen ${apretado ? 'apretado' : ''}`}>
            <div className="empezar-total">
              <b>{total.toLocaleString('es-MX')} m²</b>
              <span>
                {pisos <= 0.5 ? 'media planta' : pisos === 1 ? 'una planta' : `${Math.round(pisos)} plantas de ${limpiaM2(m2)} m²`}
                {' · '}{lados.ancho} × {lados.largo} m cada una
              </span>
            </div>
            {apretado && (
              <p className="ayuda" style={{ margin: 0 }}>
                ⚠️ Con {total} m² va apretado para lo que llevas cotizado (pide unos {necesita} m²).
                Puedes seguir: lo acomodamos y te decimos qué no cupo.
              </p>
            )}
          </div>

          <button className="boton primario" style={{ minHeight: 48, marginTop: 12 }}
            onClick={() => onListo(areas)}>
            Empezar con {total.toLocaleString('es-MX')} m² →
          </button>
        </div>
      )}
    </div>
  );
}
