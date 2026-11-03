# COSTEAR 100 · FASE 5/C — ROUTING de fabricación (2026-11-03)

## Qué se construyó
`src/datos/routingFabricacion.js` — el **"CÓMO se produce"** junto al BOM (el "QUÉ"). Dado el despiece, propone de
forma determinista las **operaciones de fabricación** implícitas, con su **centro de trabajo**, en **secuencia de
fábrica**. Se apoya en los roles de `revisionEstructural` (no es motor paralelo) y empareja con el detector de
omisiones: donde el detector dice "metal sin unión costeada", el routing muestra la operación "Soldadura
(metalmecánica)".

### Catálogo de operaciones (en secuencia)
corte de lámina · corte de tubo/perfil · corte/seccionado de tablero · corte de vidrio (posible tercero) ·
punzonado/barrenado · doblez · **soldadura** · esmerilado · enchapado · pegado de canto · preparación de superficie ·
pintura electrostática · pintura líquida/laca · secado/curado · **armado** · instalación de herrajes · colocación de
vidrio · cableado · pruebas eléctricas · inspección · embalaje. Cada una con centro (metalmecánica, carpintería,
pintura, ensamble, vidrio, eléctrico, calidad, embalaje), categoría y disparo (qué del BOM la implica).

### Honestidad (directiva FASE 5, textual)
> "No inventes tiempos de producción certificados. Si no existe medición, utiliza sólo reglas orientativas
> identificadas y exige validación para costo oficial."

- **Ninguna operación trae tiempo ni tarifa certificados.** Todas quedan `estado: 'PENDIENTE_TIEMPO'`,
  `requiere_validacion: true`, `certeza: 'INFERIDO'`.
- `resumen.mano_obra_certificable = false` siempre que haya operaciones: **la MO del routing no es certificable**
  hasta que Ingeniería/Producción capturen tiempos y tarifas reales (ver `TELCEL_MO_GIF_GAP` — mismo bloqueo).
- El valor hoy es saber **QUÉ operaciones hay** (y cuáles faltan), no inventar cuánto tardan.

## Validación (RED→GREEN): `routingFabricacion.test.js`, 10/10
- Metal (lámina+tubular) → corte + doblez + soldadura + esmerilado + armado; herrajes → instalación; iluminación →
  cableado + pruebas; vidrio → corte (tercero?) + colocación; pintura en polvo → preparación + electrostática + secado.
- **No inventa tiempos**: toda operación con `tiempo=null`, `PENDIENTE_TIEMPO`, `mano_obra_certificable=false`.
- Secuencia de fábrica: corte < soldadura < armado < embalaje.
- **Módulo REAL TELCEL** (Almacenamiento METAL): propone soldadura + pintura electrostática + instalación de herrajes;
  MO no certificable; centro metalmecánica agregado.
- Un test cazó un modelo incompleto (armado dependía sólo de roles estructurales y un módulo de lámina+tubular no
  disparaba armado) → se corrigió a "fabricables" = roles estructurales + miembros metálicos. RED→GREEN real.

## UX (FASE 14)
Cableado en `AsistenteEspecial.jsx` (COSTEAR) como panel **"Así lo fabricaría — operaciones"**, con chips por operación
(y su centro) y la nota de que faltan tiempos/tarifas reales → la MO no es certificable todavía. `try/catch` defensivo;
se limpia al reiniciar. Build OK; detector + routing + componentes en verde.

## Lo que falta (siguiente valor)
- Capturar tiempos/tarifas reales por operación y centro (dato de fábrica, bloqueado hasta el punto de integración) →
  recién entonces el routing aporta MO certificable.
- Conectar `mano_obra_certificable=false` al gate de estado de costo (ESTIMACIÓN vs CERTIFICADO).
- Afinar disparos por familia de mueble (exhibidor/isla/torre) y por geometría.
