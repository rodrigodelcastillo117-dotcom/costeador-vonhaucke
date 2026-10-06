// Pipeline rapido para PDFs: preview primero, resto bajo demanda. Evita rasterizar N paginas
// secuencialmente antes de que el usuario pueda trabajar.
import { abrirPdf, paginaAImagen } from './pdfImagen.js';

export async function prepararPdfRapido(file,{previewPx=1200}={}){
  const t0=performance.now();
  const doc=await abrirPdf(file);
  const preview=await paginaAImagen(doc,1,previewPx);
  return {doc,numPaginas:doc.numPaginas,preview,pagina:1,msAFirstPreview:Math.round(performance.now()-t0)};
}

export async function rasterizarPaginas(docWrap,paginas,{maxPx=1600,concurrency=3,onProgress}={}){
  const nums=[...new Set((paginas||[]).map(Number).filter(n=>n>=1&&n<=docWrap.numPaginas))];
  const out=new Array(nums.length); let next=0,done=0;
  async function worker(){
    while(next<nums.length){
      const i=next++; const n=nums[i];
      const dataUrl=await paginaAImagen(docWrap,n,maxPx);
      out[i]={pagina:n,base64:dataUrl.split(',')[1]};
      done++; onProgress?.({done,total:nums.length,pagina:n});
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,nums.length||1)},worker));
  return out;
}

export function paginasAlrededor(seleccion,total,radio=1){
  const n=Math.max(1,Math.min(total,Number(seleccion)||1));
  const r=[]; for(let i=Math.max(1,n-radio);i<=Math.min(total,n+radio);i++) r.push(i);
  return r;
}


/**
 * Ventana acotada para análisis multi-vista. Evita mandar PDFs enormes completos
 * a visión: conserva la hoja elegida y sus vecinas, que suelen ser alzados/detalles
 * del mismo mueble. Para PDFs chicos mantiene todas las hojas.
 */
export function paginasParaAnalisis(seleccion,total,maxPaginas=8){
  const t=Math.max(0,Number(total)||0), m=Math.max(1,Math.floor(Number(maxPaginas)||8));
  if(!t)return [];
  if(t<=m)return Array.from({length:t},(_,i)=>i+1);
  const s=Math.max(1,Math.min(t,Number(seleccion)||1));
  let inicio=s-Math.floor((m-1)/2);
  inicio=Math.max(1,Math.min(inicio,t-m+1));
  return Array.from({length:m},(_,i)=>inicio+i);
}
