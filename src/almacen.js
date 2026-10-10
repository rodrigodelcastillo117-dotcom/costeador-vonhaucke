// ============================================================================
//  ALMACEN - capa de abstraccion sobre localStorage (master 7 "Datos")
//  Guardado automatico en cada cambio (4.5 "Nada se pierde").
//  Exportar / Importar JSON (9): unica forma de compartir entre computadoras.
// ============================================================================

import { PARAMETROS_DEFAULT } from './motor/calculo.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './datos/insumos.js';
import { PIEZAS_SEMILLA } from './datos/piezas.js';
import { claveCreacionNueva } from './util.js';

const CLAVE = 'costeador-vonhaucke-v1';

// Campos sensibles de parametros: solo Direccion los ve. Con el candado activo
// NO se guardan en texto plano (van cifrados en dir.blob).
export const PARAMS_SENSIBLES = ['nominaSemanalTotal', 'nominaSemanalDirecta', 'personasTotal', 'operativos', 'costoHoraArea'];

function estadoInicial() {
  const piezas = {};
  for (const p of PIEZAS_SEMILLA) piezas[p.id] = p;
  return {
    version: 1,
    parametros: { ...PARAMETROS_DEFAULT },
    insumos: mapaInsumos(INSUMOS_SEMILLA),
    piezas,
    // ⚠️ Traía '2026-08-11' escrito a mano: el día que se tecleó esta línea, no
    // el de HOY. Es la fecha que se IMPRIME en la propuesta (Cotizacion.jsx,
    // FichaPDF.jsx, pdfPropuesta.js) — cualquier proyecto nuevo salía fechado
    // en el pasado hasta que el vendedor lo notara y lo corrigiera a mano.
    // `id` = fila en la nube (null hasta el primer guardado); `claveCreacion` = clave
    // idempotente del alta. Nacen aquí para que dos pestañas del mismo navegador
    // compartan la misma clave y NO creen dos filas (Bloque 1).
    cotizacion: { id: null, claveCreacion: claveCreacionNueva(), cliente: '', folio: '', fecha: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }), partidas: [] },
    historial: [], // costeos guardados, alimentan el Tablero
    // ⚠️ LOS ESTADOS FINANCIEROS TAMPOCO PUEDEN VIVIR AQUÍ. Iban como literales
    // (ingresos $74.7M, utilidad de operación −$16.15M) y acababan dentro del
    // HTML público. Van vacíos: Dirección los carga desde la tabla `direccion`,
    // que sí pide sesión y rol. El Tablero enseña "sin datos" hasta entonces,
    // que es infinitamente mejor que publicarlos.
    finanzas: { margenBruto: null, utilidadOperacion: null, ingresos: null },
    // Candado de Direccion (candado.js). cifrado=true una vez que ponen PIN.
    dir: { cifrado: false, blob: null },
    onboardingVisto: false, // la guia de bienvenida se muestra solo la 1a vez
  };
}

// Reune los datos sensibles que se cifran bajo el candado.
export function reunirSensibles(estado) {
  const nomina = {};
  for (const f of PARAMS_SENSIBLES) nomina[f] = estado.parametros[f];
  return { nomina, finanzas: estado.finanzas };
}

// ⚠️ SI `cargar()` FALLA, App.jsx arranca con `estadoInicial()` como si fuera
// la primera vez que alguien abre la app — la cotización, los insumos con
// precios propios, el historial, todo. Antes eso pasaba en silencio: nada le
// avisaba al vendedor que perdió su trabajo, y el siguiente `guardar()`
// automático (cada cambio, ver App.jsx) sobreescribía lo que hubiera quedado
// en localStorage con el estado en blanco, VOLVIENDO IRRECUPERABLE lo que a
// lo mejor sólo tenía un byte corrupto. Ahora: 1) lo crudo se respalda bajo
// otra clave ANTES de darlo por perdido, por si se puede rescatar a mano, y
// 2) se deja una razón que App.jsx puede leer para avisar en pantalla en vez
// de arrancar como si nada.
let razonArranqueEnBlanco = null;
export const razonDeArranqueEnBlanco = () => razonArranqueEnBlanco;

