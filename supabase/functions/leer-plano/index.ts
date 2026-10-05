import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildFloorSpec, evaluateGolden132 } from "./floor-spec.js";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const finite=(x:any)=>Number.isFinite(Number(x));
const b64bytes=(s:string)=>{const n=(s||'').length;const pad=s.endsWith('==')?2:s.endsWith('=')?1:0;return Math.max(0,Math.floor(n*3/4)-pad)};
function json(obj:unknown,status=200){return new Response(JSON.stringify(obj),{status,headers:{...CORS,"content-type":"application/json"}})}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return json({ok:false,code:"METHOD_NOT_ALLOWED",error:"Usa POST"},405);
  const URL=Deno.env.get("SUPABASE_URL"), SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), ANON=Deno.env.get("SUPABASE_ANON_KEY");
  if(!URL||!SERVICE) return json({ok:false,code:"SERVER_CONFIG",error:"Falta configuración del servidor."},500);
  const authHeader=req.headers.get("Authorization")||""; if(!authHeader.startsWith("Bearer ")) return json({ok:false,code:"UNAUTHENTICATED",error:"No autenticado."},401);
  const userClient=createClient(URL,ANON||SERVICE,{global:{headers:{Authorization:authHeader}}});
  const {data:ud,error:ue}=await userClient.auth.getUser(); const email=ud?.user?.email||"";
  if(ue||!email) return json({ok:false,code:"UNAUTHENTICATED",error:"Sesión inválida."},401);
  const svc=createClient(URL,SERVICE); const {data:permit,error:pe}=await svc.from("permitidos").select("rol").eq("email",email).maybeSingle();
  if(pe||!permit) return json({ok:false,code:"FORBIDDEN",error:"Usuario no autorizado."},403);
  const rol=String(permit.rol||"").toLowerCase(); if(!["direccion","diseno","diseño","vendedor"].includes(rol)) return json({ok:false,code:"FORBIDDEN_CAPABILITY",error:"Tu rol no puede leer planos."},403);

  let body:any; try{body=await req.json()}catch{return json({ok:false,code:"INVALID_JSON",error:"JSON inválido."},400)}
  const image=typeof body?.image==="string"?body.image:"", mediaType=String(body?.mediaType||"image/jpeg");
  const MIME_OK=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
  if(!image) return json({ok:false,code:"MISSING_IMAGE",error:"Falta el plano."},400);
  if(!MIME_OK.has(mediaType)) return json({ok:false,code:"UNSUPPORTED_MEDIA_TYPE",error:"Formato no soportado."},415);
  const bytes=b64bytes(image); if(bytes>25_000_000) return json({ok:false,code:"PAYLOAD_TOO_LARGE",error:"El plano excede 25 MB decodificados."},413);
  if(body?.refMM!=null&&(!finite(body.refMM)||Number(body.refMM)<=0||Number(body.refMM)>1_000_000)) return json({ok:false,code:"INVALID_REFERENCE",error:"refMM debe ser una medida positiva razonable."},400);

  const desde=new Date(Date.now()-3_600_000).toISOString();
  const [uCount,gCount]=await Promise.all([
    svc.from("ai_eventos").select("id",{count:"exact",head:true}).eq("fn","leer-plano").eq("email",email).gte("created_at",desde),
    svc.from("ai_eventos").select("id",{count:"exact",head:true}).eq("fn","leer-plano").gte("created_at",desde),
  ]);
  if(uCount.error||gCount.error) return json({ok:false,code:"RATE_LIMITER_UNAVAILABLE",error:"No se pudo verificar el límite de lectura de planos."},503);
  if((uCount.count??0)>=30) return json({ok:false,code:"RATE_LIMITED_USER",error:"Límite de 30 lecturas de plano por hora."},429);
  if((gCount.count??0)>=200) return json({ok:false,code:"RATE_LIMITED_GLOBAL",error:"Demasiadas lecturas de plano en este momento."},429);

  const requestId=crypto.randomUUID(), t0=Date.now(); let eventId:number|null=null;
  try{const {data:ev}=await svc.from("ai_eventos").insert({request_id:requestId,fn:"leer-plano",email,rol,modo:mediaType==="application/pdf"?"pdf":"imagen",images_count:1,payload_bytes:bytes,status:"started"}).select("id").maybeSingle();eventId=(ev as any)?.id??null}catch{}
  const finish=async(status:string,http:number,code?:string)=>{if(eventId==null)return;try{await svc.from("ai_eventos").update({status,http_status:http,finished_at:new Date().toISOString(),duration_ms:Date.now()-t0,error_code:code||null}).eq("id",eventId)}catch{}};

  let upstream:Response; try{upstream=await fetch(`${URL}/functions/v1/leer-plano-core`,{method:"POST",headers:{"content-type":"application/json","Authorization":authHeader,"apikey":ANON||SERVICE},body:JSON.stringify(body)})}catch{await finish("error",502,"UPSTREAM_UNREACHABLE");return json({ok:false,code:"UPSTREAM_UNREACHABLE",error:"No se pudo contactar Document Intelligence.",request_id:requestId},502)}
  let data:any; try{data=await upstream.json()}catch{await finish("error",502,"UPSTREAM_INVALID_JSON");return json({ok:false,code:"UPSTREAM_INVALID_JSON",error:"Document Intelligence no devolvió JSON válido.",request_id:requestId},502)}
  if(!upstream.ok||!data?.ok){await finish("error",upstream.status||502,data?.code||"UPSTREAM_ERROR");return json({...data,request_id:requestId},upstream.status||502)}

  const lectura=data.lectura||{}; const floorSpec=buildFloorSpec(lectura); const state=floorSpec?.validation?.state;
  const qaProfile=String(body?.qaProfile||"").toUpperCase(); const golden=qaProfile==="QA-COT-01"?evaluateGolden132(lectura,floorSpec):null;
  if(state==="FAIL"){await finish("rejected",422,"FLOOR_SPEC_INVALID");return json({ok:false,code:"FLOOR_SPEC_INVALID",error:"La lectura no pasó la validación determinista de FloorSpec.",lectura,floorSpec,qa:golden,request_id:requestId},422)}
  if(golden && !golden.pass){await finish("rejected",422,"GOLDEN_GATE_FAILED");return json({ok:false,code:"GOLDEN_GATE_FAILED",error:"El lector no reprodujo el golden QA-COT-01 dentro de tolerancia.",lectura,floorSpec,qa:golden,request_id:requestId},422)}
  const review=state==="REVIEW_REQUIRED"; await finish("ok",200,review?"REVIEW_REQUIRED":undefined);
  return json({...data,request_id:requestId,floorSpec,qa:golden,strictGeometry:true,documentIntelligence:true,review_required:review},200);
});
