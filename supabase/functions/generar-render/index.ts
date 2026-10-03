// ============================================================================
//  Edge Function: generar-render
//  Genera un RENDER fotorrealista de un mueble a partir de la descripción del
//  usuario (lo que escribe/costea), con estilo Von Haucke. Usa Google Gemini
//  (modelo de imagen). Devuelve { ok, dataUrl }. Requiere GEMINI_API_KEY.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Modelo de imagen de Gemini (nano-banana). Cambiar aquí si se quiere otro.
const MODEL = "gemini-2.5-flash-image";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ ok: false, error: "Falta GEMINI_API_KEY en el proyecto (Supabase → Edge Functions → Secrets)." }, 500);

  // --- AUTH (cierra el endpoint caro): usuario válido + permitido. El render usa
  //     la llave Gemini (de pago); sin esto, cualquiera con la URL podía quemarla.
  //     verify_jwt=true en el gateway + esta verificación interna (defensa en capas).
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
  if (!permit) return json({ ok: false, code: "FORBIDDEN", error: "Tu cuenta no está autorizada para generar renders." }, 403);
  // CAPABILITY por rol (no basta con existir en permitidos): el render quema Gemini (de
  // pago). Sólo roles con la capacidad pueden gastarlo; un rol futuro restringido NO.
  const rol = String(permit.rol || "").toLowerCase();
  const CAN_RENDER = new Set(["direccion", "diseno", "vendedor", "comercial", "ventas"]);
  if (!CAN_RENDER.has(rol)) return json({ ok: false, code: "FORBIDDEN_CAPABILITY", error: "Tu rol no puede generar renders con IA." }, 403);
  const requestId = crypto.randomUUID();
  const t0 = Date.now();
  // RATE LIMIT (protección de costo): por usuario y global, por hora. Cuenta intentos
  // reales (render_eventos se inserta justo antes de llamar a Gemini). Degradación suave:
  // si la tabla no responde, no se bloquea el render.
  const LIMITE_USUARIO = 30, LIMITE_GLOBAL = 300;
  {
    const desde = new Date(Date.now() - 3_600_000).toISOString();
    const [u, g] = await Promise.all([
      svc.from("render_eventos").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", desde),
      svc.from("render_eventos").select("id", { count: "exact", head: true }).gte("created_at", desde),
    ]);
    // 5A: una barrera de COSTO no puede ser best-effort. Si el limiter falla, NO se
    // quema Gemini ilimitadamente: 503 explícito (fail-closed).
    if (u.error || g.error) return json({ ok: false, code: "RATE_LIMITER_UNAVAILABLE", error: "No se pudo verificar el límite de uso. Reintenta en un momento." }, 503);
    if ((u.count ?? 0) >= LIMITE_USUARIO) return json({ ok: false, code: "RATE_LIMITED_USER", error: `Alcanzaste el límite de ${LIMITE_USUARIO} renders por hora. Intenta más tarde.` }, 429);
    if ((g.count ?? 0) >= LIMITE_GLOBAL) return json({ ok: false, code: "RATE_LIMITED_GLOBAL", error: "Hay demasiados renders en curso ahora mismo. Intenta en un momento." }, 429);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON invalido" }, 400); }

  // --- Límites de payload (protección de costo): nº de imágenes y tamaño total. ---
  {
    const imgs = [body?.imagen, ...(Array.isArray(body?.imagenes) ? body.imagenes : [])].filter(Boolean);
    if (imgs.length > 7) return json({ ok: false, code: "TOO_MANY_IMAGES", error: "Máximo 7 imágenes de referencia." }, 413);
    // 5C: MIME del inline principal validado contra allowlist (la referencia se pasa a Gemini).
    const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (body?.imagen && !MIME_OK.has(String(body?.mediaType || "image/jpeg"))) {
      return json({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE", error: "Formato de imagen no soportado (usa JPG, PNG o WEBP)." }, 415);
    }
    // 5D: bytes REALES de base64 decodificado (no string.length).
    const b64bytes = (s: string) => { const n = (s || "").length; const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0; return Math.max(0, Math.floor(n * 3 / 4) - pad); };
    const bytes = imgs.reduce((s: number, i: any) => s + (typeof i === "string" ? b64bytes(i) : 0), 0);
    if (bytes > 21_000_000) return json({ ok: false, code: "PAYLOAD_TOO_LARGE", error: "Las imágenes de referencia son demasiado grandes." }, 413);
  }
  const { descripcion = "", materiales = [], medidas = "", tipo = "", spec = "", render_spec = null, imagen = "", imagenes = [], mediaType = "image/jpeg", modo = "render", aspecto = "", cuarto = "", lineas = [], conteoPiso = null, entorno = "", preservar = "" } = body || {};
  // MIME allowlist: sólo formatos de imagen/plano soportados (evita payloads raros).
  const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (imagen && mediaType && !MIME_OK.has(String(mediaType))) {
    return json({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE", error: "Formato no soportado (usa JPG, PNG, WEBP o PDF)." }, 415);
  }
  if (!descripcion.trim() && !imagen) return json({ ok: false, error: "Escribe una descripción del mueble para generar el render." }, 400);
  if (modo === "staging" && !imagen) return json({ ok: false, error: "Sube una foto del espacio para amueblarlo." }, 400);

  const mats = Array.isArray(materiales) && materiales.length ? materiales.join(", ") : "";
  // RENDER SPEC v1 (tipado): geometría BLOQUEADA (conteos que el modelo NO puede
  // cambiar) + perfil visual derivado del contexto (NO siempre "oak + charcoal").
  const rs = render_spec && typeof render_spec === "object" ? render_spec : null;
  const lockedBlock = buildLockedBlock(rs);
  const profileFinish = profileDefaultFinish(rs?.visual_profile);
  // RECETA FIJA DE CATÁLOGO: idéntica para los ~67 productos, para que la
  // colección se vea como UNA sola sesión de fotos y no 67 imágenes sueltas.
  // La escenografia (fondo, sombra, encuadre) NO la decide el modelo: se pide
  // fondo PLANO y el encuadre/sombra se arman despues, iguales para los 67.
  const RECETA_CATALOGO =
    "Background: seamless warm off-white studio sweep (#F4F1EC), smooth subtle falloff, no visible horizon line, " +
    "no wall/floor separation, no props, nothing else in frame. " +
    "LIGHTING: large softbox key from the front-upper-left, gentle fill from the right, and a discreet rim light that " +
    "separates the frame from the background. Rich but gentle contrast, deep blacks that stay open, neutral white balance. " +
    "GROUNDING: a soft, believable contact shadow directly under the piece, darkest at the feet and fading outward. " +
    "The furniture must SIT on the surface, never float. " +
    "CAMERA: same 3/4 viewpoint as the reference, 50mm lens at eye level slightly above the top, no wide-angle distortion. " +
    "Framing: the COMPLETE piece fully visible and centered with comfortable margins, nothing cropped, tack-sharp. " +
    "Editorial furniture photography of Herman Miller / Vitra catalogue quality. " +
    "No people, no text, no watermark, no logos, no dimension lines, no chairs or monitors unless part of the product.";

  const prompt = modo === "catalogo"
    ? // CATÁLOGO: la FOTO manda la forma; el texto sólo manda material y luz.
      // Probado 2026-08-16: si el texto describe la geometría ("patas tipo U"),
      // le GANA a la foto y Gemini cambia el mueble — salió un marco cerrado
      // donde la foto tenía poste cuadrado. Por eso la orden es explícita:
      // ante cualquier contradicción, manda la imagen.
      "Re-photograph the EXACT object in the reference image as a premium studio catalog shot. " +
      "THE REFERENCE IMAGE IS THE ONLY SOURCE OF TRUTH FOR SHAPE. " +
      "STEP 1 — before drawing anything, LOOK at the reference and identify the leg system: is each support a SINGLE " +
      "SQUARE POST going straight down to a floor leveller, or a CLOSED LOOP / O-frame, or an inverted U-frame, or a " +
      "T-base? Count how many supports there are and where they sit. " +
      "STEP 2 — reproduce THAT leg system exactly, with the same count and the same position. Never substitute a closed " +
      "loop frame for square posts, or the other way around: that is the single most common mistake and it makes the " +
      "render show a product we do not sell. " +
      "Copy the rest of the geometry part by part too: the same panels, the same overhangs, the same proportions and the " +
      "same configuration. If any words below seem to describe a different shape, IGNORE THE WORDS and follow the image. " +
      "Do not add, remove, restyle or re-engineer any part. Only the photography and the finish quality change. " +
      // Varias vistas/páginas del plano: úsalas TODAS para reconstruir la geometría 3D completa.
      ((Array.isArray(imagenes) && imagenes.length)
        ? "You are given MULTIPLE reference views/pages of the SAME product (front, side, sections, details). Use ALL of them " +
          "together to reconstruct one single coherent 3D object; they are the same piece from different angles, not different products. "
        : "") +
      // El plano/hoja técnica trae varias vistas + cotas + textos + recuadro: hay que leerlo como
      // ingeniería, NO copiarlo tal cual (si no, Gemini dibuja las líneas de cota o mezcla vistas).
      "IF THE REFERENCE IS A TECHNICAL DRAWING / PLANO (orthographic views like 'vista frontal/lateral/superior' plus an " +
      "isometric 3/4 view, with dimension lines, numbers, labels, a materials legend and a title block): read it as engineering. " +
      "Use the ISOMETRIC 3/4 view as the PRIMARY shape reference, and the front/side/top views to get exact proportions and the " +
      "configuration of every module, shelf, door, niche and light box. Then produce ONE realistic 3/4 studio PHOTO of the finished, " +
      "built product. DO NOT draw any dimension lines, arrows, numbers, measurement text, labels, section marks, the title block, " +
      "the material swatches or any 2D annotation — none of that appears on a real product. Reconstruct the REAL object, not the sheet. " +
      // Elementos que DEBEN conservarse si aparecen en el plano (no omitirlos al embellecer).
      (preservar ? `The product includes these elements that you MUST keep, in the same place and proportion as the reference: ${preservar}. Do not omit any of them. ` : "") +
      // Prioridad explícita: fidelidad geométrica sobre belleza.
      "PRIORITIZE GEOMETRIC ACCURACY OVER BEAUTIFICATION: an accurate but plain render is better than a pretty one that changes " +
      "the shape, the layout, the number of shelves/doors/niches or the proportions. Do not stylize away any structural element. " +
      `Product for context only (never for shape): ${descripcion} ` +
      (medidas ? `It should read at its true proportions: ${medidas}. ` : "") +
      // ACABADO: si el plano/IA especifica materiales y colores, úsalos EXACTOS. Si NO, no inventes
      // una madera/color: acabado neutro declarado, para que se note que el acabado está pendiente.
      (mats
        ? `FINISH — use EXACTLY the specified materials and colors: ${mats}. Render them physically-based and realistic ` +
          "(wood grain, matte powder-coated steel, glass where indicated), honoring any color shown in the reference image. " +
          "Do NOT substitute a different wood species, color or material. "
        : "FINISH NOT SPECIFIED in the plano: render in a NEUTRAL light-grey matte finish with a neutral dark-grey frame and clear " +
          "glass where the drawing shows it. DO NOT invent a specific wood species, brand color or decorative finish — keep it " +
          "deliberately neutral so it is obvious the final finish is still pending. ") +
      RECETA_CATALOGO
    : modo === "staging"
    ? // STAGING VIRTUAL: amueblar una foto real del espacio del cliente
      "You are given a photograph of a real, empty (or semi-empty) office space. " +
      "Furnish it realistically with the following Von Haucke office furniture, KEEPING the room's architecture, walls, windows, doors, floor, ceiling, perspective, camera angle and lighting EXACTLY as in the photo. Only ADD furniture; do not change the room. " +
      `Furniture to place: ${descripcion}. ` +
      "Place it sensibly with realistic circulation and spacing. Von Haucke aesthetic: warm oak melamine tops, charcoal powder-coated steel, acoustic felt privacy screens, ergonomic chairs, tasteful plants. " +
      "Photorealistic, natural integration, correct perspective and shadows consistent with the room's light. No text, no watermark, no logos, no people."
    : modo === "acomodo"
    ? // ACOMODO REAL → FOTO. La imagen de referencia es el isométrico que dibuja
      // la app con el acomodo EXACTO que calculó el motor: cuántos muebles, en
      // qué filas, en qué cuarto. Gemini no debe inventar una oficina bonita:
      // debe FOTOGRAFIAR ESA. Mismo principio que el catálogo — el dibujo manda
      // la geometría, el modelo manda el realismo.
      "The reference image is an isometric DIAGRAM of a real office layout that has already been engineered: " +
      "every desk, bench, storage unit and meeting table is exactly where it must be. " +
      "Turn this diagram into a PHOTOREALISTIC architectural interior render of that SAME office. " +
      "LAYOUT IS LOCKED: keep the identical room shape and proportions, the identical number of workstations and rows, " +
      "the identical position and orientation of every piece, and the identical circulation aisles. Do not add furniture, " +
      "do not remove furniture, do not rearrange anything, do not invent extra rooms. Count the rows and match them. " +
      `What is in the space: ${descripcion}. ` +
      (medidas ? `Space: ${medidas}. ` : "") +
      "Render it as a PREMIUM ARCHITECTURAL DOLLHOUSE VISUALIZATION — a cutaway 3/4 aerial view of the whole floor, the " +
      "kind an architecture studio presents to a client. This is deliberately a beautiful 3D visualization, not a photograph: " +
      "keep the clean cutaway walls and the full-floor overview, but raise the craft to studio quality. " +
      "The diagram is only the layout instruction: its flat colours, outlines, grid and ANY TEXT WRITTEN ON THE FLOOR must " +
      "NOT appear. Never draw text, labels or dimensions anywhere in the image. " +
      "MATERIALS, physically based: warm oak melamine desktops with visible grain; charcoal powder-coated steel frames with a " +
      "fine matte texture; acoustic felt privacy screens in muted grey-blue; light polished concrete or pale oak floor; clean " +
      "white walls with a subtle skirting. Draw glass partitions ONLY where the diagram actually shows one. " +
      // ⚠️ AQUÍ SE CONTRADECÍA SOLO (2026-08-17). Arriba decía "LAYOUT IS LOCKED,
      // do not add furniture" y aquí le PEDÍA plantas, macetas grandes,
      // luminarias lineales y mamparas de cristal. Rodrigo comparó su dibujo de
      // 3 muebles contra el render: "no se parece nada, agregó cosas, no sé de
      // dónde" — y venían de este renglón. Ahora sólo se permite lo que va
      // ENCIMA de un mueble que YA está en el dibujo; nada que ocupe piso.
      "ON TOP of the furniture that is already in the diagram you may add small desktop items: a task chair tucked at each " +
      "work position, a monitor at each desk, a keyboard, a mug or a notebook. NOTHING ELSE. " +
      "DO NOT ADD ANY OBJECT THAT STANDS ON THE FLOOR and is not in the diagram: no extra desks, no pedestals or drawer " +
      "units, no cabinets, no plants or planters, no poufs or armchairs, no rugs, no glass partitions, no pendant lamps, " +
      "no reception counters. If a room in the diagram is empty, RENDER IT EMPTY — an empty room is the correct answer, " +
      "not a mistake to fix. Count the pieces in the diagram and render exactly that many. " +
      "LIGHTING: soft global illumination with warm daylight raking in from one side, gentle ambient occlusion in every corner " +
      "and under every piece, soft contact shadows so nothing floats, subtle bounced colour from the wood. " +
      "CAMERA: elevated 3/4 aerial matching the diagram angle, slight natural perspective (not flat isometric), level horizon, " +
      "no barrel distortion, the ENTIRE floor plate visible and centred with comfortable margins. " +
      "Clean, bright, aspirational, restrained palette. Corona / V-Ray quality architectural visualization. " +
      "No text, no watermark, no logos, no dimension lines, no grid, no people."
    : modo === "escena"
    ? // UNA ESCENA POR CUARTO, A NIVEL DE OJO.
      // Nace de lo que Rodrigo vio en su telefono: el render salia SIEMPRE igual
      // y no ponia Eclipse ni nada del proyecto, porque al modelo solo se le
      // mandaba una lista de texto. Aqui recibe TRES cosas del proyecto real:
      //   1) el DIBUJO del acomodo de ESE cuarto (referencia de geometria)
      //   2) los RENDERS DE CATALOGO de los muebles que van ahi (fidelidad)
      //   3) la linea, el acabado y las medidas reales (el texto)
      // Y a nivel de OJO, no vista aerea: la vista cenital de todo el piso se
      // lee siempre como maqueta 3D. Una habitacion a la altura de la mirada es
      // lo unico que llega a parecer fotografia.
      "You are producing ONE photorealistic architectural interior photograph of a SINGLE room of a real office project. " +
      (cuarto ? `The room is a ${cuarto}. ` : "") +
      "The FIRST reference image is an isometric DIAGRAM of that exact room, already engineered: it tells you the room " +
      "proportions, how many pieces of furniture there are, where each one sits and how they are oriented. " +
      "LAYOUT IS LOCKED: same room shape, same number of workstations and units, same positions, same orientations, same " +
      "aisles. Do not add furniture, do not remove furniture, do not rearrange, do not invent extra rooms or doors. " +
      "The diagram's flat colours, outlines, grid and ANY TEXT must NOT appear in your image. " +
      (Array.isArray(imagenes) && imagenes.length
        ? "The REMAINING reference images are the ACTUAL Von Haucke products specified for this room. Reproduce THOSE pieces: " +
          "their exact silhouette, leg system, frame, edge profile, wood tone and proportions. Do not substitute a generic " +
          "desk or a different design — a client will compare this image against the product sheet. "
        : "") +
      `What is in this room: ${descripcion}. ` +
      (Array.isArray(lineas) && lineas.length ? `Von Haucke product line(s): ${lineas.join(", ")}. ` : "") +
      (medidas ? `Room size: ${medidas}. ` : "") +
      "MATERIALS, physically based: warm oak melamine tops with visible grain, charcoal powder-coated steel with a fine matte " +
      "texture, acoustic felt screens in muted tones, real glass with slim mullions, pale oak or polished concrete floor, " +
      "clean white walls with a subtle skirting. " +
      // Mismo arreglo que en `acomodo`: se permite lo que va ENCIMA del mueble,
      // nunca un mueble nuevo. Un cuarto vacío se dibuja VACÍO.
      "ON TOP of the furniture already in the diagram you may add: a task chair at each work position, a monitor at each " +
      "desk, a mug or a notebook. DO NOT ADD anything that stands on the floor and is not in the diagram: no extra desks, " +
      "no pedestals, no cabinets, no plants or planters, no poufs, no rugs, no partitions that the diagram does not show. " +
      "If the room is empty in the diagram, render it EMPTY. " +
      "LIGHTING: soft global illumination, warm daylight raking from a window wall on one side, gentle ambient occlusion in " +
      "every corner and under every piece, soft contact shadows so nothing floats. " +
      "CAMERA: EYE LEVEL, about 1.6 m from the floor, wide angle around 24 mm, standing just inside the room looking across " +
      "it so the whole arrangement reads in one frame. Vertical lines perfectly vertical, level horizon, no barrel " +
      "distortion, no tilt. This must look like a photograph taken by an architectural photographer, NOT like a 3D " +
      "visualization and NOT like an aerial dollhouse view. " +
      "Editorial, bright, restrained, aspirational. No text, no watermark, no logos, no dimension lines, no people."
    : modo === "ambiente"
    ? // AMBIENTE DEL PRODUCTO: coloca el MISMO producto (imagen de referencia) en su entorno
      // real. El entorno lo manda el cliente (supermercado/tienda para exhibidores, oficina
      // para mobiliario, etc.) para que NO salga siempre una oficina.
      "Place the EXACT product shown in the reference image into a realistic " + (entorno || "modern commercial") + " environment. " +
      "The product is the hero of the scene and must keep its EXACT design, proportions, configuration, materials, finish and every element (shelves, doors, niches, light box, trays) as in the reference image. " +
      "Do not redesign it, do not add or remove parts, do not change how many shelves/doors/niches it has. " +
      `Product: ${descripcion}. ` +
      (medidas ? `True proportions: ${medidas}. ` : "") +
      "Photorealistic, correct perspective, natural lighting and contact shadows consistent with the environment, the product clearly visible and in context. " +
      "No text, no watermark, no logos, no people standing in front of the product."
    : modo === "oficina"
    ? // OFICINA COMPLETA: generar la escena interior amueblada con lo cotizado
      "Photorealistic wide-angle interior architectural render of a modern corporate office, professionally furnished with the following Von Haucke office furniture, laid out with realistic circulation, aisles and zoning: " +
      `${descripcion}. ` +
      (medidas ? `Space context: ${medidas}. ` : "") +
      "Von Haucke Mexican modern aesthetic: warm oak melamine desktops, charcoal powder-coated steel frames, acoustic felt privacy screens, black ergonomic mesh chairs, glass-walled meeting room, polished concrete or light wood floor, floor-to-ceiling windows with soft natural daylight, tasteful plants. " +
      (Array.isArray(imagenes) && imagenes.length ? "IMPORTANT: use the EXACT furniture pieces shown in the reference images — these are the real Von Haucke products; match their design, wood tone, frames and proportions. " : "") +
      "Editorial architectural photography, eye-level 3/4 wide angle, elegant, bright, aspirational, high-end. No text, no watermark, no logos, no visible people."
    : imagen
    ? // RENDER a partir de una FOTO de referencia (fidelidad al producto real)
      "Using the reference image as the exact model, produce a clean, professional PHOTOREALISTIC studio product render of the SAME piece of office furniture. " +
      "Keep its exact design, proportions, configuration and materials as in the reference; do not invent a different product. " +
      `Context: ${descripcion}. ` +
      "Present it as a high-end catalog shot: 3/4 angle, soft seamless warm-neutral studio background, gentle soft floor shadow, realistic materials, sharp focus, bright even lighting. " +
      "No people, no text, no watermark, no logos, no measurement overlays. Single hero object, centered."
    : // RENDER de producto standalone (solo texto). Fidelidad: los MATERIALES y la
      // ESTRUCTURA descritos MANDAN; la estética de la casa es sólo el default cuando
      // no se especifica nada (antes forzaba "roble/melamina" y pintaba roble aunque
      // pidieras "cubierta azul / superficie sólida").
      "Professional, photorealistic STUDIO product render of a SINGLE piece of premium contract furniture, high-end catalog quality. " +
      `The product: ${descripcion}. ` +
      (tipo ? `Furniture category (for context, not a literal shape): ${tipo}. ` : "") +
      // GEOMETRÍA TIPADA Y BLOQUEADA (RenderSpecV1): si viene, MANDA sobre `spec`.
      (lockedBlock || (spec
        ? `BUILD IT AS THIS EXACT OBJECT — ${spec} Honor this structure literally: the number of modules/seats, which parts support which, and how modules connect. Do NOT turn it into a plain desk. `
        : "")) +
      (mats
        ? `MATERIALS & FINISH — use EXACTLY these, physically-based and realistic; DO NOT substitute a different material, wood species or color: ${mats}. ` +
          "If the description gives a COLOR (e.g. 'azul'/blue), the surface MUST be that color. " +
          "If it says 'superficie sólida' / solid surface (Corian-like), render a seamless matte mineral-composite top, NOT wood melamine. " +
          "If it says 'lámina'/steel for the base, render folded powder-coated sheet-steel panels. Show the brand's red ABS edge ONLY if a red edge is mentioned. "
        // Default SÓLO si no hay materiales: usa el perfil visual del contexto, NO
        // siempre "oak + charcoal" (eso contaminaba farmacia/militar/retail/aeropuerto).
        : `Finish (default only, nothing specified): ${profileFinish}. `) +
      (medidas ? `True proportions: ${medidas}. ` : "") +
      RECETA_CATALOGO;

  const parts: any[] = [{ text: prompt }];
  if (imagen) parts.push({ inlineData: { mimeType: mediaType, data: imagen } });
  if (Array.isArray(imagenes)) for (const im of imagenes.slice(0, 6)) if (im) parts.push({ inlineData: { mimeType: "image/jpeg", data: im } });

  // Proporción fija: sin esto Gemini copia el formato de la foto de referencia y
  // el catálogo sale con 67 formatos distintos.
  const ar = aspecto || (modo === "catalogo" ? "4:3" : modo === "oficina" ? "16:9" : modo === "escena" ? "3:2" : "");
  const imageGenConfig: any = { responseModalities: ["IMAGE"] };
  if (ar) imageGenConfig.imageConfig = { aspectRatio: ar };

  // Una sola llamada a Gemini, con el manejo de error (cuota, API key, bloqueo
  // de seguridad) centralizado: antes vivía una sola vez porque sólo había una
  // llamada; ahora la verificación de conteo (abajo) necesita llamar varias
  // veces con la MISMA lógica de error.
  // Forma de retorno FIJA (nunca una unión de shapes distintos): así `r.error`
  // y `r.data` se pueden leer siempre, sin que TypeScript se queje de que uno
  // de los dos "no existe" en la otra rama.
  async function llamarGemini(contents: any[], generationConfig: any): Promise<{ error: string | null; data: any }> {
    let data: any;
    try {
      // TIMEOUT explícito (90 s): un render colgado no debe amarrar la función ni al usuario.
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 90_000);
      let r;
      try {
        r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
          { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents, generationConfig }), signal: ac.signal },
        );
      } finally { clearTimeout(timer); }
      data = await r.json();
    } catch (e) {
      const abortado = e instanceof Error && e.name === "AbortError";
      return { error: abortado ? "El render tardó demasiado (timeout). Intenta de nuevo." : "No se pudo llamar a Gemini: " + String(e), data: null };
    }
    if (data?.error) {
      const m = data.error?.message || "";
      if (/quota|billing|free_tier|limit: 0/i.test(m)) {
        return { error: "El render con IA (modelo de imágenes de Gemini) requiere activar facturación en Google — es de pago (~US$0.04 por render). Actívala en Google AI Studio / Google Cloud (Billing) y vuelve a intentar.", data: null };
      }
      if (/API key|API_KEY|invalid|permission|PERMISSION/i.test(m)) {
        return { error: "La API key de Gemini no es válida o no tiene permiso para imágenes. Revisa GEMINI_API_KEY en Supabase → Edge Functions → Secrets.", data: null };
      }
      return { error: m || "Error de la API de Gemini", data: null };
    }
    return { error: null, data };
  }

  // TELEMETRÍA (auditoría + base del rate-limit): un renglón por intento REAL de render.
  const imgsN = [imagen, ...(Array.isArray(imagenes) ? imagenes : [])].filter(Boolean).length;
  const bytesN = [imagen, ...(Array.isArray(imagenes) ? imagenes : [])].filter(Boolean).reduce((s: number, i: any) => s + (typeof i === "string" ? i.length : 0), 0);
  try { await svc.from("render_eventos").insert({ request_id: requestId, email, rol, modo, imagenes: imgsN, bytes: bytesN, ms: Date.now() - t0 }); } catch (_e) { /* best-effort */ }

  const r1 = await llamarGemini([{ role: "user", parts }], imageGenConfig);
  if (r1.error) return json({ ok: false, code: "GEMINI_ERROR", error: r1.error, request_id: requestId }, 502);
  let outParts = r1.data?.candidates?.[0]?.content?.parts || [];
  let img = outParts.find((p: any) => p.inlineData?.data || p.inline_data?.data);
  let inline = img?.inlineData || img?.inline_data;
  if (!inline?.data) {
    const bloqueo = r1.data?.promptFeedback?.blockReason;
    return json({ ok: false, error: bloqueo ? `La imagen fue bloqueada (${bloqueo}). Ajusta la descripción.` : "Gemini no devolvió una imagen. Reintenta o cambia la descripción." }, 200);
  }
  let mime = inline.mimeType || inline.mime_type || "image/png";

  // ⚠️ VERIFICACIÓN DEL CONTEO (2026-08-19), sólo en `acomodo`/`escena` con
  // `conteoPiso` (cuántas piezas DE PISO —sin sillas— debe tener la imagen).
  // Rodrigo comparó su plano, contado a mano, contra la foto: "sigue
  // inventando escritorios". El texto del prompt ya pedía "LAYOUT IS LOCKED,
  // no inventes muebles" y no bastaba: Gemini no respeta de forma confiable un
  // conteo exacto de objetos repetidos por más fuerte que se lo pidas EN
  // PALABRAS. La única manera honesta de no mentirle al cliente es no confiar
  // en la primera pasada: se le pide al MISMO modelo que CUENTE lo que acaba
  // de dibujar, y si no da el número exacto, se le manda a REHACER la imagen
  // completa señalándole el error. Si tras los reintentos sigue sin dar, se
  // devuelve un ERROR en vez de una foto que ya sabemos que está mal —enseñarle
  // al cliente un render con escritorios de más es peor que no tener foto—.
  const conteoEsperado = Number(conteoPiso);
  const verificable = (modo === "acomodo" || modo === "escena") && Number.isFinite(conteoEsperado) && conteoEsperado > 0;
  if (verificable) {
    const textConfig = { responseModalities: ["TEXT"] };
    const MAX_INTENTOS = 2;   // 1 imagen inicial + 1 rehecha; más que eso es mucho tiempo y costo por render
    let contents: any[] = [{ role: "user", parts }, { role: "model", parts: [{ inlineData: { mimeType: mime, data: inline.data } }] }];
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      const preguntaConteo =
        "Count ONLY the floor-standing furniture pieces visible in the image you just produced: desks, benches, " +
        "storage units, meeting tables, privacy screens — anything that stands directly on the floor. Do NOT count " +
        "chairs, monitors, mugs, notebooks or anything sitting on top of another piece. " +
        "Answer with ONLY the total number, digits only, no words, no punctuation.";
      contents = [...contents, { role: "user", parts: [{ text: preguntaConteo }] }];
      const rc = await llamarGemini(contents, textConfig);
      // Si el contador falla (cuota, red), se entrega la imagen que ya hay: un
      // error del CONTADOR no tiene por qué tumbar un render que sí se generó.
      if (rc.error) break;
      const textoConteo = (rc.data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
      const numConteo = parseInt((textoConteo.match(/\d+/) || [])[0] || "", 10);
      contents = [...contents, { role: "model", parts: [{ text: textoConteo || "?" }] }];
      if (Number.isFinite(numConteo) && numConteo === conteoEsperado) break;   // cuadra: esta imagen se queda
      if (intento === MAX_INTENTOS) {
        return json({
          ok: false,
          error: `No se pudo generar una foto con el conteo exacto de muebles (salieron ${Number.isFinite(numConteo) ? numConteo : "?"} de ${conteoEsperado} esperados). Usa el plano, que sí es exacto, o vuelve a intentar.`,
        }, 200);
      }
      const correccion =
        `You just counted ${Number.isFinite(numConteo) ? numConteo : "an incorrect number of"} floor-standing pieces, but EXACTLY ${conteoEsperado} are required — not one more, not one less. ` +
        "Regenerate the ENTIRE image from scratch: same room, same camera angle, same materials and lighting, but fix the count of floor-standing furniture so it is exactly correct. " +
        "If there were too many, remove the extras completely — do not just shrink or hide them. If there were too few, add the missing ones in the empty floor space, matching the style of the rest.";
      contents = [...contents, { role: "user", parts: [{ text: correccion }] }];
      const ri = await llamarGemini(contents, imageGenConfig);
      if (ri.error) return json({ ok: false, error: ri.error }, 502);
      outParts = ri.data?.candidates?.[0]?.content?.parts || [];
      img = outParts.find((p: any) => p.inlineData?.data || p.inline_data?.data);
      inline = img?.inlineData || img?.inline_data;
      if (!inline?.data) {
        const bloqueo = ri.data?.promptFeedback?.blockReason;
        return json({ ok: false, error: bloqueo ? `La imagen fue bloqueada (${bloqueo}). Ajusta la descripción.` : "Gemini no devolvió una imagen al corregir el conteo." }, 200);
      }
      mime = inline.mimeType || inline.mime_type || "image/png";
      contents = [...contents, { role: "model", parts: [{ inlineData: { mimeType: mime, data: inline.data } }] }];
    }
  }

  return json({ ok: true, dataUrl: `data:${mime};base64,${inline.data}` });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}