// Lee del almacen y rellena lo que falte con el estado inicial (para no romper
// si se agregan campos nuevos entre versiones).
export function cargar() {
  let crudo = null;
  try {
    crudo = localStorage.getItem(CLAVE);
    if (!crudo) return estadoInicial();
    const guardado = JSON.parse(crudo);
    const base = estadoInicial();
    const est = {
      ...base,
      ...guardado,
      parametros: { ...base.parametros, ...(guardado.parametros || {}) },
      // Los insumos guardados mandan (traen los precios reales del usuario),
      // pero si aparece un insumo nuevo en la semilla, se agrega.
      insumos: { ...base.insumos, ...(guardado.insumos || {}) },
      piezas: { ...base.piezas, ...(guardado.piezas || {}) },
      cotizacion: { ...base.cotizacion, ...(guardado.cotizacion || {}), claveCreacion: guardado.cotizacion?.claveCreacion || base.cotizacion.claveCreacion },
      finanzas: { ...base.finanzas, ...(guardado.finanzas || {}) },
      dir: { ...base.dir, ...(guardado.dir || {}) },
    };
    // Con candado activo, los sensibles NO estan en texto plano: se blanquean
    // hasta que Direccion desbloquee con el PIN.
    if (est.dir.cifrado) {
      for (const f of PARAMS_SENSIBLES) est.parametros[f] = f === 'costoHoraArea' ? { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0 } : null;
      est.finanzas = null;
    }
    return est;
  } catch (e) {
    console.error('almacen.cargar: no se pudo leer lo guardado, se arranca en blanco', e);
    if (crudo) {
      try { localStorage.setItem(CLAVE + '-dañado-' + Date.now(), crudo); } catch (e2) { /* si ni esto se puede, no hay más que hacer */ }
    }
    razonArranqueEnBlanco = 'No se pudieron leer tus datos guardados en esta computadora (se quedó un respaldo dañado, revísalo con Dirección). Arrancaste en blanco.';
    return estadoInicial();
  }
}

export function guardar(estado) {
  try {
    let aGuardar = estado;
    // Candado activo: quitar los sensibles del texto plano antes de persistir
    // (ya viven cifrados en dir.blob).
    if (estado.dir?.cifrado) {
      aGuardar = { ...estado, parametros: { ...estado.parametros }, finanzas: null };
      for (const f of PARAMS_SENSIBLES) delete aGuardar.parametros[f];
    }
    localStorage.setItem(CLAVE, JSON.stringify(aGuardar));
    return true;
  } catch (e) {
    // Puede fallar por cuota llena o por modo privado que bloquea localStorage.
    // El llamador (App.jsx) decide cómo avisarlo; aquí sólo se deja de mentir
    // devolviendo `true`.
    console.error('almacen.guardar: no se pudo guardar en esta computadora', e);
    return false;
  }
}

// Restablecer precios de fabrica sin perder piezas ni cotizaciones (7.5)
export function restablecerPrecios(estado) {
  const base = mapaInsumos(INSUMOS_SEMILLA);
  return { ...estado, insumos: base };
}

// Exportar todo a un archivo .json (9). Con candado activo, los sensibles
// salen SOLO cifrados (nunca en texto plano), aunque este desbloqueado.
export function exportar(estado) {
  let exportable = estado;
  if (estado.dir?.cifrado) {
    exportable = { ...estado, parametros: { ...estado.parametros }, finanzas: null };
    for (const f of PARAMS_SENSIBLES) delete exportable.parametros[f];
  }
  const texto = JSON.stringify(exportable, null, 2);
  const blob = new Blob([texto], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vonhaucke-costeador-${estado.cotizacion?.fecha || 'datos'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Importar desde un archivo .json elegido por el usuario
export function importar(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const datos = JSON.parse(lector.result);
        const base = estadoInicial();
        const est = {
          ...base,
          ...datos,
          parametros: { ...base.parametros, ...(datos.parametros || {}) },
          insumos: { ...base.insumos, ...(datos.insumos || {}) },
          piezas: { ...base.piezas, ...(datos.piezas || {}) },
          dir: { ...base.dir, ...(datos.dir || {}) },
        };
        if (est.dir.cifrado) {
          for (const f of PARAMS_SENSIBLES) est.parametros[f] = f === 'costoHoraArea' ? { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0 } : null;
          est.finanzas = null;
        }
        resolve(est);
      } catch (e) {
        reject(new Error('El archivo no se pudo leer. Revisa que sea el .json exportado por la app.'));
      }
    };
    lector.onerror = () => reject(new Error('No se pudo abrir el archivo.'));
    lector.readAsText(archivo);
  });
}

export { estadoInicial };
