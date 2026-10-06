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
import { createClient } from "jsr:@supabase/supabase-js@2";

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
          insumoId: { type: "string", description: "id EXACTO del catalogo cuando el material pedido ES de la MISMA familia que un insumo del catalogo. '' si el material pedido NO existe en el catalogo. NUNCA pongas el id de OTRA familia (p.ej. superficie solida -> NO uses un id de MDF/melamina/laminado): eso falsea el costo." },
          material_solicitado: { type: "string", description: "El MATERIAL que realmente pidio el usuario, en palabras (p.ej. 'superficie solida azul', 'acero inoxidable 304', 'MDF 19 mm'). SIEMPRE llenalo con lo que el texto/imagen indica, aunque el catalogo no lo tenga. Es lo que permite detectar sustituciones indebidas." },
          material_match: { type: "string", enum: ["EXACT", "NOT_AVAILABLE", "SUBSTITUTE_SUGGESTED"], description: "EXACT: el insumoId es de la MISMA familia que material_solicitado. NOT_AVAILABLE: el catalogo no tiene esa familia (insumoId=''). SUBSTITUTE_SUGGESTED: hay un material de otra familia que PODRIA servir pero NO lo aplicaste al id (insumoId='' y lo explicas en nota) — requiere confirmacion humana." },
          forma: { type: "string", enum: ["area", "lineal", "pieza"] },
          largoMM: { type: "number" },
          anchoMM: { type: "number" },
          cantidad: { type: "number" },
          hojas: { type: "number", description: "Para forma='area' (tableros/laminas/acrilicos): FRACCION DE HOJA estandar que consume el TOTAL de esta pieza x cantidad (1 = una hoja entera 1.22x2.44 de tablero, o 3x10 de lamina). Es lo que el motor usa para costear; estimala conservadora a partir de las cotas. 0 si no aplica (lineal/pieza)." },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          nota: { type: "string" },
          razonamiento: { type: "string", description: "COMO saliste de las COTAS a esta cantidad/hojas, en una linea: cota usada → tamano de pieza → cuantas caben por hoja → fraccion. Ej: 'copete 120x55 cm (cota frontal); 3 piezas por hoja 1.22x2.44 → 0.35 hoja x 2 = 0.7 hojas'. Si lo SUPUSISTE sin cota, dilo ('supuesto, sin cota')." },
          procedencia: { type: "string", enum: ["MEASURED", "DERIVED", "INFERRED", "ASSUMED"], description: "MEASURED=cota/texto explícito; DERIVED=cálculo directo desde evidencia visible; INFERRED=deducción estructural; ASSUMED=supuesto sin evidencia suficiente." },
          evidencia: { type: "string", description: "Referencia breve que sostiene la pieza/medida/material: cota, vista, nota o texto del usuario. Vacío si no existe evidencia." },
          pagina: { type: "integer", description: "Página/hoja 1..N de la evidencia principal; 0 si no aplica (texto sin archivo)." },
          // --- SEMÁNTICA ESTRUCTURAL (para el modelo/grafo del mueble, NO para el precio) ---
          semantic_role: { type: "string", description: "ROL estructural de la pieza (lo que HACE en el mueble, no su material): cubierta, faldon, lateral, gaveta, pata, respaldo, asiento, entrepano, puerta, conector, espuma, tapiz, herraje, estructura, u 'otro'. Obligatorio." },
          parent: { type: "string", description: "nombre de la pieza/módulo que la CONTIENE o a la que pertenece ('' si es de primer nivel). Ej: una gaveta pertenece a un 'cuerpo'/'módulo'; un asiento a un 'módulo de plaza'." },
          relacion: { type: "string", enum: ["", "soporta", "contiene", "conecta", "se_repite_con"], description: "Relación física principal con 'relacion_con': una pata SOPORTA la cubierta; un cuerpo CONTIENE una gaveta; un conector CONECTA módulos; piezas que SE_REPITEN_CON un módulo. '' si no aplica." },
          relacion_con: { type: "string", description: "nombre de la otra pieza/módulo de la 'relacion' ('' si no aplica)." },
        },
        required: ["nombre", "insumoId", "material_solicitado", "material_match", "forma", "largoMM", "anchoMM", "cantidad", "hojas", "confianza", "nota", "razonamiento", "semantic_role"],
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
        product_type: { type: "string", description: "Tipo de mueble como objeto (ej. 'banca de aeropuerto 4 plazas', 'counter de check-in', 'barra alta comunal', 'armero', 'escritorio recto'). 'desconocido' SOLO si la info es genuinamente ambigua." },
        module_count: { type: "number", description: "Cuántos MÓDULOS ESTRUCTURALES repetidos lo componen (cuerpos/unidades físicas que se fabrican y repiten). OJO: NO es la cantidad de personas. Una barra comunal MONOLÍTICA para 6 personas tiene module_count=1 (una sola estructura). Una banca modular de 4 plazas separadas puede tener module_count=4. Si no hay repetición modular clara, 1." },
        seat_count: { type: "number", description: "Número de ASIENTOS físicos (sillas/plazas con asiento). 0 si el mueble no tiene asientos (counter, mostrador, armero, exhibidor)." },
        user_capacity: { type: "number", description: "Cuántas PERSONAS puede usar/atender a la vez (p.ej. 'barra para 6 personas' → 6). Es capacidad de uso, NO módulos ni asientos. 0 si no aplica." },
        overall_dimensions: { type: "string", description: "Dimensiones globales aprox (LxAnxAl en mm) si se deducen; '' si no." },
        assumptions: { type: "array", items: { type: "string" }, description: "Supuestos que tomaste para entenderlo (material, escala, uso)." },
        missing_critical_data: { type: "array", items: { type: "string" }, description: "Datos críticos que faltan para costear con confianza." },
      },
      required: ["product_type", "module_count", "seat_count", "user_capacity", "overall_dimensions", "assumptions", "missing_critical_data"],
    },
  },
  required: ["producto", "tipo", "piezas", "descripcionCliente", "materiales", "volumenAsumido", "confianzaGeneral", "informe", "preguntas", "design_intent"],
};

