# APP LT — reglas de armado (bancas) · 2026-10-13

Datos en `reglas_armado_applt.json`, en esta misma carpeta. Todo es solo lectura de Drive.

## Fuentes

| Id | Archivo | Qué se usó |
|---|---|---|
| GE | `GE_AppLT_2024_08_26.pdf`: guía ESP-DCC-IDP-003 v3 (R. Carranza). Drive `15Wuj9RjZS4OTEbRa4NHkQNq9qJkODpoF` | El texto completo, más los dibujos revisados como imagen en las p. 21-30, 35-38, 41 y 44-45. La numeración es la impresa, que coincide con la del PDF. |
| XL | `Modulos de 6U Y 8U linea APP LT.xlsx`. Drive `11cKBPM0tmT171VbgBYueGZaA8bwv71io` | Hoja1. **Solo trae 2 claves con sus horas por área**: no tiene BOM ni imágenes, y Hoja2 y Hoja3 están vacías. |
| EJ | `ejemplo01_TATO63612AB001.json` y `coste_applt_20261002.json` (esta carpeta) | El BOM real del 6U y las horas por pieza de cada componente. |

Convenciones: **c** = número de cubiertas de la corrida. Las cantidades son por módulo. "visual" quiere decir que la cantidad se contó en el dibujo y no viene escrita como número.

## 1. Banca doble (fondo 1200, 2 usuarios por cubierta)

| Componente | Cantidad | Fuente |
|---|---|---|
| Cubierta ATCUBD44/45/46ABS (1200/1500/1800 × 1200) | c | GE p24-25 cuadro 2, p35 |
| Pata U **ATPU4M** (1200) en los **extremos** | 2 | GE p24-25 cuadro 4 |
| Pata U **ATPU75M** (750), "entre lugares" | **c − 1** | GE p25 cuadro 8. Las vistas inferiores de p41 y p44 la muestran más angosta. |
| Omega **ATOM3 / ATOM4 / ATOM5** (800/1100/1400 mm) para cubierta 1200/1500/1800 | **2c** (visual: frente y fondo) | GE p24-25 cuadro 5. Vistas inferiores en p26, p28, p41 y p44. |
| Riel ATRICDB4/5/6 (900/1200/1500) | c | GE p24-25 cuadro 3, p38 |
| Placa unión **QCIPLAUES** (en el ERP: CIEPLA01300778) | **2(c − 1)** (visual: 2 por junta) | GE p25 cuadro 7, p38. Vistas en p41 y p44. |
| Acometida **ATACM** | 1 (visual en 2U, 4U y 6U) | GE p24-25 cuadro 6 ("Acometidas recomendadas"), p36 |
| Biombo ATBIOCRT4/5/6 (cristal transparente) o ATBIOABS4/5/6 (melamina 9 mm), de 1100/1400/1700 × 400 | c, si lleva biombo | GE p24-25 cuadro 1, p37 y p45 (2 biombos de 1400 sobre 2 cubiertas de 1500) |

Extensión eléctrica por cubierta: 900/1200 → 48", 1500 → 52", 1800 → 60". La banca doble lleva además un conector en "Y" de retorno (GE p41). Contactos: MVLECO… (GE p40).

Restricciones:
- Solo gavetas rodantes, nunca pedestal (GE p24, p25 y p27).
- La pata tubular va solo cuando lleva gaveta; si no, se usan patas marco y acometida cuadrada (GE p28).
- Lo que esté fuera de la guía se consulta con Diseño.

**Contraste con el pedido real (EJ, 6U, c = 3):** la regla da 2 ATPU4M + 2 ATPU75M + 6 ATOM3 + 3 ATCUBD44ABS + 3 ATRICDB4 + 1 ATACM + 4 CIEPLA01300778. **Coincide exacto** con el pedido 38247. En el pedido, los biombos (ATBIOCRS4 satinado, 3 por módulo) van en una partida aparte.

## 2. Módulos con clave

| Clave | Configuración | BOM | Horas PM / pintura / acabados / carpintería |
|---|---|---|---|
| TATO63612AB001 (comercial TATO63612ABS001) | 6U, 3600×1200, sin biombo | Ver arriba (EJ) | 12.776 / 0.1331 / 2.002 / 4.2204 (XL = EJ) |
| TATO84812ABY01 | 8U, 4800×1200, biombo PET 9 mm | **No viene.** Según la regla: 2 ATPU4M + 3 ATPU75M + 8 ATOM3 + 4 ATCUBD44ABS + 4 ATRICDB4 + 6 placas + 1 ATACM + 4 biombos PET | 16.994 / 0.1892 / 2.7862 / 5.6272 (XL) |

