import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Download,
  ArrowRight,
  ClipboardList,
  HardDrive,
} from 'lucide-react';
import { MigrationVM } from '../types';

interface SpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (vms: Partial<MigrationVM>[], mode: 'replace' | 'append') => void;
  initialMode?: 'replace' | 'append';
  initialFile?: File | null;
}

export const SpreadsheetModal: React.FC<SpreadsheetModalProps> = ({
  isOpen,
  onClose,
  onImport,
  initialMode = 'replace',
  initialFile = null,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'template'>('upload');
  const [file, setFile] = useState<File | null>(initialFile);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [pasteText, setPasteText] = useState<string>('');
  const [importMode, setImportMode] = useState<'replace' | 'append'>(initialMode);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Storage unit configuration (User specified storage is in MiB, default to converting to GB)
  const [storageUnit, setStorageUnit] = useState<'mib' | 'gb'>('mib');

  // Column Mapping state
  const [mapping, setMapping] = useState({
    vmName: '',
    sourceCluster: '',
    sourceHost: '',
    sourceDatastore: '',
    vcpu: '',
    ramGb: '',
    diskGb: '',
    osType: '',
    ipAddress: '',
    targetVirtuozzoHost: '',
    targetStoragePool: '',
    targetVlan: '',
    wave: '',
    priority: '',
    assignedAdmin: '',
  });

  // Helper to parse and convert MiB to GB
  const parseStorageValue = (val: any, unit: 'mib' | 'gb' = storageUnit): number => {
    if (val === undefined || val === null || val === '') return 50;
    let num: number;
    if (typeof val === 'number') {
      num = val;
    } else {
      const clean = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
      num = parseFloat(clean);
    }
    if (isNaN(num) || num <= 0) return 50;

    if (unit === 'mib' || num >= 10240) {
      const gb = num / 1024;
      return Math.abs(gb - Math.round(gb)) < 0.05 ? Math.round(gb) : Math.round(gb * 10) / 10;
    }
    return Math.round(num * 10) / 10;
  };

  // Helper to parse and convert RAM (auto-converts if in MB >= 512)
  const parseRamValue = (val: any): number => {
    if (val === undefined || val === null || val === '') return 4;
    let num: number;
    if (typeof val === 'number') {
      num = val;
    } else {
      const clean = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
      num = parseFloat(clean);
    }
    if (isNaN(num) || num <= 0) return 4;
    if (num >= 512) {
      const gb = num / 1024;
      return Math.abs(gb - Math.round(gb)) < 0.05 ? Math.round(gb) : Math.round(gb * 10) / 10;
    }
    return Math.round(num);
  };

  // Auto-detect columns based on header strings
  const autoDetectColumns = (foundHeaders: string[]) => {
    const newMapping = { ...mapping };
    const lower = foundHeaders.map((h) => ({ original: h, clean: h.toLowerCase().replace(/[^a-z0-9]/g, '') }));

    const findMatch = (terms: string[]) => {
      for (const t of terms) {
        const found = lower.find((item) => item.clean.includes(t.toLowerCase().replace(/[^a-z0-9]/g, '')));
        if (found) return found.original;
      }
      return '';
    };

    newMapping.vmName = findMatch(['vmname', 'virtualmachine', 'name', 'vm', 'sourcevm', 'workload', 'hostname']);
    newMapping.sourceCluster = findMatch(['cluster', 'vcentercluster', 'sourcecluster', 'vcenter']);
    newMapping.sourceHost = findMatch(['sourcehost', 'esxihost', 'esxi', 'host']);
    newMapping.sourceDatastore = findMatch(['sourcedatastore', 'datastore', 'sourcepool', 'storage']);
    newMapping.vcpu = findMatch(['vcpu', 'cpu', 'cpus', 'cores', 'vcpus']);
    newMapping.ramGb = findMatch(['memorymb', 'rammb', 'memory_mb', 'ram_mb', 'ramgb', 'ram', 'memorygb', 'memory', 'ram_gb']);
    newMapping.diskGb = findMatch([
      'provisionedmib', 'capacitymib', 'storagemib', 'diskmib', 'vmsizemib',
      'provisionedmb', 'capacitymb', 'storagemb', 'diskmb', 'vmsizemb',
      'storage', 'diskgb', 'storagegb', 'capacitygb', 'disk', 'disksize', 'capacity', 'size', 'disk_gb'
    ]);
    newMapping.osType = findMatch(['ostype', 'os', 'operatingsystem', 'guest', 'guestos']);
    newMapping.ipAddress = findMatch(['ipaddress', 'ip', 'ipv4', 'address']);
    newMapping.targetVirtuozzoHost = findMatch(['targetvirtuozzohost', 'virtuozzonode', 'virtuozzo', 'targethost', 'targetnode', 'vznode', 'destinationhost']);
    newMapping.targetStoragePool = findMatch(['targetstoragepool', 'targetstorage', 'storagepool', 'vmpool', 'targetpool']);
    newMapping.targetVlan = findMatch(['targetvlan', 'vlan', 'network', 'portgroup']);
    newMapping.wave = findMatch(['wave', 'migrationwave', 'batch', 'phase']);
    newMapping.priority = findMatch(['priority', 'severity', 'tier']);
    newMapping.assignedAdmin = findMatch(['assignedadmin', 'owner', 'admin', 'assignee', 'lead']);

    setMapping(newMapping);
  };

  const processWorkbook = (wb: XLSX.WorkBook) => {
    try {
      const sheets = wb.SheetNames;
      setSheetNames(sheets);
      const chosen = sheets[0];
      setSelectedSheet(chosen);

      const ws = wb.Sheets[chosen];
      const data: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (data.length === 0) {
        setErrorMessage('The selected sheet contains no data rows.');
        return;
      }

      const cols = Object.keys(data[0]);
      setHeaders(cols);
      setRawRows(data);
      autoDetectColumns(cols);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(`Failed to parse spreadsheet: ${err.message || err}`);
    }
  };

  const parseUploadedFile = (uploaded: File) => {
    setFile(uploaded);
    setIsProcessing(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        processWorkbook(wb);
      } catch (err: any) {
        setErrorMessage(`Could not read file: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(uploaded);
  };

  useEffect(() => {
    if (isOpen && initialFile) {
      parseUploadedFile(initialFile);
    }
  }, [isOpen, initialFile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    parseUploadedFile(uploaded);
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[sheetName];
      const data: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (data.length > 0) {
        const cols = Object.keys(data[0]);
        setHeaders(cols);
        setRawRows(data);
        autoDetectColumns(cols);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePasteParse = () => {
    if (!pasteText.trim()) return;
    try {
      const wb = XLSX.read(pasteText, { type: 'string' });
      processWorkbook(wb);
    } catch (err: any) {
      setErrorMessage(`Failed to parse pasted data: ${err.message}`);
    }
  };

  const downloadSampleTemplate = (format: 'xlsx' | 'csv') => {
    const sample = [
      {
        'VM Name': 'PRD-APP-SERVER-01',
        'Source Cluster': 'Cluster-Prod-ESXi',
        'Datacenter': 'DC1-Frankfurt',
        'ESXi Host': 'esxi-01.corp.local',
        'Datastore': 'SAN_SSD_VOL_01',
        'vCPU': 4,
        'RAM (MB)': 16384,
        'Storage (MiB)': 102400, // 100 GB
        'OS': 'Ubuntu 22.04 LTS',
        'IP Address': '10.20.14.55',
        'Virtuozzo Node': 'vz-node01.dc1.vhs',
        'Target Storage': '/vz/storage/nvme-pool1',
        'Target VLAN': 'VLAN-214-PROD',
        'Wave': 'Wave 1 (Pilot/Web)',
        'Priority': 'high',
        'Assigned Admin': 'DevOps Lead',
      },
      {
        'VM Name': 'PRD-POSTGRESQL-01',
        'Source Cluster': 'Cluster-Prod-ESXi',
        'Datacenter': 'DC1-Frankfurt',
        'ESXi Host': 'esxi-02.corp.local',
        'Datastore': 'SAN_FAST_NVME_01',
        'vCPU': 16,
        'RAM (MB)': 65536,
        'Storage (MiB)': 358400, // 350 GB
        'OS': 'Red Hat Enterprise Linux 9',
        'IP Address': '10.20.14.12',
        'Virtuozzo Node': 'vz-node02.dc1.vhs',
        'Target Storage': '/vz/storage/nvme-pool1',
        'Target VLAN': 'VLAN-210-DB',
        'Wave': 'Wave 2 (Databases)',
        'Priority': 'critical',
        'Assigned Admin': 'Senior DBA',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Migration Inventory');

    if (format === 'xlsx') {
      XLSX.writeFile(wb, 'vcenter_to_virtuozzo_migration_template.xlsx');
    } else {
      XLSX.writeFile(wb, 'vcenter_to_virtuozzo_migration_template.csv');
    }
  };

  const handleExecuteImport = () => {
    if (rawRows.length === 0) {
      setErrorMessage('Please upload or paste spreadsheet data first.');
      return;
    }

    if (!mapping.vmName) {
      setErrorMessage('Please select which column represents the VM Name.');
      return;
    }

    const converted: Partial<MigrationVM>[] = rawRows.map((row, idx) => {
      const vmName = String(row[mapping.vmName] || `VM-${idx + 1}`).trim();
      const vcpuVal = mapping.vcpu ? Number(row[mapping.vcpu]) || 2 : 2;
      const ramVal = mapping.ramGb ? parseRamValue(row[mapping.ramGb]) : 4;
      // Convert storage: storage is in MiB, convert to GB (val / 1024)
      const diskVal = mapping.diskGb ? parseStorageValue(row[mapping.diskGb], storageUnit) : 50;

      return {
        id: `vm-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        vmName,
        sourceCluster: mapping.sourceCluster ? String(row[mapping.sourceCluster] || 'Cluster-Default') : 'Cluster-Default',
        sourceDatacenter: 'DC1',
        sourceHost: mapping.sourceHost ? String(row[mapping.sourceHost] || 'esxi-host.local') : 'esxi-host.local',
        sourceDatastore: mapping.sourceDatastore ? String(row[mapping.sourceDatastore] || 'datastore1') : 'datastore1',
        vcpu: vcpuVal,
        ramGb: ramVal,
        diskGb: diskVal,
        osType: mapping.osType ? String(row[mapping.osType] || 'Linux') : 'Linux',
        ipAddress: mapping.ipAddress ? String(row[mapping.ipAddress] || '') : '',
        targetVirtuozzoHost: mapping.targetVirtuozzoHost ? String(row[mapping.targetVirtuozzoHost] || 'vz-node01.corp.vhs') : 'vz-node01.corp.vhs',
        targetStoragePool: mapping.targetStoragePool ? String(row[mapping.targetStoragePool] || '/vz/vmpool') : '/vz/vmpool',
        targetVlan: mapping.targetVlan ? String(row[mapping.targetVlan] || 'VLAN-100') : 'VLAN-100',
        targetVmType: 'kvm',
        wave: mapping.wave ? String(row[mapping.wave] || 'Wave 1').trim() : 'Wave 1',
        priority: (mapping.priority && ['low', 'medium', 'high', 'critical'].includes(String(row[mapping.priority]).toLowerCase()))
          ? (String(row[mapping.priority]).toLowerCase() as any)
          : 'medium',
        status: 'not_started',
        progress: 0,
        speedMbps: 0,
        transferredGb: 0,
        etaSeconds: null,
        currentStep: 'Imported from spreadsheet - awaiting schedule',
        assignedAdmin: mapping.assignedAdmin ? String(row[mapping.assignedAdmin] || 'DevOps Team') : 'DevOps Team',
        scheduledTime: null,
        startTime: null,
        endTime: null,
        errorMessage: null,
        lastHeartbeat: null,
        pythonAgentId: null,
      };
    });

    onImport(converted, importMode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import VM Migration Spreadsheet</h2>
              <p className="text-xs text-slate-400">
                Upload your Excel (.xlsx, .xls) or CSV file with vCenter source &amp; Virtuozzo target specs
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

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 bg-slate-950/40 flex items-center space-x-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload File (.xlsx / .csv)</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Paste CSV / Table Text</span>
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'template'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download Sample Template</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Mode Notice Banner */}
          <div
            className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              importMode === 'replace'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  importMode === 'replace' ? 'bg-amber-400 animate-pulse' : 'bg-indigo-400'
                }`}
              />
              <span className="leading-relaxed">
                {importMode === 'replace' ? (
                  <>
                    <strong className="text-amber-300 font-bold">Discard &amp; Replace Mode:</strong>{' '}
                    Any existing workloads will be removed and replaced with this new spreadsheet.
                  </>
                ) : (
                  <>
                    <strong className="text-indigo-300 font-bold">Append Mode:</strong>{' '}
                    Workloads from this file will be added to the current inventory.
                  </>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setImportMode(importMode === 'replace' ? 'append' : 'replace')}
              className="text-[11px] underline hover:text-white shrink-0 self-start sm:self-auto font-medium"
            >
              Switch to {importMode === 'replace' ? 'Append' : 'Discard & Replace'}
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) {
                    parseUploadedFile(dropped);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition group ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-emerald-500/60 bg-slate-950/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  {file ? file.name : isDragging ? 'Drop spreadsheet here to load' : 'Click to select or drag & drop your new migration spreadsheet'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
                </p>
              </div>

              {/* Sheet selector if multiple */}
              {sheetNames.length > 1 && (
                <div className="mt-4 flex items-center gap-3">
                  <label className="text-xs text-slate-400 font-medium">Select Sheet:</label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    {sheetNames.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-3">
              <label className="text-xs text-slate-400 block">
                Paste tabular data copied from Excel, Google Sheets, or a CSV file:
              </label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`VM Name\tSource Host\tvCPU\tRAM (GB)\tDisk (GB)\tOS\tTarget Node\tWave\nAPP-SRV-01\tesxi-01.corp\t4\t16\t100\tUbuntu 22.04\tvz-node01\tWave 1`}
                rows={6}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handlePasteParse}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95"
              >
                Parse Pasted Rows
              </button>
            </div>
          )}

          {activeTab === 'template' && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Download Standard Migration Template</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Use this pre-formatted spreadsheet template with the optimal column headers for VMware vCenter and Virtuozzo mapping.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => downloadSampleTemplate('xlsx')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button
                  onClick={() => downloadSampleTemplate('csv')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                >
                  <FileText className="w-4 h-4" />
                  <span>Download CSV (.csv)</span>
                </button>
              </div>
            </div>
          )}

          {/* Column Mapping Section (Visible if rows parsed) */}
          {rawRows.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Field Mapping</span>
                    <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {rawRows.length} rows detected
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Match your spreadsheet columns to VMware source &amp; Virtuozzo target properties
                  </p>
                </div>

                {/* Storage Unit Conversion Toggle */}
                <div className="flex items-center gap-2 bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-3 py-1.5 self-start sm:self-auto">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-xs text-slate-300 font-medium">Storage Input:</span>
                  <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setStorageUnit('mib')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                        storageUnit === 'mib'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Spreadsheet disk sizes are in MiB (converts to GB: ÷ 1024)"
                    >
                      MiB (÷1024 to GB)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStorageUnit('gb')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                        storageUnit === 'gb'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Spreadsheet disk sizes are already in GB"
                    >
                      Direct GB
                    </button>
                  </div>
                </div>
              </div>

              {storageUnit === 'mib' && (
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                    <span>
                      <strong>MiB to GB Conversion Active:</strong> All storage values from your spreadsheet will be divided by 1,024 into standard GB.
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-indigo-400 hidden sm:inline">
                    Formula: Disk(GB) = Disk(MiB) ÷ 1,024
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* VM Name (Required) */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-indigo-500/30">
                  <label className="text-xs font-semibold text-indigo-400 block mb-1">
                    * VM Name (Required)
                  </label>
                  <select
                    value={mapping.vmName}
                    onChange={(e) => setMapping({ ...mapping, vmName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Compute: vCPU */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-cyan-500/30">
                  <label className="text-xs font-semibold text-cyan-400 block mb-1">
                    Compute: vCPU / Cores
                  </label>
                  <select
                    value={mapping.vcpu}
                    onChange={(e) => setMapping({ ...mapping, vcpu: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Compute: RAM */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-cyan-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-cyan-400 block">
                      Compute: RAM (GB)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Auto MB→GB</span>
                  </div>
                  <select
                    value={mapping.ramGb}
                    onChange={(e) => setMapping({ ...mapping, ramGb: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {mapping.ramGb && rawRows[0] && (
                    <div className="mt-1.5 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Raw: {String(rawRows[0][mapping.ramGb])}</span>
                      <span className="text-cyan-300 font-medium">
                        → {parseRamValue(rawRows[0][mapping.ramGb])} GB
                      </span>
                    </div>
                  )}
                </div>

                {/* Storage: Disk Size (MiB -> GB) */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-indigo-500/40 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-indigo-300 block">
                      Storage: Disk Size
                    </label>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                      {storageUnit === 'mib' ? 'MiB → GB (÷1024)' : 'GB Direct'}
                    </span>
                  </div>
                  <select
                    value={mapping.diskGb}
                    onChange={(e) => setMapping({ ...mapping, diskGb: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {mapping.diskGb && rawRows[0] && (
                    <div className="mt-1.5 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Raw: {Number(rawRows[0][mapping.diskGb]).toLocaleString()} {storageUnit === 'mib' ? 'MiB' : 'GB'}</span>
                      <span className="text-emerald-400 font-bold">
                        → {parseStorageValue(rawRows[0][mapping.diskGb], storageUnit)} GB
                      </span>
                    </div>
                  )}
                </div>

                {/* Operating System */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    OS / Distribution
                  </label>
                  <select
                    value={mapping.osType}
                    onChange={(e) => setMapping({ ...mapping, osType: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Migration Wave */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Migration Wave / Batch
                  </label>
                  <select
                    value={mapping.wave}
                    onChange={(e) => setMapping({ ...mapping, wave: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Data Preview Table */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Preview (First 3 Workloads):
                  </span>
                  <span className="text-[11px] text-indigo-400">
                    Storage shown in converted GB
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">VM Name</th>
                        <th className="px-3 py-2">Compute: vCPU</th>
                        <th className="px-3 py-2">Compute: RAM</th>
                        <th className="px-3 py-2">Storage: Disk (GB)</th>
                        <th className="px-3 py-2">Guest OS</th>
                        <th className="px-3 py-2">Wave</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {rawRows.slice(0, 3).map((r, i) => {
                        const rawDiskVal = mapping.diskGb ? r[mapping.diskGb] : null;
                        const convertedDisk = rawDiskVal !== null ? parseStorageValue(rawDiskVal, storageUnit) : 100;
                        const rawRamVal = mapping.ramGb ? r[mapping.ramGb] : null;
                        const convertedRam = rawRamVal !== null ? parseRamValue(rawRamVal) : 16;

                        return (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-medium text-white">{mapping.vmName ? r[mapping.vmName] : '-'}</td>
                            <td className="px-3 py-2 text-cyan-300">{mapping.vcpu ? `${r[mapping.vcpu]} vCPU` : '4 vCPU'}</td>
                            <td className="px-3 py-2 text-cyan-300">
                              <span className="font-semibold">{convertedRam} GB</span>
                              {rawRamVal && Number(rawRamVal) >= 512 && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  ({Number(rawRamVal).toLocaleString()} MB)
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-indigo-300 font-medium">
                              <span className="text-white font-bold text-sm">{convertedDisk} GB</span>
                              {rawDiskVal && storageUnit === 'mib' && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  ({Number(rawDiskVal).toLocaleString()} MiB)
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-300">{mapping.osType ? r[mapping.osType] : 'Linux'}</td>
                            <td className="px-3 py-2">{mapping.wave ? r[mapping.wave] : 'Wave 1'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <span className="font-medium text-slate-300">Import Mode:</span>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
                className="text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-700"
              />
              <span className="font-semibold text-amber-300">Discard old &amp; replace all</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'append'}
                onChange={() => setImportMode('append')}
                className="text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-700"
              />
              <span>Append to current</span>
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-import"
              disabled={rawRows.length === 0}
              onClick={handleExecuteImport}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition shadow-lg ${
                rawRows.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>
                {rawRows.length > 0
                  ? importMode === 'replace'
                    ? `Discard Old & Import ${rawRows.length} Workloads`
                    : `Append ${rawRows.length} Workloads`
                  : 'Import Spreadsheet'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