const RESTRICCIONES_SCHEMA_NO_SOPORTADAS = new Set([
  "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minLength", "maxLength", "maxItems",
]);

// Anthropic Structured Outputs no acepta varias restricciones JSON Schema.
// La función usa fetch directo (sin SDK que las quite automáticamente), así que
// saneamos SIEMPRE el schema antes de enviarlo. Esto evita que una mejora de
// validación vuelva a tumbar Costear con un 400/502.
function sanearSchemaClaude(valor: any): any {
  if (Array.isArray(valor)) return valor.map(sanearSchemaClaude);
  if (!valor || typeof valor !== "object") return valor;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor)) {
    if (RESTRICCIONES_SCHEMA_NO_SOPORTADAS.has(k)) continue;
    // minItems sólo admite 0 o 1; para cualquier otro valor es más seguro
    // retirarlo y validar la cardinalidad en nuestra capa determinista.
    if (k === "minItems" && ![0, 1].includes(Number(v))) continue;
    out[k] = sanearSchemaClaude(v);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ ok: false, error: "Falta ANTHROPIC_API_KEY" }, 500);

  // --- AUTH + CAPABILITY (cierra el endpoint caro): Anthropic es de pago; sin esto
  //     cualquier sesión válida que conozca la URL podía quemarlo. verify_jwt=true en
  //     el gateway + esta verificación interna (defensa en capas). ---
  const URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!URL || !SERVICE) return json({ ok: false, error: "Falta configuración del servidor." }, 500);
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, code: "UNAUTHENTICATED", error: "No autenticado." }, 401);
  let email = "";
  try {
    const userClient = createClient(URL, ANON || SERVICE, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    email = u?.user?.email || "";
  } catch (_e) { email = ""; }
  if (!email) return json({ ok: false, code: "UNAUTHENTICATED", error: "Sesión inválida." }, 401);
  const svc = createClient(URL, SERVICE);
  const { data: permit } = await svc.from("permitidos").select("rol").eq("email", email).maybeSingle();
  if (!permit) return json({ ok: false, code: "FORBIDDEN", error: "Tu cuenta no está autorizada." }, 403);
  // CAPABILITY ai.analyze por rol (no basta con existir en permitidos).
  const rol = String(permit.rol || "").toLowerCase();
  const CAN_ANALYZE = new Set(["direccion", "diseno", "vendedor", "comercial", "ventas"]);
  if (!CAN_ANALYZE.has(rol)) return json({ ok: false, code: "FORBIDDEN_CAPABILITY", error: "Tu rol no puede usar el análisis con IA." }, 403);
  const requestId = crypto.randomUUID();
  const t0 = Date.now();
  // RATE LIMIT (barrera de COSTO, FAIL-CLOSED ante error persistente del limiter):
  // por usuario y global, por hora. Cuenta intentos reales (fila 'started' en ai_eventos).
  const LIMITE_USUARIO = 40, LIMITE_GLOBAL = 400;
  {
    const desde = new Date(Date.now() - 3_600_000).toISOString();
    const [u, g] = await Promise.all([
      svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", "analizar-mueble").eq("email", email).gte("created_at", desde),
      svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", "analizar-mueble").gte("created_at", desde),
    ]);
    // 5A: una barrera de costo NO puede ser best-effort. Si el limiter falla, NO
    // quemamos Anthropic ilimitadamente: 503 explícito (fail-closed).
    if (u.error || g.error) return json({ ok: false, code: "RATE_LIMITER_UNAVAILABLE", error: "No se pudo verificar el límite de uso. Reintenta en un momento." }, 503);
    if ((u.count ?? 0) >= LIMITE_USUARIO) return json({ ok: false, code: "RATE_LIMITED_USER", error: `Alcanzaste el límite de ${LIMITE_USUARIO} análisis por hora.` }, 429);
    if ((g.count ?? 0) >= LIMITE_GLOBAL) return json({ ok: false, code: "RATE_LIMITED_GLOBAL", error: "Demasiados análisis en curso ahora mismo. Intenta en un momento." }, 429);
  }

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

  // --- LÍMITES DE PAYLOAD + MIME (protección de costo e inputs manipulados) ---
  const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (image && !MIME_OK.has(String(mediaType))) return json({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE", error: "Formato no soportado (usa JPG, PNG, WEBP o PDF)." }, 415);
  const todasImgs = [image, ...imgs].filter((x: any) => typeof x === "string" && x);
  if (todasImgs.length > 8) return json({ ok: false, code: "TOO_MANY_IMAGES", error: "Máximo 8 imágenes/hojas por análisis." }, 413);
  // 5D: bytes REALES de base64 decodificado (no string.length).
  const b64bytes = (s: string) => { const n = (s || "").length; const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0; return Math.max(0, Math.floor(n * 3 / 4) - pad); };
  const payloadBytes = todasImgs.reduce((a: number, s: string) => a + b64bytes(s), 0);
  if (payloadBytes > 25_000_000) return json({ ok: false, code: "PAYLOAD_TOO_LARGE", error: "Las imágenes/hojas son demasiado grandes. Sube menos a la vez." }, 413);
  if (resp.length > 40) return json({ ok: false, code: "TOO_MANY_ANSWERS", error: "Demasiadas respuestas en una pasada." }, 413);

  // MODO SÓLO-TEXTO: hay descripción y NO hay imagen/plano → se interpreta desde el texto.
  // Con imagen + texto: el texto es la INTENCIÓN del usuario; la imagen es evidencia geométrica.
  const soloTexto = !image && !imgs.length && !!desc;

  // TELEMETRÍA (started): cuenta el intento para el rate limit y mide duración real.
  // Un intento que falle queda 'started' (cuenta como intento, que es lo correcto
  // para una barrera de costo). Se marca 'ok' sólo al cerrar bien.
  const modoTel = soloTexto ? "texto" : esRevision ? "revision" : "imagen";
  let evId: number | null = null;
  try {
    const { data: ev } = await svc.from("ai_eventos")
      .insert({ request_id: requestId, fn: "analizar-mueble", email, rol, modo: modoTel, images_count: todasImgs.length, payload_bytes: payloadBytes, status: "started" })
      .select("id").maybeSingle();
    evId = (ev as any)?.id ?? null;
  } catch (_e) { /* la telemetría no debe romper el análisis */ }
  const cerrarTel = async (status: string, http: number, extra: Record<string, unknown> = {}) => {
    if (evId == null) return;
    try { await svc.from("ai_eventos").update({ status, http_status: http, finished_at: new Date().toISOString(), duration_ms: Date.now() - t0, ...extra }).eq("id", evId); } catch (_e) { /* noop */ }
  };

  const fallarAnalisis = async (code: string, mensaje: string, http = 502, modelStatus = "error") => {
    await cerrarTel("error", http, { model_status: modelStatus, error_code: code });
    return json({ ok: false, code, error: mensaje, request_id: requestId }, http);
  };

  // CATÁLOGO CANÓNICO server-side = AUTORIDAD. El catálogo que manda el cliente ya
  // NO es autoridad: sólo se usa como PISTA para ids que el servidor aún no tenga.
  const { texto: cat, canonicoOk } = await construirCatalogo(catalogo);

  const system =
    "Actua como el Director Operativo (COO), Jefe de Ingenieria de Producto y Experto en Costos de una fabrica de mobiliario de clase mundial (corporativo, hoteleria y retail; metalmecanica, CNC, pintura, tapiceria). Eres maestro en Lean Manufacturing, Design for Manufacturing (DFM) y optimizacion de recursos.\n\n" +
    (soloTexto
      ? "TAREA: te doy una DESCRIPCION EN TEXTO de un mueble que el cliente quiere fabricar (no hay imagen). Interpretalo como OBJETO —que es, que modulos/partes lo componen y como se relacionan fisicamente— y haz la 'Auditoria Tecnica, Explosion de Materiales (BOM) y Estrategia de Industrializacion'. Donde el texto NO de una medida, asume un estandar razonable, MARCALO como supuesto (confianza 'baja') y pidelo en 'preguntas'. NO inventes datos como si fueran ciertos. La IA audita y propone; el MOTOR calcula el precio: TU NUNCA das precios en pesos.\n\n"
      : "TAREA: te doy la imagen/render de un mueble. Haz una 'Auditoria Tecnica, Explosion de Materiales (BOM) y Estrategia de Industrializacion' exhaustiva para integrarla a nuestro sistema de costeo. La IA audita y propone; el MOTOR calcula el precio: TU NUNCA das precios en pesos.\n\n") +
    "ALCANCE DE VON HAUCKE (lo que SÍ fabricamos — úsalo para INTERPRETAR, mapear materiales y no quedarte corto; NO es sólo mueble de oficina):\n" +
    "· PROCESOS/MATERIALES: metalmecánica (PTR, lámina doblada cal.10–22, acero inoxidable, aluminio, soldadura, corte CNC/láser); carpintería (MDF, melamina, aglomerado, madera sólida, chapa, laminado/HPL); SUPERFICIE SÓLIDA (solid surface tipo Corian/Krion/Staron: mineral, termoformable, SIN juntas — NO es melamina ni piedra); TERMOFORMADO (acrílico/PVC/membrana); cristal (templado/satinado/serigrafía); PANEL ACÚSTICO PET (Sonara); acabados (pintura en polvo/electrostática, anodizado, barniz, granallado); tapicería (espuma, tela, piel, ecopiel); eléctrico (módulos Byrne, charolas, contactos/USB, kits LED).\n" +
    "· MERCADOS/FAMILIAS: oficina/corporativo (escritorios, benches, estaciones, guardas: archiveros/credenzas/lockers/cajoneras, mamparas/divisores acústicos); hotelería (recepción, lobby, lounge, cabeceras y bases de cama); retail/comercial (exhibidores, islas, kioscos, vitrinas, góndolas, portamonitores/portapantallas); aeropuertos/transporte (mostradores de documentación/CHECK-IN, counters, bancas de espera, barras altas comunales con energía, señalización); farmacias (mostradores, góndolas, anaqueles, cajas); militar/gobierno (ARMEROS/racks de armas, lockers de seguridad, mobiliario institucional); mobiliario urbano/señalética (bolardos, señales, bases).\n" +
    "POLÍTICA DE MATERIAL (CRÍTICA — el error más caro): SIEMPRE llena 'material_solicitado' con lo que el usuario pidió (p.ej. 'superficie sólida azul'). Luego:\n" +
    "  · Si el catálogo tiene un insumo de la MISMA FAMILIA → ponlo en insumoId y material_match='EXACT'. ⚠️ 'MISMA FAMILIA' NO exige que el COLOR o el nombre coincidan al pie de la letra: un acabado de la misma familia y espesor es EXACT para costear (cuesta casi igual). Ejemplos que SÍ debes asignar: 'melamina nogal claro 19mm' → la melamina 19mm de color madera/nogal más cercana del catálogo (p.ej. melamina-19 nogal/walnut); 'laminado walnut' → el laminado walnut/madera; 'MDF 16' → mdf-16. Si el PLANO o el TEXTO YA NOMBRA el material/acabado/color/espesor, el material YA ESTÁ DECIDIDO: mapéalo al catálogo y NUNCA lo dejes con insumoId='' ni lo preguntes. Dejar vacío un material claramente nombrado es un ERROR (se costea en $0).\n" +
    "  · Si el catálogo NO tiene esa FAMILIA completa (p.ej. piden superficie sólida y no existe ninguna) → insumoId='' y material_match='NOT_AVAILABLE'. Descríbelo en 'nota' y en design_intent.missing_critical_data. NO lo costees con otra cosa. (Esto es SÓLO para familias ausentes, NO para un color distinto de una familia que sí existe.)\n" +
    "  · Si existe un material de OTRA familia que PODRÍA servir como sustituto → insumoId='' y material_match='SUBSTITUTE_SUGGESTED', y explica en 'nota' cuál sugieres y por qué (lo confirmará un humano).\n" +
    "  ⛔ PROHIBIDO sustituir una familia por otra en silencio. Ejemplo real que NO debe repetirse: piden SUPERFICIE SÓLIDA (solid surface/Corian/Krion) y la cuelan como MDF+laminado HPL porque 'se parecen' — eso FALSEA el costo. Superficie sólida ≠ MDF ≠ melamina ≠ laminado ≠ piedra. Acero inoxidable ≠ lámina común. PET acústico ≠ MDF.\n" +
    "  Un material NOT_AVAILABLE se queda SIN precio (pendiente de precio real); es MEJOR marcarlo pendiente que inventarlo con otra familia.\n\n" +
    "REGLAS CLAVE (mias, respetalas):\n" +
    "A) ANCLA A NUESTROS DATOS: dentro de la MISMA familia SIEMPRE escoge el id del catálogo más cercano (por color/espesor) y ASÍGNALO — eso es EXACT para costear. insumoId='' SÓLO cuando falta la FAMILIA completa, nunca por un color distinto. NUNCA uses el id 'más cercano' de OTRA familia (eso sí está prohibido). Que ninguna pieza con material nombrado quede sin id. Usa formatos comerciales reales MX/Norteamerica (tablero 1.22x2.44 m, tubo 6 m, lamina 4x8/4x10 ft, tela ancho 1.40 m).\n" +
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
    "   · En CADA pieza llena procedencia/evidencia/pagina cuando sea posible: MEASURED=cota/texto explícito; DERIVED=cálculo directo desde cotas visibles; INFERRED=deducción estructural; ASSUMED=supuesto. NO promociones ASSUMED/INFERRED a MEASURED. Si no hay archivo y sólo hay texto, pagina=0.\n" +
    "H) MODELO ESTRUCTURAL (entiende el mueble como OBJETO, no como piezas sueltas):\n" +
    "   · Rellena SIEMPRE 'design_intent' (product_type como objeto, module_count, seat_count, user_capacity, overall_dimensions si se deduce, assumptions, missing_critical_data). Si de verdad no se puede saber qué es, product_type='desconocido' y pon la ambigüedad en missing_critical_data y en una 'pregunta'.\n" +
    "   · CAPACIDAD ≠ MÓDULOS ≠ ASIENTOS (error frecuente): 'barra comunal para 6 personas' NO significa module_count=6. Si es una sola estructura monolítica, module_count=1 y user_capacity=6. Sólo pon module_count>1 si hay cuerpos/estructuras FÍSICAMENTE repetidos. seat_count es cuántos asientos físicos hay (0 si es counter/mostrador/armero/barra sin bancos). No conviertas 'lugares'/'personas' en módulos estructurales.\n" +
    "   · En CADA pieza rellena 'semantic_role' (su función estructural) y, cuando aplique, 'parent' (a qué módulo/cuerpo pertenece) y 'relacion'/'relacion_con' (pata SOPORTA cubierta; cuerpo CONTIENE gaveta; conector CONECTA módulos; piezas que SE_REPITEN_CON un módulo). Esto es lo que permite dibujar y validar el mueble; es tan importante como el BOM.\n" +
    "   · COHERENCIA DE CONJUNTO: si describen asientos, DEBE haber estructura que los soporte; si hay gaveta, un cuerpo que la contenga; si mencionan conectores cada N módulos, modela esa relación. No dejes partes 'flotando' sin rol ni relación.\n" +
    (soloTexto || !desc ? "" :
      "I) TEXTO + IMAGEN: el TEXTO es la INTENCIÓN del usuario; la IMAGEN/plano es la evidencia geométrica. Si se CONTRADICEN (el texto dice una cosa y la imagen otra), NO elijas en silencio: refléjalo como una 'pregunta' crítica (afecta='bom') con las dos lecturas.\n") +
    "\n" +
    "El 'informe' (Markdown) DEBE traer las 8 secciones con los titulos EXACTOS del schema (las 7 de la auditoria + '## 🎯 Top 3 Acciones' al final), con la tabla BOM en markdown. SE CONCISO: viñetas cortas, no ensayos; maximo ~3-5 puntos por seccion; tabla BOM breve. Prioriza claridad y termina SIEMPRE el JSON.\n\n" +
    "PREGUNTAS (confirmaciones): devuelve MÁX 8 CRÍTICAS como CONTROLES, TODAS JUNTAS, ordenadas por impacto (más de 8 detalles menores NO se preguntan: van como supuestos/warnings). Cada una con: 'tipo' (radio/select/number/texto), 'opciones' (para radio/select, ej. refrigerador→['Cliente','Von Haucke','Por definir']; frentes→['Abatibles','Fijos','Cajones']; PTR→['cal.14','cal.12','Otro']; gráfica→['Nosotros','Cliente','Solo montaje']), 'impacto' (alto/medio/bajo), 'afecta' (bom/costo/proceso/render) y 'supuesto' (lo que asumiste ahora). Pregunta SOLO lo que de verdad mueve el costo o cambia el producto (equipo comprado, frentes fijos vs abatibles, calibre, gráfica propia vs cliente, nº de islas, carga por repisa). ⛔ NUNCA preguntes por un material/acabado/color/espesor que YA venga escrito en el plano o en el texto: eso YA está decidido, mapéalo al catálogo (no es pregunta). NO prosa; son controles para contestar rápido.\n" +
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
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), esRevision ? 45_000 : 75_000);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-opus-5",
          max_tokens: maxTok,
          output_config: {
            effort: esRevision ? "low" : "medium",
            format: { type: "json_schema", schema: sanearSchemaClaude(schema) },
          },
          system: sys + (esRevision
            ? "\nREVISION COMPACTA: corrige BOM/cotas/material_match y sé mínimo en informe/notas; no reescribas una auditoría larga."
            : "\nPRIORIDAD DE SALIDA: BOM completo y correcto > informe. Informe máximo ~900 palabras; razonamiento por pieza en una sola línea."),
          messages: [{ role: "user", content: contenido }],
        }),
        signal: ac.signal,
      });
      const raw = await r.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; }
      catch {
        const err: any = new Error(`Respuesta no JSON del proveedor (HTTP ${r.status}).`);
        err.code = "PROVIDER_INVALID_JSON"; err.http = r.status || 502;
        throw err;
      }
      if (!r.ok) {
        const err: any = new Error(data?.error?.message || `Proveedor respondió HTTP ${r.status}.`);
        err.code = String(data?.error?.type || data?.error?.code || "PROVIDER_HTTP_ERROR");
        err.http = r.status;
        throw err;
      }
      return data;
    } finally { clearTimeout(timer); }
  };

  // El main necesita espacio para BOM, pero no 16k de prosa. La revisión es corta.
  const MAX_TOK = esRevision ? 6000 : 10000;
  let data: any;
  try { data = await pedir(SCHEMA, system, MAX_TOK); }
  catch (e: any) {
    const code = e?.name === "AbortError" ? "PROVIDER_TIMEOUT" : String(e?.code || "CLAUDE_API_ERROR");
    const mensaje = code === "PROVIDER_TIMEOUT"
      ? "El análisis tardó demasiado. Intenta de nuevo o analiza menos hojas."
      : "No se pudo analizar el archivo con IA. Reintenta; si persiste, sube una sola hoja.";
    return await fallarAnalisis(code, mensaje, 502, String(e?.code || e?.name || "provider_error"));
  }

  if (data?.type === "error") {
    return await fallarAnalisis("CLAUDE_API_ERROR", data.error?.message || "Error de la API", 502, String(data?.error?.type || "api_error"));
  }
  if (data?.stop_reason === "refusal") {
    await cerrarTel("refused", 200, { model_status: "refusal", error_code: "MODEL_REFUSAL" });
    return json({ ok: false, code: "MODEL_REFUSAL", error: "La IA no pudo analizar esta imagen.", request_id: requestId }, 200);
  }

  // REINTENTO COMPACTO: si aún se cortó, re-pide SIN el 'informe' (lo más pesado) y con
  // razonamiento/nota breves, garantizando que el DESPIECE (lo que necesita el costeo y el
  // render) regrese completo. El informe es secundario y puede quedar vacío.
  if (data?.stop_reason === "max_tokens") {
    const schemaCompacto = { ...SCHEMA, required: (SCHEMA.required as string[]).filter((k) => k !== "informe") };
    const sysCompacto = system +
      "\n\nIMPORTANTE: la respuesta anterior se CORTÓ por larga. Esta vez OMITE 'informe' (déjalo '' o muy corto), " +
      "sé BREVE en 'razonamiento' y 'nota' (media línea cada uno) y ASEGÚRATE de CERRAR el JSON completo con TODO el despiece de piezas.";
    try { data = await pedir(schemaCompacto, sysCompacto, MAX_TOK); }
    catch (e: any) {
      const code = e?.name === "AbortError" ? "PROVIDER_TIMEOUT" : String(e?.code || "CLAUDE_API_ERROR");
      return await fallarAnalisis(code, "No se pudo completar el reintento compacto. Analiza menos hojas.", 502, String(e?.code || e?.name || "provider_error"));
    }
    if (data?.stop_reason === "max_tokens") {
      await cerrarTel("partial", 200, { model_status: "max_tokens", error_code: "MODEL_TRUNCATED" });
      return json({ ok: false, code: "MODEL_TRUNCATED", error: "El plano es muy extenso y el despiece no cupo aun compactando. Sube menos hojas a la vez, o súbelo por partes.", request_id: requestId }, 200);
    }
  }

  const texto = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let propuesta: any;
  try { propuesta = JSON.parse(texto); }
  catch {
    await cerrarTel("error", 200, { model_status: String(data?.stop_reason || "invalid_json"), error_code: "INVALID_MODEL_JSON" });
    return json({ ok: false, code: "INVALID_MODEL_JSON", error: "La IA no devolvio un analisis valido (JSON incompleto). Reintenta.", request_id: requestId }, 200);
  }

  await cerrarTel("ok", 200, { model_status: String(data?.stop_reason || "ok") });
  // #8: la fuente del catálogo viaja al cliente. 'cliente-fallback' => el canónico no
  // estuvo disponible y se usaron pistas locales: la UI debe avisar (no cotizar en firme).
  return json({ ok: true, propuesta, catalogoFuente: canonicoOk ? "canonico" : "cliente-fallback", uso: data?.usage || null, request_id: requestId });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}

