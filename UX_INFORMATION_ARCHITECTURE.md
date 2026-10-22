# UX_INFORMATION_ARCHITECTURE — Von Haucke

**FASE 1 del pase "Simple afuera, riguroso adentro".** Define la navegación nueva y las reglas de *progressive disclosure* sobre las 471 funciones del inventario (`UX_FUNCTION_INVENTORY.md`). Documento de diseño en papel: **no cambia código ni lógica.** La ubicación exacta de cada función vive en la matriz de paridad (`UX_FUNCTION_PARITY.md`); aquí va la **estructura** y las **reglas**.

- Rama: `claude/costing-app-architecture-psf02g` · HEAD `00c32d8` · 2026-10-22

---

## Principio rector

Tres niveles de verdad, una sola plataforma:
- **SIMPLE AFUERA** — el usuario ve sólo lo que necesita *en ese momento*. Un CTA primario por pantalla, lenguaje humano, defaults inteligentes.
- **RIGUROSO ADENTRO** — motor, gates, economía server-side, BOM, ERP, auditoría: intactos, accesibles bajo demanda.
- **MISMA VERDAD PARA TODOS** — no hay "app simple" y "app avanzada" con motores distintos. Es la misma app; cambia la *prominencia*, no la *lógica*.

**Regla de profundidad:** máximo **2 niveles** desde la pantalla principal de cada flujo. Nada enterrado a 5 clics. Lo frecuente = visible; lo avanzado = agrupado en `Más opciones` / `Ver ingeniería` / `Ver detalles técnicos` (nunca eliminado).

**Tres cajones de disclosure** (destino de las 134 funciones "secundarias" y 58 "técnicas" del inventario):
- **Más opciones** — acciones legítimas pero poco frecuentes del mismo flujo (guardar como copia, exportar, duplicar, variantes raras).
- **Ver ingeniería** — todo el detalle de Costeo/BOM para Diseño/Dirección (despiece, mermas, mano de obra, procedencia, auditoría matemática, confianza, estructura Voni). 58 técnicas de COSTEAR cuelgan de aquí.
- **Ver detalles técnicos** — estados internos, IDs, provenance, diagnóstico crudo, JSON, logs (sólo cuando alguien los pide).

---

## Mapa de navegación nuevo

```
HOME  "¿Qué vas a hacer?"
├── COSTEAR   "¿Cuánto cuesta fabricar este producto?"        [primario · veCostos]
├── COTIZAR   "Convierte un plano o necesidad en propuesta."  [primario · todos]
├── COCREAR   "Diseña un producto nuevo con VONI."            [primario · todos]
│
├── Proyecto en curso  (retomar / empezar de cero)   [si hay cotización viva]
│
└── Más herramientas   (accesos secundarios, filtrados por rol)
    ├── Mis cotizaciones            (cotizacion)
    ├── Presupuestos anteriores     (archivo)
    ├── Banco de precios            (banco)
    ├── Comercial · Proyectos       (comercial)        [flag commercial_v2]
    ├── Lo que Voni sabe            (reglas)
    ├── Dirección · El negocio      (tablero)          [solo Dirección]
    ├── Usuarios y accesos          (usuarios)         [solo Dirección]
    └── Cargar compras del ERP      (carga-erp)        [solo Dirección]

CHROME GLOBAL (en toda pantalla):
  · Logo → Home   · Carrito "Mi cotización" (N)   · Estado de guardado (En línea/Guardando…)
  · Menú Cuenta (correo · Guía · Contraseña · Usuarios[Dir])   · Salir
  · FAB Voni (asistente transversal)   · Barra "‹ Atrás" + título
```

**Consolidación pendiente:** el panel legacy `home/cotizar` de `Inicio.jsx` (10 tarjetas `POR DEFINIR`) duplica destinos que ya están en Home + "Más herramientas". Decisión IA: **colapsarlo**; cada tarjeta se mapea a su destino existente (sus 10 ids `uxParity-cotizar-*` conservan test de paridad). Ninguna función se pierde; sólo desaparece la vista duplicada.

---

## Flujo COSTEAR — "¿cuánto cuesta fabricar algo?"

Stepper (≤4): **1. Empezar · 2. Esto entendí · 3. Decisiones · 4. Resultado**

