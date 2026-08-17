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
import { M2_TIPICOS, M2_MIN, M2_MAX, areasDeM2, totalM2, limpiaM2, ladosDe, m2QueNecesita, cuartosDePrograma, M2_PRIVADO, m2Juntas } from '../datos/espacioNuevo.js';

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
  // ⚠️ LOS CUARTOS VAN AQUÍ, NO EN "MUEBLES". Rodrigo: "¿espacio incluye
  // cuántos privados, cuántas salas de juntas?". Sí: un privado ES UN CUARTO
  // —tiene muros y metros—; un operativo es una PERSONA. Y si subes el plano
  // real, los privados vienen del plano, no los tecleas: prueba de que es
  // información del espacio.
  // Hasta hoy "400 m²" creaba UN rectángulo, y por eso el 3D se veía como
  // bodega. Con cuartos de verdad el acomodo tiene dónde repartir, las reglas
  // de oficio funcionan y el render tiene cuartos que fotografiar.
  const [privados, setPrivados] = useState(0);
  const [m2Privado, setM2Privado] = useState(M2_PRIVADO);
  const [juntas, setJuntas] = useState(0);
  const [paxJuntas, setPaxJuntas] = useState(12);
  const [recepcion, setRecepcion] = useState(false);
  const [breakRoom, setBreakRoom] = useState(false);

  const total = totalM2(m2, pisos);
  const prog = { m2: pisos <= 0.5 ? m2 / 2 : m2, privados, m2Privado, juntas, paxJuntas, recepcion, breakRoom };
  const hayCuartos = privados > 0 || juntas > 0 || recepcion || breakRoom;
  const { areas: cuartos, openM2, cerradoM2 } = cuartosDePrograma(prog);
  // Con cuartos, cada piso lleva su propio juego; sin cuartos, la planta sola.
  const areas = hayCuartos
    ? (pisos <= 0.5 || pisos === 1
      ? cuartos
      : Array.from({ length: Math.round(pisos) }, (_, i) =>
        cuartos.map((a) => ({ ...a, nombre: `P${i + 1} · ${a.nombre}`, nivel: i }))).flat())
    : areasDeM2(m2, pisos);
  // Los canceles que van a pedir esos privados. Se calcula el PERÍMETRO que
  // hay que cerrar: en esquina, dos lados los pone el edificio.
  const mCancel = privados > 0
    ? Math.round(privados * (ladosDe(m2Privado).ancho + ladosDe(m2Privado).largo))
    : 0;
  const necesita = m2QueNecesita(piezas);
  const lados = ladosDe(pisos <= 0.5 ? m2 / 2 : m2);
  // Avisos, NO bloqueos: es su proyecto y él sabe. Pero decirlo antes de mandar
  // la propuesta vale más que descubrirlo con el cliente enfrente.
  const apretado = piezas.length > 0 && total < necesita;
  // Y el aviso al revés, que es el que faltaba: con 1,200 m² para lo que ocupa
  // 93, los pisos salen vacíos en el 3D y parece que la app falló. No falló —
  // sobra espacio— pero eso hay que decirlo ANTES, no dejar que lo descubra
  // viendo tres plantas desiertas.
  const sobrado = piezas.length > 0 && total > necesita * 2.5;

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

          <h3 style={{ marginTop: 18 }}>¿Cómo se reparte?</h3>
          <p className="ayuda columna-texto" style={{ marginTop: 0 }}>
            Los cuartos cerrados van aquí porque <strong>son parte del espacio</strong>: tienen muros
            y metros. Los operativos van en el paso de muebles — son personas, no cuartos.
          </p>
          <div className="prog-fila">
            <div className="prog-et"><strong>Privados</strong><span>oficinas cerradas</span></div>
            <span className="masmenos">
              <button onClick={() => setPrivados((x) => Math.max(0, x - 1))} aria-label="Menos">−</button>
              <span className="valor">{privados}</span>
              <button onClick={() => setPrivados((x) => x + 1)} aria-label="Más">+</button>
            </span>
          </div>
          {privados > 0 && (
            <div className="prog-sub">
              <label className="etiqueta">Cada privado, de</label>
              <div className="chips">
                {[9, 12, 16, 20, 25].map((v) => (
                  <button key={v} className={`chip ${m2Privado === v ? 'on' : ''}`} onClick={() => setM2Privado(v)}>{v} m²</button>
                ))}
              </div>
            </div>
          )}
          <div className="prog-fila">
            <div className="prog-et"><strong>Salas de juntas</strong><span>{juntas > 0 ? `de ${paxJuntas} personas · ${m2Juntas(paxJuntas)} m² cada una` : 'cuántas'}</span></div>
            <span className="masmenos">
              <button onClick={() => setJuntas((x) => Math.max(0, x - 1))} aria-label="Menos">−</button>
              <span className="valor">{juntas}</span>
              <button onClick={() => setJuntas((x) => x + 1)} aria-label="Más">+</button>
            </span>
          </div>
          {juntas > 0 && (
            <div className="prog-sub">
              <label className="etiqueta">Para cuántas personas</label>
              <div className="chips">
                {[6, 8, 10, 12, 16, 20].map((v) => (
                  <button key={v} className={`chip ${paxJuntas === v ? 'on' : ''}`} onClick={() => setPaxJuntas(v)}>{v}</button>
                ))}
              </div>
            </div>
          )}
          <label className="chk"><input type="checkbox" checked={recepcion} onChange={(e) => setRecepcion(e.target.checked)} /><span>Recepción</span></label>
          <label className="chk"><input type="checkbox" checked={breakRoom} onChange={(e) => setBreakRoom(e.target.checked)} /><span>Break room</span></label>

          {hayCuartos && (
            <div className="cuartos-lista">
              {cuartos.map((a, i) => (
                <span className="cuarto-chip" key={i}>{a.nombre.replace(/\s*\([^)]*\)/, '')} <em>{a.m2} m²</em></span>
              ))}
            </div>
          )}
          {hayCuartos && openM2 < 6 && (
            <div className="alerta ambar" style={{ marginTop: 8 }}><span className="texto">
              Los cuartos cerrados se llevan {cerradoM2} m² de los {limpiaM2(pisos <= 0.5 ? m2 / 2 : m2)} m²
              de la planta: <strong>no queda open space</strong>. Sube los metros o baja los cuartos.
            </span></div>
          )}

          {/* ⚠️ EL CANCEL SE PROPONE, NUNCA SE AGREGA SOLO. La cancelería la
              decide el cliente —a veces ya tiene los muros, a veces son de
              tabla-roca— y meterla sin preguntar infla la propuesta.
              Y el precio NO se inventa: Rodrigo confirmó que WAND SE HACE A LA
              MEDIDA, así que no hay $/m fijo. Lo que sí es firme del presupuesto
              226050048 es la PUERTA: 1000 × 2400 × 60 mm con cerradura,
              $12,680. El paño se cotiza por proyecto. */}
          {mCancel > 0 && (
            <div className="cancel-aviso">
              <strong>Esos {privados} privados necesitan muros.</strong>
              <span>
                Son unos <b>{mCancel} m lineales</b> de cancel, altura 2.40 m. En cancelería
                <b> WAND</b> —cristal templado con estructura metálica negra— más <b>{privados} puertas</b> con
                cerradura a <b>$12,680</b> c/u.
              </span>
              <span className="ayuda">
                El paño <strong>se hace a la medida</strong>, así que su precio se cotiza por proyecto:
                pídeselo a Miguel y se agrega como partida. Las puertas sí tienen precio firme.
              </span>
            </div>
          )}

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
            {sobrado && (
              <p className="ayuda" style={{ margin: 0 }}>
                Con {total.toLocaleString('es-MX')} m² <strong>te va a sobrar espacio</strong>: lo que
                llevas cotizado ocupa unos {necesita} m². Se va a ver bastante piso vacío en el 3D —
                que está bien si el cliente va a crecer, y si no, quizá falta cotizar.
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
