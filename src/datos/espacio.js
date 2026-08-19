// ============================================================================
//  Helpers de ESPACIO / ACOMODO (compartidos por Acomodo, PlanoAcomodo, PDF).
//  Tipo + color + altura por mueble, huella por defecto, y expansión de las
//  partidas de la cotización a piezas individuales con su huella real.
// ============================================================================
export const TIPOS = {
  escritorio: { label: 'Escritorios', color: '#3b6fb0', alto: 730 },
  juntas: { label: 'Juntas', color: '#0f766e', alto: 740 },
  guarda: { label: 'Guardas', color: '#8a6d3b', alto: 1100 },
  asiento: { label: 'Asientos', color: '#b8862f', alto: 450 },
  mesa: { label: 'Mesas', color: '#4b8b5a', alto: 550 },
  mampara: { label: 'Mamparas', color: '#7a7570', alto: 1500 },
  recepcion: { label: 'Recepción', color: '#7a5c9a', alto: 1100 },
  mueble: { label: 'Otros', color: '#9a908a', alto: 700 },
};

// Huella por defecto si la partida no trae medida (mm).
export const HUELLA = {
  escritorio: [1500, 750], juntas: [2400, 1200], guarda: [900, 450],
  asiento: [600, 600], mesa: [900, 900], mampara: [1600, 80],
  recepcion: [2400, 800], mueble: [800, 600],
};

// Quita acentos: los nombres reales traen "Estación", "Sofá", "Mampara…" y las
// reglas se escriben sin acento.
const sinAcento = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Una GAVETA / pedestal / cajonera rodante vive DEBAJO de la cubierta: no gasta
// piso propio. Antes caía en 'guarda' y el acomodo le apartaba su metro cuadrado,
// así que un proyecto con 20 gavetas pedía un espacio que no necesita.
// Un archivero, credenza, armario, torre o locker SÍ ocupan piso: se distinguen
// por palabra y por tamaño (una gaveta rodante mide ~0.38 × 0.58 m).
export function vaBajoEscritorio(pt) {
  const s = sinAcento((pt.ruta || '') + ' ' + (pt.nombre || ''));
  if (!/gaveta|pedestal|cajonera|buc\b/.test(s)) return false;
  if (/archivero de piso|armario|torre|locker|librero|credenza/.test(s)) return false;
  // Si trae medida y es grande, no cabe bajo la cubierta → sí ocupa piso.
  if (pt.w && pt.w > 600) return false;
  if (pt.d && pt.d > 700) return false;
  return true;
}

export function tipoDe(pt) {
  const s = sinAcento((pt.ruta || '') + ' ' + (pt.nombre || ''));
  // El orden importa: lo más específico primero.
  // ⚠️ PERO UNA BANCA CON BIOMBOS SIGUE SIENDO UNA BANCA. El biombo es un
  // ACCESORIO del bench (App LT lo ofrece como "Biombos laterales"), y si el
  // nombre lo menciona, esta regla convertía el bench en mampara: `enderezarAlto`
  // le dejaba 80 mm de fondo y una banca de 6 usuarios se dibujaba como un muro
  // de 4.50 × 0.08 m. Hoy ningún producto del catálogo se llama así, pero los
  // nombres que escribe Voni desde el texto del cliente sí pueden.
  const esMueble = /escritorio|bench|banca|estacion|mesa|credenza|archiv|gaveta|librero/.test(s);
  if (!esMueble && /mampara|privacy|muro|biombo|lambrin/.test(s)) return 'mampara';
  if (/credenza|guarda|archiv|gaveta|armario|librero|locker|torre|modulor|mox|cajon/.test(s)) return 'guarda';
  if (/soporte de pantalla|teamspace ii/.test(s)) return 'mueble';   // accesorio, no mesa de juntas
  // Redondas de colaboración (circular, "Olga", mesa de trabajo) van a altura de
  // junta (740), no de mesa de centro (550).
  if (/junta|consejo|teamspace|mesa circular|circular "olga"|mesa de trabajo/.test(s)) return 'juntas';
  // OJO: en Von Haucke "banca" = bench de ESCRITORIOS (no un asiento). Va antes
  // que la regla de asientos y antes que la de mesas.
  // ⚠️ EL MOSTRADOR DE RECEPCIÓN NO ES UN ESCRITORIO (2026-08-17). Caía en
  // 'escritorio', y como un escritorio suelto prefiere el PRIVADO, el mostrador
  // se fue a la oficina del director: medido en el plano real de Rodrigo, la
  // "Recepción" acabó en el Privado 5 y la recepción quedó sin mostrador.
  // Tiene su propio tipo para poder mandarlo a su cuarto.
  if (/recepcion|mostrador|lobby/.test(s)) return 'recepcion';
  if (/escritorio|bench|banca|estacion|operativo|ducto|qvadrat|cantilever/.test(s)) return 'escritorio';
  if (/mesa|pebble|accent|apoyo|centro|spoon|repisa/.test(s)) return 'mesa';
  if (/sill|pouf|sofa|taburete|lounge|pac|tetris|arlequin|bricks|ding/.test(s)) return 'asiento';
  if (/app|cirque|feather|via|drift|eclipse|luna|alba|anteo|spine|ergo|rio/.test(s)) return 'escritorio';
  return 'mueble';
}