| Pantalla | CTA primario | Secundarios | Ver ingeniería / técnico |
|---|---|---|---|
| 1. Empezar | (elige: Foto/plano · Describir · Manual) | — | — |
| 2. Esto entendí | **Costear** | Editar · Ver interpretación | Estructura que entendió Voni |
| 3. Decisiones (sólo si falta algo) | (una decisión a la vez, con recomendado) | Elegir otro | — |
| 4. Resultado | **Guardar** | Crear cotización · Generar render | **Ver ingeniería** (BOM, materiales, mermas, MO, indirectos, Alba, ERP, procedencia, auditoría matemática, confianza, mejora industrial) |

- La capa comercial (margen, precio, agregar verificado, ficha) sigue **solo Dirección**. Diseño ve "Cierre técnico" (guardar pieza).
- Los 23+ costeadores de línea = un **Configurador** único: Producto → Medidas → Opciones (acabado/color/biombo/extras) → Resultado. Toda su parametría es visible; el despiece va en "Ver ingeniería".
- El banner "SIMULADOR — NO OFICIAL" y el botón "Volver al costo oficial (Alba V1)" se conservan tal cual (gate de honestidad).

## Flujo COTIZAR — "qué necesita un proyecto y cuánto vender"

Stepper (≤5): **1. ¿Dónde va? · 2. Analizando · 3. Esto entendí · 4. Acomodo · 5. Propuesta**

| Pantalla | CTA primario | Secundarios | Técnico/ingeniería |
|---|---|---|---|
| 1. ¿Dónde va? | Subir plano | Dibujar · Sólo m² · Programa de cuartos | — |
| 2. Analizando | (progreso humano: Leyendo plano…/Buscando mobiliario…) | — | logs sólo en "detalles técnicos" |
| 3. Esto entendí | **Continuar** | Editar programa · Ver plano interpretado · variantes | procedencia/confianza (chips) |
| 4. Acomodo | **Aplicar recomendación** | Ver alternativas · Continuar con N · Editar a mano (floor editor) | diagnóstico por pieza · veredicto por bloques · auditoría medida |
| 5. Propuesta | **Generar propuesta (PDF)** | Editar productos · Editar acomodo · Guardar · Imágenes | gate de emisión · "¿por qué no puedo emitir?" · Mis números (Dir) |

- **Puertas/bisagras:** no preguntar una por una. Inferir cuando sea seguro ("Inferimos el giro de 3 puertas. No afecta la propuesta."); auto-reparar primero ("Movimos esta mesa 180 mm para liberar el giro."); preguntar sólo si cambia el resultado.
- **Acomodo y cotización son dos verdades distintas:** se puede generar BORRADOR de propuesta con `PRODUCTOS CONFIRMADOS` aunque el `ACOMODO` esté `PENDIENTE` — sin marcar acomodo validado en falso.
- El floor editor completo (arrastrar/girar/duplicar, paleta, puertas, undo/redo, reacomodar respetando manual) vive en **"Acomodar a mano"** — todas sus funciones intactas, un nivel abajo del acomodo.
- La superficie Comercial (proyectos, escenarios, deal desk, VE, revisiones, presentar al cliente) cuelga de "Más herramientas › Comercial", con su propia sub-navegación por tabs.

## Flujo COCREAR — "diseña algo nuevo" (CocrearV3)

Stepper (≤4): **1. Idea · 2. Conceptos · 3. Studio (diseño + 3D + costo) · 4. Registrar**

| Pantalla | CTA primario | Secundarios | Técnico/ingeniería |
|---|---|---|---|
| 1. Idea | **Crear conceptos con VONI** | Empezar desde cero · Subir referencia · Reabrir guardada | — |
| 2. Conceptos | **Desarrollar →** (concepto A/B/C) | Nueva idea · ¿ya existe en catálogo? | análisis Council |
| 3. Studio | **Me gusta / Costear en el servidor** | Cambiar algo (VONI co-diseñador en texto) · Editar medidas/componentes · Comparar A/B · 3D | Verdad industrial · explicación de costo · validar ingeniería · estimado de diseño |
| 4. Registrar | **Convertir en partida** | Guardar · Pasar/Afinar a Costear | referencia comercial · aviso debajo del padre |

