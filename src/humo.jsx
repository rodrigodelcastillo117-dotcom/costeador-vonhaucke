// ============================================================================
//  PRUEBA DE HUMO — renderiza TODAS las pantallas de la app de un jalón.
//  Dev-only, no entra al build.  →  http://localhost:5173/humo.html
//
//  Existe porque el 2026-08-15 tres pantallas completas estuvieron muertas y ni
//  el build ni las pruebas del motor lo vieron: sólo truena al renderizar. Aquí
//  cada pantalla se monta dentro de su propia red, así que una que falle NO
//  tumba a las demás y se ve exactamente cuál y por qué.
//
//  El recuadro de arriba dice cuántas montaron y cuántas fallaron. Verde = se
//  puede publicar.
// ============================================================================
import { useState, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';
import './fuentes.css';

import { INSUMOS_SEMILLA, mapaInsumos } from './datos/insumos.js';
import { PARAMETROS_DEFAULT } from './motor/calculo.js';
import { LINEAS_REG } from './datos/lineas.js';

import Inicio from './componentes/Inicio.jsx';
import Asistente from './componentes/Asistente.jsx';
import AsistenteEspecial from './componentes/AsistenteEspecial.jsx';
import Banco from './componentes/Banco.jsx';
import Catalogo from './componentes/Catalogo.jsx';
import Costeador from './componentes/Costeador.jsx';
import CosteadorLinea from './componentes/CosteadorLinea.jsx';
import Cotizacion from './componentes/Cotizacion.jsx';
import CotizadorIA from './componentes/CotizadorIA.jsx';
import Voni from './componentes/Voni.jsx';
import Acomodo from './componentes/Acomodo.jsx';
import DibujarPlano from './componentes/DibujarPlano.jsx';
import EditarPartida from './componentes/EditarPartida.jsx';
import Guia from './componentes/Guia.jsx';
import Precios from './componentes/Precios.jsx';
import Tablero from './componentes/Tablero.jsx';
import Usuarios from './componentes/Usuarios.jsx';
import Reglas from './componentes/Reglas.jsx';
import Login from './componentes/Login.jsx';
import CambiarContrasena from './componentes/CambiarContrasena.jsx';
import FichaPDF from './componentes/FichaPDF.jsx';
import InformeIA from './componentes/InformeIA.jsx';
import MiniRender from './componentes/MiniRender.jsx';

const nada = () => {};
const insumos = mapaInsumos(INSUMOS_SEMILLA);
// Cotización REAL: la que produjo Voni con un pedido de oficina completo
// ("20 lugares en bench, 2 ejecutivos, sala de juntas para 12, 6 archiveros,
// 4 sillones") y costeada por el motor. Probar con una sola partida escondía
// todo lo que se rompe cuando la propuesta tiene renglones de verdad.
const PARTIDAS = [
 {
  "id": "p1",
  "piezaId": "linea-banca_doble",
  "nombre": "Banca doble APP LT 1.50 · 10 usuarios · ocupa 7.50 × 1.20 m",
  "ruta": "applt",
  "productoId": "banca_doble",
  "w": 7500,
  "d": 1200,
  "cantidad": 2,
  "costoUnitario": 19185,
  "precioUnitario": 41439,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "banca_doble",
   "largoMM": 1500,
   "fondoMM": 1200,
   "usuarios": 10,
   "biombo": "melamina",
   "finish": "ABS",
   "electrico": false
  }
 },
 {
  "id": "p2",
  "piezaId": "linea-escritorio",
  "nombre": "Eclipse Escritorio Directivo 2.10 m · mano Derecha",
  "ruta": "eclipse",
  "productoId": "escritorio",
  "w": 2100,
  "d": 900,
  "cantidad": 2,
  "costoUnitario": 12566,
  "precioUnitario": 25132,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "escritorio",
   "largoMM": 2100,
   "finish": "chapa",
   "mano": "D",
   "electrico": false
  }
 },
 {
  "id": "p3",
  "piezaId": "linea-credenza",
  "nombre": "Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha",
  "ruta": "eclipse",
  "productoId": "credenza",
  "w": 2100,
  "d": 600,
  "cantidad": 2,
  "costoUnitario": 9682,
  "precioUnitario": 19364,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "credenza",
   "largoMM": 2100,
   "fondoMM": 600,
   "finish": "chapa",
   "mano": "D",
   "electrico": false
  }
 },
 {
  "id": "p4",
  "piezaId": "linea-mesa_juntas",
  "nombre": "Alba · Mesa de juntas 3.60 m · Melamina ABS",
  "ruta": "alba",
  "productoId": "mesa_juntas",
  "w": 3600,
  "d": 1200,
  "cantidad": 1,
  "costoUnitario": 10216,
  "precioUnitario": 20432,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "mesa_juntas",
   "finish": "ABS",
   "largo": "3600",
   "electrico": true
  }
 },
 {
  "id": "p5",
  "piezaId": "linea-archivero_h",
  "nombre": "Modulor · Archivero horizontal 0.75 2 cajones · Melamina y canto ABS",
  "ruta": "modulor",
  "productoId": "archivero_h",
  "w": 750,
  "d": 476,
  "cantidad": 6,
  "costoUnitario": 1481,
  "precioUnitario": 2962,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "archivero_h",
   "finish": "ABS",
   "modelo": "cajones75",
   "cerradura": true,
   "cojin": false
  }
 },
 {
  "id": "p6",
  "piezaId": "linea-sillon",
  "nombre": "Sillón Pac 1 plaza (0.60×0.60 m) · tela",
  "ruta": "pac",
  "productoId": "sillon",
  "w": 0,
  "d": 0,
  "cantidad": 4,
  "costoUnitario": 2253,
  "precioUnitario": 4507,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "sillon",
   "finish": "tela",
   "plazas": "1",
   "placa": false
  }
 }
];
const partida = PARTIDAS[0];
const estado = {
  insumos, parametros: PARAMETROS_DEFAULT, piezas: [],
  cotizacion: { cliente: 'Corporativo de prueba, S.A. de C.V.', folio: '2608-001', fecha: '2026-08-16', partidas: PARTIDAS },
  historial: [], lineasUsadas: {}, onboardingVisto: true,
};
const costeo = {
  piezaId: null, nombre: 'Mueble de prueba', linea: null, piezas: 1,
  componentes: [{ nombre: 'Cubierta', insumoId: 'melamina-28', largoMM: 1500, anchoMM: 600, piezas: 1 }],
  modoManoObra: 'porcentaje', horas: {}, factorDirecta: 55, factorIndirecta: 12, margen: 50,
};

