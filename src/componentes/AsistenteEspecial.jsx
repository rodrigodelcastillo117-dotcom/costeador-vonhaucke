// ============================================================================
//  ASISTENTE ESPECIAL — costear un producto NUEVO desde cero, guiado por
//  preguntas. Arma el despiece pieza por pieza y lo cuesta con el motor real.
//  Es la Fase 1 del flujo "render → preguntas → costo" (la Fase 2 pre-llena
//  este mismo despiece leyendo una imagen con IA).
// ============================================================================
import { useMemo, useState, useEffect, useRef } from 'react';
import { calcular, precioDe, netoComponente, modeloParaPieza, costeoEmitible, bomHash, diffBOM, aplicarDiffBOM, MOTOR_VERSION, FORMULA_ALBA_V1, formulaDePieza } from '../motor/calculo.js';
import { SECCIONES } from '../datos/insumos.js';
import { pesos2 } from '../util.js';
import { dinero, aCentavosEnteros } from '../motor/dinero.js';
import { analizarRender, analizarRenderImagenes, analizarTexto, verificarDespiece, responderDespiece, costearServidor, registrarSombra, hashInput, generarRender, subirRender, guardarRender, guardarConfirmaciones, sesionActual, guardarExpediente, actualizarExpediente, subirPlano, guardarRevisionExpediente, urlABase64 } from '../nube.js';
import { dimsDeMueble, tipoDeMueble } from './MiniRender.jsx';
import { revisarEstructura } from '../datos/revisionEstructural.js';
import { graphFromPropuesta } from '../datos/structuralGraph.js';
import { conAcompanantes } from '../datos/autoInsumos.js';
import { aplicarPoliticaMaterial, estadoMaterialUI, patchConfirmacionUI } from '../datos/materialMatch.js';
import { paginaAImagen } from '../datos/pdfImagen.js';
import { prepararPdfRapido, rasterizarPaginas, paginasAlrededor } from '../datos/pdfPipeline.js';
import Cargando from './Cargando.jsx';
import Markdown from './Markdown.jsx';
import InformeIA from './InformeIA.jsx';

// Reduce una imagen a máx `lado` px y la devuelve como base64 JPEG (payload chico + más barato)
function reducirImagen(file, lado = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ base64: c.toDataURL('image/jpeg', 0.85).split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

// Un PDF (plano) va TAL CUAL a la IA, sin rasterizar: Claude lo lee como
// documento y rasterizarlo perdería las cotas. Mismo patrón que leerPlanoArchivo.
function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    fr.readAsDataURL(file);
  });
}

const esPDF = (file) => file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');

// Paleta de piezas comunes: al tocar una, se agrega al despiece con un material
// por defecto y medidas de arranque. kind define cómo se mete (área/lineal/pieza).
const PARTES = [
  { label: 'Cubierta', material: 'melamina-28', kind: 'area', dims: [1500, 600] },
  { label: 'Faldón', material: 'mdf', kind: 'area', dims: [1500, 400] },
  { label: 'Costado / lateral', material: 'melamina-19', kind: 'area', dims: [600, 720] },
  { label: 'Entrepaño', material: 'melamina-19', kind: 'area', dims: [900, 400] },
  { label: 'Puerta', material: 'melamina-19', kind: 'area', dims: [450, 720] },
  { label: 'Frente de cajón', material: 'melamina-19', kind: 'area', dims: [450, 150] },
  { label: 'Canto', material: 'tapacanto', kind: 'linear' },
  { label: 'Patas / base (PTR)', material: 'ptr', kind: 'linear' },
  { label: 'Estructura lámina', material: 'lamina-20', kind: 'kg' },
  { label: 'Cristal', material: 'cristal-templado', kind: 'area', dims: [1000, 600] },
  { label: 'Mampara / biombo', material: 'acrilico', kind: 'area', dims: [1200, 400] },
  { label: 'Jaladeras', material: 'jaladera', kind: 'pza' },
  { label: 'Bisagras', material: 'bisagra', kind: 'pza' },
  { label: 'Correderas', material: 'corredera', kind: 'pza' },
  { label: 'Cerradura', material: 'cerradura', kind: 'pza' },
  { label: 'Contacto eléctrico', material: 'contacto', kind: 'pza' },
  { label: 'Caja eléctrica', material: 'caja-electrica', kind: 'pza' },
  { label: 'Tela', material: 'tela', kind: 'linear' },
  { label: 'Espuma', material: 'espuma', kind: 'area', dims: [500, 500] },
];


const N_PASOS = 4;

// ¿Esta respuesta async pertenece a la corrida vigente? (anti-contaminación de estado entre
// productos). corridaId null = llamada sin id (legado) → se acepta. Pura y testeable.
export function aceptaCorrida(corridaId, actual) {
  return corridaId == null || corridaId === actual;
}

// Fusiona preguntas pendientes por question_key: conserva las actuales, agrega las nuevas, y NUNCA
// incluye una cuya key ya está confirmada (aunque la IA reformule el texto). Autoridad = question_key.
export function fusionarPreguntas(prev, incoming, confKeysSet, norm) {
  const byKey = new Map();
  for (const raw of (prev || [])) { const q = norm(raw); if (!confKeysSet.has(q.question_key)) byKey.set(q.question_key, q); }
  for (const raw of (incoming || [])) { const q = norm(raw); if (!confKeysSet.has(q.question_key) && !byKey.has(q.question_key)) byKey.set(q.question_key, q); }
  return [...byKey.values()];
}

