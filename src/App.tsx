import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { VmTable } from './components/VmTable';
import { VmDetailDrawer } from './components/VmDetailDrawer';
import { SpreadsheetModal } from './components/SpreadsheetModal';
import { PythonHubModal } from './components/PythonHubModal';
import { AddVmModal } from './components/AddVmModal';
import { MigrationVM, MigrationStats, MigrationLog } from './types';
import { Terminal, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [vms, setVms] = useState<MigrationVM[]>([]);
  const [stats, setStats] = useState<MigrationStats>({
    totalVms: 0,
    completedVms: 0,
    inProgressVms: 0,
    failedVms: 0,
    notStartedVms: 0,
    totalDiskGb: 0,
    migratedDiskGb: 0,
    activeTransferSpeedMbps: 0,
    completionPercentage: 0,
  });
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [selectedVmId, setSelectedVmId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Modals
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [isPythonHubOpen, setIsPythonHubOpen] = useState(false);
  const [isAddVmModalOpen, setIsAddVmModalOpen] = useState(false);
  const [droppedFileForModal, setDroppedFileForModal] = useState<File | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warn' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch all migrations
  const fetchMigrations = useCallback(async () => {
    try {
      const res = await fetch('/api/migrations');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setVms(data.vms || []);
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching migrations:', err);
    }
  }, []);

  // Fetch recent logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/migrations/all/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }, []);

  // Real-Time Server-Sent Events (SSE) listener
  useEffect(() => {
    fetchMigrations();
    fetchLogs();

    const eventSource = new EventSource('/api/migrations/stream');

    eventSource.addEventListener('connected', () => {
      setConnected(true);
    });

    eventSource.addEventListener('migration_updated', (e: MessageEvent) => {
      try {
        const updatedVm: MigrationVM = JSON.parse(e.data);
        setVms((prev) => {
          const index = prev.findIndex((v) => v.id === updatedVm.id);
          if (index === -1) return [...prev, updatedVm];
          const copy = [...prev];
          copy[index] = updatedVm;
          return copy;
        });
      } catch (err) {
        console.error('Failed to parse migration_updated event', err);
      }
    });

    eventSource.addEventListener('migration_created', (e: MessageEvent) => {
      try {
        const newVm: MigrationVM = JSON.parse(e.data);
        setVms((prev) => [...prev, newVm]);
        fetchMigrations();
      } catch (err) {
        console.error('Failed to parse migration_created event', err);
      }
    });

    eventSource.addEventListener('migration_deleted', (e: MessageEvent) => {
      try {
        const { id } = JSON.parse(e.data);
        setVms((prev) => prev.filter((v) => v.id !== id));
        fetchMigrations();
      } catch (err) {
        console.error('Failed to parse migration_deleted event', err);
      }
    });

    eventSource.addEventListener('migrations_reloaded', () => {
      fetchMigrations();
      fetchLogs();
    });

    eventSource.addEventListener('log_added', (e: MessageEvent) => {
      try {
        const newLog: MigrationLog = JSON.parse(e.data);
        setLogs((prev) => [...prev.slice(-1500), newLog]);
      } catch (err) {
        console.error('Failed to parse log_added event', err);
      }
    });

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [fetchMigrations, fetchLogs]);

  // Recalculate stats whenever vms change locally
  useEffect(() => {
    const total = vms.length;
    let completed = 0;
    let inProgress = 0;
    let failed = 0;
    let notStarted = 0;
    let totalDisk = 0;
    let migratedDisk = 0;
    let speed = 0;

    for (const v of vms) {
      totalDisk += v.diskGb || 0;
      migratedDisk += v.transferredGb || 0;
      if (v.status === 'completed') completed++;
      else if (v.status === 'failed') failed++;
      else if (['not_started', 'scheduled'].includes(v.status)) notStarted++;
      else {
        inProgress++;
        speed += v.speedMbps || 0;
      }
    }

    setStats({
      totalVms: total,
      completedVms: completed,
      inProgressVms: inProgress,
      failedVms: failed,
      notStartedVms: notStarted,
      totalDiskGb: Math.round(totalDisk * 10) / 10,
      migratedDiskGb: Math.round(migratedDisk * 10) / 10,
      activeTransferSpeedMbps: Math.round(speed * 10) / 10,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  }, [vms]);

  // Actions
  const handleImportSpreadsheet = async (importedVms: Partial<MigrationVM>[], mode: 'replace' | 'append') => {
    try {
      const res = await fetch('/api/migrations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vms: importedVms, mode }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`Successfully imported ${result.count} workloads from spreadsheet!`, 'success');
        fetchMigrations();
      }
    } catch (err) {
      showToast('Failed to import spreadsheet rows.', 'warn');
    }
  };

  const handleSimulateVm = async (vmId: string) => {
    try {
      const vm = vms.find((v) => v.id === vmId);
      const res = await fetch(`/api/migrations/${vmId}/simulate`, { method: 'POST' });
      if (res.ok) {
        showToast(`Started real-time migration simulation for ${vm ? vm.vmName : vmId}`, 'info');
      }
    } catch (err) {
      showToast('Error starting simulation', 'warn');
    }
  };

  const handleAbortVm = async (vmId: string) => {
    try {
      const res = await fetch(`/api/migrations/${vmId}/abort`, { method: 'POST' });
      if (res.ok) {
        showToast('Migration aborted and safely rolled back.', 'warn');
      }
    } catch (err) {
      showToast('Error aborting migration', 'warn');
    }
  };

  const handleDeleteVm = async (vmId: string) => {
    try {
      const res = await fetch(`/api/migrations/${vmId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Workload removed from tracker.', 'info');
      }
    } catch (err) {
      showToast('Failed to delete workload', 'warn');
    }
  };

  const handleToggleMigrated = async (vmId: string, migrated: boolean) => {
    try {
      const res = await fetch(`/api/migrations/${vmId}/mark-migrated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ migrated }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(
          migrated
            ? `Marked '${data.vm?.vmName || vmId}' as Migrated`
            : `Marked '${data.vm?.vmName || vmId}' as Not Migrated`,
          'success'
        );
        fetchMigrations();
        fetchLogs();
      } else {
        showToast('Failed to update status', 'warn');
      }
    } catch (err) {
      showToast('Error updating migration status', 'warn');
    }
  };

  const handleBulkMarkMigrated = async (vmIds: string[], migrated: boolean) => {
    try {
      const res = await fetch('/api/migrations/bulk-mark-migrated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmIds, migrated }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(
          migrated
            ? `Successfully marked ${data.count} workloads as Migrated`
            : `Successfully marked ${data.count} workloads as Not Migrated`,
          'success'
        );
        fetchMigrations();
        fetchLogs();
      } else {
        showToast('Failed to update bulk status', 'warn');
      }
    } catch (err) {
      showToast('Error updating workloads', 'warn');
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('Reset tracker to demo VMware & Virtuozzo enterprise workloads?')) return;
    try {
      const res = await fetch('/api/migrations/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToSample: true }),
      });
      if (res.ok) {
        showToast('Reset to default VMware & Virtuozzo sample dataset', 'success');
        fetchMigrations();
        fetchLogs();
      }
    } catch (err) {
      showToast('Failed to reset dataset', 'warn');
    }
  };

  const handleDiscardAllWorkloads = async () => {
    try {
      const res = await fetch('/api/migrations/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToSample: false }),
      });
      if (res.ok) {
        showToast('Previous spreadsheet workloads discarded. Ready for new spreadsheet.', 'info');
        fetchMigrations();
        fetchLogs();
      }
    } catch (err) {
      showToast('Failed to clear workloads', 'warn');
    }
  };

  const handleOpenSpreadsheetWithDiscard = () => {
    setDroppedFileForModal(null);
    setIsSpreadsheetModalOpen(true);
  };

  const handleFileSelectedForImport = (file: File) => {
    setDroppedFileForModal(file);
    setIsSpreadsheetModalOpen(true);
  };

  const handleExportXlsx = () => {
    window.location.href = '/api/migrations/export/xlsx';
    showToast('Generating and downloading updated Excel migration spreadsheet...', 'info');
  };

  const handleAddSingleVm = async (newVm: Partial<MigrationVM>) => {
    try {
      const res = await fetch('/api/migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVm),
      });
      if (res.ok) {
        showToast(`Workload '${newVm.vmName}' registered successfully`, 'success');
        fetchMigrations();
      }
    } catch (err) {
      showToast('Failed to add workload', 'warn');
    }
  };

  const selectedVm = vms.find((v) => v.id === selectedVmId) || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2.5 border backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
                : toast.type === 'warn'
                ? 'bg-rose-950/90 text-rose-300 border-rose-500/40'
                : 'bg-indigo-950/90 text-indigo-300 border-indigo-500/40'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        connected={connected}
        onOpenSpreadsheetModal={handleOpenSpreadsheetWithDiscard}
        onOpenPythonHub={() => setIsPythonHubOpen(true)}
        onOpenAddVmModal={() => setIsAddVmModalOpen(true)}
        onResetData={handleResetData}
        onExportXlsx={handleExportXlsx}
        onDiscardAll={handleDiscardAllWorkloads}
        vmCount={vms.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Highlight Banner: Explains Spreadsheet & Python Workflow */}
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>VM Migration Execution &amp; Telemetry Hub</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                vCenter 7/8 → Virtuozzo VHS
              </span>
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Upload your migration spreadsheet (.xlsx or .csv), auto-map columns, track cutover progress, and execute real-time telemetry migrations via Python automation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenSpreadsheetWithDiscard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Upload New Spreadsheet</span>
            </button>
            <button
              onClick={() => setIsPythonHubOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 transition active:scale-95"
            >
              <Terminal className="w-4 h-4" />
              <span>Get Python Migrator Script</span>
            </button>
          </div>
        </div>

        {/* Global Statistics Bar */}
        <StatsBar stats={stats} />

        {/* VM Inventory & Real-Time Tracking Table */}
        <VmTable
          vms={vms}
          onSelectVm={(vm) => setSelectedVmId(vm.id)}
          onAbortVm={handleAbortVm}
          onDeleteVm={handleDeleteVm}
          onOpenSpreadsheetModal={handleOpenSpreadsheetWithDiscard}
          onSelectFileToImport={handleFileSelectedForImport}
          onResetSampleData={handleResetData}
          onDiscardAll={handleDiscardAllWorkloads}
          onToggleMigrated={handleToggleMigrated}
          onBulkMarkMigrated={handleBulkMarkMigrated}
        />
      </main>

      {/* Slide-over Detail & Live Terminal Logs Drawer */}
      <VmDetailDrawer
        vm={selectedVm}
        logs={logs}
        onClose={() => setSelectedVmId(null)}
        onAbort={handleAbortVm}
        onToggleMigrated={handleToggleMigrated}
      />

      {/* Spreadsheet Import & Column Mapping Modal */}
      {isSpreadsheetModalOpen && (
        <SpreadsheetModal
          isOpen={isSpreadsheetModalOpen}
          onClose={() => {
            setIsSpreadsheetModalOpen(false);
            setDroppedFileForModal(null);
          }}
          onImport={handleImportSpreadsheet}
          initialFile={droppedFileForModal}
          initialMode="replace"
        />
      )}

      {/* Python Automation & Script Hub Modal */}
      {isPythonHubOpen && (
        <PythonHubModal
          isOpen={isPythonHubOpen}
          onClose={() => setIsPythonHubOpen(false)}
          vms={vms}
        />
      )}

      {/* Add Single VM Workload Modal */}
      {isAddVmModalOpen && (
        <AddVmModal
          isOpen={isAddVmModalOpen}
          onClose={() => setIsAddVmModalOpen(false)}
          onAddVm={handleAddSingleVm}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            vCenter to Virtuozzo Migration Tracker • Real-time SSE &amp; Python Telemetry
          </span>
          <span className="text-[11px] text-slate-400">
            Supports VMware ESXi 7.0/8.0, vCenter Server, and Virtuozzo Hybrid Server 7/8
          </span>
        </div>
      </footer>
    </div>
  );
}
