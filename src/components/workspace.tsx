'use client';
import { OptionSelect } from './option-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ArrowDownToLine, ArrowRight, Check, CheckCheck, ChevronLeft, ChevronRight, Crop, FileText, Files, HelpCircle, LoaderCircle, LockKeyhole, Package, Plus, RotateCcw, Scissors, ShieldCheck, Trash2, UploadCloud, X } from 'lucide-react';
import CropPreview from './crop-preview';
import VendorTools from './vendor-tools';
import OrderEditor from './order-editor';
import PrintControls from './print-controls';
import { applyCropToMatching, clonePageCrop, DEFAULT_OPTIONS, duplicateIds, newId, restorePrintOptions, sameBytes, validatePrintOptions } from '@/lib/batch';
import { PAPER_PRESETS as papers, printInstructions, singleLabelSize } from '@/lib/paper';
import { analyzePage, friendlyPdfError, openPdf } from '@/lib/pdf-browser';
import { clampRect, getCrop, needsReview, type ExportOptions, type Mode, type PageRecord, type Rect, type SourceFile } from '@/lib/types';
const modeLabels: Record<Mode,string> = {label:'Labels only',combined:'Labels + invoices',invoice:'Invoices only'};
const bytesLabel = (n:number)=>`${(n/1024/1024).toFixed(1)} MB`;
export default function Workspace() {
  const [sources,setSources]=useState<SourceFile[]>([]),[pages,setPages]=useState<PageRecord[]>([]),[active,setActive]=useState('');
  const [options,setOptions]=useState<ExportOptions>({...DEFAULT_OPTIONS});
  const [allowReprints,setAllowReprints]=useState(false),[prefsReady,setPrefsReady]=useState(false);
  const [busy,setBusy]=useState(false),[exporting,setExporting]=useState(false),[status,setStatus]=useState(''),[progress,setProgress]=useState(0);
  const [messages,setMessages]=useState<string[]>([]),[success,setSuccess]=useState(''),[dragging,setDragging]=useState(false),[help,setHelp]=useState(false);
  const docs=useRef(new Map<string,PDFDocumentProxy>()),input=useRef<HTMLInputElement>(null),run=useRef(0);
  useEffect(()=>{try{const stored=localStorage.getItem('labeldesk.print.v1');if(stored)setOptions(restorePrintOptions(JSON.parse(stored)));}catch{}setPrefsReady(true);},[]);
  useEffect(()=>{if(!prefsReady)return;try{validatePrintOptions(options);localStorage.setItem('labeldesk.print.v1',JSON.stringify(options));}catch{}},[options,prefsReady]);
  useEffect(()=>setAllowReprints(false),[pages,options.mode]);
  const sourceRef=useRef(sources);sourceRef.current=sources;
  useEffect(()=>()=>{run.current++;for(const doc of docs.current.values())void doc.destroy();docs.current.clear();},[]);
  const selected=pages.find(p=>p.id===active)??pages[0],included=pages.filter(p=>p.included);
  const reviews=included.filter(p=>needsReview(p,options.mode));
  const repeats=duplicateIds(pages,options.mode);
  let printError='';try{validatePrintOptions(options);}catch(error){printError=error instanceof Error?error.message:'Check print settings.';}
  const crop=selected?(getCrop(selected,options.mode)??selected.combined):null;
  const changed=!!selected?.overrides[options.mode];
  const locked=busy||exporting;
  const importFiles=useCallback(async(files:File[])=>{
    if(!files.length||locked)return;
    const token=++run.current;
    setBusy(true);setMessages([]);setSuccess('');setProgress(0);
    let totalBytes=sourceRef.current.reduce((n,s)=>n+s.bytes.byteLength,0),totalPages=pages.length;
    const errors:string[]=[];
    const knownSources=[...sourceRef.current];
    try {
      for(let f=0;f<files.length;f++){
        if(token!==run.current)return;
        const file=files[f];let doc:PDFDocumentProxy|undefined;
        try {
          if(!/\.pdf$/i.test(file.name))throw new Error('Choose a .pdf file.');
          if(file.size>30*1024*1024)throw new Error('File exceeds the 30 MB limit. Split it into smaller PDFs.');
          if(totalBytes+file.size>100*1024*1024)throw new Error('This workspace has a 100 MB limit. Clear it or process a smaller batch.');
          if(file.size===0)throw new Error('This file is empty.');
          setStatus(`Opening ${file.name}`);
          const bytes=new Uint8Array(await file.arrayBuffer());
          if(knownSources.some(source=>sameBytes(source.bytes,bytes)))throw new Error('This PDF is already in the workspace. Use Add another crop to split a page instead of uploading it twice.');
          if(!new TextDecoder().decode(bytes.subarray(0,1024)).includes('%PDF-'))throw new Error('This file does not contain a valid PDF header.');
          doc=await openPdf(bytes);
          if(totalPages+doc.numPages>300)throw new Error('A batch can contain up to 300 pages. Split this file and try again.');
          if(token!==run.current){await doc.destroy();return;}
          const source:SourceFile={id:newId(),name:file.name,bytes,pages:doc.numPages};
          const analyzed:PageRecord[]=[];
          for(let n=1;n<=doc.numPages;n++){
            setStatus(`Reading ${file.name} · page ${n} of ${doc.numPages}`);
            analyzed.push(await analyzePage(await doc.getPage(n),source));
            if(token!==run.current){await doc.destroy();return;}
            setProgress(Math.round((f+(n/doc.numPages))/files.length*100));
            await new Promise(r=>setTimeout(r,0));
          }
          docs.current.set(source.id,doc);doc=undefined;
          totalBytes+=file.size;totalPages+=source.pages;knownSources.push(source);
          setSources(prev=>[...prev,source]);setPages(prev=>[...prev,...analyzed]);setActive(prev=>prev||analyzed[0]?.id||'');
        }catch(e){if(doc)await doc.destroy();if(token!==run.current)return;errors.push(`${file.name}: ${friendlyPdfError(e)}`);}
      }
      setMessages(errors);
    }finally{if(token===run.current){setBusy(false);setStatus('');setProgress(0);}}
  },[locked,pages.length]);
  function updatePage(id:string,patch:Partial<PageRecord>){setSuccess('');setPages(prev=>prev.map(p=>p.id===id?{...p,...patch}:p));}
  function updateCrop(rect:Rect){if(!selected)return;updatePage(selected.id,{overrides:{...selected.overrides,[options.mode]:rect},approved:false});}
  function confirmCrop(){if(!selected||!crop)return;updatePage(selected.id,{approved:!selected.approved,overrides:getCrop(selected,options.mode)?selected.overrides:{...selected.overrides,[options.mode]:crop}});}
  function resetCrop(){if(!selected)return;const overrides={...selected.overrides};delete overrides[options.mode];updatePage(selected.id,{overrides,approved:false});}
  function cancelImport(){run.current++;setBusy(false);setStatus('');setProgress(0);}
  function clear(){if(locked)return;for(const doc of docs.current.values())void doc.destroy();docs.current.clear();setSources([]);setPages([]);setActive('');setMessages([]);setSuccess('');}
  function removeSource(id:string){if(locked)return;void docs.current.get(id)?.destroy();docs.current.delete(id);setSources(prev=>prev.filter(s=>s.id!==id));setPages(prev=>prev.filter(p=>p.sourceId!==id));setSuccess('');}
  async function download(onlyId?:string){
    const target=onlyId?pages.filter(p=>p.id===onlyId).map(p=>({...p,included:true})):pages;
    const targetPages=target.filter(p=>p.included);
    if(locked||!targetPages.length||targetPages.some(p=>needsReview(p,options.mode))||printError)return;
    if(!allowReprints&&duplicateIds(target,options.mode).size){setMessages(['Exclude possible duplicates or enable intentional duplicate labels in the batch tools.']);return;}
    setExporting(true);setMessages([]);setSuccess('');setProgress(0);setStatus('Preparing print-ready PDF…');
    try{
      const {exportPdf}=await import('@/lib/pdf-export');
      const data=await exportPdf(sources,target,options,setProgress,allowReprints);
      const url=URL.createObjectURL(new Blob([new Uint8Array(data)],{type:'application/pdf'}));
      const link=document.createElement('a');link.href=url;link.download=`labeldesk-${options.mode}-${options.paper}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      const ids=new Set(targetPages.map(p=>p.id));const timestamp=new Date().toISOString();
      setPages(prev=>prev.map(p=>ids.has(p.id)?{...p,exportedAt:timestamp}:p));
      setSuccess(`${targetPages.length} label entries × ${options.copies??1} copies exported. Print at Actual size / 100%.`);
    }catch(e){setMessages([friendlyPdfError(e)]);}finally{setExporting(false);setStatus('');setProgress(0);}
  }
  const activeIndex=selected?pages.findIndex(p=>p.id===selected.id):-1;
  return <div className={`app-shell ${pages.length?'has-pages':''}`}>
    <header className="topbar"><a className="brand" href="/" aria-label="LabelDesk home"><span className="brand-mark"><Scissors size={20}/></span>Label<span>Desk</span></a><span className="header-divider"/><span className="header-subtitle">Seller workspace</span><div className="topbar-right"><span className="private-pill"><span className="live-dot"/>Browser-only processing</span><Button className="text-button help-button" onClick={()=>setHelp(v=>!v)} aria-expanded={help}><HelpCircle size={17}/>Quick guide</Button></div></header>
    <main>
      <div className="page-heading"><div className="eyebrow"><span/>PACK SMARTER. SHIP FASTER.</div><h1>Your labels. Ready to ship.</h1><p>Turn bulky order PDFs into clean, print-ready shipping labels.</p></div>
      {help&&<section className="guide panel"><Button className="icon-button close-guide" aria-label="Close guide" onClick={()=>setHelp(false)}><X size={17}/></Button><h2>A clean label in three steps</h2><p><b>1.</b> Add the original order PDFs from your seller panel. <b>2.</b> Choose your output and check the green print area. Drag its corners or use exact crop values. <b>3.</b> Confirm pages marked for review, then download and print at 100%.</p><p>Scans and unfamiliar layouts need manual review. For multiple labels on one page, use Add another crop, adjust each region and confirm each crop. Invoice mode needs a detected invoice or a confirmed manual crop. Cropping changes the visible print area; it is not secure redaction.</p></section>}
      <div className="workflow"><span className="step active"><b>1</b>Add PDFs</span><span className="step-line"/><span className={`step ${pages.length?'active':''}`}><b>2</b>Review & customize</span><span className="step-line"/><span className={`step ${included.length&&!reviews.length?'active':''}`}><b>3</b>Download & print</span><span className="workflow-note"><LockKeyhole size={13}/>Your files stay on this device</span></div>
      {messages.length>0&&<div className="message error-message" role="alert"><div>{messages.map((m,i)=><p key={i}>{m}</p>)}</div><Button className="icon-button" aria-label="Dismiss error" onClick={()=>setMessages([])}><X size={16}/></Button></div>}
      {success&&<div className="message success-message" role="status"><CheckCheck size={19}/><p>{success}</p></div>}
      {locked&&<div className="processing" role="status" aria-live="polite"><div><LoaderCircle size={16} className="spin"/>{status}<span>{progress}%</span>{busy&&<Button className="text-button" onClick={cancelImport}>Cancel</Button>}</div><progress value={progress} max={100}/></div>}
      <div className="workspace-grid"><aside className="controls">
        <section className="panel upload-panel"><div className="section-title"><span className="section-number">01</span><h2>Source files</h2>{sources.length>0&&<span className="count-badge">{sources.length}</span>}</div>
          <input ref={input} type="file" accept="application/pdf,.pdf" multiple className="sr-only" aria-label="Upload shipping label PDFs" disabled={locked} onChange={e=>{void importFiles(Array.from(e.target.files??[]));e.target.value='';}}/>
          <Button className={`dropzone ${dragging?'dragging':''}`} disabled={locked} onClick={()=>input.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void importFiles(Array.from(e.dataTransfer.files));}}><span className="upload-icon"><UploadCloud size={25} strokeWidth={1.6}/></span><strong>Drop your label PDFs here</strong><span>or <em>browse files</em> to upload</span><small>PDF only · 30 MB per file · 300 pages per batch</small></Button>
          {!!sources.length&&<div className="source-list">{sources.map(s=><div className="source-row" key={s.id}><span className="file-icon"><FileText size={18}/></span><div><strong title={s.name}>{s.name}</strong><small>{s.pages} {s.pages===1?'page':'pages'} · {bytesLabel(s.bytes.byteLength)}</small></div><Button className="icon-button" disabled={locked} aria-label={`Remove ${s.name}`} onClick={()=>removeSource(s.id)}><X size={15}/></Button></div>)}<Button className="text-button add-more" disabled={locked} onClick={()=>input.current?.click()}><Plus size={14}/>Add more PDFs</Button></div>}
          <div className="privacy-note"><ShieldCheck size={15}/><span>No uploads to a server. No account needed.</span></div>
        </section>
        <section className="panel output-panel"><div className="section-title"><span className="section-number">02</span><h2>Output settings</h2><span className="tiny-tag">CUSTOMIZE</span></div>
          <fieldset disabled={locked}><legend>What would you like to keep?</legend><div className="mode-options">{(Object.keys(modeLabels) as Mode[]).map(mode=><label key={mode} className={`radio-option ${options.mode===mode?'selected':''}`}><input type="radio" name="mode" value={mode} checked={options.mode===mode} onChange={()=>{setOptions(prev=>({...prev,mode}));setSuccess('');setPages(prev=>prev.map(p=>({...p,approved:false})));}}/><span className="custom-radio"/><span>{modeLabels[mode]}</span>{mode==='label'&&<span className="recommended">POPULAR</span>}</label>)}</div></fieldset>
          <label className="field-label" htmlFor="paper">Print layout</label><OptionSelect id="paper" disabled={locked} value={options.paper} onValueChange={value=>{setOptions(prev=>({...prev,paper:value as ExportOptions['paper']}));setSuccess('');}} options={papers.map(p=>({value:p.value,label:p.name,description:p.description}))}/>
          <PrintControls options={options} disabled={locked} onChange={value=>{setOptions(value);setSuccess('');}}/>
          {printError&&<p className="print-error" role="alert">{printError}</p>}
          <label className="field-label" htmlFor="sort">Organize labels by</label><OptionSelect id="sort" disabled={locked} value={options.sort} onValueChange={value=>setOptions(prev=>({...prev,sort:value as ExportOptions['sort']}))} options={[{value:'original',label:'Original page order'},{value:'sku',label:'SKU · A to Z'},{value:'courier',label:'Delivery partner · A to Z'}]}/>
          {singleLabelSize(options.paper)&&<div className="label-print-guide"><p>{printInstructions(options.paper)}</p><p>Use stock made for your printer: direct-thermal labels for a direct-thermal printer, or compatible glossy stickers for inkjet/laser. Match the size printed on the label pack.</p></div>}
          {options.paper==='a4-4'&&<p className="field-help">Four labels fit on one A4 sheet. Check barcode and address readability before printing a batch.</p>}
        </section>
        <div className="local-note"><LockKeyhole size={17}/><p><strong>Private by design</strong><span>PDFs are processed in your browser and cleared when you reload or clear the workspace.</span></p></div>
      </aside>
      <section className="panel review-panel"><div className="review-header"><div><div className="section-title"><span className="section-number">03</span><h2>Preview & review</h2></div><p>{pages.length?'Check the print area before you export.':'Your shipping workspace, minus the busywork.'}</p></div>{!!pages.length&&<Button className="text-button reset-workspace" disabled={locked} onClick={clear}><Trash2 size={14}/>Clear</Button>}</div>
        {!selected?<div className="empty-state"><div className="empty-illustration"><div className="paper-back"/><div className="paper-front"><div className="mock-top"><Package size={21}/><span>SHIPPING LABEL</span></div><div className="mock-line long"/><div className="mock-line"/><div className="mock-line short"/><div className="mock-rule"/><div className="mock-barcode"/><div className="mock-code">READY FOR DISPATCH</div></div><span className="floating-check"><Check size={23}/></span><span className="crop-corner tl"/><span className="crop-corner br"/></div><h3>A little less paper.<br/>A lot less work.</h3><p>Add your order PDFs to preview, crop,<br/>and prepare your next shipment.</p><div className="empty-features"><span><Check size={13}/>Batch processing</span><span><Check size={13}/>Sharp barcodes</span><span><Check size={13}/>Invoice separation</span></div><Button className="text-button empty-cta" disabled={locked} onClick={()=>input.current?.click()}>Add your first PDF <ArrowRight size={15}/></Button></div>:
          <><div className="page-navigation"><Button className="icon-button" disabled={locked||activeIndex<=0} onClick={()=>setActive(pages[activeIndex-1].id)} aria-label="Previous page"><ChevronLeft size={18}/></Button><span>Page <b>{activeIndex+1}</b> of {pages.length}</span><Button className="icon-button" disabled={locked||activeIndex>=pages.length-1} onClick={()=>setActive(pages[activeIndex+1].id)} aria-label="Next page"><ChevronRight size={18}/></Button><span className="nav-file" title={selected.fileName}>{selected.fileName}</span><label className="include-toggle"><input type="checkbox" disabled={locked} checked={selected.included} onChange={e=>updatePage(selected.id,{included:e.target.checked})}/>Include</label></div>
          <div className="review-body"><div className="preview-column">{crop&&docs.current.get(selected.sourceId)&&<fieldset className="preview-fieldset" disabled={locked}><CropPreview key={selected.id} doc={docs.current.get(selected.sourceId)!} page={selected} mode={options.mode} crop={crop} onChange={updateCrop}/></fieldset>}<div className="preview-caption"><Crop size={13}/><span>Drag the green frame to adjust the print area</span><span>{Math.round(crop?.width??0)} × {Math.round(crop?.height??0)} pt</span></div></div>
          <div className="page-details"><div className={`detection-status ${needsReview(selected,options.mode)?'warning':''}`}><span className="status-dot"/>{selected.approved?'Confirmed':needsReview(selected,options.mode)?'Review required':changed?'Crop adjusted':'Auto-detected'}</div><p className="detection-reason">{options.mode==='invoice'&&!selected.invoice?'No separate invoice was detected. Set the invoice area manually and confirm it.':selected.reason}</p>
          <div className="detail-row"><span>Delivery partner</span><strong>{selected.courier||'Not detected'}</strong></div><div className="detail-row"><span>SKU</span><strong>{selected.sku||'Not detected'}</strong></div><div className="detail-row"><span>Quantity</span><strong>{selected.quantity||'—'}</strong></div>
          <div className="crop-values"><div className="field-heading">Exact crop <span>% of page</span></div>{crop&&(['x','y','width','height'] as const).map(key=><label key={key}><span>{({x:'Left',y:'Top',width:'Width',height:'Height'})[key]}</span><Input aria-label={`Crop ${key} percent`} type="number" min={0} max={100} step={.1} disabled={locked} value={Number((crop[key]/(key==='x'||key==='width'?selected.width:selected.height)*100).toFixed(1))} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n))updateCrop(clampRect({...crop,[key]:n/100*(key==='x'||key==='width'?selected.width:selected.height)},selected.width,selected.height));}}/><span>%</span></label>)}</div>
          <Button className="text-button reset-crop" disabled={locked} onClick={resetCrop}><RotateCcw size={13}/>Reset crop</Button>
          <Button className={`confirm-button ${selected.approved?'confirmed':''}`} disabled={locked} onClick={confirmCrop}><CheckCheck size={15}/>{selected.approved?'Crop confirmed':'Confirm this crop'}</Button>
          <p className="field-help">Keep the full address, QR, barcode, and product details inside the frame.</p>
          <div className="crop-actions"><Button className="text-button" disabled={locked||pages.length>=300} onClick={()=>{const copy=clonePageCrop(selected,options.mode);setPages(prev=>[...prev,copy]);setActive(copy.id);}}>Add another crop</Button><Button className="text-button" disabled={locked} onClick={()=>setPages(prev=>applyCropToMatching(prev,selected,options.mode))}>Apply crop to matching pages</Button><Button className="text-button" disabled={locked||needsReview(selected,options.mode)||!!printError} onClick={()=>void download(selected.id)}>Download this label</Button></div>
          <OrderEditor key={selected.id} page={selected} disabled={locked} onChange={patch=>updatePage(selected.id,patch)}/>
          </div></div>
          <div className="batch-strip"><span><Files size={14}/>{pages.length} label {pages.length===1?'entry':'entries'}</span><div className="page-chips">{pages.map((p,i)=><Button key={p.id} disabled={locked} className={`${selected.id===p.id?'current':''} ${!p.included?'excluded':''} ${p.included&&needsReview(p,options.mode)?'needs-review':''}`} onClick={()=>setActive(p.id)} aria-label={`Review page ${i+1}${needsReview(p,options.mode)?', needs review':''}`} aria-current={selected.id===p.id?'page':undefined}>{i+1}</Button>)}</div></div></>}
        <div className="export-footer"><div><strong>{included.length?`${included.length} ${included.length===1?'page':'pages'} selected`:'Ready when you are'}</strong><span>{reviews.length?`${reviews.length} ${reviews.length===1?'page needs':'pages need'} your review`:included.length?`${modeLabels[options.mode]} · ${options.copies??1} copies each${repeats.size&&!allowReprints?' · Resolve duplicates':''}`:'Add a PDF to get started'}</span></div><Button className="primary-button" disabled={locked||!included.length||!!reviews.length||!!printError||(repeats.size>0&&!allowReprints)} onClick={()=>void download()}>{exporting?<LoaderCircle className="spin" size={17}/>:<ArrowDownToLine size={17}/>}Download PDF</Button></div>
      </section></div>
      <VendorTools key={sources.map(source=>source.id).join(':')} pages={pages} setPages={setPages} mode={options.mode} locked={locked} onReview={id=>{setActive(id);document.querySelector('.review-panel')?.scrollIntoView({behavior:'smooth',block:'start'});}} allowReprints={allowReprints} setAllowReprints={setAllowReprints} onError={message=>setMessages([message])}/>
      <div className="bottom-notes"><span><ShieldCheck size={15}/>Private processing</span><span><CheckCheck size={15}/>Original PDF quality</span><span><FileText size={15}/>Thermal & A4 layouts</span></div>
      <footer className="site-footer"><span><b>LabelDesk</b> · Made for your everyday dispatch.</span><span>Always check one printed label before a full batch.</span></footer>
    </main>
    {!!pages.length&&<div className="mobile-actionbar" aria-label="Batch download controls"><div><strong>{included.length} labels selected</strong>{locked?<span>{exporting?'Preparing PDF…':'Processing PDFs…'}</span>:reviews.length?<Button className="text-button" disabled={locked} onClick={()=>{setActive(reviews[0].id);document.querySelector('.review-panel')?.scrollIntoView({behavior:'smooth'});}}>Review {reviews.length} labels</Button>:repeats.size&&!allowReprints?<Button className="text-button" disabled={locked} onClick={()=>document.querySelector('.vendor-tools')?.scrollIntoView({behavior:'smooth'})}>Resolve {repeats.size} repeats</Button>:printError?<Button className="text-button" disabled={locked} onClick={()=>document.querySelector('.output-panel')?.scrollIntoView({behavior:'smooth'})}>Check print settings</Button>:!included.length?<Button className="text-button" onClick={()=>document.querySelector('.vendor-tools')?.scrollIntoView({behavior:'smooth'})}>Select labels</Button>:<span>{options.copies??1} copies each · Ready to download</span>}</div><Button className="primary-button" disabled={locked||!included.length||!!reviews.length||!!printError||(repeats.size>0&&!allowReprints)} onClick={()=>void download()}>{exporting?<LoaderCircle className="spin" size={16}/>:<ArrowDownToLine size={16}/>}Download PDF</Button></div>}
  </div>;
}
