// ============================================================================
//  BANCO DE PRUEBAS del PLANO 3D (dev-only, NO entra al build).
//  Se levanta con `npm run dev` → http://localhost:5175/plano.html
//  Sirve para iterar el isométrico del Acomodo sin pasar por login/Supabase.
// ============================================================================
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';
import './fuentes.css';
import PlanoAcomodo from './componentes/PlanoAcomodo.jsx';
import PropuestaViva from './componentes/PropuestaViva.jsx';
import CosteadorLinea from './componentes/CosteadorLinea.jsx';
import Inicio from './componentes/Inicio.jsx';
import Costeador from './componentes/Costeador.jsx';
import BancoPrecios from './componentes/Banco.jsx';
import { APP_PRODUCTOS, generarApp } from './datos/app.js';
import { APPLT_PRODUCTOS, generarAppLT } from './datos/applt.js';
import { CIRQUE_PRODUCTOS, generarCirque } from './datos/cirque.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './datos/insumos.js';
import { PARAMETROS_DEFAULT } from './motor/calculo.js';

// Escenario realista: la oficina tipo que cotiza Rodrigo (open space + juntas +
// dos privados + recepción), con las huellas REALES que devuelve espacio.js.
const ESCENA = {
  areas: [
    { nombre: 'Open space (48.0 m²)', ancho: 8000, largo: 6000 },
    { nombre: 'Sala de juntas (32.2 m²)', ancho: 7000, largo: 4600 },
    { nombre: 'Privado 1 (15.3 m²)', ancho: 4200, largo: 3630 },
    { nombre: 'Privado 2 (15.3 m²)', ancho: 4200, largo: 3630 },
    { nombre: 'Recepción (10.1 m²)', ancho: 3500, largo: 2900 },
  ],
  byId: {
    e1: { nombre: 'App LT · Banca doble 8 usuarios', w: 4800, d: 1200, tipo: 'escritorio' },
    e2: { nombre: 'App LT · Banca doble 8 usuarios', w: 4800, d: 1200, tipo: 'escritorio' },
    g1: { nombre: 'Modulor · Archivero', w: 900, d: 450, tipo: 'guarda' },
    g2: { nombre: 'Modulor · Archivero', w: 900, d: 450, tipo: 'guarda' },
    g3: { nombre: 'Modulor · Archivero', w: 900, d: 450, tipo: 'guarda' },
    g4: { nombre: 'Modulor · Archivero', w: 900, d: 450, tipo: 'guarda' },
    j1: { nombre: 'Mesa de consejo 12', w: 3600, d: 1400, tipo: 'juntas' },
    s1: { nombre: 'Silla junta', w: 560, d: 560, tipo: 'asiento' },
    s2: { nombre: 'Silla junta', w: 560, d: 560, tipo: 'asiento' },
    d1: { nombre: 'Anteo · Escritorio 2.40', w: 2400, d: 900, tipo: 'escritorio' },
    c1: { nombre: 'Anteo · Credenza', w: 1800, d: 450, tipo: 'guarda' },
    d2: { nombre: 'Eclipse · Escritorio 2.10', w: 2100, d: 900, tipo: 'escritorio' },
    c2: { nombre: 'Eclipse · Credenza', w: 1500, d: 450, tipo: 'guarda' },
    a1: { nombre: 'Worklounge · Sillón', w: 700, d: 700, tipo: 'asiento' },
    a2: { nombre: 'Worklounge · Sillón', w: 700, d: 700, tipo: 'asiento' },
    a3: { nombre: 'Worklounge · Sillón', w: 700, d: 700, tipo: 'asiento' },
    m1: { nombre: 'Pebble · Mesa de apoyo', w: 900, d: 900, tipo: 'mesa' },
    p1: { nombre: 'Privacy 4 · Muro', w: 2400, d: 80, tipo: 'mampara' },
  },
  plan: {
    colocacion: [
      { id: 'e1', area: 0, x: 700, y: 900, rot: 0 },
      { id: 'e2', area: 0, x: 700, y: 3400, rot: 0 },
      { id: 'g1', area: 0, x: 6900, y: 700, rot: 90 },
      { id: 'g2', area: 0, x: 6900, y: 1750, rot: 90 },
      { id: 'g3', area: 0, x: 6900, y: 2800, rot: 90 },
      { id: 'g4', area: 0, x: 6900, y: 3850, rot: 90 },
      { id: 'p1', area: 0, x: 700, y: 2700, rot: 0 },
      { id: 'j1', area: 1, x: 1700, y: 1600, rot: 0 },
      { id: 's1', area: 1, x: 600, y: 600, rot: 0 },
      { id: 's2', area: 1, x: 5900, y: 3500, rot: 0 },
      { id: 'd1', area: 2, x: 500, y: 600, rot: 0 },
      { id: 'c1', area: 2, x: 1400, y: 2900, rot: 0 },
      { id: 'd2', area: 3, x: 600, y: 600, rot: 0 },
      { id: 'c2', area: 3, x: 1500, y: 2900, rot: 0 },
      { id: 'a1', area: 4, x: 400, y: 400, rot: 0 },
      { id: 'a2', area: 4, x: 1400, y: 400, rot: 0 },
      { id: 'a3', area: 4, x: 2400, y: 400, rot: 0 },
      { id: 'm1', area: 4, x: 1300, y: 1600, rot: 0 },
    ],
    zonas: [],
    resumen: 'Banco de pruebas', notas: [],
  },
};