Verificación del 8U con las horas por pieza de EJ (cálculo nuestro):
- Carpintería cuadra exacto: 4 × 1.4068.
- Con 1 ATACM faltan PM 1.0304, pintura 0.0198 y acabados 0.216 h. Eso es **exactamente 2 × ATACM**.
- La única combinación entera que cuadra las 4 áreas, sin contar el biombo, es la regla de arriba con **3 ATACM**.
- Pero el 8U lleva biombo PET y el 6U no. El residuo también podría ser la soportería de los 4 biombos.
- **Ambiguo: hace falta el BOM real del 8U.**

Patrón de clave de módulo (deducido por nosotros, no viene en la guía): `TATO{usuarios}{largo dm}{fondo dm}AB{biombo}{consecutivo}`. Sufijos vistos: S/0 = sin biombo, CRT/CT = cristal, Y = PET.

## 3. Banca sencilla (fondo 600, 1 usuario por cubierta)

| Componente | Cantidad | Fuente |
|---|---|---|
| Cubierta | c | GE p21-22 dice ATCUBS42/52/62ABS; GE p35 dice **ATCUBS44/45/46ABS** (**conflicto dentro de la guía**) |
| Pata ATPU2M (600) | c + 1 (visual; la guía no distingue extremo de intermedia) | GE p21-22, p36 |
| Omega ATOM3/4/5 (1.20/1.50/1.80) | c (visual: 1 por cubierta) | GE p21-22, p41 |
| Riel ATRICDS4/5/6 (con faldón perforado) | c | GE p21-22, p38 |
| ATACM | 1 (visual) | GE p21-22, p41 |
| Placa unión | null: no aparece | — |

Restricción: no lleva gaveta pedestal, tampoco en bancas de 1 usuario (GE p23).

## 4. Opciones de acabado

La guía **no trae** tabla de opciones A/B/C. Del pedido 38247 (A118B770C770):

| Letra | Qué define | Ejemplo |
|---|---|---|
| A | Color del metal | A118 Charcoal |
| B | Melamina (madera) | B770 Light Ash LP |
| C | Plástico / canto ABS | C770 Light Ash LP |

- Patas, omegas, riel, ATACM y placa llevan solo la letra A.
- La cubierta lleva A, B y C.
- El biombo ATBIOCRS4 no lleva opción.
- Los colores de biombo de melamina (747, 713, 746, 716, 709, 761, 718, B751) vienen en GE p32, pero sin códigos de opción.

## 5. Diferencias contra `src/datos/applt.js` (`generarAppLT`)

**Banca doble**

1. **Clave de omega.** Hoy `omegaPara(L, 1200)` → `doble` → ATOMCU3/4/5. Debe ser **ATOM3/ATOM4/ATOM5** (1200/1500/1800). Fuente: GE p24-25 cuadro 5 y EJ (ATOM3).
2. **Cantidad de omegas.** Hoy es `pares`; debe ser **2 × pares**. Fuente: vistas inferiores GE p26, p28, p41 y p44; EJ trae 6.
3. **Patas.** Hoy: ATPU4M × (pares + 1). Debe ser **ATPU4M × 2 + ATPU75M × (pares − 1)**, y el PTR de la intermedia con claro de 750. Fuente: GE p25 cuadros 4 y 8; EJ 2 + 2.
4. **Faltan las placas unión.** Hay que agregar **QCIPLAUES/CIEPLA01300778 × 2(pares − 1)**, con precio de lista 0. Fuente: GE p25 cuadro 7; EJ trae 4.
5. **Falta ATACM.** Hoy se trata como "eléctrico aparte". En la guía y en el pedido es **componente del módulo** (1, $270). Ojo con el 8U (§2).
6. **Largo 1050 y usuarios impares** (`round(n/2)`): **no existen en la guía** de bancas (solo 1200/1500/1800 y pares de usuarios). Son configuraciones "fuera de guía, consultar con Diseño".
7. **Biombos.**
   - La cantidad (pares) y los largos 1100/1400/1700 están bien.
   - `ATBIOPET4/5/6` **no viene en la guía**.
   - Falta **ATBIOCRS4** (cristal satinado, el del pedido real).
   - `laterales` y `divisores` no vienen en la guía.
