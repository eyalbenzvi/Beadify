import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Contrast,
  Crop,
  Droplets,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  Maximize,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { DEFAULT_ADJUSTMENTS, DEFAULT_CROP, useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import CropTool, { fitAspect } from '../components/CropTool';
import { SectionTitle, Slider } from '../components/ui';
import { renderAdjustedCrop, transformSource, type SourceTransform } from '../lib/imageProcessing';

const ASPECTS: { id: string; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '2:1', label: '2:1', ratio: 2 },
  { id: '1:2', label: '1:2', ratio: 1 / 2 },
];

export default function CropStep() {
  const { source, setSource, crop, setCrop, cropAspect, setCropAspect, adjustments, setAdjustments, setStep } = useApp();
  const toast = useToast();
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  const ratio = ASPECTS.find((a) => a.id === cropAspect)?.ratio ?? null;

  useEffect(() => {
    if (!source || !previewRef.current) return;
    const canvas = previewRef.current;
    const frame = requestAnimationFrame(() => renderAdjustedCrop(canvas, source, crop, adjustments, 480));
    return () => cancelAnimationFrame(frame);
  }, [source, crop, adjustments]);

  if (!source) return null;

  const chooseAspect = (id: string) => {
    setCropAspect(id);
    const r = ASPECTS.find((a) => a.id === id)?.ratio;
    if (r) setCrop(fitAspect(source, r, crop.x + crop.w / 2, crop.y + crop.h / 2));
  };

  const transform = async (op: SourceTransform) => {
    setBusy(true);
    try {
      const next = await transformSource(source, op);
      // setSource resets crop & adjustments; keep the user's adjustments and aspect.
      const keepAdj = adjustments;
      const keepAspect = cropAspect;
      setSource(next);
      setAdjustments(keepAdj);
      setCropAspect(keepAspect);
      const r = ASPECTS.find((a) => a.id === keepAspect)?.ratio;
      setCrop(r ? fitAspect(next, r) : DEFAULT_CROP);
    } catch {
      toast.error('Transform failed', 'The image could not be rotated.');
    } finally {
      setBusy(false);
    }
  };

  const transforms: { op: SourceTransform; label: string; icon: JSX.Element }[] = [
    { op: 'rotate-ccw', label: 'Rotate left', icon: <RotateCcw className="h-4 w-4" /> },
    { op: 'rotate-cw', label: 'Rotate right', icon: <RotateCw className="h-4 w-4" /> },
    { op: 'flip-h', label: 'Flip horizontal', icon: <FlipHorizontal2 className="h-4 w-4" /> },
    { op: 'flip-v', label: 'Flip vertical', icon: <FlipVertical2 className="h-4 w-4" /> },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="card min-w-0 p-4 sm:p-6">
        <SectionTitle
          icon={<Crop className="h-5 w-5" />}
          title="Crop your image"
          subtitle="Drag the box or its handles. Drag on the image to draw a new selection."
        />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Aspect ratio" className="flex flex-wrap gap-1.5">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={cropAspect === a.id}
                onClick={() => chooseAspect(a.id)}
                className={`chip ${
                  cropAspect === a.id
                    ? 'border-brand-400 bg-brand-500 text-white'
                    : 'border-line bg-white text-ink-muted hover:border-brand-200'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {transforms.map((t) => (
              <button
                key={t.op}
                type="button"
                className="btn-icon"
                onClick={() => void transform(t.op)}
                disabled={busy}
                title={t.label}
                aria-label={t.label}
              >
                {t.icon}
              </button>
            ))}
            <button
              type="button"
              className="btn-icon"
              title="Select entire image"
              aria-label="Select entire image"
              onClick={() => {
                setCropAspect('free');
                setCrop(DEFAULT_CROP);
              }}
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
        <CropTool source={source} crop={crop} onChange={setCrop} aspect={ratio} />
      </section>

      <aside className="min-w-0 space-y-6">
        <section className="card p-4 sm:p-5">
          <SectionTitle icon={<Eye className="h-5 w-5" />} title="Live preview" />
          <div className="checkerboard flex aspect-square items-center justify-center overflow-hidden rounded-2xl">
            <canvas ref={previewRef} className="max-h-full max-w-full object-contain" aria-label="Cropped preview" />
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <SectionTitle
            icon={<SlidersHorizontal className="h-5 w-5" />}
            title="Adjustments"
            action={
              <button
                type="button"
                className="text-xs font-bold text-brand-500 hover:text-brand-700"
                onClick={() => setAdjustments(DEFAULT_ADJUSTMENTS)}
              >
                Reset all
              </button>
            }
          />
          <div className="space-y-5">
            <Slider
              label="Brightness"
              icon={<Sun className="h-4 w-4 text-amber-500" />}
              value={adjustments.brightness}
              min={-100}
              max={100}
              resetValue={0}
              format={(v) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(v) => setAdjustments((a) => ({ ...a, brightness: v }))}
            />
            <Slider
              label="Contrast"
              icon={<Contrast className="h-4 w-4 text-ink-subtle" />}
              value={adjustments.contrast}
              min={-100}
              max={100}
              resetValue={0}
              format={(v) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(v) => setAdjustments((a) => ({ ...a, contrast: v }))}
            />
            <Slider
              label="Saturation"
              icon={<Droplets className="h-4 w-4 text-sky-500" />}
              value={adjustments.saturation}
              min={-100}
              max={100}
              resetValue={0}
              format={(v) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(v) => setAdjustments((a) => ({ ...a, saturation: v }))}
            />
          </div>
        </section>

        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={() => setStep(1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button type="button" className="btn-primary flex-[2]" onClick={() => setStep(3)}>
            Choose colours <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}
