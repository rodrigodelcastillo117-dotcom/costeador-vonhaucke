// ============================================================================
//  EDITAR UN MUEBLE DE LA COTIZACIÓN
//  El cliente cambia de opinión sobre UNA pieza —la quiere de 1.80 y no de
//  1.50, o en chapa en vez de melamina— y antes había que borrarla y volver a
//  empezar. Aquí se abre ese mueble con sus opciones reales (las mismas de su
//  línea), se recotiza en vivo y se guarda.
//
//  Sólo se puede editar lo que salió de una LÍNEA (trae ruta + producto +
//  config). Lo del banco de precios y los especiales no se editan aquí: su
//  precio no viene de un despiece parametrizable.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { costearConfig, productoDe } from '../datos/lineas.js';
import { imagenProducto } from '../datos/imagenes.js';
import { hexDeColor } from '../datos/coloresHex.js';
import { pesos } from '../util.js';

export const sePuedeEditar = (pt) => !!(pt && pt.ruta && pt.productoId && !pt.deBanco);

export default function EditarPartida({ estado, partida, onGuardar, onCerrar }) {
  const info = useMemo(() => productoDe(partida.ruta, partida.productoId), [partida.ruta, partida.productoId]);
  const [cfg, setCfg] = useState(() => ({ ...(partida.config || {}), producto: partida.productoId }));
  const [cant, setCant] = useState(partida.cantidad || 1);
  const cajaRef = useRef(null);
  const cerrarRef = useRef(null);

  useEffect(() => {
    const antes = document.activeElement;
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflow;
      if (antes instanceof HTMLElement) antes.focus();
    };
  }, [onCerrar]);

  // Se recotiza en cada cambio: el vendedor ve el precio moverse mientras elige.
  const nuevo = useMemo(
    () => costearConfig(estado, partida.ruta, partida.productoId, cfg, cant),
    [estado, partida.ruta, partida.productoId, cfg, cant],
  );

  if (!info || !nuevo) {
    return (
      <div className="modal-fondo no-imprimir" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
        <div className="modal-caja" style={{ maxWidth: 460 }}>
          <div className="guia-cab">
            <div className="guia-cab-txt"><h2>No se puede editar</h2>
              <div className="ayuda">Este mueble no viene de una línea del catálogo. Quítalo y agrégalo de nuevo con las medidas correctas.</div>
            </div>
            <button className="modal-x" onClick={onCerrar} aria-label="Cerrar" ref={cerrarRef}>×</button>
          </div>
          <div className="guia-pie"><span /><button className="boton primario" onClick={onCerrar}>Entendido</button></div>
        </div>
      </div>
    );
  }

  const prod = info.producto;
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const foto = imagenProducto(partida.ruta, partida.productoId);
  const cambioPrecio = nuevo.precioUnitario - (partida.precioUnitario || 0);

  const Chips = ({ etiqueta, opciones, valor, alElegir, fmt, conSwatch }) => (
    <div className="ed-campo">
      <label className="etiqueta">{etiqueta}</label>
      <div className="chips">
        {opciones.map((o) => {
          const id = typeof o === 'object' ? o.id : o;
          const txt = typeof o === 'object' ? o.label : (fmt ? fmt(o) : o);
          const hex = conSwatch && hexDeColor(id);
          return (
            <button key={id} className={`chip ${valor === id ? 'on' : ''}`} onClick={() => alElegir(id)}>
              {hex && <span className="chip-swatch" style={{ background: hex }} />}
              {txt}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="modal-fondo no-imprimir" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="modal-caja" role="dialog" aria-modal="true" aria-label="Editar el mueble" ref={cajaRef}>
        <div className="guia-cab">
          <div className="guia-cab-txt">
            <h2>Editar este mueble</h2>
            <div className="ayuda">{info.linea} · cambia medidas, acabado o cantidad y el precio se ajusta solo.</div>
          </div>
          <button className="modal-x" onClick={onCerrar} aria-label="Cerrar sin guardar" ref={cerrarRef}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="guia-cuerpo">
          {foto && <div className="ed-foto" style={{ backgroundImage: `url(${foto})` }} role="img" aria-label={prod.nombre} />}

          {prod.largos && <Chips etiqueta="Largo" opciones={prod.largos} valor={cfg.largoMM} alElegir={(v) => set('largoMM', v)} fmt={(o) => (o / 1000).toFixed(2) + ' m'} />}
          {prod.fondos?.length > 1 && <Chips etiqueta="Fondo" opciones={prod.fondos} valor={cfg.fondoMM} alElegir={(v) => set('fondoMM', v)} fmt={(o) => (o / 1000).toFixed(2) + ' m'} />}
          {prod.largosLateral && <Chips etiqueta="Retorno (lateral)" opciones={prod.largosLateral} valor={cfg.largoLateralMM} alElegir={(v) => set('largoLateralMM', v)} fmt={(o) => (o / 1000).toFixed(2) + ' m'} />}
          {prod.diametros && <Chips etiqueta="Diámetro" opciones={prod.diametros} valor={cfg.diametroMM} alElegir={(v) => set('diametroMM', v)} fmt={(o) => 'Ø ' + (o / 1000).toFixed(2) + ' m'} />}
          {prod.usuarios && <Chips etiqueta="Usuarios" opciones={prod.usuarios} valor={cfg.usuarios} alElegir={(v) => set('usuarios', v)} />}
          {(prod.selects || []).map((s) => (
            <Chips key={s.key} etiqueta={s.label} opciones={s.opciones} valor={cfg[s.key]} alElegir={(v) => set(s.key, v)} />
          ))}
          {prod.finishes && <Chips etiqueta="Acabado" opciones={prod.finishes} valor={cfg.finish} alElegir={(v) => set('finish', v)} />}
          {prod.colores && (!prod.finishes || cfg.finish === 'ABS') && (
            <Chips etiqueta="Color" opciones={prod.colores} valor={cfg.color || prod.colores[0].id} alElegir={(v) => set('color', v)} conSwatch />
          )}
          {prod.biombo && (
            <div className="ed-campo">
              <label className="etiqueta">Biombo</label>
              <div className="chips">
                <button className={`chip ${!cfg.biombo ? 'on' : ''}`} onClick={() => set('biombo', null)}>Sin biombo</button>
                {partida.ruta === 'applt' && <button className={`chip ${cfg.biombo === 'pet' ? 'on' : ''}`} onClick={() => set('biombo', 'pet')}>PET acústico 9mm</button>}
                <button className={`chip ${cfg.biombo === 'cristal' ? 'on' : ''}`} onClick={() => set('biombo', 'cristal')}>Cristal 6mm</button>
                <button className={`chip ${cfg.biombo === 'melamina' ? 'on' : ''}`} onClick={() => set('biombo', 'melamina')}>Melamina 9mm</button>
              </div>
            </div>
          )}
          {(prod.checks || []).map((ch) => (
            <label className="check" key={ch.key}>
              <input type="checkbox" checked={!!cfg[ch.key]} onChange={(e) => set(ch.key, e.target.checked)} /> {ch.label}
            </label>
          ))}

          <div className="ed-campo">
            <label className="etiqueta">Cantidad</label>
            <span className="masmenos">
              <button style={{ width: 46, height: 46 }} onClick={() => setCant((n) => Math.max(1, n - 1))} aria-label="Menos">−</button>
              <span className="valor" style={{ minWidth: '2ch' }}>{cant}</span>
              <button style={{ width: 46, height: 46 }} onClick={() => setCant((n) => n + 1)} aria-label="Más">+</button>
            </span>
          </div>
        </div>

        <div className="ed-pie">
          <div className="ed-resumen">
            <div className="ed-nombre">{nuevo.nombre}</div>
            <div className="ed-precio">
              {pesos(nuevo.precioUnitario * cant)}
              {cambioPrecio !== 0 && (
                <span className={`ed-delta ${cambioPrecio > 0 ? 'sube' : 'baja'}`}>
                  {cambioPrecio > 0 ? '+' : '−'}{pesos(Math.abs(cambioPrecio))} por pieza
                </span>
              )}
            </div>
          </div>
          <div className="fila-botones" style={{ gap: 10 }}>
            <button className="boton fantasma" style={{ minHeight: 48 }} onClick={onCerrar}>Cancelar</button>
            <button className="boton primario" style={{ minHeight: 48 }} onClick={() => onGuardar({
              ...partida,
              nombre: nuevo.nombre, config: nuevo.config, cantidad: cant,
              costoUnitario: nuevo.costoUnitario, precioUnitario: nuevo.precioUnitario,
              margen: nuevo.margen, w: nuevo.w, d: nuevo.d,
              precioReal: !!nuevo.precioReal,
              // El artículo del catálogo de la NUEVA medida (o null si dejó de
              // casar): así el piso y las variantes siguen a lo que quedó.
              catalogo: nuevo.catalogo || null, variantes: nuevo.variantes || null,
              // Ya lo revisó una persona: la nota y la confianza de la IA sobran.
              nota: null, confianza: null,
            })}>Guardar cambios</button>
          </div>
        </div>
      </div>
    </div>
  );
}