export default function AsistenteEspecial({ estado, onVerDetalle, onInicio, onBiblioteca, expedienteInicial }) {
  const insumos = estado.insumos;
  const [paso, setPaso] = useState(0);
  const [analizando, setAnalizando] = useState(false);
  const [verificando, setVerificando] = useState(false); // 2ª pasada: la IA critica su propio despiece
  const [errorIA, setErrorIA] = useState('');
  const [catalogoFuente, setCatalogoFuente] = useState(null); // 'canonico' | 'cliente-fallback' (#8: aviso si el catálogo central no estuvo)
  const [preguntasIA, setPreguntasIA] = useState([]);
  const [propuestaIA, setPropuestaIA] = useState(null); // despiece crudo de la IA (para re-costear con respuestas)
  const [respuestas, setRespuestas] = useState({});     // {idx: texto} respuestas del usuario a las preguntas
  const [confirmadas, setConfirmadas] = useState({});   // {textoPregunta: respuesta} acumuladas entre pasadas
  const [confMsg, setConfMsg] = useState('');           // feedback tras aplicar respuestas
  const [respondiendo, setRespondiendo] = useState(false);
  // analysis_id: cada plano nuevo es un EXPEDIENTE ATÓMICO. Si una respuesta async llega con un id
  // viejo (subiste otro producto mientras tanto), se DESCARTA (evita que A pise el estado de B).
  const corrida = useRef(0);
  // Normaliza una pregunta (compat: la IA vieja devolvía string; la nueva, objeto con tipo/impacto…).
  // Clave normalizada de texto (fallback si no hay question_key).
  const kpreg = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  // Normaliza una pregunta; la AUTORIDAD es 'question_key' (ID semántico estable); si falta, kpreg(texto).
  const normPreg = (p) => {
    const base = (typeof p === 'string')
      ? { pregunta: p, tipo: 'texto', opciones: [], impacto: 'medio', afecta: 'costo', supuesto: '' }
      : { tipo: 'texto', opciones: [], impacto: 'medio', afecta: 'costo', supuesto: '', ...p };
    return { ...base, question_key: base.question_key || 'k_' + kpreg(base.pregunta).replace(/\s+/g, '_') };
  };
  // Si una pregunta reaparece en otra pasada, pre-llena con lo que ya contestaste (no re-escribir).
  useEffect(() => {
    if (!preguntasIA.length) return;
    setRespuestas((prev) => {
      const next = { ...prev };
      preguntasIA.forEach((raw) => {
        const q = normPreg(raw);
        if ((next[q.question_key] == null || next[q.question_key] === '') && confirmadas[q.question_key]) next[q.question_key] = confirmadas[q.question_key].respuesta;
      });
      return next;
    });
  }, [preguntasIA]);
  const [analisis, setAnalisis] = useState(null); // {descripcionCliente, materiales, mejoras, fallasProbables, aprovechamiento}
  const [pdfSel, setPdfSel] = useState(null); // selector de hoja de plano multipágina: {doc, numPaginas, pagina, preview}
  // CUTOVER A ALBA (2026-10-01): producto nuevo YA NO lleva factores a mano. Sin
  // factorDirecta/factorIndirecta, calcular() aplica la fórmula de Alba (la misma de
  // las regresiones). Ese era el override legacy 55/12/34 que vivía aquí.
  const [b, setB] = useState({
    nombre: '', piezas: 1, componentes: [], imagen: null, descripcionCliente: '',
    modoManoObra: 'porcentaje',
    margen: estado.parametros?.margenObjetivo ?? 50,
  });
  const set = (parcial) => setB((prev) => ({ ...prev, ...parcial }));

  // Razonamiento estructural (determinista): Voni lee el despiece como CONJUNTO y
  // avisa de relaciones que no cuadran (gaveta sin cuerpo, faldón vertical, asientos
  // sin estructura…). Propone/detecta; NO cambia costo ni medidas.
  const revisionEstructural = useMemo(
    () => revisarEstructura({ componentes: b.componentes, descripcion: b.descripcionCliente }),
    [b.componentes, b.descripcionCliente],
  );
  // ESTRUCTURA QUE ENTENDIÓ VONI: el grafo construido desde la SEMÁNTICA del intérprete
  // canónico (analizar-mueble: design_intent + semantic_role/relaciones). Es el mueble
  // como OBJETO, no piezas sueltas. Null si la propuesta aún no trae design_intent
  // (p. ej. un despiece viejo) → la UI simplemente no muestra el panel.
  const estructuraVoni = useMemo(
    () => (propuestaIA && propuestaIA.design_intent ? graphFromPropuesta(propuestaIA) : null),
    [propuestaIA],
  );

  const { par } = modeloParaPieza(estado.parametros, b);
  const esArea = (ins) => !!ins && (ins.formato?.tipo === 'tablero' || ins.unidad === 'm2');

  // ⚠️ Faltaba `estado.parametros` en las dependencias: si Dirección cambia un
  // parámetro (margen, factor de indirectos, costo por hora…) mientras alguien
  // sigue parado en este asistente, el costo se quedaba congelado con los
  // parámetros de cuando se abrió la pantalla hasta el próximo cambio de pieza.
  // Costeador.jsx y CosteadorLinea.jsx ya traen `estado.parametros`/`par` en su
  // lista; a éste se le había quedado fuera.
  const resultado = useMemo(() => calcular(b, b.piezas, insumos, par), [b, insumos, estado.parametros]);
  const precio = precioDe(resultado.costoUnitario, b.margen);

  // --- SHADOW (Fase 3): compara en paralelo el motor del servidor (JWT real, rol/costos
  // server-side) contra el resultado del cliente y lo registra. Fire-and-forget, debounced,
  // dedup por input: NUNCA bloquea ni cambia lo que ve el usuario. El usuario sigue viendo `precio`.
  const sombraRef = useRef('');
  useEffect(() => {
    if (!(b.componentes?.length) || !(resultado.costoUnitario > 0)) return;
    const pieza = b; // costear-servidor receives technical intent only; server owns model/config/money
    const h = hashInput({ c: b.componentes, n: b.piezas, m: b.margen });
    if (sombraRef.current === h) return; // ya comparado este input
    const t = setTimeout(async () => {
      sombraRef.current = h;
      try {
        const srv = await costearServidor(pieza, b.piezas);
        const precioSrv = srv?.precioVenta ?? null;
        await registrarSombra({
          input_hash: h,
          motor_version: srv?.versionMotor || null,
          version_catalogo: srv?.versionCatalogo || null,
          estado_servidor: srv?.estado || (srv?.ok === false ? 'error' : null),
          http_status: srv?.status ?? (srv?.ok ? 200 : null),
          precio_cliente: dinero(precio),
          precio_servidor: precioSrv != null ? dinero(precioSrv) : null,
          costo_cliente: dinero(resultado.costoUnitario),
          costo_servidor: srv?.costo?.costoUnitario != null ? dinero(srv.costo.costoUnitario) : null,
          diff: precioSrv != null ? dinero(dinero(precio) - dinero(precioSrv)) : null,
          campos_recibidos: srv && typeof srv === 'object' ? Object.keys(srv) : null,
          nota: b.nombre || null,
        });
      } catch (e) { /* shadow silencioso: jamás rompe el flujo */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [b, resultado.costoUnitario, precio, estado.parametros]);

  // --- RENDER V1 (Fase 6): ilustra el producto YA definido; NO lo define ni lo modifica. ---
  const PROMPT_VERSION = 'render-v1-2026-10-01';
  const [renders, setRenders] = useState({ aislado: null, ambiente: null });
  const [renderMsg, setRenderMsg] = useState('');
  const [renderizando, setRenderizando] = useState(false);
  const [costoEstado, setCostoEstado] = useState(null); // 'certificado' | 'preliminar' | null
  // React P0-5: el estado de costo corresponde a UN bomHash. Si el despiece cambia, deja de ser
  // vigente (no puede seguir diciendo "CERTIFICADO" sobre números nuevos). Guardamos el hash con
  // el que se calculó y sólo mostramos el estado si coincide con el BOM actual.
  const [costoEstadoHash, setCostoEstadoHash] = useState(null);
  const marcarCostoEstado = (estado, hash) => { setCostoEstado(estado || null); setCostoEstadoHash(estado ? (hash ?? null) : null); };
  const [renderHash, setRenderHash] = useState(null);   // hash del BOM cuando se generó el render (marca DESACTUALIZADO si cambia)
  // Biblioteca
  const [etiquetasTxt, setEtiquetasTxt] = useState('');
  const [estadoExp, setEstadoExp] = useState('borrador');
  // P0.16: validación SERVER-AUTHORITY vigente para el BOM hash actual (null = sin validar).
  const [validacionSrv, setValidacionSrv] = useState(null); // { valido, razon, estado, costoUnitario, bomHash }
  const [validandoSrv, setValidandoSrv] = useState(false);
  const [guardandoExp, setGuardandoExp] = useState(false);
  const [expId, setExpId] = useState(null);
  const [expMsg, setExpMsg] = useState('');
  const [costoGuardado, setCostoGuardado] = useState(null); // snapshot del costo al guardar (para Δ vs hoy)
  const [revActual, setRevActual] = useState(1);            // nº de revisión del expediente abierto
  // BOM CANÓNICO (audit 2026-10-01): una vez que el despiece se "asienta" (sin
  // preguntas pendientes), se CONGELA. A partir de ahí la IA ya no reemplaza el
  // BOM en silencio: sus cambios llegan como PROPUESTA_DIFF que el usuario acepta
  // o rechaza. Las ediciones manuales de Diseño sí cambian el canónico (y su hash).
  const [canonico, setCanonico] = useState(false);
  const [propuestaDiff, setPropuestaDiff] = useState(null); // {agregar,modificar,eliminar,motivo,iaComps} | null
  const [bomDirty, setBomDirty] = useState(false);          // canónico editado desde el último guardado
  // Fórmula del snapshot reabierto (histórico). null = producto nuevo (vive en Alba).
  // Si un expediente viejo se calculó con legacy55, se reabre reproduciendo ESE costo
  // (no se recalcula solo con Alba); el usuario puede re-costear con Alba aparte.
  const [formulaGuardada, setFormulaGuardada] = useState(null);
  const dimsR = useMemo(() => dimsDeMueble(b), [b]);
  // PRECEDENCIA de materiales/acabado para el render: (1-3) selección/BOM del usuario = materiales
  // de SUPERFICIE de los componentes que tiene/confirmó; (4) leyenda del plano (b.materiales de la
  // IA); (5) ninguna. Una leyenda vieja del plano NUNCA pisa la selección explícita del usuario.
  const matFinish = useMemo(() => {
    const SUP = new Set(['cubiertas', 'mamparas', 'acabados', 'metal', 'tapiceria']);
    const bom = [...new Set((b.componentes || []).map((c) => insumos[c.insumoId]).filter((x) => x && SUP.has(x.seccion)).map((x) => x.nombre))];
    if (bom.length) return { lista: bom.slice(0, 8), fuente: 'seleccion' };
    if (Array.isArray(b.materiales) && b.materiales.length) return { lista: b.materiales, fuente: 'plano' };
    return { lista: [], fuente: 'ninguna' };
  }, [b.componentes, b.materiales, insumos]);
  const materialesR = matFinish.lista;
  // Dos fidelidades SEPARADAS (no "alta" solo por existir plano):
  //  GEOMÉTRICA: alta (plano con cotas/escala) · media (plano parcial, sin escala) · limitada (foto/texto)
  //  ACABADO:    confirmado (material/color de fuente explícita) · pendiente (sin definir → neutro)
  const geomFid = (Array.isArray(b.planos) && b.planos.length)
    ? (analisis?.confianzaGeneral === 'alta' ? 'alta' : 'media') : 'limitada';
  const acabadoFid = matFinish.fuente === 'ninguna' ? 'pendiente' : 'confirmado';
  // INCOMPLETO: piezas del despiece SIN material en catálogo → se costean en $0 → el total sale BAJO.
  const piezasSinMaterial = resultado.componentesIgnorados || [];
  const costoIncompleto = piezasSinMaterial.length > 0;
  // FAIL-CLOSED (audit 2026-10-01): si el costo está incompleto NO es emitible —
  // su total es apenas un SUBTOTAL CONOCIDO, no se le pone precio ni se aprueba.
  const emision = costeoEmitible(resultado);
  const emitible = emision.emitible;
  // P0.16: ¿hay una validación server-authority VIGENTE para el BOM actual? Cualquier cambio de
  // componente/material/medida cambia el bomHash → invalida la validación anterior.
  const validacionVigente = !!validacionSrv && validacionSrv.valido === true && validacionSrv.bomHash === bomHash(b.componentes);
  // React P0-5: el estado de costo sólo es VIGENTE si se calculó con el BOM actual. Si el despiece
  // cambió, no se muestra "CERTIFICADO/PRELIMINAR" viejo: cae al default seguro (preliminar).
  const costoEstadoVigente = (costoEstado && costoEstadoHash && costoEstadoHash === bomHash(b.componentes)) ? costoEstado : null;
  // POR CONFIRMAR (audit 2026-10-08): materiales provisionales (18→19 compatible, crítico,
  // ambiguo, candidato). El COMPATIBLE sí aporta costo → hay un COSTO PROVISIONAL real, pero
  // NO emitible hasta confirmación humana. Distinto de "sin material" (hueco de datos).
  const materialesPorConfirmar = emision.bloqueos?.materiales_por_confirmar || [];
  const soloPorConfirmar = !emitible && materialesPorConfirmar.length > 0
    && piezasSinMaterial.length === 0 && (resultado.tarifasFaltantes || []).length === 0;
  // Fórmula que está aplicando AHORA la pieza (Alba para producto nuevo; legacy solo
  // si se reabrió un histórico sin re-costear). Para etiquetar el costo, no recalcula.
  const formulaActual = formulaDePieza(b);
  const esHistoricoLegacy = !!formulaGuardada && formulaActual !== FORMULA_ALBA_V1;
  // Firma CANÓNICA del render: sólo datos persistentes/reproducibles.
  // BOM + dimensiones + materiales. Si cualquiera cambia, el render deja de ser canónico.
  const renderFirmaActual = hashInput({ c: b.componentes, d: [dimsR.w, dimsR.d], mats: materialesR });
  const renderObsoleto = !!(renders.aislado || renders.ambiente) && renderHash !== renderFirmaActual;
  // Falta información crítica para ilustrar fielmente: se avisa, NO se inventa.
  const faltaCritico = !b.nombre?.trim() || !(b.componentes?.length) || !(dimsR.w > 0);

  // Infiere el ENTORNO real del producto (no siempre oficina): exhibidores/retail → tienda.
  function entornoDe() {
    const txt = `${b.nombre || ''} ${tipoDeMueble(b)} ${materialesR.join(' ')} ${b.descripcionCliente || ''}`.toLowerCase();
    const retail = /alpura|exhibidor|exibidor|supermercado|tienda|abarrot|refriger|charola|anaquel|g[oó]ndola|retail|oxxo|punto de venta|display|bimbo|coca|sabritas|lala/.test(txt);
    return retail
      ? { tipo: 'retail', txt: 'modern supermarket / retail store aisle with product shelving, refrigerators and bright retail lighting, polished floor' }
      : { tipo: 'oficina', txt: 'modern corporate office with warm oak furniture and natural daylight' };
  }
  // Guarda metadata. El camino nuevo recibe URL/path ya persistidos por la Edge;
  // el fallback legacy todavía puede recibir dataUrl y subirlo desde el browser.
  async function persistir(renderResult, modo, tipo, entornoTipo) {
    let storagePath = renderResult?.storagePath || null;
    let storageUrl = renderResult?.url || null;
    const dataUrl = renderResult?.dataUrl || null;
    if (!storageUrl && dataUrl) {
      const path = `nuevo/${hashInput({ n: b.nombre, c: b.componentes })}/${modo}-${Date.now()}.png`;
      const up = await subirRender(dataUrl, path);
      if (up.ok) { storagePath = up.path; storageUrl = up.url; }
    }
    if (storageUrl) {
      await guardarRender({
        producto_nombre: b.nombre, producto_version: null, prompt_version: PROMPT_VERSION,
        categoria: tipo, ancho_mm: dimsR.w, fondo_mm: dimsR.d, alto_mm: null, modo,
        storage_path: storagePath, storage_url: storageUrl,
        inputs: { materiales: materialesR, notas: b.descripcionCliente || null, piezas: (b.componentes || []).length, entorno: entornoTipo || null, render_hash: renderFirmaActual },
        costo_estado: costoEstado || 'preliminar', estado: 'preliminar',
      });
      return storageUrl;
    }
    return dataUrl; // sólo fallback visual; nunca se persiste base64 en metadata
  }

  async function generarRenders() {
    if (faltaCritico || renderizando) return;
    if (b.analysisId != null && b.analysisId !== corrida.current) return; // BOM/costo no son de la corrida vigente
    setRenderizando(true); setRenderMsg(''); setRenders({ aislado: null, ambiente: null });
    try { const hb = bomHash(b.componentes); const srv = await costearServidor({ ...b }, b.piezas); if (srv?.estado) marcarCostoEstado(srv.estado, hb); }
    catch (e) { console.warn('[generarRenders] re-costeo de servidor no disponible, sigo con el costo actual:', e); }
    const tipo = tipoDeMueble(b);
    const medidas = `${dimsR.w}×${dimsR.d} mm`;
    // DESPIECE → RENDER: la IA debe ENTENDER la estructura que armaste a mano
    // (cubierta de mármol, lateral de MDF, gaveta de lámina…), no inventar una mesa
    // genérica. Se le nombran las partes con su material y medida. Sin esto, el render
    // sólo conocía tipo+materiales sueltos y salía un volumen cualquiera.
    const despieceTxt = (b.componentes || [])
      .filter((c) => c && (c.nombre || c.insumoId))
      .map((c) => {
        const mat = estado.insumos?.[c.insumoId]?.nombre || '';
        const dim = (c.largoMM && c.anchoMM) ? ` ${c.largoMM}×${c.anchoMM} mm` : '';
        const etq = c.nombre || mat || 'pieza';
        return mat && mat !== etq ? `${etq} (${mat}${dim})` : `${etq}${dim}`;
      })
      .filter(Boolean).join('; ');
    const texto = `${b.nombre}. Tipo ${tipo}. Medidas exactas ${medidas}.`
      + (b.descripcionCliente ? ` Descripción: ${b.descripcionCliente}.` : '')
      + (despieceTxt ? ` Partes que lo componen (respeta esta estructura): ${despieceTxt}.` : '')
      + (materialesR.length ? ` Materiales y acabados: ${materialesR.join(', ')}.` : '');
    const ent = entornoDe();
    // Páginas/vistas del plano (base64 raw). La fidelidad (geomFid/acabadoFid) ya está derivada arriba.
    const paginas = Array.isArray(b.planos) ? b.planos.filter(Boolean) : [];
    // Elementos que el render DEBE conservar (los nombra el propio producto). No describe forma: refuerza fidelidad.
    const preservar = [b.nombre, b.descripcionCliente].filter(Boolean).join('. ').slice(0, 400);

    // 1) PRODUCTO AISLADO — el PLANO (todas sus vistas) es la fuente de verdad de la forma (modo catálogo).
    //    Sin plano, cae a 'render' por texto (menos fiel, se avisa).
    let aisladoDataUrl = null;
    let aisladoUrl = null;
    try {
      const opt = paginas.length
        ? { modo: 'catalogo', medidas, tipo, materiales: materialesR, imagen: paginas[0], mediaType: 'image/jpeg', imagenes: paginas.slice(1, 6), preservar }
        : { modo: 'render', medidas, tipo, materiales: materialesR };
      const r = await generarRender(texto, opt);
      if (r?.ok && (r.url || r.dataUrl)) {
        aisladoDataUrl = r.dataUrl || null;
        const url = await persistir(r, 'aislado', tipo, ent.tipo);
        aisladoUrl = url || null;
        setRenders((s) => ({ ...s, aislado: url }));
        const avisos = [];
        if (geomFid === 'limitada') avisos.push('Sin plano cargado: el aislado se generó por descripción (geometría limitada). Sube el plano para fidelidad exacta.');
        else if (geomFid === 'media') avisos.push('Plano sin escala/cotas claras: geometría media. Da una medida de referencia o sube más vistas para subirla a alta.');
        if (acabadoFid === 'pendiente') avisos.push('Acabado por confirmar: sin materiales/color definidos, el render usa un acabado neutro. Elige los materiales arriba para ver el acabado real.');
        if (avisos.length) setRenderMsg(avisos.join(' '));
      } else { setRenderMsg(r?.error || 'No se pudo generar el producto aislado.'); }
    } catch (e) { setRenderMsg('Error en producto aislado: ' + String(e)); }

    // 2) EN AMBIENTE — coloca el MISMO producto (usa el aislado ya renderizado como referencia,
    //    o el plano) en su ENTORNO real inferido (supermercado para exhibidores, oficina si no).
    try {
      const prodUrl = aisladoUrl || null;
      let prod = aisladoDataUrl || b.imagen;
      if (!prod && prodUrl) prod = await urlABase64(prodUrl);
      const prodRaw = prod ? String(prod).split(',')[1] : '';
      const prodMime = prod ? ((String(prod).match(/data:(.*?);/) || [])[1] || 'image/png') : 'image/png';
      if (prodRaw) {
        const r = await generarRender(texto, { modo: 'ambiente', medidas, tipo, materiales: materialesR, imagen: prodRaw, mediaType: prodMime, entorno: ent.txt });
        if (r?.ok && (r.url || r.dataUrl)) {
          const url = await persistir(r, 'ambiente', tipo, ent.tipo);
          setRenders((s) => ({ ...s, ambiente: url }));
        } else { setRenderMsg(r?.error || 'No se pudo generar el ambiente.'); }
      }
    } catch (e) { setRenderMsg('Error en ambiente: ' + String(e)); }
    setRenderHash(renderFirmaActual); // BOM + dimensiones + materiales exactos
    setRenderizando(false);
  }

  // Guarda (o actualiza) el producto como EXPEDIENTE en la biblioteca: nombre, etiquetas, BOM,
  // costo (snapshot con fecha), render y plano (a Storage). Editable luego por Diseño.
  // P0.16 — AUTORIDAD DEL SERVIDOR para aprobar. El juez local (costeoEmitible) NO basta: el
  // mismo BOM puede verse EXACT/emitible en el cliente pero el servidor (que reclasifica sin
  // provenance, exige confirmación/capability y compara a centavos) lo marca provisional/
  // incompleto. Devuelve { valido, razon, estado, costoUnitario, bomHash }.
  async function validarServidorParaAprobar() {
    const hashActual = bomHash(b.componentes);
    try {
      const srv = await costearServidor({ ...b }, b.piezas);
      const costoSrv = srv?.costo?.costoUnitario;
      const estadoSrv = srv?.estado || null;
      const ok = srv?.ok === true;
      const costoFinito = Number.isFinite(Number(costoSrv));
      const estadoOK = ok && !!estadoSrv && estadoSrv !== 'incompleto' && estadoSrv !== 'bloqueado';
      const cL = aCentavosEnteros(resultado.costoUnitario);
      const cS = costoFinito ? aCentavosEnteros(costoSrv) : null;
      const cuadra = cL != null && cS != null && cL === cS;   // costo técnico local == servidor, a centavos
      const valido = ok && estadoOK && costoFinito && cuadra;
      let razon = '';
      if (!ok) razon = 'el servidor no validó el costo.';
      else if (!estadoOK) razon = `el servidor marca el costo como ${estadoSrv || 'no emitible'} (faltan confirmaciones de material).`;
      else if (!costoFinito) razon = 'el costo del servidor no es finito.';
      else if (!cuadra) razon = `el costo local (${pesos2(resultado.costoUnitario)}) no coincide con el del servidor (${pesos2(costoSrv)}).`;
      const v = { valido, razon, estado: estadoSrv, costoUnitario: costoSrv, bomHash: hashActual };
      setValidacionSrv(v);
      if (estadoSrv) marcarCostoEstado(estadoSrv, hashActual);
      return v;
    } catch (_e) {
      const v = { valido: false, razon: 'no se pudo contactar al servidor de costeo.', bomHash: hashActual };
      setValidacionSrv(v);
      return v;
    }
  }

  async function guardarEnBiblioteca() {
    if (guardandoExp) return;
    if (!b.nombre?.trim() || !(b.componentes?.length)) { setExpMsg('Falta nombre y despiece para guardar.'); return; }
    setGuardandoExp(true); setExpMsg('');
    try {
      let quien = null; try { quien = (await sesionActual())?.user?.email || null; } catch (_e) {}
      const base = `exp/${hashInput({ n: b.nombre, c: b.componentes })}`;
      const planos = Array.isArray(b.planos) ? b.planos.filter(Boolean) : [];
      const planoUrls = [];
      for (let i = 0; i < Math.min(planos.length, 8); i++) {
        const up = await subirPlano(planos[i], `${base}/plano-${i}-${Date.now()}.jpg`);
        if (up.ok && up.url) planoUrls.push(up.url);
      }
      const soloHttp = (u) => (typeof u === 'string' && u.startsWith('http')) ? u : null;
      const etiquetas = etiquetasTxt.split(',').map((s) => s.trim()).filter(Boolean);
      // FAIL-CLOSED al guardar: un costo incompleto NUNCA se guarda como APROBADO ni
      // con un precio "oficial". Se degrada a borrador, estado_costo=incompleto y
      // precio=null. Así la biblioteca no conserva un número de venta sin respaldo.
      // P0.16: APROBAR exige validación SERVER-AUTHORITY del BOM actual. Si el servidor bloquea
      // o el costo no cuadra a centavos → se degrada a borrador (precio/costoTotal = null).
      let aprobadoBloqueado = false;
      if (emitible && estadoExp === 'aprobado') {
        const v = await validarServidorParaAprobar();
        if (!v.valido) { aprobadoBloqueado = true; setExpMsg(`No se puede aprobar: ${v.razon} Se guarda como borrador.`); }
      }
      const estadoGuardar = aprobadoBloqueado ? 'borrador' : (emitible ? estadoExp : 'borrador');
      // Tras un bloqueo del servidor NO se persiste costoTotal ni precio (sin respaldo server-authority).
      const emitibleGuardar = emitible && !aprobadoBloqueado;
      const estadoCostoGuardar = !emitibleGuardar ? 'incompleto' : (costoEstado || 'preliminar');
      const exp = {
        nombre: b.nombre.trim(), etiquetas, estado: estadoGuardar,
        producto_tipo: tipoDeMueble(b), ancho_mm: dimsR.w, fondo_mm: dimsR.d, alto_mm: null,
        descripcion: b.descripcionCliente || null, materiales: materialesR, bom: b.componentes,
        // IDENTIDAD DE REVISIÓN congelada (audit 2026-10-01): mismo bom_hash + mismo
        // catálogo + mismo motor ⇒ mismo costo a centavos. Guardamos todo lo que define
        // esa identidad para poder reconstruir/verificar cualquier revisión.
        costo: { costoUnitario: dinero(resultado.costoUnitario), subtotalConocido: dinero(emision.subtotalConocido), costoTotal: emitibleGuardar ? dinero(resultado.costoUnitario) : null, materialTotal: dinero(resultado.materialTotal), manoObra: dinero(resultado.manoObra), indirectosFabrica: dinero(resultado.indirectosFabrica), precio: emitibleGuardar ? dinero(precio) : null, margen: b.margen, estado_costo: estadoCostoGuardar, validado_servidor: emitibleGuardar && estadoGuardar === 'aprobado' ? (validacionSrv?.bomHash === bomHash(b.componentes)) : false, pendientes: emision.pendientes, bom_hash: bomHash(b.componentes), analysis_id: b.analysisId ?? null, version_motor: MOTOR_VERSION, formula_version: formulaDePieza(b), version_catalogo: 'config-legado', factorDirecta: b.factorDirecta ?? null, factorIndirecta: b.factorIndirecta ?? null, render_hash: renderHash === renderFirmaActual ? renderHash : null, fecha: new Date().toISOString() },
        confirmaciones: Object.entries(confirmadas).map(([question_key, v]) => ({ question_key, pregunta: v.pregunta, respuesta: v.respuesta })),
        plano_urls: planoUrls.length ? planoUrls : (expId ? undefined : []),
        render_aislado_url: soloHttp(renders.aislado), render_ambiente_url: soloHttp(renders.ambiente),
        analysis_hash: hashInput({ c: b.componentes, n: b.piezas, m: b.margen }),
      };
      if (planoUrls.length === 0 && !expId) exp.plano_urls = [];
      if (exp.plano_urls === undefined) delete exp.plano_urls; // al actualizar sin planos nuevos, no pisa los guardados
      const snap = (eid, rev) => ({ expediente_id: eid, rev, creado_por: quien, nombre: exp.nombre, bom: exp.bom, costo: exp.costo, confirmaciones: exp.confirmaciones, materiales: exp.materiales, plano_urls: planoUrls, render_aislado_url: exp.render_aislado_url, render_ambiente_url: exp.render_ambiente_url, analysis_hash: exp.analysis_hash });
      if (expId) {
        const nuevaRev = revActual + 1;
        const r = await actualizarExpediente(expId, { ...exp, revision: nuevaRev, actualizado_por: quien });
        if (r.ok) { await guardarRevisionExpediente(snap(expId, nuevaRev)); setRevActual(nuevaRev); setCostoGuardado(exp.costo); setBomDirty(false); setExpMsg(`✓ Actualizado — revisión ${nuevaRev}`); }
        else setExpMsg(r.error || 'No se pudo actualizar.');
      } else {
        const r = await guardarExpediente({ ...exp, plano_urls: planoUrls, revision: 1, creado_por: quien });
        if (r.ok) { setExpId(r.id); await guardarRevisionExpediente(snap(r.id, 1)); setRevActual(1); setCostoGuardado(exp.costo); setBomDirty(false); setExpMsg('✓ Guardado en la biblioteca'); }
        else setExpMsg(r.error || 'No se pudo guardar.');
      }
    } finally { setGuardandoExp(false); }
  }

  // Reabrir un expediente de la biblioteca: carga su BOM/costo/render como corrida nueva.
  useEffect(() => {
    if (!expedienteInicial) return;
    const e = expedienteInicial;
    const id = ++corrida.current;
    // CONSERVAR HISTÓRICO (cutover 2026-10-01): un expediente se reabre reproduciendo
    // el costo con el que se guardó. Si fue ALBA_V1 → sin factores (vive en Alba). Si
    // fue legacy (o un save viejo pre-cutover, sin marca) → con sus factores (55/12 por
    // defecto), para que el número mostrado sea el histórico, NO un recálculo con Alba.
    const c = e.costo || {};
    const esAlbaGuardada = c.formula_version === FORMULA_ALBA_V1;
    const factorDirectaHist = esAlbaGuardada ? undefined : (c.factorDirecta ?? 55);
    const factorIndirectaHist = esAlbaGuardada ? undefined : (c.factorIndirecta ?? 12);
    setFormulaGuardada(c.formula_version || formulaDePieza({ factorDirecta: factorDirectaHist, factorIndirecta: factorIndirectaHist }));
    setB((prev) => ({ ...prev, nombre: e.nombre || '', componentes: Array.isArray(e.bom) ? e.bom : [], piezas: 1, margen: e.costo?.margen ?? prev.margen, descripcionCliente: e.descripcion || '', materiales: Array.isArray(e.materiales) ? e.materiales : [], planos: [], imagen: null, factorDirecta: factorDirectaHist, factorIndirecta: factorIndirectaHist, analysisId: id }));
    setExpId(e.id); setRevActual(e.revision || 1); setEtiquetasTxt((e.etiquetas || []).join(', ')); setEstadoExp(e.estado || 'borrador');
    setConfirmadas(Object.fromEntries((e.confirmaciones || []).map((c) => [c.question_key || ('k_' + kpreg(c.pregunta).replace(/\s+/g, '_')), { pregunta: c.pregunta, respuesta: c.respuesta }])));
    setRenders({ aislado: e.render_aislado_url || null, ambiente: e.render_ambiente_url || null });
    setRenderHash(e.costo?.render_hash || null); // legacy sin firma queda NO canónico hasta regenerar
    marcarCostoEstado(e.costo?.estado_costo || null, e.costo?.bom_hash || null); setCostoGuardado(e.costo || null); setExpMsg(''); setConfMsg(''); setPreguntasIA([]); setAnalisis(null);
    // Un expediente guardado trae un BOM YA CONSOLIDADO: es canónico. Su hash debe
    // coincidir con el guardado (misma identidad de revisión al cerrar/reabrir).
    setCanonico(true); setPropuestaDiff(null); setBomDirty(false);
    setPaso(1);
    // Recupera el PLANO original de Storage como base64 → re-render conserva fidelidad geométrica.
    (async () => {
      const urls = Array.isArray(e.plano_urls) ? e.plano_urls.filter(Boolean) : [];
      if (!urls.length) return;
      const b64s = (await Promise.all(urls.slice(0, 8).map(urlABase64))).filter(Boolean);
      if (b64s.length && corrida.current === id) setB((prev) => ({ ...prev, planos: b64s }));
    })();
  }, [expedienteInicial]);

  // --- despiece ---
  // EDICIÓN MANUAL (Diseño): cambia el BOM canónico de forma explícita. Precedencia
  // máxima: una edición humana NO la puede revertir la IA en silencio (sus cambios
  // van por PROPUESTA_DIFF). Sobre el canónico, cada edición ensucia la revisión.
  const editarComponentes = (comps) => { set({ componentes: comps }); if (canonico) setBomDirty(true); };
  function agregarParte(p) {
    const comp = { nombre: p.label, insumoId: p.material, piezas: 1, cantidad: 1 };
    if (p.kind === 'area' && p.dims) { comp.largoMM = p.dims[0]; comp.anchoMM = p.dims[1]; }
    editarComponentes([...b.componentes, comp]);
  }
  function setPieza(i, parcial) {
    const comps = b.componentes.slice(); comps[i] = { ...comps[i], ...parcial }; editarComponentes(comps);
  }
  function quitarPieza(i) { editarComponentes(b.componentes.filter((_, j) => j !== i)); }
  function onMaterial(i, insumoId, { confirmado = false } = {}) {
    const ins = insumos[insumoId]; const comps = b.componentes.slice(); const prev = comps[i];
    const patch = { insumoId, nombre: prev.nombre || (ins ? ins.nombre : '') };
    if (!esArea(ins)) { patch.largoMM = undefined; patch.anchoMM = undefined; }
    // Elección/confirmación HUMANA: misma intención en ambas UIs (P0.8). El servidor verifica
    // material_confirmado + insumoId y lo convierte a USER_CONFIRMED efectivo (no confía en el string).
    if (ins) Object.assign(patch, patchConfirmacionUI(insumoId));
    comps[i] = { ...prev, ...patch }; editarComponentes(comps);
  }
  function costoPieza(c, ins) {
    const neto = netoComponente(c, b.piezas); const p = ins.precio ?? ins.precioBase ?? 0;
    if (ins.formato && ins.fraccion) { const ap = (par.aprovechamientoCorte || 100) / 100; return (neto / (ins.formato.medida * ap)) * p; }
    return neto * p;
  }

  // Analiza una imagen (base64) con la IA y pre-llena las piezas. Centraliza lo
  // que comparten el render, la imagen y las hojas de PDF. Devuelve true si ok.
  const catalogoIA = () => Object.values(insumos).map((x) => ({ id: x.id, nombre: x.nombre, seccion: x.seccion, unidad: x.unidad }));

  // Mapea el despiece CRUDO de la IA a los `componentes` del motor. Única fuente de
  // esta conversión (la usan aplicarPropuesta y el camino de PROPUESTA_DIFF).
  const mapIaComps = (p) => (p?.piezas || []).map((z) => {
    // POLÍTICA DE MATERIAL (misma que Costeador): nunca sustituye una familia por
    // otra en silencio (solid surface jamás cae en MDF/HPL). Sólo EXACT/EQUIV
    // conservan insumoId; el resto queda '' + bandera `_match`.
    const base = aplicarPoliticaMaterial({ ...z, material_solicitado: z.material_solicitado || z.nombre }, (id) => insumos[id], Object.values(insumos));
    if (z.forma === 'area') {
      base.forma = 'area'; // se preserva: el motor usa `forma:'area'` para exigir medida (silent P0-1)
      base.largoMM = z.largoMM || 0; base.anchoMM = z.anchoMM || 0; base.piezas = z.cantidad || 1; base.cantidad = 1;
      // La IA ya estimó la fracción de hoja que rinde: el motor la usa directa
      // (hojas × precio) en vez de re-nestear áreas, que es lo que oscilaba.
      if (z.hojas > 0) base.hojas = z.hojas;
    }
    return base;
  });

  function aplicarPropuesta(res, dataUrl, planos, nuevoAnalisis = false, corridaId = null, yaConf = null) {
    // DESCARTE de respuesta async vieja: si ya empezó otra corrida (otro plano), ignórala.
    if (!aceptaCorrida(corridaId, corrida.current)) return false;
    if (!res?.ok) { setErrorIA(res?.error || 'No se pudo analizar.'); return false; }
    setCatalogoFuente(res.catalogoFuente || null);   // #8: si fue 'cliente-fallback', se avisa (no cotizar en firme)
    const p = res.propuesta || {};
    const comps = conAcompanantes(mapIaComps(p));
    // planos: TODAS las páginas/vistas del plano (base64 raw) para referencia múltiple del render.
    const paginas = Array.isArray(planos) && planos.length ? planos : (dataUrl ? [String(dataUrl).split(',')[1]] : []);
    // Un ANÁLISIS NUEVO (subiste otro plano) nombra el producto desde el plano, para que el nombre
    // NO se quede pegado de un producto anterior. Una re-corrida con respuestas conserva el nombre.
    setB((prev) => ({ ...prev, nombre: nuevoAnalisis ? (p.producto || prev.nombre || '') : (prev.nombre || p.producto || ''), componentes: comps, imagen: dataUrl || null, planos: paginas, descripcionCliente: p.descripcionCliente || '', materiales: Array.isArray(p.materiales) ? p.materiales : [], analysisId: corrida.current }));
    setAnalisis({
      descripcionCliente: p.descripcionCliente || '',
      materiales: Array.isArray(p.materiales) ? p.materiales : [],
      informe: p.informe || '',
      volumenAsumido: p.volumenAsumido || '',
      confianzaGeneral: p.confianzaGeneral || '',
    });
    // AUTORIDAD = question_key. Fusiona las preguntas entrantes con las pendientes actuales por key,
    // y NUNCA reabre una ya contestada (aunque la IA la reformule). No "reemplaza" → acumula en un solo centro.
    const confKeys = new Set(Object.keys(yaConf || confirmadas));
    const incoming = Array.isArray(p.preguntas) ? p.preguntas : [];
    if (nuevoAnalisis) {
      // Análisis nuevo: el centro de preguntas arranca limpio. Si la IA no abre
      // ninguna pregunta, el BOM queda ASENTADO → se canoniza de una vez.
      const fused = fusionarPreguntas([], incoming, confKeys, normPreg);
      setPreguntasIA(fused);
      setCanonico(fused.length === 0);
      setPropuestaDiff(null); setBomDirty(false);
    } else {
      setPreguntasIA((prev) => fusionarPreguntas(prev, incoming, confKeys, normPreg));
    }
    setPropuestaIA(p);        // guarda el despiece crudo para re-costear con las respuestas
    setRespuestas({});        // limpia respuestas previas
    // El despiece cambió: el render viejo ya no corresponde → se limpia para forzar uno nuevo.
    setRenders({ aislado: null, ambiente: null }); setCostoEstado(null); setRenderMsg('');
    setPaso(1);
    return true;
  }

  // NUEVO EXPEDIENTE ATÓMICO: cada plano nuevo arranca una corrida y LIMPIA de inmediato todo el
  // estado del producto anterior (nombre, análisis, BOM, costo, confirmaciones, render, warnings).
  // Devuelve el id de corrida para amarrar nombre/BOM/costo/render y descartar respuestas viejas.
  function nuevaCorrida() {
    const id = ++corrida.current;
    setErrorIA(''); setPreguntasIA([]); setPropuestaIA(null); setRespuestas({}); setConfirmadas({}); setConfMsg('');
    setAnalisis(null); setRenders({ aislado: null, ambiente: null }); setCostoEstado(null); setRenderMsg('');
    setExpId(null); setEtiquetasTxt(''); setExpMsg(''); setEstadoExp('borrador'); setCostoGuardado(null); setRenderHash(null); setRevActual(1); // nuevo producto = nuevo expediente
    setCanonico(false); setPropuestaDiff(null); setBomDirty(false); setFormulaGuardada(null); // producto nuevo = sin BOM canónico, vive en Alba
    setB((prev) => ({ ...prev, nombre: '', componentes: [], imagen: null, planos: [], descripcionCliente: '', materiales: [], analysisId: id }));
    return id;
  }

  // DESCRIBE → VONI ENTIENDE: analiza la descripción en TEXTO (sin imagen) con el
  // intérprete canónico (analizar-mueble, modo texto). Pre-llena el BOM y trae la
  // estructura (design_intent + roles) para "Estructura propuesta". El motor costea;
  // la IA no inventa precio.
  async function analizarDescripcion() {
    const desc = (b.descripcionCliente || '').trim();
    if (desc.length < 8) { setErrorIA('Escribe una descripción un poco más completa (material, partes, uso) para que Voni la entienda.'); return; }
    const id = nuevaCorrida();          // arranca corrida limpia (la descripción viaja aparte)
    setErrorIA(''); setAnalizando(true);
    try {
      const res = await analizarTexto(catalogoIA(), desc);
      const ok = aplicarPropuesta(res, null, [], true, id);   // mapea piezas, guarda propuesta (con design_intent), va a paso 1
      // Si falló, no pierdas lo que el usuario escribió (nuevaCorrida lo había limpiado).
      if (!ok && aceptaCorrida(id, corrida.current)) setB((prev) => ({ ...prev, descripcionCliente: desc }));
    } catch (err) {
      if (aceptaCorrida(id, corrida.current)) { setErrorIA(String(err?.message || err)); setB((prev) => ({ ...prev, descripcionCliente: desc })); }
    } finally {
      if (aceptaCorrida(id, corrida.current)) setAnalizando(false);
    }
  }

  function requiereVerificacionVisual(propuesta, paginas = 1) {
    if (!propuesta || typeof propuesta !== 'object') return false;
    if (paginas > 1) return true; // varias vistas: conviene reconciliar cotas entre hojas
    if (propuesta.confianzaGeneral !== 'alta') return true;
    if ((propuesta.piezas || []).some((p) => p?.confianza === 'baja' || p?.material_match !== 'EXACT')) return true;
    if ((propuesta.preguntas || []).some((q) => q?.impacto === 'alto')) return true;
    if ((propuesta.design_intent?.missing_critical_data || []).length) return true;
    return false;
  }

  // Una imagen (render/hoja). Paso 1: analiza. Paso 2 (solo imágenes, no PDF crudo):
  // la IA verifica su propio despiece contra las cotas. Devuelve true si ok.
  async function analizarYLlenar(base64, mediaType, dataUrl, corridaId) {
    const v1 = await analizarRender(catalogoIA(), base64, mediaType);
    if (!v1?.ok || mediaType === 'application/pdf' || !requiereVerificacionVisual(v1.propuesta, 1))
      return aplicarPropuesta(v1, dataUrl, [base64], true, corridaId);
    setVerificando(true);
    const v2 = await verificarDespiece(catalogoIA(), [base64], v1.propuesta);
    setVerificando(false);
    // La verificación es SILENCIOSA: las confirmaciones salen de la 1ª pasada (v1), no de v2.
    const merged = v2?.ok ? { ...v2, propuesta: { ...v2.propuesta, preguntas: (v2.propuesta?.preguntas?.length ? v2.propuesta.preguntas : (v1.propuesta?.preguntas || [])) } } : v2;
    return aplicarPropuesta(merged, dataUrl, [base64], true, corridaId);
  }
  // Varias hojas del mismo mueble (plano multipágina). Paso 1 analiza, paso 2 verifica.
  async function analizarImagenes(imagenes, dataUrlPreview, corridaId) {
    const v1 = await analizarRenderImagenes(catalogoIA(), imagenes);
    if (!v1?.ok || !requiereVerificacionVisual(v1.propuesta, imagenes.length))
      return aplicarPropuesta(v1, dataUrlPreview, imagenes, true, corridaId);
    setVerificando(true);
    const v2 = await verificarDespiece(catalogoIA(), imagenes, v1.propuesta);
    setVerificando(false);
    const merged = v2?.ok ? { ...v2, propuesta: { ...v2.propuesta, preguntas: (v2.propuesta?.preguntas?.length ? v2.propuesta.preguntas : (v1.propuesta?.preguntas || [])) } } : v2;
    return aplicarPropuesta(merged, dataUrlPreview, imagenes, true, corridaId);
  }

  // Aplica las RESPUESTAS del usuario a las preguntas de la IA y re-costea el despiece.
  // Las respuestas son VERDAD (sobrescriben supuestos): quita el equipo que pone el cliente,
  // elimina bisagras si los frentes son fijos, usa el calibre indicado, etc.
  async function aplicarRespuestas() {
    if (respondiendo) return;
    // Contestado AHORA, indexado por question_key (autoridad, no por texto).
    const ahora = {}; const traza = [];
    preguntasIA.forEach((raw) => {
      const nq = normPreg(raw); const v = String(respuestas[nq.question_key] ?? '').trim();
      if (v) { ahora[nq.question_key] = { pregunta: nq.pregunta, respuesta: v }; traza.push({ pregunta: nq.pregunta, respuesta: v, supuesto: nq.supuesto, afecta: nq.afecta, impacto: nq.impacto }); }
    });
    if (!Object.keys(ahora).length) { setConfMsg('Contesta al menos una confirmación para recalcular.'); return; }
    const imgs = Array.isArray(b.planos) ? b.planos.filter(Boolean) : [];
    if (!imgs.length) { setConfMsg('No tengo el plano en memoria para recalcular; vuelve a subirlo.'); return; }
    // ACUMULA por key y manda TODO a la IA (para que no reabra una ronda).
    const todas = { ...confirmadas, ...ahora }; // {question_key: {pregunta, respuesta}}
    const respPayload = Object.entries(todas).map(([question_key, v]) => ({ question_key, pregunta: v.pregunta, respuesta: v.respuesta }));
    setRespondiendo(true); setConfMsg(''); setErrorIA(''); setAnalizando(true); setVerificando(true);
    try {
      const r = await responderDespiece(catalogoIA(), imgs, propuestaIA, respPayload);
      if (!r?.ok) { setConfMsg(r?.error || 'No se pudo recalcular con tus respuestas.'); return; }
      let quien = null; try { quien = (await sesionActual())?.user?.email || null; } catch (_e) {}
      guardarConfirmaciones(traza.map((x) => ({ confirmado_por: quien, producto: b.nombre || null, pregunta: x.pregunta, respuesta: x.respuesta, valor_anterior: x.supuesto || null, afecta: x.afecta, impacto: x.impacto })));
      setConfirmadas(todas); // recordadas por key
      const confKeys = new Set(Object.keys(todas));
      const quedan = (Array.isArray(r.propuesta?.preguntas) ? r.propuesta.preguntas : []).filter((q) => !confKeys.has(normPreg(q).question_key)).length;

      if (!canonico) {
        // PRE-CANÓNICO: el despiece aún se está asentando. La respuesta del usuario
        // SÍ reconstruye el BOM (confirmado_usuario manda sobre el supuesto IA).
        // Cuando ya no quedan preguntas, se CONSOLIDA el BOM canónico de la revisión.
        aplicarPropuesta(r, b.imagen, b.planos, false, corrida.current, todas);
        if (quedan === 0) { setCanonico(true); setPropuestaIA(r.propuesta || propuestaIA); }
        setConfMsg(`✓ Guardé ${Object.keys(todas).length} respuesta(s) y recalculé el costo.` + (quedan ? ` Quedan ${quedan} por confirmar.` : ' BOM consolidado: sin preguntas pendientes.'));
      } else {
        // CANÓNICO: la salida de la IA NO reemplaza el BOM. Si propone cambios, se
        // ofrecen como PROPUESTA_DIFF para que el usuario ACEPTE o RECHACE.
        const iaComps = mapIaComps(r.propuesta || {});
        const d = diffBOM(b.componentes, iaComps);
        if (d.sinCambios) {
          setConfMsg(`✓ Respuesta registrada. El BOM canónico no cambia (${bomHash(b.componentes)}).`);
        } else {
          setPropuestaDiff({ agregar: d.agregar, modificar: d.modificar, eliminar: d.eliminar, motivo: `Respuesta a: ${Object.values(ahora).map((v) => v.pregunta).join(' · ')}`, iaComps });
          setConfMsg('La IA propone cambios al BOM canónico. Revísalos abajo y Acepta o Rechaza — no se aplican solos.');
        }
      }
    } finally {
      setRespondiendo(false); setAnalizando(false); setVerificando(false);
    }
  }

  // ACEPTAR la propuesta de la IA sobre el BOM canónico: aplica el diff, abre nueva
  // revisión (hash nuevo, dirty) y marca el render obsoleto. Precedencia: una vez
  // aplicado, es parte del canónico (editable luego a mano por Diseño).
  function aceptarDiff() {
    if (!propuestaDiff) return;
    const comps = aplicarDiffBOM(b.componentes, propuestaDiff);
    set({ componentes: comps });
    setPropuestaDiff(null); setBomDirty(true);
    setRenders({ aislado: null, ambiente: null }); setRenderMsg('');
    setConfMsg('✓ Cambios aplicados al BOM. Es una nueva revisión: guarda para congelarla.');
  }
  function rechazarDiff() {
    setPropuestaDiff(null);
    setConfMsg('Propuesta de la IA rechazada. El BOM canónico se mantiene.');
  }

  // RE-COSTEAR un histórico con el método vigente (Alba). No modifica la historia:
  // quita los factores legacy → calcular() usa Alba en vivo, y marca la corrida como
  // comparación/nueva revisión. El snapshot guardado (costoGuardado) sigue intacto.
  function reCostearConAlba() {
    set({ factorDirecta: undefined, factorIndirecta: undefined });
    setFormulaGuardada(null); setBomDirty(true);
    setConfMsg('Re-costeado con Alba V1 (método vigente). Es una comparación / nueva revisión; el costo histórico sigue guardado hasta que guardes.');
  }

  // Sube render/plano → la IA propone el despiece. Un PDF multipágina abre el
  // selector de hoja; si pdf.js falla, cae a mandar el PDF crudo (como antes).
  async function onImagen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const MAX_MB = 50; // el PDF se lee local y se manda SOLO una hoja (chica)
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorIA(`El archivo pesa ${(file.size / 1048576).toFixed(0)} MB (máximo ${MAX_MB} MB). `
        + 'Comprímelo o sube la hoja del mueble como imagen.');
      return;
    }
    setErrorIA(''); setAnalizando(true);
    try {
      if (esPDF(file)) {
        // Abre el PDF en el navegador y manda SOLO la hoja del mueble como imagen
        // (lo que la IA sí lee bien). Si pdf.js falla → PDF crudo (como antes).
        try {
          const prep = await prepararPdfRapido(file, { previewPx: 1200 });
          const doc = prep.doc;
          if (prep.numPaginas > 1) {
            setPdfSel({ doc, numPaginas: prep.numPaginas, pagina: 1, preview: prep.preview, msAFirstPreview: prep.msAFirstPreview });
            setAnalizando(false);
            return; // preview rápido; el trabajo pesado ocurre sólo al confirmar
          }
          const cid = nuevaCorrida();
          const dataUrl = await paginaAImagen(doc, 1);
          await analizarYLlenar(dataUrl.split(',')[1], 'image/jpeg', dataUrl, cid);
          return;
        } catch (ePdf) {
          const cid = nuevaCorrida();
          const base64 = await archivoABase64(file);
          const ok = await analizarYLlenar(base64, 'application/pdf', '', cid);
          if (!ok && file.size > 8 * 1024 * 1024) {
            setErrorIA('El plano es pesado o de varias páginas. Sube SOLO la hoja del mueble como imagen (captura de pantalla).');
          }
          return;
        }
      }
      const cid = nuevaCorrida();
      const r = await reducirImagen(file);
      await analizarYLlenar(r.base64, r.mediaType, `data:${r.mediaType};base64,${r.base64}`, cid);
    } catch (err) {
      setErrorIA(String(err?.message || err));
    } finally {
      setAnalizando(false);
    }
  }

  // Cambia la hoja mostrada en el selector de PDF (actualiza el preview).
  async function verPaginaPdf(n) {
    if (!pdfSel) return;
    const pagina = Math.max(1, Math.min(pdfSel.numPaginas, n));
    if (pagina === pdfSel.pagina) return;
    try {
      const preview = await paginaAImagen(pdfSel.doc, pagina, 1400);
      setPdfSel((s) => (s ? { ...s, pagina, preview } : s));
    } catch { /* deja el preview actual */ }
  }

  // Analiza SOLO la hoja elegida del PDF (rasterizada a imagen).
  async function analizarPaginaPdf() {
    if (!pdfSel) return;
    const sel = pdfSel;
    setPdfSel(null); setErrorIA(''); setAnalizando(true);
    const cid = nuevaCorrida();
    try {
      const dataUrl = await paginaAImagen(sel.doc, sel.pagina);
      await analizarYLlenar(dataUrl.split(',')[1], 'image/jpeg', dataUrl, cid);
    } catch (err) {
      setErrorIA('No se pudo procesar esa hoja. Intenta subirla como imagen (captura de pantalla).');
    } finally {
      setAnalizando(false);
    }
  }

  // Analiza TODAS las hojas juntas (un mismo mueble repartido en varias páginas:
  // vista general + detalle por parte). La IA las integra en un solo despiece.
  async function analizarTodasPdf() {
    if (!pdfSel) return;
    const sel = pdfSel;
    setPdfSel(null); setErrorIA(''); setAnalizando(true);
    const cid = nuevaCorrida();
    try {
      const paginas = sel.numPaginas <= 8
        ? Array.from({ length: sel.numPaginas }, (_, i) => i + 1)
        : paginasAlrededor(sel.pagina, sel.numPaginas, 3);
      const raster = await rasterizarPaginas(sel.doc, paginas, { maxPx: 1600, concurrency: 3 });
      await analizarImagenes(raster.map((x) => x.base64), sel.preview, cid);
    } catch (err) {
      setErrorIA('No se pudieron procesar las hojas. Intenta subir la hoja principal como imagen.');
    } finally {
      setAnalizando(false);
    }
  }

  const puedeSeguir = (paso === 0 && b.nombre.trim()) || (paso === 1 && b.componentes.length > 0) || paso >= 2;

  if (analizando) {
    return (
      <div className="asistente">
        <Cargando titulo={respondiendo ? 'Recalculando con tus respuestas…' : verificando ? 'Verificando el despiece contra las cotas…' : 'Analizando nuevo producto…'} />
      </div>
    );
  }

  // Selector de hoja: un plano en PDF trae varias páginas (varios muebles/vistas).
  // Se elige la hoja del mueble a costear y solo esa se manda a la IA (como imagen).
  if (pdfSel) {
    return (
      <div className="asistente">
        <div className="pregunta">Tu plano tiene {pdfSel.numPaginas} páginas</div>
        <div className="pregunta-sub">Si es UN mueble repartido en varias hojas (general + detalle por parte), analízalas <strong>juntas</strong> para un costeo completo. Si cada hoja es un mueble distinto, analiza <strong>solo una</strong>.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', flexWrap: 'wrap' }}>
          <button className="boton" onClick={() => verPaginaPdf(pdfSel.pagina - 1)} disabled={pdfSel.pagina <= 1}>‹ Anterior</button>
          <strong>Página {pdfSel.pagina} de {pdfSel.numPaginas}</strong>
          <button className="boton" onClick={() => verPaginaPdf(pdfSel.pagina + 1)} disabled={pdfSel.pagina >= pdfSel.numPaginas}>Siguiente ›</button>
        </div>
        {pdfSel.preview && (
          <img src={pdfSel.preview} alt={`Página ${pdfSel.pagina}`}
            style={{ maxWidth: '100%', border: '1px solid rgba(0,0,0,.18)', borderRadius: 8, display: 'block' }} />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="boton primario grande" onClick={analizarTodasPdf}>{pdfSel.numPaginas > 8 ? 'Analizar vistas cercanas (máx. 7)' : `Analizar las ${pdfSel.numPaginas} hojas juntas (un mueble)`}</button>
          <button className="boton grande" onClick={analizarPaginaPdf}>Solo esta hoja</button>
          <button className="boton fantasma" onClick={() => setPdfSel(null)}>Cancelar</button>
        </div>
        {errorIA && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{errorIA}</span></div>}
      </div>
    );
  }

  return (
    <div className="asistente">
      <div className="progreso">
        {Array.from({ length: N_PASOS }).map((_, i) => (
          <span key={i} className={`punto ${i <= paso ? 'activo' : ''}`} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button className="boton fantasma" onClick={() => (paso === 0 ? onInicio() : setPaso(paso - 1))}>
          ‹ {paso === 0 ? 'Inicio' : 'Atrás'}
        </button>
        {onBiblioteca && <button className="boton" onClick={onBiblioteca}>📚 Biblioteca</button>}
      </div>

      {/* PASO 1 — Identidad */}
      {paso === 0 && (
        <div>
          <div className="pregunta">¿Qué vas a costear?</div>
          <div className="pregunta-sub">Un producto nuevo, a la medida. No importa si nunca se ha hecho.</div>

          <div className="tarjeta" style={{ background: 'var(--panel)' }}>
            <label className="etiqueta">Atajo: sube un render o plano (PDF) y lo analizo con IA</label>
            <div className="ayuda">Propongo las piezas y medidas leyendo la imagen o el plano en PDF; tú las confirmas. La IA no inventa el precio — lo calcula el motor.</div>
            <div className="espacio" />
            <label className={'boton ' + (analizando ? 'fantasma' : 'primario')} style={{ display: 'inline-flex', cursor: analizando ? 'default' : 'pointer' }}>
              {analizando ? 'Analizando…' : 'Subir render o plano (PDF)'}
              <input id="costear-archivo" data-testid="costear-archivo" type="file" accept="image/*,application/pdf,.pdf" hidden disabled={analizando} onChange={onImagen} />
            </label>
            {errorIA && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{errorIA}</span></div>}
            {catalogoFuente === 'cliente-fallback' && <div className="alerta ambar" style={{ marginTop: 12 }}><span className="texto">⚠ El catálogo central no estaba disponible: la IA usó datos locales. <strong>No cotices en firme</strong> con este análisis; confirma materiales y precios con Dirección.</span></div>}
          </div>

          <label className="etiqueta">O escríbelo tú</label>
          <input type="text" autoFocus placeholder="Ej. Mostrador de recepción curvo"
            value={b.nombre} onChange={(e) => set({ nombre: e.target.value })} />
          <div className="espacio" />
          {/* DESCRIBE EL MUEBLE: con esto la IA (render) y Voni ENTIENDEN qué es, de
              qué material y cómo está hecho — no sólo el nombre. Entre más detalle,
              mejor el render y las sugerencias. (Rodrigo: "que te pregunte qué mueble
              es y tú lo describas".) */}
          {/* label ligada al control (htmlFor/id): sin esta asociación el nombre
              accesible no existía — lectores de pantalla no anunciaban el campo y
              getByLabel() no lo encontraba (causa raíz del smoke LIVE AI, #16). */}
          <label className="etiqueta" htmlFor="costear-descripcion">Descríbelo para que la IA lo entienda</label>
          <textarea id="costear-descripcion" rows={3} placeholder="Ej. Sillas de espera de aeropuerto, estructura de aluminio, asiento y respaldo de hule espuma negra tapizado, conectores cada 2 asientos."
            value={b.descripcionCliente || ''} onChange={(e) => set({ descripcionCliente: e.target.value })}
            style={{ width: '100%', resize: 'vertical', padding: 10, borderRadius: 8, border: '1px solid var(--linea)', fontFamily: 'inherit', fontSize: 15 }} />
          <div className="ayuda">Material, estructura, acabados, detalles (conectores, patas, cajones…). Alimenta el render con IA y a Voni.</div>
          <div className="espacio" />
          {/* DESCRIBE → VONI ENTIENDE: analiza SOLO el texto (sin imagen) y propone la
              estructura + el despiece. Es el flujo que pidió Rodrigo: "describe el mueble
              y que Voni ya tenga una idea". */}
          <button
            className={'boton ' + (analizando ? 'fantasma' : 'primario')}
            disabled={analizando || (b.descripcionCliente || '').trim().length < 8}
            onClick={analizarDescripcion}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {analizando ? 'Voni está entendiendo…' : '🧠 Analizar con Voni'}
          </button>
          <div className="ayuda gris" style={{ fontSize: 11, marginTop: 4 }}>Voni interpreta tu descripción, propone las piezas y su estructura; tú confirmas. El precio lo calcula el motor.</div>
          <div className="espacio" />
          <label className="etiqueta">¿Cuántas piezas iguales?</label>
          <div className="masmenos gigante">
            <button aria-label="menos" onClick={() => set({ piezas: Math.max(1, b.piezas - 1) })}>−</button>
            <span className="valor">{b.piezas}</span>
            <button aria-label="mas" onClick={() => set({ piezas: b.piezas + 1 })}>+</button>
          </div>
        </div>
      )}

      {/* PASO 2 — Piezas */}
      {paso === 1 && (
        <div>
          <div className="pregunta">¿De qué está hecho?</div>
          <div className="pregunta-sub">Toca las piezas que lleva. Luego ajusta su material y medida.</div>

          {/* Voni razona el conjunto (no piezas sueltas): avisa de relaciones que no
              cuadran. Determinista; propone/detecta, no cambia costo. */}
          {(b.componentes || []).length > 0 && revisionEstructural.observaciones.some((o) => o.nivel !== 'info' ) && (
            <div className="tarjeta" style={{ background: 'var(--panel)', borderLeft: '4px solid var(--ambar, #d8a800)', margin: '12px 0' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>🧠 Voni revisó la estructura</div>
              {revisionEstructural.observaciones.filter((o) => o.nivel !== 'info').map((o, i) => (
                <div key={i} className="ayuda" style={{ marginBottom: 6, color: o.nivel === 'warning' ? '#8a6d00' : 'inherit' }}>
                  {o.nivel === 'warning' ? '⚠ ' : '• '}{o.mensaje}
                </div>
              ))}
              <div className="ayuda gris" style={{ fontSize: 11, marginTop: 4 }}>Voni sólo propone y detecta; el costo lo calcula el motor.</div>
            </div>
          )}

          {/* ESTRUCTURA PROPUESTA: el mueble como OBJETO según lo entendió Voni
              (design_intent + roles + relaciones), para confirmar/corregir antes de
              seguir. Viene de la semántica del intérprete canónico, no de regex. */}
          {estructuraVoni && estructuraVoni.nodes.length > 0 && (
            <div className="tarjeta" style={{ background: 'var(--panel)', borderLeft: '4px solid var(--acento, #3a6ea5)', margin: '12px 0' }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>🧠 Estructura que entendió Voni</div>
              <div className="ayuda" style={{ marginBottom: 8 }}>
                {estructuraVoni.design_intent.product_type === 'unknown'
                  ? 'Voni no está segura de qué mueble es — confírmalo abajo.'
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
                    const verbo = ({ supports: 'soporta', contains: 'contiene', connects: 'conecta', repeats_with: 'se repite con' })[r.type] || r.type;
                    return <span key={i}>{i > 0 ? ' · ' : ''}{rol(r.from)} {verbo} {rol(r.to)}</span>;
                  })}
                </div>
              )}
              {Array.isArray(estructuraVoni.missing_critical_data) && estructuraVoni.missing_critical_data.length > 0 && (
                <div className="ayuda" style={{ color: '#8a6d00', fontSize: 12 }}>Falta por definir: {estructuraVoni.missing_critical_data.join(' · ')}</div>
              )}
              <div className="ayuda gris" style={{ fontSize: 11, marginTop: 6 }}>Es lo que Voni entendió como objeto; confirma o corrige las piezas abajo. El precio lo calcula el motor.</div>
            </div>
          )}
          {(preguntasIA.length > 0 || Object.keys(confirmadas).length > 0) && (
            <div style={{ border: '1px solid var(--borde)', borderRadius: 10, padding: 14, margin: '12px 0', background: 'var(--panel)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Centro de confirmaciones</div>
                <div className="ayuda" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {Object.keys(confirmadas).length} confirmadas · {preguntasIA.length} pendientes
                  {canonico && <span className="chip" style={{ background: 'var(--ok,#1a7f37)', color: '#fff', fontSize: 11 }} title="El despiece está congelado: la IA ya no lo reemplaza sola.">BOM consolidado {bomHash(b.componentes)}</span>}
                  {bomDirty && <span className="chip" style={{ background: '#8a6d00', color: '#fff', fontSize: 11 }}>cambios sin guardar</span>}
                </div>
              </div>
              <div className="ayuda" style={{ margin: '4px 0 8px' }}>Contesta lo que sepas: cada respuesta recalcula el costo y se recuerda. Las confirmadas no vuelven a preguntarse.</div>
              {confMsg && <div className="ayuda" style={{ marginBottom: 10, color: confMsg.startsWith('✓') ? 'var(--ok,#1a7f37)' : 'var(--alerta,#b22a22)' }}>{confMsg}</div>}

              {/* PROPUESTA_DIFF: cambios que la IA sugiere al BOM YA canónico. No se
                  aplican solos — el usuario ACEPTA o RECHAZA (precedencia del humano). */}
              {propuestaDiff && (
                <div className="alerta" style={{ border: '1px solid #8a6d00', background: 'var(--panel)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>La IA propone cambios al BOM</div>
                  <div className="ayuda" style={{ marginBottom: 8 }}>{propuestaDiff.motivo}</div>
                  {propuestaDiff.agregar.length > 0 && <div className="ayuda" style={{ color: '#1a7f37' }}>+ Agregar: {propuestaDiff.agregar.map((c) => c.nombre).join(', ')}</div>}
                  {propuestaDiff.modificar.length > 0 && <div className="ayuda" style={{ color: '#8a6d00' }}>~ Modificar: {propuestaDiff.modificar.map((m) => m.despues?.nombre || m.antes?.nombre).join(', ')}</div>}
                  {propuestaDiff.eliminar.length > 0 && <div className="ayuda" style={{ color: '#b22a22' }}>− Eliminar: {propuestaDiff.eliminar.map((c) => c.nombre).join(', ')}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="boton primario" onClick={aceptarDiff}>Aceptar cambios</button>
                    <button className="boton" onClick={rechazarDiff}>Rechazar</button>
                  </div>
                </div>
              )}
              {preguntasIA.map((raw, i) => {
                const q = normPreg(raw);
                const colImp = q.impacto === 'alto' ? '#8a2d00' : q.impacto === 'medio' ? '#8a6d00' : '#555';
                const val = respuestas[q.question_key] ?? '';
                const setVal = (v) => setRespuestas((s) => ({ ...s, [q.question_key]: v }));
                return (
                  <div key={q.question_key} style={{ borderTop: i ? '1px solid var(--borde)' : 'none', paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                      <span className="chip" style={{ background: colImp, color: '#fff', fontSize: 11 }}>IMPACTO {q.impacto.toUpperCase()}</span>
                      <span className="chip" style={{ fontSize: 11 }}>afecta: {q.afecta}</span>
                      {val && <span className="chip" style={{ background: 'var(--ok,#1a7f37)', color: '#fff', fontSize: 11 }}>✓ confirmado</span>}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{q.pregunta}</div>
                    {q.supuesto && <div className="ayuda" style={{ marginBottom: 6 }}>Supuesto IA: {q.supuesto}</div>}
                    {(q.tipo === 'radio' || q.tipo === 'select') && q.opciones?.length ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {q.opciones.map((op) => (
                          <button key={op} type="button" className={'chip' + (val === op ? ' on' : '')}
                            onClick={() => setVal(op)}
                            style={{ cursor: 'pointer', background: val === op ? 'var(--tinta,#2B2622)' : undefined, color: val === op ? '#fff' : undefined }}>
                            {op}
                          </button>
                        ))}
                      </div>
                    ) : q.tipo === 'number' ? (
                      <input type="number" inputMode="numeric" value={val} placeholder="Cantidad" onChange={(e) => setVal(e.target.value)} style={{ width: 160 }} />
                    ) : (
                      <input type="text" value={val} placeholder="Tu respuesta" onChange={(e) => setVal(e.target.value)} style={{ width: '100%' }} />
                    )}
                  </div>
                );
              })}
              {preguntasIA.length > 0 && (
                <button className="boton primario" disabled={respondiendo} onClick={aplicarRespuestas} style={{ marginTop: 12 }}>
                  {respondiendo ? 'Recalculando…' : 'Aplicar respuestas y recalcular'}
                </button>
              )}
              {Object.keys(confirmadas).length > 0 && (
                <div style={{ borderTop: '1px solid var(--borde)', marginTop: 14, paddingTop: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Confirmadas ✓</div>
                  {Object.entries(confirmadas).map(([key, c]) => (
                    <div key={key} className="ayuda" style={{ marginBottom: 4 }}>
                      <span style={{ color: 'var(--ok,#1a7f37)' }}>✓</span> {c.pregunta} → <strong>{c.respuesta}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {analisis && (
            <div className="ia-analisis">
              {b.imagen && <img src={b.imagen} alt="Render analizado" className="ia-thumb" />}
              <div className="ia-cuerpo">
                {analisis.descripcionCliente && <p className="ia-desc">{analisis.descripcionCliente}</p>}
                {analisis.materiales?.length > 0 && (
                  <div className="ia-bloque"><span className="ia-et">Materiales</span> {analisis.materiales.join(' · ')}</div>
                )}
                <div className="ia-badges">
                  {analisis.volumenAsumido && <span className="ia-badge">Volumen: {analisis.volumenAsumido}</span>}
                  {analisis.confianzaGeneral && <span className={'ia-badge ia-conf-' + analisis.confianzaGeneral}>Confianza {analisis.confianzaGeneral}</span>}
                </div>
                {analisis.confianzaGeneral === 'baja' && (
                  <div className="ia-nota-conf">La imagen no trae escala, así que las medidas son <strong>estimadas</strong>. Dame <strong>una medida real</strong> (p. ej. el largo total) y la precisión sube a alta.</div>
                )}
              </div>
            </div>
          )}

          {analisis?.informe && (
            <div className="ia-informe-bloque">
              <div className="ia-informe-titulo">Auditoría técnica de industrialización</div>
              <InformeIA informe={analisis.informe} />
            </div>
          )}
          <div className="chips">
            {PARTES.map((p) => (
              <button key={p.label} className="chip" onClick={() => agregarParte(p)}>
                <span className="marca-chip">+</span> {p.label}
              </button>
            ))}
          </div>
          <div className="espacio" />
          {b.componentes.length === 0 && <p className="ayuda">Aún no agregas piezas. Toca una de arriba para empezar.</p>}
          {b.componentes.map((c, i) => {
            const ins = insumos[c.insumoId];
            const est = estadoMaterialUI(c, insumos);
            const area = esArea(ins);
            const cnt = c.piezas || 1;
            const m2 = area && c.largoMM && c.anchoMM ? (c.largoMM / 1000) * (c.anchoMM / 1000) * cnt : 0;
            return (
              <div className="pieza" key={i}>
                <div className="pieza-head">
                  <input className="pieza-nom" placeholder="Nombre de la pieza" value={c.nombre || ''} onChange={(e) => setPieza(i, { nombre: e.target.value })} />
                  <select className="pieza-mat" value={est.selVal} onChange={(e) => onMaterial(i, e.target.value)}>
                    <option value="">— ¿de qué es? —</option>
                    {SECCIONES.map((sec) => (
                      <optgroup label={sec.nombre} key={sec.id}>
                        {Object.values(insumos).filter((x) => x.seccion === sec.id).map((x) => (
                          <option value={x.id} key={x.id}>{x.nombre}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button className="pieza-x" onClick={() => quitarPieza(i)} aria-label="quitar">×</button>
                </div>
                {est.badge && (
                  <div className="pieza-calc" style={{ color: 'var(--ambar,#8a6d00)', fontWeight: 600 }}>🟡 {est.badge}</div>
                )}
                {est.pendiente && (
                  <div className="pieza-calc" style={{ color: 'var(--alerta,#b22a22)' }}>
                    ⚠ {est.pendienteMsg}
                    {est.mostrarConfirmar && est.candId && (
                      <>{' '}<button type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => onMaterial(i, est.candId, { confirmado: true })}>Usar {insumos[est.candId]?.nombre || 'candidato'} (confirmar)</button></>
                    )}
                  </div>
                )}
                {ins && (
                  <div className="pieza-med">
                    {area ? (
                      <>
                        <label>Largo mm<input type="number" className="numero" min="0" value={c.largoMM || ''} onChange={(e) => setPieza(i, { largoMM: parseFloat(e.target.value) || 0 })} /></label>
                        <span className="por">×</span>
                        <label>Ancho mm<input type="number" className="numero" min="0" value={c.anchoMM || ''} onChange={(e) => setPieza(i, { anchoMM: parseFloat(e.target.value) || 0 })} /></label>
                        <span className="por">×</span>
                        <label>Cant<input type="number" className="numero" min="1" value={cnt} onChange={(e) => setPieza(i, { piezas: parseInt(e.target.value) || 1 })} /></label>
                      </>
                    ) : (
                      <label>Cantidad ({ins.unidad})<input type="number" className="numero" step="0.01" min="0" value={c.cantidad} onChange={(e) => setPieza(i, { cantidad: parseFloat(e.target.value) || 0 })} /></label>
                    )}
                    <span className="pieza-sub">{pesos2(costoPieza(c, ins))}</span>
                  </div>
                )}
                {area && m2 > 0 && <div className="pieza-calc">= {m2.toFixed(2)} m² <span className="gris">({ins.clase === 'indirecta' ? 'comprado' : 'fabricado'})</span></div>}
                {c.iaRazon && <div className="pieza-calc"><span className="gris">📐 Consumo IA: {c.iaRazon}</span></div>}
                {c.iaNota && <div className="pieza-calc"><span className="gris">IA{c.iaConf ? ` · ${c.iaConf}` : ''}: {c.iaNota}</span></div>}
              </div>
            );
          })}
        </div>
      )}

      {/* PASO 3 — Mano de obra (fórmula ALBA V1). Ya NO se elige "dificultad": la
          mano de obra y los indirectos salen del TIPO de material de cada partida
          (método Von Haucke, calibrado al centavo contra las T.D.C. reales). */}
      {paso === 2 && (
        <div>
          <div className="pregunta">Mano de obra e indirectos</div>
          <div className="pregunta-sub">Se calculan solos con la fórmula <strong>Alba V1</strong> (el método oficial de Von Haucke): un % de mano de obra por tipo de material e indirectos sobre eso. No hay que elegir dificultad.</div>
          <div className="ayuda columna-texto" style={{ marginTop: 10 }}>
            Cubiertas 15% MO · metal/madera/general 20% MO (indirectos ×3) · cristal y compra-venta 1% MO (indirectos 5%).
            Verificado contra las hojas de costo reales de Alba (Alpura, bench) al centavo.
          </div>
          <div className="ayuda columna-texto" style={{ marginTop: 8 }}>Para costos con horas exactas por proceso, usa el Costeador detallado.</div>
        </div>
      )}

      {/* PASO 4 — Resultado */}
      {paso === 3 && (
        <div className="tarjeta-precio">
          <div className="ficha-linea">{b.nombre || 'Producto nuevo'}</div>
          {emitible ? (
            <>
              <div className="ayuda" style={{ margin: '6px 0' }}>Cuesta hacer 1 pieza</div>
              <div className="precio-enorme" style={{ color: 'var(--tinta)', fontSize: 38 }}>{pesos2(resultado.costoUnitario)}</div>
              <div className="espacio" />
              <div className="ayuda">Precio de lista ({b.margen}% margen)</div>
              <div className="precio-enorme">{pesos2(precio)}</div>
            </>
          ) : soloPorConfirmar ? (
            // PROVISIONAL: todo el BOM está costeado, pero ≥1 material es "por confirmar"
            // (p.ej. 18→19). HAY un costo provisional real, pero NO se emite/aprueba hasta
            // confirmar el material. No es un costo certificado ni completo.
            <>
              <div className="ayuda" style={{ margin: '6px 0' }}>Costo provisional (materiales por confirmar)</div>
              <div className="precio-enorme" style={{ color: 'var(--ambar,#8a6d00)', fontSize: 34 }}>{pesos2(emision.subtotalConocido)}</div>
              <div className="espacio" />
              <div className="ayuda">Precio de lista</div>
              <div className="precio-enorme" style={{ color: '#b22a22' }}>Por confirmar</div>
              <div className="ayuda" style={{ color: '#8a6d00', marginTop: 4 }}>🟡 Costo provisional, no certificado. Confirma {materialesPorConfirmar.length} material(es) marcados POR CONFIRMAR para emitir/aprobar.</div>
            </>
          ) : (
            // FAIL-CLOSED: hay partidas sin costear → NO hay costo total ni precio.
            // Solo se muestra lo que sí se conoce; el total y el precio quedan "Pendiente".
            <>
              <div className="ayuda" style={{ margin: '6px 0' }}>Subtotal conocido (solo lo que ya tiene material)</div>
              <div className="precio-enorme" style={{ color: 'var(--tinta)', fontSize: 34 }}>{pesos2(emision.subtotalConocido)}</div>
              <div className="espacio" />
              <div className="ayuda">Costo total</div>
              <div className="precio-enorme" style={{ color: '#b22a22' }}>Pendiente</div>
              <div className="ayuda" style={{ color: '#b22a22', marginTop: 4 }}>No se calcula precio de lista hasta costear todo.</div>
            </>
          )}
          <div className="espacio" />
          <div className="ayuda columna-texto" style={{ textAlign: 'left' }}>
            Material {pesos2(resultado.materialTotal)} · Mano de obra {pesos2(resultado.manoObra)} · Fábrica {pesos2(resultado.indirectosFabrica)}
          </div>
          {/* Método de costeo — discreto. Alba V1 para producto nuevo; histórico legacy al reabrir. */}
          <div className="ayuda columna-texto" style={{ textAlign: 'left', marginTop: 2, opacity: 0.8 }}>
            Método de costeo: <strong>{formulaActual === FORMULA_ALBA_V1 ? 'Alba V1' : esHistoricoLegacy ? 'Legacy 55 (histórico)' : formulaActual}</strong>
          </div>
          {esHistoricoLegacy && (
            <div className="alerta" style={{ marginTop: 8, textAlign: 'left', border: '1px solid #8a6d00', borderRadius: 8, padding: 10 }}>
              <span className="texto">Costo histórico — calculado con <strong>Legacy55</strong>. No se recalcula solo. </span>
              <button className="boton" style={{ marginTop: 6 }} onClick={reCostearConAlba}>Re-costear con método vigente (Alba V1)</button>
            </div>
          )}
          {costoGuardado
            && aCentavosEnteros(costoGuardado.costoUnitario) != null
            && aCentavosEnteros(resultado.costoUnitario) != null
            && aCentavosEnteros(costoGuardado.costoUnitario) !== aCentavosEnteros(resultado.costoUnitario) && (
            <div className="ayuda columna-texto" style={{ textAlign: 'left', marginTop: 6 }}>
              Re-costeo con catálogo de hoy: guardado {pesos2(costoGuardado.costoUnitario)} → hoy {pesos2(resultado.costoUnitario)}
              {' '}(Δ {pesos2(dinero(Number(resultado.costoUnitario) - Number(costoGuardado.costoUnitario)))}). Guarda para actualizar el expediente.
            </div>
          )}

          {costoIncompleto && (
            <div className="alerta roja" style={{ marginTop: 10, textAlign: 'left' }}>
              <span className="texto">⚠ <strong>Costo INCOMPLETO</strong> — <strong>faltan por costear {piezasSinMaterial.length} partida(s)</strong>: {piezasSinMaterial.slice(0, 6).join(', ')}{piezasSinMaterial.length > 6 ? '…' : ''}. Asígnales material en el despiece (arriba) o márcalas como excluidas. Hasta entonces no hay costo total ni precio.</span>
            </div>
          )}
          {preguntasIA.length > 0 && (
            <div className="ayuda columna-texto" style={{ textAlign: 'left', marginTop: 8, color: '#8a6d00' }}>
              Costo preliminar — {preguntasIA.length} decisión(es) pendiente(s): {preguntasIA.map((q) => normPreg(q).pregunta).join(' · ')}. No es obligatorio; puedes cotizar así.
            </div>
          )}

          {/* RENDER V1 — ilustra el producto definido; no lo modifica */}
          <div className="espacio" />
          <div style={{ borderTop: '1px solid var(--borde)', paddingTop: 14, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>Generar render</strong>
              <span className="chip" style={{ background: costoIncompleto ? '#b22a22' : (costoEstadoVigente === 'certificado') ? 'var(--ok,#1a7f37)' : '#8a6d00', color: '#fff', fontSize: 12 }}>
                {costoIncompleto ? 'COSTO INCOMPLETO' : costoEstadoVigente === 'certificado' ? 'COSTO CERTIFICADO' : 'COSTO PRELIMINAR'}
              </span>
              <span className="chip" style={{ background: geomFid === 'alta' ? 'var(--ok,#1a7f37)' : geomFid === 'media' ? '#8a6d00' : '#8a2d00', color: '#fff', fontSize: 12 }}>
                GEOMETRÍA: {geomFid === 'alta' ? 'ALTA' : geomFid === 'media' ? 'MEDIA' : 'LIMITADA'}
              </span>
              <span className="chip" style={{ background: acabadoFid === 'confirmado' ? 'var(--ok,#1a7f37)' : '#8a2d00', color: '#fff', fontSize: 12 }}>
                ACABADO: {acabadoFid === 'confirmado' ? 'CONFIRMADO' : 'POR CONFIRMAR'}
              </span>
              {renderObsoleto && <span className="chip" style={{ background: '#b22a22', color: '#fff', fontSize: 12 }}>RENDER DESACTUALIZADO</span>}
            </div>
            <p className="ayuda" style={{ margin: '6px 0' }}>El render ilustra el producto ya definido (medidas, materiales y despiece de arriba). No cambia el producto.</p>
            {faltaCritico && (
              <p className="ayuda" style={{ color: 'var(--alerta,#b22a22)' }}>
                Falta info para ilustrarlo bien: {[!b.nombre?.trim() && 'nombre', !(b.componentes?.length) && 'despiece', !(dimsR.w > 0) && 'medidas'].filter(Boolean).join(', ')}. Complétalo arriba; no lo invento.
              </p>
            )}
            {renderMsg && <p className="ayuda" style={{ color: 'var(--alerta,#b22a22)' }}>{renderMsg}</p>}
            <button className="boton primario" disabled={faltaCritico || renderizando} onClick={generarRenders} style={{ marginTop: 6 }}>
              {renderizando ? 'Generando…' : (renders.aislado || renders.ambiente) ? 'Regenerar render' : 'Generar render'}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              {['aislado', 'ambiente'].map((m) => (
                <div key={m}>
                  <div className="ayuda" style={{ marginBottom: 4 }}>{m === 'aislado' ? 'Producto aislado' : 'En ambiente'}</div>
                  {renders[m]
                    ? <img src={renders[m]} alt={m} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--borde)' }} />
                    : <div style={{ aspectRatio: '4/3', borderRadius: 8, border: '1px dashed var(--borde)', display: 'grid', placeItems: 'center' }}><span className="ayuda">{renderizando ? '…' : '—'}</span></div>}
                </div>
              ))}
            </div>
          </div>

          {/* GUARDAR EN BIBLIOTECA */}
          <div className="espacio" />
          <div style={{ borderTop: '1px solid var(--borde)', paddingTop: 14, textAlign: 'left' }}>
            <strong>Guardar en biblioteca</strong>
            <p className="ayuda" style={{ margin: '6px 0' }}>Queda a la mano del equipo de Diseño, buscable por palabra clave, con plano, despiece, costo y render.</p>
            <label className="etiqueta">Nombre</label>
            <input type="text" value={b.nombre || ''} onChange={(e) => set({ nombre: e.target.value })} style={{ width: '100%' }} />
            <div className="espacio" />
            <label className="etiqueta">Palabras clave (separa con comas)</label>
            <input type="text" value={etiquetasTxt} placeholder="Cabecera Soriana, Alpura, exhibidor, retail" onChange={(e) => setEtiquetasTxt(e.target.value)} style={{ width: '100%' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <span className="ayuda">Estado:</span>
              <button type="button" className={'chip' + ((estadoExp === 'borrador' || !emitible) ? ' on' : '')} onClick={() => setEstadoExp('borrador')} style={{ cursor: 'pointer', background: (estadoExp === 'borrador' || !emitible) ? 'var(--tinta,#2B2622)' : undefined, color: (estadoExp === 'borrador' || !emitible) ? '#fff' : undefined }}>Borrador</button>
              {/* FAIL-CLOSED + P0.16: no se puede APROBAR sin validación SERVER-AUTHORITY vigente
                  del BOM actual. Al clic se valida con costear-servidor; sólo pasa a 'aprobado'
                  si el servidor no bloquea y el costo cuadra a centavos. */}
              <button type="button" disabled={!emitible || validandoSrv}
                className={'chip' + ((estadoExp === 'aprobado' && emitible && validacionVigente) ? ' on' : '')}
                onClick={async () => {
                  if (!emitible || validandoSrv) return;
                  setValidandoSrv(true);
                  try {
                    const v = await validarServidorParaAprobar();
                    if (v.valido) { setEstadoExp('aprobado'); setExpMsg('✓ Validado por el servidor: listo para aprobar.'); }
                    else { setEstadoExp('borrador'); setExpMsg(`No se puede aprobar: ${v.razon}`); }
                  } finally { setValidandoSrv(false); }
                }}
                title={emitible ? 'Aprobar requiere validación del servidor' : 'No se puede aprobar: faltan partidas por costear'}
                style={{ cursor: emitible ? 'pointer' : 'not-allowed', opacity: emitible && !validandoSrv ? 1 : 0.5, background: (estadoExp === 'aprobado' && emitible && validacionVigente) ? 'var(--ok,#1a7f37)' : undefined, color: (estadoExp === 'aprobado' && emitible && validacionVigente) ? '#fff' : undefined }}>
                {validandoSrv ? 'Validando…' : 'Aprobado'}
              </button>
              {!emitible && <span className="ayuda" style={{ color: '#b22a22' }}>Incompleto → solo borrador</span>}
              {emitible && estadoExp === 'aprobado' && !validacionVigente && <span className="ayuda" style={{ color: '#8a6d00' }}>Validación del servidor pendiente (cambió el BOM): re-valida para aprobar.</span>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="boton primario" disabled={guardandoExp} onClick={guardarEnBiblioteca}>
                {guardandoExp ? 'Guardando…' : expId ? 'Actualizar en biblioteca' : 'Guardar en biblioteca'}
              </button>
              {expId && <button className="boton" disabled={guardandoExp} onClick={() => { setExpId(null); set({ nombre: (b.nombre || 'Producto') + ' (copia)' }); setCostoGuardado(null); setExpMsg('Duplicando: toca "Guardar en biblioteca" para crear la copia.'); }}>Duplicar</button>}
              {onBiblioteca && <button className="boton" onClick={onBiblioteca}>📚 Ver biblioteca</button>}
            </div>
            {expMsg && <p className="ayuda" style={{ marginTop: 6, color: expMsg.startsWith('✓') ? 'var(--ok,#1a7f37)' : 'var(--alerta,#b22a22)' }}>{expMsg}</p>}
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="espacio" />
      {paso < N_PASOS - 1 ? (
        <button className="boton primario grande" disabled={!puedeSeguir} onClick={() => setPaso(paso + 1)}>Siguiente ›</button>
      ) : (
        <div className="fila-botones">
          <button className="boton primario grande" onClick={() => onVerDetalle(b)}>Ver detalle completo (Alba V1)</button>
          <button className="boton grande" onClick={() => { setB({ nombre: '', piezas: 1, componentes: [], modoManoObra: 'porcentaje', margen: b.margen }); setPaso(0); setRenders({ aislado: null, ambiente: null }); setCostoEstado(null); setRenderMsg(''); setPreguntasIA([]); setPropuestaIA(null); setRespuestas({}); setConfirmadas({}); setConfMsg(''); setAnalisis(null); setExpId(null); setEtiquetasTxt(''); setExpMsg(''); setEstadoExp('borrador'); setCostoGuardado(null); setRenderHash(null); setRevActual(1); setCanonico(false); setPropuestaDiff(null); setBomDirty(false); setFormulaGuardada(null); corrida.current++; }}>Empezar otro</button>
        </div>
      )}
    </div>
  );
}