8. **Horas que no se usan o se estiman mal.**
   - El generador nunca suma ATPU75M, ATACM ni placas.
   - Estima ATPU4M con fórmula: 1.92 / 0.15 / 0.008. El dato real es 2.1556 / 0.1896 / 0.0132 (EJ).
   - Estima ATRICDB4 con `hRiel`: 0.165 / 0.09 / 0.004. El dato real es **0.8432 / 0.1464 / 0.0066**.
   - Con todo esto, el 6U sale en metal 10.04 contra 12.776 reales, y en acabados 1.374 contra 2.002.

**Banca sencilla**

9. `omegaPara(1800, 600)` → ATOM4 (1100). En banca la guía dice **ATOM5 (1400)** para 1.80 (GE p21-22). El mapeo 1800 → ATOM4 solo vale para **escritorio** ATCE62ABS (GE p15).
10. Falta ATACM (recomendada, GE p21-22).
11. El generador ofrece 1050, que no viene en la guía. Las claves ATCUBS44/45/46 coinciden con GE p35, pero no con GE p21-22.

**Mesa de juntas** (fuera del alcance de bench; se anota porque salió en la revisión)

12. Hoy: 1 cubierta + 2 patas `pataPara(L)`, es decir, la pata se escoge por **largo**, y para L > 2100 cae a 1200. La guía (p29-30) la arma con:
    - c cubiertas ATCUBD/ATCUMJ (1200 de ancho).
    - ATPU4M en los extremos y ATPU75M entre cubiertas.
    - Omegas ATOM3-5 (registrable) o ATOMCU3-5 (ciega).
    - Riel ATRICMJ, ATUDB, QCIPLAUES y ATACM.

## 6. Ambigüedades y lo que falta

- Las cantidades de omega (2 por cubierta) y placa unión (2 por junta) son **visuales**: la guía no las escribe. El pedido 38247 las confirma solo para 1200.
- El 8U: no sabemos si lleva 1 o 3 ATACM, ni el BOM y la clave del biombo PET.
- Dentro de la propia guía hay datos que no cuadran con el ERP:
  - Medidas: ATOM3 800×98×14 en la guía contra 850×100×17 en el ERP; ATACM 251×75×650 contra 220×649×75.
  - Troqueles de ATRICDB: la guía dice 2 de contacto + 1 V/D; el ERP dice 4 + 2.
  - Las columnas Fr/Fo/A de p35 están corridas. Se confirmó que ATCUBD45ABS es 1500×1200 con el reporte del cotizador `ATCUBD45ABS.pdf`.
- No hay BOM ni horas de 1500/1800 (ATCUBD45/46, ATRICDB5/6, ATOM4/5) en EJ. Los reportes de cotizador están en Drive (sección de abajo).
- No existe una tabla oficial de opciones A/B/C.
- `preciosVenta.js:49` etiqueta TATO63612ABCRT01 como `biombo:'pet'`, pero `banco.js` dice cristal transparente. Hay que revisarlo.

## Archivos de Drive relevantes (no se modificaron)

| fileId | Archivo |
|---|---|
| 15Wuj9RjZS4OTEbRa4NHkQNq9qJkODpoF | GE_AppLT_2024_08_26.pdf (guía) |
| 11cKBPM0tmT171VbgBYueGZaA8bwv71io | Modulos de 6U Y 8U linea APP LT.xlsx |
| 16dlIf3OnYo-14ivaC_demHa0_onoQdwN | Coste APP LT 20261002.xlsx |
| 1AquvyHzOZwqdURHNyzaZL2zADso3aRXM | Ejemplo 01 – Pedido 38247 TATO63612AB001 |
| 1bNkLiIVlc4jNwTsYk6ScKpPgMK4geiIS | 226080135.pdf: presupuesto con APP LT 10U 6000×1200 con biombo PET, lista $51,560, sin BOM |
| 1tqroLYTJyLKp4nXgRBLbR7h077c3IFSv / 1VNZM6m8e9byU-olBdbQy0UDJeP0IGIkz / 1hgnJzmFtQaQCkawd3BHhFnzRLC0ydPHi | Reportes del cotizador ATCUBD45ABS / ATCUBD46ABS / ATCUBD44ABS (BOM + horas) |
| 1swMEW1U-a3TGzdtVXTR3MMaX0IjHXWDJ / 1LokRjURdZe7UABVA5c07qcPgh4k-TVzi / 1_5PUrPab9oVSnK_0mmrB_w3GDgJmHBRM / 1PcNaAwOPv2OvRMav_0yIDOtKxIgDf9-k | Reportes del cotizador ATPU75M / ATOM3 / ATOM4 / ATACM |
| 13nYXk7MJZtInQYjwiK0uUftHhqCCZ4Oc | Catalogo_AppTL NOM.pdf (comercial, sin claves) |