// Cada pantalla con los props que de verdad pide.
const PANTALLAS = [
  ['Login', <Login onEntrar={nada} onRecuperar={nada} />],
  ['Cambiar contraseña', <CambiarContrasena email="x@vonhaucke.mx" onListo={nada} onCancelar={nada} />],
  ['Inicio', <Inicio estado={estado} onIr={nada} veCostos esDireccion vista="menu" setVista={nada} />],
  ['Inicio · cotizar de línea', <Inicio estado={estado} onIr={nada} veCostos esDireccion vista="linea" setVista={nada} />],
  ['Guía', <Guia primeraVez={false} onIr={nada} onCerrar={nada} estado={estado} rol="ventas" />],
  ['Voni', <Voni estado={estado} setEstado={nada} soloVentas={false} veCostos paso={1} setPaso={nada} onAgregarItems={nada} onGuardarAcomodo={nada} onIr={nada} />],
  ['Cotizar con IA', <CotizadorIA estado={estado} onAgregarItems={nada} onIr={nada} verCotizacion />],
  ['Asistente', <Asistente estado={estado} onAgregarPartida={nada} onModoAvanzado={nada} onIr={nada} />],
  ['Asistente especial', <AsistenteEspecial estado={estado} onVerDetalle={nada} onInicio={nada} />],
  ['Banco de precios', <Banco onAgregar={nada} onIr={nada} />],
  ['Catálogo', <Catalogo estado={estado} onCargar={nada} soloVentas={false} />],
  ['Costear especial', <Costeador estado={estado} costeo={costeo} setCosteo={nada} onAgregarCotizacion={nada} onGuardarPieza={nada} />],
  ['Propuesta (mis números)', <Cotizacion estado={estado} setEstado={nada} soloVentas={false} onIr={nada} />],
  ['Propuesta (vista cliente)', <Cotizacion estado={estado} setEstado={nada} soloVentas onIr={nada} />],
  // El guardado se ESPÍA en la prueba de humo: así se comprueba que el acomodo
  // se persiste solo (Rodrigo perdía el trabajo al cambiar de pestaña) sin
  // tener que entrar con cuenta a la app en vivo.
  ['Acomodo 3D', <Acomodo estado={estado} onIr={nada} onGuardarAcomodo={(d, silencioso) => {
    window.__guardadoAcomodo = {
      n: (window.__guardadoAcomodo?.n || 0) + 1, silencioso,
      areasM: d.areasM?.length || 0, piezas: d.plan?.colocacion?.length || 0,
    };
  }} />],
  ['Dibujar plano', <DibujarPlano onListo={nada} onCancelar={nada} />],
  ['Editar partida', <EditarPartida estado={estado} partida={partida} onGuardar={nada} onCerrar={nada} />],
  ['Precios de material', <Precios estado={estado} setEstado={nada} esDireccion />],
  ['Tablero', <Tablero estado={estado} irA={nada} puedeVerDireccion onDireccion={null} />],
  ['Usuarios', <Usuarios />],
  ['Lo que Voni sabe', <Reglas puedeEditar />],
  ['Ficha PDF', <FichaPDF costeo={costeo} resultado={null} estado={estado} />],
  ['Informe IA', <InformeIA texto={'## Prueba\n- uno\n- dos'} />],
  ['MiniRender', <MiniRender tipo="escritorio" w={1500} d={600} />],
  // Las 24 pantallas de línea: es donde estuvo el bug.
  ...Object.entries(LINEAS_REG).map(([ruta, L]) => [
    `Línea · ${L.titulo}`,
    <CosteadorLinea onIr={nada} linea={ruta} soloVentas={false} estado={estado} titulo={`Costeador ${L.titulo}`}
      productos={L.productos} generar={L.generar} onAgregar={nada} onAgregarModulo={nada} />,
  ]),
];

