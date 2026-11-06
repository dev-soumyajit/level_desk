'use client';
import { OptionSelect } from './option-select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { metadataPatch, pageItems } from '@/lib/batch';
import type { PageRecord } from '@/lib/types';
import type { LineItem, Marketplace, Payment } from '@/lib/order-types';
type Props={page:PageRecord;disabled:boolean;onChange:(patch:Partial<PageRecord>)=>void};
export default function OrderEditor({page,disabled,onChange}:Props){
 const items=pageItems(page);
 function editItem(index:number,patch:Partial<LineItem>){onChange(metadataPatch(items.map((item,i)=>i===index?{...item,...patch}:item)));}
 return <details className="order-editor"><summary>Order & packing details</summary><p className="field-help">Use these fields for search, sorting and packing lists. Verify the detected values against your original order.</p><fieldset disabled={disabled}>
 <label>Order / sub-order ID<Input type="text" value={page.orderId??''} maxLength={80} onChange={e=>onChange({orderId:e.target.value})}/></label>
 <label>AWB / tracking ID<Input type="text" value={page.trackingId??''} maxLength={80} onChange={e=>onChange({trackingId:e.target.value})}/></label>
 <label>Marketplace<OptionSelect aria-label="Marketplace" disabled={disabled} value={page.marketplace??'Unknown'} onValueChange={value=>onChange({marketplace:value as Marketplace})} options={['Unknown','Meesho','Flipkart','Amazon','Other'].map(value=>({value,label:value}))}/></label>
 <label>Delivery partner<Input type="text" value={page.courier} maxLength={80} onChange={e=>onChange({courier:e.target.value})}/></label>
 <label>Payment<OptionSelect aria-label="Payment" disabled={disabled} value={page.payment??'Unknown'} onValueChange={value=>onChange({payment:value as Payment})} options={['Unknown','Prepaid','COD'].map(value=>({value,label:value}))}/></label>
 <div className="line-items">{items.map((item,index)=><div className="line-item" key={index}><div className="line-item-title">Item {index+1}{items.length>1&&<Button className="icon-button" aria-label={`Remove item ${index+1}`} onClick={()=>onChange(metadataPatch(items.filter((_,i)=>i!==index)))}><Trash2 size={13}/></Button>}</div>
 <label>SKU<Input type="text" value={item.sku} maxLength={160} onChange={e=>editItem(index,{sku:e.target.value})}/></label>
 <label>Quantity<Input type="text" inputMode="numeric" value={item.quantity} maxLength={6} onChange={e=>editItem(index,{quantity:e.target.value})}/></label>
 <label>Size<Input type="text" value={item.size} maxLength={80} onChange={e=>editItem(index,{size:e.target.value})}/></label>
 <label>Color<Input type="text" value={item.color} maxLength={80} onChange={e=>editItem(index,{color:e.target.value})}/></label>
 </div>)}</div>
 <Button className="text-button" disabled={items.length>=50} onClick={()=>onChange(metadataPatch([...items,{sku:'',quantity:'',size:'',color:''}]))}><Plus size={13}/>Add product row</Button>
 <label>Packing notes<Textarea value={page.notes??''} maxLength={500} onChange={e=>onChange({notes:e.target.value})}/></label>
 <label className="packed-checkbox"><input type="checkbox" checked={!!page.packed} onChange={e=>onChange({packed:e.target.checked})}/>Packed in this workspace</label>
 </fieldset></details>;
}
