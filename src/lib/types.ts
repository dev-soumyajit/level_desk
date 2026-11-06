import type { OrderMetadata } from './order-types';
export type Rect = { x: number; y: number; width: number; height: number };
export type TextToken = { text: string; x: number; y: number; width: number; height: number };
export type Mode = 'label' | 'combined' | 'invoice';
export type Paper = 'custom' | 'original' | 'thermal' | 'label-100x150' | 'a6' | 'a4-2' | 'a4-4';
export type SortOrder = 'original' | 'sku' | 'courier';
export type Detection = OrderMetadata & {
  label: Rect; combined: Rect; invoice: Rect | null;
  confidence: 'detected' | 'review'; reason: string;
  sku: string; quantity: string; courier: string;
};
export type PageRecord = Detection & {
  id: string; sourceId: string; fileName: string; pageIndex: number;
  width: number; height: number; transform: number[];
  included: boolean; approved: boolean;
  overrides: Partial<Record<Mode, Rect>>;
};
export type SourceFile = { id: string; name: string; bytes: Uint8Array; pages: number };
export type ExportOptions = { mode: Mode; paper: Paper; sort: SortOrder; copies?: number; marginMm?: number; autoRotate?: boolean; customWidthMm?: number; customHeightMm?: number };
export function getCrop(page: PageRecord, mode: Mode): Rect | null {
  return page.overrides[mode] ?? page[mode];
}
export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(width - 1, Number.isFinite(rect.x) ? rect.x : 0));
  const y = Math.max(0, Math.min(height - 1, Number.isFinite(rect.y) ? rect.y : 0));
  return { x, y, width: Math.max(1, Math.min(width - x, rect.width || 1)), height: Math.max(1, Math.min(height - y, rect.height || 1)) };
}
export function sortPages(pages: PageRecord[], sort: SortOrder): PageRecord[] {
  return [...pages].sort((a, b) => sort === 'original' ? 0 :
    (a[sort] || '\uffff').localeCompare(b[sort] || '\uffff', 'en', { numeric: true, sensitivity: 'base' }));
}
export function needsReview(page: PageRecord, mode: Mode): boolean {
  return !page.approved && (page.confidence === 'review' || (mode === 'invoice' && !page.invoice));
}
