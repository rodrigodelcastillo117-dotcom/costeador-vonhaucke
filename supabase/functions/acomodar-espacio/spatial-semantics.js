// Semántica canónica compartida por el edge de acomodo.
// Una sola taxonomía interna; acepta aliases del FloorSpec/frontend.
const norm = (s='') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

export function canonicalZoneRole(a={}) {
  const raw=norm(a?.zone_role || a?.tipo || '');
  const name=norm(a?.nombre || a?.name || '');
  const t=`${raw} ${name}`;

  if (/sanitar|bano|wc|toilet|restroom/.test(t)) return 'restroom';
  if (/\bsite\b|site_it|servidor|server|\bit\b|tecnico|rack/.test(t)) return 'technical';
  if (/recep|lobby|acceso/.test(t)) return 'reception';
  if (/sala_consejo|consejo|junta|conference|meeting/.test(t)) return 'meeting';
  if (/area_operativa|operational|operativ|open|workstation|isla|bench/.test(t)) return 'operational';
  if (/oficina_ceo|private_office|privad|direccion|director|ceo|gerenc/.test(t)) return 'private_office';
  if (/lounge|comedor|break|estar/.test(t)) return 'lounge';
  if (/servicio|bodega|cocina/.test(t)) return 'service';
  if (/general|generica|generico/.test(t)) return 'unknown';
  return 'unknown';
}

function seatKind(t){
  if (!/silla|asiento|chair|seat|sillon|sillón/.test(t)) return null;
  if (/vh-dest-mtg|junta|consejo|meeting|board|sonata/.test(t)) return 'meeting_seat';
  if (/vh-dest-prv|directiv|ejecutiv|presiden|gerenc|concerto|alpha|energy/.test(t)) return 'executive_seat';
  if (/vh-dest-rcp|recep|espera|visita|confidente/.test(t)) return 'visitor_seat';
  if (/vh-dest-opn|operativ|work|win(?:-cab)?|gamma|dex/.test(t)) return 'work_seat';
  return 'generic_seat';
}

export function canonicalProductRole(p={}) {
  const explicit=norm(p?.product_role);
  // Sólo respetar explícitos si pertenecen a nuestra taxonomía.
  const known=new Set(['reception_desk','meeting_table','bench','workstation','executive_desk','technical_storage','storage','meeting_seat','executive_seat','visitor_seat','work_seat','generic_seat','other']);
  if (known.has(explicit)) return explicit;

  const t=norm(`${p?.tipo||''} ${p?.nombre||''} ${p?.ruta||''} ${p?.zonaSugerida||''}`);
  const seat=seatKind(t);
  if (seat) return seat;
  if (/recep|mostrador/.test(t)) return 'reception_desk';
  if (/mesa.*junta|junta.*mesa|conference|consejo|board.*table|meeting.*table/.test(t)) return 'meeting_table';
  if (/bench|banca/.test(t)) return 'bench';
  if (/estacion|workstation/.test(t)) return 'workstation';
  if (/escritorio.*(direccion|director|ejecutiv|ceo)|(direccion|director|ejecutiv|ceo).*escritorio/.test(t)) return 'executive_desk';
  if (/locker|site|server|servidor|rack/.test(t)) return 'technical_storage';
  if (/archivero|credenza|cajonera|guarda|storage|pedestal/.test(t)) return 'storage';
  if (/escritorio/.test(t)) return 'workstation';
  return 'other';
}

export function semanticVerdict(pr,zr) {
  if (zr === 'restroom') return { level:'FAIL', code:'FURNITURE_IN_RESTROOM' };
  if (zr === 'technical' && !['technical_storage'].includes(pr)) return { level:'FAIL', code:'NON_TECH_FURNITURE_IN_TECHNICAL' };

  const exact={
    reception_desk:'reception',
    meeting_table:'meeting',
    bench:'operational',
    executive_desk:'private_office',
    meeting_seat:'meeting',
    executive_seat:'private_office',
    work_seat:'operational',
  };
  if (exact[pr] && zr !== exact[pr]) return { level:'FAIL', code:`${pr.toUpperCase()}_WRONG_ZONE` };

  if (pr === 'workstation' && !['operational','private_office'].includes(zr))
    return { level:'FAIL', code:'WORKSTATION_IN_WRONG_ZONE' };
  if (pr === 'visitor_seat' && !['reception','private_office','meeting'].includes(zr))
    return { level:'REVIEW', code:'VISITOR_SEAT_ZONE_REVIEW' };
  if (pr === 'technical_storage' && !['technical','service'].includes(zr))
    return { level:'REVIEW', code:'TECHNICAL_STORAGE_ZONE_REVIEW' };
  if (pr === 'generic_seat' || pr === 'storage' || pr === 'other' || zr === 'unknown')
    return { level:'REVIEW', code:'SEMANTIC_ROLE_REVIEW' };
  return { level:'PASS', code:null };
}
