// ============================================================================
//  EL PROGRAMA DEL PROYECTO, CON BOTONES
//
//  Rodrigo dictó el orden: "1 cuántos m² o el plano · 2 cuántos privados y
//  salas de juntas · 3 de cuántos metros cada uno · 4 cuántos operativos y de
//  cuántas personas · 5 las líneas".
//
//  Y una corrección que salió platicándolo: el paso 5 NO es "escoge las
//  líneas" producto por producto. Cuando ya dijiste 5 privados, 1 sala de 12 y
//  90 operativos, **ya dijiste el proyecto entero**: lo que falta son TRES
//  decisiones de estilo —qué línea para operativos, cuál para privados, qué
//  silla— y con eso quedan los 90 puestos. Tres decisiones en vez de noventa.
//
//  ⚠️ ESTO NO ES UN MOTOR NUEVO. Arma la frase y se la entrega a Voni, que es
//  la que ya sabe traducir "5 privados con credenza" a muebles de catálogo con
//  su precio. Escribir sirve cuando ya tienes el correo del cliente para pegar;
//  los botones sirven cuando empiezas de cero, en una junta, en el celular —
//  y además NO TE PUEDEN MALENTENDER, que es lo que un párrafo sí puede.
// ============================================================================
import { useState, useMemo } from 'react';
import { programaDelPlano, resumenDelPlano, avisosDeSala } from '../datos/programaDelPlano.js';

// Las líneas que de verdad se ofrecen para cada cosa. No son las 24: son las
// que un proyectista pone en cada tipo de espacio.
const LINEA_OPERATIVOS = [
  { ruta: 'applt', nombre: 'App LT' }, { ruta: 'app', nombre: 'App' },
  { ruta: 'rio', nombre: 'Río' }, { ruta: 'cirque', nombre: 'Cirque' },
  { ruta: 'via', nombre: 'Vía' }, { ruta: 'flex', nombre: 'Flex' },
];
// 2026-08-19, Rodrigo: agrega App/App LT como opción de escritorio para
// privados — ambas ya tienen producto 'escritorio' real en el catálogo
// (hasta 2.40 m, con faldón y eléctrico), sólo no estaban en esta lista.
const LINEA_PRIVADOS = [
  { ruta: 'applt', nombre: 'App LT' }, { ruta: 'app', nombre: 'App' },
  { ruta: 'eclipse', nombre: 'Eclipse' }, { ruta: 'alba', nombre: 'Alba' },
  { ruta: 'luna', nombre: 'Luna' }, { ruta: 'drift', nombre: 'Eclipse Drift' },
  { ruta: 'anteo', nombre: 'Anteo' },
];
// C4-EM-BNF (sin cabecera) es la que más se vende para operativos (Rodrigo,
// 2026-08-19); C4-EL-BNF-CAB es su misma familia con cabecera — mismo patrón
// que WIN/WIN-CAB, ambas seleccionables aparte.
const SILLA_OPERATIVA = ['WIN', 'WIN-CAB', 'GAMMA-E', 'DEX', 'C4-EM-BNF', 'C4-EL-BNF-CAB'];
const SILLA_VISITA = ['CONCERTO', 'DELTA', 'SONATA', 'RE570GT'];
// ⚠️ 2026-08-18: la frase pedía "sillas directivas" SIN modelo — quien la
// traduce a catálogo no tenía con qué anclar una silla ejecutiva específica y
// caía en una genérica (a veces hasta una operativa de bench). Van del
// catálogo real: 'ALPHA' es "Silla directiva ALPHA" ($11,950); 'ENERGY' es
// "Silla ejecutiva · ENERGY" ($6,480, más económica). NINGUNA es "Gamma": esa
// está catalogada como silla OPERATIVA (de bench), no ejecutiva.
const SILLA_DIRECTIVA = ['ALPHA', 'ENERGY'];
// ⚠️ 2026-08-18: "sus N sillas" de la sala de juntas SIN modelo — la IA podía
// elegir cualquier silla, y el motor de acomodo (`esSillaDeJuntas` en
// planner.js) SOLO reconoce nombres con "junta/consejo/board", que NINGÚN
// modelo del catálogo trae. Sin ese match caía al último recurso
// (PREFERENCIA.silla, que prioriza el open space) y la sala de juntas se
// quedaba sin sillas. El catálogo real tampoco tiene una "silla de junta"
// dedicada — lo que SÍ hay es "silla de visita", y esas SÍ clasifican
// (`esSillaDeVisita`, PREFERENCIA.visita = privado primero, JUNTAS después):
// pedir un modelo de visita explícito para la sala hace que las que sobren de
// los privados caigan ahí en vez de perderse. Mismo catálogo que SILLA_VISITA.
const SILLA_JUNTAS = SILLA_VISITA;

