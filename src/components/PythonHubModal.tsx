import React, { useState } from 'react';
import {
  X,
  Terminal,
  Download,
  Copy,
  Check,
  Code2,
  FileCode,
  Activity,
  Server,
  Zap,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { PYTHON_MIGRATOR_SCRIPT, PYTHON_CONFIG_YAML, PYTHON_REQUIREMENTS_TXT } from '../../server/pythonScripts';
import { MigrationVM } from '../types';

interface PythonHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  vms: MigrationVM[];
}

export const PythonHubModal: React.FC<PythonHubModalProps> = ({
  isOpen,
  onClose,
  vms,
}) => {
  const [activeTab, setActiveTab] = useState<'script' | 'config' | 'requirements' | 'api' | 'quickstart'>('quickstart');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Extract unique active agents from VMs
  interface ActiveAgentInfo {
    id: string;
    lastHeartbeat: string | null;
    vmName: string;
    status: string;
  }

  const agentMap = new Map<string, ActiveAgentInfo>();
  vms
    .filter((v) => Boolean(v.pythonAgentId))
    .forEach((v) => {
      if (v.pythonAgentId && !agentMap.has(v.pythonAgentId)) {
        agentMap.set(v.pythonAgentId, {
          id: v.pythonAgentId,
          lastHeartbeat: v.lastHeartbeat,
          vmName: v.vmName,
          status: v.status,
        });
      }
    });
  const activeAgents: ActiveAgentInfo[] = Array.from(agentMap.values());

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Python Automation &amp; Real-Time Monitoring Hub
                </h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Ready to deploy
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Execute automated migrations from vCenter to Virtuozzo with live telemetry streamed to this dashboard
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

        {/* Tab Strip */}
        <div className="px-6 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center gap-2 sm:gap-6">
          <button
            onClick={() => setActiveTab('quickstart')}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'quickstart'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Quick Start &amp; CLI</span>
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'script'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>vcenter_virtuozzo_migrator.py</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>config.yaml</span>
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'requirements'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>requirements.txt</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'api'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Webhook REST API</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* QUICK START TAB */}
          {activeTab === 'quickstart' && (
            <div className="space-y-6">
              {/* Architecture diagram */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>Real-Time Migration Architecture</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80">
                    <span className="font-semibold text-blue-400 block mb-1">1. VMware vCenter / ESXi</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Python script performs quiesced VM snapshot, checks disk blocks, and streams monolithic VMDK via vSphere API or ovftool.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80">
                    <span className="font-semibold text-indigo-400 block mb-1">2. Worker &amp; qemu-img</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Converts VMDK to compressed QCOW2 with live byte progress, computes SHA256 checksums, and pushes disk image to Virtuozzo storage.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80">
                    <span className="font-semibold text-emerald-400 block mb-1">3. Virtuozzo &amp; Tracker</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Provisions VM/container via <code>prlctl</code>, injects virtio guest tools, and updates this dashboard in real-time via REST.
                    </p>
                  </div>
                </div>
              </div>

              {/* Execution Steps */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white">How to Run on your Migration Jumpbox / Hypervisor</h3>

                <div className="space-y-3 text-xs">
                  {/* Step 1 */}
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-200">
                        Step 1: Install Python dependencies
                      </span>
                      <button
                        onClick={() => copyToClipboard('pip install requests pyyaml tqdm pyvmomi paramiko', 'pip')}
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono text-[11px]"
                      >
                        {copiedKey === 'pip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <code className="block bg-slate-900 p-2.5 rounded-lg text-indigo-300 font-mono text-[11px]">
                      pip install requests pyyaml tqdm pyvmomi paramiko
                    </code>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-200">
                        Step 2: Download automation script &amp; configuration
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadFile('vcenter_virtuozzo_migrator.py', PYTHON_MIGRATOR_SCRIPT)}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Script</span>
                        </button>
                        <button
                          onClick={() => downloadFile('config.yaml', PYTHON_CONFIG_YAML)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>config.yaml</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Place both files in the same working directory on your migration host or server with access to vCenter and Virtuozzo nodes.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-200">
                        Step 3: Run migration worker (Live Telemetry to this Tracker)
                      </span>
                    </div>

                    <div className="space-y-2 mt-2">
                      <div>
                        <span className="text-slate-400 text-[11px] block mb-1">Migrate an entire wave:</span>
                        <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg">
                          <code className="text-emerald-400 font-mono text-[11px] truncate">
                            python3 vcenter_virtuozzo_migrator.py --tracker {currentHost} --wave "Wave 1 (Pilot/Web)"
                          </code>
                          <button
                            onClick={() => copyToClipboard(`python3 vcenter_virtuozzo_migrator.py --tracker ${currentHost} --wave "Wave 1 (Pilot/Web)"`, 'cmd1')}
                            className="text-slate-400 hover:text-white p-1"
                          >
                            {copiedKey === 'cmd1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block mb-1">Run as continuous background daemon:</span>
                        <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg">
                          <code className="text-indigo-300 font-mono text-[11px] truncate">
                            python3 vcenter_virtuozzo_migrator.py --tracker {currentHost} --daemon --interval 5
                          </code>
                          <button
                            onClick={() => copyToClipboard(`python3 vcenter_virtuozzo_migrator.py --tracker ${currentHost} --daemon --interval 5`, 'cmd2')}
                            className="text-slate-400 hover:text-white p-1"
                          >
                            {copiedKey === 'cmd2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Python Agents */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span>Detected Python Agents</span>
                </h3>
                {activeAgents.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No active Python workers reporting heartbeats yet. Start the script with <code>--daemon</code> or run a test simulation.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {activeAgents.map((ag) => (
                      <div key={ag.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-emerald-400 font-semibold">{ag.id}</span>
                          <span className="block text-[10px] text-slate-400">
                            Active VM: {ag.vmName} ({ag.status})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {ag.lastHeartbeat ? new Date(ag.lastHeartbeat).toLocaleTimeString() : 'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PYTHON SCRIPT TAB */}
          {activeTab === 'script' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Full standalone production script (vcenter_virtuozzo_migrator.py)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(PYTHON_MIGRATOR_SCRIPT, 'script')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    {copiedKey === 'script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'script' ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                  <button
                    onClick={() => downloadFile('vcenter_virtuozzo_migrator.py', PYTHON_MIGRATOR_SCRIPT)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-[50vh] leading-relaxed">
                {PYTHON_MIGRATOR_SCRIPT}
              </pre>
            </div>
          )}

          {/* CONFIG TAB */}
          {activeTab === 'config' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  config.yaml (vCenter and Virtuozzo connection parameters)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(PYTHON_CONFIG_YAML, 'cfg')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5"
                  >
                    {copiedKey === 'cfg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={() => downloadFile('config.yaml', PYTHON_CONFIG_YAML)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed">
                {PYTHON_CONFIG_YAML}
              </pre>
            </div>
          )}

          {/* REQUIREMENTS TAB */}
          {activeTab === 'requirements' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">requirements.txt</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(PYTHON_REQUIREMENTS_TXT, 'req')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5"
                  >
                    {copiedKey === 'req' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={() => downloadFile('requirements.txt', PYTHON_REQUIREMENTS_TXT)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto leading-relaxed">
                {PYTHON_REQUIREMENTS_TXT}
              </pre>
            </div>
          )}

          {/* API / WEBHOOK TAB */}
          {activeTab === 'api' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm">
                  1. Update VM Migration Stage &amp; Metrics
                </h4>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px]">
                    POST
                  </span>
                  <code className="text-slate-300 font-mono text-[11px]">
                    {currentHost}/api/migrations/&lt;vm_id&gt;/status
                  </code>
                </div>
                <pre className="bg-slate-900 p-3 rounded-lg text-indigo-300 font-mono text-[11px] overflow-x-auto">
{`{
  "stage": "converting",
  "status": "converting",       // preflight | snapshot | exporting | converting | transferring | virtuozzo_deploy | guest_tools | verifying | completed | failed
  "progress": 64.2,             // 0 to 100 percentage
  "speedMbps": 182.5,           // current I/O or network throughput
  "transferredGb": 45.0,        // volume transferred so far
  "etaSeconds": 140,            // estimated remaining time
  "currentStep": "qemu-img convert -f vmdk -O qcow2: converting block 81200",
  "pythonAgentId": "vz-migrator-node01"
}`}
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm">
                  2. Stream Live Migration Logs
                </h4>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold text-[11px]">
                    POST
                  </span>
                  <code className="text-slate-300 font-mono text-[11px]">
                    {currentHost}/api/migrations/&lt;vm_id&gt;/log
                  </code>
                </div>
                <pre className="bg-slate-900 p-3 rounded-lg text-blue-300 font-mono text-[11px] overflow-x-auto">
{`{
  "level": "info",    // "info" | "warn" | "error" | "cmd" | "success"
  "message": "Virtuozzo container definition instantiated on node vz-node02",
  "source": "python_agent"
}`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Endpoint Base: <code className="text-indigo-400 font-mono">{currentHost}</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
