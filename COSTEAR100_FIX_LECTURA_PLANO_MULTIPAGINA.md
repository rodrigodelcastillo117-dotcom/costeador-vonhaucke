# COSTEAR · Fix de lectura de planos multipágina (bug real reportado) · 2026-11-03

## El bug (reportado por Dirección, con plano TELCEL real TELSVH120.pdf, 4 hojas)
COSTEAR "pedía confirmar ~90% de los materiales" de un plano cuyo despiece completo
**ya estaba impreso** en la hoja 2. Diagnóstico con evidencia dura (se leyeron las 4 hojas):

| Hoja | Contenido | ¿Materiales? |
|---|---|---|
| 1 | Vistas generales + cuadro de rotulación | ❌ no hay lista |
| **2** | **LISTA DE DESPIECE: 20 renglones (No./Clave PDM/Descripción/Cantidad)** | ✅ **todo** |
| 3 | Instrucciones de armado | parcial |
| 4 | Detalles (placa, niveladores) | parcial |

**Causa raíz = el FRONT, no el edge.** Al subir un PDF de varias hojas, el flujo
rasterizaba a JPEG (1600px) **una** hoja y la mandaba a la IA; si era la hoja 1 (vistas),
nunca llegaba la tabla de materiales → la IA infería y preguntaba. El edge, cuando RECIBE
todas las hojas, siempre supo leer la tabla.

## El fix
1. **Front (`AsistenteEspecial.jsx`)**: un PDF ≤15 MB de varias hojas se manda **NATIVO**
   (documento, todas las hojas con su TEXTO real) en vez de rasterizar a JPEG. El
   rasterizado queda de fallback (PDF enorme o si el nativo no da despiece). Copy del
   selector: "Leer las N hojas (incluye materiales)" como opción por default.
2. **Edge (`analizar-mueble` v40)**: una TABLA/LISTA DE DESPIECE es el **BOM AUTORITATIVO** —
   cada renglón es una pieza; medidas/material/cantidad salen de la descripción;
   procedencia=MEASURED; NO se pregunta lo que la tabla ya da. Compatible con G12 (la tabla
   es DATO, no instrucción) y con la política de material (mapeo por familia, sin sustitución
   silenciosa).

## Evidencia antes/después (mismo plano real TELSVH120, PDF nativo, cuenta de prueba)
| | v39 (prod previo) | **v40 (desplegado)** |
|---|---|---|
| Piezas | 15 (agrupadas) | **20 — 1:1 con la tabla de la hoja 2** |
| Mapeadas al catálogo | 13/15 | **17/20** |
| NOT_AVAILABLE / sustituto | logo azul | logo azul (sustituto), Sikaflex, placa galvanizada |
| Preguntas | 3 | 4 (todas legítimas: calibre, acabado, gráfica, sustituto logo) |
| Claves PDM capturadas | parcial | TELSVH120-CUE/-BX2/-SOC/-SOM/-CF/-P/-PC/-BAA/-CAP + Kit/Correderas/Nivelador/Remache/Pasador/Silicón/Sikaflex/Placa/Pija/Clavo |

De "confirmar ~90%" → **despiece de 20 líneas con clave real y 4 preguntas razonables**.

## Despliegue y certificación (prod)
- Front: merge a `c3.4-seller-safe` → Vercel `9c03115` READY; canónico
  `costeador-vonhaucke.vercel.app` sirve el chunk `AsistenteEspecial-*` con el fix (grep
  confirmado). Smoke: index 200, bundle 200.
- Edge: `deploy-edge` workflow run #62 **success** → `analizar-mueble` **v40**. Auth-gate 401
  sin token; 200 con token (despiece de 20 piezas validado).
- Bug colateral corregido: el workflow `deploy-edge.yml` estaba roto (el CLI nuevo de
  Supabase exige `--yes` no-interactivo) → añadido `--yes`. Destraba cualquier deploy de edge.

## Qué NO cambió (honesto)
Esto arregla la **lectura/extracción del BOM** (la queja real). La **certificación
económica** del costo sigue dependiente de datos humanos (GIF Torre, huecos de Compras) — eso
no lo toca este fix. El motor cuesta bien un BOM correcto; ahora además saca el BOM correcto
del plano real.