// ⚠️ LA CUENTA SUBE CON FUNCIÓN, NO CON EL VALOR DE ESTE RENDER.
// Con `set(v + 1)`, veinte toques rápidos al + valen UNO: los veinte leen el
// mismo `v` del render viejo porque React no alcanza a repintar entre toque y
// toque. Y "20 operativos" se pican rápido, no despacio. Salió midiendo.
const Mm = ({ v, set, min = 0, paso = 1 }) => (
  <span className="masmenos">
    <button onClick={() => set((x) => Math.max(min, x - paso))} aria-label="Menos">−</button>
    <span className="valor">{v}</span>
    <button onClick={() => set((x) => x + paso)} aria-label="Más">+</button>
  </span>
);

const Chips = ({ ops, valor, set }) => (
  <div className="chips">
    {ops.map((o) => {
      const k = typeof o === 'string' ? o : o.ruta;
      const t = typeof o === 'string' ? o : o.nombre;
      return <button key={k} className={`chip ${valor === k ? 'on' : ''}`} onClick={() => set(k)}>{t}</button>;
    })}
  </div>
);

/** La frase que se le entrega a Voni. Es lo que un vendedor le diría por teléfono. */
export function fraseDe(p) {
  const t = [];
  if (p.operativos > 0) {
    // ⚠️ HAY QUE DECIRLE CÓMO PARTIRLOS (2026-08-17). Con "48 lugares de trabajo"
    // a secas, Voni armó **4 bancas de 12 usuarios de 10.80 m** — y las islas del
    // plano miden 4.50 m: no cabía ninguna y las 8 islas quedaron VACÍAS. El
    // número de puestos no basta; el que manda es el TAMAÑO DE LA ISLA.
    const enIslas = p.islas > 0 && p.porIsla > 0;
    t.push(enIslas
      ? `${p.operativos} lugares de trabajo repartidos en ${p.islas} bancas de ${p.porIsla} usuarios cada una, de la línea ${p.lineaOperativos} de ${(p.largoPuesto / 1000).toFixed(2)} m por puesto`
      : `${p.operativos} lugares de trabajo en bench de la línea ${p.lineaOperativos} de ${(p.largoPuesto / 1000).toFixed(2)} m por puesto`);
    t.push(`${p.operativos} sillas operativas ${p.sillaOperativa}`);
  }
  if (p.privados > 0) {
    t.push(`${p.privados} oficinas privadas, cada una con escritorio ejecutivo de la línea ${p.lineaPrivados} de ${(p.largoPrivado / 1000).toFixed(2)} m${p.credenza ? ' y su credenza' : ''}`);
    t.push(`${p.privados} sillas directivas ${p.sillaDirectiva} y ${p.privados * 2} sillas de visita ${p.sillaVisita}`);
  }
  // ⚠️ UNA MESA POR SALA. Voni no armó NINGUNA mesa de juntas con la frase
  // vieja, y por eso las salas del plano salían vacías: no es que no se
  // dibujaran, es que no existían en la lista. Cuando el plano trae varias
  // salas se piden todas, cada una con su mesa y sus sillas.
  if (p.salas?.length > 1) {
    t.push(`${p.salas.length} salas de juntas (para ${p.salas.join(' y ')} personas), cada una con su mesa de juntas y sus sillas de visita ${p.sillaJuntas}`);
  } else if (p.juntas > 0) {
    t.push(`una sala de juntas para ${p.juntas} personas con su mesa de juntas y sus ${p.juntas} sillas de visita ${p.sillaJuntas}`);
  }
  if (p.recepcion) t.push('una recepción con su mostrador');
  // GAVETAS (pedestal rodante, una por puesto) y ARCHIVEROS (guarda de privado,
  // uno por oficina cerrada) son muebles DISTINTOS. Antes se sumaban en `guardas`
  // y se decían todos como "archiveros" → de ahí salían "9 archiveros" donde el
  // plano tiene 1 privado. Se separan. Compat: un caller viejo que mande sólo
  // `guardas` lo seguimos leyendo como archiveros.
  const gavetas = p.gavetas ?? 0;
  const archiveros = p.archiveros ?? p.guardas ?? 0;
  if (gavetas > 0) t.push(`${gavetas} gavetas rodantes (pedestal)`);
  if (archiveros > 0) t.push(`${archiveros} archiveros`);
  return t.join(', ') + '.';
}

