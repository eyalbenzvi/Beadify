export type PageSizeId = 'a4' | 'letter';

export interface PageSize {
  id: PageSizeId;
  label: string;
  /** Width and height in millimetres (portrait) */
  width: number;
  height: number;
  /** jsPDF format name */
  jspdf: 'a4' | 'letter';
  /** CSS @page size keyword */
  css: string;
}

export const PAGE_SIZES: Record<PageSizeId, PageSize> = {
  a4: { id: 'a4', label: 'A4', width: 210, height: 297, jspdf: 'a4', css: 'A4 portrait' },
  letter: { id: 'letter', label: 'US Letter', width: 215.9, height: 279.4, jspdf: 'letter', css: 'letter portrait' },
};

/** Page margin in millimetres (shared by PDF and print). */
export const PAGE_MARGIN = 12;
