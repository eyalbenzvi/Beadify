export type Brand = 'Perler' | 'Hama';

export type ColorFamily =
  | 'Reds'
  | 'Oranges'
  | 'Yellows'
  | 'Greens'
  | 'Blues'
  | 'Purples'
  | 'Pinks'
  | 'Browns'
  | 'Neutrals';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface BeadColor {
  /** Unique id across brands, e.g. "P01" or "H18" */
  id: string;
  /** Manufacturer code as printed on the bag */
  code: string;
  name: string;
  hex: string;
  brand: Brand;
  family: ColorFamily;
  rgb: RGB;
  lab: Lab;
}

/** Crop rectangle normalised to 0..1 of the source image. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Adjustments {
  /** -100..100 */
  brightness: number;
  /** -100..100 */
  contrast: number;
  /** -100..100 */
  saturation: number;
}

export type DistanceMethod = 'ciede2000' | 'weighted-rgb';
export type DitherMode = 'none' | 'floyd-steinberg';
export type FitMode = 'fill' | 'fit' | 'stretch';
export type SamplingMode = 'average' | 'dominant';

export interface BoardConfig {
  /** Preset key or "custom" */
  preset: string;
  width: number;
  height: number;
}

export interface ConversionSettings {
  distance: DistanceMethod;
  dither: DitherMode;
  fit: FitMode;
  /** Average pooling (smooth, best for photos) or majority vote (crisp, best for pixel art) */
  sampling: SamplingMode;
  /** 0 = unlimited */
  maxColors: number;
  /** Treat (mostly) transparent pixels as empty pegs */
  transparentAsEmpty: boolean;
}

export interface SourceImage {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  element: HTMLImageElement;
}

/**
 * A generated pattern. `cells` is a flat row-major array of bead color ids,
 * with `null` meaning an empty peg.
 */
export interface Pattern {
  width: number;
  height: number;
  cells: (string | null)[];
  createdAt: number;
  edited: boolean;
}

export interface ViewPreferences {
  showGrid: boolean;
  showSymbols: boolean;
  beadStyle: 'round' | 'square';
  showBoardLines: boolean;
}

export type StepId = 1 | 2 | 3 | 4;

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

export interface ColorUsage {
  color: BeadColor;
  count: number;
  symbol: string;
}
