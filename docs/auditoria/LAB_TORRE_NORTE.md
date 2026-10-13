# Laboratorio · plano nuevo "Oficinas Torre Norte" (ARQ-01 + MOB-01) · 2026-10-13

Prueba pedida por Dirección tras el despliegue de PR #35: subir un plano que NO está en los goldens, sin la hoja de
respuestas, y comparar lo que VONI entiende, propone, acomoda, guarda, renderiza y emite contra la hoja de control
(`VonHaucke_Respuestas_Control_Plano_Prueba.pdf`, 18 partidas / 69 unidades, 308 m²).

Guion automatizado: `e2e/labTorreNorte.e2e.js` (`LAB_PLANO=…/plano.pdf`, `playwright.prod.config.js`). Dos corridas:
producción `ccf76f8` (registro 1295; interrumpida por error del operador antes del render) y cliente local con VH-136
(registro 1296; completa). Mismo backend (edges y base de producción). Evidencia en el scratchpad de la sesión.

## 1. Lectura del plano (compuerta "¿Es correcto?")

| Qué | Resultado | Control |
|---|---|---|
| Áreas | 8/8 con medidas exactas (12×7, 6×7, 4×7, 22×2, 5×5, 7×5, 6×5, 4×5) | 8 |
| m² | 308 | 308 |
| Puestos | 18 (OPERATIVA 16, DIRECCIÓN 1, RECEPCIÓN 1) | 18 |
| Asientos de salas | CONSEJO 10 · CREATIVA 6 | 10 · 6 |
| Puertas | 8 vanos distintos: D01–D07 con barrido (confianza media) · D08 1.80 m sin barrido → pendiente | 7 + 1 doble |
| Columnas P1/P2 | **no leídas** (0 obstáculos tipo columna) | 2 columnas, no muebles |
| Ambas láminas = mismo piso | sí: no duplicó áreas ni m² | prueba 1 de la hoja |
| Tiempo | 52–53 s de principio a fin (edge `leer-plano` + validación) | — |
| Servidor | `REVIEW_REQUIRED` por la puerta sin barrido | — |

**VH-136 (FIXED en rama):** la compuerta decía "confirma bisagra y sentido antes de aprobar el acomodo" y no había dónde.
Ahora cada puerta pendiente trae su control (una hoja / doble de dos hojas, bisagra izquierda/derecha vista desde adentro,
abre hacia adentro/afuera). En la corrida local la D08 quedó como dos hojas de 0.90 con bisagras en 2.46 y 4.26 m,
abriendo hacia adentro (prueba 6 de la hoja). El mismo control aparece en Acomodo para proyectos ya confirmados.

**VH-140 (OPEN):** las columnas P1/P2 no se leen como obstáculos; el acomodo no las conoce.

## 2. Programa propuesto desde el plano (paso Muebles)

VONI arma el programa por ZONAS de ARQ-01 (puestos contados) y **no lee la lista de mobiliario de MOB-01**:

| Propuso (11 partidas / 39 unidades) | Hoja MOB-01 (18 / 69) |
|---|---|
| 1 App LT 12 usuarios (7.20×1.20) + 1 App LT 4 usuarios (3.00×1.20) | 2 bancas APP LT 4800×1200 de 8 |
| 12 + 4 WIN | 16 WIN ✓ |
| — | 16 MOX bajo cubierta |
| Módulo directivo App LT + 1 ALPHA | Eclipse 2100×900 + 1 ALPHA + 2 CONCERTO + credenza + archivero |
| Mesa 3.00×1.20 + 10 CONCERTO | Mesa 3200×1300 + 10 SONATA |
| Mesa 2.40×1.20 + 6 CONCERTO ✓ | Mesa 2400×1200 + 6 CONCERTO + credenza |
| Módulo recepción 2 usuarios | Mostrador en L + 1 operativa + 3 visitas |
| — | Mueble café + 4 bancos |
| — (SITE vacío ✓) | rack/UPS no cotizables ✓ |

Lo bueno: no duplicó unidades, no cotizó el SITE, no metió los MOX al piso, no inventó colores ni acabados, los precios
son de catálogo con revalidación al emitir. Lo malo: sustituye modelos sin decirlo (CONCERTO por SONATA, módulo de 12 por
dos bancas de 8, "módulo recepción 2 usuarios" por mostrador en L) y omite credenzas, archivero, café y sillas de visita.
En Acomodo sí aparecen como "SUGERIDAS · NO COTIZADAS" (25 piezas: 2 visitas dirección, 3 credenzas, 16 gavetas, 1+2
recepción, 1 credenza café): la regla de zona acierta casi todo, pero nadie las cotiza solas.

- **VH-137 (OPEN, diseño):** leer la planta de mobiliario (MOB-01) como lista de productos con clave, modelo y medidas,
  y proponerla frente al programa por zonas; marcar "sustituido por catálogo" cuando el modelo pedido no exista.
- **VH-141 (OPEN, UX):** "Aplicar programa detectado" es todo o nada; no se puede aceptar unas líneas y rechazar otras
  antes de aplicar (la hoja pide "confirmar las propuestas correctas").
