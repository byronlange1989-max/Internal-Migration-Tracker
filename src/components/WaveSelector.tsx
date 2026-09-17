import React from 'react';
import { WaveGroup } from '../types';
import { Layers, Play, CheckCircle2 } from 'lucide-react';

interface WaveSelectorProps {
  waves: WaveGroup[];
  selectedWave: string | null; // null means 'All'
  onSelectWave: (wave: string | null) => void;
  onSimulateWave: (waveName: string) => void;
}

export const WaveSelector: React.FC<WaveSelectorProps> = ({
  waves,
  selectedWave,
  onSelectWave,
  onSimulateWave,
}) => {
  const totalCount = waves.reduce((acc, w) => acc + w.count, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center space-x-2 text-slate-300">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Migration Waves &amp; Batches
          </span>
          <span className="text-xs text-slate-400">
            ({waves.length} batches configured)
          </span>
        </div>

        {selectedWave && (
          <div className="flex items-center gap-2">
            <button
              id={`btn-simulate-wave-${selectedWave.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => onSimulateWave(selectedWave)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition active:scale-95"
            >
              <Play className="w-3 h-3 text-indigo-400" />
              <span>Simulate {selectedWave} Execution</span>
            </button>
          </div>
        )}
      </div>

      {/* Wave Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSelectWave(null)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            selectedWave === null
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
          }`}
        >
          <span>All Workloads</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              selectedWave === null ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'
            }`}
          >
            {totalCount}
          </span>
        </button>

        {waves.map((w) => {
          const isSelected = selectedWave === w.wave;
          const isComplete = w.completed === w.count && w.count > 0;
          return (
            <button
              key={w.wave}
              onClick={() => onSelectWave(w.wave)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
              }`}
            >
              {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{w.wave}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {w.completed}/{w.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
