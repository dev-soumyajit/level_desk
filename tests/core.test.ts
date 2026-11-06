import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { detectPage, scanPixels } from '../src/lib/detection';
import { rawBounds } from '../src/lib/geometry';
import { PAPER_PRESETS, printInstructions, singleLabelSize } from '../src/lib/paper';
import { clampRect, getCrop, needsReview, sortPages, type PageRecord, type TextToken } from '../src/lib/types';
const t = (text:string,x:number,y:number,width=90,height=10):TextToken=>({text,x,y,width,height});
const tokens=[t('Customer Address',20,20),t('Delhivery',260,45),t('Prepaid',260,15),t('SKU',20,320),t('PUS02',20,340),t('Qty',298,320),t('1',298,340),t('TAX INVOICE',265,355)];
const rows=new Array(842).fill(0);rows[351]=570;
const scan={bounds:{x:12,y:12,width:572,height:644},darkRows:rows};
function record(id:string,sku:string,courier:string):PageRecord{return {...detectPage(tokens,595,842,scan),id,sourceId:'source',fileName:'test.pdf',pageIndex:0,width:595,height:842,transform:[1,0,0,-1,0,842],included:true,approved:false,overrides:{},sku,courier};}
test('combined shipping page preserves SKU and stops before the invoice heading',()=>{
 const result=detectPage(tokens,595,842,scan);
 assert.equal(result.confidence,'detected');assert.equal(result.sku,'PUS02');assert.equal(result.quantity,'1');assert.equal(result.courier,'Delhivery');
 assert.equal(result.label.y+result.label.height,351);assert.equal(result.invoice!.y,351);assert.ok(result.combined.height>result.label.height);
});
test('unknown page does not receive a guessed half-page crop',()=>{const r=detectPage([t('Hello',20,20)],595,842,scan);assert.equal(r.confidence,'review');assert.deepEqual(r.label,r.combined);assert.equal(r.invoice,null);});
test('image-only and blank PDFs require review',()=>{assert.equal(detectPage([],595,842,scan).confidence,'review');assert.equal(detectPage([],595,842,{bounds:null,darkRows:[]}).confidence,'review');});
test('invoice-only pages cannot masquerade as labels',()=>{const r=detectPage([t('TAX INVOICE',20,20),t('BILL TO / SHIP TO',20,40)],595,842,scan);assert.equal(r.confidence,'review');assert.equal(r.invoice,null);});
test('multiple sections require review',()=>{assert.equal(detectPage([...tokens,t('Customer Address',20,500)],595,842,scan).confidence,'review');assert.equal(detectPage([...tokens,t('TAX INVOICE',20,600)],595,842,scan).confidence,'review');});
test('standalone thermal labels can be detected without invoices',()=>{const r=detectPage(tokens.slice(0,3),288,432,{bounds:{x:5,y:5,width:275,height:410},darkRows:[]});assert.equal(r.confidence,'detected');assert.equal(r.invoice,null);});
test('manual confirmation is required when the invoice is missing',()=>{const p=record('1','','');p.invoice=null;assert.equal(needsReview(p,'invoice'),true);p.overrides.invoice=p.combined;assert.equal(needsReview(p,'invoice'),true);p.approved=true;assert.equal(needsReview(p,'invoice'),false);assert.deepEqual(getCrop(p,'invoice'),p.combined);});
test('sorting is stable, natural and places missing metadata last',()=>{const input=[record('a','B10','Delhivery'),record('b','B2','Ekart'),record('c','',''),record('d','B2','Delhivery')];assert.deepEqual(sortPages(input,'sku').map(x=>x.id),['b','d','a','c']);assert.deepEqual(input.map(x=>x.id),['a','b','c','d']);assert.deepEqual(sortPages(input,'original').map(x=>x.id),['a','b','c','d']);});
test('crop cannot exceed page bounds or collapse',()=>{assert.deepEqual(clampRect({x:-5,y:800,width:9999,height:9999},595,842),{x:0,y:800,width:595,height:42});assert.equal(clampRect({x:10,y:10,width:0,height:0},595,842).width,1);});
test('pixel bounds include graphics even without text',()=>{const p=new Uint8ClampedArray(10*10*4).fill(255);for(const [x,y] of [[2,3],[8,7]]){const i=(y*10+x)*4;p[i]=p[i+1]=p[i+2]=0;}assert.deepEqual(scanPixels(p,10,10).bounds,{x:2,y:3,width:7,height:5});assert.equal(scanPixels(new Uint8ClampedArray(400).fill(255),10,10).bounds,null);});
test('PDF coordinate conversion handles all page rotations and nonzero origins',()=>{
 assert.deepEqual(rawBounds({x:10,y:20,width:100,height:200},[1,0,0,-1,0,842]),{left:10,right:110,bottom:622,top:822});
 assert.deepEqual(rawBounds({x:10,y:20,width:100,height:200},[0,1,1,0,0,0]),{left:20,right:220,bottom:10,top:110});
 assert.deepEqual(rawBounds({x:10,y:20,width:100,height:200},[-1,0,0,1,595,0]),{left:485,right:585,bottom:20,top:220});
 assert.deepEqual(rawBounds({x:10,y:20,width:100,height:200},[0,-1,-1,0,842,595]),{left:375,right:575,bottom:732,top:832});
 assert.deepEqual(rawBounds({x:0,y:0,width:100,height:100},[1,0,0,-1,-20,300]),{left:20,right:120,bottom:200,top:300});
 assert.throws(()=>rawBounds({x:0,y:0,width:10,height:10},[0,0,0,0,0,0]));
});
test('real supplied PDF: invoice split, barcode area, SKU and quantity',{skip:!existsSync('artifacts/sample-analysis.json')},()=>{
 const path='artifacts/sample-analysis.json';
 if(!existsSync(path))return;
 const {tokens,width,height,scan}=JSON.parse(readFileSync(path,'utf8'));
 const r=detectPage(tokens,width,height,scan);
 assert.equal(r.confidence,'detected');assert.equal(r.sku,'PUS02');assert.equal(r.quantity,'1');assert.equal(r.courier,'Delhivery');
 assert.ok(r.label.y+r.label.height>=350&&r.label.y+r.label.height<=353);
 assert.ok(r.label.y+r.label.height>284,'entire barcode is retained');
 assert.ok(r.invoice!.y<355,'invoice heading is retained');
});

