// ============================================================================
//  Edge Function: analizar-mueble  (MEGA ANALIZADOR)
//  Auditoria Tecnica de Industrializacion (COO / DFM / Lean) de un mueble a
//  partir de su imagen. Devuelve:
//   - piezas: BOM estructurado con id de material -> lo cuesta el MOTOR.
//   - informe: auditoria completa en Markdown (7 secciones + Top 3) para Prod.
//   - descripcionCliente / materiales: lenguaje de cliente para el PDF.
//  La IA audita y propone; el MOTOR calcula el precio. Requiere ANTHROPIC_API_KEY.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    producto: { type: "string" },
    tipo: { type: "string", enum: ["escritorio", "estacion", "bench", "mesa", "mesita", "guarda", "mampara", "asiento", "otro"] },
    piezas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          nombre: { type: "string" },
          insumoId: { type: "string", description: "id EXACTO del catalogo; '' si ninguno encaja" },
          forma: { type: "string", enum: ["area", "lineal", "pieza"] },
          largoMM: { type: "number" },
          anchoMM: { type: "number" },
          cantidad: { type: "number" },
          hojas: { type: "number", description: "Para forma='area' (tableros/laminas/acrilicos): FRACCION DE HOJA estandar que consume el TOTAL de esta pieza x cantidad (1 = una hoja entera 1.22x2.44 de tablero, o 3x10 de lamina). Es lo que el motor usa para costear; estimala conservadora a partir de las cotas. 0 si no aplica (lineal/pieza)." },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          nota: { type: "string" },
          razonamiento: { type: "string", description: "COMO saliste de las COTAS a esta cantidad/hojas, en una linea: cota usada → tamano de pieza → cuantas caben por hoja → fraccion. Ej: 'copete 120x55 cm (cota frontal); 3 piezas por hoja 1.22x2.44 → 0.35 hoja x 2 = 0.7 hojas'. Si lo SUPUSISTE sin cota, dilo ('supuesto, sin cota')." },
          // --- SEMÁNTICA ESTRUCTURAL (para el modelo/grafo del mueble, NO para el precio) ---
          semantic_role: { type: "string", description: "ROL estructural de la pieza (lo que HACE en el mueble, no su material): cubierta, faldon, lateral, gaveta, pata, respaldo, asiento, entrepano, puerta, conector, espuma, tapiz, herraje, estructura, u 'otro'. Obligatorio." },
          parent: { type: "string", description: "nombre de la pieza/módulo que la CONTIENE o a la que pertenece ('' si es de primer nivel). Ej: una gaveta pertenece a un 'cuerpo'/'módulo'; un asiento a un 'módulo de plaza'." },
          relacion: { type: "string", enum: ["", "soporta", "contiene", "conecta", "se_repite_con"], description: "Relación física principal con 'relacion_con': una pata SOPORTA la cubierta; un cuerpo CONTIENE una gaveta; un conector CONECTA módulos; piezas que SE_REPITEN_CON un módulo. '' si no aplica." },
          relacion_con: { type: "string", description: "nombre de la otra pieza/módulo de la 'relacion' ('' si no aplica)." },
        },
        required: ["nombre", "insumoId", "forma", "largoMM", "anchoMM", "cantidad", "hojas", "confianza", "nota", "razonamiento", "semantic_role"],
      },
    },
    descripcionCliente: { type: "string", description: "Para el CLIENTE, sin jerga: que es, de que esta hecho, medidas aprox, para que sirve. 2-4 frases." },
    materiales: { type: "array", items: { type: "string" }, description: "Materiales visibles en palabras de cliente." },
    volumenAsumido: { type: "string", description: "Volumen que asumiste para el analisis (ej. 'prototipo/1 pieza' o 'corrida 50+'). Afecta flat-pack y herramentales." },
    confianzaGeneral: { type: "string", enum: ["alta", "media", "baja"], description: "Confianza global del analisis (baja si no hay escala)." },
    informe: { type: "string", description: "Auditoria tecnica COMPLETA en Markdown con EXACTAMENTE estas secciones y titulos, en este orden: '## 📐 Resumen Tecnico y Medidas Generales', '## 📋 Tabla BOM' (tabla markdown: Pieza | Material | Calibre/Espesor | Medida | Acabado), '## ✂️ Analisis de Merma y Nesting' (cuantifica: merma % actual vs optimizada, piezas por tablero 1.22x2.44), '## ⚙️ Ruta de Produccion y Estandarizacion' (Corte->CNC->Doblez->Soldadura->Pintura->Tapiceria->Ensamble; cuello de botella; piezas universales izq/der), '## 💡 Ingenieria de Valor' (2 acciones para bajar >=15%, en % no en pesos), '## 📦 Estrategia Logistica (Flat-Pack)' (knock-down y densidad en contenedor 53ft), '## 🛡️ Refuerzos Estructurales (Contract/BIFMA)', '## 🎯 Top 3 Acciones' (ordenadas por impacto/esfuerzo). Cuantifica siempre (%, piezas/tablero, kg, horas). NUNCA precios en pesos." },
    preguntas: {
      type: "array",
      description: "Confirmaciones ESENCIALES para cerrar el costo, como CONTROLES respondibles (no prosa). MÁX 8 críticas, TODAS JUNTAS en esta pasada, ordenadas por impacto. Si hay más de 8 detalles MENORES, NO los preguntes: documéntalos como supuestos/warnings en 'informe'. Cada una con su tipo de control y su supuesto actual.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question_key: { type: "string", description: "ID SEMÁNTICO ESTABLE en snake_case (NO depende del texto). Reusa el MISMO key para el mismo concepto siempre. Ej: equipo_refrigerador_responsable, frentes_inferiores_tipo, estructura_ptr_calibre, grafica_responsable, cantidad_islas, carga_repisa_kg, cantidad_cajones, cantidad_puertas." },
          pregunta: { type: "string", description: "La pregunta, corta y concreta." },
          tipo: { type: "string", enum: ["radio", "select", "number", "texto"], description: "radio/select cuando hay opciones acotadas; number para cantidades; texto para abierto." },
          opciones: { type: "array", items: { type: "string" }, description: "Opciones para radio/select (ej. ['Cliente','Von Haucke','Por definir']); [] si es number/texto." },
          impacto: { type: "string", enum: ["alto", "medio", "bajo"], description: "Cuánto mueve el costo/el producto." },
          afecta: { type: "string", enum: ["bom", "costo", "proceso", "render"], description: "Qué cambia la respuesta." },
          supuesto: { type: "string", description: "Lo que ASUMISTE por ahora (el valor actual del despiece)." },
        },
        required: ["question_key", "pregunta", "tipo", "opciones", "impacto", "afecta", "supuesto"],
      },
    },
    // --- INTENCIÓN DE DISEÑO: qué es el mueble como OBJETO, no sólo sus piezas.
    //     Es la base del modelo estructural (grafo) que reusa el cliente. ---
    design_intent: {
      type: "object",
      additionalProperties: false,
      description: "La INTENCIÓN de diseño entendida como OBJETO: tipo, módulos, dimensiones globales, supuestos y datos críticos faltantes.",
      properties: {
        product_type: { type: "string", description: "Tipo de mueble como objeto (ej. 'banca de aeropuerto 4 plazas', 'escritorio recto', 'credenza'). 'desconocido' SOLO si la info es genuinamente ambigua." },
        module_count: { type: "number", description: "Cuántos módulos/unidades repetidas lo componen (ej. 4 plazas → 4). 1 si no aplica." },
        overall_dimensions: { type: "string", description: "Dimensiones globales aprox (LxAnxAl en mm) si se deducen; '' si no." },
        assumptions: { type: "array", items: { type: "string" }, description: "Supuestos que tomaste para entenderlo (material, escala, uso)." },
        missing_critical_data: { type: "array", items: { type: "string" }, description: "Datos críticos que faltan para costear con confianza." },
      },
      required: ["product_type", "module_count", "overall_dimensions", "assumptions", "missing_critical_data"],
    },
  },
  required: ["producto", "tipo", "piezas", "descripcionCliente", "materiales", "volumenAsumido", "confianzaGeneral", "informe", "preguntas", "design_intent"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ ok: false, error: "Falta ANTHROPIC_API_KEY" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON invalido" }, 400); }
  const { image, imagenes, mediaType = "image/jpeg", catalogo, revisar, respuestas, descripcion, texto: textoDesc, description } = body || {};
  // DESCRIPCIÓN EN TEXTO (lo que el cliente escribe: "banca de aeropuerto de 4 plazas,
  // aluminio, asiento y respaldo tapizados, conector cada 2 asientos"). Habilita el
  // flujo describe→entiende sin imagen. Acotada para no reventar el prompt.
  const desc = String(descripcion || textoDesc || description || "").trim().slice(0, 4000);
  // respuestas = [{pregunta, respuesta}] que el usuario contestó a las preguntas de la IA.
  const resp = Array.isArray(respuestas)
    ? respuestas.filter((r: any) => r && r.respuesta && String(r.respuesta).trim())
    : [];
  // `revisar` = una propuesta previa (paso 1). Si viene, esta llamada es la SEGUNDA
  // pasada: la IA critica su propio despiece contra las cotas y lo corrige.
  const esRevision = !!(revisar && Array.isArray(revisar.piezas) && revisar.piezas.length);
  // `imagenes` = varias HOJAS del MISMO mueble (plano multipágina rasterizado).
  const imgs = Array.isArray(imagenes) ? imagenes.filter((x: any) => typeof x === "string" && x) : [];
  if (!image && !imgs.length && !desc) return json({ ok: false, error: "Falta la imagen (base64) o una descripción del mueble." }, 400);
  // MODO SÓLO-TEXTO: hay descripción y NO hay imagen/plano → se interpreta desde el texto.
  // Con imagen + texto: el texto es la INTENCIÓN del usuario; la imagen es evidencia geométrica.
  const soloTexto = !image && !imgs.length && !!desc;

  const cat = Array.isArray(catalogo)
    ? catalogo.map((c: any) => `${c.id} — ${c.nombre} [${c.seccion}, ${c.unidad}]`).join("\n")
    : "(sin catalogo)";

  const system =
    "Actua como el Director Operativo (COO), Jefe de Ingenieria de Producto y Experto en Costos de una fabrica de mobiliario de clase mundial (corporativo, hoteleria y retail; metalmecanica, CNC, pintura, tapiceria). Eres maestro en Lean Manufacturing, Design for Manufacturing (DFM) y optimizacion de recursos.\n\n" +
    (soloTexto
      ? "TAREA: te doy una DESCRIPCION EN TEXTO de un mueble que el cliente quiere fabricar (no hay imagen). Interpretalo como OBJETO —que es, que modulos/partes lo componen y como se relacionan fisicamente— y haz la 'Auditoria Tecnica, Explosion de Materiales (BOM) y Estrategia de Industrializacion'. Donde el texto NO de una medida, asume un estandar razonable, MARCALO como supuesto (confianza 'baja') y pidelo en 'preguntas'. NO inventes datos como si fueran ciertos. La IA audita y propone; el MOTOR calcula el precio: TU NUNCA das precios en pesos.\n\n"
      : "TAREA: te doy la imagen/render de un mueble. Haz una 'Auditoria Tecnica, Explosion de Materiales (BOM) y Estrategia de Industrializacion' exhaustiva para integrarla a nuestro sistema de costeo. La IA audita y propone; el MOTOR calcula el precio: TU NUNCA das precios en pesos.\n\n") +
    "ALCANCE DE VON HAUCKE (lo que SÍ fabricamos — úsalo para INTERPRETAR, mapear materiales y no quedarte corto; NO es sólo mueble de oficina):\n" +
    "· PROCESOS/MATERIALES: metalmecánica (PTR, lámina doblada cal.10–22, acero inoxidable, aluminio, soldadura, corte CNC/láser); carpintería (MDF, melamina, aglomerado, madera sólida, chapa, laminado/HPL); SUPERFICIE SÓLIDA (solid surface tipo Corian/Krion/Staron: mineral, termoformable, SIN juntas — NO es melamina ni piedra); TERMOFORMADO (acrílico/PVC/membrana); cristal (templado/satinado/serigrafía); PANEL ACÚSTICO PET (Sonara); acabados (pintura en polvo/electrostática, anodizado, barniz, granallado); tapicería (espuma, tela, piel, ecopiel); eléctrico (módulos Byrne, charolas, contactos/USB, kits LED).\n" +
    "· MERCADOS/FAMILIAS: oficina/corporativo (escritorios, benches, estaciones, guardas: archiveros/credenzas/lockers/cajoneras, mamparas/divisores acústicos); hotelería (recepción, lobby, lounge, cabeceras y bases de cama); retail/comercial (exhibidores, islas, kioscos, vitrinas, góndolas, portamonitores/portapantallas); aeropuertos/transporte (mostradores de documentación/CHECK-IN, counters, bancas de espera, barras altas comunales con energía, señalización); farmacias (mostradores, góndolas, anaqueles, cajas); militar/gobierno (ARMEROS/racks de armas, lockers de seguridad, mobiliario institucional); mobiliario urbano/señalética (bolardos, señales, bases).\n" +
    "REGLA DE MATERIAL: mapea la descripción al material y familia REALES. Si es superficie sólida, termoformado, PET, acero inoxidable, aluminio, cristal templado, etc., NÓMBRALO así y NO lo sustituyas por melamina. Si el material correcto no existe en el catálogo de abajo, déjalo con insumoId='' y descríbelo en 'nota' y en design_intent.missing_critical_data — NUNCA inventes un id de catálogo que no esté en la lista.\n\n" +
    "REGLAS CLAVE (mias, respetalas):\n" +
    "A) ANCLA A NUESTROS DATOS: en 'piezas' usa materiales de nuestro catalogo (id EXACTO en insumoId). Si ninguno encaja EXACTO, usa el MAS CERCANO por tipo y espesor y dilo en nota — deja insumoId='' SOLO si de verdad no hay nada parecido (una pieza sin material se costea en $0 y descuadra el total). Usa formatos comerciales reales MX/Norteamerica (tablero 1.22x2.44 m, tubo 6 m, lamina 4x8/4x10 ft, tela ancho 1.40 m).\n" +
    "B) CUANTIFICA, no solo describas: merma % actual vs optimizada, piezas por tablero, kg de acero, horas por proceso, ahorro en % (NO en pesos).\n" +
    "C) MEDIDAS — LO MAS IMPORTANTE PARA EL COSTO: si el plano trae COTAS escritas (numeros de medida, tabla de dimensiones, 'vista frontal/lateral/superior'), USALAS TAL CUAL en largoMM/anchoMM de cada pieza. NO estimes tamanos a ojo si estan escritos — un plano tecnico casi siempre trae las medidas, leelas. Se CONSERVADOR y CONSISTENTE: no infles areas ni cantidades; una pieza se cuenta UNA sola vez aunque aparezca en varias vistas. Solo si NO hay ninguna cota, asume estandares (altura 720-750 mm), marca confianza 'baja' y en 'preguntas' pide 1 medida de referencia.\n" +
    "D) VOLUMEN: declara 'volumenAsumido' (prototipo vs corrida) — flat-pack y herramentales solo valen a volumen.\n" +
    "E) ANTI-ALUCINACION: si dudas de un material, ofrece 2 opciones con su trade-off en el informe. Nunca inventes.\n" +
    "F) CLIENTE vs INTERNO: 'informe' es para Produccion/Diseno (tecnico). 'descripcionCliente' y 'materiales' son para el CLIENTE: sin jerga ni claves.\n" +
    "G) EXACTITUD DE CANTIDADES (lo que mas se te escapa):\n" +
    "   · BUNDLES/KITS = cantidad 1. Un 'kit de iluminacion LED' que alimenta varias charolas/zonas es UN kit (cantidad 1), NO uno por charola. Solo pon >1 si el plano lista kits FISICAMENTE separados. Lo mismo para arnes, fuente, chicote: cuenta el conjunto una vez.\n" +
    "   · NO DUPLIQUES la superficie: si un tablero es MELAMINA/LAMINADO de COLOR (ej. 'MDF melamina Walnut', 'MDF con laminado nogal'), usa el tablero YA laminado (mdf-...-walnut) — ese precio YA incluye las dos caras. NO sumes aparte una hoja de 'laminado' como pieza extra: eso cuenta la superficie dos veces. Solo factura laminado/chapa por separado si es un enchapado sobre un nucleo que ya costeaste crudo.\n" +
    "   · UNA PIEZA, UNA VEZ: el mismo panel que sale en vista frontal, lateral y superior es UNA pieza. Agrupa piezas identicas en un solo renglon con su 'cantidad'.\n" +
    "   · AUTO-VERIFICA antes de responder: relee tus 'piezas' y pregunta '¿esta cantidad sale de una cota o la supuse?'. Si la supusiste, baja la 'confianza' a 'media' o 'baja' para que el humano la revise. Mejor conservador y marcado que inflado.\n" +
    "H) MODELO ESTRUCTURAL (entiende el mueble como OBJETO, no como piezas sueltas):\n" +
    "   · Rellena SIEMPRE 'design_intent' (product_type como objeto, module_count, overall_dimensions si se deduce, assumptions, missing_critical_data). Si de verdad no se puede saber qué es, product_type='desconocido' y pon la ambigüedad en missing_critical_data y en una 'pregunta'.\n" +
    "   · En CADA pieza rellena 'semantic_role' (su función estructural) y, cuando aplique, 'parent' (a qué módulo/cuerpo pertenece) y 'relacion'/'relacion_con' (pata SOPORTA cubierta; cuerpo CONTIENE gaveta; conector CONECTA módulos; piezas que SE_REPITEN_CON un módulo). Esto es lo que permite dibujar y validar el mueble; es tan importante como el BOM.\n" +
    "   · COHERENCIA DE CONJUNTO: si describen asientos, DEBE haber estructura que los soporte; si hay gaveta, un cuerpo que la contenga; si mencionan conectores cada N módulos, modela esa relación. No dejes partes 'flotando' sin rol ni relación.\n" +
    (soloTexto || !desc ? "" :
      "I) TEXTO + IMAGEN: el TEXTO es la INTENCIÓN del usuario; la IMAGEN/plano es la evidencia geométrica. Si se CONTRADICEN (el texto dice una cosa y la imagen otra), NO elijas en silencio: refléjalo como una 'pregunta' crítica (afecta='bom') con las dos lecturas.\n") +
    "\n" +
    "El 'informe' (Markdown) DEBE traer las 8 secciones con los titulos EXACTOS del schema (las 7 de la auditoria + '## 🎯 Top 3 Acciones' al final), con la tabla BOM en markdown. SE CONCISO: viñetas cortas, no ensayos; maximo ~3-5 puntos por seccion; tabla BOM breve. Prioriza claridad y termina SIEMPRE el JSON.\n\n" +
    "PREGUNTAS (confirmaciones): devuelve MÁX 8 CRÍTICAS como CONTROLES, TODAS JUNTAS, ordenadas por impacto (más de 8 detalles menores NO se preguntan: van como supuestos/warnings). Cada una con: 'tipo' (radio/select/number/texto), 'opciones' (para radio/select, ej. refrigerador→['Cliente','Von Haucke','Por definir']; frentes→['Abatibles','Fijos','Cajones']; PTR→['cal.14','cal.12','Otro']; gráfica→['Nosotros','Cliente','Solo montaje']), 'impacto' (alto/medio/bajo), 'afecta' (bom/costo/proceso/render) y 'supuesto' (lo que asumiste ahora). Pregunta SOLO lo que de verdad mueve el costo o cambia el producto (equipo comprado, frentes fijos vs abatibles, calibre, gráfica propia vs cliente, nº de islas, carga por repisa). NO prosa; son controles para contestar rápido.\n" +
    "  · UNA PREGUNTA = UN SOLO DATO con su 'question_key' estable. NUNCA juntes dos cantidades: '¿cuántos cajones y cuántas puertas?' está MAL; son dos (cantidad_cajones, cantidad_puertas).\n" +
    "  · DETECTA TODAS las confirmaciones críticas EN ESTA PRIMERA PASADA y devuélvelas JUNTAS. No las vayas soltando de a poco en pasadas siguientes.\n" +
    "  · NO repitas una pregunta cuyo question_key ya venga en RESPUESTAS CONFIRMADAS.\n" +
    "DESPIECE 'piezas' (para el motor): tableros/cristal forma='area' con largoMM/anchoMM; metal/canto/tela forma='lineal' (metros); herrajes/comprados forma='pieza'.\n" +
    "FRACCION DE HOJA (clave para que el costo cuadre): en cada pieza forma='area' da ADEMAS 'hojas' = la fraccion de hoja estandar que consume el TOTAL (pieza x cantidad). El motor cuesta hojas x precio_de_hoja; si solo mandas area, el costo oscila. Piensa cuantas piezas caben en una hoja 1.22x2.44 (tablero) o 3x10 ft (lamina) y saca la fraccion. SE CONSERVADOR: no infles; ante la duda, menos hojas, no mas.\n" +
    "RETAIL / EXHIBIDORES: si es un exhibidor/mueble de tienda, mapea a los materiales retail del catalogo cuando existan (kit LED 5000K, MDF Walnut 16/25 mm, laminado Walnut, acrilico cristal/traslucido, perfil de canto ABS, logotipo acrilico, impresion en estireno). El KIT LED y los graficos/logos/impresiones son COMPRADOS ya hechos (seccion 'graficos'): van forma='pieza', NO llevan hojas.\n\n" +
    "CATALOGO DE MATERIALES (id — nombre [seccion, unidad]):\n" + cat +
    (esRevision
      ? "\n\n⚠️ MODO VERIFICACION (segunda pasada): abajo viene un despiece que TU generaste de este MISMO plano. Tu tarea ahora es AUDITARLO contra las COTAS escritas y CORREGIRLO, no rehacerlo desde cero:\n" +
        "  · Pieza por pieza: ¿la cantidad y las 'hojas' salen de una COTA escrita o se supusieron? Corrige las infladas, las bajas, las DUPLICADAS y las inventadas.\n" +
        "  · Verifica BUNDLES (kit LED = 1, no uno por charola), que NO se duplique superficie (tablero melamina ya laminado, no + hoja de laminado aparte) y que cada pieza se cuente UNA vez.\n" +
        "  · Llena 'razonamiento' en CADA pieza con la derivacion desde las cotas; baja 'confianza' en las que sigan siendo supuestas.\n" +
        "  · Devuelve el despiece COMPLETO corregido (TODAS las piezas), mismo schema."
      : "");

  // Bloques de imagen: varias HOJAS (plano multipágina) → varias imagenes; si no,
  // una sola (PDF crudo = documento; imagen/render = imagen). Mismo patron que leer-plano.
  const bloquesImagen = imgs.length
    ? imgs.map((b64: string) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } }))
    : image
      ? [mediaType === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: image } }
          : { type: "image", source: { type: "base64", media_type: mediaType, data: image } }]
      : []; // sólo-texto: sin bloques de imagen
  let textoTarea = soloTexto
    ? `DESCRIPCION DEL MUEBLE (en palabras del cliente):\n"${desc}"\n\nInterprétalo como OBJETO y realiza la Auditoria Tecnica, BOM y Estrategia completa. Rellena 'design_intent' y el 'semantic_role'/'relacion' de cada pieza. Marca como supuesto (confianza baja) y pregunta lo que el texto no especifique.`
    : imgs.length > 1
      ? `Te doy ${imgs.length} HOJAS del MISMO mueble (vista general + detalle por parte). Intégralas en UN SOLO despiece/BOM y una sola auditoria — NO las trates como muebles distintos. Usa las cotas y especificaciones de TODAS las hojas.`
      : "Realiza la Auditoria Tecnica, BOM y Estrategia de Industrializacion completa de este mueble.";
  // Texto + imagen: adjunta la intención del usuario como contexto (regla I del system).
  if (!soloTexto && desc) {
    textoTarea += `\n\nINTENCION DEL USUARIO (texto, prioriza como intención; la imagen es evidencia geométrica):\n"${desc}"`;
  }
  if (esRevision) {
    const previo = (revisar.piezas || []).map((p: any) =>
      `- ${p.cantidad}x ${p.nombre} [${p.insumoId || 'SIN MATERIAL'}] ${p.forma} ${p.largoMM || 0}x${p.anchoMM || 0} hojas=${p.hojas ?? 0} (${p.confianza})`
    ).join("\n");
    textoTarea = `VERIFICA Y CORRIGE este despiece que generaste de este MISMO plano, contra las COTAS escritas (lee de nuevo las hojas). Devuelve el despiece COMPLETO corregido con 'razonamiento' por pieza:\n\n${previo}\n\n` +
      "⛔ VERIFICACIÓN SILENCIOSA: 'preguntas' DEBE ser []. NO abras una ronda nueva de confirmaciones. Puedes corregir cantidades, detectar inconsistencias, bajar 'confianza' y dejar supuestos; si algo queda sin resolver, DÉJALO como supuesto (confianza baja) y NO preguntes. Solo excepción: un BLOQUEADOR DURO nuevo que impida calcular — máx 1, con question_key nuevo.";
  }
  // RESPUESTAS del usuario = VERDAD confirmada; sobrescriben supuestos de la IA. La KEY viaja SIEMPRE.
  if (resp.length) {
    const bloque = resp.map((r: any) => `- KEY: ${r.question_key || "(sin key)"}\n  P: ${r.pregunta}\n  R: ${r.respuesta}`).join("\n");
    const keys = resp.map((r: any) => r.question_key).filter(Boolean);
    textoTarea += `\n\n⭐ RESPUESTAS CONFIRMADAS POR EL USUARIO (son VERDAD; prioridad sobre cualquier supuesto tuyo). Ajusta el despiece y refleja el cambio en 'razonamiento'/'nota':\n${bloque}\n\n` +
      `QUESTION_KEYS YA RESUELTAS: [${keys.join(", ")}]\n` +
      "Está PROHIBIDO devolver cualquiera de esas keys en 'preguntas'. También está PROHIBIDO crear una key NUEVA para volver a preguntar el MISMO concepto (ej. no inventes 'refrigerador_quien_suministra' si ya existe 'equipo_refrigerador_responsable').\n\n" +
      "Aplica literalmente: si un EQUIPO lo suministra el cliente, quítalo del despiece o déjalo con insumoId='' y nota 'lo pone el cliente' (no lo costeamos); si unos frentes son FIJOS, elimina sus bisagras/jaladeras; si son ABATIBLES, inclúyelas; usa el CALIBRE/espesor que el usuario indique; si una gráfica/impresión la pone el cliente, no la costees; usa el NÚMERO DE PIEZAS/islas indicado para el volumen. NO inventes datos que el usuario no haya dado.\n" +
      "⛔ PREGUNTAS en esta pasada: 'preguntas' DEBE ser [] por defecto. SOLO puede aparecer UNA pregunta nueva si es un BLOQUEADOR DURO que (a) no podía conocerse razonablemente en la pasada inicial y (b) sin ese dato no se puede producir un costo responsable. Todo lo demás: supuesto / warning / confianza baja + costo preliminar. NO otra entrevista.";
  }

  const contenido = [...bloquesImagen, { type: "text", text: textoTarea }];
  const pedir = async (schema: any, sys: string, maxTok: number) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: maxTok,
        output_config: { effort: "medium", format: { type: "json_schema", schema } },
        system: sys,
        messages: [{ role: "user", content: contenido }],
      }),
    });
    return await r.json();
  };

  // Presupuesto de salida amplio: un plano rico (varias vistas + despiece + razonamiento) excede
  // 8000 tokens fácil. 16000 también para 1 imagen (1 imagen es rápida; el timeout de 150s aguanta).
  const MAX_TOK = 16000;
  let data: any;
  try { data = await pedir(SCHEMA, system, MAX_TOK); }
  catch (e) { return json({ ok: false, error: "No se pudo llamar a Claude: " + String(e) }, 502); }

  if (data?.type === "error") return json({ ok: false, error: data.error?.message || "Error de la API" }, 502);
  if (data?.stop_reason === "refusal") return json({ ok: false, error: "La IA no pudo analizar esta imagen." }, 200);

  // REINTENTO COMPACTO: si aún se cortó, re-pide SIN el 'informe' (lo más pesado) y con
  // razonamiento/nota breves, garantizando que el DESPIECE (lo que necesita el costeo y el
  // render) regrese completo. El informe es secundario y puede quedar vacío.
  if (data?.stop_reason === "max_tokens") {
    const schemaCompacto = { ...SCHEMA, required: (SCHEMA.required as string[]).filter((k) => k !== "informe") };
    const sysCompacto = system +
      "\n\nIMPORTANTE: la respuesta anterior se CORTÓ por larga. Esta vez OMITE 'informe' (déjalo '' o muy corto), " +
      "sé BREVE en 'razonamiento' y 'nota' (media línea cada uno) y ASEGÚRATE de CERRAR el JSON completo con TODO el despiece de piezas.";
    try { data = await pedir(schemaCompacto, sysCompacto, MAX_TOK); }
    catch (e) { return json({ ok: false, error: "No se pudo llamar a Claude: " + String(e) }, 502); }
    if (data?.stop_reason === "max_tokens")
      return json({ ok: false, error: "El plano es muy extenso y el despiece no cupo aun compactando. Sube menos hojas a la vez, o súbelo por partes." }, 200);
  }

  const texto = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let propuesta: any;
  try { propuesta = JSON.parse(texto); }
  catch { return json({ ok: false, error: "La IA no devolvio un analisis valido (JSON incompleto). Reintenta." }, 200); }

  return json({ ok: true, propuesta, uso: data?.usage || null });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
