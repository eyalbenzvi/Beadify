import { lazy, Suspense } from 'react';
import Header from './components/Header';
import { Spinner } from './components/ui';
import { useApp } from './context/AppContext';
import UploadStep from './steps/UploadStep';
import CropStep from './steps/CropStep';
import InventoryStep from './steps/InventoryStep';

const EditorStep = lazy(() => import('./steps/EditorStep'));

export default function App() {
  const { step, restoring } = useApp();

  return (
    <>
      <div className="app-shell flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {restoring ? (
            <Spinner label="Restoring your last project…" className="py-24" />
          ) : (
            <div key={step} className="animate-fade-in-up">
              {step === 1 && <UploadStep />}
              {step === 2 && <CropStep />}
              {step === 3 && <InventoryStep />}
              {step === 4 && (
                <Suspense fallback={<Spinner label="Loading editor…" className="py-24" />}>
                  <EditorStep />
                </Suspense>
              )}
            </div>
          )}
        </main>
        <footer className="no-print py-6 text-center text-xs font-semibold text-slate-400">
          Beadify · Everything runs in your browser — your images never leave your device.
        </footer>
      </div>
    </>
  );
}
