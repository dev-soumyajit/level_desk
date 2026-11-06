import { getCrop, needsReview, type ExportOptions, type Mode, type PageRecord } from './types';
import type { LineItem } from './order-types';
export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export function positiveQuantity(value: string): number | null {
  if(!/^[1-9]\d{0,5}$/.test(value.trim()))return null;
  return Number(value.trim());
}
export function pageItems(page: PageRecord): LineItem[] {
  return page.items?.length?page.items:[{sku:page.sku,quantity:page.quantity,size:'',color:''}];
}
export function missingItems(page:PageRecord): boolean {
  return pageItems(page).some(i=>!i.sku.trim()||positiveQuantity(i.quantity)===null);
}
export function totalUnits(page:PageRecord):number|null {
  const values=pageItems(page).map(i=>positiveQuantity(i.quantity));
  return values.some(n=>n===null)?null:values.reduce<number>((sum,n)=>sum+(n??0),0);
}
export function metadataPatch(items:LineItem[]) {
  const valid=items.map(i=>positiveQuantity(i.quantity));
  return {items,sku:items.map(i=>i.sku).filter(Boolean).join(' / '),quantity:valid.some(n=>n===null)?'':String(valid.reduce<number>((n,v)=>n+(v??0),0))};
}
export function duplicateIds(pages:PageRecord[],mode:Mode):Set<string> {
  const seen=new Set<string>(),duplicates=new Set<string>();
  for(const page of pages.filter(p=>p.included)){
    const crop=getCrop(page,mode);
    const region=crop?[crop.x,crop.y,crop.width,crop.height].map(n=>Math.round(n*10)/10).join(':'):'missing';
    const tracking=(page.trackingId??'').replace(/\s/g,'').toUpperCase();
    const keys=[...(tracking?[`awb:${tracking}`]:[]),...(page.fingerprint?[`page:${page.fingerprint}:${region}`]:[])];
    if(keys.some(key=>seen.has(key)))duplicates.add(page.id);
    for(const key of keys)seen.add(key);
  }
  return duplicates;
}
export type BatchFilter={query:string;courier:string;marketplace:string;payment:string;issue:string};
export const EMPTY_FILTER:BatchFilter={query:'',courier:'',marketplace:'',payment:'',issue:''};
export function filterPages(pages:PageRecord[],filter:BatchFilter,mode:Mode):PageRecord[]{
  const duplicates=duplicateIds(pages,mode),query=filter.query.toLowerCase().trim();
  return pages.filter(p=>{
    const searchable=[p.fileName,p.orderId,p.trackingId,p.courier,p.marketplace,...pageItems(p).flatMap(i=>[i.sku,i.size,i.color])].join(' ').toLowerCase();
    return (!query||searchable.includes(query))&&(!filter.courier||p.courier===filter.courier)&&(!filter.marketplace||(p.marketplace??'Unknown')===filter.marketplace)&&(!filter.payment||(p.payment??'Unknown')===filter.payment)&&
      (!filter.issue||(filter.issue==='review'&&needsReview(p,mode))||(filter.issue==='duplicates'&&duplicates.has(p.id))||(filter.issue==='metadata'&&missingItems(p))||(filter.issue==='multi'&&(totalUnits(p)??0)>1)||(filter.issue==='unpacked'&&!p.packed)||(filter.issue==='exported'&&!!p.exportedAt));
  });
}
export function batchSummary(pages:PageRecord[],mode:Mode){
  const selected=pages.filter(p=>p.included);
  return {selected:selected.length,units:selected.reduce((n,p)=>n+pageItems(p).reduce((sum,item)=>sum+(positiveQuantity(item.quantity)??0),0),0),unknownUnits:selected.filter(p=>totalUnits(p)===null).length,
    skus:new Set(selected.flatMap(p=>pageItems(p).map(i=>i.sku.trim()).filter(Boolean))).size,packed:selected.filter(p=>p.packed).length,
    reviews:selected.filter(p=>needsReview(p,mode)).length,duplicates:duplicateIds(selected,mode).size,missing:selected.filter(missingItems).length};
}
export function applyCropToMatching(pages:PageRecord[],reference:PageRecord,mode:Mode):PageRecord[]{
  const crop=getCrop(reference,mode);if(!crop)return pages;
  // Only the same source and page geometry are eligible; approvals never transfer.
  return pages.map(p=>p.sourceId===reference.sourceId&&Math.abs(p.width-reference.width)<.1&&Math.abs(p.height-reference.height)<.1&&p.transform.every((v,i)=>Math.abs(v-reference.transform[i])<.1)
    ?{...p,overrides:{...p.overrides,[mode]:{...crop}},approved:false,confidence:'review' as const,reason:'A shared crop was applied. Check this page before confirming.'}:p);
}
export function sameBytes(a:Uint8Array,b:Uint8Array):boolean{return a.length===b.length&&a.every((value,i)=>value===b[i]);}
export const DEFAULT_OPTIONS:ExportOptions={mode:'label',paper:'thermal',sort:'original',copies:1,marginMm:2.1,autoRotate:true,customWidthMm:100,customHeightMm:150};
export function validatePrintOptions(options:ExportOptions):void{
  if(!Number.isInteger(options.copies??1)||(options.copies??1)<1||(options.copies??1)>10)throw new Error('Copies must be a whole number from 1 to 10.');
  if(!Number.isFinite(options.marginMm??2.1)||(options.marginMm??2.1)<0||(options.marginMm??2.1)>10)throw new Error('Print margin must be between 0 and 10 mm.');
  if(options.paper==='custom')for(const n of [options.customWidthMm,options.customHeightMm])if(!Number.isFinite(n)||(n ?? 0)<25||(n ?? 0)>300)throw new Error('Custom label width and height must be between 25 and 300 mm.');
}
export function restorePrintOptions(value:unknown):ExportOptions {
  const candidate=(value&&typeof value==='object'?value:{}) as Partial<ExportOptions>;
  const result={...DEFAULT_OPTIONS,...candidate};
  if(!['label','combined','invoice'].includes(result.mode)||!['original','thermal','label-100x150','a6','custom','a4-2','a4-4'].includes(result.paper)||!['original','sku','courier'].includes(result.sort)||typeof result.autoRotate!=='boolean')return {...DEFAULT_OPTIONS};
  try{validatePrintOptions(result);return result;}catch{return {...DEFAULT_OPTIONS};}
}

export function pixelFingerprint(data:Uint8ClampedArray,width:number,height:number):string{
 let a=2166136261,b=0x9e3779b9;
 for(let i=0;i<data.length;i++){a=Math.imul(a^data[i],16777619)>>>0;b=Math.imul(b^data[i],2246822519)>>>0;}
 return `${width}x${height}:${a.toString(16)}:${b.toString(16)}`;
}
export function clonePageCrop(page:PageRecord,mode:Mode):PageRecord{
 return {...page,id:newId(),included:true,approved:false,confidence:'review',reason:'Additional crop from the same source page. Set its boundaries and confirm it.',orderId:'',trackingId:'',sku:'',quantity:'',items:[{sku:'',quantity:'',size:'',color:''}],packed:false,exportedAt:undefined,notes:'',overrides:{[mode]:{...page.combined}}};
}
