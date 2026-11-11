// ============================================================================
//  PDF del EXPEDIENTE DE INGENIERIA (industrial). Documento INTERNO: muestra costos y
//  pendientes para Ingenieria (NO es la propuesta seller-safe del cliente). Reusa jsPDF y
//  el view-model existente (vistaIngenieria); no recalcula ni crea un segundo motor.
//  Marca el estado real: PRELIMINAR hasta que el servidor certifique.
// ============================================================================
import { jsPDF } from 'jspdf/dist/jspdf.es.min.js';
import { vistaIngenieria } from './pantallaIngenieria.js';

const money = (n) => (n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`);

/** Construye el documento jsPDF del expediente. Devuelve el doc (para guardar o inspeccionar). */
export function construirPdfExpediente(expediente = {}) {
  const v = vistaIngenieria(expediente);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 16;
  const linea = (txt, { size = 10, bold = false, dy = 6 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    doc.text(String(txt).slice(0, 110), 14, y); y += dy;
    if (y > 280) { doc.addPage(); y = 16; }
  };
  linea(`Expediente de Ingenieria — ${v.clave || '(sin clave)'}`, { size: 15, bold: true, dy: 9 });
  if (v.esto_entendi?.producto) linea(`Producto: ${v.esto_entendi.producto}`, { size: 9, dy: 7 });

  linea('Asi lo fabricaria (BOM / piezas)', { bold: true });
  const piezas = v.asi_lo_fabricaria?.piezas_fabricadas || [];
  if (!piezas.length) linea('— sin piezas costeadas aun —', { size: 9, dy: 5 });
  for (const p of piezas) linea(`- ${p.clave} | ${p.estado || ''} ${p.metodo || ''} | MP ${money(p.costo_mp)}`, { size: 9, dy: 5 });
  const pend = v.asi_lo_fabricaria?.desarrollos_pendientes || [];
  if (pend.length) linea(`Pendientes de CAD: ${pend.join(', ')}`, { size: 9, dy: 7 });

  y += 2; linea('Este es el costo', { bold: true });
  const c = v.este_es_el_costo || {};
  linea(`Material fabricado ${money(c.material_fabricado_verificable)} | comprado ${money(c.material_comprado)}`, { size: 9, dy: 5 });
  linea(`MO (POLITICA_VH) ${money(c.mano_obra_politica_vh)} | GIF ${money(c.gif)}`, { size: 9, dy: 5 });
  linea(`Total parcial ${money(c.total_parcial)} — estado: ${c.estado || 'PARCIAL'} ${c.certificable ? '(certificable)' : '(PRELIMINAR)'}`, { size: 10, bold: true, dy: 8 });

  linea('Esto necesito confirmar (Ingenieria)', { bold: true });
  const confs = v.esto_necesito_confirmar || [];
  if (!confs.length) linea('— sin pendientes de confirmacion —', { size: 9, dy: 5 });
  for (const q of confs) linea(`- ${q.decision} (${q.n})`, { size: 9, dy: 5 });

  const aplicadas = expediente.confirmaciones || [];
  if (aplicadas.length) { y += 2; linea(`Confirmaciones aplicadas: ${aplicadas.length} (version ${expediente.version || 1})`, { size: 9, dy: 5 }); }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
  doc.text('Documento INTERNO de Ingenieria (costos, no seller-safe). PRELIMINAR hasta certificacion del servidor.', 14, 290);
  return doc;
}

/** Descarga el PDF (en la app real; en sandbox la descarga puede estar bloqueada). */
export function descargarPdfExpediente(expediente = {}, archivo) {
  construirPdfExpediente(expediente).save(archivo || `expediente_${expediente.clave || 'mueble'}.pdf`);
  return true;
}
