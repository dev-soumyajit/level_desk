import { mmToPoints, resolveLabelSize } from './paper';
import { duplicateIds, validatePrintOptions } from './batch';
import { rawBounds } from './geometry';
import { PDFDocument, PrintScaling, degrees, type PDFEmbeddedPage, type PDFPage } from 'pdf-lib';
import { getCrop, needsReview, sortPages, type ExportOptions, type PageRecord, type Rect, type SourceFile } from './types';
const A4 = [595.276, 841.89] as const;
function place(target: PDFPage, embed: PDFEmbeddedPage, record: PageRecord, box: Rect, autoRotate = true) {
  let angle = Math.round(Math.atan2(-record.transform[1],record.transform[0])*180/Math.PI);
  const rotated = Math.abs(angle) % 180 === 90;
  const naturalW = rotated ? embed.height : embed.width, naturalH = rotated ? embed.width : embed.height;
  if (autoRotate && Math.min(box.width/naturalH,box.height/naturalW) > Math.min(box.width/naturalW,box.height/naturalH)) angle += 90;
  const rad = angle*Math.PI/180, cos = Math.round(Math.cos(rad)), sin = Math.round(Math.sin(rad));
  const corners = [[0,0],[embed.width,0],[0,embed.height],[embed.width,embed.height]].map(([x,y])=>[cos*x-sin*y,sin*x+cos*y]);
  const minX = Math.min(...corners.map(p=>p[0])), minY = Math.min(...corners.map(p=>p[1]));
  const w = Math.max(...corners.map(p=>p[0]))-minX, h = Math.max(...corners.map(p=>p[1]))-minY;
  const scale = Math.min(box.width/w,box.height/h);
  target.drawPage(embed, { x: box.x+(box.width-w*scale)/2-minX*scale, y: box.y+(box.height-h*scale)/2-minY*scale,
    width: embed.width*scale, height: embed.height*scale, rotate: degrees(angle) });
}
export async function exportPdf(sources: SourceFile[], records: PageRecord[], options: ExportOptions, progress?: (n:number)=>void, allowReprints = false): Promise<Uint8Array> {
  validatePrintOptions(options);
  const unique = sortPages(records.filter(p=>p.included),options.sort);
  if (!allowReprints && duplicateIds(unique,options.mode).size) throw new Error('Possible duplicate labels found. Exclude repeats or enable intentional reprints.');
  const selected = unique.flatMap(record=>Array.from({length:options.copies??1},()=>record));
  if (!selected.length) throw new Error('Select at least one page to export.');
  if (selected.some(p=>needsReview(p,options.mode))) throw new Error('Review and confirm the highlighted pages before export.');
  const output = await PDFDocument.create();
  output.setTitle('LabelDesk - Print-ready shipping labels');
  output.setCreator('LabelDesk');
  output.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const loaded = new Map<string, PDFDocument>();
  let sheet: PDFPage | undefined;
  const embeds = new Map<string, PDFEmbeddedPage>();
  for (let i=0;i<selected.length;i++) {
    const record = selected[i], crop = getCrop(record,options.mode);
    if (!crop) throw new Error(`No ${options.mode} crop on page ${record.pageIndex+1}. Adjust its crop first.`);
    let src = loaded.get(record.sourceId);
    if (!src) {
      const source = sources.find(s=>s.id===record.sourceId);
      if (!source) throw new Error('The source file is no longer available. Upload it again.');
      src = await PDFDocument.load(source.bytes); loaded.set(record.sourceId,src);
    }
    let embedded = embeds.get(record.id);
    if (!embedded) { embedded = await output.embedPage(src.getPage(record.pageIndex),rawBounds(crop,record.transform)); embeds.set(record.id,embedded); }
    if (options.paper === 'a4-2' || options.paper === 'a4-4') {
      const perSheet = options.paper === 'a4-2' ? 2 : 4;
      const slot = i%perSheet;
      if (slot===0) sheet = output.addPage([...A4]);
      const cols = perSheet===4 ? 2 : 1, rows = 2, margin = mmToPoints(options.marginMm??2.1), gap = 12;
      const width = (A4[0]-2*margin-(cols-1)*gap)/cols, height = (A4[1]-2*margin-gap)/rows;
      place(sheet!, embedded, record, { x: margin+(slot%cols)*(width+gap), y: A4[1]-margin-(Math.floor(slot/cols)+1)*height-Math.floor(slot/cols)*gap, width, height }, options.autoRotate !== false);
    } else {
      const labelSize = resolveLabelSize(options);
      const size: [number, number] = labelSize ?? [crop.width,crop.height];
      const page = output.addPage(size);
      const margin = labelSize ? mmToPoints(options.marginMm??2.1) : 0;
      place(page,embedded,record,{ x: margin,y: margin,width: size[0]-margin*2,height: size[1]-margin*2 }, options.paper !== 'original' && options.autoRotate !== false);
    }
    progress?.(Math.round((i+1)/selected.length*100));
    if (i%10===0) await new Promise(r=>setTimeout(r,0));
  }
  return output.save();
}
