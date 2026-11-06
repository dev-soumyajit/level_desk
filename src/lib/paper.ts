import type { ExportOptions, Paper } from './types';

export const PAPER_PRESETS: { value: Paper; name: string; description: string }[] = [
  { value: 'thermal', name: '4 × 6 in shipping sticker', description: '101.6 × 152.4 mm · one per label' },
  { value: 'label-100x150', name: '100 × 150 mm shipping sticker', description: 'One per label · match your pack' },
  { value: 'a6', name: 'A6 label', description: '105 × 148 mm · one per label' },
  { value: 'custom', name: 'Custom label size', description: 'Enter the size on your label pack' },
  { value: 'original', name: 'Cropped size', description: 'Original proportions' },
  { value: 'a4-2', name: 'A4 · 2 per sheet', description: 'Standard office printer' },
  { value: 'a4-4', name: 'A4 · 4 per sheet', description: 'Save paper, smaller labels' }
];

export function mmToPoints(mm: number): number {
  return mm * 72 / 25.4;
}

// PDF dimensions describe the physical stock, independently of its coating.
export function singleLabelSize(paper: Paper): [number, number] | null {
  switch (paper) {
    case 'thermal': return [288, 432];
    case 'label-100x150': return [mmToPoints(100), mmToPoints(150)];
    case 'a6': return [mmToPoints(105), mmToPoints(148)];
    default: return null;
  }
}

export function printInstructions(paper: Paper): string {
  const size = paper === 'thermal' ? '4 × 6 in (101.6 × 152.4 mm)' :
    paper === 'label-100x150' ? '100 × 150 mm' : paper === 'a6' ? 'A6 (105 × 148 mm)' : '';
  return size ? `Set the printer paper size to ${size}. Print at Actual size / 100% and turn off Fit to page. One label prints per page; the crop rotates to fit without stretching.` : '';
}

export function resolveLabelSize(options:ExportOptions):[number,number]|null{
 return options.paper==='custom'?[mmToPoints(options.customWidthMm??100),mmToPoints(options.customHeightMm??150)]:singleLabelSize(options.paper);
}
