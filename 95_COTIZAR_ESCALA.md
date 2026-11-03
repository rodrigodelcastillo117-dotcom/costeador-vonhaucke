# 95_COTIZAR_ESCALA — cotización multi-partida al centavo (§5, 2026-11-03)

E2E en navegador (Playwright, prod `2b78f57`), cuenta vendedor real `ventasprueba`. Cotizar de línea, varias partidas,
**cuadre al centavo UI → base → PDF** y seller-safe. QA borrado al final (prod queda en 0). Sin IA de pago.

## Caso 5 partidas (cotización QA 4870, ya borrada)
5 ítems distintos del catálogo ERP (bases ECLIPSE DRIFT), agregados uno por uno:

| SKU | Precio venta catálogo |
|---|---:|
| EDBAS1120M | 1,650 |
| EDBAS27M | 5,030 |
| EDBAS46M | 5,180 |
| EDBASCZA4M | 4,140 |
| EDBASCZA6M | 1,680 |
| **Suma ventas** | **17,680** |

Cascada comercial (parámetros por defecto): 17,680 × 1.13 (maniobras 3% + flete 10%) × 1.16 (IVA) = **23,174.94**.

- **Base (DB):** `cotizaciones.total = 23,174.94`, 5 partidas, los 5 nombres/SKU correctos.
- **PDF:** TOTAL **$23,174.94** — **igual a la DB al centavo**; lista los 5 SKU; marca BORRADOR.
- **Seller-safe a escala:** ninguna de las 5 partidas lleva `costo/margen/costeo` (DB: `alguna_con_costo=false`); el PDF no
  contiene léxico de costo (scan vacío).

## Veredicto
**UI → base → PDF cuadran al centavo con 5 partidas, y el seller-safe se mantiene por partida y en el documento.**
Suma el caso de 1 partida (95_COTIZAR_E2E_NAVEGADOR.md, $2,162.82) ⇒ el invariante de dinero y de seguridad se sostiene
de 1 a 5 renglones, construido desde precios reales de catálogo.

## Residual honesto (lo que ESTE caso no cubre todavía)
- **30 y 50 partidas:** la aritmética es la misma suma determinista (no hay motivo matemático para que falle), pero NO se
  estresó la **paginación del PDF** ni el rendimiento de la UI a 30/50 renglones. Es barato de cerrar (más ítems, misma
  máquina) y queda pendiente por tiempo, no por defecto conocido.
- **Edición/recalcular tras reabrir** y **cotización mixta línea+especial / desde plano:** la parte "especial/plano" entra
  en COSTEAR desde foto/plano, que necesita opus-5 (diferido). La parte de línea está cubierta.