// Catálogo CANÓNICO desde la base (catalogo_vigente), con service role. Es la
// autoridad: lo que el cliente mande sólo entra como "hint" para ids que el
// servidor aún no tenga. Fail-open: si la BD no responde, usa las pistas del
// cliente para no romper el análisis. Marca los insumos SIN precio certificado
// (p.ej. superficie sólida recién dada de alta) para que la IA los trate como
// pendientes de precio, no como inexistentes.
async function construirCatalogo(clienteCat: any): Promise<{ texto: string; canonicoOk: boolean }> {
  const url = Deno.env.get("SUPABASE_URL");
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lineasServidor: string[] = [];
  const idsServidor = new Set<string>();
  // ⚠️ #8 (2026-10-04): el fallback al catálogo del cliente NO puede ser silencioso.
  // Se marca si el catálogo CANÓNICO se pudo leer; si no, el caller lo reporta
  // (`catalogoFuente`) para que la UI avise "no cotizar en firme con datos locales".
  let canonicoOk = false;
  if (url && srv) {
    const h = { apikey: srv, authorization: `Bearer ${srv}` };
    try {
      // 1) PRECIOS VIGENTES (lo que SÍ tiene precio certificado/propuesto).
      const precios = new Map<string, { precio: any; unidad: string }>();
      const rp = await fetch(
        `${url}/rest/v1/catalogo_vigente?select=insumo_id,unidad_compra,precio`,
        { headers: h },
      );
      if (rp.ok) {
        for (const c of (await rp.json()) || []) {
          if (c?.insumo_id) precios.set(c.insumo_id, { precio: c.precio, unidad: c.unidad_compra });
        }
      }
      // 2) TODAS LAS DEFINICIONES ACTIVAS = autoridad de "qué materiales EXISTEN".
      //    Una definición activa SIN precio vigente (p.ej. superficie sólida recién
      //    dada de alta) se lista como SIN PRECIO CERTIFICADO — existe, pero su
      //    precio está pendiente; NUNCA se costea en $0 ni se sustituye por otra.
      const rc = await fetch(
        `${url}/rest/v1/insumos_catalogo?select=id,nombre,seccion,unidad_costeo,activo&activo=eq.true&order=seccion`,
        { headers: h },
      );
      if (rc.ok) {
        canonicoOk = true;   // se leyó la autoridad de "qué materiales existen"
        for (const d of (await rc.json()) || []) {
          if (!d?.id) continue;
          idsServidor.add(d.id);
          const p = precios.get(d.id);
          const sinPrecio = !p || p.precio == null || Number(p.precio) <= 0;
          const unidad = (p && p.unidad) || d.unidad_costeo || "m2";
          lineasServidor.push(
            `${d.id} — ${d.nombre} [${d.seccion}, ${unidad}]` +
            (sinPrecio ? " (SIN PRECIO CERTIFICADO — pendiente de precio real)" : ""),
          );
        }
      }
    } catch (e) {
      // Fail-open a las pistas del cliente, pero NO en silencio: queda en logs y
      // el caller marca `catalogoFuente='cliente-fallback'`.
      console.error("[construirCatalogo] catálogo canónico no disponible, uso pistas del cliente:", e);
    }
  }
  const hints: string[] = [];
  if (Array.isArray(clienteCat)) {
    for (const c of clienteCat) {
      if (c?.id && !idsServidor.has(c.id)) {
        // Insumos que existen en el cliente (p.ej. colores/acabados) y SÍ se pueden
        // costear: se listan como usables (NO como "confirmar"), para que el modelo
        // los asigne y no deje piezas en $0.
        hints.push(`${c.id} — ${c.nombre} [${c.seccion || "?"}, ${c.unidad || "?"}]`);
      }
    }
  }
  const todo = [...lineasServidor, ...hints];
  return { texto: todo.length ? todo.join("\n") : "(sin catalogo)", canonicoOk };
}
