// ============================================================================
//  ASISTENTE ESPECIAL — costear un producto NUEVO desde cero, guiado por
//  preguntas. Arma el despiece pieza por pieza y lo cuesta con el motor real.
//  Es la Fase 1 del flujo "render → preguntas → costo" (la Fase 2 pre-llena
//  este mismo despiece leyendo una imagen con IA).
// ============================================================================
import { useMemo, useState } from 'react';
import { calcular, precioDe, netoComponente } from '../motor/calculo.js';
import { SECCIONES } from '../datos/insumos.js';
import { pesos } from '../util.js';
import { analizarRender } from '../nube.js';
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

const DIFICULTAD = [
  { nombre: 'Muy fácil', v: 30 }, { nombre: 'Fácil', v: 40 }, { nombre: 'Estándar', v: 55 },
  { nombre: 'Difícil', v: 70 }, { nombre: 'Muy difícil', v: 90 },
];

const N_PASOS = 4;

export default function AsistenteEspecial({ estado, onVerDetalle, onInicio }) {
  const insumos = estado.insumos;
  const [paso, setPaso] = useState(0);
  const [analizando, setAnalizando] = useState(false);
  const [errorIA, setErrorIA] = useState('');
  const [preguntasIA, setPreguntasIA] = useState([]);
  const [analisis, setAnalisis] = useState(null); // {descripcionCliente, materiales, mejoras, fallasProbables, aprovechamiento}
  const [b, setB] = useState({
    nombre: '', piezas: 1, componentes: [], imagen: null, descripcionCliente: '',
    modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12,
    margen: estado.parametros?.margenObjetivo ?? 50,
  });
  const set = (parcial) => setB((prev) => ({ ...prev, ...parcial }));

  const par = { ...estado.parametros };
  const esArea = (ins) => !!ins && (ins.formato?.tipo === 'tablero' || ins.unidad === 'm2');

  const resultado = useMemo(() => calcular(b, b.piezas, insumos, par), [b, insumos]);
  const precio = precioDe(resultado.costoUnitario, b.margen);

  // --- despiece ---
  function agregarParte(p) {
    const comp = { nombre: p.label, insumoId: p.material, piezas: 1, cantidad: 1 };
    if (p.kind === 'area' && p.dims) { comp.largoMM = p.dims[0]; comp.anchoMM = p.dims[1]; }
    set({ componentes: [...b.componentes, comp] });
  }
  function setPieza(i, parcial) {
    const comps = b.componentes.slice(); comps[i] = { ...comps[i], ...parcial }; set({ componentes: comps });
  }
  function quitarPieza(i) { set({ componentes: b.componentes.filter((_, j) => j !== i) }); }
  function onMaterial(i, insumoId) {
    const ins = insumos[insumoId]; const comps = b.componentes.slice(); const prev = comps[i];
    const patch = { insumoId, nombre: prev.nombre || (ins ? ins.nombre : '') };
    if (!esArea(ins)) { patch.largoMM = undefined; patch.anchoMM = undefined; }
    comps[i] = { ...prev, ...patch }; set({ componentes: comps });
  }
  function costoPieza(c, ins) {
    const neto = netoComponente(c, b.piezas); const p = ins.precio ?? ins.precioBase ?? 0;
    if (ins.formato && ins.fraccion) { const ap = (par.aprovechamientoCorte || 100) / 100; return (neto / (ins.formato.medida * ap)) * p; }
    return neto * p;
  }

  // Sube un render → la IA propone el despiece → pre-llena las piezas
  async function onImagen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorIA(''); setAnalizando(true);
    try {
      const { base64, mediaType } = await reducirImagen(file);
      const dataUrl = `data:${mediaType};base64,${base64}`;
      const catalogo = Object.values(insumos).map((x) => ({ id: x.id, nombre: x.nombre, seccion: x.seccion, unidad: x.unidad }));
      const res = await analizarRender(catalogo, base64, mediaType);
      if (!res?.ok) { setErrorIA(res?.error || 'No se pudo analizar la imagen.'); return; }
      const p = res.propuesta || {};
      const comps = (p.piezas || []).map((z) => {
        const existe = !!insumos[z.insumoId];
        const base = { nombre: z.nombre || 'Pieza', insumoId: existe ? z.insumoId : '', cantidad: z.cantidad || 1, piezas: 1, iaNota: z.nota || '', iaConf: z.confianza || '' };
        if (z.forma === 'area') { base.largoMM = z.largoMM || 0; base.anchoMM = z.anchoMM || 0; base.piezas = z.cantidad || 1; base.cantidad = 1; }
        return base;
      });
      setB((prev) => ({ ...prev, nombre: prev.nombre || p.producto || '', componentes: comps, imagen: dataUrl, descripcionCliente: p.descripcionCliente || '', materiales: Array.isArray(p.materiales) ? p.materiales : [] }));
      setAnalisis({
        descripcionCliente: p.descripcionCliente || '',
        materiales: Array.isArray(p.materiales) ? p.materiales : [],
        informe: p.informe || '',
        volumenAsumido: p.volumenAsumido || '',
        confianzaGeneral: p.confianzaGeneral || '',
      });
      setPreguntasIA(Array.isArray(p.preguntas) ? p.preguntas : []);
      setPaso(1);
    } catch (err) {
      setErrorIA(String(err?.message || err));
    } finally {
      setAnalizando(false);
    }
  }

  const puedeSeguir = (paso === 0 && b.nombre.trim()) || (paso === 1 && b.componentes.length > 0) || paso >= 2;

  if (analizando) {
    return (
      <div className="asistente">
        <Cargando titulo="Analizando el render con IA" />
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
      <button className="boton fantasma" onClick={() => (paso === 0 ? onInicio() : setPaso(paso - 1))} style={{ marginBottom: 14 }}>
        ‹ {paso === 0 ? 'Inicio' : 'Atrás'}
      </button>

      {/* PASO 1 — Identidad */}
      {paso === 0 && (
        <div>
          <div className="pregunta">¿Qué vas a costear?</div>
          <div className="pregunta-sub">Un producto nuevo, a la medida. No importa si nunca se ha hecho.</div>

          <div className="tarjeta" style={{ background: 'var(--panel)' }}>
            <label className="etiqueta">Atajo: sube un render y lo analizo con IA</label>
            <div className="ayuda">Propongo las piezas y medidas leyendo la imagen; tú las confirmas. La IA no inventa el precio — lo calcula el motor.</div>
            <div className="espacio" />
            <label className={'boton ' + (analizando ? 'fantasma' : 'primario')} style={{ display: 'inline-flex', cursor: analizando ? 'default' : 'pointer' }}>
              {analizando ? 'Analizando el render…' : 'Subir render y analizar'}
              <input type="file" accept="image/*" hidden disabled={analizando} onChange={onImagen} />
            </label>
            {errorIA && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{errorIA}</span></div>}
          </div>

          <label className="etiqueta">O escríbelo tú</label>
          <input type="text" autoFocus placeholder="Ej. Mostrador de recepción curvo"
            value={b.nombre} onChange={(e) => set({ nombre: e.target.value })} />
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
          {preguntasIA.length > 0 && (
            <div className="alerta ambar">
              <span className="texto"><strong>Confirma (IA):</strong> {preguntasIA.join(' · ')}</span>
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
            const area = esArea(ins);
            const cnt = c.piezas || 1;
            const m2 = area && c.largoMM && c.anchoMM ? (c.largoMM / 1000) * (c.anchoMM / 1000) * cnt : 0;
            return (
              <div className="pieza" key={i}>
                <div className="pieza-head">
                  <input className="pieza-nom" placeholder="Nombre de la pieza" value={c.nombre || ''} onChange={(e) => setPieza(i, { nombre: e.target.value })} />
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
                  <button className="pieza-x" onClick={() => quitarPieza(i)} aria-label="quitar">×</button>
                </div>
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
                    <span className="pieza-sub">{pesos(costoPieza(c, ins))}</span>
                  </div>
                )}
                {area && m2 > 0 && <div className="pieza-calc">= {m2.toFixed(2)} m² <span className="gris">({ins.clase === 'indirecta' ? 'comprado' : 'fabricado'})</span></div>}
                {c.iaNota && <div className="pieza-calc"><span className="gris">IA{c.iaConf ? ` · ${c.iaConf}` : ''}: {c.iaNota}</span></div>}
              </div>
            );
          })}
        </div>
      )}

      {/* PASO 3 — Mano de obra */}
      {paso === 2 && (
        <div>
          <div className="pregunta">¿Qué tan difícil es de fabricar?</div>
          <div className="pregunta-sub">Esto define las horas de taller. En el detalle puedes meter horas exactas por proceso.</div>
          <div className="ganar-botones">
            {DIFICULTAD.map((d) => (
              <button key={d.v} className={b.factorDirecta === d.v ? 'on' : ''} onClick={() => set({ factorDirecta: d.v })}>{d.nombre}</button>
            ))}
          </div>
          <div className="espacio" />
          <p className="ayuda columna-texto">Nota: para procesos especiales (curvo, termoformado, doblez, CNC) sube la dificultad — llevan más mano de obra.</p>
        </div>
      )}

      {/* PASO 4 — Resultado */}
      {paso === 3 && (
        <div className="tarjeta-precio">
          <div className="ficha-linea">{b.nombre || 'Producto nuevo'}</div>
          <div className="ayuda" style={{ margin: '6px 0' }}>Cuesta hacer 1 pieza</div>
          <div className="precio-enorme" style={{ color: 'var(--tinta)', fontSize: 38 }}>{pesos(resultado.costoUnitario)}</div>
          <div className="espacio" />
          <div className="ayuda">Precio de lista ({b.margen}% margen)</div>
          <div className="precio-enorme">{pesos(precio)}</div>
          <div className="espacio" />
          <div className="ayuda columna-texto" style={{ textAlign: 'left' }}>
            Material {pesos(resultado.materialTotal)} · Mano de obra {pesos(resultado.manoObra)} · Fábrica {pesos(resultado.indirectosFabrica)}
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="espacio" />
      {paso < N_PASOS - 1 ? (
        <button className="boton primario grande" disabled={!puedeSeguir} onClick={() => setPaso(paso + 1)}>Siguiente ›</button>
      ) : (
        <div className="fila-botones">
          <button className="boton primario grande" onClick={() => onVerDetalle(b)}>Ver detalle completo y cotizar</button>
          <button className="boton grande" onClick={() => { setB({ nombre: '', piezas: 1, componentes: [], modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12, margen: b.margen }); setPaso(0); }}>Empezar otro</button>
        </div>
      )}
    </div>
  );
}
