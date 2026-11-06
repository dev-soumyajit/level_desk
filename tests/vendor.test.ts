import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { extractOrderMetadata } from '../src/lib/order-metadata';
import { applyCropToMatching, batchSummary, clonePageCrop, DEFAULT_OPTIONS, duplicateIds, EMPTY_FILTER, filterPages, metadataPatch, missingItems, pixelFingerprint, positiveQuantity, restorePrintOptions, sameBytes, totalUnits, validatePrintOptions } from '../src/lib/batch';
import { csvCell, dispatchCsv, escapeHtml, pickingRows, reportHtml } from '../src/lib/reports';
import { resolveLabelSize } from '../src/lib/paper';
import type { PageRecord, TextToken } from '../src/lib/types';
function page(id:string,patch:Partial<PageRecord>={}):PageRecord{return {id,sourceId:'source',fileName:'test.pdf',pageIndex:0,width:595,height:842,transform:[1,0,0,-1,0,842],included:true,approved:false,overrides:{},confidence:'detected',reason:'detected',label:{x:10,y:10,width:575,height:340},combined:{x:10,y:10,width:575,height:640},invoice:{x:10,y:350,width:575,height:300},sku:'A',quantity:'1',courier:'Delhivery',...patch};}
const token=(text:string,x:number,y:number):TextToken=>({text,x,y,width:70,height:10});
test('order metadata reads table columns without converting long identifiers to numbers',()=>{
 const tokens=[token('Customer Address',10,10),token('Prepaid: Do not collect cash',260,10),token('1490843431871393',300,215),token('SKU',20,320),token('Size',160,320),token('Qty',240,320),token('Color',300,320),token('Order No.',400,320),token('PUS02',20,340),token('Free Size',160,340),token('2',240,340),token('Multicolor',300,340),token('348297444649681920_1',400,340)];
 const r=extractOrderMetadata(tokens,355);assert.equal(r.orderId,'348297444649681920_1');assert.equal(r.trackingId,'1490843431871393');assert.equal(r.payment,'Prepaid');assert.equal(r.marketplace,'Unknown');assert.deepEqual(r.items,[{sku:'PUS02',size:'Free Size',quantity:'2',color:'Multicolor'}]);
});
test('multiple product rows remain separate with their own quantities',()=>{
 const tokens=[token('SKU',20,100),token('Size',150,100),token('Qty',240,100),token('Color',300,100),token('Order No.',400,100),token('A',20,120),token('S',150,120),token('2',240,120),token('Red',300,120),token('B',20,140),token('M',150,140),token('3',240,140),token('Blue',300,140)];
 const r=extractOrderMetadata(tokens,200);assert.equal(r.items?.length,2);assert.equal(r.items?.[1].quantity,'3');assert.equal(totalUnits(page('a',{items:r.items})),5);
});
test('brands and payment are inferred only from explicit source text',()=>{
 assert.equal(extractOrderMetadata([token('Meesho',0,10),token('COD',0,20)],100).marketplace,'Meesho');assert.equal(extractOrderMetadata([token('Flipkart',0,10)],100).marketplace,'Flipkart');assert.equal(extractOrderMetadata([],100).payment,'Unknown');assert.equal(extractOrderMetadata([token('Amazon',0,10)],100).marketplace,'Amazon');
});
test('unknown or malformed quantities stay unknown rather than becoming one',()=>{
 for(const value of ['', '0','-1','1.5','two','9999999'])assert.equal(positiveQuantity(value),null);
 assert.equal(positiveQuantity(' 2 '),2);assert.equal(totalUnits(page('a',{quantity:''})),null);assert.equal(missingItems(page('a',{sku:''})),true);
});
test('item edits update sort fields and preserve unknown totals',()=>{
 assert.deepEqual(metadataPatch([{sku:'A',quantity:'2',size:'S',color:'Red'},{sku:'B',quantity:'3',size:'M',color:'Blue'}]).quantity,'5');
 assert.equal(metadataPatch([{sku:'A',quantity:'',size:'',color:''}]).quantity,'');
});
test('duplicate AWBs are detected across files while excluded entries do not block export',()=>{
 const rows=[page('a',{trackingId:'AB12345678'}),page('b',{sourceId:'other',trackingId:'ab12345678'}),page('c',{trackingId:'OTHER12345'})];
 assert.deepEqual([...duplicateIds(rows,'label')],['b']);rows[0].included=false;assert.equal(duplicateIds(rows,'label').size,0);
});
test('order IDs alone never collapse separate packets of one order',()=>{
 assert.equal(duplicateIds([page('a',{orderId:'ORDER1',trackingId:'PACKET111'}),page('b',{orderId:'ORDER1',trackingId:'PACKET222'})],'label').size,0);
 assert.equal(duplicateIds([page('a',{orderId:'ORDER1'}),page('b',{orderId:'ORDER1'})],'label').size,0);
});
test('identical page fingerprints warn only for the same visible crop',()=>{
 const a=page('a',{fingerprint:'same'}),b=page('b',{fingerprint:'same'});assert.equal(duplicateIds([a,b],'label').size,1);b.overrides.label={x:10,y:360,width:575,height:300};assert.equal(duplicateIds([a,b],'label').size,0);
});
test('extra crops preserve the source and require fresh boundaries, metadata and approval',()=>{
 const original=page('a',{trackingId:'1234567890',packed:true,exportedAt:'today'});const clone=clonePageCrop(original,'label');assert.notEqual(clone.id,original.id);assert.equal(clone.sourceId,original.sourceId);assert.equal(clone.approved,false);assert.equal(clone.confidence,'review');assert.equal(clone.trackingId,'');assert.equal(clone.packed,false);assert.equal(clone.exportedAt,undefined);assert.equal(missingItems(clone),true);
});
test('shared crop stays within the same file and geometry and approvals are reset',()=>{
 const a=page('a',{approved:true}),b=page('b',{approved:true}),c=page('c',{sourceId:'different',approved:true}),d=page('d',{width:288,approved:true});const changed=applyCropToMatching([a,b,c,d],a,'label');assert.equal(changed[1].approved,false);assert.equal(changed[1].confidence,'review');assert.equal(changed[2],c);assert.equal(changed[3],d);
});
test('filters cover order IDs, SKUs, couriers, payment, reviews and packing state',()=>{
 const rows=[page('a',{orderId:'348297444649681920_1',payment:'Prepaid',marketplace:'Meesho'}),page('b',{sku:'B2',quantity:'3',payment:'COD',confidence:'review',packed:true})];
 assert.deepEqual(filterPages(rows,{...EMPTY_FILTER,query:'444649681920'},'label').map(p=>p.id),['a']);assert.deepEqual(filterPages(rows,{...EMPTY_FILTER,payment:'COD',issue:'multi'},'label').map(p=>p.id),['b']);assert.deepEqual(filterPages(rows,{...EMPTY_FILTER,issue:'unpacked'},'label').map(p=>p.id),['a']);assert.deepEqual(filterPages(rows,{...EMPTY_FILTER,issue:'review'},'label').map(p=>p.id),['b']);
});
test('picking summary groups variants and flags incomplete quantities',()=>{
 const rows=[page('a',{items:[{sku:'A',quantity:'2',size:'M',color:'Red'}]}),page('b',{items:[{sku:'A',quantity:'3',size:'M',color:'Red'}]}),page('c',{items:[{sku:'A',quantity:'',size:'L',color:'Red'}]})];
 const groups=pickingRows(rows);assert.equal(groups.length,2);const m=groups.find(g=>g.size==='M')!;assert.equal(m.units,5);assert.equal(m.labels,2);assert.equal(groups.find(g=>g.size==='L')!.unknown,1);
 const summary=batchSummary(rows,'label');assert.equal(summary.units,5);assert.equal(summary.unknownUnits,1);assert.equal(summary.skus,1);
 rows[1].included=false;assert.equal(pickingRows(rows).find(g=>g.size==='M')!.units,2);
});
test('report content excludes unselected entries and escapes untrusted text',()=>{
 const rows=[page('a',{sku:'<script>alert(1)</script>',orderId:'1',notes:'<img src=x onerror=alert(1)>'}),page('b',{included:false,sku:'EXCLUDED-SKU'})];
 const html=reportHtml('dispatch',rows,new Date('2026-11-06T00:00:00Z'));assert.ok(!html.includes('<script>alert'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('EXCLUDED-SKU'));assert.match(html,/official courier manifest/);assert.match(html,/do not confirm courier pickup/);assert.equal(escapeHtml('<>&"\''),'&lt;&gt;&amp;&quot;&#39;');
 const csv=dispatchCsv(rows);assert.ok(!csv.includes('EXCLUDED-SKU'));assert.match(csv,/Packed locally/);
});
test('CSV cells defend against formulas and preserve embedded quotes and newlines',()=>{
 for(const value of ['=HYPERLINK("bad")',' +1','-2','@SUM(1)','\tdata'])assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
});
test('print settings validate custom stock and copies without changing stock quantities',()=>{
 validatePrintOptions({...DEFAULT_OPTIONS,paper:'custom',customWidthMm:100,customHeightMm:150,copies:2});
 const size=resolveLabelSize({...DEFAULT_OPTIONS,paper:'custom',customWidthMm:100,customHeightMm:150})!;assert.ok(Math.abs(size[0]*25.4/72-100)<1e-9);
 for(const copies of [0,1.5,11,NaN])assert.throws(()=>validatePrintOptions({...DEFAULT_OPTIONS,copies}));
 for(const marginMm of [-1,11,NaN])assert.throws(()=>validatePrintOptions({...DEFAULT_OPTIONS,marginMm}));
 assert.throws(()=>validatePrintOptions({...DEFAULT_OPTIONS,paper:'custom',customWidthMm:10}));
 assert.equal(pickingRows([page('a',{quantity:'2'})])[0].units,2);
 assert.deepEqual(restorePrintOptions({paper:'invalid'}),DEFAULT_OPTIONS);assert.equal(restorePrintOptions({...DEFAULT_OPTIONS,copies:3}).copies,3);
});
test('pixel fingerprints and exact-byte checks distinguish documents',()=>{
 const a=new Uint8ClampedArray([255,255,255,255]),b=new Uint8ClampedArray([0,0,0,255]);assert.equal(pixelFingerprint(a,1,1),pixelFingerprint(a,1,1));assert.notEqual(pixelFingerprint(a,1,1),pixelFingerprint(b,1,1));assert.equal(sameBytes(new Uint8Array([1,2]),new Uint8Array([1,2])),true);assert.equal(sameBytes(new Uint8Array([1,2]),new Uint8Array([1,3])),false);
});
test('supplied sample has accurate order, AWB, item variant and prepaid metadata',{skip:!existsSync('artifacts/sample-analysis.json')},()=>{
 const data=JSON.parse(readFileSync('artifacts/sample-analysis.json','utf8'));const r=extractOrderMetadata(data.tokens,352);
 assert.equal(r.orderId,'348297444649681920_1');assert.equal(r.trackingId,'1490843431871393');assert.equal(r.payment,'Prepaid');assert.equal(r.items?.[0].sku,'PUS02');assert.equal(r.items?.[0].size,'Free Size');assert.equal(r.items?.[0].color,'Multicolor');assert.equal(r.items?.[0].quantity,'1');assert.equal(r.marketplace,'Unknown');
});

test('CSV keeps long and zero-prefixed IDs as text for spreadsheet imports',()=>{
 assert.equal(csvCell('348297444649681920'),`"'348297444649681920"`);
 assert.equal(csvCell('0012345678'),`"'0012345678"`);
});
test('known quantities on a partially unknown multi-item label remain in the summary',()=>{
 const p=page('a',{items:[{sku:'A',quantity:'2',size:'',color:''},{sku:'B',quantity:'',size:'',color:''}]});
 assert.equal(batchSummary([p],'label').units,2);assert.equal(batchSummary([p],'label').unknownUnits,1);
});
test('matching pixels still warn when only one entry has a detected AWB',()=>{
 assert.equal(duplicateIds([page('a',{fingerprint:'same',trackingId:'AWB12345678'}),page('b',{fingerprint:'same'})],'label').size,1);
});