export const colorTipo = (t) => (TIPOS[t] || TIPOS.mueble).color;
export const altoTipo = (t) => (TIPOS[t] || TIPOS.mueble).alto;

// Dimensiones proyectadas de una pieza según giro (0/90).
// La huella sólo depende de si el giro es "de canto" (90/270) o no (0/180).
// El giro completo importa para el FRENTE del mueble: a 0 la silla va abajo, a
// 90 a la izquierda, a 180 arriba y a 270 a la derecha. Antes sólo existían 0 y
// 90, así que girar un escritorio cambiaba su huella pero la silla seguía
// saliendo del mismo lado: se veía igual por más que lo giraras.
export const dimsPieza = (p, rot) => ((rot === 90 || rot === 270) ? { pw: p.d, ph: p.w } : { pw: p.w, ph: p.d });

// Hacia dónde MIRA el mueble (dónde se sienta la gente), en pantalla.
export const frenteDe = (rot) => (rot === 90 ? 'izq' : rot === 180 ? 'arriba' : rot === 270 ? 'der' : 'abajo');

// En un mueble ALTO (armario, torre, muro) la pieza más grande del despiece es un
// costado o un panel de PIE: mide ancho × ALTURA, no ancho × fondo. Tomarla tal
// cual hace que un armario ocupe 1.13 m de piso en vez de 0.45. Aquí se detecta
// (fondo imposible para ese tipo) y se devuelve el fondo real + la altura real.
export function enderezarAlto(w, d, tipo) {
  const limite = tipo === 'mampara' ? 400 : 700;   // fondo máximo creíble
  if (!d || d <= limite) return { w, d, alto: null };
  return { w, d: (HUELLA[tipo] || HUELLA.mueble)[1], alto: d };
}

// Huella REAL para muebles multi-posición: una "banca doble 6 puestos" no ocupa
// 1.20×0.75 (un puesto) sino el bloque completo. Parsea "N puestos/plazas/personas"
// del nombre y arma el bloque (afecta SOLO el acomodo, no el costo).
export function huellaReal(nombre, w, d, tipo) {
  const s = sinAcento(nombre);
  // ¡SE APLICA DOS VECES! `nombreConBloque` (lineas.js) ya expandió la banca al
  // armar la partida y guardó ahí la huella del bloque; si aquí se vuelve a
  // multiplicar por los puestos, una banca doble de 10 usuarios a 1.50 pasa de
  // 7.50 m a 37.50 m y ya no cabe en ninguna oficina del mundo. Pasaba con
  // TODAS las bancas y sofás: por eso el acomodo decía "se sale del área" y el
  // open space quedaba vacío. Dos candados:
  //   1) el nombre ya declara "· ocupa A × B m" -> la huella está resuelta;
  //   2) la medida ya es de bloque (ningún puesto individual mide tanto).
  if (/\bocupa\s+[\d.]+\s*[x×]\s*[\d.]+\s*m/.test(s)) return [w, d];
  const YA_BLOQUE = { escritorio: 2500, asiento: 1800 };
  if (w >= (YA_BLOQUE[tipo] || Infinity)) return [w, d];
  // Los generadores escriben el número de puestos de tres formas: "4 puestos",
  // "4 usuarios" (App/App LT) y "2u" (Río). Las tres cuentan.
  const m = /(\d+)\s*(?:puesto|plaza|persona|posicion|usuario)s?\b/.exec(s) || /(\d+)\s*u\b(?!\w)/.exec(s);
  if (!m) return [w, d];
  const n = Math.max(1, +m[1]);
  if (n <= 1) return [w, d];
  if (tipo === 'escritorio') {
    const perW = (w && w >= 700) ? w : 1200; // ancho por puesto
    const perD = (d && d >= 500) ? d : 750;   // fondo por puesto
    const doble = /doble/.test(s);
    // En un bench doble las dos hileras se enfrentan: el largo lo dan n/2
    // columnas. El fondo SOLO se duplica si la medida capturada es de UNA hilera
    // (≤1.00 m); las líneas que ya declaran fondo de bench (App LT 1.20) no.
    if (!doble) return [n * perW, perD];
    return [Math.ceil(n / 2) * perW, perD >= 1000 ? perD : perD * 2];
  }
  if (tipo === 'asiento') {
    const perW = (w && w >= 500) ? w : 700;
    return [n * perW, d || 800]; // sofá de N plazas en fila
  }
  return [w, d];
}