// LOCKED GEOMETRY: a partir del RenderSpecV1, un bloque que FIJA los conteos que
// el modelo NO puede cambiar (módulos, asientos, cajones, puertas, patas,
// pantallas, módulos eléctricos). El modelo decide luz/textura/fotografía; la
// geometría viene del grafo confirmado.
function buildLockedBlock(rs: any): string {
  if (!rs || typeof rs !== "object") return "";
  const c = rs.counts || {};
  const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const partes: string[] = [];
  if (rs.product_type && rs.product_type !== "unknown") partes.push(`product type = ${rs.product_type}`);
  partes.push(`structural modules = ${Math.max(1, n(c.module_count))}`);
  if (n(c.seat_count)) partes.push(`seats = ${n(c.seat_count)}`);
  if (n(c.user_capacity)) partes.push(`user capacity (people) = ${n(c.user_capacity)} (this is NOT the number of modules)`);
  if (n(c.drawer_count)) partes.push(`drawers = ${n(c.drawer_count)}`);
  if (n(c.door_count)) partes.push(`doors = ${n(c.door_count)}`);
  if (n(c.support_count)) partes.push(`supports/legs = ${n(c.support_count)}`);
  if (n(c.screen_count)) partes.push(`monitor arms/screens = ${n(c.screen_count)}`);
  if (n(c.electrical_module_count)) partes.push(`electrical/USB modules = ${n(c.electrical_module_count)}`);
  const fin = Array.isArray(rs.finishes) && rs.finishes.length ? ` Finishes: ${rs.finishes.join("; ")}.` : "";
  const locked = rs.locked_geometry === false ? "" :
    " These counts are LOCKED: do NOT add or remove modules, seats, drawers, doors, legs or screens — only choose lighting, texture, depth and photography.";
  return `BUILD IT AS THIS EXACT OBJECT (typed geometry) — ${partes.join("; ")}.${fin}${locked} Do NOT turn it into a plain desk. `;
}

// Acabado por defecto según el PERFIL VISUAL del contexto. Sólo se usa cuando NO
// se especifican materiales. Evita pintar todo de "roble + acero carbón oficina".
function profileDefaultFinish(profile?: string): string {
  switch (profile) {
    case "airport_checkin": return "clean white solid-surface top with brushed stainless steel base, bright neutral airport aesthetic";
    case "pharmacy": return "white laminate surfaces with stainless-steel accents, clean clinical retail aesthetic";
    case "military": return "matte dark powder-coated steel, utilitarian institutional aesthetic";
    case "retail": return "warm wood veneer with matte black steel, premium retail display aesthetic";
    case "hotel": return "warm wood veneer with soft brass accents, refined hospitality aesthetic";
    case "kiosk": return "white composite with anodized aluminum, modern self-service aesthetic";
    case "corporate": return "warm oak melamine surfaces with charcoal powder-coated steel, elegant and minimal";
    default: return "neutral premium contract finish, elegant and minimal, true to the described materials";
  }
}
