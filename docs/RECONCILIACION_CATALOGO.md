# Reconciliación catálogo legacy ↔ canónico (A1/A6)

**Fecha:** 2026-10-04 · Verificado contra la DB real (`mtuvnbgljwbsaizjjgzs`).

## Resumen ejecutivo

El motor de costeo (cliente) usa los precios de `config.datos.insumos` (**92 insumos**, "legacy").
`analizar-mueble` identifica materiales contra el catálogo canónico (`catalogo_vigente`,
**254 insumos**). Los 92 legacy son un **subconjunto** del canónico (mismo espacio de ids).

**No se puede adoptar el canónico como autoridad de precio todavía:**

- **0 insumos tienen precio certificado con evidencia** utilizable (254: 30 "concordante",
  166 "referenciada", 51 "sin_evidencia"; `certificable=true` solo en los 30 concordantes,
  pero incluso esos están `estado='propuesto'`).
- De los 92 compartidos, **62 difieren de precio** (49 >10%, 35 >50%).
- Varios precios canónicos son **físicamente imposibles** (abajo): adoptarlos costearía
  un mueble metálico ~60× de más.

**Conclusión:** el split-brain NO produce costos falsos hoy porque (a) el motor usa los
precios legacy que funcionan y (b) es fail-closed para materiales que no tiene (bloquea,
no inventa $0). Cerrar A1 "de verdad" = **compras certifica y corrige el canónico**
(unidades + precios absurdos), luego el motor migra a esa fuente única. Es tarea de datos.

## ERRORES REALES en el canónico (NO migrar hasta corregir)

Precios imposibles — el legacy es el correcto:

| id | nombre | legacy | canónico | Δ% | diagnóstico |
|---|---|---|---|---|---|
| lamina-10 | Lámina acero cal.10 | 33/kg | 2270.17/kg | +6779% | ERROR: acero ≈ $33/kg |
| lamina-12 | Lámina acero cal.12 | 33/kg | 1336.56/kg | +3950% | ERROR |
| lamina-14 | Lámina acero cal.14 | 33/kg | 816.48/kg | +2374% | ERROR |
| lamina-18 | Lámina acero cal.18 | 34/kg | 571.54/kg | +1581% | ERROR |
| inoxidable | Inoxidable 304 cal.20 | 135/kg | 1930/kg | +1330% | ERROR |
| lamina-20 | Lámina acero cal.20 | 32/kg | 455.82/kg | +1324% | ERROR |
| lamina-22 | Lámina acero cal.22 | 33/kg | 378.78/kg | +1048% | ERROR |

(Parecen precios por-hoja o por-tramo etiquetados como por-kg. Compras debe fijar unidad+precio.)

## CONFLICTOS DE UNIDAD (no comparables hasta normalizar)

| id | legacy | canónico | nota |
|---|---|---|---|
| melamina-19 | $320 /m² | $544 /hoja | hoja=2.9768 m² → $182.7/m² ≠ $320/m² |
| mdf | $210 /m² | $437 /hoja | unidad distinta |
| divisor-melamina / faldon-melamina | $320 /m² | $665 /hoja | unidad distinta |
| chapa-madera | $850 /m² | $540 /hoja | unidad distinta |
| membrana-pvc | $260 /m² | $700 /hoja | unidad distinta |
| corredera | $95 /par | $70 /juego | par vs juego |
| laminado | $420 /m² | $405.6 /hoja | unidad distinta |

## DIFERENCIAS DE PRECIO (misma unidad) — revisar cuál es vigente

Mayores (>50%): ducto, pasacables, bisagra, remate-aluminio, ecopiel, piel-napa,
frente-metal, arnes, tapacanto, tela, contacto, melamina-16, espuma-termoformada,
rodaja, ptr-10, ptr-12, cristal-satinado, cristal-templado-12, tapacanto-3mm,
cristal-flotado, cristal-templado-6, bastidor-madera, mdf-16, cerradura-electronica, espuma.
Medias (10–50%): acometida, aglomerado, barniz, nivelador, cristal-templado, acrilico-6,
perfil-aluminio, nogal, marmol, jaladera.
Menores (<10%): ptr, chicote, pet-acustico, usb-hdmi, cerradura, ptr-14, acrilico,
melamina-28, melamina-9, acrilico-12, caja-electrica, pintura-electrostatica.

## Acción requerida (compras / datos — fuera de código)

1. Corregir los 7 precios de acero/inox (unidad y valor reales).
2. Normalizar unidades (m²↔hoja, par↔juego) en `insumo_precios`.
3. Certificar con evidencia (`evidence_status`, `approved_by`, `certificable=true`) los
   insumos que se usan en cotización.
4. Solo entonces: migrar el motor a la fuente canónica con gating por estado de precio
   (CERTIFIED→oficial, PRELIMINARY→visible, NO_PRICE/sin_evidencia→bloquea).

Mientras tanto el sistema es fail-closed: un material sin precio de trabajo → se bloquea,
nunca $0 silencioso.
