// ============================================================================
//  CARGAR COMPRAS DEL ERP (VH-089) · sólo Dirección.
//  Sube el reporte "Costos de Materia Prima Última Compra" (.xlsx) de Intelisis tal cual lo exporta
//  Compras. Se lee en el navegador (xlsxMinimo.js, sin dependencias), se prepara con la misma lógica
//  del cargador del 2026-10-12 (erpCarga.js) y se manda por lotes a la RPC cargar_erp_ultima_compra,
//  que: resuelve cada registro al insumo ya conocido, no duplica precios, exige documento/registro/hash
//  (DATA_TRUTH_V1), aprueba lo comprado en ≤ 24 meses y deja lo más viejo como preliminar.
//  Nada de esto inventa precios: lo que no tiene costo en el ERP no entra.
// ============================================================================
import { useState } from 'react';
import { leerHojas } from '../datos/xlsxMinimo.js';
import { prepararCargaErp } from '../datos/erpCarga.js';
import { registrosErpDesdeWorkbookProyecto } from '../datos/erpProyecto.js';
import { cargarErpLote, firmarPreciosErp } from '../nube.js';

const LOTE = 400;

// Firma de Dirección: los precios que cargó/aprobó una cuenta de prueba no cuentan como aprobación humana. Este botón los
// firma con la sesión de quien da clic (la base rechaza la cuenta QA y a cualquiera que no sea Dirección). Pide confirmar.
export function FirmaPreciosErp({ onAviso, firmar = firmarPreciosErp }) {
  const [confirmando, setConfirmando] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [avance, setAvance] = useState(null);

  async function alFirmar() {
    setFirmando(true); setError(''); setRes(null); setAvance(null);
    const r = await firmar(24, { alAvanzar: setAvance });
    setFirmando(false); setConfirmando(false);
    if (!r.ok) {
      const ya = r.resultado?.firmados || 0;
      setError(`${r.error}${ya ? ` Ya quedaron firmados ${ya}; vuelve a dar clic para seguir (no se duplica).` : ''}`);
      return;
    }
    setRes(r.resultado);
    onAviso?.(`Firmaste ${r.resultado.firmados} precios del ERP.`, 8000);
  }

  const motivos = Object.entries(res?.motivos || {});
  return (
    <div className="tarjeta" data-testid="firma-erp">
      <h2>Firmar precios del ERP</h2>
      <p className="ayuda">Aprueba <strong>con tu nombre</strong> cada precio vigente de Intelisis que tiene documento y fecha de compra en los últimos 24 meses y que todavía no tiene la firma de una persona (incluye los que aprobó la cuenta de pruebas). No cambia importes ni fechas. Se guarda quién aprobaba antes. Un precio que Compras marcó para validar no se firma: aparece abajo con su motivo.</p>
      {!confirmando && !res && <button className="boton" onClick={() => setConfirmando(true)} data-testid="firma-erp-iniciar">Firmar precios del ERP</button>}
      {confirmando && (
        <div className="alerta" data-testid="firma-erp-confirmar">
          <span className="texto">¿Confirmas que estos precios son los reales de compra y que los firmas como Dirección?</span>
          <button className="boton" onClick={alFirmar} disabled={firmando} data-testid="firma-erp-si">{firmando ? `Firmando… ${avance?.firmados ?? 0}` : 'Sí, firmar'}</button>
          <button className="boton fantasma" onClick={() => setConfirmando(false)} disabled={firmando}>Cancelar</button>
        </div>
      )}
      {error && <div className="alerta roja" data-testid="firma-erp-error"><span className="texto">{error}</span></div>}
      {res && (
        <div data-testid="firma-erp-resultado">
          <table className="datos">
            <tbody>
              <tr><td>Firmados</td><td className="num">{res.firmados}</td></tr>
              <tr><td>No firmados</td><td className="num">{res.no_firmados}</td></tr>
              <tr><td>Firmó</td><td>{res.firmado_por}</td></tr>
            </tbody>
          </table>
          {motivos.length > 0 && <ul>{motivos.map(([m, n]) => <li key={m}>{n} × {m}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}

export default function CargaERP({ onAviso }) {
  const [archivo, setArchivo] = useState(null);
  const [prep, setPrep] = useState(null);     // { catalogo, precios, resumen }
  const [leyendo, setLeyendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [avance, setAvance] = useState({ hecho: 0, total: 0 });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  async function alElegir(e) {
    const f = e.target.files && e.target.files[0];
    setPrep(null); setResultado(null); setError('');
    if (!f) return;
    setArchivo(f); setLeyendo(true);
    try {
      const buf = await f.arrayBuffer();
      const hojas = await leerHojas(buf);
      // Un solo parser para dos fuentes reales:
      //  (a) reporte estándar "Última Compra" (una hoja con Artículo + Costo Última Compra), y
      //  (b) workbook de proyecto/costeo real (explo_x_id + cata_mp), como TELCEL C-CO-320R.
      // erpProyecto recupera Clave Comercial/unidad/fecha desde cata_mp cuando la explosión no las trae,
      // deduplica evidencia repetida y NUNCA inventa valores.
      const extraido = registrosErpDesdeWorkbookProyecto(hojas);
      if (!extraido.registros.length) {
        throw new Error('El archivo no contiene una tabla reconocible de materiales con Artículo y Costo Última Compra.');
      }
      const preparado = prepararCargaErp(extraido.registros, { documento: f.name });
      setPrep({
        ...preparado,
        origen: extraido.hojaCatalogo ? 'workbook_proyecto' : 'reporte_ultima_compra',
        extraccion: extraido,
      });
    } catch (err) {
      setError(err?.message || 'No se pudo leer el archivo.');
    } finally { setLeyendo(false); }
  }

  async function cargar() {
    if (!prep || !archivo) return;
    setCargando(true); setError(''); setResultado(null);
    const tot = Math.max(Math.ceil(prep.catalogo.length / LOTE), 1) + Math.ceil(prep.precios.length / LOTE);
    setAvance({ hecho: 0, total: tot });
    const acc = { catalogo_nuevos: 0, catalogo_existentes: 0, precios_nuevos: 0, precios_duplicados: 0, aprobados: 0, errores: [] };
    const suma = (r) => { for (const k of ['catalogo_nuevos', 'catalogo_existentes', 'precios_nuevos', 'precios_duplicados', 'aprobados']) acc[k] += Number(r?.[k] || 0); if (Array.isArray(r?.errores)) acc.errores.push(...r.errores); };
    try {
      // 1) todo el catálogo primero (los precios lo referencian), 2) luego los precios.
      for (let i = 0; i < prep.catalogo.length; i += LOTE) {
        suma(await cargarErpLote(archivo.name, prep.catalogo.slice(i, i + LOTE), []));
        setAvance((a) => ({ ...a, hecho: a.hecho + 1 }));
      }
      if (!prep.catalogo.length) setAvance((a) => ({ ...a, hecho: a.hecho + 1 }));
      for (let i = 0; i < prep.precios.length; i += LOTE) {
        suma(await cargarErpLote(archivo.name, [], prep.precios.slice(i, i + LOTE)));
        setAvance((a) => ({ ...a, hecho: a.hecho + 1 }));
      }
      setResultado(acc);
      onAviso?.(`ERP cargado: ${acc.precios_nuevos} precios nuevos (${acc.aprobados} certificados), ${acc.catalogo_nuevos} insumos nuevos.`, 8000);
    } catch (err) {
      setError(`La carga se detuvo: ${err?.message || err}. Lo ya cargado se conserva; vuelve a subir el archivo: no se duplica.`);
      setResultado(acc);
    } finally { setCargando(false); }
  }

  const r = prep?.resumen;
  return (
    <div className="contenido">
      <FirmaPreciosErp onAviso={onAviso} />
      <div className="tarjeta">
        <h2>Cargar compras del ERP</h2>
        <p className="ayuda">Sube el reporte <strong>Costos de Materia Prima · Última Compra</strong> de Intelisis o un <strong>workbook real de costeo/proyecto</strong> que incluya su explosión de materiales (por ejemplo <code>explo_x_id</code> y <code>cata_mp</code>). Primero se previsualiza: nada se carga sin que Dirección pulse <strong>Cargar al catálogo</strong>. Cada precio conserva documento, fecha y unidad; lo antiguo queda preliminar y nunca se convierte en certificado sólo por venir de un proyecto histórico.</p>
        <input type="file" accept=".xlsx" onChange={alElegir} disabled={leyendo || cargando} data-testid="carga-erp-archivo" />
        {leyendo && <p className="ayuda">Leyendo el archivo…</p>}
        {error && <div className="alerta roja" data-testid="carga-erp-error"><span className="texto">{error}</span></div>}
        {r && !resultado && (
          <div data-testid="carga-erp-resumen">
            <table className="datos" style={{ marginTop: 8 }}>
              <tbody>
                <tr><td>Tipo de fuente detectada</td><td>{prep.origen === 'workbook_proyecto' ? 'Workbook de proyecto real' : 'Reporte Última Compra'}</td></tr>
                {prep.extraccion?.hojaExplosion && <tr><td>Hoja de materiales</td><td><code>{prep.extraccion.hojaExplosion}</code></td></tr>}
                {prep.extraccion?.hojaCatalogo && <tr><td>Catálogo MP auxiliar</td><td><code>{prep.extraccion.hojaCatalogo}</code></td></tr>}
                {prep.extraccion?.resumen?.registrosUnicos != null && <tr><td>Materiales/evidencias únicos extraídos</td><td className="num">{prep.extraccion.resumen.registrosUnicos}</td></tr>}
                {prep.extraccion?.resumen?.sinClave > 0 && <tr><td>Sin clave comercial (no se inventa)</td><td className="num">{prep.extraccion.resumen.sinClave}</td></tr>}
                                <tr><td>Renglones en el archivo</td><td className="num">{r.filas}</td></tr>
                <tr><td>Con costo (entran)</td><td className="num">{prep.catalogo.length}</td></tr>
                <tr><td>Sin costo (no entran, nunca $0)</td><td className="num">{r.sinCosto}</td></tr>
                <tr><td>Compra ≤ 24 meses (se certifican)</td><td className="num">{r.recientes}</td></tr>
                <tr><td>Compra más antigua (preliminares)</td><td className="num">{r.antiguos}</td></tr>
                <tr><td>Bloqueados en el ERP (entran inactivos)</td><td className="num">{r.bloqueados}</td></tr>
                {Object.keys(r.sinUnidad).length > 0 && <tr><td>Unidad no reconocida (no entran)</td><td className="num">{Object.entries(r.sinUnidad).map(([u, n]) => `${u}: ${n}`).join(', ')}</td></tr>}
              </tbody>
            </table>
            <p className="ayuda">Los registros que ya estaban con el mismo precio y fecha no se duplican. Al terminar, los precios nuevos quedan en el catálogo que usa el motor.</p>
            <button className="boton" onClick={cargar} disabled={cargando} data-testid="carga-erp-cargar">{cargando ? `Cargando… ${avance.hecho}/${avance.total}` : 'Cargar al catálogo'}</button>
          </div>
        )}
        {resultado && (
          <div data-testid="carga-erp-resultado">
            <h3>Resultado</h3>
            <table className="datos">
              <tbody>
                <tr><td>Insumos nuevos en el catálogo</td><td className="num">{resultado.catalogo_nuevos}</td></tr>
                <tr><td>Insumos ya conocidos (actualizados)</td><td className="num">{resultado.catalogo_existentes}</td></tr>
                <tr><td>Precios nuevos</td><td className="num">{resultado.precios_nuevos}</td></tr>
                <tr><td>De ellos, certificados (≤ 24 meses)</td><td className="num">{resultado.aprobados}</td></tr>
                <tr><td>Ya estaban (sin cambio)</td><td className="num">{resultado.precios_duplicados}</td></tr>
                <tr><td>Con error</td><td className="num">{resultado.errores.length}</td></tr>
              </tbody>
            </table>
            {resultado.errores.length > 0 && (
              <details><summary>Ver errores ({resultado.errores.length})</summary>
                <ul>{resultado.errores.slice(0, 50).map((e, i) => <li key={i}><code>{e.registro}</code>: {e.error}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
