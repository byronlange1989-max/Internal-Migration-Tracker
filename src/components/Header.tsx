import React from 'react';
import {
  Server,
  FileSpreadsheet,
  Terminal,
  Download,
  RotateCcw,
  Radio,
  Plus,
  Zap,
  Trash2,
} from 'lucide-react';

interface HeaderProps {
  connected: boolean;
  onOpenSpreadsheetModal: () => void;
  onOpenPythonHub: () => void;
  onOpenAddVmModal: () => void;
  onResetData: () => void;
  onExportXlsx: () => void;
  onDiscardAll?: () => void;
  vmCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  connected,
  onOpenSpreadsheetModal,
  onOpenPythonHub,
  onOpenAddVmModal,
  onResetData,
  onExportXlsx,
  onDiscardAll,
  vmCount = 0,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <span>vCenter</span>
                  <span className="text-slate-400 font-normal">→</span>
                  <span className="text-indigo-400">Virtuozzo</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    Tracker
                  </span>
                </h1>
                {/* Real-time SSE status indicator */}
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                    connected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                  title={connected ? 'Connected to live stream' : 'Reconnecting to live stream...'}
                >
                  <Radio className={`w-3 h-3 ${connected ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">{connected ? 'Live Sync' : 'Connecting'}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                VM Workload Migration Hub &amp; Python Automation Monitor
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Upload Spreadsheet */}
            <button
              id="btn-upload-spreadsheet"
              onClick={onOpenSpreadsheetModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm hover:shadow active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Upload New Spreadsheet</span>
            </button>

            {/* Discard Old Workloads */}
            {onDiscardAll && vmCount > 0 && (
              <button
                id="btn-discard-workloads"
                onClick={onDiscardAll}
                title="Discard all current workloads from tracker"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Discard Old</span>
              </button>
            )}

            {/* Python Automation Hub */}
            <button
              id="btn-python-hub"
              onClick={onOpenPythonHub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm hover:shadow active:scale-95"
            >
              <Terminal className="w-4 h-4" />
              <span>Python Scripts &amp; API</span>
            </button>

            {/* Add VM */}
            <button
              id="btn-add-vm"
              onClick={onOpenAddVmModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add VM</span>
            </button>

            {/* Export Updated Excel */}
            <button
              id="btn-export-excel"
              onClick={onExportXlsx}
              title="Download live migration tracker as Excel spreadsheet"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Export Excel</span>
            </button>

            {/* Reset / Sample Data */}
            <button
              id="btn-reset-demo"
              onClick={onResetData}
              title="Reset to sample VMware & Virtuozzo workloads"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
