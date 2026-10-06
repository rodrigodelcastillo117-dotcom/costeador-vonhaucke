// ============================================================================
//  COSTEADOR - la pantalla principal de trabajo (master 7.2)
//  Dos columnas en >=1000px; una sola abajo, con barra fija que muestra el costo.
// ============================================================================
import { useMemo, useState, useEffect } from 'react';
import { precioDe, precioVenta, sugerenciaLote, sugerenciaMedida, costoNetoComponente, netoComponente, costeoEmitible, PARAMETROS_DEFAULT, SIN_MO_SECCIONES, precioUsable } from '../motor/calculo.js';
import { calcularCosteoVivo, parametrosEfectivosCosteo } from '../motor/costeoVivo.js';
export { parametrosEfectivosCosteo as parametrosEfectivos } from '../motor/costeoVivo.js';
import { precioDeLista } from '../datos/preciosVenta.js';
import { SECCIONES } from '../datos/insumos.js';
import { AREAS_LABEL } from '../datos/areas.js';
import { recetaBench } from '../datos/bench.js';
import HojaCosto from './HojaCosto.jsx';
import FichaPDF from './FichaPDF.jsx';
import MiniRender, { tipoDeMueble, dimsDeMueble } from './MiniRender.jsx';
import { generarRender, analizarTexto } from '../nube.js';
import { pesos2, pct, pct1, colorMerma } from '../util.js';
import AnalisisEstructural from './AnalisisEstructural.jsx';
import { graphFromPropuesta } from '../datos/structuralGraph.js';
import { conAcompanantes } from '../datos/autoInsumos.js';
import { aplicarPoliticaMaterial, MATCH } from '../datos/materialMatch.js';
import { renderSpecFromGraph } from '../datos/renderSpec.js';
import { flagActivo } from '../datos/flags.js';

const ATAJOS = [
  { nombre: 'Muy facil', v: 30 },
  { nombre: 'Facil', v: 40 },
  { nombre: 'Estandar', v: 55 },
  { nombre: 'Dificil', v: 70 },
  { nombre: 'Muy dificil', v: 90 },
];

// Nadie escribe "1500" cuando piensa en una cubierta de 1.50 m. Al teclear 1.50
// en un campo de milímetros, la app calculaba 1.5 mm × 0.9 mm = 0.00 m² y
// devolvía $0 SIN DECIR NADA: el vendedor cree que la app está rota.
// El umbral son 10, no 50: en metros toda pieza real cae entre 0.05 y ~6
// (una cubierta de 3.60 m es de las más largas), y en milímetros ninguna baja
// de 10 mm. Con 50 se convertía una pieza legítima de 45 mm en 45 metros.
// Se corrige al salir del campo (nunca mientras teclea, o "1500" se rompería
// en el primer dígito) y SIEMPRE se avisa qué se entendió.
const MM_MINIMO = 10;
export const pareceMetros = (v) => Number(v) > 0 && Number(v) < MM_MINIMO;
export const aMilimetros = (v) => (pareceMetros(v) ? Math.round(Number(v) * 1000) : Number(v) || 0);

