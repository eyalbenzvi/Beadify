import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Camera, FolderOpen, ImagePlus, Sparkles, UploadCloud, Wand2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { PRESETS } from '../data/presets';
import { ImageLoadError, loadImageFromDataUrl, loadImageFromFile } from '../lib/imageProcessing';
import { SectionTitle, Spinner } from '../components/ui';

export default function UploadStep() {
  const { setSource, setStep, source } = useApp();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const p of PRESETS) map[p.id] = p.render();
    setThumbs(map);
  }, []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading('Loading your image…');
    try {
      const img = await loadImageFromFile(file);
      setSource(img);
      toast.success('Image loaded!', `${img.width} × ${img.height}px — now crop and adjust it.`);
      setStep(2);
    } catch (err) {
      toast.error(
        'Could not open that image',
        err instanceof ImageLoadError ? err.message : 'Something went wrong while reading the file.',
      );
    } finally {
      setLoading(null);
    }
  };

  const handlePreset = async (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setLoading(`Loading “${preset.name}”…`);
    try {
      const url = thumbs[id] ?? preset.render();
      const img = await loadImageFromDataUrl(url, preset.name);
      setSource(img);
      toast.success(`${preset.name} selected`, 'Tweak the crop or jump straight to colours.');
      setStep(2);
    } catch {
      toast.error('Preset failed to load', 'Please try another sample.');
    } finally {
      setLoading(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/')) ?? e.dataTransfer.files[0];
    if (!file) {
      toast.error('Nothing to upload', 'Drop an image file (PNG, JPEG or WebP).');
      return;
    }
    void handleFile(file);
  };

  return (
    <div className="space-y-8">
      <section className="text-center">
        <p className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-brand-600 shadow-soft">
          <Sparkles className="h-3.5 w-3.5" /> Turn any picture into a fuse bead pattern
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
          From photo to{' '}
          <span className="bg-gradient-to-r from-brand-500 via-violet-500 to-sky-500 bg-clip-text text-transparent">
            pegboard
          </span>{' '}
          in seconds
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-subtle sm:text-base">
          Upload an image, crop it, pick the beads you actually own, and get a printable pattern with a complete
          shopping list.
        </p>
      </section>

      <section className="card relative overflow-hidden p-4 sm:p-6">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <Spinner label={loading} />
          </div>
        )}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-4 py-10 text-center transition sm:py-14 ${
            dragging ? 'scale-[1.01] border-brand-400 bg-brand-50' : 'border-line bg-surface-muted/60'
          }`}
        >
          <span
            className={`mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-violet-500 text-white shadow-pop transition ${
              dragging ? 'animate-wiggle' : ''
            }`}
          >
            <UploadCloud className="h-8 w-8" />
          </span>
          <p className="font-display text-xl font-semibold text-ink-soft">
            {dragging ? 'Drop it like it’s hot!' : 'Drag & drop an image here'}
          </p>
          <p className="mt-1 text-sm text-ink-subtle">PNG, JPEG or WebP · up to 25 MB</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn-primary" onClick={() => fileInput.current?.click()}>
              <FolderOpen className="h-4 w-4" /> Choose file
            </button>
            <button type="button" className="btn-secondary" onClick={() => cameraInput.current?.click()}>
              <Camera className="h-4 w-4" /> Take a photo
            </button>
            {source && (
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
                <ImagePlus className="h-4 w-4" /> Continue with “{source.name}”
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <SectionTitle
          icon={<Wand2 className="h-5 w-5" />}
          title="Or start from a sample"
          subtitle="Pixel art converts perfectly — the photo-like scenes show off dithering."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void handlePreset(p.id)}
              className="group overflow-hidden rounded-2xl border border-line-soft bg-white text-left transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-pop focus-visible:-translate-y-1"
            >
              <div className="checkerboard aspect-square overflow-hidden">
                {thumbs[p.id] && (
                  <img
                    src={thumbs[p.id]}
                    alt={p.name}
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                    style={{ imageRendering: p.id === 'sunset' || p.id === 'planet' ? 'auto' : 'pixelated' }}
                  />
                )}
              </div>
              <div className="p-2.5">
                <p className="text-sm font-extrabold text-ink-soft">{p.name}</p>
                <p className="truncate text-xs text-ink-subtle">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
