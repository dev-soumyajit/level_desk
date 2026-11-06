import type { TextToken } from './types';
import type { LineItem, OrderMetadata } from './order-types';
export function extractOrderMetadata(tokens: TextToken[], labelEnd: number): OrderMetadata {
  const shipping = tokens.filter(t=>t.y<labelEnd);
  const text = shipping.map(t=>t.text).join(' ');
  const marketplace = /\bflipkart\b/i.test(text)?'Flipkart':/\bmeesho\b/i.test(text)?'Meesho':/\bamazon\b/i.test(text)?'Amazon':'Unknown';
  const payment = /prepaid|do not collect cash/i.test(text)?'Prepaid':/cash on delivery|\bCOD\b/i.test(text)?'COD':'Unknown';
  const skuHeader=shipping.find(t=>/^SKU\s*:?$/i.test(t.text.trim()));
  const headers=skuHeader?shipping.filter(t=>Math.abs(t.y-skuHeader.y)<5).sort((a,b)=>a.x-b.x):[];
  const column=(pattern:RegExp)=>headers.find(t=>pattern.test(t.text.trim()));
  const sku=column(/^SKU\s*:?$/i), qty=column(/^(?:qty|quantity)\.?\s*:?$/i),size=column(/^size$/i),color=column(/^colou?r$/i),order=column(/^order\s*(?:no\.?|id|number)\s*:?$/i);
  function cell(header:TextToken|undefined,y:number) {
    if(!header)return '';
    const next=headers.find(h=>h.x>header.x+2);
    return shipping.filter(t=>t.y>header.y+header.height*.6&&Math.abs(t.y-y)<4&&t.x>=header.x-5&&t.x<(next?.x??Infinity)-5)
      .sort((a,b)=>a.x-b.x).map(t=>t.text.trim()).join(' ').trim();
  }
  const skuRows=sku?shipping.filter(t=>t.y>sku.y+sku.height*.6&&t.y<labelEnd&&t.x>=sku.x-5&&t.x<(headers.find(h=>h.x>sku.x+2)?.x??sku.x+150)-5&&t.text.trim()):[];
  const ys:number[]=[];
  for(const token of skuRows.sort((a,b)=>a.y-b.y))if(!ys.some(y=>Math.abs(y-token.y)<4))ys.push(token.y);
  const items:LineItem[]=ys.map(y=>({sku:cell(sku,y),quantity:cell(qty,y),size:cell(size,y),color:cell(color,y)}));
  let orderId=order&&ys.length?cell(order,ys[0]):'';
  const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
  function labeled(pattern:RegExp) {
    for(const t of shipping){
      const match=normalize(t.text).match(pattern);
      if(!match)continue;
      if(match[1]?.trim())return match[1].trim();
      const nearby=shipping.filter(v=>v!==t&&((Math.abs(v.y-t.y)<5&&v.x>t.x+t.width-2)||(v.y>t.y&&v.y<t.y+35&&Math.abs(v.x-t.x)<30)))
        .filter(v=>/^[A-Z0-9][A-Z0-9_\-/]{5,39}$/i.test(v.text.trim())).sort((a,b)=>a.y-b.y||a.x-b.x)[0];
      if(nearby)return nearby.text.trim();
    }
    return '';
  }
  if(!orderId)orderId=labeled(/^(?:order\s*(?:no\.?|id|number)|sub.?order\s*(?:no\.?|id))\s*[:#-]?\s*([A-Z0-9_\-/]{6,40})?$/i);
  let trackingId=labeled(/^(?:AWB(?:\s*(?:no\.?|number))?|tracking(?:\s*(?:no\.?|number|id))?|waybill(?:\s*(?:no\.?|number))?)\s*[:#-]?\s*([A-Z0-9\-]{8,32})?$/i);
  // Common text-based labels place the AWB directly above their linear barcode.
  // Keep this fallback outside the product table to avoid taking an order number.
  if(!trackingId){const candidates=shipping.filter(t=>/^\d{10,22}$/.test(t.text.trim())&&(!skuHeader||t.y<skuHeader.y));if(candidates.length===1)trackingId=candidates[0].text.trim();}
  return {marketplace,payment,orderId,trackingId,items};
}
