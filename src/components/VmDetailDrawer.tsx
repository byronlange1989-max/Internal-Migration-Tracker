import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Server,
  HardDrive,
  Cpu,
  Activity,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { MigrationVM, MigrationLog, MigrationStatus } from '../types';

interface VmDetailDrawerProps {
  vm: MigrationVM | null;
  logs: MigrationLog[];
  onClose: () => void;
  onAbort: (vmId: string) => void;
  onToggleMigrated?: (vmId: string, migrated: boolean) => void;
}

interface PipelineStep {
  key: string;
  name: string;
  description: string;
  statusMatcher: (s: MigrationStatus, progress: number) => 'completed' | 'active' | 'pending' | 'failed';
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    key: 'preflight',
    name: '1. Preflight Verification',
    description: 'Validates vCenter ESXi host access and Virtuozzo target storage pool capacity',
    statusMatcher: (s, p) => {
      if (s === 'failed' && p < 15) return 'failed';
      if (s === 'preflight') return 'active';
      if (p >= 15 || ['snapshot', 'exporting', 'converting', 'transferring', 'virtuozzo_deploy', 'guest_tools', 'verifying', 'completed'].includes(s)) return 'completed';
      return 'pending';
    },
  },
  {
    key: 'snapshot',
    name: '2. VMware Snapshot Creation',
    description: 'Takes quiesced consistency snapshot on VMware vCenter datastore',
    statusMatcher: (s, p) => {
      if (s === 'failed' && p >= 15 && p < 25) return 'failed';
      if (s === 'snapshot') return 'active';
      if (p >= 25 || ['exporting', 'converting', 'transferring', 'virtuozzo_deploy', 'guest_tools', 'verifying', 'completed'].includes(s)) return 'completed';
      return 'pending';
    },
  },
  {
    key: 'exporting',
    name: '3. VMDK Export',
    description: 'Streams monolithic/sparse VMDK disk image from VMware ESXi',
    statusMatcher: (s, p) => {
      if (s === 'failed' && p >= 25 && p < 40) return 'failed';
      if (s === 'exporting') return 'active';
      if (p >= 40 || ['converting', 'transferring', 'virtuozzo_deploy', 'guest_tools', 'verifying', 'completed'].includes(s)) return 'completed';
      return 'pending';
    },
  },
  {
    key: 'converting',
    name: '4. qemu-img QCOW2 Conversion',
    description: 'Converts VMDK into compressed Virtuozzo QCOW2 image with zstd compression',
    statusMatcher: (s, p) => {
      if (s === 'failed' && p >= 40 && p < 70) return 'failed';
      if (s === 'converting') return 'active';
      if (p >= 70 || ['transferring', 'virtuozzo_deploy', 'guest_tools', 'verifying', 'completed'].includes(s)) return 'completed';
      return 'pending';
    },
  },
  {
    key: 'transferring',
    name: '5. Disk Transfer to Virtuozzo',
    description: 'Transfers converted QCOW2 to target Virtuozzo storage pool with SHA256 checksum',
    statusMatcher: (s, p) => {
      if (s === 'failed' && p >= 70 && p < 85) return 'failed';
      if (s === 'transferring') return 'active';
      if (p >= 85 || ['virtuozzo_deploy', 'guest_tools', 'verifying', 'completed'].includes(s)) return 'completed';
      return 'pending';
    },
  },
  {
    key: 'virtuozzo_deploy',
    name: '6. Virtuozzo VM Definition (prlctl)',
    description: 'Instantiates VM/container hardware layout, attaches QCOW2 disk, binds VLAN',
    statusMatcher: (s, p) => {
      if (s === 'failed' && p >= 85 && p < 92) return 'failed';
      if (s === 'virtuozzo_deploy') return 'active';
      if (p >= 92 || ['guest_tools', 'verifying', 'completed'].includes(s)) return 'completed';
      return 'pending';
    },
  },
  {
    key: 'guest_tools',
    name: '7. Guest Tools & Cutover',
    description: 'Injects Virtuozzo Guest Tools / virtio drivers, performs sanity ping & source shutoff',
    statusMatcher: (s, p) => {
      if (s === 'failed' && p >= 92) return 'failed';
      if (s === 'guest_tools' || s === 'verifying') return 'active';
      if (s === 'completed' || p >= 100) return 'completed';
      return 'pending';
    },
  },
];

