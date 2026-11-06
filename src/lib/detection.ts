import { extractOrderMetadata } from './order-metadata';
import { clampRect, type Detection, type Rect, type TextToken } from './types';
export type PixelScan = { bounds: Rect | null; darkRows: number[] };
// Pixel inspection only locates margins and separators. Export never uses this raster.
export function scanPixels(data: Uint8ClampedArray, width: number, height: number): PixelScan {
  let left = width, top = height, right = -1, bottom = -1;
  const darkRows = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 32) continue;
      const shade = Math.min(data[i], data[i + 1], data[i + 2]);
      if (shade < 210) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      if (shade < 100) darkRows[y]++;
    }
  }
  return { bounds: right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }, darkRows };
}
function lines(tokens: TextToken[]) {
  const rows: { y: number; tokens: TextToken[] }[] = [];
  for (const token of [...tokens].filter(t => t.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = rows.find(r => Math.abs(r.y - token.y) < Math.max(2, token.height * .25));
    if (!row) { row = { y: token.y, tokens: [] }; rows.push(row); }
    row.tokens.push(token);
  }
  return rows.map(r => ({ y: r.y, text: r.tokens.sort((a, b) => a.x - b.x).map(t => t.text).join(' '), tokens: r.tokens }));
}
function valueUnder(tokens: TextToken[], title: RegExp, maxY: number) {
  const header = tokens.find(t => title.test(t.text.trim()) && t.y < maxY);
  if (!header) return '';
  return tokens.filter(t => t.y > header.y + header.height * .6 && t.y < Math.min(maxY, header.y + 55) &&
    t.x >= header.x - 8 && t.x < header.x + Math.max(55, header.width + 15) && t.text.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x)[0]?.text.trim() ?? '';
}
export function detectPage(tokens: TextToken[], width: number, height: number, scan?: PixelScan): Detection {
  const rows = lines(tokens);
  const text = rows.map(r => r.text).join('\n');
  const courier = ['Delhivery', 'Ekart', 'Ecom Express', 'Xpressbees', 'Shadowfax', 'Blue Dart', 'DTDC', 'Amazon Shipping', 'India Post']
    .find(name => text.toLowerCase().includes(name.toLowerCase())) ?? '';
  let content = scan?.bounds ?? { x: 0, y: 0, width, height };
  if (scan?.bounds) content = clampRect({ x: content.x - 3, y: content.y - 3, width: content.width + 6, height: content.height + 6 }, width, height);
  const invoiceRows = rows.filter(r => /\b(?:tax\s*invoice|retail\s*invoice)\b/i.test(r.text) || /^\s*invoice\s*$/i.test(r.text));
  const candidate = invoiceRows.find(r => r.y > height * .1 && r.y < height * .85);
  const before = rows.filter(r => r.y < (candidate?.y ?? height)).map(r => r.text).join('\n');
  const shipping = /customer\s*address|ship\s*to|shipping\s*address|delivery\s*address/i.test(before) &&
    (/\b(?:AWB|tracking|pickup|destination\s*code|prepaid|COD|shipping\s*label)\b/i.test(before) || !!courier);
  const addressCount = rows.filter(r => /customer\s*address|shipping\s*address|delivery\s*address/i.test(r.text)).length;
  let split: number | null = null;
  if (candidate && shipping && invoiceRows.length === 1 && addressCount <= 1) {
    // Prefer an actual separator above the heading to a hardcoded crop ratio.
    split = Math.max(content.y + 1, candidate.y - 3);
    if (scan) {
      const start = Math.max(0, Math.floor(candidate.y - 12));
      const end = Math.min(scan.darkRows.length - 1, Math.ceil(candidate.y));
      for (let y = end; y >= start; y--) {
        if (scan.darkRows[y] > content.width * .65) { split = y; break; }
      }
    }
  }
  const label = split === null ? content : { ...content, height: split - content.y };
  const invoice = split === null ? null : { ...content, y: split, height: content.y + content.height - split };
  const thermal = width <= 440 && height <= 740;
  const detected = split !== null || (thermal && shipping && invoiceRows.length === 0 && addressCount <= 1);
  let reason = split !== null ? 'Shipping section and invoice separator found.' :
    detected ? 'A standalone shipping label was detected.' :
    !tokens.length ? 'Image-only page. Adjust the crop and confirm it before export.' :
    addressCount > 1 || invoiceRows.length > 1 ? 'Multiple label sections found. Review and crop this page manually.' :
    'Layout could not be identified safely. Review the full-page selection.';
  if (!scan?.bounds && scan) reason = 'This page appears blank. Exclude it or confirm the selection.';
  return { ...extractOrderMetadata(tokens, split ?? height), label, combined: content, invoice, confidence: detected && (!scan || !!scan.bounds) ? 'detected' : 'review',
    reason, courier, sku: valueUnder(tokens, /^SKU\s*:?$/i, split ?? height), quantity: valueUnder(tokens, /^(?:Qty|Quantity)\s*\.?\s*:?$/i, split ?? height) };
}
