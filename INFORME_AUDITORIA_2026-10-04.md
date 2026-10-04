# Auditoría Von Haucke — Informe (4 oct 2026)

**Veredicto: NO-GO para el CEO todavía.** No porque esté mal hecha, sino porque la
cadena *lectura → muebles → cantidades → acomodo → render → presupuesto* todavía
puede producir una respuesta **convincente pero incorrecta**. Se cerró una parte
real; faltan P0 de integridad y del pipeline.

- **RC (revisar aquí):** https://vonhaucke-rc.vercel.app · **SHA** `8ac11c2`
- **Tests:** 811 verdes · **Build producción:** OK · **Commits de esta pasada:** 8
- Login + lectura de planos (edge v8) ya viven en PRODUCCIÓN (DB/edge). El resto de
  arreglos de cliente viven en RC; promover a prod cuando revises.

---

## CERRADO Y VERIFICADO (antes → después, con evidencia)

| # | Problema (antes) | Después | Evidencia |
|---|---|---|---|
| Login | Tu cuenta no entraba | Entra (pass nueva en chat); cuenta sana | last_sign_in DB; E2E |
| Planos | 178 m² / 18–17 puestos / 17 archiveros inflados | **132 m² y 8 puestos "contados del plano"** | leer-plano v8 + chain E2E con el PDF golden; screenshot Muebles |
| Archiveros=9 | Gavetas+archiveros sumados y llamados "archiveros" | **Gavetas 8 · Archiveros 1** separados | E2E Muebles; test programa.test.js |
| Precio doble | Hoja $1,433 (40%) vs precio $1,229 (30%) misma pieza | **Un solo precio** (hoja usa el margen efectivo) | E2E Costear a mano |
| Value Engineering | Botón primario muerto (disabled, sin onClick) | Panel útil (gap + cotizaciones por peso) | código |
| Fallas silenciosas | autosave Dirección / lector plano / re-costeo se tragaban errores | Avisan/registran | código |
| **Dibujar (UI)** | Texto y cuartos negro-sobre-negro (invisibles) | **Legible** (texto claro + halo, rejilla sutil) | screenshot antes/después |
| **Texto claro sobre fondo claro (toda la app)** | Barra "Dibuja a ojo" (crema), **panel Voni (#fff)**, tarjeta Reglas, fila bajo-mínimo, 5 clases CSS | `.nota-clara` + texto oscuro forzado | screenshot barra crema legible |
| #13 Desperdicio | "neto 1.00 **hoja** ≈ 0.34 de hoja" (contradictorio) | "neto 1.00 **m²**" (matemática ya era correcta) | agente + código |
| **#8 P1 Seguridad** | `anon` podía EXECUTE `solicitar_aprobacion_snapshot` (escribe aprobaciones) vía PUBLIC | **Revocado** (authenticated conserva) | SQL antes/después |
| #11 (trigger) | — | Gate de descuento dispara correcto: 35/40% no, **41/60% sí** (umbral 40%) | SQL shadow |

---

## P0 — ABIERTOS (bloquean GO)

1. **#8 `analizar-mueble` es FAIL-OPEN (gobernanza/precio).** Si falla la lectura del
   catálogo canónico, cae **en silencio** al catálogo legacy del navegador y la IA
   cotiza con datos viejos sin avisar (`analizar-mueble/index.ts:337-396`). Es el
   patrón "403→fallback legacy" que prohibiste. → Fallar cerrado o marcar "catálogo
   no disponible". (Pendiente: cambio de edge + redeploy.)
2. **#10/#11 Economía: `costoUnitario = 0` = "gratis" vs "desconocido".** Cot. 58:
   **7 de 12 renglones con costo 0 = $152,062 de venta sin costo conocido** (todas
   sillas de reventa + módulo recepción). El 0 puede leerse como costo cero. →
   Modelo "costo desconocido" + bloquear emisión/ocultar margen falso.
3. **#17 Acomodo/Render roto llega hasta el final.** 48 piezas → 23 colocadas (25
   fuera) y contador inconsistente ("23 no caben" vs "caben 23/48"); muebles en zona
   equivocada (mesa de juntas en CEO); render se genera con layout incompleto. →
   Compuertas duras: layout incompleto/contradictorio **bloquea** propuesta/render/
   emisión (no warning). Existe `floorSpec.puedePresentarPropuesta` pero **no está
   cableado**. (Pendiente.)
