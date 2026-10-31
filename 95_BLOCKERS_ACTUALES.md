# 95_BLOCKERS_ACTUALES — lo que impide el 95 en las 14 áreas (2026-10-31)

Separado por tipo. Nada aquí es un defecto económico conocido sin resolver; son insumos que faltan
(decisión humana, presupuesto de API, o una cuenta QA) o trabajo E2E por correr.

## A · Decisión / acción HUMANA (no lo puede cerrar la sesión)
| ID | Qué | Por qué es humano |
|---|---|---|
| H1 | Confirmar materiales (`material_confirmado`) de partidas metálicas | Desbloquea la emisión del metal; es juicio de Dirección/Diseño |
| H2 | Aprobar los 42 puentes clave→insumo | Pantalla en vivo; la firma la da un humano (qa-direccion está excluida por diseño) |
| H3 | MG-1: tarifa de hora-metal App LT (B8) | Decisión de costeo Dirección/Alba (ruta intelisis) |
| H4 | Rotar la contraseña de la cuenta QA (BLN-06) | Acción en el panel de Auth; no se hace desde el repo |
| H5 | Crear cuenta `qa-ventas` (rol ventas) | Necesaria para el pentest seller-safe en vivo |
| H6 | P0-03: decidir destino de ~1,763 precios aprobados históricamente por qa-direccion | Confianza económica de Dirección (re-firmar por humano o marcar) |

## B · Presupuesto de API de pago (directivo: "no quemar APIs; reutiliza evidencia")
| ID | Qué | Costo |
|---|---|---|
| P1 | VONI benchmark ≥30 casos vs referencia revisada | Gemini por llamada × 30+ |
| P2 | Fidelidad de renders (puertas/cajones/proporción vs referencia) | Generación de imágenes de pago |
| P3 | foto→despiece E2E fresco (no reusar BLN-07) | Gemini visión |

## C · Trabajo E2E / navegador por correr (sin API de pago, pero toma sesión dedicada)
| ID | Qué |
|---|---|
| E1 | 24 proyectos E2E (8 COSTEAR + 8 COTIZAR + 8 COCREAR) con datos y trazabilidad propios |
| E2 | COTIZAR ciclo completo 1→50 partidas, reabrir, revisión, PDF autorizado (requiere qa-ventas para seller-safe) |
| E3 | MOBILE/tablet/desktop por los 3 roles (navegador headless) |
| E4 | ACOMODO con validador geométrico independiente (colisiones/pasillos/columnas) |
| E5 | Pentest vivo 10 ataques (requiere qa-ventas) |

## D · En la rama, pendiente de deploy autorizado
- Hardening **BLN-09** (`src/datos/mapIaComps.js`, commit en rama) — requiere merge+deploy.

## Orden sugerido para desbloquear (mayor retorno primero)
1. H5 (crear qa-ventas) → desbloquea E2/E5 (seller-safe + cotizar completo).
2. H1/H2 (confirmar materiales + aprobar puentes) → desbloquea emisión real de especiales.
3. P1/P2/P3 (presupuesto API) → desbloquea VONI/renders/foto frescos.
4. E1/E3/E4 (sesión E2E dedicada) → cierra las áreas NO RE-VERIF.
5. H4/H6/H3 (seguridad y precios históricos) → integridad económica de largo plazo.
