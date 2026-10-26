// ============================================================================
//  LECTOR MÍNIMO DE .xlsx (VH-089) · sin dependencias.
//  Un .xlsx es un ZIP con XML. Aquí se lee el directorio central del ZIP, se
//  descomprime (DecompressionStream 'deflate-raw', nativo en navegador y Node ≥ 18) y
//  se parsea la primera hoja + sharedStrings con expresiones regulares (sin DOM, para
//  que funcione igual en el navegador y en vitest). Alcance deliberado: hojas tabulares
//  simples como el reporte "Costos de Materia Prima Última Compra" del ERP. No soporta
//  fórmulas (se lee el valor cacheado), ni hojas con celdas fusionadas complejas.
// ============================================================================

const SIG_EOCD = 0x06054b50, SIG_CEN = 0x02014b50, SIG_LOC = 0x04034b50;

function u16(d, o) { return d[o] | (d[o + 1] << 8); }
function u32(d, o) { return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0; }

async function inflar(bytes, metodo) {
  if (metodo === 0) return bytes;
  if (metodo !== 8) throw new Error(`ZIP: método de compresión ${metodo} no soportado`);
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede descomprimir el archivo (DecompressionStream).');
  const ds = new DecompressionStream('deflate-raw');
  const resp = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await resp.arrayBuffer());
}

/** Lee las entradas de un ZIP (ArrayBuffer/Uint8Array) → Map nombre → Uint8Array. */
export async function leerZip(buf) {
  const d = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let eocd = -1;
  for (let i = d.length - 22; i >= Math.max(0, d.length - 70000); i--) { if (u32(d, i) === SIG_EOCD) { eocd = i; break; } }
  if (eocd < 0) throw new Error('No es un archivo ZIP/xlsx válido.');
  const total = u16(d, eocd + 10);
  let off = u32(d, eocd + 16);
  const out = new Map();
  for (let k = 0; k < total; k++) {
    if (u32(d, off) !== SIG_CEN) throw new Error('ZIP: directorio central corrupto.');
    const metodo = u16(d, off + 10);
    const compSize = u32(d, off + 20);
    const nameLen = u16(d, off + 28), extraLen = u16(d, off + 30), commLen = u16(d, off + 32);
    const locOff = u32(d, off + 42);
    const nombre = new TextDecoder().decode(d.subarray(off + 46, off + 46 + nameLen));
    if (u32(d, locOff) !== SIG_LOC) throw new Error('ZIP: cabecera local corrupta.');
    const lNameLen = u16(d, locOff + 26), lExtraLen = u16(d, locOff + 28);
    const dataOff = locOff + 30 + lNameLen + lExtraLen;
    out.set(nombre, await inflar(d.subarray(dataOff, dataOff + compSize), metodo));
    off += 46 + nameLen + extraLen + commLen;
  }
  return out;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function desescaparXml(s) {
  return String(s).replace(/&(amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#\d+);/g, (m, e) => {
    if (ENT[e] != null) return ENT[e];
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return m;
  });
}

function textoDe(xml) {
  // concatena todos los <t> (texto enriquecido incluido)
  const partes = [];
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) partes.push(desescaparXml(m[1]));
  return partes.join('');
}

export function colAIndice(letras) {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Serial de Excel (días desde 1899-12-30) → 'YYYY-MM-DD'. */
export function serialAFechaISO(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Parsea el XML de una hoja ya descomprimida.
 */
function filasDeXmlHoja(xml, ss = []) {
  const filas = [];
  for (const rm of String(xml || '').matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const fila = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], inner = cm[2] || '';
      const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      if (!ref) continue;
      const idx = colAIndice(ref);
      const t = (attrs.match(/\bt="([^"]+)"/) || [])[1] || 'n';
      let v = null;
      if (t === 's') { const i = Number((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]); v = Number.isFinite(i) ? ss[i] ?? null : null; }
      else if (t === 'inlineStr') v = textoDe(inner);
      else if (t === 'str' || t === 'e') v = desescaparXml((inner.match(/<v>([\s\S]*?)<\/v>/) || [, ''])[1]);
      else if (t === 'b') v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [, '0'])[1] === '1';
      else { const raw = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; v = raw == null || raw === '' ? null : Number(raw); }
      while (fila.length < idx) fila.push(null);
      fila[idx] = v;
    }
    filas.push(fila);
  }
  return filas;
}