export default function Costeador({ estado, setCosteo, costeo, onAgregarCotizacion, onGuardarPieza }) {
  const [abiertas, setAbiertas] = useState({ cubiertas: true });
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [errRender, setErrRender] = useState('');
  // DESCRIBE → VONI ENTIENDE (texto → analizar-mueble). Pre-llena el BOM y muestra la
  // estructura que Voni entendió. No toca el costeo/dinero: el motor sigue costeando.
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [errIA, setErrIA] = useState('');
  const [estructuraVoni, setEstructuraVoni] = useState(null);
  // RENDER STALE (Gate 6): si el despiece cambió desde que se generó la imagen, el
  // render ya NO es fiel. No lo mostramos como válido: avisamos y marcamos para regenerar.
  const [sigRender, setSigRender] = useState(null);
  const bomSig = useMemo(
    () => JSON.stringify((costeo.componentes || []).map((c) => [c.insumoId, c.cantidad, c.piezas, c.largoMM, c.anchoMM])),
    [costeo.componentes],
  );
  const renderStale = !!costeo.imagen && sigRender !== null && sigRender !== bomSig;
  // Al cargar un costeo que ya trae imagen, fija la firma base para detectar cambios futuros.
  useEffect(() => { if (costeo.imagen && sigRender === null) setSigRender(bomSig); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [costeo.imagen]);
  const insumos = estado.insumos;

  // ÚNICO camino de preparación/cálculo: la misma función alimenta a VONI.
  const vivo = useMemo(
    () => calcularCosteoVivo(estado, costeo),
    [estado, costeo],
  );
  const { piezaVirtual, parBase, par, esIntelisis, resultado } = vivo;
  const margen = costeo.margen ?? estado.parametros.margenObjetivo ?? 40;
  const precio = esIntelisis
    ? precioDeLista(precioVenta(resultado.costoUnitario, par).lista)
    : precioDe(resultado.costoUnitario, margen);
  const bajoMinimo = margen < estado.parametros.margenMinimo;
  // FAIL-CLOSED (audit 2026-10-01): con partidas sin costear no hay precio ni se
  // puede emitir a la cotización. Solo se muestra el subtotal conocido.
  const emisionC = costeoEmitible(resultado);
  const pendientesC = emisionC.pendientes || [];
  const incompletoC = !emisionC.emitible;
  // SIMULADOR vs OFICIAL (cutover 2026-10-02). El costo OFICIAL usa Alba (sin factores a
  // mano y sin horas). En cuanto el usuario fija un factorDirecta/Indirecta o usa modo
  // horas, está SIMULANDO: no es oficial y no puede emitir/cotizar/aprobar. Volver a
  // Alba (botón) limpia los factores y restaura el costo certificado.
  const esOficialAlba = costeo.modoManoObra !== 'horas' && costeo.factorDirecta == null && costeo.factorIndirecta == null;
  const simulando = !esOficialAlba;
  const volverAAlba = () => set({ modoManoObra: 'porcentaje', factorDirecta: null, factorIndirecta: null });
  const sugerencia = useMemo(
    () => sugerenciaLote(piezaVirtual, costeo.piezas, insumos, par),
    [costeo, insumos, par]
  );

  // --- helpers de estado ---
  const set = (parcial) => setCosteo({ ...costeo, ...parcial });

  // --- DESCRIBE → VONI ENTIENDE ---------------------------------------------
  // Catálogo (sólo id/nombre/sección/unidad) para que la IA ancle insumoId; jamás precios.
  const catalogoIA = () => Object.values(insumos).map((x) => ({ id: x.id, nombre: x.nombre, seccion: x.seccion, unidad: x.unidad }));
  // Mapea el despiece CRUDO de la IA a los `componentes` del motor (misma conversión
  // que el Asistente especial). Un insumoId que no exista queda '' → el motor lo marca
  // como pendiente (fail-closed), nunca lo inventa.
  const mapIaComps = (p) => (p?.piezas || []).map((z) => {
    // POLÍTICA DE MATERIAL: jamás sustituye solid surface por MDF/HPL en silencio.
    // Sólo EXACT/EQUIVALENT_APPROVED conservan insumoId; una sustitución de otra
    // familia o un material inexistente quedan '' + bandera `_match` para la UI
    // (el motor los marca pendientes, nunca los costea en $0 disfrazados).
    // `material_solicitado` lo da el analizador (v19+); si no viene, cae al nombre
    // de la pieza, que ya suele traer el material ("Cubierta superficie sólida").
    const base = aplicarPoliticaMaterial({ ...z, material_solicitado: z.material_solicitado || z.nombre }, (id) => insumos[id], Object.values(insumos));
    if (z.forma === 'area') { base.largoMM = z.largoMM || 0; base.anchoMM = z.anchoMM || 0; base.piezas = z.cantidad || 1; base.cantidad = 1; if (z.hojas > 0) base.hojas = z.hojas; }
    return base;
  });
  async function analizarDescripcion() {
    const desc = (costeo.descripcionCliente || '').trim();
    if (desc.length < 8) { setErrIA('Describe el mueble (material, partes, uso) para que Voni lo entienda.'); return; }
    // No destruyas trabajo manual sin avisar.
    if ((costeo.componentes || []).some((c) => c.insumoId || c.nombre) &&
        !window.confirm('Esto reemplazará las piezas actuales por lo que entienda Voni de tu descripción. ¿Seguir?')) return;
    setErrIA(''); setAnalizandoIA(true);
    try {
      const res = await analizarTexto(catalogoIA(), desc);
      if (!res?.ok) { setErrIA(res?.error || 'No se pudo interpretar la descripción.'); return; }
      const p = res.propuesta || {};
      set({ nombre: costeo.nombre || p.producto || '', descripcionCliente: p.descripcionCliente || desc, componentes: conAcompanantes(mapIaComps(p)) });
      setEstructuraVoni(p.design_intent ? graphFromPropuesta(p) : null);
    } catch (err) { setErrIA(String(err?.message || err)); }
    finally { setAnalizandoIA(false); }
  }
  // Tipo para la "Vista del mueble": si Voni ya entendió el producto, usa ESE
  // (lo más fiel a lo que describiste); si no, lo deduce del nombre+descripción.
  const vistaTipo = (estructuraVoni?.design_intent?.product_type && estructuraVoni.design_intent.product_type !== 'unknown')
    ? tipoDeMueble({ nombre: estructuraVoni.design_intent.product_type })
    : tipoDeMueble(costeo);

  // --- Render de calidad con IA (Gemini), inspirado en lo que se costea ---
  // Resumen de ESTRUCTURA (lo que Voni entendió) para que el render arme el objeto
  // correcto (no un escritorio genérico). En inglés corto, como el prompt del edge.
  function specEstructura() {
    const g = estructuraVoni;
    if (!g || !g.nodes?.length) return '';
    const di = g.design_intent || {};
    const roles = g.nodes.map((n) => `${n.semantic_role}${n.quantity > 1 ? ` x${n.quantity}` : ''}`).join(', ');
    const rol = (id) => (g.nodes.find((n) => n.id === id) || {}).semantic_role || '?';
    const verbo = { supports: 'supports', contains: 'contains', connects: 'connects', repeats_with: 'repeats with' };
    const rels = g.relations.slice(0, 6).map((r) => `${rol(r.from)} ${verbo[r.type] || r.type} ${rol(r.to)}`).join('; ');
    return `${di.product_type || ''}${di.quantity > 1 ? `, ${di.quantity} modules` : ''}. Parts: ${roles}.${rels ? ` Structure: ${rels}.` : ''}`;
  }
  function descripcionParaRender() {
    // Materiales REALES (nombre del insumo del catálogo), no las etiquetas de las piezas.
    const mats = [...new Set(costeo.componentes.map((c) => insumos[c.insumoId]?.nombre).filter(Boolean))].slice(0, 8);
    let med = '', mayor = 0;
    for (const c of costeo.componentes) {
      if (c.largoMM && c.anchoMM && c.largoMM * c.anchoMM > mayor) { mayor = c.largoMM * c.anchoMM; med = `${(c.largoMM / 1000).toFixed(2)} x ${(c.anchoMM / 1000).toFixed(2)} m`; }
    }
    return { descripcion: costeo.descripcionCliente || costeo.nombre || 'mueble de oficina', materiales: mats, medidas: med, tipo: vistaTipo, spec: specEstructura() };
  }
  async function generarRenderIA() {
    setErrRender(''); setGenerando(true);
    try {
      const d = descripcionParaRender();
      // RenderSpecV1 TIPADO desde el grafo confirmado (geometría bloqueada: el
      // render no cambia módulos/asientos/cajones/pantallas). Es el camino ideal
      // SemanticProposal→StructuralGraph→RenderSpec→generar-render; `spec` (string)
      // se mantiene como respaldo legacy para el edge.
      const render_spec = estructuraVoni ? renderSpecFromGraph(estructuraVoni, { materiales: d.materiales, descripcion: d.descripcion }) : null;
      const r = await generarRender(d.descripcion, { materiales: d.materiales, medidas: d.medidas, tipo: d.tipo, spec: d.spec, render_spec });
      if (!r || !r.ok) { setErrRender(r?.error || 'No se pudo generar el render.'); return; }
      set({ imagen: r.dataUrl });
      setSigRender(bomSig); // la imagen corresponde a ESTE despiece
    } catch (e) { setErrRender('No se pudo conectar. Vuelve a intentar.'); }
    finally { setGenerando(false); }
  }

  function toggleInsumo(ins) {
    const existe = costeo.componentes.find((c) => c.insumoId === ins.id);
    if (existe) {
      set({ componentes: costeo.componentes.filter((c) => c.insumoId !== ins.id) });
    } else {
      set({
        componentes: conAcompanantes([
          ...costeo.componentes,
          { insumoId: ins.id, nombre: ins.nombre, cantidad: 1 },
        ]),
      });
    }
  }

  function setCantidad(i, valor) {
    const comps = costeo.componentes.slice();
    comps[i] = { ...comps[i], cantidad: valor };
    set({ componentes: comps });
  }

  // --- Despiece "pieza por medidas" (costear desde cero) ---
  // Un material es "por área" (se mete con largo×ancho) si es tablero o se
  // cobra por m2 (cristal/acrílico). Lo demás va por su cantidad (m, pza, kg).
  const esArea = (ins) => !!ins && (ins.formato?.tipo === 'tablero' || ins.unidad === 'm2');
  // Lámina/tablero se pueden capturar por FRACCION DE HOJA directa (Rafa §1):
  // el estimador escribe "0.8 de hoja" y el costo es fraccion x precio_hoja.
  const esFraccionHoja = (ins) => !!ins && ins.fraccion && (ins.formato?.tipo === 'lamina' || ins.formato?.tipo === 'tablero');

  function agregarPieza() {
    set({ componentes: [...costeo.componentes, { nombre: '', insumoId: '', cantidad: 1, piezas: 1 }] });
  }
  function quitarPieza(i) {
    set({ componentes: costeo.componentes.filter((_, j) => j !== i) });
  }
  function setPieza(i, parcial) {
    const comps = costeo.componentes.slice();
    comps[i] = { ...comps[i], ...parcial };
    set({ componentes: comps });
  }
  function onMaterial(i, insumoId) {
    const ins = insumos[insumoId];
    const comps = costeo.componentes.slice();
    const prev = comps[i];
    const patch = { insumoId, nombre: prev.nombre || (ins ? ins.nombre : '') };
    if (!esArea(ins)) { patch.largoMM = undefined; patch.anchoMM = undefined; } // material no dimensional
    if (!esFraccionHoja(ins)) patch.hojas = undefined; // material que no es por fracción de hoja
    comps[i] = { ...prev, ...patch };
    // Adhesivo automático: elegir superficie sólida arrastra su adhesivo de uniones.
    set({ componentes: conAcompanantes(comps) });
  }
  // Costo neto de una pieza, respetando fracción de hoja (para el subtotal por pieza)
  function costoPieza(c, ins, n) {
    if (c.hojas != null && ins.formato) {
      const precioH = ins.precio ?? ins.precioBase ?? 0;
      return Math.max(0, c.hojas) * n * precioH;
    }
    const neto = netoComponente(c, n);
    const precio = ins.precio ?? ins.precioBase ?? 0;
    if (ins.formato && ins.fraccion) {
      const aprov = (par.aprovechamientoCorte || 100) / 100;
      return (neto / (ins.formato.medida * aprov)) * precio;
    }
    return neto * precio;
  }

  // Bench modular (8.5): al cambiar el numero de personas se rearma la receta
  function setPersonasBench(personas) {
    const bench = { ...costeo.bench, personas: Math.max(2, personas) };
    const b = recetaBench(bench);
    set({
      bench,
      benchDescripcion: b.descripcion,
      componentes: b.componentes,
      horas: b.horas,
      nombre: (costeo.linea ? costeo.linea + ' — ' : '') + `Bench ${b.personas} usuarios`,
    });
  }

  const subtotalSeccion = (secId) =>
    resultado.detalleInsumos
      .filter((c) => c.seccion === secId)
      .reduce((a, c) => a + c.costo, 0);

  // Lista de compra: solo insumos con formato (unidades != null), ya agregados
  const listaCompra = resultado.detalleInsumos.filter((c) => c.unidades != null && c.unidades > 0);

  // Medida que rinde mejor (6.9): para componentes con dimensiones y mal aprovechamiento
  const sugerenciasMedida = costeo.componentes
    .map((c, i) => {
      if (!c.largoMM || !c.anchoMM) return null;
      const ins = insumos[c.insumoId];
      if (!ins?.formato) return null;
      const s = sugerenciaMedida(c.largoMM, c.anchoMM, ins, estado.parametros);
      if (!s.mejor || s.actual < 1) return null;
      const areaAct = (c.largoMM / 1000) * (c.anchoMM / 1000);
      const areaNueva = (s.mejor.largoMM / 1000) * (s.mejor.anchoMM / 1000);
      const precio = ins.precio ?? ins.precioBase ?? 0;
      const costoAct = (ins.formato.medida / s.actual) * precio;
      const costoNuevo = (ins.formato.medida / s.mejor.piezasPorTablero) * precio;
      return { i, nombre: c.nombre, ...s, costoAct, costoNuevo, mejora: costoAct - costoNuevo };
    })
    .filter(Boolean);

  function aplicarMedida(i, largoMM, anchoMM) {
    const comps = costeo.componentes.slice();
    comps[i] = { ...comps[i], largoMM, anchoMM };
    set({ componentes: comps });
  }

  return (
    <div className="dos-col">
      {/* ------------------ COLUMNA IZQUIERDA ------------------ */}
      <div>
        {/* N3 — análisis estructural (read-only, no toca el BOM certificado) */}
        {flagActivo('costing_ai_v2') && <AnalisisEstructural costeo={costeo} />}
        {/* 1. Que estas costeando */}
        <div className="tarjeta">
          <label className="etiqueta" htmlFor="nom-pieza">Que estas costeando</label>
          <input id="nom-pieza" type="text" value={costeo.nombre}
            placeholder="Nombre del mueble" onChange={(e) => set({ nombre: e.target.value })} />
          {costeo.linea && <div className="ayuda">Linea: <strong>{costeo.linea}</strong></div>}

          {/* DESCRIBE → VONI ENTIENDE: escribe qué es el mueble y Voni propone las piezas
              y su estructura. (Rodrigo: "que te pregunte qué mueble es y tú lo describas".) */}
          <div className="espacio" />
          <label className="etiqueta" htmlFor="desc-voni">Descríbelo y Voni lo entiende</label>
          <textarea id="desc-voni" rows={3}
            placeholder="Ej. Banca de aeropuerto de 4 plazas, estructura de aluminio, asiento y respaldo de hule espuma tapizado, conector cada 2 asientos."
            value={costeo.descripcionCliente || ''} onChange={(e) => set({ descripcionCliente: e.target.value })}
            style={{ width: '100%', resize: 'vertical', padding: 10, borderRadius: 8, border: '1px solid var(--linea)', fontFamily: 'inherit', fontSize: 15 }} />
          <div className="fila" style={{ gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <button className={'boton ' + (analizandoIA ? 'fantasma' : 'primario')}
              disabled={analizandoIA || (costeo.descripcionCliente || '').trim().length < 8}
              onClick={analizarDescripcion}>
              {analizandoIA ? 'Voni está entendiendo…' : '🧠 Analizar con Voni'}
            </button>
            <span className="ayuda gris" style={{ fontSize: 12 }}>Propone piezas y estructura; tú confirmas. El precio lo calcula el motor.</span>
          </div>
          {errIA && <div className="alerta roja" style={{ marginTop: 8 }}><span className="texto">{errIA}</span></div>}
          {estructuraVoni && estructuraVoni.nodes.length > 0 && (
            <div className="tarjeta" style={{ background: 'var(--panel)', borderLeft: '4px solid var(--acento, #3a6ea5)', marginTop: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>🧠 Estructura que entendió Voni</div>
              <div className="ayuda" style={{ marginBottom: 8 }}>
                {estructuraVoni.design_intent.product_type === 'unknown'
                  ? 'Voni no está segura de qué mueble es — ajústalo en las piezas.'
                  : (<><b>{estructuraVoni.design_intent.product_type}</b>{estructuraVoni.design_intent.quantity > 1 ? ` · ${estructuraVoni.design_intent.quantity} módulos` : ''}{estructuraVoni.design_intent.overall_dimensions?.raw ? ` · ${estructuraVoni.design_intent.overall_dimensions.raw}` : ''}</>)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {estructuraVoni.nodes.map((n, i) => (
                  <span key={i} className="chip" style={{ background: 'var(--fondo,#f3f3f3)', fontSize: 12 }} title={n.requires_confirmation ? 'Falta confirmar material' : ''}>
                    {n.semantic_role}{n.quantity > 1 ? ` ×${n.quantity}` : ''}{n.requires_confirmation ? ' ⚠' : ''}
                  </span>
                ))}
              </div>
              {estructuraVoni.relations.length > 0 && (
                <div className="ayuda gris" style={{ fontSize: 12, marginBottom: 6 }}>
                  {estructuraVoni.relations.slice(0, 6).map((r, i) => {
                    const rol = (id) => (estructuraVoni.nodes.find((n) => n.id === id) || {}).semantic_role || '?';
                    const v = ({ supports: 'soporta', contains: 'contiene', connects: 'conecta', repeats_with: 'se repite con' })[r.type] || r.type;
                    return <span key={i}>{i > 0 ? ' · ' : ''}{rol(r.from)} {v} {rol(r.to)}</span>;
                  })}
                </div>
              )}
              {Array.isArray(estructuraVoni.missing_critical_data) && estructuraVoni.missing_critical_data.length > 0 && (
                <div className="ayuda" style={{ color: '#8a6d00', fontSize: 12 }}>Falta por definir: {estructuraVoni.missing_critical_data.join(' · ')}</div>
              )}
              <div className="ayuda gris" style={{ fontSize: 11, marginTop: 6 }}>Revisa/corrige las piezas abajo; el precio lo calcula el motor.</div>
            </div>
          )}
          <div className="espacio" />
          <label className="etiqueta">Cuantas piezas</label>
          <div className="masmenos">
            <button aria-label="menos" onClick={() => set({ piezas: Math.max(1, costeo.piezas - 1) })}>−</button>
            <span className="valor">{costeo.piezas}</span>
            <button aria-label="mas" onClick={() => set({ piezas: costeo.piezas + 1 })}>+</button>
          </div>
          <div className="espacio" />
          {/* Tipo de producto (política T.D.C. de Alba): define los factores de
              precio por volumen. Fabricado = lo hace Von Haucke; compra-venta =
              se compra ya hecho y casi no lleva utilidad de fabricación. */}
          <label className="etiqueta" htmlFor="tipo-prod">Tipo de producto</label>
          <select id="tipo-prod" value={costeo.tipoProducto || 'mueble_fabricado'}
            onChange={(e) => set({ tipoProducto: e.target.value })}>
            <option value="mueble_fabricado">Mueble fabricado (lo hacemos nosotros)</option>
            <option value="componente_fabricado">Componente fabricado</option>
            <option value="mueble_compra_venta">Mueble de compra-venta (ya hecho)</option>
            <option value="componente_compra_venta">Componente de compra-venta</option>
            <option value="accesorio_compra_venta">Accesorio (compra-venta)</option>
            <option value="servicio_directo">Servicio</option>
          </select>
        </div>

        {/* Bench modular (8.5) - solo si viene del generador */}
        {costeo.bench && (
          <div className="tarjeta">
            <h2>Bench modular</h2>
            <label className="etiqueta">Cuantas personas (siempre en par)</label>
            <div className="masmenos">
              <button aria-label="menos personas" onClick={() => setPersonasBench(costeo.bench.personas - 2)}>−</button>
              <span className="valor">{costeo.bench.personas}</span>
              <button aria-label="mas personas" onClick={() => setPersonasBench(costeo.bench.personas + 2)}>+</button>
            </div>
            <p className="ayuda columna-texto" style={{ marginTop: 10 }}>{costeo.benchDescripcion}</p>
          </div>
        )}

        {/* 2. El despiece — pieza por medidas (costear desde cero) */}
        <div className="tarjeta">
          <h2>De qué está hecho — pieza por pieza</h2>
          <p className="ayuda columna-texto">Agrega cada pieza: ponle nombre, escoge de qué es y su medida. Las medidas van NETAS (de la pieza terminada); la app calcula el área, la fracción de hoja y la merma sola.</p>

          {costeo.componentes.map((c, i) => {
            const ins = insumos[c.insumoId];
            const area = esArea(ins);
            const cnt = c.piezas || 1;
            const m2 = area && c.largoMM && c.anchoMM ? (c.largoMM / 1000) * (c.anchoMM / 1000) * cnt : 0;
            const fmt = ins?.formato;
            const aprov = (par.aprovechamientoCorte || 100) / 100;
            const fraccion = ins?.fraccion && fmt?.medida && area ? m2 / (fmt.medida * aprov) : 0;
            const porHojaDir = esFraccionHoja(ins);
            return (
              <div className="pieza" key={i}>
                <div className="pieza-head">
                  <input className="pieza-nom" placeholder="Nombre de la pieza (ej. Cubierta)" value={c.nombre || ''}
                    onChange={(e) => setPieza(i, { nombre: e.target.value })} />
                  <select className="pieza-mat" value={c.insumoId || ''} onChange={(e) => onMaterial(i, e.target.value)}>
                    <option value="">— ¿de qué es? —</option>
                    {SECCIONES.map((sec) => (
                      <optgroup label={sec.nombre} key={sec.id}>
                        {Object.values(insumos).filter((x) => x.seccion === sec.id).map((x) => (
                          <option value={x.id} key={x.id}>{x.nombre}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button className="pieza-x" onClick={() => quitarPieza(i)} aria-label="quitar pieza">×</button>
                </div>

                {c._match && (c._match.clase === MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION || c._match.clase === MATCH.NOT_AVAILABLE) && (
                  <div className="pieza-match-alerta" style={{ background: '#fff4e5', border: '1px solid #f0c38e', borderRadius: 8, padding: '6px 10px', margin: '6px 0', fontSize: 13, color: '#7a4a00' }}>
                    ⚠️ {c._match.clase === MATCH.NOT_AVAILABLE ? 'Material pendiente de precio real' : 'Sustitución requiere confirmación'}
                    {c._match.solicitado ? <> — pediste <b>{c._match.solicitado}</b>.</> : '.'}{' '}
                    {c._match.motivo} Escoge el material arriba para costearlo (no se sustituye solo).
                  </div>
                )}

                {ins && (
                  <div className="pieza-med">
                    {area ? (
                      <>
                        <label>Largo mm<input type="number" className="numero" min="0" value={c.largoMM || ''}
                          placeholder="1500"
                          onChange={(e) => setPieza(i, { largoMM: parseFloat(e.target.value) || 0 })}
                          onBlur={(e) => { const v = parseFloat(e.target.value); if (pareceMetros(v)) setPieza(i, { largoMM: aMilimetros(v) }); }} /></label>
                        <span className="por">×</span>
                        <label>Ancho mm<input type="number" className="numero" min="0" value={c.anchoMM || ''}
                          placeholder="600"
                          onChange={(e) => setPieza(i, { anchoMM: parseFloat(e.target.value) || 0 })}
                          onBlur={(e) => { const v = parseFloat(e.target.value); if (pareceMetros(v)) setPieza(i, { anchoMM: aMilimetros(v) }); }} /></label>
                        <span className="por">×</span>
                        <label>Cant<input type="number" className="numero" min="1" value={cnt}
                          onChange={(e) => setPieza(i, { piezas: parseInt(e.target.value) || 1 })} /></label>
                      </>
                    ) : porHojaDir ? (
                      <label>Fracción de hoja<input type="number" className="numero" step="0.01" min="0" value={c.hojas ?? ''}
                        placeholder="0.8"
                        onChange={(e) => setPieza(i, { hojas: parseFloat(e.target.value) || 0, cantidad: undefined })} /></label>
                    ) : (
                      <label>Cantidad ({ins.unidad})<input type="number" className="numero" step="0.01" min="0" value={c.cantidad}
                        onChange={(e) => setCantidad(i, parseFloat(e.target.value) || 0)} /></label>
                    )}
                    <span className="pieza-sub">{precioUsable(ins) ? pesos2(costoPieza(c, ins, costeo.piezas)) : <strong style={{ color: '#B42318' }} title="Material sin precio: pendiente de capturar (no cuenta como $0)">Pendiente</strong>}</span>
                  </div>
                )}
                {porHojaDir && c.hojas > 0 && (
                  <div className="pieza-calc">
                    = {c.hojas} de hoja {ins.formato?.corto || ''} <span className="gris">(fracción directa, sin merma · {ins.clase === 'indirecta' ? 'comprado' : 'fabricado'})</span>
                  </div>
                )}
                {area && m2 > 0 && (
                  <div className="pieza-calc">
                    = {m2.toFixed(2)} m²{fraccion > 0 && <> · <strong>{fraccion.toFixed(2)} de hoja</strong></>}
                    {' '}<span className="gris">({ins.clase === 'indirecta' ? 'comprado' : 'fabricado'})</span>
                  </div>
                )}
                {area && (pareceMetros(c.largoMM) || pareceMetros(c.anchoMM)) && (
                  <div className="alerta ambar" style={{ marginTop: 6 }}>
                    <span className="texto">
                      Esas medidas están en <strong>milímetros</strong>: {c.largoMM} × {c.anchoMM} mm no llega ni a un centímetro.
                      ¿Querías {(aMilimetros(c.largoMM) / 1000).toFixed(2)} × {(aMilimetros(c.anchoMM) / 1000).toFixed(2)} m?
                    </span>
                    <button className="boton" style={{ minHeight: 36 }}
                      onClick={() => setPieza(i, { largoMM: aMilimetros(c.largoMM), anchoMM: aMilimetros(c.anchoMM) })}>
                      Usar {aMilimetros(c.largoMM)} × {aMilimetros(c.anchoMM)} mm
                    </button>
                  </div>
                )}
                {area && c.largoMM > 0 && c.anchoMM > 0 && costoPieza(c, ins, costeo.piezas) <= 0 && (
                  <div className="alerta ambar" style={{ marginTop: 6 }}>
                    <span className="texto">Esta pieza no está costando nada. Revisa la medida o el precio del material: una pieza en $0 se lleva la cotización entera.</span>
                  </div>
                )}
              </div>
            );
          })}

          <button className="boton fantasma grande" onClick={agregarPieza}>+ Agregar pieza</button>
        </div>

        {/* 3. Desperdicio y lista de compra */}
        <div className="tarjeta">
          <h2>Desperdicio y lista de compra</h2>
          {listaCompra.length === 0 && <p className="ayuda">Aun no hay materiales que se compren por tablero o tramo.</p>}
          {listaCompra.map((c) => {
            const ins = insumos[c.insumoId];
            const fmt = ins.formato;
            // Tablero y lamina se compran por hoja: mostrar tambien la fraccion de hoja (levantamiento Rafa §1)
            const porHoja = fmt && (fmt.tipo === 'tablero' || fmt.tipo === 'lamina') && fmt.medida > 0;
            const fraccion = porHoja ? c.neto / fmt.medida : 0;
            return (
              <div className="renglon-insumo" key={c.insumoId + c.nombre}>
                <span className="nom">
                  {c.nombre}
                  <div className="ayuda">
                    neto {c.neto.toFixed(2)} {porHoja ? 'm²' : ins.unidad}
                    {porHoja && <> <strong>≈ {fraccion.toFixed(2)} de hoja</strong></>}
                    {/* ⚠️ Aquí salía `comprar 0.37792260145122275 tablero` (2026-08-18).
                        El motor NO está mal: para un material con `fraccion` sí se
                        compra 0.38 de hoja, y `comprar()` devuelve la fracción a
                        propósito. Lo que estaba mal era imprimirla CRUDA — 17
                        decimales en la pantalla donde el proyectista trabaja.
                        Entero cuando son tableros, 2 decimales cuando es fracción. */}
                    {' '}→ comprar {Number.isInteger(c.unidades) ? c.unidades : c.unidades.toFixed(2)}
                    {' '}{fmt?.corto || 'u'}{c.unidades > 1 ? 's' : ''} ({c.comprado.toFixed(2)} {ins.unidad})
                  </div>
                </span>
                <span className={`semaforo ${colorMerma(c.pct)}`}>{pct(c.pct)}</span>
                <span className="sub">{pesos2(c.desperdicio)}</span>
              </div>
            );
          })}
          {resultado.desperdicio > 0 && (
            <div className="fila-botones" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <strong>SE VA AL BOTE DE BASURA</strong>
              <strong className="dinero rojo">{pesos2(resultado.desperdicio)}</strong>
            </div>
          )}
          {sugerencia && (
            <div className="alerta ambar" style={{ marginTop: 12 }}>
              <span className="texto">
                Si en vez de {costeo.piezas} haces {sugerencia.piezas}, cada pieza baja a {pesos2(sugerencia.costoUnitario)} — {pesos2(sugerencia.ahorroPorPieza)} menos.
              </span>
              <button className="boton" onClick={() => set({ piezas: sugerencia.piezas })}>Cambiar a {sugerencia.piezas}</button>
            </div>
          )}

          {/* Medida que rinde mejor (6.9) */}
          {sugerenciasMedida.map((s) => (
            <div className="alerta ambar" style={{ marginTop: 12 }} key={s.i}>
              <span className="texto">
                Esta pieza de {(s.actual === 1) ? 'solo deja 1 pieza' : `${s.actual} piezas`} por tablero. Si el cliente acepta{' '}
                <strong>{(s.mejor.largoMM / 1000).toFixed(2)} × {(s.mejor.anchoMM / 1000).toFixed(2)}</strong>, caben {s.mejor.piezasPorTablero} por tablero y el material baja de {pesos2(s.costoAct)} a {pesos2(s.costoNuevo)} por pieza.
              </span>
              <button className="boton" onClick={() => aplicarMedida(s.i, s.mejor.largoMM, s.mejor.anchoMM)}>
                Usar {(s.mejor.largoMM / 1000).toFixed(2)}×{(s.mejor.anchoMM / 1000).toFixed(2)}
              </button>
            </div>
          ))}
        </div>

        <ConfianzaCosteo resultado={resultado} insumos={insumos} />

        {/* 4. Mano de obra */}
        <div className="tarjeta">
          <h2>Mano de obra</h2>
          <div className="fila-botones">
            <button className={`boton ${costeo.modoManoObra === 'horas' ? 'primario' : 'fantasma'}`}
              onClick={() => set({ modoManoObra: 'horas' })}>Por horas medidas</button>
            <button className={`boton ${costeo.modoManoObra === 'porcentaje' ? 'primario' : 'fantasma'}`}
              onClick={() => set({ modoManoObra: 'porcentaje' })}>Por porcentaje</button>
          </div>

          {costeo.modoManoObra === 'horas' ? (
            <div style={{ marginTop: 14 }}>
              {Object.entries(AREAS_LABEL).map(([area, label]) => {
                const h = costeo.horas?.[area] || 0;
                const costoArea = estado.parametros.usarCostoPorArea
                  ? (estado.parametros.costoHoraArea[area] || estado.parametros.costoHora)
                  : estado.parametros.costoHora;
                return (
                  <div className="renglon-insumo" key={area}>
                    <span className="nom">{label}</span>
                    <input type="number" className="numero" step="0.01" min="0" value={h}
                      onChange={(e) => set({ horas: { ...costeo.horas, [area]: parseFloat(e.target.value) || 0 } })} />
                    <span className="sub">{pesos2(h * costoArea)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div className="ayuda" style={{ marginBottom: 6, color: '#8a6d00' }}>Simulación manual (no oficial). El costo oficial se calcula con Alba V1; mover estos factores simula escenarios.</div>
              <label className="etiqueta">Factor de material directo</label>
              <div className="masmenos" style={{ marginBottom: 8 }}>
                <input type="range" min="1" max="99" value={costeo.factorDirecta ?? 55}
                  onChange={(e) => set({ factorDirecta: parseInt(e.target.value) })} style={{ flex: 1 }} />
                <span className="valor">{costeo.factorDirecta ?? 55}%</span>
              </div>
              <div className="chips">
                {ATAJOS.map((a) => (
                  <button key={a.v} className={`chip ${(costeo.factorDirecta ?? 55) === a.v ? 'on' : ''}`}
                    onClick={() => set({ factorDirecta: a.v })}>{a.nombre} {a.v}</button>
                ))}
              </div>
              <div className="espacio" />
              <label className="etiqueta">Factor de material indirecto</label>
              <div className="masmenos">
                <input type="range" min="0" max="40" value={costeo.factorIndirecta ?? 12}
                  onChange={(e) => set({ factorIndirecta: parseInt(e.target.value) })} style={{ flex: 1 }} />
                <span className="valor">{costeo.factorIndirecta ?? 12}%</span>
              </div>
              <GuiaManoObra resultado={resultado} />
            </div>
          )}

          {/* Puente entre modos (6.4) */}
          <PuenteModos resultado={resultado} costeo={costeo} set={set} />
        </div>

        {/* 5. Preparacion, empaque, merma */}
        <div className="tarjeta">
          <h2>Preparacion, empaque y merma</h2>
          <label className="etiqueta">Horas de arranque del lote (preparacion)</label>
          <input type="number" className="numero" min="0" step="0.5" value={costeo.preparacionHoras || 0}
            onChange={(e) => set({ preparacionHoras: parseFloat(e.target.value) || 0 })} />
          <div className="ayuda">Se reparte entre todas las piezas del lote. Un mismo mueble cuesta mas en un lote de 2 que en uno de 50.</div>
          <div className="espacio" />
          <label className="etiqueta">Empaque por pieza ($)</label>
          <input type="number" className="numero" min="0" value={costeo.empaquePorPieza ?? estado.parametros.empaquePorPieza}
            onChange={(e) => set({ empaquePorPieza: parseFloat(e.target.value) || 0 })} />
          <div className="espacio" />
          <label className="etiqueta">Merma de proceso (%)</label>
          <input type="number" className="numero" min="0" max="50" value={costeo.mermaProceso ?? estado.parametros.mermaProceso}
            onChange={(e) => set({ mermaProceso: parseFloat(e.target.value) || 0 })} />
          <div className="ayuda">Porcentaje de piezas que se rehacen.</div>
        </div>

        {/* 6. Gastos de fabrica */}
        <div className="tarjeta">
          <h2>Gastos de fabrica</h2>
          <label className="etiqueta">Porcentaje sobre material directo</label>
          <input type="number" className="numero" min="0" max="100"
            value={costeo.factorIndirectosFabrica ?? estado.parametros.factorIndirectosFabrica}
            onChange={(e) => set({ factorIndirectosFabrica: parseFloat(e.target.value) || 0 })} />
          <div className="ayuda">Renta, luz, sueldos de oficina, herramienta y desperdicio. Va sobre la materia prima directa, no sobre el costo total.</div>
        </div>
      </div>

      {/* ------------------ COLUMNA DERECHA ------------------ */}
      <div className="pegado no-imprimir">
        <div className="tarjeta" style={{ padding: 12, marginBottom: 16 }}>
          <div className="ficha-render" style={{ aspectRatio: '5 / 4', position: 'relative' }}>
            {generando
              ? <div className="render-gen"><span className="render-gen-spin" /><span>Generando render…</span></div>
              : costeo.imagen
                ? <>
                    <img src={costeo.imagen} alt={costeo.nombre || 'Render'} className="ficha-foto" style={renderStale ? { filter: 'grayscale(0.5) opacity(0.7)' } : undefined} />
                    {renderStale && (
                      <div style={{ position: 'absolute', top: 8, left: 8, right: 8, background: '#7a4a00', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, textAlign: 'center' }}>
                        ⚠️ El despiece cambió — este render ya no refleja el mueble. Vuelve a generarlo.
                      </div>
                    )}
                  </>
                : <MiniRender tipo={vistaTipo} w={dimsDeMueble(costeo).w} d={dimsDeMueble(costeo).d} />}
          </div>
          <button className="boton primario" style={{ width: '100%', marginTop: 10 }} disabled={generando} onClick={generarRenderIA}>
            {generando ? 'Generando…' : renderStale ? 'Actualizar render (despiece cambió)' : costeo.imagen ? 'Regenerar render con IA' : 'Generar render con IA'}
          </button>
          {costeo.imagen && !generando && <button className="boton fantasma" style={{ width: '100%', marginTop: 8 }} onClick={() => set({ imagen: undefined })}>Quitar render</button>}
          {errRender && <div className="alerta roja" style={{ marginTop: 8 }}><span className="texto">{errRender}</span></div>}
          <div className="ayuda" style={{ marginTop: 8, textAlign: 'center' }}>{costeo.imagen ? 'Render IA · aparece en la ficha del cliente' : (costeo.nombre || 'Vista del mueble')}</div>
        </div>
        {/* La hoja de costo DEBE usar el mismo margen que el precio de arriba: antes
            tomaba `par.margenObjetivo` (p.ej. 40%) e ignoraba el slider `margen`
            (default 30%), así que mostraba un "precio de lista" distinto al precio
            grande para la MISMA pieza. Se le pasa el margen efectivo. (Para piezas
            de catálogo/Intelisis la hoja usa la lista ×3 y este override no aplica.) */}
        <HojaCosto resultado={resultado} insumos={insumos} pieza={piezaVirtual} parametros={{ ...par, margenObjetivo: margen }} tipo={costeo.tipoProducto} mostrarVolumen={true} />

        <div className="tarjeta roja" style={{ marginTop: 16 }}>
          {/* SIMULADOR vs OFICIAL: un costo oficial SIEMPRE es Alba. Con factores a mano
              esto es una simulación y no puede emitir/cotizar. */}
          {simulando ? (
            <div className="alerta" style={{ border: '1px solid #8a6d00', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>⚠ SIMULADOR — NO OFICIAL</div>
              <div className="ayuda" style={{ margin: '4px 0 8px' }}>Los factores manuales NO modifican el costo certificado del expediente (Alba V1). No se puede cotizar, aprobar ni emitir desde aquí.</div>
              <button className="boton" onClick={volverAAlba}>Volver al costo oficial (Alba V1)</button>
            </div>
          ) : (
            <div className="ayuda" style={{ marginBottom: 10, opacity: 0.8 }}>Costo oficial — <strong>Alba V1</strong>.</div>
          )}
          <label className="etiqueta">Cuanto quieres ganar</label>
          <div className="masmenos" style={{ marginBottom: 10 }}>
            <input type="range" min="0" max="70" value={margen}
              onChange={(e) => set({ margen: parseInt(e.target.value) })} style={{ flex: 1 }} />
            <span className="valor">{margen}%</span>
          </div>
          <div className="precio-grande" style={incompletoC ? { color: '#b22a22' } : undefined}>{incompletoC ? 'Pendiente' : pesos2(precio)}</div>
          <div className="ayuda">{incompletoC ? 'Sin precio: faltan partidas por costear.' : `Precio por pieza con ${margen}% de margen.`}</div>
          {incompletoC && <div className="alerta roja" style={{ marginTop: 10 }}><span className="texto">⚠ Costo INCOMPLETO — faltan por costear {pendientesC.length} partida(s): {pendientesC.slice(0, 6).join(', ')}{pendientesC.length > 6 ? '…' : ''}. No se puede cotizar ni emitir.</span></div>}
          {!incompletoC && bajoMinimo && <div className="alerta roja" style={{ marginTop: 10 }}><span className="texto">Debajo del minimo de {estado.parametros.margenMinimo}%.</span></div>}
          <div className="espacio" />
          {/* Emisión OFICIAL solo cuando es Alba (no simulación) y el costo está completo. */}
          <button className="boton primario grande" disabled={incompletoC || simulando} title={simulando ? 'Simulación: vuelve al costo oficial Alba para cotizar' : incompletoC ? 'No se puede cotizar un costo incompleto' : ''} onClick={() => !incompletoC && !simulando && onAgregarCotizacion(resultado, precio, margen)}>Agregar a la cotización</button>
          <div className="espacio" />
          <button className="boton grande" onClick={() => onGuardarPieza(resultado)}>Guardar como pieza</button>
          <div className="espacio" />
          <button className="boton grande" disabled={incompletoC || simulando} title={simulando ? 'Simulación: no emite ficha oficial' : incompletoC ? 'No se puede imprimir una ficha con precio incompleto' : ''} onClick={() => !incompletoC && !simulando && setFichaAbierta(true)}>Ver ficha PDF</button>
        </div>
      </div>

      {fichaAbierta && (
        <FichaPDF estado={estado} costeo={costeo} cantidad={costeo.piezas} precioUnitario={precio} onCerrar={() => setFichaAbierta(false)} />
      )}

      {/* Barra fija inferior para pantallas angostas */}
      <div className="barra-fija no-imprimir">
        <span>{simulando ? 'Simulación' : incompletoC ? 'Subtotal conocido' : 'Cuesta hacer 1 pieza'} <strong className="mono">{pesos2(resultado.costoUnitario)}</strong></span>
        <span className="precio-grande" style={(incompletoC || simulando) ? { color: '#b22a22' } : undefined}>{incompletoC ? 'Pendiente' : simulando ? 'No oficial' : pesos2(precio)}</span>
      </div>
    </div>
  );
}

// Puente entre horas y porcentaje (6.4)
// Confianza del costeo (2026-09-24): qué parte del material se para sobre
// precios con FUENTE verificada vs precios sin confirmar. La herramienta más
// real no finge precisión: la revela. No cambia ningún costo, solo lo audita.
function ConfianzaCosteo({ resultado, insumos }) {
  const det = (resultado.detalleInsumos || []).filter((d) => (d.costo || 0) > 0);
  const matTot = det.reduce((a, d) => a + d.costo, 0);
  if (matTot <= 0) return null;
  const conFuente = det.filter((d) => insumos[d.insumoId]?.fuente).reduce((a, d) => a + d.costo, 0);
  const pctV = Math.round((conFuente / matTot) * 100);
  const sinFuente = det.filter((d) => !insumos[d.insumoId]?.fuente);
  const palabra = pctV >= 80 ? 'sólido' : pctV >= 50 ? 'parcial' : 'flojo';
  return (
    <div className="tarjeta">
      <h2>Confianza del costeo</h2>
      <div className="ayuda">
        <strong>{pctV}%</strong> del material viene de precios con fuente verificada — respaldo <strong>{palabra}</strong>.
      </div>
      {sinFuente.length > 0 && (
        <div className="alerta ambar" style={{ marginTop: 8 }}>
          <span className="texto">
            {sinFuente.length} {sinFuente.length === 1 ? 'material usa precio' : 'materiales usan precio'} SIN
            fuente confirmada: {sinFuente.map((d) => d.nombre).slice(0, 4).join(', ')}{sinFuente.length > 4 ? '…' : ''}.
            Ese pedazo del costo no es 100% de fiar hasta calibrarlo contra una compra o un T.D.C. real.
          </span>
        </div>
      )}
    </div>
  );
}

// Guía honesta del factor de mano de obra (2026-09-24). NO inventa el factor
// "correcto" (con un solo ejemplo real sería sobreajustar). Hace dos cosas:
//  1) muestra la MO en pesos y como % del costo, para que el estimador vea si
//     el factor que eligió es absurdo (caso banca: 55% daba MO = 43% del costo);
//  2) avisa cuando la pieza es de METAL o mucho COMPRADO — ahí el % sobre
//     material sobreestima la MO (el metal caro y lo comprado no llevan tanto
//     trabajo por peso), y sugiere capturar horas medidas.
function GuiaManoObra({ resultado }) {
  const matTot = resultado.materialTotal || 0;
  const det = resultado.detalleInsumos || [];
  if (matTot <= 0) return null;
  const share = (pred) => det.filter(pred).reduce((a, d) => a + (d.costo || 0), 0) / matTot;
  const metal = share((d) => d.seccion === 'metal');
  const comprado = share((d) => SIN_MO_SECCIONES.has(d.seccion));
  const moShare = resultado.costoFabricacion > 0 ? resultado.manoObra / resultado.costoFabricacion : 0;
  const mezclaFloja = metal + comprado > 0.5; // el % sobre material predice mal la MO

  return (
    <div style={{ marginTop: 12 }}>
      <div className="ayuda">
        Con este factor, la mano de obra es <strong>{pesos2(resultado.manoObra)}</strong> — {pct(moShare * 100)} del costo de fabricar.
      </div>
      {mezclaFloja && (
        <div className="alerta ambar" style={{ marginTop: 8 }}>
          <span className="texto">
            Esta pieza es {pct(metal * 100)} metal y {pct(comprado * 100)} comprado. El factor se cobra
            sobre el material, y ahí <strong>suele inflar la mano de obra</strong> (el metal caro
            y lo comprado no llevan tanto trabajo por peso). Si puedes, captúrala <strong>por horas
            medidas</strong> — o baja el factor. En una banca de metal real la MO fue ~15%, no 55%.
          </span>
        </div>
      )}
    </div>
  );
}

function PuenteModos({ resultado, costeo, set }) {
  const fe = resultado.factorEquivalente;
  if (!isFinite(fe) || resultado.materialDirecto <= 0) return null;
  if (costeo.modoManoObra !== 'horas') {
    return <div className="ayuda" style={{ marginTop: 12 }}>Con estas horas, el factor equivalente seria {pct1(fe)} sobre material directo.</div>;
  }
  if (fe > 99) {
    return (
      <div className="alerta ambar" style={{ marginTop: 12 }}>
        <span className="texto">Con porcentaje esta pieza necesitaria {pct(fe)} — arriba del tope de 99%. Aqui hay que costearla por horas.</span>
      </div>
    );
  }
  return (
    <div className="alerta ambar" style={{ marginTop: 12 }}>
      <span className="texto">Con horas, esta pieza equivale a {pct(fe)} de factor.</span>
      <button className="boton" onClick={() => set({ modoManoObra: 'porcentaje', factorDirecta: Math.round(fe) })}>
        Usar {Math.round(fe)}% y volver a porcentaje
      </button>
    </div>
  );
}
