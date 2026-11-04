export interface BoardPreset {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
}

export const BOARD_PRESETS: BoardPreset[] = [
  { id: 'mini', label: 'Small Square', description: '1 board · 15 × 15', width: 15, height: 15 },
  { id: 'single', label: 'Standard Board', description: '1 board · 29 × 29', width: 29, height: 29 },
  { id: 'wide', label: '2 × 1 Boards', description: 'Landscape · 58 × 29', width: 58, height: 29 },
  { id: 'tall', label: '1 × 2 Boards', description: 'Portrait · 29 × 58', width: 29, height: 58 },
  { id: 'quad', label: '2 × 2 Boards', description: '4 boards · 58 × 58', width: 58, height: 58 },
  { id: 'nine', label: '3 × 3 Boards', description: '9 boards · 87 × 87', width: 87, height: 87 },
];

export const MIN_GRID = 5;
export const MAX_GRID = 200;