- "Cambiar algo" = conversación en lenguaje natural primero ("hazla 20 cm más alta y cambia la base por zoclo"). Los 14 campos manuales siguen disponibles en "Editar medidas y componentes".
- Las decisiones de acabado se presentan en lenguaje humano (chapa natural premium / melamina económica), nunca códigos.

---

## Jerarquía por rol (misma plataforma)

| Rol | Ve por default | Bajo "Ver ingeniería/detalles" | Oculto |
|---|---|---|---|
| **Vendedor** (seller-safe) | Cotizar, Cocrear, precio recomendado, acomodo, PDF | — | costo, margen, BOM, economía, Costear, Precios, Tablero, Usuarios, ERP |
| **Diseño** (veCostos) | + Costear, BOM, ingeniería, Biblioteca, Reglas | despiece, auditoría, confianza, estructura | nómina, financieros, Tablero, Usuarios |
| **Dirección** | todo | todo | — |

La simplificación NO aplana roles: a cada quien se le muestra su jerarquía. Un vendedor nuevo llega a una propuesta completa sin ver un solo término técnico; Ingeniería llega a BOM/materiales/procedencia en ≤2 clics desde el resultado; Dirección conserva permisos, aprobaciones, certificación, auditoría e historial.

---

## Reglas transversales (de la UI al usuario)

1. **Un CTA primario por pantalla.** 1–3 secundarios menos prominentes. Nunca 7 botones del mismo peso.
2. **Errores siempre accionables:** qué pasó · qué conservamos · qué puedes hacer (Reintentar / Continuar manualmente). Nunca "No se pudo" sin salida.
3. **Nunca perder trabajo:** ante error/timeout/refresh/caída de IA, se preserva archivo/descripción/formulario/decisiones (ya existe: borrador de costeo, autosave, respaldo de conflicto — se conservan).
4. **Autoguardado visible** ("Guardado / Guardando…"); conflicto en lenguaje humano (Ver cambios / Conservar mi versión / Usar la más reciente) — sin códigos de concurrencia.
5. **Prioridad de automatización antes de preguntar:** ¿se infiere con seguridad? ¿opción conservadora? ¿se auto-repara? ¿se puede continuar sin la decisión? Sólo si no → preguntar.
6. **Agrupar warnings:** 7 advertencias menores → "3 cosas que recomendamos revisar", no 7 banners.
7. **Confirmaciones sólo en lo irreversible:** borrar, sobrescribir, emitir, perder cambios, acción comercial. Acciones destructivas separadas visualmente del CTA.
8. **Función "¿Por qué?"** opcional: explicación corta en vez de warning técnico.

## Lo que NO se mueve (riguroso adentro)

- Toda la economía y los gates son **server-side**: precio del servidor, gate de emisión, verificación de costo, aprobación de Dirección por hash de revisión. La UX no toca esa lógica.
- Fail-closed intactos: sin precio autorizado → no agrega; descuento bajo piso → aprobación; holdout/manifiesto; firma ERP; margen mínimo.
- El motor puede tener 40 estados internos; el usuario ve ≤5 pasos. Los estados crudos se traducen (ver `UX_LANGUAGE_MAP.md`) pero **el estado interno no cambia**.

## Desktop vs Mobile (estructural)

- **Desktop:** ancho cómodo, jerarquía, tarjetas; info secundaria colapsable. Evitar 3 columnas llenas y tablas gigantes como primera vista (p. ej. BOM entra plegado en "Ver ingeniería", no como primera pantalla).
- **Mobile:** CTA ancho completo, tarjetas compactas, navegación inferior/menú simple, sticky CTA, áreas táctiles cómodas. Ninguna función mobile se pierde; las avanzadas entran en "Más opciones". El floor editor y el 3D ya son touch (pan/zoom) — se conservan.

---

## Qué sigue
Con la IA definida, la matriz de paridad (`UX_FUNCTION_PARITY.md`) prueba que cada una de las 471 entradas tiene lugar aquí, y el antes/después (`UX_BEFORE_AFTER.md`) mide la reducción real de decisiones/warnings/pantallas por flujo. Construir UI, E2E persona-nueva y screenshots es la fase siguiente — se gatea por costo de IA.