// Escena B: lo que sale cuando el cliente DIBUJA su oficina — coordenadas reales
// (x/y), un cuarto en L y una columna. Es el camino que antes se veía peor.
const DIBUJO = {
  areas: [
    { nombre: 'Open space', x: 0, y: 0, ancho: 9000, largo: 6500, tipo: 'open',
      poly: [[0, 0], [9000, 0], [9000, 4000], [5600, 4000], [5600, 6500], [0, 6500]],
      obstaculos: [{ x: 3000, y: 2600, w: 400, h: 400, tipo: 'columna' }] },
    { nombre: 'Sala de juntas', x: 9130, y: 0, ancho: 5000, largo: 4000, tipo: 'juntas' },
    { nombre: 'Privado', x: 9130, y: 4130, ancho: 3400, largo: 3600, tipo: 'privado' },
    { nombre: 'Recepción', x: 5730, y: 4130, ancho: 3270, largo: 3600, tipo: 'recepcion' },
  ],
  byId: {
    b1: { nombre: 'Banca doble 8 usuarios', w: 4800, d: 1200, tipo: 'escritorio' },
    b2: { nombre: 'Banca doble 8 usuarios', w: 4800, d: 1200, tipo: 'escritorio' },
    ar1: { nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' },
    ar2: { nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' },
    mj: { nombre: 'Mesa de juntas 10', w: 3000, d: 1200, tipo: 'juntas' },
    ex: { nombre: 'Escritorio ejecutivo 2.10', w: 2100, d: 900, tipo: 'escritorio' },
    cr: { nombre: 'Credenza', w: 1500, d: 450, tipo: 'guarda' },
    so1: { nombre: 'Sillón', w: 700, d: 700, tipo: 'asiento' },
    so2: { nombre: 'Sillón', w: 700, d: 700, tipo: 'asiento' },
  },
  plan: {
    colocacion: [
      { id: 'b1', area: 0, x: 600, y: 700, rot: 0 },
      { id: 'b2', area: 0, x: 600, y: 3100, rot: 0 },
      { id: 'ar1', area: 0, x: 7900, y: 700, rot: 90 },
      { id: 'ar2', area: 0, x: 7900, y: 1800, rot: 90 },
      { id: 'mj', area: 1, x: 1000, y: 1400, rot: 0 },
      { id: 'ex', area: 2, x: 500, y: 600, rot: 0 },
      { id: 'cr', area: 2, x: 900, y: 2900, rot: 0 },
      { id: 'so1', area: 3, x: 500, y: 500, rot: 0 },
      { id: 'so2', area: 3, x: 1500, y: 500, rot: 0 },
    ],
    zonas: [], resumen: 'Dibujo', notas: [],
  },
};

function Banco() {
  const [modo, setModo] = useState('iso');
  const [esc, setEsc] = useState('a');
  const E = esc === 'a' ? ESCENA : DIBUJO;
  return (
    <div className="contenido">
      <div className="fila-botones" style={{ gap: 8, margin: '12px 0' }}>
        <button className={`boton ${modo === 'planta' ? 'primario' : 'fantasma'}`} onClick={() => setModo('planta')}>Planta</button>
        <button className={`boton ${modo === 'iso' ? 'primario' : 'fantasma'}`} onClick={() => setModo('iso')}>Vista 3D</button>
        <span style={{ width: 20 }} />
        <button className={`boton ${esc === 'a' ? 'tinta' : 'fantasma'}`} onClick={() => setEsc('a')}>A · áreas escritas</button>
        <button className={`boton ${esc === 'b' ? 'tinta' : 'fantasma'}`} onClick={() => setEsc('b')}>B · plano dibujado (L + columna)</button>
      </div>
      <div className="tarjeta">
        <PlanoAcomodo areas={E.areas} plan={E.plan} byId={E.byId} modo={modo} />
      </div>
    </div>
  );
}

// Banco de pruebas de COTIZAR DE LÍNEA (aquí se reprodujo la pantalla en blanco).
function BancoLinea() {
  const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, cotizacion: { partidas: [] } };
  const [ruta, setRuta] = useState('inicio');
  const [vista, setVista] = useState('linea');
  const REG = { app: [APP_PRODUCTOS, generarApp], applt: [APPLT_PRODUCTOS, generarAppLT], cirque: [CIRQUE_PRODUCTOS, generarCirque] };
  if (ruta !== 'inicio' && REG[ruta]) {
    const [prods, gen] = REG[ruta];
    return <div className="contenido">
      <button className="boton fantasma" onClick={() => setRuta('inicio')}>‹ Atrás</button>
      <CosteadorLinea onIr={() => {}} linea={ruta} soloVentas={false} estado={estado}
        titulo={`Costeador ${ruta}`} productos={prods} generar={gen}
        onAgregar={() => {}} onAgregarModulo={() => {}} />
    </div>;
  }
  return <div className="contenido">
    <Inicio estado={estado} onIr={setRuta} veCostos={true} esDireccion={true} vista={vista} setVista={setVista} />
  </div>;
}

// Banco del COSTEADOR ESPECIAL (aquí se probó la trampa de mm vs metros).
function BancoCosteador() {
  const [costeo, setCosteo] = useState({
    piezaId: null, nombre: 'Prueba de unidades', linea: null, piezas: 1,
    componentes: [{ nombre: 'Cubierta', insumoId: 'chapa-madera', largoMM: 1.5, anchoMM: 0.9, piezas: 1 }],
    modoManoObra: 'porcentaje', horas: {}, factorDirecta: 55, factorIndirecta: 12, margen: 50,
  });
  const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, cotizacion: { partidas: [] } };
  return <div className="contenido">
    <Costeador estado={estado} costeo={costeo} setCosteo={setCosteo} onAgregarCotizacion={() => {}} onGuardarPieza={() => {}} />
  </div>;
}