export default function ProgramaProyecto({ onArmar, cargando = false, areasPlano = null }) {
  // ⚠️ EL CUESTIONARIO LLEGABA EN BLANCO AUNQUE HUBIERA PLANO (2026-08-17).
  // Rodrigo: *"yo tuve que poner TODAS LAS CANTIDADES, no tuvo criterio"*. El
  // plano ya dice cuántas islas hay, de qué tamaño, cuántos privados y cuántas
  // salas: se propone y él corrige. Sin plano, todo queda en cero como antes.
  const delPlano = useMemo(
    () => programaDelPlano(areasPlano || [], { largoPuesto: 1500 }),
    [areasPlano],
  );
  const [p, setP] = useState({
    operativos: delPlano.operativos, largoPuesto: 1500, lineaOperativos: 'applt', sillaOperativa: 'WIN',
    privados: delPlano.privados, largoPrivado: 2100, credenza: true, lineaPrivados: 'eclipse',
    sillaDirectiva: 'ALPHA', sillaVisita: 'CONCERTO',
    juntas: delPlano.juntas, sillaJuntas: 'SONATA', recepcion: delPlano.recepcion,
    // Gavetas (pedestal rodante, 1 por puesto) y archiveros (1 por privado) son
    // muebles distintos: el plano los sugiere por separado y aquí se editan aparte.
    gavetas: delPlano.sugeridos?.gavetas ?? 0,
    archiveros: delPlano.sugeridos?.archiveros ?? 0,
    // Del plano, para que la FRASE pueda decir cómo partir los puestos y cuántas
    // salas hay. Sin plano vienen en cero y la frase sale como siempre.
    islas: delPlano.islas, porIsla: delPlano.porIsla, salas: delPlano.salas,
  });
  // El aviso se recalcula con el largo que él escoja: si se pasa a 1.80, tiene
  // que enterarse AHÍ de que sus islas ya no dan para 48.
  const avisoLargo = useMemo(
    () => programaDelPlano(areasPlano || [], { largoPuesto: p.largoPuesto }).avisos,
    [areasPlano, p.largoPuesto],
  );
  // Lo de la sala se recalcula con lo que ÉL pidió: si pone 4 donde caben 8, se
  // le dice — y se le ofrece la credenza que cabe en lo que sobra.
  const avisoSala = useMemo(() => avisosDeSala(delPlano, p.juntas), [delPlano, p.juntas]);
  // Acepta un valor o una función, como `setState`: los ± mandan función.
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: typeof v === 'function' ? v(x[k]) : v }));
  const hay = p.operativos > 0 || p.privados > 0 || p.juntas > 0 || p.recepcion || p.gavetas > 0 || p.archiveros > 0;
  // Los puestos que se van a sentar, para que vea crecer el proyecto.
  const personas = p.operativos + p.privados + p.juntas;

  return (
    <div className="tarjeta programa">
      <h3 style={{ marginTop: 0 }}>Dime qué lleva y yo lo armo</h3>
      <p className="ayuda columna-texto">
        Contesta con los botones. Si prefieres escribirlo —o ya tienes el correo del cliente para
        pegar— usa el recuadro de abajo: es la misma Voni.
      </p>
      {delPlano.hayPlano && (
        <div className="prog-plano">
          <strong>{resumenDelPlano(delPlano)}</strong>
          <span> Ya lo llené con eso; cambia lo que quieras.</span>
        </div>
      )}
      {[...avisoLargo, ...avisoSala].map((a, i) => <div key={i} className="prog-aviso">⚠ {a}</div>)}

      <div className="prog-fila">
        <div className="prog-et"><strong>Operativos</strong><span>puestos en bench</span></div>
        <Mm v={p.operativos} set={set('operativos')} paso={1} />
      </div>
      {p.operativos > 0 && (
        <div className="prog-sub">
          <label className="etiqueta">Largo por puesto</label>
          <Chips ops={['1200', '1500', '1800']} valor={String(p.largoPuesto)} set={(v) => set('largoPuesto')(+v)} />
          <label className="etiqueta">Línea</label>
          <Chips ops={LINEA_OPERATIVOS} valor={p.lineaOperativos} set={set('lineaOperativos')} />
          <label className="etiqueta">Silla</label>
          <Chips ops={SILLA_OPERATIVA} valor={p.sillaOperativa} set={set('sillaOperativa')} />
        </div>
      )}

      <div className="prog-fila">
        <div className="prog-et"><strong>Privados</strong><span>oficinas cerradas</span></div>
        <Mm v={p.privados} set={set('privados')} />
      </div>
      {p.privados > 0 && (
        <div className="prog-sub">
          <label className="etiqueta">Escritorio</label>
          <Chips ops={['1800', '2100', '2400']} valor={String(p.largoPrivado)} set={(v) => set('largoPrivado')(+v)} />
          <label className="etiqueta">Línea</label>
          <Chips ops={LINEA_PRIVADOS} valor={p.lineaPrivados} set={set('lineaPrivados')} />
          <label className="etiqueta">Silla directiva</label>
          <Chips ops={SILLA_DIRECTIVA} valor={p.sillaDirectiva} set={set('sillaDirectiva')} />
          <label className="etiqueta">Silla de visita <span className="gris">· van 2 por privado</span></label>
          <Chips ops={SILLA_VISITA} valor={p.sillaVisita} set={set('sillaVisita')} />
          <label className="chk" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={p.credenza} onChange={(e) => set('credenza')(e.target.checked)} />
            <span>Con credenza</span>
          </label>
        </div>
      )}

      <div className="prog-fila">
        <div className="prog-et"><strong>Sala de juntas</strong><span>para cuántas personas</span></div>
        <Mm v={p.juntas} set={set('juntas')} paso={2} />
      </div>
      {p.juntas > 0 && (
        <div className="prog-sub">
          <label className="etiqueta">Silla</label>
          <Chips ops={SILLA_JUNTAS} valor={p.sillaJuntas} set={set('sillaJuntas')} />
        </div>
      )}

      <div className="prog-fila">
        <div className="prog-et"><strong>Gavetas</strong><span>pedestal rodante · 1 por puesto</span></div>
        <Mm v={p.gavetas} set={set('gavetas')} />
      </div>

      <div className="prog-fila">
        <div className="prog-et"><strong>Archiveros</strong><span>guarda de privado</span></div>
        <Mm v={p.archiveros} set={set('archiveros')} />
      </div>

      <label className="chk" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={p.recepcion} onChange={(e) => set('recepcion')(e.target.checked)} />
        <span>Lleva recepción</span>
      </label>

      {hay && (
        <div className="prog-resumen">
          <b>{personas} persona{personas === 1 ? '' : 's'}</b>
          <span>{fraseDe(p).replace(/\.$/, '')}</span>
        </div>
      )}

      <button className="boton primario grande" style={{ width: '100%', marginTop: 12 }}
        disabled={!hay || cargando} onClick={() => onArmar(fraseDe(p))}>
        {cargando ? 'Armando el proyecto…' : 'Armar el proyecto →'}
      </button>
    </div>
  );
}
