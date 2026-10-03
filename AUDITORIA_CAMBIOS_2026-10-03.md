# Auditoría de cambios — Cotizador Von Haucke (2026-10-03)

> Documento para una **auditoría a fondo** (ChatGPT u otro). Resume TODO lo que se
> cambió en esta sesión, con qué revisar y cómo verificar. Nada de esto toca el
> núcleo de dinero/precios ni la seguridad (ver "Candados").

## Contexto
- App de **cotización/costeo de mobiliario de oficina**: React + Vite (un solo
  `index.html`, `vite-plugin-singlefile`) + Supabase (Postgres, RLS, Edge Functions, Auth).
- Rama de trabajo: **`c3.4-seller-safe`** (NO main). Desplegado SOLO a la
  **preview** `https://vonhaucke-rc.vercel.app`. Producción `costeador-vonhaucke.vercel.app` **intacta**.
- Base: commit `0451883`. Cambios de la sesión: 10 commits (abajo).

## Candados respetados (lo que NO se tocó)
- ❌ NO merge a main · NO deploy a producción.
- ❌ NO se tocó el motor de precio/dinero (server-side: `resolver_precio_autorizado`,
  `emitir_revision_v2`), ni RLS, ni las 33 cotizaciones legacy, ni `pdfPropuesta.js`
  (PDF vectorial), ni el motor de acomodo (`planner.js`/`reacomodar.js`/`rellenar.js`).
- ❌ NO se inventaron datos ni columnas. NO se bajó seguridad.
- ✅ Todo es **aditivo y reversible** (capa de presentación/UX del plano y la propuesta).
- ✅ **591/591 pruebas** (`npx vitest run`) y **54/54 pantallas** de humo verdes tras cada cambio.

## Resumen de commits
```
3ac0843 Dibujar plano: plantillas por giro + herramienta curva (óvalo)
f115b43 Dibujar plano: "dibuja a ojo y yo lo mido" — escala al m² objetivo
65a2245 Dibujar plano: formas libres fáciles (medidas en vivo + guía + enderezado)
a8d55f8 Vista del acomodo: marco premium del plano (maqueta)
9dd0f92 Calidad 3D: sillas de oficina reales (base, pistón, brazos)
d2640cd Calidad 3D: archiveros con cajones y jaladeras
bb4c3e1 Calidad 3D: monitores reales, más volumen, piso cálido
46e0501 Propuesta Viva enchufada al Acomodo real + botón de lanzamiento
cad966a LOCURA: Propuesta Viva — oficina del cliente en 3D, cinematográfica
6c41195 WOW planos + dibujar fácil + empezar de cero real
```
Archivos: `App.jsx` (+17), `Acomodo.jsx` (+17), `DibujarPlano.jsx` (+159),
`PlanoAcomodo.jsx` (+125), `PropuestaViva.jsx` (+149 NUEVO), `estilos.css` (+7),
`plano.jsx` (+13, harness dev-only).

## Detalle y qué auditar

### 1. `PropuestaViva.jsx` (NUEVO) — presentación 3D client-safe
- Reusa `PlanoAcomodo` en modo iso. Muestra marca, ambiente Showroom/Atardecer,
  chips (zonas, m², posiciones, muebles, inversión).
- **Inversión = Σ(precioUnitario × cantidad)** de las partidas (precio al cliente).
- **AUDITAR:** confirmar que es **client-safe** (nunca muestra costo/margen/insumos);
  que `inversion` no filtre datos internos; que el resumen de m²/posiciones no mienta.

### 2. `Acomodo.jsx` — botón "✨ Propuesta Viva" + reset "empezar de cero"
- Botón que abre `PropuestaViva` con `areasMM`/`plan`/`byId` reales.
- **AUDITAR:** `inversionCliente` y `clienteNombre` que se le pasan; que no rompa el
  guardado del acomodo.

### 3. `App.jsx` — `descartarProyecto`
- Ahora suelta `idCotizacion.current = null` y limpia `cliente`/`folio` para iniciar
  una cotización NUEVA (antes guardaba encima de la anterior).
- **AUDITAR (importante):** que soltar `idCotizacion` no cause duplicados ni pérdida;
  que el autosave cree un registro nuevo correctamente.

### 4. `PlanoAcomodo.jsx` (3D isométrico) — calidad visual
- Muros de cristal (curtain-wall), tapetes por zona (`colorZona`), plantas, sombras,
  más contraste en `cuboide`, piso cálido, **monitores** (base+cuello+pantalla),
  **archiveros** (líneas de cajón), **sillas** (base+pistón+brazos+respaldo).
- Todo dentro de `PlanoIso`; el modo `limpio` (imagen para render IA) sin cambios.
- **AUDITAR:** orden de pintado (algoritmo del pintor) por si algún mueble queda
  encimado; rendimiento con planos grandes (más elementos SVG por mueble);
  que no se alteró la GEOMETRÍA ni el acomodo, sólo el dibujo.

### 5. `DibujarPlano.jsx` — dibujar fácil (el grueso)
- **Plantillas por giro** (`PLANTILLAS`: corporativo/legal/startup/callcenter) → `plantilla(preset)`.
- **"Dibuja a ojo y yo lo mido"** → `dimensionarAM2()`: escala cuartos/formas/puertas/
  columnas/escaleras por `k = √(objetivo/actual)` para que el ÁREA total sea el m² dado.
- **Esquina por esquina** mejorado: enderezado `orto()` (L limpias, diagonales libres),
  medida por pared, línea guía (rubber band) con medida, "quitar último punto".
- **Herramienta curva/óvalo** (`ovaloPoly`): cuarto elíptico como polígono teselado.
- **AUDITAR:** `dimensionarAM2` escala desde el origen (0,0) — con m² grandes el dibujo
  se sale del lienzo fijo 22×15 m (cosmético: los datos van correctos al 3D que escala);
  ¿conviene auto-encuadre? Revisar que `orto` no degenere un vértice sobre el anterior.

### 6. `estilos.css` — `.plano-wrap` marco premium (gradiente, sombra, radio, esquinas redondas del 3D). Solo visual.

### 7. `plano.jsx` — harness dev-only: pestaña "Propuesta Viva" (NO entra al build).

## Cómo verificar
- Pruebas: `npx vitest run` → 591/591.
- Salud de todas las pantallas: `http://localhost:5173/humo.html` → "54 de 54 montan bien".
- 3D y Propuesta Viva: `http://localhost:5173/plano.html`.
- Editor de plano (plantillas, curva, dimensionar, esquina-por-esquina): `http://localhost:5173/humo.html?solo=dibujar`.
- En vivo (requiere login): `https://vonhaucke-rc.vercel.app` → cotización → "Acomodo en el espacio".

## Preguntas para el auditor (red-team)
1. ¿Hay ALGUNA ruta por la que `PropuestaViva` o el 3D muestren costo/margen a un vendedor/cliente?
2. ¿`descartarProyecto` puede perder trabajo o duplicar cotizaciones en la nube?
3. ¿El escalado `dimensionarAM2` mantiene la integridad de polígonos/obstáculos/puertas?
4. ¿El aumento de elementos SVG (monitores/sillas/archiveros con detalle) afecta el
   rendimiento en celular con un plano grande (p. ej. 50+ muebles)?
5. ¿Los `tipo` de las plantillas (`open/privado/juntas/recepcion/lounge`) son todos
   válidos para el motor de acomodo y el render? (Deben serlo.)
6. ¿Algo de esto cambió el PRECIO, el costo o una fuente de verdad? (No debería.)
