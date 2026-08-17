// ============================================================================
//  BANCO DE PRECIOS — productos reales tomados de cotizaciones cerradas.
//  Cada renglon es un producto tal como se cotizo, con su PRECIO real (precio
//  unitario de lista/proyecto) y la fuente. Los precios varian por proyecto
//  segun descuento por volumen y configuracion; por eso se guarda la fuente.
//  Sirve para: (1) armar cotizaciones de proyecto rapido con precios reales,
//  (2) calibrar el costeador contra la realidad (§13.1).
//
//  Fuentes:
//   - 2508040  = Desarrollos Inmobiliarios BMU (Rodrigo, 03/2026) — precios de lista
//   - 226030004 = Grupo Tradeco (Zaida, 03/2026) — proyecto $3M, con descuento
//   - 226050047 = Propuesta general (Miguel, 05/2026) — con descuento por volumen
//
//  📦 AMPLIACIÓN 2026-08-15: se cargaron los 9 presupuestos que mandó Rodrigo
//  (293 renglones leídos con lupa, 0 saltados). Todo se guarda como PRECIO DE
//  LISTA, que es el que se cobra: los dos presupuestos que imprimen la columna
//  "Desc. 40%" traen el "precio 2" (interno, nunca se cotiza) y se convirtieron
//  con ×0.60; los otros siete ya publican el de lista. Ver la nota de
//  `preciosVenta.js` para la regla completa.
// ============================================================================

