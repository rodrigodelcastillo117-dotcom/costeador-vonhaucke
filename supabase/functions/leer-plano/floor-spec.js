const n = (v) => Number(v);
const finite = (v) => Number.isFinite(n(v));
const round2 = (v) => Math.round(n(v) * 100) / 100;
const norm = (s='') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function polygonArea(points = []) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let a = 0;
  for (let i=0;i<points.length;i++) {
    const p=points[i]||{}, q=points[(i+1)%points.length]||{};
    if (![p.x,p.y,q.x,q.y].every(finite)) return 0;
    a += n(p.x)*n(q.y)-n(q.x)*n(p.y);
  }
  return Math.abs(a)/2;
}

export function areaOfZone(a={}) {
  if (a?.forma === 'circulo') {
    const r=n(a?.circulo?.r);
    return finite(r)&&r>0 ? Math.PI*r*r : 0;
  }
  return polygonArea(a?.puntos||[]);
}

export function roleOf(tipo='') {
  const t=norm(tipo);
  const map={open:'operational',privado:'private_office',juntas:'meeting',recepcion:'reception',lounge:'lounge',servicio:'service'};
  return map[t] || 'unknown';
}

function pointSegmentDistance(px,py,x1,y1,x2,y2) {
  const dx=x2-x1, dy=y2-y1;
  if (dx===0 && dy===0) return Math.hypot(px-x1,py-y1);
  const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy)));
  const x=x1+t*dx,y=y1+t*dy;
  return Math.hypot(px-x,py-y);
}

function segmentLength(s={}) {
  return [s.x1,s.y1,s.x2,s.y2].every(finite) ? Math.hypot(n(s.x2)-n(s.x1),n(s.y2)-n(s.y1)) : 0;
}

function insideEnvelope(x,y,W,H,tol=5) {
  return finite(x)&&finite(y)&&x>=-tol&&y>=-tol&&x<=W+tol&&y<=H+tol;
}

function validateSegment(s,i,kind,W,H,issues) {
  const path=`${kind}[${i}]`;
  if (![s?.x1,s?.y1,s?.x2,s?.y2].every(finite)) { issues.push({field:path,code:'NON_FINITE_SEGMENT'}); return; }
  if (segmentLength(s) < 50) issues.push({field:path,code:'SEGMENT_TOO_SHORT'});
  if (finite(W)&&finite(H) && (!insideEnvelope(n(s.x1),n(s.y1),W,H) || !insideEnvelope(n(s.x2),n(s.y2),W,H))) {
    issues.push({field:path,code:'SEGMENT_OUTSIDE_ENVELOPE'});
  }
}

