# 95_MOBILE_SMOKE_NAVEGADOR — smoke en viewport de teléfono (2026-11-03)

E2E en navegador (Playwright, device `iPhone 13`, 390×664 CSS px, por el proxy) contra prod `costeador-vonhaucke.vercel.app`
(commit `2b78f57`). **Lectura pura.** Mueve MOBILE de "SIN MEDIR" a "Medido (smoke)". El caso de uso es el propio de la app:
*"Funciona en el celular · La misma app, en el teléfono, en casa del cliente."*

## Resultados (ambos roles)
| Chequeo | Vendedor (ventasprueba) | Dirección (qa-direccion) |
|---|---|---|
| Overflow horizontal en home | **no** (scrollWidth 390 = innerWidth 390) | **no** |
| Tap-targets < 32 px (dedos) | **0** | **0** |
| Abrir Cotizar (flujo móvil principal) | abre, **sin overflow** | abre, **sin overflow** |
| Errores de página (pageerror) | **0** | **0** |

Evidencia visual: `mobile_vendedor_home.png`, `mobile_vendedor_cotizar.png`, `mobile_direccion_home.png`.

## Veredicto
**Medido (smoke): PASA.** En teléfono, ambos roles entran, el home no desborda a lo ancho, todos los CTA principales son
tocables (ninguno menor a 32 px) y el flujo Cotizar abre sin desbordamiento ni errores de consola. El home de Dirección, que
tiene más tarjetas (Costear, Materiales, Dirección, Usuarios, ERP), tampoco desborda.

## Residual honesto (lo que un "smoke" NO cubre)
- Es smoke de **layout + tap-targets + apertura de Cotizar**, no un E2E completo en móvil (subir foto desde cámara, dictar,
  completar una cotización y su PDF en el teléfono). Eso entra en la pasada E2E de 24 proyectos y, para foto/plano, necesita
  el presupuesto de interpretación (opus-5) aún diferido.
- Un solo dispositivo (iPhone 13). No se barrió un parque de tamaños (iPhone SE pequeño, tablets). El home a 390 px ya es un
  caso estrecho representativo; tablets son más anchas (menos riesgo de overflow).
