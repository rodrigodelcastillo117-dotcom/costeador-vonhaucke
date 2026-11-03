# 95_HERRAJES_COMPRAVENTA — reclasificación de herrajes a compra-venta (2026-11-03)

**Autorizado por Rodrigo del Castillo (Dirección):** "reclasifica herrajes como compra-venta y pruébalo."

## Qué cambió (una línea en el motor)
`src/motor/calculo.js` → `SIN_MO_SECCIONES` ahora incluye `'herrajes'` (antes: electrico, guardas, ecoacustic, graficos).
Efecto: las **jaladeras, bisagras, correderas, chapas y niveladores** (sección `herrajes`) se tratan como **compra-venta**:
- Mano de obra **1%** del material (antes 20% por caer en 'general') — fórmula de Alba.
- Indirectos **5%** del material (antes 3×MO = 60%).
- Además se **restan** de la base de mano de obra del resto de la pieza.

Razonamiento: los herrajes se **compran ya hechos** y solo se instalan; no se fabrican. La labor de instalación real
se recupera en el renglón de proyecto **Maniobras (3%)** y, cuando hay orden con horas, en las horas medidas.

## Prueba — impacto en las 25 familias golden (motor con default params)
**16 familias bajan, 0 suben.** Nunca encarece. Las 9 sin herrajes no cambian. Las que usan horas medidas (App LT) no se tocan.

| Familia | Costo antes | Costo después | Δ% |
|---|---:|---:|---:|
| modulor/gaveta | 1,365.38 | 1,302.04 | **−4.64%** |
| privacy4/muro | 3,627.41 | 3,473.16 | **−4.25%** |
| drift/escritorio | 2,926.38 | 2,849.19 | −2.64% |
| alba/escritorio | 4,297.82 | 4,217.10 | −1.88% |
| flex/escritorio | 2,695.40 | 2,645.24 | −1.86% |
| via/escritorio | 2,949.51 | 2,901.85 | −1.62% |
| spine/ducto | 1,356.79 | 1,342.88 | −1.03% |
| arlequin/pouf | 652.63 | 647.23 | −0.83% |
| cirque/escritorio | 5,326.25 | 5,288.02 | −0.72% |
| teamspace2/soporte | 1,553.70 | 1,542.90 | −0.70% |
| accents/acrilico | 309.36 | 308.01 | −0.44% |
| feather/escritorio | 2,641.06 | 2,631.14 | −0.38% |
| anteo/escritorio | 30,777.62 | 30,691.30 | −0.28% |
| pac/sillon | 2,253.44 | 2,248.04 | −0.24% |
| luna/escritorio | 8,809.16 | 8,797.03 | −0.14% |
| ergo4/banca_sencilla | 5,176.87 | 5,171.47 | −0.10% |
| *(9 sin herrajes)* | — | sin cambio | 0% |

Baja promedio chica (la mayoría <2%); solo gavetas/muros con mucha herrajería bajan ~4%. Coherente: los herrajes son una
fracción pequeña del material en casi todo.

## Verificación
- **4008 tests verde** (407 archivos), exit 0. Solo el golden `matrizGolden.test.js` requirió actualizar sus 16 valores
  (protocolo del propio test ante un cambio intencional del método), hecho **con explicación fechada** inline.
- **Build verde** (vite build, 10.9s).
- No se tocó ninguna otra fórmula; no hay valores sin documentar; ninguna familia encarece (no fail-open).

## Estado
Desarrollado y probado en la rama `claude/costing-app-architecture-psf02g`. **NO desplegado a producción** — requiere
autorización de deploy aparte. Para revertir: quitar `'herrajes'` del Set (una línea) y restaurar los 16 valores golden.
