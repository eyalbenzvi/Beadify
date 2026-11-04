import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type {
  Adjustments,
  BeadColor,
  BoardConfig,
  Brand,
  ConversionSettings,
  CropRect,
  Pattern,
  SourceImage,
  StepId,
  ViewPreferences,
} from '../types';
import { BEAD_BY_ID, BEAD_COLORS, colorsForBrand } from '../data/beadColors';
import { readStorage, usePersistentState, writeStorage } from '../hooks/usePersistentState';
import { loadImageFromDataUrl } from '../lib/imageProcessing';

export const DEFAULT_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };
export const DEFAULT_ADJUSTMENTS: Adjustments = { brightness: 0, contrast: 0, saturation: 0 };
export const DEFAULT_SETTINGS: ConversionSettings = {
  distance: 'ciede2000',
  dither: 'none',
  fit: 'fill',
  sampling: 'average',
  maxColors: 0,
  transparentAsEmpty: true,
};
export const DEFAULT_BOARD: BoardConfig = { preset: 'single', width: 29, height: 29 };
export const DEFAULT_VIEW: ViewPreferences = {
  showGrid: true,
  showSymbols: false,
  beadStyle: 'round',
  showBoardLines: true,
  pageSize: 'a4',
  pngCellPx: 0,
};

const PROJECT_KEY = 'beadify:project:v1';
const HISTORY_LIMIT = 100;

interface StoredProject {
  sourceDataUrl: string | null;
  sourceName: string;
  crop: CropRect;
  cropAspect: string;
  adjustments: Adjustments;
  pattern: Pattern | null;
  step: StepId;
}

interface AppState {
  step: StepId;
  setStep: (s: StepId) => void;
  maxReachableStep: StepId;

  source: SourceImage | null;
  setSource: (s: SourceImage | null) => void;
  restoring: boolean;

  crop: CropRect;
  setCrop: Dispatch<SetStateAction<CropRect>>;
  cropAspect: string;
  setCropAspect: (a: string) => void;
  adjustments: Adjustments;
  setAdjustments: Dispatch<SetStateAction<Adjustments>>;

  board: BoardConfig;
  setBoard: Dispatch<SetStateAction<BoardConfig>>;
  settings: ConversionSettings;
  setSettings: Dispatch<SetStateAction<ConversionSettings>>;

  brand: Brand;
  setBrand: (b: Brand) => void;
  inventory: Set<string>;
  setInventory: (ids: Iterable<string>) => void;
  toggleInventory: (id: string) => void;
  /** Owned colours, ready for the conversion engine. */
  palette: BeadColor[];

  view: ViewPreferences;
  setView: Dispatch<SetStateAction<ViewPreferences>>;

