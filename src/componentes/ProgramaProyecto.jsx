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
import { programaDelPlano, resumenDelPlano } from '../datos/programaDelPlano.js';

// Las líneas que de verdad se ofrecen para cada cosa. No son las 24: son las
// que un proyectista pone en cada tipo de espacio.
const LINEA_OPERATIVOS = [
  { ruta: 'applt', nombre: 'App LT' }, { ruta: 'app', nombre: 'App' },
  { ruta: 'rio', nombre: 'Río' }, { ruta: 'cirque', nombre: 'Cirque' },
  { ruta: 'via', nombre: 'Vía' }, { ruta: 'flex', nombre: 'Flex' },
];
const LINEA_PRIVADOS = [
  { ruta: 'eclipse', nombre: 'Eclipse' }, { ruta: 'alba', nombre: 'Alba' },
  { ruta: 'luna', nombre: 'Luna' }, { ruta: 'drift', nombre: 'Eclipse Drift' },
  { ruta: 'anteo', nombre: 'Anteo' },
];
const SILLA_OPERATIVA = ['WIN', 'WIN-CAB', 'GAMMA-E', 'DEX', 'C4-EM-BNF'];
const SILLA_VISITA = ['CONCERTO', 'DELTA', 'SONATA', 'RE570GT'];

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
    t.push(`${p.operativos} lugares de trabajo en bench de la línea ${p.lineaOperativos} de ${(p.largoPuesto / 1000).toFixed(2)} m por puesto`);
    t.push(`${p.operativos} sillas operativas ${p.sillaOperativa}`);
  }
  if (p.privados > 0) {
    t.push(`${p.privados} oficinas privadas, cada una con escritorio ejecutivo de la línea ${p.lineaPrivados} de ${(p.largoPrivado / 1000).toFixed(2)} m${p.credenza ? ' y su credenza' : ''}`);
    t.push(`${p.privados} sillas directivas y ${p.privados * 2} sillas de visita ${p.sillaVisita}`);
  }
  if (p.juntas > 0) t.push(`una sala de juntas para ${p.juntas} personas con sus ${p.juntas} sillas`);
  if (p.recepcion) t.push('una recepción con su mostrador');
  if (p.guardas > 0) t.push(`${p.guardas} archiveros`);
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
    privados: delPlano.privados, largoPrivado: 2100, credenza: true, lineaPrivados: 'eclipse', sillaVisita: 'CONCERTO',
    juntas: delPlano.juntas, recepcion: delPlano.recepcion, guardas: delPlano.guardas,
  });
  // El aviso se recalcula con el largo que él escoja: si se pasa a 1.80, tiene
  // que enterarse AHÍ de que sus islas ya no dan para 48.
  const avisoLargo = useMemo(
    () => programaDelPlano(areasPlano || [], { largoPuesto: p.largoPuesto }).avisos,
    [areasPlano, p.largoPuesto],
  );
  // Acepta un valor o una función, como `setState`: los ± mandan función.
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: typeof v === 'function' ? v(x[k]) : v }));
  const hay = p.operativos > 0 || p.privados > 0 || p.juntas > 0 || p.recepcion || p.guardas > 0;
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
      {avisoLargo.map((a, i) => <div key={i} className="prog-aviso">⚠ {a}</div>)}

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

      <div className="prog-fila">
        <div className="prog-et"><strong>Archiveros</strong><span>guarda suelta</span></div>
        <Mm v={p.guardas} set={set('guardas')} />
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
