// Vista previa AISLADA del diseño (sin Supabase, sin login).
// Renderiza las pantallas clave con datos falsos para iterar el look.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';
import './fuentes.css';
import Logo from './componentes/Logo.jsx';
import Inicio from './componentes/Inicio.jsx';
import InformeIA from './componentes/InformeIA.jsx';
import MiniRender from './componentes/MiniRender.jsx';
import Costeador from './componentes/Costeador.jsx';
import AsistenteEspecial from './componentes/AsistenteEspecial.jsx';
import Cotizacion from './componentes/Cotizacion.jsx';
import Voni from './componentes/Voni.jsx';
import PlanoAcomodo from './componentes/PlanoAcomodo.jsx';
import { INSUMOS_SEMILLA, mapaInsumos } from './datos/insumos.js';

function DemoPlano() {
  const [modo, setModo] = useState('planta');
  const areas = [
    { nombre: 'Open space (47.99 m²)', ancho: 8000, largo: 6000 },
    { nombre: 'Sala de juntas (32.28 m²)', ancho: 7000, largo: 4600 },
    { nombre: 'Privado 1 (15.28 m²)', ancho: 4210, largo: 3630 },
    { nombre: 'Recepción / circulación (10.07 m²)', ancho: 3500, largo: 2900 },
  ];
  const byId = {
    e1: { nombre: 'Bench', w: 3600, d: 1500, tipo: 'escritorio' },
    e2: { nombre: 'Bench', w: 3600, d: 1500, tipo: 'escritorio' },
    g1: { nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' },
    g2: { nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' },
    g3: { nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' },
    j1: { nombre: 'Mesa juntas', w: 1800, d: 1800, tipo: 'juntas' },
    a1: { nombre: 'Sillón', w: 700, d: 700, tipo: 'asiento' },
    a2: { nombre: 'Sillón', w: 700, d: 700, tipo: 'asiento' },
    d1: { nombre: 'Escritorio', w: 1500, d: 750, tipo: 'escritorio' },
    gg: { nombre: 'Credenza', w: 1200, d: 450, tipo: 'guarda' },
  };
  const plan = {
    colocacion: [
      { id: 'e1', area: 0, x: 800, y: 800, rot: 0 },
      { id: 'e2', area: 0, x: 800, y: 3200, rot: 0 },
      { id: 'g1', area: 0, x: 7000, y: 800, rot: 90 },
      { id: 'g2', area: 0, x: 7000, y: 1800, rot: 90 },
      { id: 'g3', area: 0, x: 7000, y: 2800, rot: 90 },
      { id: 'j1', area: 1, x: 2600, y: 1400, rot: 0 },
      { id: 'a1', area: 1, x: 600, y: 600, rot: 0 },
      { id: 'a2', area: 1, x: 5700, y: 3300, rot: 0 },
      { id: 'd1', area: 2, x: 500, y: 500, rot: 0 },
      { id: 'gg', area: 2, x: 2900, y: 500, rot: 90 },
    ],
    zonas: [{ area: 0, nombre: 'Isla de trabajo', x: 600, y: 600, ancho: 4000, largo: 4200 }],
    resumen: 'Demo', notas: [],
  };
  return (
    <div className="contenido">
      <h2>Plano de acomodo (demo — cuadrícula + muebles con forma)</h2>
      <div className="fila-botones" style={{ gap: 8, marginBottom: 8 }}>
        <button className={`boton ${modo === 'planta' ? 'primario' : 'fantasma'}`} onClick={() => setModo('planta')}>Planta</button>
        <button className={`boton ${modo === 'iso' ? 'primario' : 'fantasma'}`} onClick={() => setModo('iso')}>Vista 3D</button>
      </div>
      <div className="tarjeta"><PlanoAcomodo areas={areas} plan={plan} byId={byId} modo={modo} /></div>
    </div>
  );
}
import { PARAMETROS_DEFAULT } from './motor/calculo.js';

function DemoVoni() {
  const [paso, setPaso] = useState(1);
  const [estado, setEstado] = useState({
    insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT,
    cotizacion: {
      cliente: 'Corporativo Demo', folio: '2508-VONI', fecha: '2026-08-14',
      partidas: [
        { id: 'v1', ruta: 'applt', productoId: 'escritorio', nombre: 'App LT · Escritorio 1.50 × 0.60 m', cantidad: 12, costoUnitario: 3000, precioUnitario: 6000, margen: 50, w: 1500, d: 600 },
        { id: 'v2', ruta: 'cirque', productoId: 'banca', nombre: 'Cirque · Banca doble 1.20 m', cantidad: 4, costoUnitario: 4000, precioUnitario: 8000, margen: 50, w: 2400, d: 1400 },
        { id: 'v3', nombre: 'Recepción curva especial (a la medida)', cantidad: 1, costoUnitario: 9000, precioUnitario: 18000, margen: 50, deBanco: false },
      ],
    },
  });
  return (
    <div style={{ borderTop: '3px solid var(--rojo)', marginTop: 30 }}>
      <h2 className="contenido" style={{ marginBottom: 0 }}>Voni — asistente de proyecto (demo)</h2>
      <Voni estado={estado} setEstado={setEstado} soloVentas={false} veCostos={true}
        paso={paso} setPaso={setPaso}
        onAgregarItems={() => {}} onGuardarAcomodo={() => {}} onIr={() => {}} />
    </div>
  );
}

function DemoAsistente() {
  const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, cotizacion: { partidas: [] } };
  return (
    <div className="contenido">
      <h2>Asistente — costear desde cero (guiado)</h2>
      <AsistenteEspecial estado={estado} onVerDetalle={() => {}} onInicio={() => {}} />
    </div>
  );
}

function DemoCosteador() {
  const [costeo, setCosteo] = useState({
    nombre: 'Mostrador recepción curvo (nuevo)', piezas: 1,
    componentes: [
      { nombre: 'Cubierta', insumoId: 'melamina-28', largoMM: 2400, anchoMM: 600, piezas: 1 },
      { nombre: 'Faldón frontal', insumoId: 'mdf', largoMM: 2400, anchoMM: 400, piezas: 1 },
      { nombre: 'Estructura', insumoId: 'ptr', cantidad: 12 },
      { nombre: 'Cristal frontal', insumoId: 'cristal-templado', largoMM: 2100, anchoMM: 1000, piezas: 1 },
      { nombre: 'Jaladeras', insumoId: 'jaladera', cantidad: 4 },
    ],
    modoManoObra: 'porcentaje', horas: {}, factorDirecta: 55, factorIndirecta: 12, margen: 50,
  });
  const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, cotizacion: { partidas: [] } };
  return (
    <div className="contenido">
      <h2>Costear especial — despiece por medidas (producto nuevo)</h2>
      <Costeador estado={estado} costeo={costeo} setCosteo={setCosteo} onAgregarCotizacion={() => {}} onGuardarPieza={() => {}} />
    </div>
  );
}

const RENDERS = [
  { tipo: 'escritorio', w: 1500, d: 600, nombre: 'Escritorio 1.50 × 0.60' },
  { tipo: 'bench', w: 3000, d: 1200, nombre: 'Bench 4 usuarios 3.00 × 1.20' },
  { tipo: 'mesa', w: 2400, d: 1200, nombre: 'Mesa juntas 2.40 × 1.20' },
  { tipo: 'estacion', w: 1500, d: 600, nombre: 'Escritorio en L' },
  { tipo: 'guarda', w: 900, d: 450, nombre: 'Credenza / archivero' },
  { tipo: 'mampara', w: 900, d: 60, nombre: 'Muro Privacy 4 0.90 × 2.40' },
  { tipo: 'mesita', w: 1000, d: 450, nombre: 'Mesa Pebble (apoyo)' },
  { tipo: 'asiento', w: 520, d: 520, nombre: 'Silla' },
];

function GaleriaRenders() {
  return (
    <div className="contenido">
      <h2>Renders isométricos (a medida real)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {RENDERS.map((r) => (
          <div key={r.nombre} className="tarjeta" style={{ padding: 14 }}>
            <div className="ficha-render" style={{ aspectRatio: '5 / 4' }}>
              <MiniRender tipo={r.tipo} w={r.w} d={r.d} />
            </div>
            <div style={{ marginTop: 10, fontWeight: 600, fontSize: 14 }}>{r.nombre}</div>
            <div className="gris" style={{ fontSize: 12 }}>{r.tipo}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const estadoDemo = { cotizacion: { partidas: [{}, {}, {}] } };

function Enc() {
  return (
    <div className="encabezado">
      <div className="barra-enc">
        <div className="marca">
          <Logo alto={40} />
          <div>
            <div className="nombre">Von Haucke</div>
            <div className="anios">68 AÑOS · MOBILIARIO DE OFICINA</div>
          </div>
        </div>
        <div className="acciones-enc">
          <span className="conexion"><span className="punto" style={{ background: '#3ecf8e' }} /><span className="conexion-txt">En línea</span></span>
          <button className="btn-enc">Guía</button>
          <button className="btn-enc">Salir</button>
        </div>
      </div>
    </div>
  );
}

function KitchenSink() {
  return (
    <div className="contenido">
      <h2>Muestra de componentes</h2>
      <div className="dos-col">
        <div>
          <div className="tarjeta">
            <label className="etiqueta">Nombre del producto</label>
            <input type="text" placeholder="Escritorio operativo" />
            <div className="ayuda">Texto de ayuda para el usuario.</div>
            <div className="espacio" />
            <div className="chips">
              <span className="chip on">App LT</span>
              <span className="chip">App</span>
              <span className="chip">Eclipse</span>
            </div>
            <div className="espacio" />
            <div className="fila-botones">
              <button className="boton primario">Guardar</button>
              <button className="boton">Cancelar</button>
              <button className="boton fantasma">Otra acción</button>
            </div>
          </div>
          <div className="alerta roja"><span className="texto">Una partida cae bajo el margen mínimo.</span></div>
          <div className="alerta ambar"><span className="texto">Precio estimado, aún sin validar.</span></div>
        </div>
        <div>
          <div className="hoja pegado">
            <div className="fila"><span>Material directo</span><span className="val">$2,340.00</span></div>
            <div className="fila"><span>Mano de obra</span><span className="val">$1,120.00</span></div>
            <div className="fila sub"><span>Indirectos 34%</span><span className="val">$795.60</span></div>
            <hr />
            <div className="fila"><span>Costo total</span><span className="val">$4,255.60</span></div>
            <hr className="doble" />
            <div className="fila total"><span>Precio de lista</span><span className="val">$8,511.00</span></div>
            <div className="espacio" />
            <div className="precio-grande">$8,511</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const INFORME_DEMO = `## 📐 Resumen Tecnico y Medidas Generales
- Cubierta credenza 750 mm, repisa elevada 860 mm, largo ~1500 mm, fondo 500 mm.
- 3 sub-ensambles: portico metalico en C, gabinete cajones/nicho, modulo cama pet.
- Peso estimado 62-78 kg (metal 22-28, tablero 35-45).

## 📋 Tabla BOM
| Pieza | Material | Calibre | Medida | Acabado |
| --- | --- | --- | --- | --- |
| Cubierta credenza | Melamina 28mm | 28mm | 1500x500 | Walnut |
| Portico C | Lamina rolada | cal.14 | 700x750 | Negro mate |
| Cajones (3) | Melamina 16mm | 16mm | 450x150 | Negro |

## ✂️ Analisis de Merma y Nesting
- Cubierta 1500x500: caben 3 por tablero (merma ~9%).
- Ajustar repisa a 1400 mm: 4 por tablero, merma baja a 5%.

## ⚙️ Ruta de Produccion y Estandarizacion
- Corte -> CNC -> Doblez -> Soldadura -> Pintura -> Ensamble.
- Cuello de botella: soldadura del portico. Unificar costados izq/der.

## 💡 Ingenieria de Valor
- Sustituir soldadura por ensamble por pestañas: -12% mano de obra.
- Frentes en melamina walnut en vez de chapa: -18% material.

## 📦 Estrategia Logistica (Flat-Pack)
- Knock-down en 3 modulos: densidad x2.3 en contenedor 53ft.

## 🛡️ Refuerzos Estructurales (Contract/BIFMA)
- Alma de acero en voladizo de repisa; placa de distribucion en base.

## 🎯 Top 3 Acciones
1. Calibrar con 1 medida real (sube confianza).
2. Ajustar repisa a 1400 mm (merma 9%->5%).
3. Ensamble por pestañas (-12% MO).`;

function DemoInforme() {
  return (
    <div className="contenido">
      <h2>Informe IA — tablero de tarjetas</h2>
      <div className="ia-informe-bloque">
        <div className="ia-informe-titulo">🔎 Auditoría técnica de industrialización</div>
        <InformeIA informe={INFORME_DEMO} />
      </div>
    </div>
  );
}

function DemoCotizacion() {
  const [estado, setEstado] = useState({
    parametros: PARAMETROS_DEFAULT,
    cotizacion: {
      cliente: 'Corporativo Demo', folio: '2508-DEMO', fecha: '2026-08-14',
      partidas: [
        { id: 'p1', ruta: 'cirque', productoId: 'escritorio', nombre: 'Cirque · Escritorio 1.50 × 0.60 m · Melamina ABS', cantidad: 12, costoUnitario: 3000, precioUnitario: 6000, margen: 50 },
        { id: 'p2', ruta: 'modulor', productoId: 'archivero_h', nombre: 'Modulor · Archivero horizontal 0.75, 2 cajones', cantidad: 15, costoUnitario: 1347, precioUnitario: 2693, margen: 50 },
        { id: 'p3', ruta: 'pac', productoId: 'sillon', nombre: 'Pac · Sillón sin brazos, tela', cantidad: 6, costoUnitario: 1600, precioUnitario: 3200, margen: 50 },
        { id: 'p4', ruta: 'alba', productoId: 'mesa_juntas', nombre: 'Alba · Mesa de juntas 2.40 m · Chapa', cantidad: 1, costoUnitario: 8000, precioUnitario: 16000, margen: 50 },
      ],
    },
  });
  return (
    <div className="contenido">
      <h2>Propuesta al cliente (vista cliente, con fotos)</h2>
      <Cotizacion estado={estado} setEstado={setEstado} soloVentas={true} />
    </div>
  );
}

createRoot(document.getElementById('raiz')).render(
  <>
    <DemoVoni />
    <DemoCotizacion />
    <DemoInforme />
    <Enc />
    <DemoAsistente />
    <DemoCosteador />
    <GaleriaRenders />
    <div className="contenido">
      <Inicio estado={estadoDemo} onIr={() => {}} veCostos={true} esDireccion={true} />
    </div>
    <KitchenSink />
  </>
);