  pattern: Pattern | null;
  setPattern: (p: Pattern | null) => void;
  commitCells: (cells: (string | null)[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  resetProject: () => void;
}

const AppContext = createContext<AppState | null>(null);

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function AppProvider({ children }: { children: ReactNode }) {
  const stored = useRef<StoredProject | null>(readStorage<StoredProject | null>(PROJECT_KEY, null));

  const [step, setStepState] = useState<StepId>(stored.current?.step ?? 1);
  const [source, setSourceState] = useState<SourceImage | null>(null);
  const [restoring, setRestoring] = useState<boolean>(Boolean(stored.current?.sourceDataUrl));
  const [crop, setCrop] = useState<CropRect>(stored.current?.crop ?? DEFAULT_CROP);
  const [cropAspect, setCropAspect] = useState<string>(stored.current?.cropAspect ?? 'free');
  const [adjustments, setAdjustments] = useState<Adjustments>(stored.current?.adjustments ?? DEFAULT_ADJUSTMENTS);

  const [board, setBoard] = usePersistentState<BoardConfig>('beadify:board', DEFAULT_BOARD);
  const [settings, setSettings] = usePersistentState<ConversionSettings>('beadify:settings', DEFAULT_SETTINGS);
  const [view, setView] = usePersistentState<ViewPreferences>('beadify:view', DEFAULT_VIEW);
  const [brand, setBrand] = usePersistentState<Brand>(
    'beadify:brand',
    'Perler',
    (v): v is Brand => v === 'Perler' || v === 'Hama',
  );
  const [inventoryIds, setInventoryIds] = usePersistentState<string[]>(
    'beadify:inventory',
    colorsForBrand('Perler').map((c) => c.id),
    isStringArray,
  );

  const [history, setHistory] = useState<{ past: Pattern[]; present: Pattern | null; future: Pattern[] }>({
    past: [],
    present: stored.current?.pattern ?? null,
    future: [],
  });

  // Restore the last session's source image.
  useEffect(() => {
    const data = stored.current;
    if (!data?.sourceDataUrl) return;
    let cancelled = false;
    loadImageFromDataUrl(data.sourceDataUrl, data.sourceName)
      .then((img) => {
        if (!cancelled) setSourceState(img);
      })
      .catch(() => {
        if (!cancelled) setStepState(1);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inventory = useMemo(() => new Set(inventoryIds.filter((id) => BEAD_BY_ID.has(id))), [inventoryIds]);
  const palette = useMemo(() => BEAD_COLORS.filter((c) => inventory.has(c.id)), [inventory]);

  const setInventory = useCallback((ids: Iterable<string>) => setInventoryIds([...new Set(ids)]), [setInventoryIds]);
  const toggleInventory = useCallback(
    (id: string) =>
      setInventoryIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])),
    [setInventoryIds],
  );

  const pattern = history.present;

  const setPattern = useCallback((p: Pattern | null) => {
    setHistory({ past: [], present: p, future: [] });
  }, []);

  const commitCells = useCallback((cells: (string | null)[]) => {
    setHistory((h) => {
      if (!h.present) return h;
      return {
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: { ...h.present, cells, edited: true },
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.past.length || !h.present) return h;
      const prev = h.past[h.past.length - 1];
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.future.length || !h.present) return h;
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest };
    });
  }, []);

  const setSource = useCallback((s: SourceImage | null) => {
    setSourceState(s);
    setCrop(DEFAULT_CROP);
    setCropAspect('free');
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setHistory({ past: [], present: null, future: [] });
  }, []);

  const maxReachableStep: StepId = !source ? 1 : pattern ? 4 : 3;

  // Steps are validated by the effect below once state has settled, so callers can
  // set a pattern/source and navigate in the same event handler.
  const setStep = useCallback((s: StepId) => {
    setStepState(s);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  // Keep the active step valid if prerequisites disappear.
  useEffect(() => {
    if (!restoring && step > maxReachableStep) setStepState(maxReachableStep);
  }, [restoring, step, maxReachableStep]);

  // Persist the working project (debounced). Falls back to dropping the image if storage is full.
  useEffect(() => {
    if (restoring) return;
    const handle = window.setTimeout(() => {
      const project: StoredProject = {
        sourceDataUrl: source?.dataUrl ?? null,
        sourceName: source?.name ?? '',
        crop,
        cropAspect,
        adjustments,
        pattern,
        step,
      };
      if (!writeStorage(PROJECT_KEY, project)) {
        writeStorage(PROJECT_KEY, { ...project, sourceDataUrl: null, pattern: null, step: 1 });
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [restoring, source, crop, cropAspect, adjustments, pattern, step]);

  const resetProject = useCallback(() => {
    setSource(null);
    setStepState(1);
  }, [setSource]);

  const value: AppState = {
    step,
    setStep,
    maxReachableStep,
    source,
    setSource,
    restoring,
    crop,
    setCrop,
    cropAspect,
    setCropAspect,
    adjustments,
    setAdjustments,
    board,
    setBoard,
    settings,
    setSettings,
    brand,
    setBrand,
    inventory,
    setInventory,
    toggleInventory,
    palette,
    view,
    setView,
    pattern,
    setPattern,
    commitCells,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    resetProject,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
