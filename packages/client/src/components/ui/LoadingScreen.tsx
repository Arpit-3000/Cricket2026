import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  onFinish?: () => void;
  durationMs?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Connecting to Stadium Host...',
  onFinish,
  durationMs = 1800
}) => {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          onFinish?.();
          return 100;
        }
        return prev + 15;
      });
    }, durationMs / 7);

    return () => clearInterval(timer);
  }, [durationMs, onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-slate-950 text-white select-none animate-fadeIn">
      {/* 3D Ball Graphic */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-800 via-rose-600 to-red-500 shadow-2xl shadow-rose-900/60 flex items-center justify-center border-2 border-amber-400/40 animate-spin">
          <div className="w-full h-1 border-t-2 border-dashed border-amber-300/80" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-slate-950">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="text-center max-w-sm">
        <h2 className="text-xl font-black tracking-tight text-white mb-1">Cricket 2026 Arena</h2>
        <p className="text-xs text-slate-400 mb-4">{message}</p>

        {/* Loading Progress Bar */}
        <div className="w-full bg-slate-900 rounded-full h-2 p-0.5 border border-white/10 overflow-hidden mb-3">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-[11px] text-slate-400 italic">
          Tip: In 5-over matches, rotate strike on odd runs to preserve set batters against express pace.
        </p>
      </div>
    </div>
  );
};
