# Materia prima a cargar/actualizar — para Compras
**Fecha:** 2026-10-29 · Preparado para enviar a Compras.

## Lo primero (la verdad, sin rodeos)
Revisé el catálogo (10,185 materiales activos). **Ninguno está sin precio.** Lo que hay es:
- **4 materiales que NO existen en el catálogo** (hay que darlos de alta con precio). → Tabla 1. **Esto sí es "falta".**
- **7,102 materiales con precio APROBADO pero VIEJO** (todos >24 meses; muchos de 2009-2010). No les falta precio:
  les falta **refrescar** el precio con uno actual y su documento. → Tabla 2 (resumen por sección).

> Nota de Dirección: si la política es "un precio aprobado vale aunque sea viejo", los 7,102 **ya sirven** y no hay
> que recotizarlos. Si la política exige precio ≤24 meses, entonces sí hay que refrescarlos. **Esa decisión define
> cuánto trabajo es esto.** No se recomienda recotizar 7,102 a ciegas.

---

## TABLA 1 — Materiales que FALTAN en el catálogo (dar de alta con precio)
Son los 4 especiales de la vitrina TELSVH120 (proyecto TELCEL). Precio de referencia tomado del proyecto hermano
C-CO-320R; **Compras confirma el precio real y la fecha/documento.**

| # | Material | Clave fábrica | Unidad | Precio referencia | PRECIO (Compras) | FECHA | DOCUMENTO |
|---|---|---|---|---:|---|---|---|
| 1 | Cerradura cam-lock | MLEACE27330000 / CECAM20015 | pza | $416 c/u | | | |
| 2 | Kit iluminación LED (vitrina) | MLEEKT030000F9 / TELSVH120-KIT | kit | ~$2,500 | | | |
| 3 | Placa serigrafía aluminio cal.24 | MLEEPL0409C8G1 / TELSVH120-PLA | pza | ~$50 | | | |
| 4 | Capelo de cristal templado | MLECCP0302072C / TELSVH120-CAP | pza | ~$900 | | | |

Con estos 4, la vitrina TELSVH120 queda **29/29 costeable** (los otros 25 ya están conectados, esperan aprobación de Dirección).

---

## TABLA 2 — Materiales con precio viejo (>24 meses), por sección
No "faltan" (tienen precio aprobado), pero son viejos. Prioridad sugerida: los que de verdad se coticen,
empezando por las secciones de arriba.

| Sección | Materiales viejos | De esos, >5 años | Precio más viejo |
|---|---:|---:|---|
| erp-otros | 2,133 | 1,853 | 2010-02 |
| cubiertas | 2,031 | 1,798 | 2009-12 |
| metal | 1,129 | 937 | 2009-12 |
| tapicería | 668 | 473 | 2009-12 |
| herrajes | 504 | 388 | 2009-12 |
| eléctrico | 431 | 387 | 2010-02 |
| acabados | 201 | 138 | 2010-05 |
| ecoacústic | 5 | 4 | 2012-08 |
| **Total** | **7,102** | **5,978** | |

---

## Cómo lo cargan (sin romper nada)
- **NO** editar la base a mano. Se carga por el flujo de Compras/ERP (RPC `cargar_erp_ultima_compra` /
  `cargar_costos_oficiales`), que exige rol Dirección y deja traza (documento + fecha + hash). Es append-only:
  cada precio nuevo queda versionado, no se pierde el anterior.
- Para la Tabla 1: dar de alta los 4 con su precio real.
- Para la Tabla 2: refrescar **sólo** lo que Dirección decida según la política de frescura.

## ¿Quieres el listado completo de los 7,102 (ítem por ítem) para llenar en Excel?
Lo genero por sección en cuanto me digas (o cuando Dirección fije la política). Dime qué secciones te importan
para el piloto y te mando ese CSV acotado y fillable.