// tipo: modulo | mesa | guarda | almacen | especial | silla
// categoria: agrupador para la pantalla
export const BANCO = [
  // ==========================================================================
  //  De los 9 presupuestos (ago-2026). Cada renglón trae LÍNEA canónica, clave
  //  de sistema cuando el papel la imprime, medidas y su presupuesto de origen.
  //  El `nombre` es corto y buscable (Línea · Qué es · Modelo); la redacción
  //  literal del presupuesto se conserva en `descripcion`.
  // ==========================================================================
  { id: 'p9-app-lt-bench-doble-2120', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', nombre: "App LT · Bench doble", descripcion: "Cubierta cuadrada modelo apps lt para banca doble; en melamina con cant…", medidas: '1200 × 1200 mm', material: "melamina, canto ABS", precio: 2120, fuente: '225120019', clave: 'ATCUMJ44ABS' },
  { id: 'p9-app-lt-escritorio-8750', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Escritorio", descripcion: "Modulo opertativo 1 usuarios", medidas: '1500 × 600 mm', material: "melamina ABS, estructura metálica, faldón metálico, melamina canto ABS", precio: 8750, fuente: '225080025', clave: 'TATO1156AB0001' },
  { id: 'p9-app-lt-escritorio-gerencial-17660', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 6, nombre: "App LT · Escritorio gerencial", descripcion: "Modulo gerente , 1 usuario; escritorio en \"l\" modelo App LT; cubiertas…", material: "melamina ABS, estructura metálica, patas tipo U, con faldón, cantos ABS, biombos de cristal (visibles en la i…", precio: 17660, fuente: '226050047' },
  { id: 'p9-app-lt-modulo-operativo-3900', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Módulo operativo", descripcion: "Modulo opertativo 1 usuarios", medidas: '1200 × 600 mm', material: "melamina ABS, estructura metálica, faldón metálico, faldón", precio: 3900, fuente: '226030134', clave: 'TATO1126AB0001' },
  { id: 'p9-app-lt-modulo-operativo-6024', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo linea App LT 1 usuario", medidas: '1200 × 600 mm', material: "cubierta en melamina canto ABS, biombo en panel acústico de PET 9 mm, soportería metálica, melamina ABS, biom…", precio: 6024, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-12552', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 4, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo linea App LT 4 usuarios", medidas: '2100 × 1200 mm', material: "cubiertas en melamina canto ABS, biombo en panel acústico de PET 9 mm, soportería metálica, melamina ABS, bio…", precio: 12552, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-15700', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 2, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo , tipo applt 2 usuarios, bases metal, cubiertas, biomb…", medidas: '1500 × 1200 mm', material: "bases metal, melamina ABS, conducto metálico, melamina canto ABS, biombo frontal, biombos laterales", precio: 15700, fuente: '225080025' },
  { id: 'p9-app-lt-modulo-operativo-16056', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 3, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo linea App LT 3 usuarios", medidas: '3600 × 600 mm', material: "cubiertas en melamina canto ABS, biombo en panel acústico de PET 9 mm, soportería metálica, melamina ABS, bio…", precio: 16056, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-16080', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 2, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo linea App LT 2 usuarios", medidas: '2400 × 600 mm', material: "cubiertas en melamina canto ABS, biombo en panel acústico de PET 9 mm, soportería metálica, melamina ABS, bio…", precio: 16080, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-22776', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 3, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo linea App LT 3 usuarios", medidas: '3600 × 600 mm', material: "cubiertas en melamina canto ABS, biombo en panel acústico de PET 9 mm, soportería metálica, melamina ABS, bio…", precio: 22776, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-23928', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 8, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo linea App LT 8 usuarios", medidas: '4200 × 1200 mm', material: "cubiertas en melamina canto ABS, biombo en panel acústico de PET 9 mm, soportería metálica, melamina ABS, bio…", precio: 23928, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-25980', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 4, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo , tipo applt 4 usuarios, bases metal, cubiertas, biomb…", medidas: '3000 × 1200 mm', material: "bases metal, melamina ABS, conducto metálico, melamina canto ABS, biombo frontal, biombos laterales", precio: 25980, fuente: '225080025' },
  { id: 'p9-app-lt-modulo-operativo-36260', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 6, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo , tipo applt 6 usuarios, bases metal, cubiertas, biomb…", medidas: '4500 × 1200 mm', material: "bases metal, melamina ABS, conducto metálico, melamina canto ABS, biombos frontales, biombos laterales", precio: 36260, fuente: '225080025' },
  { id: 'p9-rio-modulo-operativo-15132', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'Río', usuarios: 2, nombre: "Río · Módulo operativo", descripcion: "Módulo operativo , modelo Rio , 2 usuarios, cubiertas en melamina abs,…", medidas: '3000 × 600 mm', material: "melamina canto ABS, biombo panel acústico PET 9 mm, faldón multiperforado metálico, estructura metálica, biom…", precio: 15132, fuente: '226060050' },
  { id: 'p9-rio-modulo-operativo-37230', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'Río', usuarios: 8, nombre: "Río · Módulo operativo", descripcion: "Módulo operativo , modelo Rio , 8 usuarios, cubiertas en melamina abs,…", medidas: '4800 × 1200 mm', material: "melamina canto ABS, biombo panel acústico PET 9 mm, estructura metálica, biombo gris, biombos", precio: 37230, fuente: '226060050' },
  { id: 'p9-app-lt-escritorio-950', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', nombre: "App LT · Escritorio", descripcion: "Conducto faldon para escritorio modelo apps lt con melamina canto abs;…", medidas: '900 × 177 × 379 mm', material: "melamina, canto ABS, metalico", precio: 950, fuente: '225120019', clave: 'ATFAL150ABS' },
  { id: 'p9-app-lt-escritorio-1340', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', nombre: "App LT · Escritorio", descripcion: "Conducto faldon para escritorio modelo apps lt", medidas: '1200 × 177 × 379 mm', material: "melamina, canto ABS, metalico", precio: 1340, fuente: '225120019', clave: 'ATFAL18ABS' },
  { id: 'p9-app-lt-escritorio-8660', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Escritorio", descripcion: "Modulo mesa , 1 usuario, modelo ap lt, cubierta en melamina cantos abs,…", medidas: '2100 × 750 mm', material: "melamina cantos ABS, estructura metálica, patas tipo U metálicas, conducto, faldón en ABS", precio: 8660, fuente: '226030134' },
  { id: 'p9-app-lt-escritorio-directivo-12600', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Escritorio directivo", descripcion: "Modulo directivo , 1 usuario, modelo App LT; cubiertas en melamina abs,…", medidas: '1800 × 2400 mm', material: "melamina ABS, estructura metálica, patas tipo U, con faldón, melamina canto ABS, conducto faldón en melamina …", precio: 12600, fuente: '225080025', clave: 'TATD11824AB001' },
  { id: 'p9-app-lt-escritorio-gerencial-7536', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Escritorio gerencial", descripcion: "Modulo gerente linea App LT 1 usuario", medidas: '1500 × 1500 mm', material: "cubiertas en melamina canto ABS, soportería metálica, melamina ABS", precio: 7536, fuente: '226030018' },
  { id: 'p9-app-lt-escritorio-gerencial-7620', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Escritorio gerencial", descripcion: "Modulo gerente , 1 usuario; escritorio en \"l\" modelo App LT; cubiertas…", medidas: '1500 × 1500 mm', material: "melamina ABS, estructura metálica, patas tipo U, con faldón, cantos ABS", precio: 7620, fuente: '226050047' },
  { id: 'p9-app-lt-escritorio-gerencial-7780', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Escritorio gerencial", descripcion: "Modulo gerente , 1 usuarios tipo App LT; cubierta en melamina abs patas…", medidas: '1800 × 750 mm', material: "melamina ABS, patas tipo U, estructura metálica, con faldón, melamina canto ABS, conducto faldón ABS metal", precio: 7780, fuente: '225080025', clave: 'TATG11875ABF00001' },
  { id: 'p9-app-lt-escritorio-gerencial-10506', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Escritorio gerencial", descripcion: "Modulo gerente linea App LT 1 usuario", medidas: '1800 × 1800 mm', material: "cubiertas en melamina canto ABS, soportería metálica, melamina ABS", precio: 10506, fuente: '226030018' },
  { id: 'p9-app-lt-escritorio-gerencial-11570', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1, nombre: "App LT · Escritorio gerencial", descripcion: "Modulo gerente , 1 usuario; escritorio en \"l\" modelo App LT; cubiertas…", medidas: '1800 × 1800 mm', material: "melamina ABS, estructura metálica, patas tipo U, con faldón, cantos ABS", precio: 11570, fuente: '226050047' },
  { id: 'p9-accents-mesa-circular-2510', categoria: 'Mesas de juntas', tipo: 'mesa', linea: 'Accents', nombre: "Accents · Mesa circular", descripcion: "Mesa circular de ø 600 x 400 mm modelo Accents con estructura metalica", medidas: '600 × 600 × 400 mm', material: "estructura metálica, melamina canto ABS", precio: 2510, fuente: '226030134', clave: 'ACMCC2ABS' },
  { id: 'p9-accents-mesa-circular-4700', categoria: 'Mesas de juntas', tipo: 'mesa', linea: 'Accents', nombre: "Accents · Mesa circular", descripcion: "Mesa circular de ø 600 x 398 mm modelo Accents con estructura metalica", medidas: '600 × 600 × 398 mm', material: "estructura metálica, cristal satinado 9 mm, cristal satinado", precio: 4700, fuente: '225080025', clave: 'ACMC60-CSC60' },
  { id: 'p9-app-mesa-de-juntas-20100', categoria: 'Mesas de juntas', tipo: 'mesa', linea: 'App', usuarios: 8, nombre: "App · Mesa de juntas", descripcion: "Modulo mesa de juntas 8 usuarios", medidas: '2400 × 1200 mm', material: "cubiertas melamina ABS, conducto metal, conducto metálico", precio: 20100, fuente: '226020037', clave: 'TAPS82412BF6766' },
  { id: 'p9-app-lt-mesa-circular-5280', categoria: 'Mesas de juntas', tipo: 'mesa', linea: 'App LT', nombre: "App LT · Mesa circular", descripcion: "Modulo mesa , cubierta circular en melamina cantos abs , modelo App LT…", medidas: '900 × 900 mm', material: "cubierta circular melamina cantos ABS, base metálica, base OCTA-BACU70 modelo BESPOKE", precio: 5280, fuente: '226020037', clave: 'ATCUMJC3ABSOPG' },
  { id: 'p9-app-lt-mesa-de-juntas-6860', categoria: 'Mesas de juntas', tipo: 'mesa', linea: 'App LT', usuarios: 1, nombre: "App LT · Mesa de juntas", descripcion: "Modulo gerente , 1 usuario modelo App LT; cubiertas en melamina abs; pa…", medidas: '1500 × 750 mm', material: "melamina ABS, patas tipo U, estructura metálica, melamina canto ABS", precio: 6860, fuente: '225080025', clave: 'TATG1158AB0001' },
  { id: 'p9-app-lt-mesa-de-juntas-7870', categoria: 'Mesas de juntas', tipo: 'mesa', linea: 'App LT', usuarios: 8, nombre: "App LT · Mesa de juntas", descripcion: "Modulo de juntas , tipo applt 8 usuarios, bases metal, cubiertas melami…", medidas: '2400 × 1200 mm', material: "bases metal, melamina ABS, melamina canto ABS", precio: 7870, fuente: '225080025' },
  { id: 'p9-mesa-de-juntas-4260', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 4, nombre: "Mesa de juntas", descripcion: "Modulo mesa de juntas 4 usuarios", medidas: '900 × 900 mm', material: "cubierta melamina ABS", precio: 4260, fuente: '226020037' },
  { id: 'p9-mesa-de-juntas-4320', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 4, nombre: "Mesa de juntas", descripcion: "Modulo mesa de juntas 4 usuarios", medidas: '1200 × 1200 mm', material: "bases metal, cubiertas melamina ABS", precio: 4320, fuente: '226020037', clave: 'ALS41212BH7481' },
  { id: 'p9-mesa-de-juntas-5510', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 4, nombre: "Mesa de juntas", descripcion: "Modulo mesa de juntas 4 usuarios", medidas: '1200 × 1200 mm', material: "bases metal, melamina ABS, melamina canto ABS", precio: 5510, fuente: '225080025', clave: 'ALS41212BH7481' },
  { id: 'p9-accents-gaveta-1690', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Accents', nombre: "Accents · Gaveta", descripcion: "Organizador rodante modelo Accents; metalico", medidas: '242 × 568 × 414 mm', material: "metálico, rodajas", precio: 1690, fuente: '226030134', clave: 'ACGBCR' },
  { id: 'p9-cirque-archivero-7450', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Cirque', nombre: "Cirque · Archivero", descripcion: "Archivero suspendido con 2 puertas verticales y librero modelo Cirque c…", medidas: '1050 × 400 × 600 mm', material: "melamina canto ABS, cerradura, 2 jaladeras", precio: 7450, fuente: '226030134', clave: 'CIARS2PL105ABS' },
  { id: 'p9-ergonova-4-mesa-alta-barra-ergonov-1500', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Ergonova 4', nombre: "Ergonova 4 · Mesa alta / barra · ERGONOVA", descripcion: "Pedestal curvo con 2 niveladores de 870 mm modelo Ergonova metalico", medidas: '870 mm', material: "metalico, 2 niveladores", precio: 1500, fuente: '225120019', clave: 'EREPED02150106' },
  { id: 'p9-ergonova-4-modulo-guarda-ergonova-330', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Ergonova 4', nombre: "Ergonova 4 · Módulo guarda · ERGONOVA", descripcion: "Porta cpu vertical con base rodante modelo Ergonova", medidas: '240 × 300 × 190 mm', material: "metálico", precio: 330, fuente: '226020037', clave: 'BCPU' },
  { id: 'p9-ergonova-4-recepcion-14859', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Ergonova 4', usuarios: 1, nombre: "Ergonova 4 · Recepción", descripcion: "Modulo recepcion linea Ergonova 4 1 usuario", medidas: '1520 × 840 mm', material: "cubiertas en melamina canto ABS, soportería y estructuras metálicas, gajos metálicos, cuerpo de gaveta metáli…", precio: 14859, fuente: '226030018' },
  { id: 'p9-ergonova-4-recepcion-16585', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Ergonova 4', usuarios: 1, nombre: "Ergonova 4 · Recepción", descripcion: "Modulo recepcion 1 usuario", medidas: '1815 × 834 mm', material: "estructura metálica, melamina ABS, gajos (caras) en lámina, gavetas cuerpo en lámina, frentes en ABS, gavetas…", precio: 16585, fuente: '226030134', clave: 'E4R1188BAAA7371' },
  { id: 'p9-modulor-archivero-7230', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Modulor', nombre: "Modulor · Archivero", descripcion: "Archivero con 2 puertas verticales y 1 entrepaño modelo Modulor con cer…", medidas: '900 × 420 × 750 mm', material: "melamina canto ABS, metálico, cerradura, cubierta", precio: 7230, fuente: '226030134', clave: 'MDAPCU3ABS' },
  { id: 'p9-modulor-archivero-registro-lateral-9460', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Modulor', nombre: "Modulor · Archivero registro lateral", descripcion: "Archivero registro lateral con 2 cajones y 1 entrepaño modelo Modulor", medidas: '1200 × 448 × 582 mm', material: "metálico, frentes en melamina canto ABS, jaladeras, cerradura", precio: 9460, fuente: '226060050' },
  { id: 'p9-modulor-archivero-registro-lateral-10272', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Modulor', nombre: "Modulor · Archivero registro lateral", descripcion: "Archivero registro lateral con 2 cajones y 1 entrepaño modelo Modulor", medidas: '1200 × 448 × 582 mm', material: "cuerpo metálico, frentes en melamina con canto ABS, melamina canto ABS (frentes), cajón papelero, cajón archi…", precio: 10272, fuente: '226010047', clave: 'MOGARC56N51343' },
  { id: 'p9-modulor-credenza-13040', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Modulor', nombre: "Modulor · Credenza", descripcion: "Credenza con 4 puertas verticales y 2 entrepaños modelo Modulor", medidas: '1800 × 750 mm', material: "cubierta y puertas en melamina canto ABS, metálica, 2 entrepaños, jaladeras, cerraduras", precio: 13040, fuente: '226020037', clave: 'MOAPDCU6ABS' },
  { id: 'p9-modulor-credenza-16050', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Modulor', nombre: "Modulor · Credenza", descripcion: "Credenza con 4 puertas verticales y 2 entrepaños modelo Modulor", medidas: '1800 × 750 mm', material: "melamina canto ABS, metálica, melamina ABS, jaladeras, cerraduras", precio: 16050, fuente: '225080025', clave: 'MOAPDCU6ABS' },
  { id: 'p9-modulor-gaveta-9460', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Modulor', nombre: "Modulor · Gaveta", descripcion: "Archivero registro lateral con 2 cajones y 1 entrepaño modelo Modulor", medidas: '1200 × 448 × 582 mm', material: "metálico, frentes en melamina canto ABS, cojín tapizado en tela sobre gaveta, cojín tapizado sobre gaveta, ja…", precio: 9460, fuente: '226060050' },
  { id: 'p9-mox-gaveta-pedestal-3780', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Mox', nombre: "Mox · Gaveta pedestal", descripcion: "Gaveta pedestal con 1 cajon archivero y 2 cajones papeleros modelo Mox…", medidas: '380 × 455 × 720 mm', material: "metalica, 3 jaladeras, cerradura", precio: 3780, fuente: '225120019', clave: 'MOXGAP3FL' },
  { id: 'p9-mox-gaveta-rodante-3160', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Mox', usuarios: 1, nombre: "Mox · Gaveta rodante", descripcion: "Gaveta rodante con 1 cajon archivero y 1 cajon papelero modelo Mox con…", medidas: '380 × 580 × 460 mm', material: "melamina, metálica, frentes planos, tapa en melamina, cantos ABS, 1 cajón archivero, 1 cajón papelero", precio: 3160, fuente: '226050047' },
  { id: 'p9-mox-gaveta-rodante-3210', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Mox', nombre: "Mox · Gaveta rodante", descripcion: "Gaveta rodante con 1 cajon archivero y 1 papelero linea Mox", medidas: '380 × 460 × 580 mm', material: "cuerpo metálico, frentes y tapa en melamina canto ABS, melamina ABS, jaladeras, cerradura, ruedas", precio: 3210, fuente: '226030018' },
  { id: 'p9-mox-gaveta-rodante-3220', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Mox', usuarios: 1, nombre: "Mox · Gaveta rodante", descripcion: "Gaveta rodante con 1 cajon archivero y 1 cajon papelero modelo Mox con…", medidas: '380 × 580 × 460 mm', material: "melamina cantos ABS, metálica, melamina ABS, jaladeras, cerradura", precio: 3220, fuente: '225080025', clave: 'MOXGAR2FMTM' },
  { id: 'p9-mox-gaveta-rodante-3470', categoria: 'Guardas y archivo', tipo: 'guarda', linea: 'Mox', nombre: "Mox · Gaveta rodante", descripcion: "Gaveta rodante con 1 cajon archivero y 1 cajon papelero modelo Mox con…", medidas: '380 × 600 × 460 mm', material: "metálica, frentes planos melamina canto ABS, cojín tapizado en tela, 2 jaladeras, cerradura, cojín tapizado", precio: 3470, fuente: '226060050' },
  { id: 'p9-archivero-7722', categoria: 'Guardas y archivo', tipo: 'guarda', nombre: "Archivero", descripcion: "Archivero con 2 puertas verticales y 1 entrepaño", medidas: '750 × 420 × 750 mm', material: "cuerpo metálico, frente y cubierta en melamina canto ABS, melamina ABS, cerradura, 1 entrepaño", precio: 7722, fuente: '226030018' },
  { id: 'p9-archivero-8670', categoria: 'Guardas y archivo', tipo: 'guarda', nombre: "Archivero", descripcion: "Archivero con 2 puertas verticales y 1 entrepaño", medidas: '900 × 420 × 750 mm', material: "cuerpo metálico, frente y cubierta en melamina canto ABS, melamina ABS, cerradura, 1 entrepaño", precio: 8670, fuente: '226030018' },
  { id: 'p9-archivero-12160', categoria: 'Guardas y archivo', tipo: 'guarda', nombre: "Archivero", descripcion: "Gabinete fijo con 2 puertas verticales y 5 entrepaños puertas planas co…", medidas: '900 × 450 × 1800 mm', material: "melamina canto ABS, metálico, cerradura, jaladeras curvas, puertas planas", precio: 12160, fuente: '226030134', clave: 'GAMPM36ABS' },
  { id: 'p9-archivero-13230', categoria: 'Guardas y archivo', tipo: 'guarda', usuarios: 1, nombre: "Archivero", descripcion: "Modulo guarda 1 usuario", medidas: '1800 × 450 mm', material: "melamina canto ABS, archivero cuerpo en lámina, frentes en ABS, librero metálico, melamina ABS, archivero, li…", precio: 13230, fuente: '225080025' },
  { id: 'p9-archivero-13340', categoria: 'Guardas y archivo', tipo: 'guarda', usuarios: 1, nombre: "Archivero", descripcion: "Modulo guarda 1 usuario", medidas: '1500 × 447 mm', material: "melamina canto ABS, archiveros cuerpo en lámina, frentes en ABS, archiveros", precio: 13340, fuente: '226060050' },
  { id: 'p9-gabinete-13040', categoria: 'Guardas y archivo', tipo: 'guarda', usuarios: 1, nombre: "Gabinete", descripcion: "Modulo guarda 1 usuario", medidas: '627 × 560 mm', material: "melamina canto ABS, cuerpo metálico, melamina ABS", precio: 13040, fuente: '225080025', clave: 'MOA166BA6671' },
  { id: 'p9-gabinete-14150', categoria: 'Guardas y archivo', tipo: 'guarda', usuarios: 1, nombre: "Gabinete", descripcion: "Modulo guarda 1 usuario", medidas: '627 × 560 mm', material: "melamina canto ABS, cuerpo metálico, melamina ABS", precio: 14150, fuente: '225080025', clave: 'MOA166BA6675' },
  { id: 'p9-gabinete-18860', categoria: 'Guardas y archivo', tipo: 'guarda', nombre: "Gabinete", descripcion: "Gabinete fijo con 2 puertas verticales", medidas: '900 × 488 × 1828 mm', material: "melamina canto ABS, 2 entrepaños, 2 cajones inferiores, cerraduras, jaladeras curvas", precio: 18860, fuente: '226020037', clave: 'GAB36ABS2E' },
  { id: 'p9-gabinete-19920', categoria: 'Guardas y archivo', tipo: 'guarda', nombre: "Gabinete", descripcion: "Gabinete fijo con 2 puertas verticales y 4 entrepaños", medidas: '900 × 600 × 1780 mm', material: "melamina, canto ABS, 2 puertas verticales, 4 entrepanos", precio: 19920, fuente: '225120019', clave: 'LEGCAB08060099' },
  { id: 'p9-gaveta-rodante-3210', categoria: 'Guardas y archivo', tipo: 'guarda', nombre: "Gaveta rodante", descripcion: "Gaveta rodante con 1 cajon archivero y 1 cajon papelero", medidas: '380 × 460 × 580 mm', material: "cuerpo metálico, frentes y tapa en melamina canto ABS, melamina ABS, jaladeras, cerradura, ruedas", precio: 3210, fuente: '226030018' },
  { id: 'p9-librero-16770', categoria: 'Guardas y archivo', tipo: 'guarda', nombre: "Librero", descripcion: "Librero fijo con 4 entrepaños cuerpo y entrepaños", medidas: '900 × 450 × 1850 mm', material: "melamina canto ABS", precio: 16770, fuente: '226030134', clave: 'LIB36ABS' },
  { id: 'p9-locker-pmd160-13710', categoria: 'Guardas y archivo', tipo: 'guarda', usuarios: 5, nombre: "Locker · PMD160", descripcion: "Locker de 5 puertas con jaladera y cerradura electronica . cuerpo y pue…", medidas: '450 × 450 × 1800 mm', material: "tablero melamínico 19 mm, jaladera, cerradura electrónica Philips PMD160", precio: 13710, fuente: '226020037' },
  { id: 'p9-recepcion-29920', categoria: 'Guardas y archivo', tipo: 'guarda', usuarios: 2, nombre: "Recepción", descripcion: "Modulo recepcion 2 usuario", medidas: '2420 × 830 mm', material: "estructura metálica, melamina ABS, gajos (caras) en tela, gavetas cuerpo en lámina, frentes en ABS, tela, gav…", precio: 29920, fuente: '225080025', clave: 'TER42248ABD001' },
  { id: 'p9-accents-cubierta-7210', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Accents', nombre: "Accents · Cubierta", descripcion: "Mesa cuadrada modelo Accents", medidas: '600 × 600 × 400 mm', material: "cristal satinado 9 mm, estructura metálica", precio: 7210, fuente: '226060050' },
  { id: 'p9-alba-cubierta-4730', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Alba', usuarios: 2, nombre: "Alba · Cubierta", descripcion: "Modulo mesa 2 usuarios", medidas: '900 × 900 mm', material: "melamina canto ABS, bases ALBA", precio: 4730, fuente: '226060050' },
  { id: 'p9-alba-mesa-alta-barra-5170', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Alba', usuarios: 4, nombre: "Alba · Mesa alta / barra", descripcion: "Modulo mesa alta , 4 usuarios, modelo Alba, cubierta cuadrada ondulada…", medidas: '1200 × 1200 mm', material: "cubierta cuadrada ondulada melamina cantos ABS, estructura metálica, patas ALBA ABPATA90M", precio: 5170, fuente: '226020037', clave: 'ABPATA90M' },
  { id: 'p9-app-pata-3360', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'App', usuarios: 1, nombre: "App · Pata", descripcion: "Modulo mesa , 1 usuario; modelo App; cubierta en melamina canto abs (op…", medidas: '1500 × 600 mm', material: "melamina, canto ABS, estructura metalica, pata tubular con rodaja, OPG", precio: 3360, fuente: '225120019', clave: 'TAPG1156AB001' },
  { id: 'p9-app-lt-biombo-1550', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'App LT', nombre: "App LT · Biombo", descripcion: "Biombo divisor modelo apps lt con soportes", medidas: '580 × 39 × 400 mm', material: "cristal transparente 6 mm templado, cantos pulidos, cristal transparente, soportes", precio: 1550, fuente: '225120019', clave: 'ATBIOCRTRA580' },
  { id: 'p9-app-lt-cubierta-5700', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'App LT', usuarios: 1, nombre: "App LT · Cubierta", descripcion: "Modulo varios 1 usuarios", medidas: '1800 × 900 mm', material: "melamina ABS, estructura metálica, melamina canto ABS", precio: 5700, fuente: '225080025', clave: 'TATV1189AB0001' },
  { id: 'p9-eclipse-producto-37370', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Eclipse', nombre: "Eclipse · Producto", descripcion: "Direccion - opcion 2 (Eclipse)", precio: 37370, fuente: '226030134' },
  { id: 'p9-ergonova-4-pata-4250', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Ergonova 4', usuarios: 1, nombre: "Ergonova 4 · Pata", descripcion: "Modulo mesa , 1 usuario, modelo App; cubierta en melamina cantos abs; 2…", medidas: '1200 × 600 mm', material: "cubierta melamina cantos ABS, estructura metálica, 2 patas universales E4PU720ES, 2 patas con rodaja CIPRF720", precio: 4250, fuente: '226020037' },
  { id: 'p9-pebble-mesa-de-centro-1090', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Pebble', nombre: "Pebble · Mesa de centro", descripcion: "Módulo mesa de centro ovoide tipo pebbles", material: "melamina ABS, estructura metálica, cantos ABS", precio: 1090, fuente: '226050047' },
  { id: 'p9-pebble-mesa-de-centro-2830', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Pebble', nombre: "Pebble · Mesa de centro", descripcion: "Mesa de centro tipo pebbles", material: "cristal satinado, estructura metálica", precio: 2830, fuente: '226060050' },
  { id: 'p9-work-lounge-cubierta-work-1804', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Work Lounge', usuarios: 1, nombre: "Work Lounge · Cubierta · WORK", descripcion: "Modulo mesa auxiliar ; 1 usuario; modelo Work Lounge; cubierta cuadrada…", medidas: '600 × 400 × 450 mm', material: "melamina cantos ABS, base metálica, base WLSPME2475-EST", precio: 1804, fuente: '226020037', clave: 'TWL164AB1' },
  { id: 'p9-work-lounge-mesa-de-apoyo-work-1686', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Work Lounge', nombre: "Work Lounge · Mesa de apoyo · WORK", descripcion: "Mesa de apoyo modelo Work Lounge", medidas: '450 × 330 × 657 mm', material: "metálica", precio: 1686, fuente: '226060050' },
  { id: 'p9-work-lounge-mesa-de-apoyo-work-1686-75', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Work Lounge', nombre: "Work Lounge · Mesa de apoyo · WORK", descripcion: "Mesa de apoyo modelo Work Lounge", medidas: '450 × 657 × 330 mm', material: "metálica", precio: 1686, fuente: '226020037', clave: 'WLMAM' },
  { id: 'p9-work-lounge-mesa-de-centro-work-2550', categoria: 'Mesas y complementos', tipo: 'mesa', linea: 'Work Lounge', nombre: "Work Lounge · Mesa de centro · WORK", descripcion: "Módulo mesa de centro", medidas: '900 × 600 mm', material: "melamina ABS, estructura metálica, cantos ABS", precio: 2550, fuente: '226050047' },
  { id: 'p9-banco-bancos-4100', categoria: 'Mesas y complementos', tipo: 'mesa', nombre: "Banco · BANCOS", descripcion: "Porta impresora bajo cubierta modelo bancos doble con entrepaño en mela…", medidas: '540 × 450 × 868 mm', material: "melamina, canto ABS, metalica, entrepano", precio: 4100, fuente: '225120019', clave: 'BADPIM01010022' },
  { id: 'p9-cabina-telefonica-68900', categoria: 'Mesas y complementos', tipo: 'mesa', usuarios: 1, nombre: "Cabina telefónica", descripcion: "Cabina telefónica , con estrcutura metálica resistente con marcos en tu…", medidas: '1000 × 1000 × 2226 mm', material: "estructura metálica marcos tubo 2\" cal 18, lámina cal. 18, cristal 9 mm, acabados acústicos en PET, piso alfo…", precio: 68900, fuente: '226060050' },
  { id: 'p9-mesa-alta-barra-8320', categoria: 'Mesas y complementos', tipo: 'mesa', usuarios: 4, nombre: "Mesa alta / barra", descripcion: "Modulo varios 4 usuarios", medidas: '2401 × 400 mm', material: "estructura metálica, cubierta melamina canto ABS", precio: 8320, fuente: '226020037', clave: 'CIV4244B7008' },
  { id: 'p9-mesa-alta-barra-12140', categoria: 'Mesas y complementos', tipo: 'mesa', nombre: "Mesa alta / barra", descripcion: "Mesa para exterior - interior", medidas: '680 × 680 × 1100 mm', material: "cubierta compact, base NEMO, blanco", precio: 12140, fuente: '226060050' },
  { id: 'p9-mesa-de-apoyo-1250', categoria: 'Mesas y complementos', tipo: 'mesa', nombre: "Mesa de apoyo", descripcion: "Mesa de apoyo para uso interior", material: "fibra de vidrio, PP (polipropileno) inyectado, protección UV", precio: 1250, fuente: '226030134' },
  { id: 'p9-producto-1960', categoria: 'Mesas y complementos', tipo: 'mesa', nombre: "Producto", descripcion: "Maneja cables en forma de espiral diametro 5-7/8\"", material: "negro", precio: 1960, fuente: '226020037', clave: 'MACAWM34-90' },
  { id: 'p9-producto-2275', categoria: 'Mesas y complementos', tipo: 'mesa', nombre: "Producto", descripcion: "Porta monitor articulado de 10\" hasta 27\" en aluminio", material: "aluminio", precio: 2275, fuente: '226060050' },
  { id: 'p9-producto-team-2720', categoria: 'Mesas y complementos', tipo: 'mesa', nombre: "Producto · TEAM", descripcion: "Pizarron movil modelo team space con rodajas", medidas: '808 × 1777 mm', material: "laminado plástico Market Grade, metálico, rodajas, moldura para plumón, blanco", precio: 2720, fuente: '226060050' },
  { id: 'p9-producto-team-14290', categoria: 'Mesas y complementos', tipo: 'mesa', nombre: "Producto · TEAM", descripcion: "Porta pantalla movil rodante modelo team space", medidas: '1280 × 890 × 1625 mm', material: "metálico, rodante", precio: 14290, fuente: '226060050' },
  { id: 'p9-app-escritorio-gerencial-21750', categoria: 'Escritorios', tipo: 'especial', linea: 'App', usuarios: 1, nombre: "App · Escritorio gerencial", descripcion: "Modulo gerente 1 usuario; modelo App; cubiertas en melamina abs", medidas: '1800 × 1500 mm', material: "melamina canto ABS, archiveros cuerpo en lámina, frentes en melamina ABS, estructura metálica, caja eléctrica…", precio: 21750, fuente: '226060050' },
  { id: 'p9-app-mesa-de-juntas-21350', categoria: 'Mesas de juntas', tipo: 'especial', linea: 'App', usuarios: 6, nombre: "App · Mesa de juntas", descripcion: "Modulo mesa de juntas", medidas: '1800 × 900 mm', material: "cubierta melamina canto ABS, estructura metálica, caja eléctrica BE01820M24Z01U572, organizador vertical en e…", precio: 21350, fuente: '226020037', clave: 'TAPS6189AB02' },
  { id: 'p9-app-mesa-de-juntas-31340', categoria: 'Mesas de juntas', tipo: 'especial', linea: 'App', usuarios: 10, nombre: "App · Mesa de juntas", descripcion: "Modulo mesa de juntas ; 10 usuarios; modelo App; cubiertas melamina can…", medidas: '2400 × 1500 mm', material: "cubiertas melamina canto ABS, 2 cajas eléctricas E2X (BE02511E2X33Z0872), acometida (CIDUAPED), pata universal", precio: 31340, fuente: '226020037', clave: 'TAPS102415ABCA01' },
  { id: 'p9-app-lt-bench-doble-4840', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Bench doble", descripcion: "Cubierta cuadrada modelo apps lt", medidas: '1200 × 1200 mm', material: "melamina, canto ABS, caja electrica \"LUM-LIS-N\" al centro", precio: 4840, fuente: '225120019', clave: 'ATCUMJ44ABSLISN' },
  { id: 'p9-app-lt-bench-doble-10596', categoria: 'Operativos / Bench', tipo: 'especial', linea: 'App LT', usuarios: 2, nombre: "App LT · Bench doble", descripcion: "Modulo operativo , 2 usuarios; (bench doble) modelo App LT; cubiertas e…", medidas: '1500 × 1200 mm', material: "cubiertas en melamina ABS, estructura metálica, patas tipo U, cristal transparente 6 mm (biombo), melamina AB…", precio: 10596, fuente: '226010047', clave: 'TATO21512ABCT01' },
  { id: 'p9-app-lt-bench-doble-17600', categoria: 'Operativos / Bench', tipo: 'especial', linea: 'App LT', usuarios: 6, nombre: "App LT · Bench doble", descripcion: "Modulo operativo , 6 usuarios; (bench doble) modelo App LT; cubiertas e…", medidas: '3600 × 1200 mm', material: "melamina ABS, estructura metálica, patas tipo U, cristal transparente 6 mm, biombo divisor sobre cubierta en …", precio: 17600, fuente: '226030134', clave: 'TATO63612ABCRT01' },
  { id: 'p9-app-lt-bench-doble-23340', categoria: 'Operativos / Bench', tipo: 'especial', linea: 'App LT', usuarios: 8, nombre: "App LT · Bench doble", descripcion: "Modulo operativo , 8 usuarios; (bench doble) modelo App LT; cubiertas e…", medidas: '4800 × 1200 mm', material: "melamina ABS, estructura metálica, patas tipo U, cristal transparente, biombo divisor sobre cubierta en crist…", precio: 23340, fuente: '226030134', clave: 'TATO84812ABCT01' },
  { id: 'p9-app-lt-escritorio-gerencial-5140', categoria: 'Escritorios', tipo: 'especial', linea: 'App LT', usuarios: 1, nombre: "App LT · Escritorio gerencial", descripcion: "Modulo gerencial App LT de 1 usuario con cubiertas en melamina", medidas: '1500 × 600 mm', material: "melamina, con faldón, estructura metálica, acometida metálica, faldón, acometida", precio: 5140, fuente: '226060050' },
  { id: 'p9-app-lt-mesa-de-juntas-13780', categoria: 'Mesas de juntas', tipo: 'especial', linea: 'App LT', usuarios: 8, nombre: "App LT · Mesa de juntas", descripcion: "Módulo mesa de juntas", medidas: '2400 × 1200 mm', material: "melamina ABS, estructura metálica, cantos ABS, caja eléctrica color negro, caja eléctrica LUM-LIS-N (color ne…", precio: 13780, fuente: '226050047' },
  { id: 'p9-app-lt-mesa-de-juntas-16408', categoria: 'Mesas de juntas', tipo: 'especial', linea: 'App LT', usuarios: 8, nombre: "App LT · Mesa de juntas", descripcion: "Modulo mesa de juntas linea App LT 8 usuarios", medidas: '2400 × 1200 mm', material: "cubiertas en melamina canto ABS, soportería metálica, melamina ABS, cajas eléctricas en color negro, 2 cajas …", precio: 16408, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-1818', categoria: 'Electrificación', tipo: 'especial', linea: 'App LT', usuarios: 1, nombre: "App LT · Sistema eléctrico (1 usuario)", descripcion: "Incluye 1 contacto doble corriente regulada y 1 contacto doble corrient…", material: "1 contacto doble corriente regulada por usuario, 1 contacto doble corriente normal por usuario", precio: 1818, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-2538', categoria: 'Electrificación', tipo: 'especial', linea: 'App LT', usuarios: 2, nombre: "App LT · Sistema eléctrico (2 usuarios)", descripcion: "Incluye 1 contacto doble corriente regulada y 1 contacto doble corrient…", material: "1 contacto doble corriente regulada por usuario, 1 contacto doble corriente normal por usuario", precio: 2538, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-3138', categoria: 'Electrificación', tipo: 'especial', linea: 'App LT', usuarios: 4, nombre: "App LT · Sistema eléctrico (4 usuarios)", descripcion: "Incluye 1 contacto doble corriente regulada y 1 contacto doble corrient…", material: "1 contacto doble corriente regulada por usuario, 1 contacto doble corriente normal por usuario", precio: 3138, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-3258', categoria: 'Electrificación', tipo: 'especial', linea: 'App LT', usuarios: 3, nombre: "App LT · Sistema eléctrico (3 usuarios)", descripcion: "Incluye 1 contacto doble corriente regulada y 1 contacto doble corrient…", material: "1 contacto doble corriente regulada por usuario, 1 contacto doble corriente normal por usuario", precio: 3258, fuente: '226030018' },
  { id: 'p9-app-lt-modulo-operativo-5178', categoria: 'Electrificación', tipo: 'especial', linea: 'App LT', usuarios: 8, nombre: "App LT · Sistema eléctrico (8 usuarios)", descripcion: "Incluye 1 contacto doble corriente regulada y 1 contacto doble corrient…", material: "1 contacto doble corriente regulada por usuario, 1 contacto doble corriente normal por usuario", precio: 5178, fuente: '226030018' },
  { id: 'p9-bench-doble-12238', categoria: 'Electrificación', tipo: 'especial', nombre: "Electrificación de bench dobles", descripcion: "Electrificacion para estaciones (bench dobles); incluye alimentacion me…", material: "acometida eléctrica, cajas eléctricas, contactos normales (negros), contactos regulados (naranjas), extension…", precio: 12238, fuente: '226020037' },
  { id: 'p9-bench-doble-24579', categoria: 'Electrificación', tipo: 'especial', nombre: "Electrificación de bench dobles", descripcion: "Electrificacion para estaciones (bench dobles); incluye alimentacion me…", material: "acometida eléctrica, cajas eléctricas, contactos normales (negros), contactos regulados (naranjas), extension…", precio: 24579, fuente: '226020037' },
  { id: 'p9-bench-doble-27006', categoria: 'Electrificación', tipo: 'especial', nombre: "Electrificación de bench dobles", descripcion: "Electrificacion para estaciones (bench dobles); incluye alimentacion me…", material: "acometida eléctrica, cajas eléctricas, contactos normales (negros), contactos regulados (naranjas), extension…", precio: 27006, fuente: '226020037' },
  { id: 'p9-bench-doble-51585', categoria: 'Electrificación', tipo: 'especial', nombre: "Electrificación de bench dobles", descripcion: "Electrificacion para estaciones (bench dobles); incluye alimentacion me…", material: "acometida eléctrica, cajas eléctricas, contactos normales (negros), contactos regulados (naranjas), extension…", precio: 51585, fuente: '226020037' },
  { id: 'p9-caja-electrica-be03359-1-1-dzc-m1-3165', categoria: 'Electrificación', tipo: 'especial', nombre: "Caja eléctrica · BE03359-1-1-DZC-M1-", descripcion: "Caja electrica con 2 puertos usb y luz modelo be03359-1-1-dzc-m1-72 met…", material: "metallic silver", precio: 3165, fuente: '226020037', clave: 'BE0335911DZCM172' },
  { id: 'p9-modulo-operativo-3537', categoria: 'Electrificación', tipo: 'especial', usuarios: 2, nombre: "Kit de electrificación (2 usuarios)", descripcion: "Juego de accesorios para electrificar módulo operativo de 2 usuarios", material: "contactos, extensiones, cajas eléctricas para contactos, conectores", precio: 3537, fuente: '226060050' },
  { id: 'p9-modulo-operativo-6578', categoria: 'Electrificación', tipo: 'especial', usuarios: 6, nombre: "Kit de electrificación (6 usuarios)", descripcion: "Juego de accesorios para electrificar banca operativa 6 suarios (acomet…", material: "acometida, cajas, contactos, extensiones", precio: 6578, fuente: '226050047' },
  { id: 'p9-modulo-operativo-8632', categoria: 'Electrificación', tipo: 'especial', usuarios: 8, nombre: "Kit de electrificación (8 usuarios)", descripcion: "Juego de accesorios para electrificar módulo operativo de 8 usuarios", material: "contactos, extensiones, cajas eléctricas para contactos, conectores", precio: 8632, fuente: '226060050' },
  { id: 'p9-sistema-electrico-46484', categoria: 'Electrificación', tipo: 'especial', nombre: "Sistema eléctrico", descripcion: "Sistema de electrificacion de modulos ; mediante acometids electricas", material: "acometidas eléctricas, cajas eléctricas, contactos normales, contactos regulados, extensiones eléctricas", precio: 46484, fuente: '226030134' },
  { id: 'p9-app-modulo-operativo-18100', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App', usuarios: 2, nombre: "App · Módulo operativo", descripcion: "Modulo operativo de 2 usuarios 1600 x 1482 mm", medidas: '1600 × 1482 mm', material: "cubiertas melamina ABS, estructura metálica, semimampara en serigrafiado puntos blancos, acometida, semimampa…", precio: 18100, fuente: '226020037', clave: 'TAPO21615ABSS01' },
  { id: 'p9-app-modulo-operativo-34410', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App', usuarios: 4, nombre: "App · Módulo operativo", descripcion: "Modulo operativo de 4 usuarios 3200 x 1482 mm", medidas: '3200 × 1482 mm', material: "cubiertas melamina ABS, estructura metálica, semimampara en serigrafiado puntos blancos, acometida, semimampa…", precio: 34410, fuente: '226020037', clave: 'TAPO43215ABSS01' },
  { id: 'p9-app-modulo-operativo-50720', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App', usuarios: 6, nombre: "App · Módulo operativo", descripcion: "Modulo operativo de 6 usuarios 4800 x 1482 mm", medidas: '4800 × 1482 mm', material: "cubiertas melamina ABS, estructura metálica, semimampara en serigrafiado puntos blancos, acometida, semimampa…", precio: 50720, fuente: '226020037', clave: 'TAPO64815ABSS01' },
  { id: 'p9-app-modulo-operativo-53810', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App', usuarios: 6, nombre: "App · Módulo operativo", descripcion: "Modulo operativo alto, 6 usuarios 4800 x 1480 mm x (1 097 mm de altura)…", medidas: '4800 × 1480 × 1097 mm', material: "cubiertas melamina ABS, estructura metálica, semimampara en serigrafiado puntos blancos, acometida, semimampa…", precio: 53810, fuente: '226020037', clave: 'TAPO64815ABSS01A' },
  { id: 'p9-app-modulo-operativo-67030', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App', usuarios: 8, nombre: "App · Módulo operativo", descripcion: "Modulo operativo de 8 usuarios 6400 x 1482 mm", medidas: '6400 × 1482 mm', material: "cubiertas melamina ABS, estructura metálica, semimampara en serigrafiado puntos blancos, acometida, semimampa…", precio: 67030, fuente: '226020037', clave: 'TAPO86415ABSS01' },
  { id: 'p9-app-modulo-operativo-83810', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App', usuarios: 10, nombre: "App · Módulo operativo", descripcion: "Modulo operativo de 10 usuarios 8000 x 1482 mm", medidas: '8000 × 1482 mm', material: "cubiertas melamina ABS, estructura metálica, semimampara en serigrafiado puntos blancos, acometida, semimampa…", precio: 83810, fuente: '226020037', clave: 'TAPO108015ABSS01' },
  { id: 'p9-app-modulo-operativo-100120', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App', usuarios: 12, nombre: "App · Módulo operativo", descripcion: "Modulo operativo de 12 usuarios 9600 x 1482 mm", medidas: '9600 × 1482 mm', material: "cubiertas melamina ABS, estructura metálica, semimampara en serigrafiado puntos blancos, acometida, semimampa…", precio: 100120, fuente: '226020037', clave: 'TAPO129615ABSS01' },
  { id: 'p9-app-lt-modulo-operativo-21020', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App LT', usuarios: 4, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo 4 usuarios", medidas: '3000 × 1200 mm', material: "melamina ABS, estructura metálica, melamina canto ABS, conducto acometida, semimamparas frontales y centrales…", precio: 21020, fuente: '225080025' },
  { id: 'p9-app-lt-modulo-operativo-22590', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App LT', usuarios: 4, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo 4 usuarios", medidas: '3000 × 1200 mm', material: "melamina ABS, estructura metálica, melamina canto ABS, conducto acometida, semimamparas frontales y centrales…", precio: 22590, fuente: '225080025' },
  { id: 'p9-app-lt-modulo-operativo-23000', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'App LT', usuarios: 4, nombre: "App LT · Módulo operativo", descripcion: "Modulo operativo 4 usuarios", medidas: '3000 × 1200 mm', material: "melamina ABS, cristal transparente templado, estructura metálica, melamina canto ABS, cristal templado transp…", precio: 23000, fuente: '225080025' },
  { id: 'p9-wand-cancel-wand-12680', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'Wand', nombre: "Wand · Cancel · WAND", descripcion: "Puerta modelo \"Wand\", derecha con cerradura y estrcutura metálica color…", medidas: '1000 × 60 × 2400 mm', material: "estructura metálica color negro, cristal transparente, color negro (estructura metálica), cerradura", precio: 12680, fuente: '226050048' },
  { id: 'p9-wand-cancel-wand-244620', categoria: 'Cancelería y muros', tipo: 'especial', linea: 'Wand', nombre: "Wand · Cancel · WAND", descripcion: "Cancel modelo \"Wand\" con cistales transparentes y estructura metálica c…", material: "estructura metálica color negro, cristales transparentes, color negro (estructura metálica), cristal transpar…", precio: 244620, fuente: '226050048' },
  { id: 'p9-app-lt-cubierta-980', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Cubierta", descripcion: "Cubierta rectangular modelo apps lt opg", medidas: '900 × 600 mm', material: "melamina, canto ABS, OPG", precio: 980, fuente: '225120019', clave: 'ATCUL32ABSOPG' },
  { id: 'p9-app-lt-cubierta-1050', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Cubierta", descripcion: "Cubierta rectangular modelo apps lt opg", medidas: '1050 × 600 mm', material: "melamina, canto ABS, OPG", precio: 1050, fuente: '225120019', clave: 'ATCUL1052ABSOPG' },
  { id: 'p9-app-lt-cubierta-1110', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Cubierta", descripcion: "Cubierta rectangular modelo apps lt opg", medidas: '1200 × 600 mm', material: "melamina, canto ABS, OPG", precio: 1110, fuente: '225120019', clave: 'ATCE42ABSOPG' },
  { id: 'p9-app-lt-cubierta-1860', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Cubierta", descripcion: "Cubierta rectangular modelo apps lt opg", medidas: '1500 × 600 mm', material: "melamina, canto ABS, OPG", precio: 1860, fuente: '225120019', clave: 'ATCE52ABSOPG' },
  { id: 'p9-app-lt-cubierta-3950', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Cubierta", descripcion: "Cubierta rectangular modelo apps lt opg; en melamina canto abs", medidas: '1800 × 750 mm', material: "melamina, canto ABS, OPG", precio: 3950, fuente: '225120019', clave: 'ATCE675ABSOPG' },
  { id: 'p9-app-lt-omega-200', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Omega", descripcion: "Omega para cubierta modelo apps lt con tornilleria; metalica", medidas: '850 × 100 × 17 mm', material: "metalica, tornilleria", precio: 200, fuente: '225120019', clave: 'ATOM3' },
  { id: 'p9-app-lt-omega-300', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Omega", descripcion: "Omega para cubierta modelo apps lt con tornilleria; metalico", medidas: '800 × 244 × 12 mm', material: "metalico, tornilleria", precio: 300, fuente: '225120019', clave: 'ATOMCU3' },
  { id: 'p9-app-lt-omega-350', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Omega", descripcion: "Omega para cubierta modelo apps lt con tornilleria; metalico", medidas: '1100 × 244 × 12 mm', material: "metalico, tornilleria", precio: 350, fuente: '225120019', clave: 'ATOMCU4' },
  { id: 'p9-app-lt-pata-610', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Pata", descripcion: "Pata tipo \"u\" modelo apps lt; metalica", medidas: '600 × 720 mm', material: "metalica", precio: 610, fuente: '225120019', clave: 'ATPU2M' },
  { id: 'p9-app-lt-pata-650', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Pata", descripcion: "Pata tipo \"u\" modelo apps lt; metalica", medidas: '900 × 720 mm', material: "metalica", precio: 650, fuente: '225120019', clave: 'ATPU3M' },
  { id: 'p9-app-lt-pata-770', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Pata", descripcion: "Pata tipo \"u\" modelo apps lt; metalica", medidas: '1200 × 720 mm', material: "metalica", precio: 770, fuente: '225120019', clave: 'ATPU4M' },
  { id: 'p9-app-lt-pata-890', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'App LT', nombre: "App LT · Pata", descripcion: "Pata tipo \"u\" modelo apps lt; metalica", medidas: '750 × 720 mm', material: "metalica", precio: 890, fuente: '225120019', clave: 'ATPU75M' },
  { id: 'p9-cirque-omega-tipo-180', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'Cirque', nombre: "Cirque · Omega · TIPO", descripcion: "Omega modelo tipo App", medidas: '244 × 600 mm', material: "metalica", precio: 180, fuente: '225120019', clave: 'CIOMCU60' },
  { id: 'p9-ergonova-4-porta-cpu-ergonova-330', categoria: 'Componentes y refacciones', tipo: 'especial', linea: 'Ergonova 4', nombre: "Ergonova 4 · Porta CPU · ERGONOVA", descripcion: "Porta cpu vertical con base rodante modelo Ergonova", medidas: '240 × 300 × 190 mm', material: "metálico", precio: 330, fuente: '226020037', clave: 'BCPU' },
  { id: 'p9-soporte-260', categoria: 'Componentes y refacciones', tipo: 'especial', nombre: "Soporte", descripcion: "Soporte para nivelacion derecho", medidas: '515 × 82 × 204 mm', material: "metalico", precio: 260, fuente: '225120019', clave: 'LEESOP52910012' },
  { id: 'p9-tetris-sillon-5219', categoria: 'Sillería', tipo: 'silla', linea: 'Tetris', nombre: "Tetris · Sillón", descripcion: "Sofa individual modelo Tetris tipo Pac con respaldo", medidas: '600 × 700 × 640 mm', material: "tapizado en tela, zoclo con placa", precio: 5219, fuente: '226020037', clave: 'PACSOINT' },
  { id: 'p9-work-lounge-silla-wlohm-31003-14890', categoria: 'Sillería', tipo: 'silla', linea: 'Work Lounge', usuarios: 2, nombre: "Work Lounge · Silla · WLOHM-31003", descripcion: "Sofa de 2 plazas de modelo wlohm-31003 estructura de 4 puntos color neg…", material: "tela gris, negro, capitonado", precio: 14890, fuente: '225080025', clave: 'WLOHM-31003' },
  { id: 'p9-banco-re571c-2012', categoria: 'Sillería', tipo: 'silla', nombre: "Banco · RE571C", descripcion: "Banco alto modelo re571c con base tubular de 4 puntos cromada", material: "polipropileno, base tubular metálica cromada, cromado", precio: 3353, fuente: '226030018', clave: 'RE571C' },
  { id: 'p9-banco-re-nutaba-3512', categoria: 'Sillería', tipo: 'silla', nombre: "Banco · RE-NUTABA", descripcion: "Banco modelo re-nutaba con base de 4 puntos con descansapies color bour…", material: "tecnopolímero, base 4 puntos, descansapiés, bourdeaux", precio: 3512, fuente: '226060050' },
  { id: 'p9-banco-re571ct-4022', categoria: 'Sillería', tipo: 'silla', nombre: "Banco · RE571CT", descripcion: "Banco alto de modelo re571ct con base tubular de 4 puntos cromada", material: "base tubular cromada, polipropileno, tapizado en tela", precio: 4022, fuente: '226020037', clave: 'RE571CT' },
  { id: 'p9-banco-6875', categoria: 'Sillería', tipo: 'silla', nombre: "Banco", descripcion: "Banco con descansapies, estructura metalica pintada para exteriores y c…", material: "estructura metálica pintada para exteriores, carcasa de tecnopolímero", precio: 6875, fuente: '226020037', clave: 'KASIA' },
  { id: 'p9-silla-sonata-2420', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla · SONATA", descripcion: "Silla base de 4 puntos, sin brazos modelo sonata con respaldo y asiento…", material: "polipropileno", precio: 2420, fuente: '225080025', clave: 'SONATA-SB' },
  { id: 'p9-silla-sonata-2420-144', categoria: 'Sillería', tipo: 'silla', nombre: "Silla · SONATA", descripcion: "Silla base de 4 puntos, sin brazos modelo sonata con respaldo y asiento…", material: "polipropileno", precio: 2420, fuente: '226020037', clave: 'SONATA-SB' },
  { id: 'p9-silla-kontor-3840', categoria: 'Sillería', tipo: 'silla', nombre: "Silla · KONTOR", descripcion: "Silla para cajera con brazos", material: "polipropileno negro, respaldo en malla negra, asiento tapizado en tela negra, negro, cromado, brazos fijos, b…", precio: 3840, fuente: '225120019', clave: 'LESSIL04002418' },
  { id: 'p9-silla-3910', categoria: 'Sillería', tipo: 'silla', nombre: "Silla", descripcion: "Silla para uso interior", material: "polipropileno con fibra de vidrio, protección UV", precio: 3910, fuente: '226030134', clave: 'BINI' },
  { id: 'p9-silla-gala-5920', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla · GALA", descripcion: "Sofa individual modelo gala con estructura fija de 4 puntos color negro", material: "poliuretano, tela gris, negro, gris", precio: 5920, fuente: '225080025', clave: 'GALA' },
  { id: 'p9-silla-de-visita-concurso-1111', categoria: 'Sillería', tipo: 'silla', nombre: "Silla de visita · CONCURSO", descripcion: "Silla para visitas sin brazos", material: "respaldo y asiento tapizados en tela, base tubular", precio: 1111, fuente: '225120019', clave: 'COSSIL11000028' },
  { id: 'p9-silla-de-visita-concurso-1111-149', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla de visita · CONCURSO", descripcion: "Silla para visitas sin brazos", material: "tela, base tubular", precio: 1111, fuente: '225080025', clave: 'ETIVTUI' },
  { id: 'p9-silla-de-visita-re-nutabg-2327', categoria: 'Sillería', tipo: 'silla', nombre: "Silla de visita · RE-NUTABG", descripcion: "Silla para visitas con brazos", material: "tecnopolímero gris mineral, gris mineral", precio: 2327, fuente: '226020037', clave: 'RE-NUTABG' },
  { id: 'p9-silla-de-visita-re570gt-2490', categoria: 'Sillería', tipo: 'silla', nombre: "Silla de visita · RE570GT", descripcion: "Silla para visitas sin brazos", material: "polipropileno, base tubular 4 puntos, tapizado en tela, gris (base)", precio: 2490, fuente: '226060050' },
  { id: 'p9-silla-de-visita-esp-ohv-368-2532', categoria: 'Sillería', tipo: 'silla', nombre: "Silla de visita · ESP-OHV-368", descripcion: "Silla para visitas con brazos", material: "polipropileno, malla (mesh), tela, negro", precio: 4220, fuente: '226030018', clave: 'ESP-OHV-368' },
  { id: 'p9-silla-de-visita-re570rnbt-3070', categoria: 'Sillería', tipo: 'silla', nombre: "Silla de visita · RE570RNBT", descripcion: "Silla para visitas con brazos", material: "base tubular negra con rodajas, polipropileno, tapizado en tela, negro", precio: 3070, fuente: '226020037', clave: 'RE570RNBT' },
  { id: 'p9-silla-de-visita-re570cbt-3664', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla de visita · RE570CBT", descripcion: "Silla para visitas con brazos", material: "polipropileno, base tubular cromada, tela, cromada, tapizado en tela, brazos, base de 4 puntos", precio: 3664, fuente: '226050047' },
  { id: 'p9-silla-de-visita-delta-3840', categoria: 'Sillería', tipo: 'silla', nombre: "Silla de visita · DELTA", descripcion: "Silla de visitas modelo delta white con descansabrazos ajustables", material: "poliuretano inyectado, base de trineo cromado, descansabrazos ajustables, white", precio: 3840, fuente: '226060050' },
  { id: 'p9-silla-de-visita-re570rcbt-3899', categoria: 'Sillería', tipo: 'silla', nombre: "Silla de visita · RE570RCBT", descripcion: "Silla para visitas con brazos", material: "base tubular cromada con rodajas, polipropileno, tapizado en tela", precio: 3899, fuente: '226020037', clave: 'RE570RCBT' },
  { id: 'p9-silla-de-visita-wlohv-129-5210', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla de visita · WLOHV-129", descripcion: "Silla para visitas sin brazos", material: "tela, estructura cromada, cromado", precio: 5210, fuente: '225080025', clave: 'WLOHV-129' },
  { id: 'p9-silla-de-visita-concerto-5470', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla de visita · CONCERTO", descripcion: "Silla base de 4 puntos, con brazos modelo concerto estructura negra, br…", material: "tela, estructura negra, brazos negros", precio: 5470, fuente: '225080025', clave: 'CONCERTO-BNENRTAT' },
  { id: 'p9-silla-ejecutiva-energy-6480', categoria: 'Sillería', tipo: 'silla', nombre: "Silla ejecutiva · ENERGY", descripcion: "Silla ejecutiva modelo energy ehite con respaldo alto de 4 posiciones d…", material: "base 5 puntos aluminio pulido, descansabrazos 4D, soporte lumbar ajustable, cabecera ajustable, white (docume…", precio: 6480, fuente: '226060050' },
  { id: 'p9-silla-ejecutiva-22198', categoria: 'Sillería', tipo: 'silla', nombre: "Silla ejecutiva", descripcion: "Silla ejecutiva ergohuman", material: "malla, base de aluminio, marco y malla gris", precio: 22198, fuente: '226030134', clave: 'RM-9100-GR' },
  { id: 'p9-silla-operativa-c4-em-bnf-1595', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla operativa · C4-EM-BNF", descripcion: "Silla operativa, con brazos, rodante modelo c4-em-bnf mecanismos de ele…", material: "nailon, mesh 109, tela, base negra de nailon, tapizado en tela, brazos fijos, mecanismo de elevación, mecanis…", precio: 1595, fuente: '226050047' },
  { id: 'p9-silla-operativa-c4-em-bnf-1850', categoria: 'Sillería', tipo: 'silla', nombre: "Silla operativa · C4-EM-BNF", descripcion: "Silla operativa, con brazos, rodante modelo c4-em-bnf mecanismos de ele…", material: "respaldo en mesh 109, asiento tapizado en tela WT805, base de nailon 5 puntos, negro, mecanismos de elevacion…", precio: 1850, fuente: '225120019', clave: 'LESSIL35007228' },
  { id: 'p9-silla-operativa-c4-el-bnf-1950', categoria: 'Sillería', tipo: 'silla', nombre: "Silla operativa · C4-EL-BNF", descripcion: "Silla operativa, con brazos, rodante modelo c4-el-bnf mecanismos de ele…", material: "base de nailon 5 puntos, mesh 109, tela WT805, MESH 109, TELA WT805, base negra, cabecera, rodajas, brazos fi…", precio: 1950, fuente: '226030134', clave: 'C4-EL-BNF-CABF' },
  { id: 'p9-silla-operativa-c4-el-bnf-2405', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla operativa · C4-EL-BNF", descripcion: "Silla operativa, con brazos, rodante modelo c4-el-bnf mecanismos de ele…", material: "mesh 109, tela WT805, nailon, negro, cabecera", precio: 2405, fuente: '225080025', clave: 'C4-EL-BNF-CAB' },
  { id: 'p9-silla-operativa-esp-ohe-63-2870', categoria: 'Sillería', tipo: 'silla', nombre: "Silla operativa · ESP-OHE-63", descripcion: "Silla operativa, con brazos, rodante de modelo esp-ohe-63 estructura de…", material: "respaldo mesh negro, asiento tapizado en tela negra, negro, estructura 5 puntos giratoria, brazos ajustables …", precio: 2870, fuente: '225120019', clave: 'LESSIL35001205' },
  { id: 'p9-silla-operativa-gamma-e-3990', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla operativa · GAMMA-E", descripcion: "Silla operativa, con brazos, rodante modelo gamma-e con mecanismo recli…", material: "polipropileno, mesh negro GT-27, tela, tapizado en tela, brazos, mecanismo reclinable, ajuste de altura, roda…", precio: 3990, fuente: '226050047' },
  { id: 'p9-silla-operativa-gamma-e-4140', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla operativa · GAMMA-E", descripcion: "Silla operativa, con brazos, rodante modelo gamma-e con mecanismo recli…", material: "polipropileno TF-15ZB, mesh negro GT-27, tela HM-38, negro", precio: 4140, fuente: '225080025', clave: 'GAMMA-E' },
  { id: 'p9-silla-operativa-gamma-tap-4370', categoria: 'Sillería', tipo: 'silla', nombre: "Silla operativa · GAMMA-TAP", descripcion: "Silla operativa, con brazos, rodante modelo gamma-tap mec reclinable, a…", material: "base y estructura de polipropileno, respaldo en mesh negro GT-27, asiento tapizado en tela, brazos ajustables…", precio: 4370, fuente: '226020037', clave: 'GAMMA-TAP' },
  { id: 'p9-silla-operativa-win-5210', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla operativa · WIN", descripcion: "Silla operativa, con brazos, rodante de modelo win mecanismo de reclina…", material: "malla negra, tela negra, polipropileno, negro", precio: 5210, fuente: '225080025', clave: 'WIN' },
  { id: 'p9-silla-operativa-win-cab-5900', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Silla operativa · WIN-CAB", descripcion: "Silla operativa, con brazos, rodante de modelo win-cab mecanismo de rec…", material: "malla negra, tela negra, polipropileno, negro, cabecera, brazos ajustables, soporte lumbar", precio: 5900, fuente: '225080025', clave: 'WIN-CAB' },
  { id: 'p9-silla-operativa-dex-6960', categoria: 'Sillería', tipo: 'silla', nombre: "Silla operativa · DEX", descripcion: "Silla operativa modelo \"dex\"", material: "marco de polipropileno, tapizado en mesh, asiento poliuretano inyectado, base 5 puntos, brazos ajustables de …", precio: 6960, fuente: '226060050' },
  { id: 'p9-silla-plegable-a7-fc-b-1295', categoria: 'Sillería', tipo: 'silla', nombre: "Silla plegable · A7-FC-B", descripcion: "Silla plegable modelo a7-fc-b con descansabrazos de pu y base tubular c…", material: "PU (descansabrazos), base tubular, mesh MK100, tela WT805, MESH MK100, TELA WT805, rodajas", precio: 1295, fuente: '226030134', clave: 'A7-FC-B' },
  { id: 'p9-sillon-8540', categoria: 'Sillería', tipo: 'silla', nombre: "Sillón", descripcion: "Sillón de 1 plaza cuerpo en poliuretano inyectado y tapizado para uso i…", material: "poliuretano inyectado, tapizado, base P3 spider en acero pintado, negro (base)", precio: 8540, fuente: '226060050' },
  { id: 'p9-sillon-11706', categoria: 'Sillería', tipo: 'silla', usuarios: 1, nombre: "Sillón", descripcion: "Sillon individual cms base metalica ; tapizado en tela", medidas: '660 × 720 × 630 mm', material: "base metálica, tela, tapizado en tela", precio: 11706, fuente: '226050047' },
  { id: 'p9-sillon-11706-178', categoria: 'Sillería', tipo: 'silla', nombre: "Sillón", descripcion: "Sillon individual cms base metalica ; tapizado en tela", medidas: '680 × 720 × 630 mm', material: "base metálica, tapizado en tela", precio: 11706, fuente: '226030134', clave: 'LENO' },
  { id: 'p9-sillon-11706-179', categoria: 'Sillería', tipo: 'silla', nombre: "Sillón", descripcion: "Sillon individual cms base metalica ; tapizado en tela", medidas: '660 × 720 × 630 mm', material: "base metálica, tapizado en tela", precio: 11706, fuente: '226020037', clave: 'LENO' },

  // ==========================================================================
  //  Carga original (BMU / Tradeco)
  // ==========================================================================
  // ---------------- OPERATIVOS / BENCH App LT ----------------
  { id: 'op-1u-1500x600', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 1,
    nombre: 'Módulo operativo App LT 1 usuario', medidas: '1500 × 600 mm',
    material: 'Cubierta melamina ABS, estructura y faldón metálica', precio: 8750, fuente: '2508040' },
  { id: 'op-2u-1500x1200', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 2,
    nombre: 'Módulo operativo App LT 2 usuarios', medidas: '1500 × 1200 mm',
    material: 'Cubiertas melamina ABS, biombo frontal y laterales melamina ABS, conducto metálico', precio: 15700, fuente: '2508040' },
  { id: 'op-4u-3000x1200', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 4,
    nombre: 'Módulo operativo App LT 4 usuarios', medidas: '3000 × 1200 mm',
    material: 'Cubiertas melamina ABS, biombos melamina ABS, conducto metálico', precio: 25980, fuente: '2508040' },
  { id: 'op-6u-4500x1200', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 6,
    nombre: 'Módulo operativo App LT 6 usuarios', medidas: '4500 × 1200 mm',
    material: 'Cubiertas melamina ABS, biombos melamina ABS, conducto metálico', precio: 36260, fuente: '2508040' },
  { id: 'op-8u-4800x1200-cristal', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 8,
    nombre: 'Módulo operativo App LT 8 usuarios (biombo cristal)', medidas: '4800 × 1200 mm',
    material: 'Cubiertas ABS, biombo en cristal transparente, estructura y acometida metálica', precio: 23070, fuente: '226030004' },
  { id: 'op-10u-6000x1200-cristal', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 10,
    nombre: 'Módulo operativo App LT 10 usuarios (biombo cristal)', medidas: '6000 × 1200 mm',
    material: 'Cubiertas ABS, biombo en cristal transparente, estructura y acometida metálica', precio: 28540, fuente: '226030004' },
  { id: 'op-12u-7200x1200-cristal', categoria: 'Operativos / Bench', tipo: 'modulo', linea: 'App LT', usuarios: 12,
    nombre: 'Módulo operativo App LT 12 usuarios (biombo cristal)', medidas: '7200 × 1200 mm',
    material: 'Cubiertas ABS, biombo en cristal transparente, estructura y acometida metálica', precio: 34010, fuente: '226030004' },

  // ---------------- ESCRITORIOS / GERENTE / DIRECTIVO ----------------
  { id: 'esc-varios-1800x900', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1,
    nombre: 'Módulo escritorio App LT', medidas: '1800 × 900 mm',
    material: 'Cubierta melamina ABS, estructura metálica', precio: 5700, fuente: '2508040' },
  { id: 'ger-1500x750', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1,
    nombre: 'Módulo gerente App LT', medidas: '1500 × 750 mm',
    material: 'Cubierta melamina ABS, patas tipo U, estructura metálica', precio: 6860, fuente: '2508040' },
  { id: 'ger-1800x750', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1,
    nombre: 'Módulo gerente App LT', medidas: '1800 × 750 mm',
    material: 'Cubierta melamina ABS, patas tipo U, conducto faldón ABS/metal', precio: 7780, fuente: '2508040' },
  { id: 'ger-1500x1800', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1,
    nombre: 'Módulo gerente App LT (retorno)', medidas: '1500 × 1800 mm',
    material: 'Cubiertas melamina ABS, patas tipo U, faldón y estructura metálica', precio: 8770, fuente: '226030004' },
  { id: 'ger-1800x1800', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1,
    nombre: 'Módulo gerente App LT (retorno)', medidas: '1800 × 1800 mm',
    material: 'Cubiertas melamina ABS, patas tipo U, faldón y estructura metálica', precio: 9400, fuente: '226030004' },
  { id: 'dir-1800x2400', categoria: 'Escritorios', tipo: 'modulo', linea: 'App LT', usuarios: 1,
    nombre: 'Módulo directivo App LT', medidas: '1800 × 2400 mm',
    material: 'Cubiertas melamina ABS, patas U, faldón, gaveta pedestal frentes ABS, estructura metálica', precio: 15780, fuente: '226030004' },
  { id: 'rec-2420x830', categoria: 'Escritorios', tipo: 'modulo', linea: '', usuarios: 2,
    nombre: 'Módulo recepción 2 usuarios', medidas: '2420 × 830 mm',
    material: 'Estructura metálica, cubiertas melamina ABS, gajos en tela, gavetas lámina/frentes ABS', precio: 29920, fuente: '2508040' },

  // ---------------- MESAS DE JUNTAS ----------------
  { id: 'mj-900x900-melamina', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 4,
    nombre: 'Mesa de juntas', medidas: '900 × 900 mm',
    material: 'Bases metal, cubierta melamina ABS', precio: 4260, fuente: '2508040' },
  { id: 'mj-900x900-comedor', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 4,
    nombre: 'Mesa comedor / juntas', medidas: '900 × 900 mm',
    material: 'Cubiertas melamina canto ABS, estructura metálica', precio: 4030, fuente: '226030004' },
  { id: 'mj-900x900-cristal', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 4,
    nombre: 'Mesa de juntas (cristal)', medidas: '900 × 900 mm',
    material: 'Cubierta cristal laminado blanco 12 mm, estructura metálica', precio: 12260, fuente: '226030004' },
  { id: 'mj-1050x1050-cristal', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 4,
    nombre: 'Mesa de juntas (cristal)', medidas: '1050 × 1050 mm',
    material: 'Cubierta cristal laminado blanco 12 mm, estructura metálica', precio: 10490, fuente: '226030004' },
  { id: 'mj-1200x1200-melamina', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 4,
    nombre: 'Mesa de juntas', medidas: '1200 × 1200 mm',
    material: 'Bases metal, cubierta melamina ABS', precio: 5510, fuente: '2508040' },
  { id: 'mj-1200x1200-cristal', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 4,
    nombre: 'Mesa de juntas (cristal)', medidas: '1200 × 1200 mm',
    material: 'Cubierta cristal laminado blanco 12 mm, estructura metálica', precio: 20340, fuente: '226030004' },
  { id: 'mj-2400x1200', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 8,
    nombre: 'Mesa de juntas App LT', medidas: '2400 × 1200 mm',
    material: 'Bases metal, cubiertas melamina ABS', precio: 7870, fuente: '2508040' },
  { id: 'mj-3000x1200', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 10,
    nombre: 'Mesa de juntas App LT (con caja eléctrica)', medidas: '3000 × 1200 mm',
    material: 'Cubiertas melamina ABS, caja eléctrica LUM-LIS HDMI-N al centro, estructura metálica', precio: 18560, fuente: '226030004' },
  { id: 'mj-3600x1200', categoria: 'Mesas de juntas', tipo: 'mesa', usuarios: 11,
    nombre: 'Mesa de juntas App LT (con caja eléctrica)', medidas: '3600 × 1200 mm',
    material: 'Cubiertas melamina ABS, caja eléctrica LUM-LIS HDMI-N al centro, estructura metálica', precio: 20510, fuente: '226030004' },
  { id: 'mj-consejo-4800x1200-eclipse', categoria: 'Mesas de juntas', tipo: 'especial', usuarios: 14,
    nombre: 'Mesa de consejo Eclipse', medidas: '4800 × 1200 mm',
    material: 'Cubiertas y estructura chapa de madera, detalle central ecopiel, 2 cajas eléctricas ELLORA 2X', precio: 96720, fuente: '226030004' },
  { id: 'mesa-circular-accents', categoria: 'Mesas de juntas', tipo: 'especial', usuarios: 3,
    nombre: 'Mesa circular Accents', medidas: 'Ø 600 × 398 mm',
    material: 'Estructura metálica, cubierta cristal satinado 9 mm', precio: 4700, fuente: '2508040' },

  // ---------------- GUARDAS / ARCHIVO / ALMACENAMIENTO ----------------
  { id: 'gaveta-mox', categoria: 'Guardas y archivo', tipo: 'guarda',
    nombre: 'Gaveta rodante MOX (archivero + papelero)', medidas: '380 × 600 × 460 mm',
    material: 'Frentes planos melamina cantos ABS, cojín tela, 2 jaladeras y cerradura, metálica', precio: 3470, fuente: '226030004' },
  { id: 'arch-modulor-2p-750', categoria: 'Guardas y archivo', tipo: 'guarda',
    nombre: 'Archivero Modulor 2 puertas + 1 entrepaño', medidas: '750 × 750 × 420 mm',
    material: 'Cerradura, jaladeras, puertas y cubierta melamina canto ABS, metálico', precio: 6440, fuente: '226030004' },
  { id: 'arch-modulor-2p-900', categoria: 'Guardas y archivo', tipo: 'almacen',
    nombre: 'Archivero Modulor 2 puertas + 1 entrepaño', medidas: '900 × 750 × 420 mm',
    material: 'Cerradura, puertas y cubierta melamina canto ABS, metálico', precio: 7230, fuente: '2508040' },
  { id: 'arch-modulor-4p-1500', categoria: 'Guardas y archivo', tipo: 'almacen',
    nombre: 'Archivero Modulor 4 puertas + 1 entrepaño', medidas: '1500 × 750 mm',
    material: 'Cerradura, jaladeras, puertas y cubierta melamina canto ABS, metálico', precio: 14260, fuente: '226030004' },
  { id: 'arch-registro-lateral-4c', categoria: 'Guardas y archivo', tipo: 'almacen',
    nombre: 'Archivero registro lateral 4 cajones', medidas: '900 × 1330 × 465 mm',
    material: 'Frentes planos con jaladeras integradas, metálico', precio: 22570, fuente: '226030004' },
  { id: 'gabinete-multiusos', categoria: 'Guardas y archivo', tipo: 'almacen',
    nombre: 'Gabinete fijo multiusos 2 puertas + 3 entrepaños', medidas: '900 × 1570 × 450 mm',
    material: 'Respaldo metálico, laterales y puertas melamina canto ABS', precio: 11790, fuente: '2508040' },

  // ---------------- SILLERÍA (comprada / revendida) ----------------
  { id: 'silla-win', categoria: 'Sillería', tipo: 'silla', nombre: 'Silla operativa WIN',
    material: 'Con brazos, reclinación, base 5 pts PP, respaldo malla, tela negra', precio: 5210, fuente: '226030004' },
  { id: 'silla-win-cab', categoria: 'Sillería', tipo: 'silla', nombre: 'Silla operativa WIN-CAB (cabecera)',
    material: 'Con brazos, reclinación, base 5 pts PP, cabecera y respaldo malla, tela negra', precio: 5900, fuente: '226030004' },
  { id: 'silla-concerto', categoria: 'Sillería', tipo: 'silla', nombre: 'Silla CONCERTO (visita 4 pts)',
    material: 'Con brazos, estructura negra, respaldo mesh, asiento tapizado tela', precio: 5140, fuente: '226030004' },
  { id: 'silla-alpha', categoria: 'Sillería', tipo: 'silla', nombre: 'Silla directiva ALPHA',
    material: 'Con brazos, control en brazos, base y estructura aluminio, mesh negro GT07-35E', precio: 11950, fuente: '226030004' },
  { id: 'silla-gamma-e', categoria: 'Sillería', tipo: 'silla', nombre: 'Silla operativa GAMMA-E',
    material: 'Con brazos, reclinable, estructura PP, respaldo mesh, tela HM-38', precio: 4140, fuente: '2508040' },
  { id: 'silla-sonata', categoria: 'Sillería', tipo: 'silla', nombre: 'Silla SONATA (visita 4 pts)',
    material: 'Sin brazos, respaldo y asiento en polipropileno', precio: 2420, fuente: '2508040' },
  { id: 'silla-etivtui', categoria: 'Sillería', tipo: 'silla', nombre: 'Silla de visita ETIVTUI',
    material: 'Sin brazos, base tubular, respaldo y asiento tapizado en tela', precio: 1111, fuente: '2508040' },
  { id: 'silla-c4-el-bnf', categoria: 'Sillería', tipo: 'silla', nombre: 'Silla operativa C4-EL-BNF-CAB',
    material: 'Con brazos, elevación y reclinación, cabecera, respaldo mesh, tela', precio: 2405, fuente: '2508040' },
  { id: 'sofa-gala', categoria: 'Sillería', tipo: 'silla', nombre: 'Sofá individual GALA',
    material: 'Estructura fija 4 pts, poliuretano tapizado tela gris', precio: 5920, fuente: '2508040' },
  { id: 'sofa-2plazas', categoria: 'Sillería', tipo: 'silla', linea: 'Work Lounge', nombre: 'Sofá 2 plazas WLOHM-31003',
    material: 'Estructura 4 pts, relieve capitonado, tela gris', precio: 14890, fuente: '2508040' },
];

// Agrupador de categorias para la pantalla, en orden
export const BANCO_CATEGORIAS = [
  'Operativos / Bench',
  'Escritorios',
  'Mesas de juntas',
  'Guardas y archivo',
  'Mesas y complementos',
  'Electrificación',
  'Cancelería y muros',
  'Componentes y refacciones',
  'Sillería',
];

// Las LÍNEAS que existen en el banco, para filtrar. Se calculan de los datos
// para que nunca se desincronicen. La sillería es comprada-revendida: no tiene
// línea Von Haucke, y eso se dice en pantalla en vez de dejarlo en blanco.
export const BANCO_LINEAS = [...new Set(BANCO.map((p) => p.linea).filter(Boolean))].sort();

// Nota de precios por fuente (para mostrar contexto)
export const BANCO_FUENTES = {
  '2508040': 'Proy. BMU · precio de lista',
  '226030004': 'Proy. Tradeco · con descuento vol.',
  // --- los 9 presupuestos cargados el 2026-08-15 (todos ya en precio de lista) ---
  '226050047': 'Propuesta gral · may 2026',
  '226050048': 'Cancelería Wand · may 2026',
  '226010047': 'Fuerza Especial · ene 2026',
  '226030018': 'Unión de Crédito · may 2026',
  '226060050': 'Grupo Ginez · jun 2026',
  '226030134': 'Mixue / Snow King · jun 2026',
  '226020037': 'NDT Global piso 11 · jul 2026',
  '225120019': 'PrestigeMotors · dic 2025',
  '225080025': 'Módulo App LT 4U · mar 2026',
};


// ============================================================================
//  EL MISMO MUEBLE, DOS VECES
//
//  Rodrigo, viendo su cotización: "volvió a duplicar las sillas CONCERTO, ¿por
//  qué?". No era la agrupación de partidas —esos dos renglones tenían nombre y
//  precio DISTINTOS, así que juntarlos habría sido inventar—: era el banco.
//  La misma silla CONCERTO estaba cargada dos veces, de dos presupuestos, a
//  $5,470 y $5,140. Voni ve las dos y pide las dos.
//
//  Se detectan con EVIDENCIA DURA, no por parecido de nombre:
//    a) misma CLAVE del ERP  → es literalmente el mismo artículo
//    b) sillería con el mismo MODELO (CONCERTO, WIN, GAMMA-E…) → la misma silla
//
//  ⚠️ Y NO SE FUSIONA A CIEGAS. Si los precios difieren más de 25% casi nunca es
//  el mismo mueble con otra fecha: es otro producto que se llama parecido. Caso
//  real: "silla EJECUTIVA" aparece a $6,480 y a $22,198 — 3.4× — y son dos
//  sillas distintas. Ésas se quedan separadas a propósito.
//
//  Del grupo se queda el precio MÁS RECIENTE, y los otros viajan en
//  `otrosPrecios` para poder enseñar el historial sin ensuciar la lista.
// ============================================================================

// Mes de cada presupuesto, para saber cuál manda. Sale del texto de BANCO_FUENTES.
const MES_FUENTE = {
  '225120019': '2025-12', '226010047': '2026-01', '225080025': '2026-03',
  '2508040': '2026-03', '226030004': '2026-03', '226030018': '2026-05',
  '226050047': '2026-05', '226050048': '2026-05', '226060050': '2026-06',
  '226030134': '2026-06', '226020037': '2026-07',
};
const fechaDe = (p) => MES_FUENTE[p.fuente] || '0000-00';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const GENERICAS = new Set(['SILLA', 'SILLON', 'BANCO', 'VISITA', 'OPERATIVA', 'ALTO', 'PARA', 'CON',
  'SIN', 'PTS', 'MODELO', 'BASE', 'BRAZOS', 'RODANTE', 'TAPIZADO', 'PUFF', 'SOFA', 'BANQUETA', 'DIRECTIVA']);

function modeloDeSilla(p) {
  const t = (sinAcentos(p.nombre).match(/\b[A-Z][A-Z0-9-]{2,}\b/g) || []).filter((x) => !GENERICAS.has(x));
  return t[0] || null;
}

/** La llave con la que dos renglones son el MISMO artículo, o null si no aplica. */
export function llaveArticulo(p) {
  // ⚠️ EN SILLERÍA MANDA EL MODELO, NO LA CLAVE. La clave es un código de
  // variante (`CONCERTO-BNENRTAT` = tal tapiz, tal estructura) y no todos los
  // presupuestos la imprimen. Si se pregunta primero por la clave, la MISMA
  // silla CONCERTO cae en dos llaves distintas —una por clave y otra por
  // modelo— y sigue duplicada, que es justo lo que Rodrigo vio en pantalla.
  if (p.categoria === 'Sillería') { const m = modeloDeSilla(p); if (m) return `silla:${m}`; }
  if (p.clave) return `clave:${p.clave}`;
  return null;
}

/** El banco sin duplicados: lo que ve el vendedor y lo que ve Voni. */
export function bancoUnico(lista = BANCO) {
  const grupos = new Map();
  const sueltos = [];
  for (const p of lista) {
    const k = llaveArticulo(p);
    if (!k) { sueltos.push(p); continue; }
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  const out = [...sueltos];
  for (const v of grupos.values()) {
    if (v.length === 1) { out.push(v[0]); continue; }
    const precios = v.map((x) => x.precio).filter((x) => x > 0);
    const disp = Math.max(...precios) / Math.min(...precios);
    if (disp > 1.25) { out.push(...v); continue; }   // no es el mismo mueble: se dejan
    const orden = v.slice().sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)));
    const manda = orden[0];
    out.push({
      ...manda,
      otrosPrecios: orden.slice(1).map((x) => ({ precio: x.precio, fuente: x.fuente, mes: fechaDe(x) })),
    });
  }
  return out;
}