function rutaXlsx(target = '') {
  const t = String(target || '').replace(/^\//, '');
  if (!t) return '';
  if (t.startsWith('xl/')) return t;
  if (t.startsWith('../')) return 'xl/' + t.replace(/^\.\.\//, '');
  return 'xl/' + t.replace(/^\.\//, '');
}

/**
 * Lee TODAS las hojas del .xlsx en el orden del workbook.
 * Devuelve [{ nombre, filas }]. Esto permite abrir workbooks reales de proyecto
 * (TELCEL: solicitud, tabla_de_comparación, explo_x_id, cata_mp...) sin asumir que
 * la primera hoja es el reporte tabular.
 */
export async function leerHojas(buf) {
  const zip = await leerZip(buf);
  const dec = new TextDecoder();
  const ss = [];
  const ssXml = zip.get('xl/sharedStrings.xml');
  if (ssXml) for (const m of dec.decode(ssXml).matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(textoDe(m[1]));

  const wbRaw = zip.get('xl/workbook.xml');
  const relRaw = zip.get('xl/_rels/workbook.xml.rels');
  if (wbRaw && relRaw) {
    const wb = dec.decode(wbRaw), rels = dec.decode(relRaw);
    const relMap = new Map();
    for (const m of rels.matchAll(/<Relationship\b([^>]*?)\/?\s*>/g)) {
      const attrs = m[1] || '';
      const id = (attrs.match(/\bId="([^"]+)"/) || [])[1];
      const target = (attrs.match(/\bTarget="([^"]+)"/) || [])[1];
      if (id && target) relMap.set(id, target);
    }
    const hojas = [];
    for (const m of wb.matchAll(/<sheet\b([^>]*?)\/?\s*>/g)) {
      const attrs = m[1] || '';
      const nombre = desescaparXml((attrs.match(/\bname="([^"]*)"/) || [, 'Hoja'])[1]);
      const rid = (attrs.match(/\br:id="([^"]+)"/) || [])[1];
      const ruta = rutaXlsx(relMap.get(rid));
      const hoja = ruta ? zip.get(ruta) : null;
      if (!hoja) continue;
      hojas.push({ nombre, filas: filasDeXmlHoja(dec.decode(hoja), ss) });
    }
    if (hojas.length) return hojas;
  }

  // Fallback para archivos muy simples o workbook.xml raro.
  const hoja = zip.get('xl/worksheets/sheet1.xml');
  if (!hoja) throw new Error('El archivo no tiene hojas legibles.');
  return [{ nombre: 'Hoja1', filas: filasDeXmlHoja(dec.decode(hoja), ss) }];
}

/** Lee la primera hoja del .xlsx (compatibilidad con VH-089). */
export async function leerPrimeraHoja(buf) {
  const hojas = await leerHojas(buf);
  return hojas[0]?.filas || [];
}

/**
 * Filas → objetos por encabezado (primera fila). Las columnas cuyo encabezado
 * contiene "fecha" se convierten de serial Excel a 'YYYY-MM-DD'.
 */
export function filasAObjetos(filas, indiceEncabezado = 0) {
  if (!filas.length || indiceEncabezado < 0 || indiceEncabezado >= filas.length) return { encabezados: [], registros: [] };
  const enc = (filas[indiceEncabezado] || []).map((h) => String(h ?? '').trim());
  const esFecha = enc.map((h) => /fecha/i.test(h));
  const registros = [];
  for (const f of filas.slice(indiceEncabezado + 1)) {
    if (!f || f.every((c) => c == null || c === '')) continue;
    const o = {};
    enc.forEach((h, i) => {
      if (!h) return;
      let v = f[i] ?? null;
      if (esFecha[i] && typeof v === 'number') v = serialAFechaISO(v);
      if (typeof v === 'string') v = v.trim();
      o[h] = v === '' ? null : v;
    });
    registros.push(o);
  }
  return { encabezados: enc, registros };
}
