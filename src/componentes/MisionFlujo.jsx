import React from 'react';

const TONES={
  ok:{border:'#77b58c',bg:'#eef8f1',fg:'#245d36'},
  attention:{border:'#d8b56a',bg:'#fff8e8',fg:'#7a5600'},
  blocked:{border:'#d58e88',bg:'#fff1ef',fg:'#8f2f29'},
  neutral:{border:'var(--linea)',bg:'var(--panel)',fg:'var(--carbon)'},
};

export default function MisionFlujo({
  titulo='Tu avance',
  paso=1,
  total=4,
  estado='neutral',
  resumen='',
  siguiente='',
  items=[],
  compacto=false,
}) {
  const t=TONES[estado]||TONES.neutral;
  const safeTotal=Math.max(1,Number(total)||1);
  const safePaso=Math.max(1,Math.min(safeTotal,Number(paso)||1));
  const pct=Math.round((safePaso/safeTotal)*100);
  return (
    <section className="no-imprimir" aria-label={titulo}
      style={{border:`1px solid ${t.border}`,background:t.bg,color:t.fg,borderRadius:12,padding:compacto?'10px 12px':'12px 14px',marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline',flexWrap:'wrap'}}>
        <strong style={{fontSize:compacto?13:14}}>{titulo}</strong>
        <span style={{fontSize:11,fontWeight:800,opacity:.78}}>Paso {safePaso} de {safeTotal}</span>
      </div>
      <div style={{height:5,borderRadius:999,background:'rgba(0,0,0,.08)',overflow:'hidden',marginTop:7}}>
        <div style={{height:'100%',width:`${pct}%`,background:t.fg,transition:'width .2s ease'}} />
      </div>
      {resumen && <div style={{fontSize:12,lineHeight:1.45,marginTop:7}}>{resumen}</div>}
      {!!items.length && (
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
          {items.map((x,i)=>(
            <span key={x.key||i} style={{
              border:'1px solid rgba(0,0,0,.12)',borderRadius:999,padding:'3px 7px',
              fontSize:10,fontWeight:700,background:x.ok?'rgba(42,126,68,.10)':'rgba(255,255,255,.55)',
              opacity:x.ok?1:.72,
            }}>{x.ok?'✓':'○'} {x.label}</span>
          ))}
        </div>
      )}
      {siguiente && <div style={{fontSize:11,marginTop:8}}><b>Siguiente:</b> {siguiente}</div>}
    </section>
  );
}
