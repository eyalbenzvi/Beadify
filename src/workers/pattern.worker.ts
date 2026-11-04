/// <reference lib="webworker" />
import { buildPattern, type BuildInput } from '../lib/patternEngine';
import type { Pattern } from '../types';

export interface WorkerRequest {
  id: number;
  input: BuildInput;
}

export type WorkerResponse = { id: number; ok: true; pattern: Pattern } | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, input } = event.data;
  try {
    const pattern = buildPattern(input);
    ctx.postMessage({ id, ok: true, pattern } satisfies WorkerResponse);
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'Pattern generation failed.' } satisfies WorkerResponse);
  }
};
