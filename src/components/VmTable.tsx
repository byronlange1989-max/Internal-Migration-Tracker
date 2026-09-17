import React, { useState, useRef } from 'react';
import {
  Play,
  RotateCcw,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Clock,
  HardDrive,
  Cpu,
  Server,
  Trash2,
  ChevronRight,
  Filter,
  Search,
  Activity,
  ArrowUpDown,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Plus,
  Sparkles,
  Layers,
  Check,
  CheckSquare,
  Square,
} from 'lucide-react';
import { MigrationVM, MigrationStatus } from '../types';

interface VmTableProps {
  vms: MigrationVM[];
  onSelectVm: (vm: MigrationVM) => void;
  onAbortVm: (vmId: string) => void;
  onDeleteVm: (vmId: string) => void;
  onOpenSpreadsheetModal: () => void;
  onSelectFileToImport?: (file: File) => void;
  onResetSampleData?: () => void;
  onDiscardAll?: () => void;
  onToggleMigrated?: (vmId: string, migrated: boolean) => void;
  onBulkMarkMigrated?: (vmIds: string[], migrated: boolean) => void;
}

export const VmTable: React.FC<VmTableProps> = ({
  vms,
  onSelectVm,
  onAbortVm,
  onDeleteVm,
  onOpenSpreadsheetModal,
  onSelectFileToImport,
  onResetSampleData,
  onDiscardAll,
  onToggleMigrated,
  onBulkMarkMigrated,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'vmName' | 'progress' | 'vcpu' | 'ramGb' | 'diskGb'>('vmName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedVmIds, setSelectedVmIds] = useState<Set<string>>(new Set());
  const emptyFileInputRef = useRef<HTMLInputElement>(null);

  // Compute summary aggregates for header
  const vmsNeedingMigrationCount = vms.filter((v) => v.status !== 'completed').length;
  const vmsCompletedCount = vms.filter((v) => v.status === 'completed').length;
  const totalVcpuCount = vms.reduce((acc, v) => acc + (v.vcpu || 0), 0);
  const totalRamGbCount = vms.reduce((acc, v) => acc + (v.ramGb || 0), 0);
  const totalDiskGbCount = vms.reduce((acc, v) => acc + (v.diskGb || 0), 0);

  // Filtered & Sorted
  const filtered = vms.filter((vm) => {
    const matchesSearch =
      searchTerm === '' ||
      vm.vmName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vm.osType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vm.ipAddress && vm.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
      vm.assignedAdmin.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'needing_migration' && vm.status !== 'completed') ||
      (statusFilter === 'in_progress' && !['not_started', 'scheduled', 'completed', 'failed', 'rolled_back'].includes(vm.status)) ||
      vm.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'vmName') comparison = a.vmName.localeCompare(b.vmName);
    else if (sortBy === 'progress') comparison = a.progress - b.progress;
    else if (sortBy === 'vcpu') comparison = a.vcpu - b.vcpu;
    else if (sortBy === 'ramGb') comparison = a.ramGb - b.ramGb;
    else if (sortBy === 'diskGb') comparison = a.diskGb - b.diskGb;

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const isAllFilteredSelected = sorted.length > 0 && sorted.every((v) => selectedVmIds.has(v.id));

  const handleToggleSelectVm = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedVmIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const next = new Set(selectedVmIds);
      sorted.forEach((v) => next.add(v.id));
      setSelectedVmIds(next);
    } else {
      const next = new Set(selectedVmIds);
      sorted.forEach((v) => next.delete(v.id));
      setSelectedVmIds(next);
    }
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  const getStatusBadge = (status: MigrationStatus, progress: number) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>Complete</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'rolled_back':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <RotateCcw className="w-3 h-3" />
            <span>Rolled Back</span>
          </span>
        );
      case 'not_started':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
            <Clock className="w-3 h-3" />
            <span>Not Started</span>
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            <span>Scheduled</span>
          </span>
        );
      case 'preflight':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
            <Activity className="w-3 h-3" />
            <span>Preflight</span>
          </span>
        );
      case 'converting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            <Activity className="w-3 h-3 animate-spin text-indigo-400" />
            <span>qemu-img ({progress}%)</span>
          </span>
        );
      case 'transferring':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 animate-pulse">
            <Server className="w-3 h-3" />
            <span>Transferring ({progress}%)</span>
          </span>
        );
      case 'virtuozzo_deploy':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <Server className="w-3 h-3" />
            <span>prlctl create</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span>{status.replace('_', ' ')}</span>
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">CRIT</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">HIGH</span>;
      case 'medium':
        return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-800 text-slate-400 border border-slate-700">MED</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-800/60 text-slate-500">LOW</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* VMs to Migrate Banner & Specs Summary */}
      <div className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm">
            {vmsNeedingMigrationCount} of {vms.length} VMs Needing Migration
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-indigo-400 font-medium">vCenter → Virtuozzo</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1.5" title="Total Compute Specs">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-200 font-semibold">{totalVcpuCount} vCPUs</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-200 font-semibold">{totalRamGbCount >= 1024 ? `${(totalRamGbCount / 1024).toFixed(1)} TB` : `${totalRamGbCount} GB`} RAM</span>
          </span>
          <span className="flex items-center gap-1.5" title="Total Storage Specs">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-200 font-semibold">
              {totalDiskGbCount > 1000 ? `${(totalDiskGbCount / 1000).toFixed(1)} TB` : `${totalDiskGbCount} GB`} Storage
            </span>
          </span>
        </div>
      </div>

      {/* Table Controls Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-vm"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by VM name, operating system, admin..."
            className="w-full bg-slate-950/70 border border-slate-800 text-slate-200 placeholder-slate-500 rounded-xl pl-9 pr-3.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filters & Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Status:</span>
          {[
            { key: 'all', label: `All (${vms.length})` },
            { key: 'needing_migration', label: `To Migrate (${vmsNeedingMigrationCount})` },
            { key: 'in_progress', label: 'Active Pipeline' },
            { key: 'completed', label: `Completed (${vmsCompletedCount})` },
            { key: 'failed', label: 'Failed' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                statusFilter === f.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}

          {vms.length > 0 && (
            <div className="flex items-center gap-1 ml-2 border-l border-slate-800 pl-2">
              <button
                onClick={onOpenSpreadsheetModal}
                title="Upload a new spreadsheet (will discard old workloads)"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition active:scale-95"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload New</span>
              </button>

              {onDiscardAll && (
                <button
                  onClick={onDiscardAll}
                  title="Discard all current workloads"
                  className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Bar for Manual Status Marking */}
      {selectedVmIds.size > 0 && (
        <div className="m-3 p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/40 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px]">
              {selectedVmIds.size}
            </span>
            <span className="font-bold text-white">Workload(s) Selected</span>
            <span className="text-slate-400 text-[11px]">
              ({vms.filter((v) => selectedVmIds.has(v.id) && v.status === 'completed').length} migrated,{' '}
              {vms.filter((v) => selectedVmIds.has(v.id) && v.status !== 'completed').length} pending)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBulkMarkMigrated && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onBulkMarkMigrated(Array.from(selectedVmIds), true);
                    setSelectedVmIds(new Set());
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Selected as Migrated</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onBulkMarkMigrated(Array.from(selectedVmIds), false);
                    setSelectedVmIds(new Set());
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mark as Not Migrated</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setSelectedVmIds(new Set())}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-200 transition"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
            <tr>
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={handleSelectAllFiltered}
                  title={isAllFilteredSelected ? 'Deselect all' : 'Select all filtered workloads'}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                />
              </th>
              <th
                onClick={() => toggleSort('vmName')}
                className="px-4 py-3 cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center gap-1">
                  <span>Workload / OS</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('vcpu')}
                className="px-4 py-3 cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center gap-1">
                  <span>Compute Specs (vCPU &amp; RAM)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('diskGb')}
                className="px-4 py-3 cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center gap-1">
                  <span>Storage Specs (Disk &amp; Transfer)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('progress')}
                className="px-4 py-3 cursor-pointer hover:text-slate-200 transition min-w-[200px]"
              >
                <div className="flex items-center gap-1">
                  <span>Status &amp; Live Telemetry</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {vms.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && onSelectFileToImport) {
                        onSelectFileToImport(file);
                      } else {
                        onOpenSpreadsheetModal();
                      }
                    }}
                    onClick={() => emptyFileInputRef.current?.click()}
                    className={`max-w-xl mx-auto rounded-2xl border-2 border-dashed p-8 transition cursor-pointer ${
                      isDragging
                        ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                        : 'border-slate-700/80 hover:border-emerald-500/60 bg-slate-900/40 hover:bg-slate-900/70'
                    }`}
                  >
                    <input
                      ref={emptyFileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onSelectFileToImport) {
                          onSelectFileToImport(file);
                        }
                      }}
                    />
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-100">
                      Old Spreadsheet Discarded
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                      Drop your new migration spreadsheet here, or click to browse. We will auto-map your vCenter &amp; Virtuozzo columns and track migration progress in real-time.
                    </p>

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => emptyFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-600/20 active:scale-95"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Upload New Spreadsheet (.xlsx / .csv)</span>
                      </button>

                      <a
                        href="/api/migrations/export/template"
                        download="vm_migration_template.xlsx"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Sample Template</span>
                      </a>

                      {onResetSampleData && (
                        <button
                          type="button"
                          onClick={onResetSampleData}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Load Demo Data</span>
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <Server className="w-8 h-8 text-slate-500 mb-2" />
                    <p className="font-semibold text-slate-300">No migration workloads match your criteria</p>
                    <p className="text-xs text-slate-500 mt-0.5">Try adjusting your filters or import a spreadsheet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((vm) => {
                const isInFlight = !['not_started', 'scheduled', 'completed', 'failed', 'rolled_back'].includes(vm.status);
                const isSelected = selectedVmIds.has(vm.id);

                return (
                  <tr
                    key={vm.id}
                    id={`vm-row-${vm.id}`}
                    className={`transition group cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/30 hover:bg-indigo-950/40'
                        : 'hover:bg-slate-800/40'
                    }`}
                    onClick={() => onSelectVm(vm)}
                  >
                    {/* Row Selection Checkbox */}
                    <td className="w-10 px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleSelectVm(vm.id, e)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                      />
                    </td>

                    {/* VM Name & OS */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/60 group-hover:border-indigo-500/50 transition">
                          <Server className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs hover:text-indigo-400 transition">
                              {vm.vmName}
                            </span>
                            {getPriorityBadge(vm.priority)}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                            {vm.osType}
                            {vm.ipAddress && ` • ${vm.ipAddress}`}
                            {vm.assignedAdmin && ` • Admin: ${vm.assignedAdmin}`}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Compute Specs */}
                    <td className="px-4 py-3.5 text-xs text-slate-300">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono font-bold text-[11px]">
                            <Cpu className="w-3 h-3" />
                            <span>{vm.vcpu} vCPU</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono font-bold text-[11px]">
                            <Layers className="w-3 h-3" />
                            <span>{vm.ramGb} GB RAM</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {vm.targetVmType === 'container' ? 'Virtuozzo Container (CT)' : 'Virtuozzo KVM VM'}
                        </p>
                      </div>
                    </td>

                    {/* Storage Specs */}
                    <td className="px-4 py-3.5 text-xs text-slate-300">
                      <div className="space-y-1.5 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-white flex items-center gap-1">
                            <HardDrive className="w-3 h-3 text-indigo-400" />
                            <span>{vm.diskGb} GB</span>
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {vm.transferredGb.toFixed(1)} GB ({vm.diskGb > 0 ? Math.min(100, Math.round((vm.transferredGb / vm.diskGb) * 100)) : 0}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              vm.status === 'completed'
                                ? 'bg-emerald-500'
                                : vm.status === 'failed'
                                ? 'bg-rose-500'
                                : 'bg-indigo-500'
                            }`}
                            style={{
                              width: `${
                                vm.diskGb > 0
                                  ? Math.min(100, Math.round((vm.transferredGb / vm.diskGb) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status & Telemetry Progress */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>{getStatusBadge(vm.status, vm.progress)}</div>
                          {isInFlight && vm.speedMbps > 0 && (
                            <span className="text-[11px] font-mono font-semibold text-cyan-400">
                              {vm.speedMbps} MB/s
                            </span>
                          )}
                        </div>

                        {/* Progress bar for in-flight / completed */}
                        {(isInFlight || vm.status === 'completed' || vm.progress > 0) && (
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                vm.status === 'completed'
                                  ? 'bg-emerald-500'
                                  : vm.status === 'failed'
                                  ? 'bg-rose-500'
                                  : 'bg-indigo-500'
                              }`}
                              style={{ width: `${vm.progress}%` }}
                            />
                          </div>
                        )}

                        {/* Manual Status Toggle Quick-Button */}
                        {onToggleMigrated && !isInFlight && (
                          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                            {vm.status === 'completed' ? (
                              <button
                                type="button"
                                onClick={() => onToggleMigrated(vm.id, false)}
                                title="Currently marked as Migrated. Click to mark as Not Migrated."
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 hover:bg-amber-500/20 text-emerald-300 hover:text-amber-300 border border-emerald-500/40 hover:border-amber-500/40 transition group/btn cursor-pointer active:scale-95"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 group-hover/btn:hidden" />
                                <RotateCcw className="w-3 h-3 text-amber-400 hidden group-hover/btn:block" />
                                <span className="group-hover/btn:hidden">Migrated</span>
                                <span className="hidden group-hover/btn:inline">Mark Unmigrated</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onToggleMigrated(vm.id, true)}
                                title="Click to manually mark this workload as Migrated."
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/90 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500 transition cursor-pointer active:scale-95"
                              >
                                <Check className="w-3 h-3 text-slate-400 group-hover/btn:text-white" />
                                <span>Mark Migrated</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Current step or error message */}
                        {vm.errorMessage ? (
                          <p className="text-[11px] text-rose-400 truncate max-w-[240px]">
                            {vm.errorMessage}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                            {vm.currentStep}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Manual status toggle icon button */}
                        {onToggleMigrated && !isInFlight && (
                          <button
                            type="button"
                            onClick={() => onToggleMigrated(vm.id, vm.status !== 'completed')}
                            title={vm.status === 'completed' ? 'Mark as Not Migrated' : 'Mark as Migrated'}
                            className={`p-1.5 rounded-lg border transition active:scale-95 cursor-pointer ${
                              vm.status === 'completed'
                                ? 'bg-emerald-600/20 hover:bg-amber-500/20 text-emerald-400 hover:text-amber-400 border-emerald-500/40 hover:border-amber-500/40'
                                : 'bg-slate-800 hover:bg-emerald-600/30 text-slate-400 hover:text-emerald-300 border-slate-700 hover:border-emerald-500/40'
                            }`}
                          >
                            {vm.status === 'completed' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Abort button */}
                        {isInFlight && (
                          <button
                            id={`btn-abort-${vm.id}`}
                            onClick={() => onAbortVm(vm.id)}
                            title="Abort migration and roll back"
                            className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white transition active:scale-95"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* View Details Drawer */}
                        <button
                          onClick={() => onSelectVm(vm)}
                          title="View detailed 7-step pipeline & live logs"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Workload */}
                        <button
                          onClick={() => onDeleteVm(vm.id)}
                          title="Remove from tracker"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer / Summary */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400 flex items-center justify-between">
        <span>
          Showing <span className="font-semibold text-slate-200">{sorted.length}</span> of{' '}
          <span className="font-semibold text-slate-200">{vms.length}</span> workloads
        </span>
        <span className="text-[11px] text-slate-400">
          Click any row to open the live terminal logs and 7-stage pipeline inspector
        </span>
      </div>
    </div>
  );
};
