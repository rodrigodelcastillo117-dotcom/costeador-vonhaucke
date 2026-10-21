// ============================================================================
//  VONI  ·  asistente de proyecto de 3 pasos
//  Muebles → Espacio → Propuesta. Cose las piezas que ya existen (Cotizar con
//  IA, Acomodo, Propuesta al cliente) en un solo flujo guiado, con sello
//  Firme/Estimado por renglón y "no tengo planos" siempre a la mano.
// ============================================================================
import { useMemo, useState, useRef, useEffect } from 'react';
import CotizadorIA from './CotizadorIA.jsx';
import Acomodo from './Acomodo.jsx';
import Cotizacion from './Cotizacion.jsx';
import VoniAvatar from './VoniAvatar.jsx';
import { pesos, selloPartida } from '../util.js';
import EditarPartida from './EditarPartida.jsx';
import EmpezarEspacio from './EmpezarEspacio.jsx';
import ConfirmarLectura from './ConfirmarLectura.jsx';
import { leerPlanoDeArchivo } from '../datos/leerPlanoArchivo.js';
import { areasCanonicas, bloqueGeometria } from '../datos/floorPlan.js';
import { areasDelNivelUsado } from '../datos/planoLeido.js';
import { proponerProgramaDelPlano, aplicarPrograma, claveRecomendacion } from '../datos/programaRealDelPlano.js';
import { reconciliarNuevasConPrograma } from '../datos/reconciliarPartidas.js';
import { requirementsDeBrief } from '../datos/programaBrief.js';
import { mensajePendientePrograma } from '../datos/mensajesPrograma.js';
import Cargando from './Cargando.jsx';
import EstoEntendi from './EstoEntendi.jsx';
import { costoImplicito } from '../datos/preciosVenta.js';
import ConfirmarCandado from './ConfirmarCandado.jsx';

// ⚠️ EL ESPACIO VA PRIMERO (2026-08-17). Antes era: muebles → espacio →
// propuesta, y eso obliga a COTIZAR A CIEGAS: escoges los muebles sin saber
// dónde van y hasta el final descubres si caben. Rodrigo: "nunca preguntó
// planos antes de ponerlos". Preguntando el espacio primero, el paso de muebles
// ya puede decir "con esto vas apretado" MIENTRAS decides, que es cuando sirve.
const PASOS = [
  { n: 1, clave: 'espacio', titulo: 'Espacio', desc: '¿Dónde va el proyecto?' },
  { n: 2, clave: 'muebles', titulo: 'Muebles', desc: '¿Qué lleva?' },
  { n: 3, clave: 'acomodo', titulo: 'Acomodo', desc: 'Dónde va cada cosa.' },
  { n: 4, clave: 'propuesta', titulo: 'Propuesta', desc: 'Lista para el cliente.' },
];

