import React from 'react';
import { MigrationStats } from '../types';
import { CheckCircle2, HardDrive, Cpu, Activity, ArrowRight, Layers } from 'lucide-react';

interface StatsBarProps {
  stats: MigrationStats;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  const vmsToMigrate = stats.vmsNeedingMigration ?? Math.max(0, stats.totalVms - stats.completedVms);
  const remainingVcpu = stats.remainingVcpu ?? 0;
  const remainingRamGb = stats.remainingRamGb ?? 0;
  const totalRamGb = stats.totalRamGb ?? 0;
  const totalVcpu = stats.totalVcpu ?? 0;
  const storagePercentage = stats.totalDiskGb > 0
    ? Math.round((stats.migratedDiskGb / stats.totalDiskGb) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {/* 1. VMs Needing Migration (vCenter -> Virtuozzo) */}
      <div className="bg-gradient-to-b from-indigo-950/40 to-slate-900/80 border border-indigo-500/40 rounded-xl p-3.5 backdrop-blur-sm shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-indigo-300 mb-1.5">
          <span className="text-xs font-bold uppercase tracking-wider">VMs To Migrate</span>
          <ArrowRight className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {vmsToMigrate}
          </span>
          <span className="text-xs text-indigo-300/80 font-medium">VMs remaining</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 truncate">
          vCenter → Virtuozzo ({stats.totalVms} total)
        </p>
        <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${stats.totalVms > 0 ? (vmsToMigrate / stats.totalVms) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 2. Migrated to Virtuozzo */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-medium uppercase tracking-wider">Migrated (Done)</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-400">
            {stats.completedVms}
          </span>
          <span className="text-xs text-emerald-500/80 font-semibold">
            ({stats.completionPercentage}%)
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 truncate">
          Active on Virtuozzo
        </p>
        <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${stats.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* 3. Compute Specs: vCPU */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-medium uppercase tracking-wider">Compute: vCPU</span>
          <Cpu className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {totalVcpu}
          </span>
          <span className="text-xs text-slate-400">vCPUs</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 truncate" title={`${remainingVcpu} vCPUs still pending migration`}>
          <span className="text-cyan-400 font-medium">{remainingVcpu}</span> remaining to migrate
        </p>
      </div>

      {/* 4. Compute Specs: RAM */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-medium uppercase tracking-wider">Compute: RAM</span>
          <Layers className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {totalRamGb >= 1024 ? `${(totalRamGb / 1024).toFixed(1)} TB` : `${totalRamGb} GB`}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 truncate" title={`${remainingRamGb} GB RAM still pending migration`}>
          <span className="text-purple-400 font-medium">
            {remainingRamGb >= 1024 ? `${(remainingRamGb / 1024).toFixed(1)} TB` : `${remainingRamGb} GB`}
          </span>{' '}
          remaining to migrate
        </p>
      </div>

      {/* 5. Storage Specs: Disk Volume */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-medium uppercase tracking-wider">Storage: Disks</span>
          <HardDrive className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {stats.totalDiskGb > 1000
              ? `${(stats.totalDiskGb / 1000).toFixed(1)} TB`
              : `${stats.totalDiskGb} GB`}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 truncate">
          <span className="text-indigo-400 font-medium">
            {stats.migratedDiskGb > 1000
              ? `${(stats.migratedDiskGb / 1000).toFixed(1)} TB`
              : `${stats.migratedDiskGb} GB`}
          </span>{' '}
          transferred ({storagePercentage}%)
        </p>
        <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${storagePercentage}%` }}
          />
        </div>
      </div>

      {/* 6. Active Pipeline & Live Speed */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-medium uppercase tracking-wider">Active Stream</span>
          <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-400">
            {stats.inProgressVms}
          </span>
          <span className="text-xs text-slate-400">in-flight</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 truncate">
          Live Speed:{' '}
          <span className="text-cyan-400 font-mono font-medium">
            {stats.activeTransferSpeedMbps.toFixed(1)} MB/s
          </span>
        </p>
      </div>
    </div>
  );
};
