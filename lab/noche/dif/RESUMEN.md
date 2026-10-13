# Lab Costear · dificultad + VH-177 · 2026-10-13

App local (dev 5173) con `costear-servidor-rc` (corrida 22, `e6a4c30`) y `analizar-mueble-rc`. Cuenta QA. 8 hojas de control.
La corrida 1 se cayó por un error del laboratorio (botón "Atrás" de la app); evidencia en el commit `3f56db1`.

| Hoja | Hoja de control | Costo app = servidor | Difícil app = servidor | Sube | Regresa a normal igual |
|---|---|---|---|---|---|
| credenza | FAIL 8/12 (lectura IA: laterales 550 vs 650, 1 entrepaño de 1762 en vez de 3 de 577, respaldo 550 vs 650) | $4,737.73 = $4,737.73 | $5,292.36 = $5,292.36 (+11.7 %) | sí | sí |
| escritorio_L | FAIL 4/6 (retorno duplicado, faltan 2 paneles) | $3,524.02 = $3,524.02 | $3,922.16 = $3,922.16 (+11.3 %) | sí | sí |
| gabinete_alto | **FAIL 2/10: la IA devolvió 1 sola pieza (VH-178)** | $1,270.39 = $1,270.39 | $1,413.31 = $1,413.31 (+11.3 %; llegó después de 6 s, ver run.log l.30) | sí | sí |
| librero_5x8 | FAIL 4/6 (material fuera de familia) · costo BLOQUEADO a propósito (P0-02, tableros 5×8 sin formato) | — / $3,159.92 | no aplica | — | — |
| mesa_centro | FAIL 1/3 (tubular 5.17 m vs 7–7.4; cromado 0.31 vs 0.39–0.47 m²) | $2,826.91 = $2,826.91 | $3,090.25 = $3,090.25 (+9.3 %) | sí | sí |
| mesa_juntas_texto | PASS 6/6 (caja eléctrica sin material, no inventada) | $4,384.91 = $4,384.91 | $4,882.56 = $4,882.56 (+11.3 %) | sí | sí |
| mesa_trabajo | PASS 6/6 | $2,406.40 = $2,406.40 | $2,708.65 = $2,708.65 (+12.6 %) | sí | sí |
| mesa_trabajo_lote10 | PASS 6/6 | $1,760.54 = $1,760.54 | $1,976.68 = $1,976.68 (+12.3 %) | sí | sí |

**Conclusión:**
- Lo que se cambió hoy funciona: dificultad y VH-177. Paridad al centavo app = servidor en **7 de 7** hojas con costo, en normal y en difícil. La dificultad sube el costo entre 9 % y 13 %, y regresar a normal devuelve el número exacto.
- Lo que falla es la **lectura de la IA** (`analizar-mueble`), que no se tocó hoy. Pasan 3 de 8 hojas de control; la misma pieza cambia de corrida a corrida.
- Lo más grave es VH-178: una propuesta degenerada de la IA se acepta con confianza "alta".