// Banco de pruebas de la LOCURA: Propuesta Viva (overlay a pantalla completa).
function BancoViva() {
  const [abierto, setAbierto] = useState(true);
  if (!abierto) return <div className="contenido"><button className="boton primario" onClick={() => setAbierto(true)}>Abrir Propuesta Viva</button></div>;
  return <PropuestaViva areas={ESCENA.areas} plan={ESCENA.plan} byId={ESCENA.byId}
    nombre="Corporativo Reforma" cliente="Grupo Reforma" inversion={643247} onCerrar={() => setAbierto(false)} />;
}

// Selector de banco: 3D del acomodo · cotizar de línea · costear especial.
function Bancos() {
  const [cual, setCual] = useState('plano');
  const B = { plano: <Banco />, viva: <BancoViva />, linea: <BancoLinea />, costeador: <BancoCosteador />, banco: <BancoPrecios onAgregar={() => {}} onIr={() => {}} /> };
  return <>
    <div className="contenido"><div className="fila-botones" style={{ gap: 8, margin: '12px 0' }}>
      {[['plano', 'Plano 3D'], ['viva', '✨ Propuesta Viva'], ['linea', 'Cotizar de línea'], ['costeador', 'Costear especial'], ['banco', 'Banco de precios']].map(([k, t]) => (
        <button key={k} className={`boton ${cual === k ? 'tinta' : 'fantasma'}`} onClick={() => setCual(k)}>{t}</button>
      ))}
    </div></div>
    {B[cual]}
  </>;
}

createRoot(document.getElementById('raiz')).render(<Bancos />);
