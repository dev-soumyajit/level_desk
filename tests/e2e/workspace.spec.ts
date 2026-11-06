import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
const sample = readdirSync('.').find(name=>name.endsWith('.pdf'));
async function noOverflow(page:Page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
}
async function addSample(page:Page) {
  test.skip(!sample,'Keep the supplied sample PDF in the project root to run this test.');
  await page.getByLabel('Upload shipping label PDFs').setInputFiles(resolve(sample!));
  await expect(page.getByText('Auto-detected',{exact:true})).toBeVisible({timeout:30000});
}
async function chooseLayout(page:Page,paper:string){
  const labels:Record<string,string>={original:'Cropped size',thermal:'4 × 6 in shipping sticker','label-100x150':'100 × 150 mm shipping sticker',a6:'A6 label','a4-2':'A4 · 2 per sheet','a4-4':'A4 · 4 per sheet',custom:'Custom label size'};
  await page.getByRole('combobox',{name:'Print layout',exact:true}).click();
  await page.getByRole('option',{name:labels[paper],exact:false}).click();
}
async function downloadPdf(page:Page) {
  const wait=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download PDF',exact:true}).click();
  const file=await wait, path=await file.path();
  expect(path).toBeTruthy();
  return PDFDocument.load(readFileSync(path!));
}
test('responsive workspace has no horizontal scrolling at phone, tablet and desktop sizes',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('combobox',{name:'Print layout',exact:true})).toHaveText(/4 × 6 in shipping sticker/);
  for(const width of [320,360,375,390,540,768,850,1024,1440]){
    await page.setViewportSize({width,height:900});await noOverflow(page);
    await expect(page.getByRole('heading',{name:'Your labels. Ready to ship.'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Download PDF',exact:true})).toBeDisabled();
  }
});
test('supplied sample crops label, keeps invoice on request, and exports thermal and A4',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await addSample(page);
  await expect(page.getByText('PUS02',{exact:true}).first()).toBeVisible();await noOverflow(page);
  await chooseLayout(page,'original');
  let pdf=await downloadPdf(page);
  expect(pdf.getPageCount()).toBe(1);expect(pdf.getPage(0).getHeight()).toBeLessThan(355);expect(pdf.getPage(0).getHeight()).toBeGreaterThan(330);
  await chooseLayout(page,'thermal');
  pdf=await downloadPdf(page);expect(pdf.getPage(0).getSize()).toEqual({width:288,height:432});
  for(const [paper,widthMm,heightMm] of [['label-100x150',100,150],['a6',105,148]] as const){
    await chooseLayout(page,paper);
    pdf=await downloadPdf(page);expect(pdf.getPage(0).getWidth()*25.4/72).toBeCloseTo(widthMm,6);expect(pdf.getPage(0).getHeight()*25.4/72).toBeCloseTo(heightMm,6);
  }
  await chooseLayout(page,'a4-4');
  pdf=await downloadPdf(page);expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.276,1);
  await chooseLayout(page,'original');
  await page.getByText('Invoices only',{exact:true}).click();
  pdf=await downloadPdf(page);expect(pdf.getPage(0).getHeight()).toBeLessThan(320);
  await page.getByText('Labels + invoices',{exact:true}).click();
  pdf=await downloadPdf(page);expect(pdf.getPage(0).getHeight()).toBeGreaterThan(630);
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await noOverflow(page);}
  expect(errors).toEqual([]);
});
test('unknown and image-only layouts require explicit confirmation',async({page})=>{
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595,842]).drawText('Unrecognized layout',{x:30,y:780,font,size:14});
  await page.goto('/');await page.getByLabel('Upload shipping label PDFs').setInputFiles({name:'unknown.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});
  await expect(page.getByText('Review required',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Download PDF',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Confirm this crop',exact:true}).click();
  await expect(page.getByRole('button',{name:'Download PDF',exact:true})).toBeEnabled();
  await page.getByText('Invoices only',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Download PDF',exact:true})).toBeDisabled();
});
test('invalid files show a recoverable message',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Upload shipping label PDFs').setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});
  await expect(page.getByRole('main').getByRole('alert')).toContainText('not a readable PDF');
  await expect(page.getByRole('button',{name:'Drop your label PDFs here',exact:false})).toBeEnabled();
});
test('mixed page rotations export in the visible orientation',async({page})=>{
  test.skip(!sample,'Keep the supplied sample PDF in the project root.');
  const original=await PDFDocument.load(readFileSync(resolve(sample!))),batch=await PDFDocument.create();
  for(const angle of [0,90,180,270]){
    const [copied]=await batch.copyPages(original,[0]);copied.setRotation(degrees(angle));batch.addPage(copied);
  }
  await page.goto('/');await page.getByLabel('Upload shipping label PDFs').setInputFiles({name:'rotated.pdf',mimeType:'application/pdf',buffer:Buffer.from(await batch.save())});
  await expect(page.getByText('4 label entries',{exact:false})).toBeVisible({timeout:30000});
  // Rotated text layouts may need review, so confirm the visible crop on each page.
  for(let i=1;i<=4;i++){
    await page.getByRole('button',{name:new RegExp(`^Review page ${i}(,|$)`)}).click();
    await page.getByRole('button',{name:'Confirm this crop',exact:true}).click();
  }
  const reprints=page.getByLabel('Allow intentional duplicate labels');
  if(await reprints.count())await reprints.check();
  const pdf=await downloadPdf(page);expect(pdf.getPageCount()).toBe(4);
});

test('vendor tools search, export reports and store only print preferences',async({page})=>{
 await page.goto('/');await addSample(page);
 await expect(page.getByText('Pick, check & prepare your batch',{exact:true})).toBeVisible();
 await page.getByRole('searchbox',{name:'Search batch orders'}).fill('PUS02');
 await expect(page.getByText('1 matches · 1 selected',{exact:true})).toBeVisible();
 await page.getByRole('searchbox',{name:'Search batch orders'}).fill('no-match');
 await expect(page.getByText('No entries match these filters.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 const report=page.waitForEvent('download');
 await page.getByRole('button',{name:'CSV',exact:true}).first().click();
 expect((await report).suggestedFilename()).toBe('labeldesk-picking-list.csv');
 await page.locator('.printer-details>summary').click();
 await page.getByLabel('Copies per label').fill('2');
 const pdf=await downloadPdf(page);expect(pdf.getPageCount()).toBe(2);
 const saved=await page.evaluate(()=>localStorage.getItem('labeldesk.print.v1'));
 expect(JSON.parse(saved!).copies).toBe(2);expect(saved).not.toContain('PUS02');expect(saved).not.toContain('1490843431871393');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await noOverflow(page);}
});
test('uploading the same PDF twice leaves one source and explains how to add a crop',async({page})=>{
 await page.goto('/');await addSample(page);
 await page.getByLabel('Upload shipping label PDFs').setInputFiles(resolve(sample!));
 await expect(page.getByRole('main').getByRole('alert')).toContainText('already in the workspace');
 await expect(page.getByText('1 label entry',{exact:false})).toBeVisible();
});
