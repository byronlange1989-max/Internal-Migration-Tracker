import React, { useState } from 'react';
import { X, Plus, Server, HardDrive, Cpu, Layers } from 'lucide-react';
import { MigrationVM } from '../types';

interface AddVmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVm: (vmData: Partial<MigrationVM>) => void;
  existingWaves?: string[];
}

export const AddVmModal: React.FC<AddVmModalProps> = ({
  isOpen,
  onClose,
  onAddVm,
}) => {
  const [diskUnit, setDiskUnit] = useState<'gb' | 'mib'>('gb');
  const [formData, setFormData] = useState({
    vmName: '',
    sourceCluster: 'Cluster-Prod-ESXi',
    sourceHost: 'esxi-01.corp.local',
    sourceDatastore: 'SAN_SSD_VOL_01',
    vcpu: 4,
    ramGb: 16,
    diskGb: 80,
    osType: 'Ubuntu 22.04 LTS',
    ipAddress: '',
    targetVirtuozzoHost: 'vz-node01.dc1.vhs',
    targetStoragePool: '/vz/storage/nvme-pool1',
    targetVlan: 'VLAN-214-PROD',
    targetVmType: 'kvm' as 'kvm' | 'container',
    wave: 'General',
    priority: 'medium' as MigrationVM['priority'],
    assignedAdmin: 'DevOps Team',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vmName.trim()) return;

    // Convert disk if in MiB
    let finalDiskGb = Number(formData.diskGb) || 50;
    if (diskUnit === 'mib') {
      const converted = finalDiskGb / 1024;
      finalDiskGb = Math.abs(converted - Math.round(converted)) < 0.05
        ? Math.round(converted)
        : Math.round(converted * 10) / 10;
    }

    onAddVm({
      ...formData,
      diskGb: finalDiskGb,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Add Migration Workload</h2>
              <p className="text-xs text-slate-400">
                Register a VMware vCenter VM to migrate to Virtuozzo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Workload Identification */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>Workload Identification</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  VM Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.vmName}
                  onChange={(e) => setFormData({ ...formData, vmName: e.target.value })}
                  placeholder="e.g. PRD-APP-SERVER-01"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Operating System
                </label>
                <input
                  type="text"
                  value={formData.osType}
                  onChange={(e) => setFormData({ ...formData, osType: e.target.value })}
                  placeholder="e.g. Ubuntu 22.04 LTS / Windows Server"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Compute Specs */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Compute Specifications</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  vCPUs (Cores)
                </label>
                <input
                  type="number"
                  min={1}
                  max={128}
                  value={formData.vcpu}
                  onChange={(e) => setFormData({ ...formData, vcpu: Number(e.target.value) })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  RAM (GB)
                </label>
                <input
                  type="number"
                  min={1}
                  max={512}
                  value={formData.ramGb}
                  onChange={(e) => setFormData({ ...formData, ramGb: Number(e.target.value) })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Virtuozzo Target Type
                </label>
                <select
                  value={formData.targetVmType}
                  onChange={(e) => setFormData({ ...formData, targetVmType: e.target.value as any })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="kvm">KVM Virtual Machine</option>
                  <option value="container">Virtuozzo Container (CT)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Storage Specs */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              <span>Storage Specifications</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Virtual Disk Size
                  </label>
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5">
                    <button
                      type="button"
                      onClick={() => setDiskUnit('gb')}
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                        diskUnit === 'gb'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      GB
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiskUnit('mib')}
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                        diskUnit === 'mib'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      MiB
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={diskUnit === 'mib' ? 10000000 : 10000}
                  value={formData.diskGb}
                  onChange={(e) => setFormData({ ...formData, diskGb: Number(e.target.value) })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {diskUnit === 'mib' && (
                  <p className="mt-1 text-[11px] text-emerald-400 font-medium">
                    = {Math.round(((formData.diskGb || 0) / 1024) * 10) / 10} GB
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Target Format
                </label>
                <div className="px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono">
                  qemu-img VMDK → QCOW2
                </div>
              </div>
            </div>
          </div>

          {/* Priority and Assignment */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Assigned Engineer / Admin
                </label>
                <input
                  type="text"
                  value={formData.assignedAdmin}
                  onChange={(e) => setFormData({ ...formData, assignedAdmin: e.target.value })}
                  placeholder="DevOps Team"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg active:scale-95"
            >
              Save Workload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