export function buildFloorSpec(lectura={}) {
  const issues=[]; const warnings=[];
  const W=n(lectura?.envolvente?.ancho), H=n(lectura?.envolvente?.largo);
  if (!finite(W)||!finite(H)||W<=0||H<=0||W>500000||H>500000) issues.push({field:'envolvente',code:'INVALID_ENVELOPE'});

  const gh=Array.isArray(lectura?.grid?.horizontal)?lectura.grid.horizontal:[];
  const gv=Array.isArray(lectura?.grid?.vertical)?lectura.grid.vertical:[];
  if ([...gh,...gv].some(x=>!finite(x)||n(x)<=0)) issues.push({field:'grid',code:'INVALID_GRID_SEGMENT'});
  const sumH=gh.reduce((a,x)=>a+n(x),0), sumV=gv.reduce((a,x)=>a+n(x),0);
  if (lectura?.tieneCotas && finite(W) && gh.length) {
    const tol=Math.max(50,W*0.01); if (Math.abs(sumH-W)>tol) issues.push({field:'grid.horizontal',code:'GRID_ENVELOPE_MISMATCH',sum_mm:sumH,envelope_mm:W,tolerance_mm:tol});
  }
  if (lectura?.tieneCotas && finite(H) && gv.length) {
    const tol=Math.max(50,H*0.01); if (Math.abs(sumV-H)>tol) issues.push({field:'grid.vertical',code:'GRID_ENVELOPE_MISMATCH',sum_mm:sumV,envelope_mm:H,tolerance_mm:tol});
  }

  const dimensions=Array.isArray(lectura?.cotas)?lectura.cotas:[];
  if (lectura?.tieneCotas && !dimensions.length && !(gh.length||gv.length)) {
    warnings.push({field:'cotas',code:'DIMENSION_AUTHORITY_WEAK',message:'El plano declara cotas pero no se extrajeron cotas estructuradas.'});
  }
  if (!lectura?.tieneCotas) warnings.push({field:'tieneCotas',code:'NO_DIMENSION_AUTHORITY',message:'Requiere una referencia real antes de liberar geometría.'});

  const areas=Array.isArray(lectura?.areas)?lectura.areas:[];
  if (!areas.length) issues.push({field:'areas',code:'NO_AREAS'});
  const names=areas.map(a=>String(a?.nombre||'').trim()).filter(Boolean);
  const nameSet=new Set(names);
  if (nameSet.size!==names.length) issues.push({field:'areas',code:'DUPLICATE_ZONE_NAME'});
  let topArea=0;
  const zones=[];
  areas.forEach((a,i)=>{
    const name=String(a?.nombre||'').trim();
    if (!name) issues.push({field:`areas[${i}].nombre`,code:'MISSING_ZONE_NAME'});
    if (!['poligono','circulo'].includes(a?.forma)) issues.push({field:`areas[${i}].forma`,code:'INVALID_SHAPE'});
    const parent=String(a?.dentroDe||'').trim();
    if (parent && !nameSet.has(parent)) issues.push({field:`areas[${i}].dentroDe`,code:'UNKNOWN_PARENT_ZONE',value:parent});
    if (parent && parent===name) issues.push({field:`areas[${i}].dentroDe`,code:'SELF_PARENT_ZONE'});
    const puestos=n(a?.puestos);
    if (!Number.isInteger(puestos)||puestos<0||puestos>10000) issues.push({field:`areas[${i}].puestos`,code:'INVALID_WORKSTATION_COUNT'});
    if (norm(a?.confianza)==='baja') warnings.push({field:`areas[${i}]`,code:'LOW_CONFIDENCE_ZONE',zone:name});
    if (a?.forma==='poligono') {
      const pts=Array.isArray(a?.puntos)?a.puntos:[];
      if (pts.length<3) issues.push({field:`areas[${i}].puntos`,code:'POLYGON_NEEDS_3_POINTS'});
      pts.forEach((p,j)=>{
        if (![p?.x,p?.y].every(finite)) issues.push({field:`areas[${i}].puntos[${j}]`,code:'NON_FINITE_POINT'});
        else if (finite(W)&&finite(H)&&!insideEnvelope(n(p.x),n(p.y),W,H)) issues.push({field:`areas[${i}].puntos[${j}]`,code:'POINT_OUTSIDE_ENVELOPE',x:n(p.x),y:n(p.y)});
      });
      if (polygonArea(pts)<=1) issues.push({field:`areas[${i}].puntos`,code:'ZERO_AREA_POLYGON'});
    } else if (a?.forma==='circulo') {
      const cx=n(a?.circulo?.cx),cy=n(a?.circulo?.cy),r=n(a?.circulo?.r);
      if (![cx,cy,r].every(finite)||r<=0) issues.push({field:`areas[${i}].circulo`,code:'INVALID_CIRCLE'});
      else if (finite(W)&&finite(H)&&(cx-r<0||cy-r<0||cx+r>W||cy+r>H)) issues.push({field:`areas[${i}].circulo`,code:'CIRCLE_OUTSIDE_ENVELOPE'});
    }
    const sqm=areaOfZone(a)/1e6; if(!parent) topArea+=sqm;
    zones.push({id:`zone_${i+1}`,source_index:i,name,source_tipo:a?.tipo,zone_role:roleOf(a?.tipo),shape:a?.forma,points_mm:a?.forma==='poligono'?(a?.puntos||[]):[],circle_mm:a?.forma==='circulo'?(a?.circulo||null):null,parent_name:parent||null,observed_workstations:puestos,confidence:a?.confianza,area_m2:round2(sqm)});
  });

  const envelopeArea=finite(W)&&finite(H)?W*H/1e6:0;
  if (envelopeArea>0 && topArea>envelopeArea*1.08) issues.push({field:'areas',code:'TOP_LEVEL_AREA_EXCEEDS_ENVELOPE',top_level_m2:round2(topArea),envelope_m2:round2(envelopeArea)});

  const walls=Array.isArray(lectura?.muros)?lectura.muros:[];
  walls.forEach((s,i)=>validateSegment(s,i,'muros',W,H,issues));
  if (!walls.length) warnings.push({field:'muros',code:'NO_WALLS_DETECTED'});

  const windows=Array.isArray(lectura?.ventanas)?lectura.ventanas:[];
  windows.forEach((s,i)=>validateSegment(s,i,'ventanas',W,H,issues));

  const doors=Array.isArray(lectura?.puertas)?lectura.puertas:[];
  if (!doors.length) warnings.push({field:'puertas',code:'NO_DOORS_DETECTED'});
  doors.forEach((d,i)=>{
    const x=n(d?.x), y=n(d?.y), w=n(d?.ancho);
    if (![x,y,w].every(finite)||w<=0) { issues.push({field:`puertas[${i}]`,code:'INVALID_DOOR'}); return; }
    if (finite(W)&&finite(H)&&(!insideEnvelope(x,y,W,H)||w>Math.max(W,H))) issues.push({field:`puertas[${i}]`,code:'DOOR_OUTSIDE_ENVELOPE'});
    if (walls.length) {
      const nearest=Math.min(...walls.map(s=>pointSegmentDistance(x,y,n(s.x1),n(s.y1),n(s.x2),n(s.y2))));
      if (nearest>600) issues.push({field:`puertas[${i}]`,code:'DOOR_NOT_ON_WALL',distance_mm:round2(nearest)});
      else if (nearest>300) warnings.push({field:`puertas[${i}]`,code:'DOOR_WALL_ALIGNMENT_LOW_CONFIDENCE',distance_mm:round2(nearest)});
    }
  });

  const finishes=Array.isArray(lectura?.acabados)?lectura.acabados:[];
  const equipment=Array.isArray(lectura?.equipamiento)?lectura.equipamiento:[];
  const evidence=Array.isArray(lectura?.evidencias)?lectura.evidencias:[];
  const authority = {
    dimensions: !!lectura?.tieneCotas && (dimensions.length>0 || gh.length>0 || gv.length>0),
    walls: walls.length>0,
    doors: doors.length>0,
    zones: areas.length>0,
    finishes: finishes.length>0,
  };
  const authorityScore=round2((authority.dimensions?0.30:0)+(authority.walls?0.20:0)+(authority.doors?0.15:0)+(authority.zones?0.25:0)+(authority.finishes?0.10:0));
  if (authorityScore<0.7) warnings.push({field:'source',code:'LOW_EXTRACTION_COVERAGE',authority_score:authorityScore});

  const state=issues.length?'FAIL':warnings.length?'REVIEW_REQUIRED':'PASS';
  return {
    version:'FLOOR_SPEC_V2',
    envelope:{width_mm:W,depth_mm:H,area_m2:round2(envelopeArea)},
    grid_mm:{horizontal:gh,vertical:gv},
    zones,
    walls_mm:walls,
    doors_mm:doors,
    windows_mm:windows,
    dimensions,
    finishes,
    equipment,
    source:{scale_evidence:lectura?.escala||'',has_dimensions:!!lectura?.tieneCotas,notes:Array.isArray(lectura?.notas)?lectura.notas:[],evidence},
    validation:{state,issues,warnings,metrics:{top_level_area_m2:round2(topArea),envelope_area_m2:round2(envelopeArea),zones:areas.length,walls:walls.length,doors:doors.length,windows:windows.length,dimensions:dimensions.length,finishes:finishes.length,equipment:equipment.length,authority_score:authorityScore}}
  };
}