4. **#3/#15 Productos "confirmados" sin evidencia.** WIN/ALPHA/SONATA/CONCERTO/
   GAMMA-E/Eclipse aparecen como reales; deben ser **sugeridos** salvo evidencia del
   plano. "Confirmado" debe significar evidencia, no decisión del sistema. (Pendiente.)
5. **#5 Contradicción física sin bloqueo.** Banca de "16 usuarios · 12.00 m" se dejó
   cotizar. → Hard gate cuando el programa es físicamente imposible. (Pendiente.)

## P1

- **#11 Descuento a PÉRDIDA.** El gate exige aprobación solo **>40%** (política plana),
  pero la rentabilidad puede ser 13% → descuentos 14–40% emiten sin aprobación y
  pueden ir a pérdida. → Gate de pérdida (margen < mínimo), no solo de política.
- **#8 `costear-servidor`** usa siempre `config-legado`; el fallo de certificación del
  catálogo se traga en silencio. → Hacerlo observable.
- **#12 Margen** disperso (semilla 30 en App.jsx/Catalogo; fallbacks 40 y 50). Regla
  canónica = `margenObjetivo` (motor 50) y el **servidor ya es la autoridad** e ignora
  el margen del cliente. → Unificar: cliente lee el parámetro; quitar `??40` muerto del
  servidor; alinear semilla 30.
- **#13(a)** Catálogo canónico no certificado (acero $2270/kg vs real) — BLOQUEADO en Compras.

## P2

- **#10 "Silla de visita · CONCURSO · $1,111"**: NO es placeholder — viene de `banco.js`
  (folio real 225120019) pero **sin fecha ni certificación**. → marcar "no certificado".
- **#9 Pluralización** ("1 oficinas / 1 sillas / 1 archiveros") en la frase a Voni. →
  capa de presentación determinista, sin tocar el contrato de IA. (Pendiente.)
- Backups sin RLS policy; "leaked password protection" desactivado; 22 DEFINER
  ejecutables por authenticated (revisar los no usados por el cliente).

---

## Voni — matriz de conectividad (resumen)

Hay **dos Voni**: el *wizard* de 4 pasos (sí actúa, vía callbacks) y el **FAB flotante
"Voni 2.0"** (asistente). El FAB es **100% lectura y determinista (no llama a ningún
LLM)**, recibe **el mismo contexto en toda pantalla** (solo cambia `route`), y **nunca
pasa `project_id`** (ni costing/revision/áreas/render). Sus 18 tools son `get_*`; **no
hay una sola tool de acción**. Resultado: "entiende a medias y no gobierna" en todas las
pantallas (Home/Plano/Costeador/BOM/Acomodo/2D-3D/Render/Cotizador/Aprobación/Archivo).
Lo único que ve bien: cotización (seller-safe), acomodo y catálogo. Lo bueno y a
preservar: el modelo de permisos/seller-safe (fail-closed, correcto).

---

## Probado E2E (sin bug) vs PENDIENTE de probar

**Probado:** login; Cotizar subir-plano (8 puestos) y dibujar; Costear a mano (motor +
fail-closed + precio); Usuarios; Contraseña; propuesta cliente (seller-safe, totales
correctos); contraste de pantallas.

**Pendiente (siguiente tanda):** #16 generar y abrir el **PDF real** (productos,
cantidades, impuestos, cliente, que vendedor no vea costo, que derive de revisión
emitida); #17 **acomodo/2D/3D/render** con el Golden a fondo; #18 todas las rutas
create→editar→guardar→reabrir; #19 Voni en vivo; #15 **snapshot/versionado** de la
lectura de plano; cross-flow (producto especial → cotizar → modificar → revisión);
ataque hostil (doble clic, logout, sesión expirada, timeout IA, PDF multipágina,
precio/costo faltante, descuento extremo).

---

## Cómo promover a producción (cuando revises RC)
`vercel deploy --prod` con tu token de Vercel (el clasificador me bloquea prod en
automático). RC ya tiene todo lo de arriba; login + planos ya están en prod.
