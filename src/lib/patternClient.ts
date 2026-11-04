import type { Pattern } from '../types';
import type { WorkerRequest, WorkerResponse } from '../workers/pattern.worker';
import { extractRegion, type GenerateInput } from './imageProcessing';
import { buildPattern, type BuildInput } from './patternEngine';

type Pending = { resolve: (p: Pattern) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/pattern.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const job = pending.get(msg.id);
      if (!job) return;
      pending.delete(msg.id);
      if (msg.ok) job.resolve(msg.pattern);
      else job.reject(new Error(msg.error));
    };
    worker.onerror = () => {
      // The worker is unusable (e.g. blocked by CSP). Fail pending jobs and fall back to sync.
      workerFailed = true;
      worker?.terminate();
      worker = null;
      for (const [, job] of pending) job.reject(new Error('Background processing failed. Please try again.'));
      pending.clear();
    };
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

/**
 * Converts an image into a bead pattern. Rasterising happens on the main thread
 * (it needs the DOM). Pooling, quantization and dithering run in a Web Worker so the
 * UI stays responsive. The RGBA buffer is transferred, not copied.
 */
export function requestPattern(input: GenerateInput): Promise<Pattern> {
  if (input.palette.length === 0) {
    return Promise.reject(new Error('Your inventory is empty. Select at least one bead colour.'));
  }
  let region;
  try {
    region = extractRegion(input);
  } catch (err) {
    return Promise.reject(err instanceof Error ? err : new Error('Could not read the image.'));
  }
  const build: BuildInput = {
    region,
    width: input.width,
    height: input.height,
    adjustments: input.adjustments,
    settings: input.settings,
    palette: input.palette,
  };
  const w = getWorker();
  if (!w) {
    try {
      return Promise.resolve(buildPattern(build));
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error('Pattern generation failed.'));
    }
  }
  const id = nextId++;
  return new Promise<Pattern>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: WorkerRequest = { id, input: build };
    w.postMessage(request, [region.data.buffer]);
  });
}

/**
 * Wraps requestPattern so only the most recent call resolves. Earlier, stale
 * calls never settle, so rapid setting changes can't show an outdated preview.
 */
export function createLatestPatternRequester() {
  let generation = 0;
  return (input: GenerateInput): Promise<Pattern> => {
    const mine = ++generation;
    return new Promise<Pattern>((resolve, reject) => {
      requestPattern(input).then(
        (p) => mine === generation && resolve(p),
        (e) => mine === generation && reject(e),
      );
    });
  };
}
