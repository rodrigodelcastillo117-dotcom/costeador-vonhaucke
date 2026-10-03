// ============================================================================
//  SNAPSHOT CONGELADO de `config.datos.insumos` (precios) de PRODUCCIÓN.
//  Capturado para SOURCE PARITY: los tests corren con el SEED (INSUMOS_SEMILLA);
//  el app LIVE superpone estos precios de la BD. Divergen (ver sourceParity.test.js).
//  NO se sincroniza automáticamente: qué precio es el correcto lo decide Compras.
//  SÓLO lo importan tests (no entra al build). Para re-capturar:
//    SELECT jsonb_object_agg(key,(value->>'precio')::numeric)
//    FROM config, jsonb_each(datos->'insumos') WHERE id='vonhaucke';
// ============================================================================
export const CONFIG_SNAPSHOT = {
  source: 'supabase:mtuvnbgljwbsaizjjgzs · config.datos.insumos',
  fecha: '2026-10-04',
  nota: 'Precios de PRODUCCIÓN (config) al 2026-10-04. Fuente de verdad del costeo LIVE.',
  precios: {"mdf":210,"ptr":42,"riel":1250,"tela":280,"arnes":1450,"ducto":180,"nogal":420,"torre":5600,"wally":1900,"barniz":95,"espuma":260,"marmol":2400,"mdf-16":560,"ptr-10":70,"ptr-12":58,"ptr-14":48,"rodaja":22,"bisagra":85,"charola":145,"chicote":38,"ecocrom":180,"ecopiel":340,"silicon":180,"acrilico":890,"contacto":95,"credenza":6500,"escuadra":28,"foil-pvc":290,"jaladera":45,"laminado":420,"pedestal":1850,"usb-hdmi":320,"acometida":850,"anodizado":45,"cerradura":110,"corredera":95,"lamina-10":33,"lamina-12":33,"lamina-14":33,"lamina-18":34,"lamina-20":32,"lamina-22":33,"nivelador":12,"piel-napa":1900,"soldadura":65,"tapacanto":10,"acrilico-6":690,"aglomerado":480,"byrne-node":1607,"faldon-abs":180,"granallado":55,"inoxidable":135,"melamina-9":625,"pasacables":35,"serigrafia":150,"acrilico-12":1180,"frente-tela":420,"melamina-16":900,"melamina-19":320,"melamina-28":1280,"tornilleria":45,"byrne-phase2":700,"chapa-madera":850,"chapa-walnut":716,"frente-metal":520,"membrana-pvc":260,"pet-acustico":1150,"acab-satinado":120,"pata-metalica":380,"policarbonato":1012.6,"tapa-abatible":320,"tapacanto-3mm":25,"caja-electrica":650,"cajonera-movil":2100,"marmol-premium":2800,"archivo-lateral":4200,"base-motorizada":5885,"bastidor-madera":420,"byrne-interlink":3012,"cristal-flotado":760,"faldon-melamina":320,"perfil-aluminio":95,"remate-aluminio":95,"bastidor-mampara":680,"cristal-satinado":780,"cristal-templado":980,"divisor-melamina":320,"cristal-templado-6":720,"cristal-templado-12":1240,"espuma-termoformada":580,"cerradura-electronica":1850,"pintura-electrostatica":110},
};

// Divergencias GRAVES seed↔config al 2026-10-04 (ratio >=5×): casi seguro problema de
// unidad u orden de magnitud. Documentadas, NO resueltas (decisión de Compras).
export const DIVERGENCIAS_GRAVES = [
  'lamina-10', 'lamina-12', 'lamina-14', 'lamina-18', 'lamina-20', 'lamina-22',
  'inoxidable', 'bisagra', 'rodaja', 'pasacables', 'piel-napa', 'arnes', 'ducto',
  'cristal-satinado', 'cristal-templado-6', 'cristal-templado-12',
];
