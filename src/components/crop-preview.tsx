'use client';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { clampRect, type Mode, type PageRecord, type Rect } from '@/lib/types';
import { LoaderCircle } from 'lucide-react';
type Props = { doc: PDFDocumentProxy; page: PageRecord; mode: Mode; crop: Rect; onChange: (crop: Rect)=>void };
export default function CropPreview({doc,page,crop,onChange}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{x:number;y:number;rect:Rect;kind:string}|null>(null);
  const [loading,setLoading] = useState(true), [error,setError] = useState('');
  useEffect(()=>{
    let disposed = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setLoading(true); setError('');
    (async()=>{
      const source = await doc.getPage(page.pageIndex+1);
      if(disposed || !canvas.current) return;
      const scale = Math.min(2,1400/page.width);
      const viewport = source.getViewport({scale});
      canvas.current.width = Math.ceil(viewport.width); canvas.current.height = Math.ceil(viewport.height);
      const ctx = canvas.current.getContext('2d');
      if(!ctx) throw new Error('Canvas preview is unavailable.');
      render = source.render({canvas:canvas.current,canvasContext:ctx,viewport,background:'white'});
      await render.promise;
      if(!disposed) setLoading(false);
    })().catch(e=>{if(!disposed && e?.name!=='RenderingCancelledException'){setError('Preview could not render. Re-upload this PDF.');setLoading(false);}});
    return ()=>{disposed=true;render?.cancel();};
  },[doc,page.pageIndex,page.width]);
  function pointerMove(e:React.PointerEvent<HTMLDivElement>) {
    if(!drag.current || !stage.current) return;
    const box = stage.current.getBoundingClientRect(), start = drag.current;
    const dx = (e.clientX-start.x)/box.width*page.width, dy = (e.clientY-start.y)/box.height*page.height;
    let next = {...start.rect};
    if(start.kind==='move') { next.x=Math.max(0,Math.min(page.width-next.width,next.x+dx));next.y=Math.max(0,Math.min(page.height-next.height,next.y+dy)); }
    else {
      let l=next.x,t=next.y,r=l+next.width,b=t+next.height;
      if(start.kind.includes('w')) l=Math.min(r-8,Math.max(0,l+dx));
      if(start.kind.includes('e')) r=Math.max(l+8,Math.min(page.width,r+dx));
      if(start.kind.includes('n')) t=Math.min(b-8,Math.max(0,t+dy));
      if(start.kind.includes('s')) b=Math.max(t+8,Math.min(page.height,b+dy));
      next={x:l,y:t,width:r-l,height:b-t};
    }
    onChange(clampRect(next,page.width,page.height));
  }
  function start(e:React.PointerEvent<HTMLElement>,kind:string) {
    e.preventDefault();e.stopPropagation();
    drag.current={x:e.clientX,y:e.clientY,rect:{...crop},kind};
    stage.current?.setPointerCapture(e.pointerId);
  }
  return <div className="preview-surface">
    <div ref={stage} className="pdf-stage" style={{aspectRatio:`${page.width}/${page.height}`}} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <canvas ref={canvas} aria-label={`Source PDF page ${page.pageIndex+1}`} />
      {!loading&&!error&&<div className="crop-box" style={{left:`${crop.x/page.width*100}%`,top:`${crop.y/page.height*100}%`,width:`${crop.width/page.width*100}%`,height:`${crop.height/page.height*100}%`}} onPointerDown={e=>start(e,'move')}>
        <span className="crop-caption">PRINT AREA</span>
        {['nw','ne','sw','se'].map(corner=><button key={corner} aria-label={`Resize ${corner} corner`} className={`crop-handle ${corner}`} onPointerDown={e=>start(e,corner)} />)}
      </div>}
      {loading&&<div className="preview-loading"><LoaderCircle className="spin" size={24}/><span>Rendering page…</span></div>}
      {error&&<div className="preview-loading error-text" role="alert">{error}</div>}
    </div>
  </div>;
}