// ⚠️ UN PASO SE PALOMEA SÓLO SI DE VERDAD SE HIZO (2026-08-17). Decía
// `p.n < paso ? 'hecho'`: cualquier paso que quedara atrás salía palomeado.
// Rodrigo subió su plano —que salta al paso 3 para leerlo— y **"Muebles" le
// apareció hecho sin haberle preguntado nada**. Un cartel verde que miente es
// peor que no tenerlo: le dice al proyectista que ya escogió muebles.
function Pasos({ paso, setPaso, puedeAvanzar, hechoPaso }) {
  return (
    <div className="voni-pasos no-imprimir">
      {PASOS.map((p, i) => {
        const hecho = p.n < paso && (hechoPaso ? hechoPaso(p.n) : true);
        const estado = p.n === paso ? 'activo' : hecho ? 'hecho' : 'pend';
        // Solo puedes saltar a un paso ya alcanzado (o al siguiente si hay muebles).
        const habilitado = p.n <= paso || (p.n === paso + 1 && puedeAvanzar);
        return (
          <button
            key={p.n}
            data-testid={`voni-paso-${p.clave}`}
            className={`voni-paso voni-paso-${estado}`}
            disabled={!habilitado}
            onClick={() => habilitado && setPaso(p.n)}
          >
            <span className="voni-paso-num">
              {/* ⚠️ EL SÍMBOLO TAMBIÉN, NO SÓLO EL COLOR. La primera vez sólo se
                  arregló la clase CSS y la palomita seguía dibujándose porque
                  esto miraba `p.n < paso`. Rodrigo la seguía viendo en Muebles. */}
              {hecho
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                : p.n}
            </span>
            <span className="voni-paso-tx">
              <span className="voni-paso-t">{p.titulo}</span>
              <span className="voni-paso-d">{p.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// VH-091 · PANEL DE RESOLUCIÓN por conflicto: la persona ve qué tiene, qué propone el plano,
// medidas, precio de lista, identidad y cuántos dependientes cuelgan, y decide una de TRES
// cosas. Nada se sustituye solo; nada obliga a rehacer el proyecto.
const mm = (w, d) => (Number(w) > 0 && Number(d) > 0 ? `${(w / 1000).toFixed(2)} × ${(d / 1000).toFixed(2)} m` : '—');
const money = (v) => (Number.isFinite(Number(v)) && v != null ? `$${Number(v).toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : 'sin precio de lista');
function ConflictoPrograma({ c, onConservar, onSustituir, onAmbos }) {
  const e = c.existente || {}; const p = c.propuesto || {};
  const filas = [
    ['Producto', e.nombre || e.bancoId || '—', p.nombre || p.bancoId || '—'],
    ['Identidad', e.bancoId ? `${e.bancoId}${e.productoId ? ` · #${e.productoId}` : ''}` : '—', p.bancoId ? `${p.bancoId}${p.productoId ? ` · #${p.productoId}` : ''}` : '—'],
    ['Cantidad', String(e.cantidad ?? 1), String(p.cantidad ?? 1)],
    ['Medidas', mm(e.w, e.d), mm(p.w, p.d)],
    ['Usuarios', e.usuarios ?? '—', p.usuarios ?? '—'],
    ['Precio de lista', money(e.precio), money(p.precio)],
  ];
  return (
    <div className="tarjeta" style={{ marginTop: 8, border: '1px solid #e0b4b4', background: '#fff8f8' }} data-testid="conflicto-programa">
      <div style={{ fontWeight: 700 }}>✗ {etiquetaSlot(c.slot)}: ya tienes un producto en este lugar y el plano propone otro.</div>
      <table style={{ width: '100%', marginTop: 6, fontSize: 14, borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ textAlign: 'left' }}></th><th style={{ textAlign: 'left' }}>Lo que ya tienes</th><th style={{ textAlign: 'left' }}>Lo que propone el plano</th></tr></thead>
        <tbody>{filas.map(([k, a, b]) => <tr key={k}><td style={{ color: '#6b645c', paddingRight: 8 }}>{k}</td><td>{a}</td><td>{b}</td></tr>)}</tbody>
      </table>
      {c.dependientes > 0 && <div className="ayuda" style={{ marginTop: 4 }}>De tu producto actual dependen {c.dependientes} silla(s)/guarda(s) ({c.dependientesFilas} renglón(es)); al sustituirlo se re-atan al propuesto y no se duplican.</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <button type="button" className="boton fantasma" style={{ minHeight: 34 }} onClick={onConservar}>Conservar el mío</button>
        {onSustituir && <button type="button" className="boton primario" style={{ minHeight: 34 }} onClick={onSustituir}>Sustituir por el propuesto</button>}
        {onAmbos && <button type="button" className="boton fantasma" style={{ minHeight: 34 }} onClick={onAmbos}>Mantener ambos (son dos muebles distintos)</button>}
      </div>
    </div>
  );
}

// VH-091: "juntas|ANCHOR_MEETING|#0" → "Mesa de juntas 1" (nunca el id interno en pantalla).
const etiquetaSlot = (slot) => {
  const [rol, rel, ord] = String(slot || '').split('|');
  const base = ({ ANCHOR_MEETING: 'Mesa de juntas', ANCHOR_DESK: 'Escritorio privado', ANCHOR_WORKSTATION: 'Estación operativa', ANCHOR_RECEPTION: 'Recepción' })[rel] || rol || 'Mueble';
  const n = Number(String(ord || '').replace('#', '')) + 1;
  return Number.isFinite(n) && n > 0 ? `${base} ${n}` : base;
};

export default function Voni({
  estado, setEstado, soloVentas = false, veCostos = false,
  onAgregarItems, onGuardarAcomodo, onIr, onAplicarPrograma,
  paso, setPaso,
}) {
  const cot = estado.cotizacion || {};
  const partidas = cot.partidas || [];
  const hay = partidas.length > 0;

  const setCot = (parcial) => setEstado((e) => ({ ...e, cotizacion: { ...e.cotizacion, ...parcial } }));
  // El plano que el proyectista escoge en el PASO 1 viaja al paso 3, donde vive
  // el aparato que sabe leerlo. El `<input type="file">` tiene que estar AQUÍ:
  // el navegador sólo abre el diálogo si el clic salió del dedo, así que no se
  // puede abrir "al llegar" al paso 3.
  const archivoRef = useRef(null);
  const [abrirDibujo, setAbrirDibujo] = useState(false);
  // ⚠️ EL PLANO SE LEE **AQUÍ, EN EL PASO 1** (2026-08-17). Antes el lector sólo
  // existía dentro de `Acomodo` (paso 3), así que subir el PDF te empujaba al 3
  // y el paso 2 se lo saltaba. Rodrigo, tres veces: *"me sigue mandando al paso
  // 3, nunca he llegado al 2"*, *"debería ser paso 1, paso 2, paso 3, paso 4"*.
  // Mi primer intento fue rebotar de regreso desde el 3 con una condición: mala
  // idea, dependía de que el guardado automático disparara. Ahora el paso 1 lo
  // lee solo (`leerPlanoDeArchivo`) y **el 3 ni se toca**.
  const [leyendoPlano, setLeyendoPlano] = useState(false);
  const [errorPlano, setErrorPlano] = useState('');
  const [notaPlano, setNotaPlano] = useState('');

  // VH-043: la lectura NO se usa hasta que la persona la confirme (mandato §4).
  const [lecturaPendiente, setLecturaPendiente] = useState(null);
  async function subirPlanoAqui(file) {
    setErrorPlano(''); setNotaPlano(''); setLecturaPendiente(null); setLeyendoPlano(true);
    const r = await leerPlanoDeArchivo(file);
    setLeyendoPlano(false);
    if (!r.ok) { setErrorPlano(r.error); return; }
    if (!r.areas.length) { if (r.nota) setNotaPlano(r.nota); return; }   // nada reconocido: que lo intente de nuevo
    setLecturaPendiente(r);
  }
  function confirmarLectura(editada) {
    // VH-136: la compuerta puede entregar las áreas con puertas ya confirmadas por la persona.
    const r = (editada && Array.isArray(editada.areas)) ? editada : lecturaPendiente; if (!r) return;
    // Si la persona confirmó las puertas pendientes en la compuerta, los avisos de puerta ya no aplican.
    const puertasConfirmadas = !!(editada && Array.isArray(editada.areas));
    const problemas = (r.resumen?.problemas || []).filter((t) => !(puertasConfirmadas && /puerta/i.test(t)));
    // L1: documento con varias plantas → se usa la primera (las áreas de otros niveles no se mezclan en la misma planta).
    const niveles = Array.isArray(r.resumen?.niveles) ? r.resumen.niveles : [];
    const areasUsadas = areasDelNivelUsado(r.areas, niveles);
    const confirmada = { en: new Date().toISOString(), nivel: r.resumen?.nivel || null, m2: r.resumen?.m2 ?? null,
      cuartos: areasUsadas.length, cotas: r.resumen?.cotas ?? null, problemas,
      ...(niveles.length > 1 ? { nivelUsado: niveles[0], nivelesDocumento: niveles } : {}),
      ...(r.resumen?.columnas ? { columnas: r.resumen.columnas } : {}),
      ...(puertasConfirmadas ? { puertasConfirmadasPorPersona: true } : {}),
      servidor: r.resumen?.servidor || null };   // VH-064: veredicto determinista del servidor
    onGuardarAcomodo?.({ ...bloqueGeometria(areasUsadas), plan: null, planReal: true, lectura: confirmada });
    setLecturaPendiente(null);
    setPaso(2);                          // el siguiente paso es QUÉ LLEVA, no acomodar
  }
  const [confVaciar, setConfVaciar] = useState(false);
  const [editando, setEditando] = useState(null);   // índice de la partida que se edita
  const [confirmarCandado, setConfirmarCandado] = useState(null);   // null | paso destino
  // El paso 2 tiene DOS pantallas: 'describir' (contadores + "o escríbelo/
  // pégalo") y 'revisar' ("Agregué N muebles" + la lista completa editable +
  // preguntas para afinar, todo junto). Un solo "Armar el proyecto" te lleva
  // de una a la otra sola (ver `onListo` en el CotizadorIA de abajo) —
  // Rodrigo probó una versión con "1.1, 1.2… hasta el 7" y la tumbó: "son 7
  // clicks que no valen la pena... debería ser 1 con TODO el mobiliario".
  const [subpaso2, setSubpaso2] = useState('describir');
  const vaciar = () => { setCot({ partidas: [], acomodo: null }); setConfVaciar(false); setSubpaso2('describir'); };

  // Cada pantalla de Voni (cambio de paso, o el sub-paso 2a/2b) empieza
  // ARRIBA. Sin esto, llegar al paso 2 podía abrir donde se había quedado el
  // scroll de la pantalla anterior — mismo patrón que ya usan App.jsx:346 y
  // Cotizacion.jsx:95-96 (window Y el contenedor `.contenido`, por si el
  // navegador está haciendo scroll ahí en vez de en `window`).
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.contenido')?.scrollTo?.(0, 0);
  }, [paso, subpaso2]);

  // El espacio, SIEMPRE en metros. `areasM` es lo normal, pero hay guardados
  // viejos que sólo traen `areas` en milímetros: sin este respaldo, "esto
  // entendí" decía "todavía no me dijiste dónde va el proyecto" con el espacio
  // ya contestado, que es peor que no decir nada.
  // Loader canónico único (floorPlan): areasM (verdad) o legacy mm→m, cuantizado 1 mm.
  const areasDelProyecto = useMemo(() => areasCanonicas(cot.acomodo || {}), [cot.acomodo]);

  // P0.1 (#1/#2/#3): el PROGRAMA PROPUESTO vive en el PASO 2. Resuelve productos
  // reales del plano y se reconcilia contra lo ya cotizado (DELTA): propone sólo
  // lo que falta (p.ej. el bench APP LT) sin re-proponer lo ya presente.
  // El brief estructurado (línea/modelo/dims/accesorios) lo interpreta CotizadorIA
  // y se persiste en cot.programaBrief; aquí se combina con el FloorSpec (#4).
  const reqBrief = requirementsDeBrief(cot.programaBrief);
  const propuestaPrograma = useMemo(
    () => (areasDelProyecto.length
      ? proponerProgramaDelPlano(areasDelProyecto, { linea: (reqBrief && reqBrief.linea) || 'App LT', brief: reqBrief || null })
      : null),
    [areasDelProyecto, cot.programaBrief],
  );
  const reconPrograma = useMemo(
    () => (propuestaPrograma ? aplicarPrograma(propuestaPrograma.propuesta, { existentes: partidas }) : null),
    [propuestaPrograma, partidas],
  );
  // VH-091: conflictos que la persona decidió CONSERVAR (sólo oculta el aviso; nada cambia en la cotización).
  const [conflictosConservados, setConflictosConservados] = useState(() => new Set());
  const faltantesPrograma = reconPrograma ? reconPrograma.confirmacion.confirmadas : [];
  // VH-090: duplicados que ya viven en el proyecto (programa aplicado antes de describir con VONI):
  // se enseñan ANTES de aplicar y se fusionan con el mismo botón.
  const conciliacion = useMemo(() => {
    const prog = partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA');
    const persona = partidas.filter((p) => p.source !== 'CONFIRMADO_PROGRAMA');
    return prog.length && persona.length ? reconciliarNuevasConPrograma(prog, persona) : { sustituidas: [], ambiguas: [] };
  }, [partidas]);
  const duplicadosPrograma = conciliacion.sustituidas;
  // Release gate: equivalencias AMBIGUAS (varias zonas posibles) → la persona decide; nunca se sustituye solo.
  const ambiguasPrograma = conciliacion.ambiguas || [];
  // VH-090: existentes del usuario que cubren el programa y aún no están vinculados (sin instance/anchor).
  const reutilizadosPrograma = reconPrograma
    ? (reconPrograma.confirmacion.enriquecidos || []).filter((e) => { const p = partidas.find((x) => String(x.id) === String(e.id)); return p && !p.instance_id && !p.anchor_instance_id; })
    : [];
  const conflictosPrograma = reconPrograma ? reconPrograma.conflictos : [];


  const pendientesPrograma = propuestaPrograma ? (propuestaPrograma.propuesta.pendientes || []) : [];
  // P1: recomendaciones de casa (visitas, credenzas, silla de recepción) que AÚN no están en la lista: se
  // agregan por línea; nunca solas. Una recomendación cuenta como cubierta si ya hay una partida con el
  // mismo rol atada a la misma ancla.
  const recomendacionesCasa = useMemo(() => {
    const recs = (propuestaPrograma?.propuesta?.recomendaciones || []).filter((r) => r.origen === 'regla_de_casa');
    const cubiertas = new Set(partidas.map((p) => `${p.relation_role}|${p.anchor_instance_id}`));
    return recs.filter((r) => !cubiertas.has(`${r.relation_role}|${r.anchor_instance_id}`));
  }, [propuestaPrograma, partidas]);

  // PILOTO AUTOMÁTICO (Dirección 12-oct: "que la IA haga la mayoría de las cosas"): cuando el plano
  // trae programa y NO hay nada que decidir (sin conflictos abiertos, sin filas ambiguas, sin
  // pendientes de confirmar), el piloto hace solo lo NO aditivo: fusiona duplicados y vincula al
  // plano lo que la persona ya describió. NUNCA agrega productos nuevos al proyecto: lo que falta
  // según el plano se propone con el botón de un click (agregar renglones comerciales es decisión
  // humana; si el piloto los agregara, una cotización de 2 piezas podría volverse de 11).
  // Una sola vez por programa detectado: idempotente, nunca quita nada.
  const pilotoRef = useRef('');
  const [avisoPiloto, setAvisoPiloto] = useState('');
  useEffect(() => {
    if (!propuestaPrograma || typeof onAplicarPrograma !== 'function') return;
    const nFalt = faltantesPrograma.length, nDup = duplicadosPrograma.length, nReu = reutilizadosPrograma.length;
    if (!(nDup || nReu)) return;
    const hayDecision = conflictosPrograma.some((c) => !conflictosConservados.has(c.slot)) || ambiguasPrograma.length > 0 || pendientesPrograma.length > 0;
    if (hayDecision) return;
    // UNA sola aplicación por programa detectado (firma del programa, no de la lista): si tras aplicar
    // quedara algo (p.ej. un duplicado que la conciliación no resolvió), lo decide la persona con el
    // botón; el piloto no vuelve a disparar hasta que se lea otro plano. Evita cualquier bucle.
    const prop = propuestaPrograma.propuesta || {};
    const firma = JSON.stringify([prop.plano_id || prop.id || null, (prop.items || prop.programa || prop.faltantes || []).map((x) => x && (x.id || x.rol || x.requirement_id)).slice(0, 80), JSON.stringify(prop).length]);
    if (pilotoRef.current === firma) return;
    pilotoRef.current = firma;
    onAplicarPrograma(propuestaPrograma.propuesta, { sinNuevas: true });
    setAvisoPiloto(`Piloto automático: ${nDup} duplicado(s) fusionado(s) y ${nReu} renglón(es) vinculado(s) al plano. No quité ni agregué nada${nFalt ? `; el plano pide ${nFalt} producto(s) más: revísalos abajo y agrégalos con un click si van` : ''}.`);
  }, [propuestaPrograma, partidas, faltantesPrograma.length, duplicadosPrograma.length, reutilizadosPrograma.length, conflictosPrograma, conflictosConservados, ambiguasPrograma.length, pendientesPrograma.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // #7: suma SÓLO precios conocidos (null/undefined NO cuenta como 0) y expone
  // cuántos faltan, para no presentar un total incompleto como definitivo.
  const totalLista = useMemo(
    () => partidas.reduce((a, p) => a + (Number.isFinite(Number(p.precioUnitario)) ? Number(p.precioUnitario) * (p.cantidad || 0) : 0), 0),
    [partidas],
  );
  const faltanPrecioVoni = useMemo(
    () => partidas.filter((p) => p.price_status === 'SIN_PRECIO' || p.precioUnitario == null).length,
    [partidas],
  );
  const nEstimados = partidas.filter((p) => selloPartida(p).tipo === 'estimado').length;

  // Candado de cantidad/usuarios (decisión de Rodrigo, 2026-08-20): antes de
  // salir del paso 2, si hay algo que huele al sobrecobro de 12× o a un
  // pedido de más de 14 usuarios, pide confirmación explícita en vez de
  // dejar pasar de largo un aviso que se puede ignorar. Se recalcula contra
  // las `partidas` de AHORA mismo, no algo que se guardó una vez.
  function avanzarConCandado(destino) {
    if (partidas.some((p) => p.candadoUsuarios || p.requiereProyectista)) setConfirmarCandado(destino);
    else setPaso(destino);
  }

  // CotizadorIA agrega renglones; en Voni no navegamos fuera: agregamos y, si el
  // botón fue "agregar y acomodar", saltamos al paso 2.
  const agregarEnProyecto = (items, opts) => onAgregarItems(items, opts);

  return (
    <div className="contenido voni" style={{ maxWidth: 1000 }}>
      <div className="voni-cab no-imprimir">
        <div className="voni-marca">
          <VoniAvatar tam={48} variante="cara" />
          <span className="voni-nombre">Voni</span>
          <span className="voni-tag">tu asistente de proyecto</span>
        </div>
        <div className="voni-proyecto">
          <label className="etiqueta" style={{ margin: 0 }}>Proyecto para</label>
          <input type="text" value={cot.cliente || ''} placeholder="Nombre del cliente"
            onChange={(e) => setCot({ cliente: e.target.value })} style={{ maxWidth: 260 }} />
        </div>
      </div>

      <Pasos paso={paso} setPaso={setPaso} puedeAvanzar={paso === 1 || hay}
        hechoPaso={(n) => (n === 1 ? !!(estado.cotizacion?.acomodo?.areasM?.length || estado.cotizacion?.acomodo?.areas?.length)
          : n === 2 ? hay
            : n === 3 ? !!estado.cotizacion?.acomodo?.plan : true)} />

      {/* ---------------- PASO 1 · ESPACIO ---------------- */}
      {paso === 1 && (
        <>
          <div className="voni-saludo">
            <VoniAvatar tam={64} variante="cara" anim="bob" />
            <p className="voni-globo">
              ¡Hola! Soy <b>Voni</b>. Empecemos por dónde va el proyecto: así, mientras escoges los
              muebles, te voy diciendo si caben.
            </p>
          </div>
          <input
            ref={archivoRef} data-testid="cotizar-plano" type="file" style={{ display: 'none' }}
            accept="image/*,application/pdf,.pdf,.dwg,.dxf"
            onChange={(e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;              // canceló el diálogo: quedarse en el paso 1
              subirPlanoAqui(f);
            }}
          />
          {leyendoPlano && <Cargando voni titulo="Voni está leyendo el plano"
            mensajes={['Midiendo los cuartos…', 'Sacando las áreas…', 'Contando privados y salas…']} />}
          {errorPlano && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{errorPlano}</span></div>}
          {notaPlano && !errorPlano && <div className="tarjeta" style={{ marginTop: 12 }}>{notaPlano}</div>}
          {lecturaPendiente && (
            <ConfirmarLectura lectura={lecturaPendiente}
              onConfirmar={confirmarLectura}
              onCorregir={() => { setLecturaPendiente(null); setAbrirDibujo(true); setPaso(3); }}
              onCancelar={() => { setLecturaPendiente(null); archivoRef.current?.click(); }} />
          )}
          {!lecturaPendiente && <EmpezarEspacio
            piezas={[]}
            subiendo={leyendoPlano}
            onSubirPlano={() => archivoRef.current?.click()}
            onDibujar={() => { setAbrirDibujo(true); setPaso(3); }}
            onListo={(areas) => { onGuardarAcomodo?.({ ...bloqueGeometria(areas), plan: null, planReal: false }); setPaso(2); }}
          />}
          <div className="tarjeta no-imprimir voni-omitir">
            <span className="ayuda">¿Todavía no sabes el espacio?</span>
            <button className="boton fantasma" style={{ minHeight: 42 }} onClick={() => setPaso(2)}>
              Empezar por los muebles →
            </button>
          </div>
        </>
      )}

      {/* --------- PASO 2 · MUEBLES ---------
          UN solo CotizadorIA, siempre montado en el MISMO lugar del árbol
          (nunca se inserta/quita un hermano ANTES de él — eso también
          desmonta por posición). Su prop `pantalla` decide qué dibuja:
          'formulario' (contadores+texto) mientras describes, 'resultado'
          ("Agregué N muebles" + preguntas) en cuanto hay algo que revisar.
          Mismo componente, mismo estado interno (texto, resultado) — nunca
          se pierde nada (Rodrigo: "lo lleno... y lo puso otra vez en cero").
          ⚠️ UN SOLO CLIC (2026-08-19). Antes, terminar de describir mandaba
          por un wizard de "1.1, 1.2… hasta el 7" que Rodrigo no pidió — él
          quiere UNA pantalla con TODO el mobiliario y sillería junto, no
          siete clics. `onListo` (abajo) hace que "Armar el proyecto" te
          lleve derecho ahí, sin un clic de más. */}
      {paso === 2 && (
        <>
          {avisoPiloto && (
            <div className="tarjeta no-imprimir" data-testid="piloto-programa" style={{ borderColor: '#8bbcaf', background: '#eef6f3', color: '#174f45' }}>
              <strong>✨ {avisoPiloto}</strong>
            </div>
          )}
          {propuestaPrograma && (faltantesPrograma.length > 0 || conflictosPrograma.length > 0 || pendientesPrograma.length > 0 || duplicadosPrograma.length > 0 || ambiguasPrograma.length > 0 || recomendacionesCasa.length > 0) && (
            <div className="tarjeta no-imprimir" style={{ borderColor: '#8bbcaf', background: '#eef6f3' }}>
              <strong style={{ color: '#174f45' }}>✨ Programa detectado del plano</strong>
              <p className="ayuda" style={{ marginTop: 4 }}>
                Productos reales del catálogo. Se agrega SÓLO lo que falta (no duplica lo ya cotizado). El precio lo revalida el servidor al emitir.
              </p>
              {faltantesPrograma.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, color: '#174f45' }}>Por agregar</div>
                  {faltantesPrograma.map((p) => (
                    <div key={p.id}>✓ {p.cantidad}× {p.nombre}{p.w ? ` · ${(p.w / 1000).toFixed(2)}×${((p.d || 0) / 1000).toFixed(2)} m` : ''}</div>
                  ))}
                </div>
              )}
              {recomendacionesCasa.length > 0 && (
                <div style={{ marginTop: 8 }} data-testid="recomendaciones-casa">
                  <div style={{ fontWeight: 700, color: '#174f45' }}>Recomendadas por regla de casa (no se agregan solas)</div>
                  {recomendacionesCasa.map((r) => (
                    <div key={claveRecomendacion(r)} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 3 }} data-testid="recomendacion-casa">
                      <span>➕ {r.cantidad}× {r.nombre}{r.zone_id ? ` · ${r.zone_id}` : ''} <span className="ayuda" style={{ display: 'inline' }}>· {r.regla}</span></span>
                      <button type="button" className="boton fantasma" style={{ minHeight: 30 }} disabled={!onAplicarPrograma}
                        onClick={() => onAplicarPrograma?.(propuestaPrograma.propuesta, { incluir: [claveRecomendacion(r)] })}>Agregar</button>
                    </div>
                  ))}
                </div>
              )}
              {duplicadosPrograma.length > 0 && (
                <div style={{ marginTop: 8 }} data-testid="duplicados-programa">
                  <div style={{ fontWeight: 700, color: '#174f45' }}>Ya describiste estos muebles: el programa los tenía con producto genérico y se fusionan (no se duplican)</div>
                  {duplicadosPrograma.map((d, i) => (
                    <div key={i}>⇄ <b>{d.a}</b> sustituye a <span style={{ color: '#6b645c' }}>{d.de}</span>{d.parcial ? <span className="ayuda"> · quedan {d.restante} del programa</span> : null}{d.capacidadDistinta ? <span className="ayuda"> · ojo: el plano pedía {d.capacidadPrograma} usuarios y tu mueble es de {d.capacidadNueva}</span> : null}</div>
                  ))}
                </div>
              )}
              {ambiguasPrograma.length > 0 && (
                <div style={{ marginTop: 8, color: '#8a5a00' }} data-testid="ambiguas-programa">
                  <div style={{ fontWeight: 700 }}>Decide tú: estos muebles podrían cubrir más de un lugar del plano (no se sustituye solo)</div>
                  {ambiguasPrograma.map((a) => (
                    <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 }} data-testid="ambigua-programa" data-id={a.id}>
                      <span>⇄ <b>{a.nombre}</b>{a.cantidad > 1 ? ` ×${a.cantidad}` : ''}{a.zonaActual ? ` (hoy en ${a.zonaActual})` : ''} {a.motivo === 'CANTIDAD_MAYOR_QUE_LUGAR' ? 'tiene más unidades que lugar; ¿mover una a…?' : 'es para:'}</span>
                      {a.opciones.map((o) => (
                        <button key={o.id} type="button" className="boton fantasma" style={{ minHeight: 30 }}
                          onClick={() => onAplicarPrograma?.(propuestaPrograma.propuesta, { decisiones: { [a.id]: o.id } })}>
                          {o.zona || o.nombre}
                        </button>
                      ))}
                      {/* VH-116: repartir una unidad por zona SOLO si la persona lo pide; la cantidad no prueba intención. */}
                      {a.puedeRepartir && (
                        <button type="button" className="boton tinta" style={{ minHeight: 30 }} data-testid="ambigua-repartir"
                          onClick={() => onAplicarPrograma?.(propuestaPrograma.propuesta, { decisiones: { [a.id]: 'repartir' } })}>
                          Repartir: una por {a.motivo === 'CANTIDAD_MAYOR_QUE_LUGAR' ? 'lugar faltante' : 'zona'}
                        </button>
                      )}
                      <span className="ayuda">(o déjalo como está)</span>
                    </div>
                  ))}
                </div>
              )}
              {pendientesPrograma.length > 0 && (
                <div style={{ marginTop: 8, color: '#8a5a00' }}>
                  <div style={{ fontWeight: 700 }}>Pendiente de confirmar (no se sustituye solo)</div>
                  {pendientesPrograma.map((p, i) => (
                    <div key={i} style={{ marginTop: 4 }}>⚠ {mensajePendientePrograma(p)}</div>
                  ))}
                </div>
              )}
              {conflictosPrograma.length > 0 && (
                <div style={{ marginTop: 8, color: '#8a1f1f' }}>
                  <div style={{ fontWeight: 700 }}>Conflicto (decide tú)</div>
                  {conflictosPrograma.filter((c) => !conflictosConservados.has(c.slot)).map((c, i) => (
                    <ConflictoPrograma key={i} c={c}
                      onConservar={() => setConflictosConservados((prev) => new Set([...prev, c.slot]))}
                      onSustituir={onAplicarPrograma ? () => onAplicarPrograma?.(propuestaPrograma.propuesta, { sustituir: [c.slot] }) : null}
                      onAmbos={onAplicarPrograma ? () => onAplicarPrograma?.(propuestaPrograma.propuesta, { mantenerAmbos: [c.slot] }) : null} />
                  ))}
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <button type="button" className="boton primario"
                  disabled={!onAplicarPrograma || (faltantesPrograma.length === 0 && reutilizadosPrograma.length === 0 && duplicadosPrograma.length === 0)}
                  onClick={() => onAplicarPrograma?.(propuestaPrograma.propuesta)}>
                  {faltantesPrograma.length ? 'Aplicar programa detectado' : duplicadosPrograma.length ? `Fusionar ${duplicadosPrograma.length} duplicado(s) con el programa` : 'Vincular lo que ya tengo al plano'}
                </button>
                {reutilizadosPrograma.length > 0 && (
                  <span className="ayuda" style={{ marginLeft: 10 }}>{reutilizadosPrograma.length} mueble(s) que ya describiste cubren el programa: se vinculan a su zona, no se duplican.</span>
                )}
                {conflictosPrograma.length > 0 && (
                  <span style={{ marginLeft: 10, color: '#8a1f1f', fontWeight: 700 }}>Decide cada conflicto arriba; lo demás sí se aplica.</span>
                )}
              </div>
            </div>
          )}
          <div style={{ display: (subpaso2 === 'describir' && !hay) ? undefined : 'none' }}>
            <div className="voni-saludo">
              <VoniAvatar tam={64} variante="cara" anim="bob" />
              <p className="voni-globo">¡Hola! Soy <b>Voni</b>. Cuéntame qué necesita tu cliente —en palabras normales— y te armo el proyecto: muebles, acomodo y propuesta.</p>
            </div>
          </div>

          <CotizadorIA
            estado={estado} onAgregarItems={agregarEnProyecto} onIr={onIr} conPrograma
            pantalla={subpaso2 === 'describir' ? 'formulario' : 'resultado'}
            onListo={() => setSubpaso2('revisar')}
            soloVentas={soloVentas}
          />

          {/* Puente manual, por si vuelves a un proyecto que YA tenía muebles
              (resultado es estado local: no sobrevive a recargar la página) y
              quieres ir directo a revisar sin describir nada nuevo. */}
          {subpaso2 === 'describir' && hay && (
            <div className="tarjeta voni-puente">
              <span className="ayuda">Voni ya armó <strong>{partidas.length}</strong> {partidas.length === 1 ? 'mueble' : 'muebles'} · {faltanPrecioVoni > 0 ? `${pesos(totalLista)} (parcial · faltan ${faltanPrecioVoni} precio${faltanPrecioVoni === 1 ? '' : 's'})` : pesos(totalLista)}</span>
              <button className="boton primario grande" style={{ width: '100%' }} onClick={() => setSubpaso2('revisar')}>
                Revisar lo que entendí ({partidas.length}) →
              </button>
            </div>
          )}

          {subpaso2 === 'revisar' && (
            <button className="boton fantasma btn-atras" style={{ minHeight: 42 }} onClick={() => setSubpaso2('describir')}>
              ‹ Volver a describir o agregar más
            </button>
          )}

          {subpaso2 === 'revisar' && (
          <div className="tarjeta">
            <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Muebles del proyecto {hay && <span className="gris">({partidas.length})</span>}</h3>
              {hay && !confVaciar && <button className="boton fantasma" style={{ minHeight: 44, padding: '0 14px' }} onClick={() => setConfVaciar(true)}>Vaciar</button>}
              {hay && confVaciar && (
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span className="ayuda">¿Vaciar todo?</span>
                  <button className="boton primario" style={{ minHeight: 44, padding: '0 14px' }} onClick={vaciar}>Sí, vaciar</button>
                  <button className="boton fantasma" style={{ minHeight: 44, padding: '0 14px' }} onClick={() => setConfVaciar(false)}>No</button>
                </span>
              )}
            </div>

            {!hay ? (
              <p className="ayuda" style={{ marginTop: 8 }}>
                Ya no hay muebles. <button className="enlace" onClick={() => setSubpaso2('describir')}>Volver a describirle a Voni</button> o agrégalos de línea.
              </p>
            ) : (
              <div className="voni-lista" style={{ marginTop: 10 }}>
                <EstoEntendi
                  partidas={partidas}
                  areasM={areasDelProyecto}
                  onCantidad={(id, n) => setCot({ partidas: partidas.map((p) => (p.id === id ? { ...p, cantidad: Math.max(1, n) } : p)) })}
                  onQuitar={(id) => setCot({ partidas: partidas.filter((p) => p.id !== id) })}
                  onEditar={(id) => setEditando(partidas.findIndex((p) => p.id === id))}
                  onVariante={(id, art) => setCot({ partidas: partidas.map((p) => (p.id === id ? {
                    ...p,
                    precioUnitario: art.lista,
                    costoUnitario: costoImplicito(art.lista),   // que Dirección siga viendo utilidad coherente
                    costoDerivado: true,                        // VH-050: derivado del precio, no medido
                    precioReal: true,
                    catalogo: { clave: art.clave, lista: art.lista, full: art.full, minimo: art.minimo },
                  } : p)) })}
                />
                <hr />
                <div className="fila" style={{ justifyContent: 'flex-end', gap: 20 }}>
                  <span className="ayuda">{faltanPrecioVoni > 0 ? 'Subtotal con precios conocidos' : 'Precio de lista'}</span>
                  <strong className="mono" style={{ fontSize: 18 }}>{pesos(totalLista)}</strong>
                </div>
                {faltanPrecioVoni > 0 && (
                  <div className="alerta ambar" style={{ marginTop: 10 }}>
                    <span className="texto">
                      Faltan <strong>{faltanPrecioVoni}</strong> precio{faltanPrecioVoni === 1 ? '' : 's'}: el total NO está completo hasta resolverlos (el servidor los valida al emitir).
                    </span>
                  </div>
                )}
                {nEstimados > 0 && (
                  <div className="alerta ambar" style={{ marginTop: 10 }}>
                    <span className="texto">
                      <strong>{nEstimados} de {partidas.length}</strong> {nEstimados === 1 ? 'renglón trae precio' : 'renglones traen precio'} <strong>estimado</strong>.
                      Sirve para dar una idea, pero antes de comprometerlo con el cliente pídele a Diseño que lo confirme. El resto es firme.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <button className="boton primario grande" style={{ width: '100%' }} disabled={!hay} onClick={() => avanzarConCandado(3)}>
                Sí, así es — acomódalo →
              </button>
              <button className="boton grande" style={{ width: '100%' }} disabled={!hay} onClick={() => avanzarConCandado(4)} title="Sáltate el acomodo y ve directo a la propuesta">
                No necesito acomodo, ir directo a la propuesta
              </button>
            </div>
          </div>
          )}
        </>
      )}

      {confirmarCandado != null && (
        <ConfirmarCandado
          partidas={partidas}
          onConfirmar={() => { const destino = confirmarCandado; setConfirmarCandado(null); setPaso(destino); }}
          onCancelar={() => setConfirmarCandado(null)}
        />
      )}

      {editando != null && partidas[editando] && (
        <EditarPartida
          estado={estado}
          soloVentas={soloVentas}
          partida={partidas[editando]}
          onCerrar={() => setEditando(null)}
          onGuardar={(nueva) => {
            setCot({ partidas: partidas.map((p, j) => (j === editando ? nueva : p)) });
            setEditando(null);
          }}
        />
      )}

      {/* ---------------- PASO 3 · ACOMODO ---------------- */}
      {paso === 3 && (
        <>
          <div className="tarjeta no-imprimir voni-omitir">
            <span className="ayuda">¿No tienes planos ni medidas del lugar?</span>
            <button className="boton fantasma" style={{ minHeight: 42 }} onClick={() => setPaso(4)}>Omitir el acomodo, ir a la propuesta →</button>
          </div>
          <Acomodo
            estado={estado}
            onGuardarAcomodo={onGuardarAcomodo}
            onAplicarPrograma={onAplicarPrograma}
            onIr={(r) => setPaso(r === 'cotizacion' ? 4 : 2)}
            abrirDibujo={abrirDibujo}
            onConsumido={() => setAbrirDibujo(false)}
            textoSalida="Continuar a la propuesta →"
          />
          {/* VH-114: Rodrigo, 12-oct: "no veo dónde picarle continuar". El paso a la propuesta
              también vive abajo, donde termina de acomodar. */}
          <div className="tarjeta no-imprimir" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="boton primario" style={{ minHeight: 46 }} data-testid="voni-continuar-propuesta" onClick={() => setPaso(4)}>Continuar a la propuesta →</button>
          </div>
        </>
      )}

      {/* ---------------- PASO 4 · PROPUESTA ---------------- */}
      {paso === 4 && (
        <Cotizacion
          estado={estado}
          setEstado={setEstado}
          soloVentas={soloVentas}
          onIr={(r) => setPaso(r === 'acomodo' ? 3 : 4)}
        />
      )}
    </div>
  );
}
