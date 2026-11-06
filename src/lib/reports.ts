import { duplicateIds, pageItems, positiveQuantity } from './batch';
import type { PageRecord } from './types';
export function csvCell(value:unknown):string{
  let text=String(value??'');
  if(/^\s*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)||(typeof value==='string'&&/^(?:0\d+|\d{16,})$/.test(text)))text="'"+text;
  return `"${text.replaceAll('"','""')}"`;
}
export function csv(rows:unknown[][]):string{return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');}
export type PickingRow={sku:string;size:string;color:string;units:number;unknown:number;labels:number};
export function pickingRows(pages:PageRecord[]):PickingRow[]{
  const groups=new Map<string,{row:PickingRow;ids:Set<string>}>();
  for(const page of pages.filter(p=>p.included))for(const [index,item] of pageItems(page).entries()){
    const key=item.sku.trim()?JSON.stringify([item.sku.trim(),item.size.trim(),item.color.trim()]):`unknown:${page.id}:${index}`;
    let group=groups.get(key);
    if(!group){group={row:{sku:item.sku.trim(),size:item.size.trim(),color:item.color.trim(),units:0,unknown:0,labels:0},ids:new Set()};groups.set(key,group);}
    const qty=positiveQuantity(item.quantity);if(qty===null)group.row.unknown++;else group.row.units+=qty;
    group.ids.add(page.id);group.row.labels=group.ids.size;
  }
  return [...groups.values()].map(g=>g.row).sort((a,b)=>(a.sku||'\uffff').localeCompare(b.sku||'\uffff','en',{numeric:true}));
}
function units(row:PickingRow){return row.unknown?`${row.units} + ? (${row.unknown} missing quantities)`:String(row.units);}
export function pickingCsv(pages:PageRecord[]):string{
 return csv([['SKU','Size','Color','Known units','Unknown quantities','Label entries'],...pickingRows(pages).map(row=>[row.sku||'MISSING SKU',row.size,row.color,row.units,row.unknown,row.labels])]);
}
export function dispatchCsv(pages:PageRecord[]):string{
 return csv([['Source file','Source page','Order / sub-order ID','AWB / tracking ID','Marketplace','Courier','Payment','SKU','Size','Color','Quantity','Packed locally','PDF exported at','Notes'],
 ...pages.filter(p=>p.included).flatMap(p=>pageItems(p).map(item=>[p.fileName,p.pageIndex+1,p.orderId,p.trackingId,p.marketplace??'Unknown',p.courier,p.payment??'Unknown',item.sku,item.size,item.color,item.quantity,p.packed?'Yes':'No',p.exportedAt,p.notes]))]);
}
export function escapeHtml(value:unknown):string{return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
export function reportHtml(kind:'picking'|'dispatch',pages:PageRecord[],date=new Date()):string{
 const selected=pages.filter(p=>p.included),title=kind==='picking'?'SKU picking list':'Internal dispatch checklist';
 const header=kind==='picking'?['SKU','Size','Color','Units','Labels','Picked']:['Order / AWB','Courier / payment','Items','Packed','Notes'];
 const rows=kind==='picking'?pickingRows(pages).map(row=>[row.sku||'MISSING SKU',row.size,row.color,units(row),String(row.labels),'☐']):selected.map(p=>[`${p.orderId||'Order ID missing'} / ${p.trackingId||'AWB missing'}`,`${p.courier||'Unknown'} / ${p.payment??'Unknown'}`,pageItems(p).map(i=>`${i.sku||'SKU missing'} (${i.size||'—'}, ${i.color||'—'}) × ${i.quantity||'?'}`).join('; '),p.packed?'Yes':'☐',p.notes||'']);
 const duplicates=duplicateIds(selected,'label').size;
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} - LabelDesk</title><style>body{font:14px Arial,sans-serif;color:#182a22;max-width:1050px;margin:30px auto;padding:0 18px}h1{font-size:24px}p{line-height:1.6;color:#52665b}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;border:1px solid #d4dfd8;padding:9px;vertical-align:top;overflow-wrap:anywhere}th{background:#edf5ef}button{background:#187a60;color:white;border:0;padding:12px 20px;border-radius:5px;font:inherit}.scroll{overflow-x:auto}.notice{background:#fff5de;padding:12px}small{font-size:12px;display:block;margin-top:24px;color:#65756c}@page{size:A4;margin:12mm}@media print{body{margin:0;padding:0;max-width:none}button{display:none}.scroll{overflow:visible}thead{display:table-header-group}tr{break-inside:avoid}}@media(max-width:540px){body{font-size:14px;margin:20px auto}th,td{padding:6px}}</style></head><body><button onclick="window.print()">Print this list</button><h1>${title}</h1><p>${escapeHtml(date.toLocaleString())} · ${selected.length} selected label entries. Print copies do not multiply stock quantities.</p><p class="notice">${duplicates?`${duplicates} possible duplicate label entries are included. `:''}Check missing SKU/quantity fields and the original orders before packing. This is a local working list; obtain the official courier manifest from your seller or shipping panel.</p><div class="scroll"><table><thead><tr>${header.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><small>LabelDesk · Packed and exported indicators describe actions in this workspace. They do not confirm courier pickup or delivery.</small></body></html>`;
}
export function downloadText(text:string,name:string,mime='text/csv;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function openReport(html:string):boolean{
 const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
 const opened=window.open(url,'_blank');if(opened)opened.opener=null;setTimeout(()=>URL.revokeObjectURL(url),60000);return !!opened;
}