const GOLDEN_132 = {
  width_mm:15000, depth_mm:8800, area_m2:132,
  requiredZones:['recepcion','colaboracion','archivo apoyo','open space','sala de juntas','direccion','coffee print'],
  openSpaceWorkstations:8,
  equipment:{'r 01':1,'b 01':4,'s 01':8,'j 01':1,'sj 01':8,'d 01':1,'cr 01':1,'cf 01':1},
};

export function evaluateGolden132(lectura={}, floorSpec=buildFloorSpec(lectura)) {
  const checks=[];
  const add=(id,ok,actual,expected,tolerance=null)=>checks.push({id,ok:!!ok,actual,expected,tolerance});
  const W=n(floorSpec?.envelope?.width_mm),H=n(floorSpec?.envelope?.depth_mm),A=n(floorSpec?.envelope?.area_m2);
  add('envelope.width',Math.abs(W-GOLDEN_132.width_mm)<=150,W,GOLDEN_132.width_mm,150);
  add('envelope.depth',Math.abs(H-GOLDEN_132.depth_mm)<=88,H,GOLDEN_132.depth_mm,88);
  add('envelope.area',Math.abs(A-GOLDEN_132.area_m2)<=1.32,A,GOLDEN_132.area_m2,1.32);
  const zoneNames=(floorSpec?.zones||[]).map(z=>norm(z?.name));
  for (const z of GOLDEN_132.requiredZones) add(`zone.${z}`,zoneNames.some(x=>x===z||x.includes(z)||z.includes(x)),zoneNames,z);
  const open=(floorSpec?.zones||[]).find(z=>norm(z?.name).includes('open space'));
  add('open_space.workstations',n(open?.observed_workstations)===8,n(open?.observed_workstations),8);
  add('doors.present',(floorSpec?.doors_mm||[]).length>=4,(floorSpec?.doors_mm||[]).length,'>=4');
  add('walls.present',(floorSpec?.walls_mm||[]).length>=8,(floorSpec?.walls_mm||[]).length,'>=8');
  add('dimensions.authoritative',!!floorSpec?.source?.has_dimensions && n(floorSpec?.validation?.metrics?.authority_score)>=0.7,{has_dimensions:floorSpec?.source?.has_dimensions,authority_score:floorSpec?.validation?.metrics?.authority_score},'has_dimensions=true and authority_score>=0.7');
  const eqMap={};
  for (const e of floorSpec?.equipment||[]) { const id=norm(e?.id); if(id) eqMap[id]=(eqMap[id]||0)+n(e?.cantidad||0); }
  for (const [id,q] of Object.entries(GOLDEN_132.equipment)) add(`equipment.${id}`,n(eqMap[id])===q,n(eqMap[id]||0),q);
  const passed=checks.filter(c=>c.ok).length;
  return {profile:'QA-COT-01',pass:passed===checks.length,score:round2(passed/checks.length),passed,total:checks.length,checks};
}