export const VmDetailDrawer: React.FC<VmDetailDrawerProps> = ({
  vm,
  logs,
  onClose,
  onAbort,
  onToggleMigrated,
}) => {
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'cmd' | 'error'>('all');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Filter logs for this VM
  const vmLogs = vm ? logs.filter((l) => l.vmId === vm.id) : [];
  const filteredLogs = vmLogs.filter((l) => {
    if (logFilter === 'all') return true;
    if (logFilter === 'error') return l.level === 'error';
    if (logFilter === 'cmd') return l.level === 'cmd';
    return l.level === 'info' || l.level === 'success';
  });

  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [vmLogs.length]);

  if (!vm) return null;

  const isInFlight = !['not_started', 'scheduled', 'completed', 'failed', 'rolled_back'].includes(vm.status);

  const copyCliCommand = () => {
    const cmd = `python3 vcenter_virtuozzo_migrator.py --vm-id ${vm.id}`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/95 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-base font-bold text-white tracking-tight">{vm.vmName}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {vm.id}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {vm.osType} • Assigned to: {vm.assignedAdmin}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Manual Mark Migrated / Not Migrated Toggle */}
            {onToggleMigrated && (
              vm.status === 'completed' ? (
                <button
                  id="btn-drawer-unmark-migrated"
                  type="button"
                  onClick={() => onToggleMigrated(vm.id, false)}
                  title="Currently marked as migrated. Click to mark as not migrated."
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mark as Not Migrated</span>
                </button>
              ) : (
                <button
                  id="btn-drawer-mark-migrated"
                  type="button"
                  onClick={() => onToggleMigrated(vm.id, true)}
                  title="Click to manually mark this workload as migrated."
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark as Migrated</span>
                </button>
              )
            )}

            {isInFlight && (
              <button
                id="btn-drawer-abort"
                onClick={() => onAbort(vm.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Abort / Rollback</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Progress Banner */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">
                Migration Stage:
              </span>
              <span className="font-bold text-indigo-400">
                {vm.currentStep || vm.status.replace('_', ' ')}
              </span>
            </div>
            <span className="font-bold text-white font-mono">{vm.progress.toFixed(1)}%</span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                vm.status === 'completed'
                  ? 'bg-emerald-500'
                  : vm.status === 'failed'
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              }`}
              style={{ width: `${vm.progress}%` }}
            />
          </div>

          {/* Quick metrics grid */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block uppercase">Speed</span>
              <span className="font-bold text-cyan-400 font-mono">
                {vm.speedMbps > 0 ? `${vm.speedMbps} MB/s` : '—'}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block uppercase">Transferred</span>
              <span className="font-bold text-white font-mono">
                {vm.transferredGb.toFixed(1)} / {vm.diskGb} GB
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block uppercase">ETA</span>
              <span className="font-bold text-slate-200 font-mono">
                {vm.etaSeconds ? `${Math.round(vm.etaSeconds)}s` : vm.status === 'completed' ? '0s' : '—'}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block uppercase">Worker</span>
              <span className="font-semibold text-emerald-400 font-mono truncate block text-[11px]">
                {vm.pythonAgentId || 'idle'}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Compute & Storage Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Compute Specifications */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Compute Specifications</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {vm.vcpu} vCPU / {vm.ramGb} GB RAM
                </span>
              </div>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Virtual CPUs:</span>
                  <span className="font-bold text-white">{vm.vcpu} Cores</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Memory (RAM):</span>
                  <span className="font-bold text-white">{vm.ramGb} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Guest OS:</span>
                  <span className="font-medium text-slate-200">{vm.osType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Hypervisor:</span>
                  <span className="text-indigo-300 font-medium">
                    {vm.targetVmType === 'container' ? 'Virtuozzo Container' : 'Virtuozzo KVM'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Network / IP:</span>
                  <span className="font-mono text-slate-300">{vm.ipAddress || 'DHCP (Dynamic)'}</span>
                </div>
              </div>
            </div>

            {/* Storage Specifications */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Storage Specifications</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {vm.diskGb} GB Total
                </span>
              </div>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Provisioned Disk:</span>
                  <span className="font-bold text-white">{vm.diskGb} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transferred:</span>
                  <span className="font-medium text-emerald-400">
                    {vm.transferredGb.toFixed(1)} GB ({vm.diskGb > 0 ? Math.min(100, Math.round((vm.transferredGb / vm.diskGb) * 100)) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Remaining Volume:</span>
                  <span className="font-medium text-slate-300">
                    {Math.max(0, vm.diskGb - vm.transferredGb).toFixed(1)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Disk Format:</span>
                  <span className="text-slate-200">VMware VMDK → Virtuozzo QCOW2</span>
                </div>
                <div className="mt-1 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
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
            </div>
          </div>

          {/* Manual Migration Status Override Card */}
          {onToggleMigrated && (
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">Manual Migration Status</span>
                  {vm.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Migrated</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Not Migrated (Pending)</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {vm.status === 'completed'
                    ? 'Workload marked as migrated. Storage and cluster totals reflect 100% completion.'
                    : 'Toggle this workload to migrated to update cutover tracking and cluster progress.'}
                </p>
              </div>

              {vm.status === 'completed' ? (
                <button
                  type="button"
                  onClick={() => onToggleMigrated(vm.id, false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mark as Not Migrated</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleMigrated(vm.id, true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark as Migrated</span>
                </button>
              )}
            </div>
          )}

          {/* 7-Step Migration Pipeline Visualizer */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>End-to-End Migration Pipeline Stages</span>
            </h3>

            <div className="space-y-2">
              {PIPELINE_STEPS.map((step) => {
                const stepState = step.statusMatcher(vm.status, vm.progress);

                return (
                  <div
                    key={step.key}
                    className={`p-3 rounded-xl border transition flex items-start gap-3 text-xs ${
                      stepState === 'active'
                        ? 'bg-indigo-950/40 border-indigo-500/50 shadow-sm'
                        : stepState === 'completed'
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : stepState === 'failed'
                        ? 'bg-rose-950/30 border-rose-500/40'
                        : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                    }`}
                  >
                    <div className="mt-0.5">
                      {stepState === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : stepState === 'active' ? (
                        <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
                      ) : stepState === 'failed' ? (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-semibold ${
                            stepState === 'active'
                              ? 'text-indigo-300'
                              : stepState === 'completed'
                              ? 'text-emerald-300'
                              : stepState === 'failed'
                              ? 'text-rose-300'
                              : 'text-slate-400'
                          }`}
                        >
                          {step.name}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            stepState === 'active'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : stepState === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : stepState === 'failed'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {stepState}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Python CLI Helper */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Execute migration on your hypervisor / CLI:</span>
              </span>
              <button
                onClick={copyCliCommand}
                className="text-indigo-400 hover:text-indigo-300 text-[11px] flex items-center gap-1"
              >
                {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="block bg-slate-900 p-2.5 rounded-lg text-emerald-400 font-mono text-[11px] select-all">
              python3 vcenter_virtuozzo_migrator.py --vm-id {vm.id}
            </code>
          </div>

          {/* Real-time Terminal Log Stream */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Live Execution Log Stream
                </span>
                <span className="text-[10px] text-slate-400 font-mono">({vmLogs.length} events)</span>
              </div>

              {/* Log filter */}
              <div className="flex items-center gap-1 text-[11px]">
                {(['all', 'info', 'cmd', 'error'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLogFilter(lvl)}
                    className={`px-2 py-0.5 rounded capitalize transition ${
                      logFilter === lvl
                        ? 'bg-slate-700 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 font-mono text-[11px] h-64 overflow-y-auto space-y-1.5">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 italic">
                  No execution logs recorded yet. Start the migration via Python script or simulate run.
                </div>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-slate-500 shrink-0 select-none">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`font-semibold shrink-0 uppercase text-[10px] px-1 rounded select-none ${
                          log.level === 'error'
                            ? 'bg-rose-500/20 text-rose-400'
                            : log.level === 'cmd'
                            ? 'bg-blue-500/20 text-blue-300'
                            : log.level === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span
                        className={`break-all ${
                          log.level === 'error'
                            ? 'text-rose-300'
                            : log.level === 'cmd'
                            ? 'text-blue-300 font-bold'
                            : log.level === 'success'
                            ? 'text-emerald-300 font-semibold'
                            : 'text-slate-300'
                        }`}
                      >
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={terminalBottomRef} />
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Last Telemetry Update: {vm.lastHeartbeat ? new Date(vm.lastHeartbeat).toLocaleTimeString() : 'Awaiting start'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