// Cuántas piezas se van DEBAJO del escritorio (no se acomodan, no ocupan piso).
// Se cuentan para poder decirlo en pantalla en vez de desaparecerlas en silencio.
export function contarBajoEscritorio(partidas) {
  return (partidas || []).reduce((s, pt) => s + (vaBajoEscritorio(pt) ? Math.max(1, Math.min(pt.cantidad || 1, 300)) : 0), 0);
}

// ⚠️ LOS TOPES ERAN 30 POR PARTIDA Y 60 EN TOTAL, Y RECORTABAN EN SILENCIO
// (2026-08-17). El plano real de Rodrigo pide **48 operativos**: la app dibujaba
// **30 sillas** y no lo decía en ningún lado — ni una nota, ni el cartel de la
// auditoría, que además contaba "N de M" sobre el M YA RECORTADO, así que decía
// "todas colocadas" mintiendo. Un proyecto de oficina de verdad pasa de 60
// piezas fácil (48 sillas + 48 gavetas + 8 bancas + 5 privados + juntas).
// Se suben a un número que no estorbe a un proyecto real, y se mantiene un tope
// sólo como freno contra un error de dedo (una cantidad de 99,999).
const TOPE_PARTIDA = 300;
// Expande las partidas de la cotización a piezas individuales (máx `tope`).
export function expandirPiezas(partidas, tope = 600) {
  const out = [];
  let real = 0;
  for (const pt of partidas || []) {
    if (vaBajoEscritorio(pt)) continue;      // va bajo la cubierta: no pide piso
    const tipo = tipoDe(pt);
    let w = pt.w, d = pt.d;
    // Para asientos la huella "de cubierta" no aplica (toma un panel base) -> estándar.
    if (tipo === 'asiento' || !w || !d) { [w, d] = HUELLA[tipo] || HUELLA.mueble; }
    // Guarda/mampara alta: el despiece dio ancho × ALTURA, no ancho × fondo.
    if (tipo === 'guarda' || tipo === 'mampara') ({ w, d } = enderezarAlto(w, d, tipo));
    // Bench/sofá multi-posición: expandir al bloque real (ej. "6 puestos").
    [w, d] = huellaReal(pt.nombre, w, d, tipo);
    const n = Math.max(1, Math.min(pt.cantidad || 1, TOPE_PARTIDA));
    // ⚠️ EL RECORTE SEGUÍA SIENDO SILENCIOSO (auditoría 2026-08-19). Los topes
    // ya subieron una vez (30→300, 60→600) para no estorbar a un proyecto
    // real, pero si un proyecto GRANDE (cientos de puestos) los alcanza otra
    // vez, no había nota ni aviso — y el cartel de Acomodo.jsx usaba
    // `piezas.length` (YA RECORTADO) como si fuera el total real, diciendo
    // "ya acomodamos todos" cuando no era cierto. Se cuenta el total SIN
    // recortar aquí mismo, para que quien llame pueda comparar y avisar.
    real += Math.max(1, pt.cantidad || 1);
    for (let k = 0; k < n && out.length < tope; k++) {
      // ruta/productoId viajan para poder pintar el RENDER del catálogo en la
      // paleta: se arrastra el mueble con su foto, no un rectángulo de color.
      out.push({ id: `${pt.id}-${k + 1}`, nombre: pt.nombre, w, d, tipo, ruta: pt.ruta || null, productoId: pt.productoId || null });
    }
  }
  // Va colgado del arreglo (no cambia el contrato: sigue siendo un arreglo de
  // piezas para quien no le importe) para que Acomodo.jsx pueda avisar si el
  // total real es mayor al que de verdad se dibujó.
  if (real > out.length) out.truncado = { real, mostrado: out.length };
  return out;
}

export const mapaPiezas = (piezas) => Object.fromEntries(piezas.map((p) => [p.id, p]));