// Red por pantalla: una que truene no se lleva a las demás.
class Red extends Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { this.props.onFallo?.(this.props.titulo, error); }
  render() {
    if (this.state.error) {
      return <div className="alerta roja"><span className="texto">
        <strong>{this.props.titulo}</strong> — {String(this.state.error?.message || this.state.error)}
      </span></div>;
    }
    return this.props.children;
  }
}

function Humo() {
  const [fallos, setFallos] = useState([]);
  const anota = (titulo, error) => setFallos((f) => (f.some((x) => x.titulo === titulo) ? f : [...f, { titulo, error: String(error?.message || error) }]));
  const ok = PANTALLAS.length - fallos.length;
  return (
    <>
      <div className="contenido">
        <div className={`alerta ${fallos.length ? 'roja' : 'verde'}`} style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          <span className="texto">
            <strong>{ok} de {PANTALLAS.length} pantallas montan bien.</strong>
            {fallos.length > 0 && <> Fallan: {fallos.map((f) => f.titulo).join(', ')}</>}
          </span>
        </div>
      </div>
      {PANTALLAS.map(([titulo, el]) => (
        <div key={titulo} style={{ borderTop: '3px solid var(--rojo)', marginTop: 24, paddingTop: 8 }}>
          <div className="contenido"><h3 style={{ margin: 0 }}>{titulo}</h3></div>
          <Red titulo={titulo} onFallo={anota}>{el}</Red>
        </div>
      ))}
    </>
  );
}

createRoot(document.getElementById('raiz')).render(<Humo />);
