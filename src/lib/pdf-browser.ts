import { pixelFingerprint } from './batch';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { detectPage, scanPixels } from './detection';
import type { PageRecord, SourceFile, TextToken } from './types';
let engine: Promise<typeof import('pdfjs-dist')> | undefined;
export function pdfEngine() {
  if (!engine) engine = import('pdfjs-dist').then(lib => {
    lib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
    return lib;
  }).catch(error => { engine = undefined; throw error; });
  return engine;
}
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const lib = await pdfEngine();
  return lib.getDocument({ data: bytes.slice(), isEvalSupported: false,
    cMapUrl: '/pdfjs/cmaps/', cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/' }).promise;
}
export async function analyzePage(page: PDFPageProxy, source: SourceFile): Promise<PageRecord> {
  const lib = await pdfEngine();
  const view = page.getViewport({ scale: 1 });
  if (!Number.isFinite(view.width) || !Number.isFinite(view.height) || view.width > 14400 || view.height > 14400 || view.width < 1 || view.height < 1) throw new Error('This page has unsupported dimensions. Re-export it on a standard paper size.');
  const text = await page.getTextContent();
  const tokens: TextToken[] = text.items.flatMap(item => {
    if (!('str' in item) || !item.str.trim()) return [];
    const tx = lib.Util.transform(view.transform, item.transform);
    const h = Math.hypot(tx[2], tx[3]);
    return [{ text: item.str, x: tx[4], y: tx[5] - h, width: item.width * view.scale, height: h }];
  });
  // Scale to one point per pixel for consistent geometry; cap pathological pages.
  const scale = Math.min(1, 1600 / Math.max(view.width, view.height));
  const preview = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(preview.width); canvas.height = Math.ceil(preview.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Your browser cannot render PDF previews. Try current Chrome or Edge.');
  await page.render({ canvasContext: ctx, canvas, viewport: preview, background: 'white' }).promise;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const fingerprint = pixelFingerprint(image.data, canvas.width, canvas.height);
  const pixels = scanPixels(image.data, canvas.width, canvas.height);
  // Detection works in viewport points, independent of render scale.
  const scan = {
    bounds: pixels.bounds ? { x: pixels.bounds.x / scale, y: pixels.bounds.y / scale, width: pixels.bounds.width / scale, height: pixels.bounds.height / scale } : null,
    darkRows: Array.from({ length: Math.ceil(view.height) }, (_, y) => (pixels.darkRows[Math.min(pixels.darkRows.length - 1, Math.floor(y * scale))] ?? 0) / scale)
  };
  const result = detectPage(tokens, view.width, view.height, scan);
  canvas.width = 0; canvas.height = 0;
  page.cleanup();
  return { ...result, fingerprint, packed: false, id: `${source.id}:${page.pageNumber}`, sourceId: source.id, fileName: source.name,
    pageIndex: page.pageNumber - 1, width: view.width, height: view.height,
    transform: [...view.transform], included: true, approved: false, overrides: {} };
}
export function friendlyPdfError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  if (/password|encrypted/i.test(value)) return 'This PDF is password protected. Unlock it and upload it again.';
  if (/invalid|corrupt|bad.*PDF|PDF.*header/i.test(value)) return 'This file is not a readable PDF. Download a fresh copy from your seller panel.';
  if (/fetch|worker|module/i.test(value)) return 'The PDF engine could not load. Reload the app; if needed, run npm install to prepare the PDF worker.';
  return value || 'The PDF could not be processed. Try a fresh copy.';
}