- **VH-139 (FIXED en rama):** aviso falso "SALA CREATIVA mide 30 m²: da para 6 personas, y pediste 10": comparaba todas
  las salas con un solo número; ahora cada sala usa sus asientos leídos.

## 3. Acomodo (solver real `acomodar-espacio-recovery` v10)

35 de 39 colocadas · `PARTIAL` · veredicto PARCIAL: geometría ✓, colisiones y puertas ✓, programa ✓, 4 WIN del módulo de 4
sin colocar (`NO_SPACE_PARA_SILLAS`: pasillo de 1.00 m), revisión semántica pendiente (el catálogo no declara la topología
de los módulos App LT 12u/4u; sillas de consejo con acceso de 400 mm). Diagnóstico por pieza presente y en español. CAFÉ y
SITE vacíos porque nada se cotizó ahí. Por área: OPERATIVA 14 · CONSEJO 11 · CREATIVA 7 · DIRECCIÓN 2 · RECEPCIÓN 1.
Advertencia de la hoja respetada: no se forzaron las 69 unidades al piso; lo pendiente se explica.

## 4. Guardar · reabrir · render · PDF

- Guardado real: 1295 (prod) y 1296 (local), `cotizacion_segura` devuelve 11 partidas / 35 colocadas / 8 áreas.
- Reabrir desde otra sesión: idénticas (11/35), 0 errores de página.
- Render por área: 5 llamadas, 392 s, **0 imágenes**; cada fallo fue honesto ("salieron ? de 1 esperados", "Gemini no
  devolvió imagen"). No se agregaron objetos (prueba de la hoja ✓) porque no hubo imagen. **VH-125 sigue abierto** (contador "?").
- PDF: BORRADOR · NO REGISTRADO, 4 páginas, 11 líneas / 39 piezas, escalera correcta ($309,670 + 3 % + 10 % + IVA) pero
  **TOTAL "—"** con anticipo $202,957.72 → **VH-138 (FIXED en rama)**: la pantalla no pasaba `totalRedondeado` al PDF.
  Verificado tras el arreglo: TOTAL $405,915.44 · saldo $202,957.72. Motivo del borrador: "App LT 12 usuarios todavía no
  tiene un costeo válido" y "259 de 259 insumos sin fuente de precio" (P0-01, pendiente de Dirección).

## 5. Hoja de control · pruebas 1–9

| # | Prueba | Resultado |
|---|---|---|
| 1 | Mismo piso, no 616 m² ni 138 unidades | ✓ |
| 2 | Recepción = un mostrador en L | ✗ propuso "módulo recepción 2 usuarios" (VH-137) |
| 3 | 16 WIN en dos bancas de 8 | ✓ 16 WIN · ✗ 12 + 4 en vez de 8 + 8 (VH-137) |
| 4 | 10 SONATA / 6 CONCERTO / 2 CONCERTO + ALPHA | ✗ SONATA→CONCERTO · ✓ 6 CONCERTO · ✗ faltan 2 visitas (sugeridas, no cotizadas) |
| 5 | 16 MOX bajo cubierta, no en pasillos | ✓ (no cotizados; sugeridos como gavetas) |
| 6 | Puerta principal abre al interior; barridos no son muebles | ✓ con VH-136 (antes: pendiente sin forma de confirmar) |
| 7 | SITE no se cotiza | ✓ |
| 8 | Nombres/acabados no declarados quedan por confirmar | parcial: no inventa acabados; sí sustituye modelos sin avisar |
| 9 | Cotas de referencia | ✓ |

## 6. Qué cambió en la rama por este laboratorio

VH-136 (puertas), VH-138 (TOTAL del PDF), VH-139 (aviso de sala), supuestos preliminares fuera de `confirmaciones`
(observación de Dirección), `e2e/labTorreNorte.e2e.js` y `e2e/labPdfReabrir.e2e.js`. Sin desplegar: requiere autorización.

## 7. Despliegue y verificación en producción (2026-10-13)

- Producción: merge `c8dd2b3` (PR #36) · Vercel `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3` READY · alias `costeador-vonhaucke.vercel.app`. Rollback: `dpl_9ehp8cSU7bvH3hptvETpU1tHPPHv` (ccf76f8).
- Smoke 14/14 (auth, catálogo, cierre de navegador, golden 757 con edge real; registro 1328).
- Mismo laboratorio contra producción (registro 1329, QA): la D08 se confirmó como acceso doble hacia adentro desde la compuerta y la lectura quedó sin avisos de puerta; acomodo 35/39; render 2/5 válidos (los otros 3 rechazados por la verificación de fidelidad, sin inventar imagen); PDF borrador con TOTAL $405,915.44 y saldo correcto; reabierta idéntica con 2 escenas; 0 errores de página.
- Pendiente de diseño: VH-137 (leer la planta de mobiliario), VH-140 (columnas), VH-141 (aplicar por líneas), VH-125 (contador del render).