test('shipping stock sizes remain physically distinct: 4x6 inches, 100x150 mm and A6',()=>{
 const inch = singleLabelSize('thermal')!, metric = singleLabelSize('label-100x150')!, a6 = singleLabelSize('a6')!;
 assert.deepEqual(inch,[288,432]);
 const mm = (pt:number)=>pt*25.4/72;
 assert.ok(Math.abs(mm(inch[0])-101.6)<1e-10);assert.ok(Math.abs(mm(inch[1])-152.4)<1e-10);
 assert.ok(Math.abs(mm(metric[0])-100)<1e-10);assert.ok(Math.abs(mm(metric[1])-150)<1e-10);
 assert.ok(Math.abs(mm(a6[0])-105)<1e-10);assert.ok(Math.abs(mm(a6[1])-148)<1e-10);
 assert.ok(metric[0]<inch[0]&&metric[1]<inch[1]);assert.ok(a6[0]>inch[0]&&a6[1]<inch[1]);
 assert.equal(singleLabelSize('original'),null);assert.equal(singleLabelSize('a4-4'),null);
 assert.equal(new Set(PAPER_PRESETS.map(p=>p.value)).size,PAPER_PRESETS.length);
});
test('print guidance matches the selected stock without equating A6 with 4x6',()=>{
 assert.match(printInstructions('thermal'),/101.6 × 152.4 mm/);
 assert.match(printInstructions('label-100x150'),/100 × 150 mm/);
 assert.match(printInstructions('a6'),/105 × 148 mm/);
 for(const paper of ['thermal','label-100x150','a6'] as const){assert.match(printInstructions(paper),/Actual size \/ 100%/);assert.match(printInstructions(paper),/turn off Fit to page/);}
 assert.equal(printInstructions('original'),'');
});
