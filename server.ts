import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import { MigrationVM, MigrationLog, MigrationStats, WaveGroup } from './src/types';
import { INITIAL_VMS, INITIAL_LOGS } from './server/mockData';
import { PYTHON_MIGRATOR_SCRIPT, PYTHON_CONFIG_YAML, PYTHON_REQUIREMENTS_TXT } from './server/pythonScripts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistence Path
const STORE_PATH = path.join(process.cwd(), 'server', 'storedMigrations.json');

// Conversion helper: storage in MiB -> GB
export function convertStorageToGb(val: any, forceMib = false): number {
  if (val === undefined || val === null || val === '') return 50;
  let num: number;
  if (typeof val === 'number') {
    num = val;
  } else {
    const cleanStr = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
    num = parseFloat(cleanStr);
  }
  if (isNaN(num) || num <= 0) return 50;

  // If explicitly flagged as MiB or if number is >= 10240 (standard MiB magnitude for disks, e.g. 10240 MiB = 10 GB, 20480 MiB = 20 GB, 512000 MiB = 500 GB, 1433600 MiB = 1400 GB)
  if (forceMib || num >= 10240) {
    const gb = num / 1024;
    return Math.abs(gb - Math.round(gb)) < 0.05 ? Math.round(gb) : Math.round(gb * 10) / 10;
  }
  return Math.round(num * 10) / 10;
}

// Conversion helper: RAM in MB -> GB if >= 512
export function convertRamToGb(val: any): number {
  if (val === undefined || val === null || val === '') return 4;
  let num: number;
  if (typeof val === 'number') {
    num = val;
  } else {
    const cleanStr = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
    num = parseFloat(cleanStr);
  }
  if (isNaN(num) || num <= 0) return 4;
  if (num >= 512) {
    const gb = num / 1024;
    return Math.abs(gb - Math.round(gb)) < 0.05 ? Math.round(gb) : Math.round(gb * 10) / 10;
  }
  return Math.round(num * 10) / 10;
}

// Conversion helper: parse vCPU count
export function parseVcpu(val: any): number {
  if (val === undefined || val === null || val === '') return 2;
  if (typeof val === 'number') return Math.max(1, Math.round(val));
  const cleanStr = String(val).replace(/,/g, '').replace(/[^\d.]/g, '').trim();
  const num = parseFloat(cleanStr);
  return isNaN(num) || num <= 0 ? 2 : Math.max(1, Math.round(num));
}

function loadStoredMigrations(): MigrationVM[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((vm: any) => ({
          ...vm,
          vcpu: parseVcpu(vm.vcpu),
          ramGb: convertRamToGb(vm.ramGb),
          diskGb: vm.diskGb >= 10240 ? Math.round((vm.diskGb / 1024) * 10) / 10 : (vm.diskGb || 50),
        }));
      }
    }
  } catch (err) {
    console.error('Error loading stored migrations:', err);
  }
  return [];
}

function saveStoredMigrations(items: MigrationVM[]) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving stored migrations:', err);
  }
}

// In-Memory Database (initialized with persistent stored data and converted values)
let migrations: MigrationVM[] = loadStoredMigrations();
let logs: MigrationLog[] = [
  {
    id: 'log-init',
    vmId: 'system',
    vmName: 'SYSTEM',
    timestamp: new Date().toISOString(),
    level: 'info',
    message: migrations.length > 0
      ? `Loaded ${migrations.length} workloads with storage converted to GB.`
      : 'Ready to import migration spreadsheet.',
    source: 'system',
  },
];

// Active SSE client connections
interface SSEClient {
  id: number;
  res: express.Response;
}
let sseClients: SSEClient[] = [];
let nextClientId = 1;

function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      // client dropped
    }
  });
}

function calculateStats(): MigrationStats {
  const totalVms = migrations.length;
  let completedVms = 0;
  let inProgressVms = 0;
  let failedVms = 0;
  let notStartedVms = 0;
  let totalDiskGb = 0;
  let migratedDiskGb = 0;
  let activeTransferSpeedMbps = 0;
  let totalVcpu = 0;
  let totalRamGb = 0;
  let remainingVcpu = 0;
  let remainingRamGb = 0;

  for (const vm of migrations) {
    const disk = vm.diskGb || 0;
    const vcpu = parseVcpu(vm.vcpu);
    const ram = convertRamToGb(vm.ramGb);

    totalDiskGb += disk;
    migratedDiskGb += vm.transferredGb || 0;
    totalVcpu += vcpu;
    totalRamGb += ram;

    if (vm.status === 'completed') {
      completedVms++;
    } else {
      // VMs needing migration from vCenter to Virtuozzo
      remainingVcpu += vcpu;
      remainingRamGb += ram;

      if (vm.status === 'failed') {
        failedVms++;
      } else if (['not_started', 'scheduled'].includes(vm.status)) {
        notStartedVms++;
      } else {
        inProgressVms++;
        activeTransferSpeedMbps += vm.speedMbps || 0;
      }
    }
  }

  const vmsNeedingMigration = totalVms - completedVms;
  const remainingDiskGb = Math.max(0, Math.round((totalDiskGb - migratedDiskGb) * 10) / 10);
  const completionPercentage = totalVms > 0 ? Math.round((completedVms / totalVms) * 100) : 0;

  return {
    totalVms,
    completedVms,
    vmsNeedingMigration,
    inProgressVms,
    failedVms,
    notStartedVms,
    totalVcpu,
    totalRamGb,
    remainingVcpu,
    remainingRamGb,
    totalDiskGb: Math.round(totalDiskGb * 10) / 10,
    migratedDiskGb: Math.round(migratedDiskGb * 10) / 10,
    remainingDiskGb,
    activeTransferSpeedMbps: Math.round(activeTransferSpeedMbps * 10) / 10,
    completionPercentage,
  };
}

function calculateWaveGroups(): WaveGroup[] {
  const map = new Map<string, WaveGroup>();

  for (const vm of migrations) {
    const waveName = vm.wave?.trim() || 'Unassigned';
    if (!map.has(waveName)) {
      map.set(waveName, {
        wave: waveName,
        count: 0,
        completed: 0,
        inProgress: 0,
        failed: 0,
        totalDiskGb: 0,
        migratedDiskGb: 0,
      });
    }
    const g = map.get(waveName)!;
    g.count++;
    g.totalDiskGb += vm.diskGb || 0;
    g.migratedDiskGb += vm.transferredGb || 0;
    if (vm.status === 'completed') g.completed++;
    else if (vm.status === 'failed') g.failed++;
    else if (!['not_started', 'scheduled'].includes(vm.status)) g.inProgress++;
  }

  return Array.from(map.values()).sort((a, b) => a.wave.localeCompare(b.wave));
}

// Active simulation timers map to allow aborting
const simulationTimers = new Map<string, NodeJS.Timeout[]>();

// ==========================================
// API ROUTES
// ==========================================

// Server-Sent Events (SSE) for instant real-time live monitoring
app.get('/api/migrations/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = nextClientId++;
  const client: SSEClient = { id: clientId, res };
  sseClients.push(client);

  // Send initial handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// GET list of migrations
app.get('/api/migrations', (req, res) => {
  const { wave, status, search } = req.query;
  let filtered = [...migrations];

  if (wave && typeof wave === 'string') {
    filtered = filtered.filter((vm) => vm.wave.toLowerCase() === wave.toLowerCase());
  }

  if (status && typeof status === 'string') {
    filtered = filtered.filter((vm) => vm.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (vm) =>
        vm.vmName.toLowerCase().includes(q) ||
        vm.sourceHost.toLowerCase().includes(q) ||
        vm.targetVirtuozzoHost.toLowerCase().includes(q) ||
        vm.osType.toLowerCase().includes(q) ||
        vm.assignedAdmin.toLowerCase().includes(q)
    );
  }

  res.json({
    vms: filtered,
    stats: calculateStats(),
    waves: calculateWaveGroups(),
  });
});

// GET aggregate migration statistics (VM counts, compute & storage totals)
app.get('/api/migrations/stats', (req, res) => {
  res.json(calculateStats());
});

// POST single migration VM
app.post('/api/migrations', (req, res) => {
  const body = req.body;
  const newVm: MigrationVM = {
    id: body.id || `vm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    vmName: body.vmName?.trim() || 'UNTITLED-VM',
    sourceCluster: body.sourceCluster || 'Cluster-Default',
    sourceDatacenter: body.sourceDatacenter || 'Datacenter-1',
    sourceHost: body.sourceHost || 'esxi-host.local',
    sourceDatastore: body.sourceDatastore || 'datastore1',
    vcpu: parseVcpu(body.vcpu),
    ramGb: convertRamToGb(body.ramGb),
    diskGb: convertStorageToGb(body.diskGb, body.diskUnit === 'mib'),
    osType: body.osType || 'Linux',
    ipAddress: body.ipAddress || '',
    targetVirtuozzoHost: body.targetVirtuozzoHost || 'vz-node01.datacenter.local',
    targetStoragePool: body.targetStoragePool || '/vz/vmpool',
    targetVlan: body.targetVlan || 'VLAN-100',
    targetVmType: body.targetVmType === 'container' ? 'container' : 'kvm',
    wave: body.wave?.trim() || 'Wave 1',
    priority: body.priority || 'medium',
    status: body.status || 'not_started',
    progress: 0,
    speedMbps: 0,
    transferredGb: 0,
    etaSeconds: null,
    currentStep: 'Ready for scheduling',
    assignedAdmin: body.assignedAdmin || 'Unassigned',
    scheduledTime: body.scheduledTime || null,
    startTime: null,
    endTime: null,
    errorMessage: null,
    lastHeartbeat: null,
    pythonAgentId: null,
  };

  migrations.push(newVm);
  saveStoredMigrations(migrations);
  broadcastSSE('migration_created', newVm);
  res.status(201).json(newVm);
});

// POST bulk import from spreadsheet
app.post('/api/migrations/bulk', (req, res) => {
  const { vms, mode, storageUnit } = req.body; // mode: 'replace' | 'append'
  if (!Array.isArray(vms)) {
    return res.status(400).json({ error: 'Expected vms to be an array' });
  }

  const isMibStorage = storageUnit === 'mib' || req.body.storageInMib;

  const newItems: MigrationVM[] = vms.map((v, index) => {
    const rawDisk = v.diskGb ?? v.diskMib ?? v['Storage (MiB)'] ?? v['Capacity MiB'] ?? v['Provisioned MB'] ?? v['Storage MB'] ?? v['Disk (GB)'] ?? v['Disk Size'] ?? v['Disk'];
    const rawRam = v.ramGb ?? v.ramMb ?? v['RAM (GB)'] ?? v['RAM (MB)'] ?? v['Memory'] ?? v['RAM'];
    const rawVcpu = v.vcpu ?? v['vCPU'] ?? v['CPU'] ?? v['vCPUs'] ?? v['Cores'] ?? v['Num CPU'] ?? v['CPUs'] ?? v['Compute: vCPU'];

    return {
      id: v.id || `vm-imported-${Date.now()}-${index}`,
      vmName: (v.vmName || v['VM Name'] || `VM-${index + 1}`).toString().trim(),
      sourceCluster: (v.sourceCluster || v['Source Cluster'] || 'Default-Cluster').toString(),
      sourceDatacenter: (v.sourceDatacenter || v['Datacenter'] || 'DC1').toString(),
      sourceHost: (v.sourceHost || v['ESXi Host'] || v['Source Host'] || 'esxi.local').toString(),
      sourceDatastore: (v.sourceDatastore || v['Datastore'] || 'datastore1').toString(),
      vcpu: parseVcpu(rawVcpu),
      ramGb: convertRamToGb(rawRam),
      diskGb: convertStorageToGb(rawDisk, isMibStorage || v.storageUnit === 'mib'),
      osType: (v.osType || v['OS'] || v['Operating System'] || 'Linux').toString(),
      ipAddress: (v.ipAddress || v['IP Address'] || v['IP'] || '').toString(),
      targetVirtuozzoHost: (v.targetVirtuozzoHost || v['Virtuozzo Node'] || v['Target Host'] || 'vz-node01.corp.vhs').toString(),
      targetStoragePool: (v.targetStoragePool || v['Target Storage'] || v['Storage Pool'] || '/vz/vmpool').toString(),
      targetVlan: (v.targetVlan || v['Target VLAN'] || v['VLAN'] || 'VLAN-Default').toString(),
      targetVmType: v.targetVmType === 'container' ? 'container' : 'kvm',
      wave: (v.wave || v['Wave'] || v['Migration Wave'] || 'Wave 1').toString().trim(),
      priority: ['low', 'medium', 'high', 'critical'].includes(v.priority) ? v.priority : 'medium',
      status: v.status || 'not_started',
      progress: Number(v.progress) || 0,
      speedMbps: 0,
      transferredGb: 0,
      etaSeconds: null,
      currentStep: 'Imported from spreadsheet',
      assignedAdmin: (v.assignedAdmin || v['Assigned Admin'] || v['Owner'] || 'DevOps Team').toString(),
      scheduledTime: v.scheduledTime || null,
      startTime: null,
      endTime: null,
      errorMessage: null,
      lastHeartbeat: null,
      pythonAgentId: null,
    };
  });

  if (mode === 'replace') {
    migrations = newItems;
  } else {
    // Merge or append: if vmName exists, update or append
    migrations = [...migrations, ...newItems];
  }

  saveStoredMigrations(migrations);

  const logEntry: MigrationLog = {
    id: `log-${Date.now()}`,
    vmId: 'system',
    vmName: 'SYSTEM',
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Imported ${newItems.length} workloads (${mode === 'replace' ? 'replaced existing' : 'appended'}). Storage converted from MiB to GB.`,
    source: 'system',
  };
  logs.push(logEntry);

  broadcastSSE('migrations_reloaded', { count: migrations.length });
  res.json({ success: true, count: newItems.length, total: migrations.length });
});

// POST trigger unit conversion on loaded workloads
app.post('/api/migrations/convert-units', (req, res) => {
  let convertedStorage = 0;
  let convertedRam = 0;

  migrations = migrations.map((vm) => {
    let diskGb = vm.diskGb;
    let ramGb = vm.ramGb;
    if (diskGb >= 10240) {
      diskGb = convertStorageToGb(diskGb, true);
      convertedStorage++;
    }
    if (ramGb >= 512) {
      ramGb = convertRamToGb(ramGb);
      convertedRam++;
    }
    return { ...vm, diskGb, ramGb };
  });

  saveStoredMigrations(migrations);
  broadcastSSE('migrations_reloaded', { count: migrations.length });
  res.json({
    success: true,
    convertedStorage,
    convertedRam,
    totalVms: migrations.length,
    stats: calculateStats(),
  });
});

// POST manually mark a single VM as migrated or not migrated
app.post('/api/migrations/:id/mark-migrated', (req, res) => {
  const { id } = req.params;
  const { migrated } = req.body;
  const index = migrations.findIndex((m) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'VM not found' });
  }

  const vm = { ...migrations[index] };
  const isMigrated = Boolean(migrated);
  const now = new Date().toISOString();

  if (isMigrated) {
    vm.status = 'completed';
    vm.progress = 100;
    vm.transferredGb = vm.diskGb;
    vm.speedMbps = 0;
    vm.etaSeconds = null;
    vm.currentStep = 'Manually marked as migrated';
    vm.endTime = now;
    vm.errorMessage = null;
  } else {
    vm.status = 'not_started';
    vm.progress = 0;
    vm.transferredGb = 0;
    vm.speedMbps = 0;
    vm.etaSeconds = null;
    vm.currentStep = 'Ready for migration';
    vm.startTime = null;
    vm.endTime = null;
    vm.errorMessage = null;
  }

  migrations[index] = vm;
  saveStoredMigrations(migrations);

  const logEntry: MigrationLog = {
    id: `log-${Date.now()}`,
    vmId: vm.id,
    vmName: vm.vmName,
    timestamp: now,
    level: isMigrated ? 'success' : 'info',
    message: isMigrated
      ? `Workload '${vm.vmName}' manually marked as MIGRATED (Completed).`
      : `Workload '${vm.vmName}' manually marked as NOT MIGRATED (Status reset).`,
    source: 'admin',
  };
  logs.push(logEntry);

  broadcastSSE('migration_updated', vm);
  broadcastSSE('log_added', logEntry);
  res.json({ success: true, vm, stats: calculateStats() });
});

// POST batch manually mark multiple VMs as migrated or not migrated
app.post('/api/migrations/bulk-mark-migrated', (req, res) => {
  const { vmIds, migrated } = req.body;
  if (!Array.isArray(vmIds) || vmIds.length === 0) {
    return res.status(400).json({ error: 'Expected vmIds array' });
  }

  const isMigrated = Boolean(migrated);
  const now = new Date().toISOString();
  let updatedCount = 0;

  migrations = migrations.map((vm) => {
    if (!vmIds.includes(vm.id)) return vm;
    updatedCount++;
    if (isMigrated) {
      return {
        ...vm,
        status: 'completed',
        progress: 100,
        transferredGb: vm.diskGb,
        speedMbps: 0,
        etaSeconds: null,
        currentStep: 'Manually marked as migrated',
        endTime: now,
        errorMessage: null,
      };
    } else {
      return {
        ...vm,
        status: 'not_started',
        progress: 0,
        transferredGb: 0,
        speedMbps: 0,
        etaSeconds: null,
        currentStep: 'Ready for migration',
        startTime: null,
        endTime: null,
        errorMessage: null,
      };
    }
  });

  saveStoredMigrations(migrations);

  const logEntry: MigrationLog = {
    id: `log-${Date.now()}`,
    vmId: 'system',
    vmName: 'SYSTEM',
    timestamp: now,
    level: isMigrated ? 'success' : 'info',
    message: `Batch update: ${updatedCount} workload(s) manually marked as ${isMigrated ? 'MIGRATED' : 'NOT MIGRATED'}.`,
    source: 'admin',
  };
  logs.push(logEntry);

  broadcastSSE('migrations_reloaded', { count: migrations.length });
  broadcastSSE('log_added', logEntry);
  res.json({ success: true, updatedCount, stats: calculateStats() });
});

// PATCH single VM
app.patch('/api/migrations/:id', (req, res) => {
  const { id } = req.params;
  const index = migrations.findIndex((m) => m.id === id);
  if (index === -1) {
    return res.status(400).json({ error: 'VM not found' });
  }

  const updates = { ...req.body };
  if (updates.vcpu !== undefined) {
    updates.vcpu = parseVcpu(updates.vcpu);
  }
  if (updates.diskGb !== undefined) {
    updates.diskGb = convertStorageToGb(updates.diskGb, updates.diskUnit === 'mib');
  }
  if (updates.ramGb !== undefined) {
    updates.ramGb = convertRamToGb(updates.ramGb);
  }

  migrations[index] = { ...migrations[index], ...updates };
  saveStoredMigrations(migrations);
  broadcastSSE('migration_updated', migrations[index]);
  res.json(migrations[index]);
});

// DELETE single VM
app.delete('/api/migrations/:id', (req, res) => {
  const { id } = req.params;
  migrations = migrations.filter((m) => m.id !== id);
  saveStoredMigrations(migrations);
  broadcastSSE('migration_deleted', { id });
  res.json({ success: true, id });
});

// RESET or CLEAR
app.post('/api/migrations/clear', (req, res) => {
  const { resetToSample } = req.body;
  if (resetToSample) {
    migrations = JSON.parse(JSON.stringify(INITIAL_VMS));
    logs = JSON.parse(JSON.stringify(INITIAL_LOGS));
  } else {
    migrations = [];
    logs = [];
  }
  saveStoredMigrations(migrations);
  broadcastSSE('migrations_reloaded', { count: migrations.length });
  res.json({ success: true, count: migrations.length });
});

// ==========================================
// PYTHON AGENT WEBHOOK / STATUS UPDATE API
// Used by migrate_vm.py script in real-time
// ==========================================
app.post('/api/migrations/:id/status', (req, res) => {
  const { id } = req.params;
  const vm = migrations.find((m) => m.id === id);
  if (!vm) {
    return res.status(404).json({ error: `VM with ID '${id}' not found` });
  }

  const {
    stage,
    status,
    progress,
    speedMbps,
    transferredGb,
    etaSeconds,
    currentStep,
    errorMessage,
    pythonAgentId,
  } = req.body;

  const now = new Date().toISOString();

  if (status) vm.status = status;
  if (typeof progress === 'number') vm.progress = Math.min(100, Math.max(0, progress));
  if (typeof speedMbps === 'number') vm.speedMbps = speedMbps;
  if (typeof transferredGb === 'number') vm.transferredGb = transferredGb;
  if (etaSeconds !== undefined) vm.etaSeconds = etaSeconds;
  if (currentStep) vm.currentStep = currentStep;
  if (errorMessage !== undefined) vm.errorMessage = errorMessage;
  if (pythonAgentId) vm.pythonAgentId = pythonAgentId;
  vm.lastHeartbeat = now;

  // Track start and end times
  if (!vm.startTime && status && !['not_started', 'scheduled'].includes(status)) {
    vm.startTime = now;
  }
  if (status === 'completed' || status === 'failed' || status === 'rolled_back') {
    vm.endTime = now;
    if (status === 'completed') {
      vm.progress = 100;
      vm.speedMbps = 0;
      vm.etaSeconds = 0;
    }
  }

  broadcastSSE('migration_updated', vm);
  res.json({ success: true, vm });
});

// Log ingestion endpoint for Python agent
app.post('/api/migrations/:id/log', (req, res) => {
  const { id } = req.params;
  const vm = migrations.find((m) => m.id === id);
  const vmName = vm ? vm.vmName : id;

  const { message, level = 'info', source = 'python_agent' } = req.body;

  const logEntry: MigrationLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    vmId: id,
    vmName,
    timestamp: new Date().toISOString(),
    level,
    message,
    source,
  };

  logs.push(logEntry);
  if (logs.length > 2000) logs.shift(); // keep last 2000 logs

  broadcastSSE('log_added', logEntry);
  res.json({ success: true, log: logEntry });
});

// GET logs for a specific VM or all
app.get('/api/migrations/:id/logs', (req, res) => {
  const { id } = req.params;
  if (id === 'all') {
    return res.json(logs.slice(-200));
  }
  const vmLines = logs.filter((l) => l.vmId === id);
  res.json(vmLines);
});

// SIMULATION ENDPOINT: Run a high-fidelity simulation so the user can see real-time progress right away
app.post('/api/migrations/:id/simulate', (req, res) => {
  const { id } = req.params;
  const vm = migrations.find((m) => m.id === id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  // Clear existing timers for this VM
  if (simulationTimers.has(id)) {
    simulationTimers.get(id)!.forEach(clearTimeout);
    simulationTimers.delete(id);
  }

  const timers: NodeJS.Timeout[] = [];
  const diskSize = vm.diskGb || 60;
  const now = new Date().toISOString();

  vm.status = 'preflight';
  vm.progress = 5;
  vm.speedMbps = 0;
  vm.transferredGb = 0;
  vm.etaSeconds = 240;
  vm.currentStep = 'Checking VMware ESXi cluster and Virtuozzo storage capacity';
  vm.startTime = now;
  vm.endTime = null;
  vm.errorMessage = null;
  vm.pythonAgentId = 'simulator-worker-01';
  broadcastSSE('migration_updated', vm);

  const addSimLog = (msg: string, level: MigrationLog['level'] = 'info') => {
    const entry: MigrationLog = {
      id: `log-sim-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      vmId: vm.id,
      vmName: vm.vmName,
      timestamp: new Date().toISOString(),
      level,
      message: msg,
      source: 'simulator',
    };
    logs.push(entry);
    broadcastSSE('log_added', entry);
  };

  addSimLog(`[Simulated Python Agent] Initiating migration pipeline for '${vm.vmName}'`);
  addSimLog(`Target node: ${vm.targetVirtuozzoHost}, Storage pool: ${vm.targetStoragePool}`);

  // Schedule stage transitions
  const steps = [
    { delay: 1500, stage: 'snapshot', status: 'snapshot', prog: 15, speed: 0, step: 'Creating VMware quiesced snapshot', log: 'vSphere API: Quiesced snapshot created with consistency guarantee.' },
    { delay: 3500, stage: 'exporting', status: 'exporting', prog: 28, speed: 110, step: 'Streaming VMDK via ovftool / vCenter HTTP export', log: 'Extracting VMDK monolithic sparse stream from datastore...' },
    { delay: 6000, stage: 'converting', status: 'converting', prog: 45, speed: 175, step: 'qemu-img convert -f vmdk -O qcow2: 45% done', log: 'qemu-img: Converting VMDK to compressed QCOW2 (zstd compression enabled)' },
    { delay: 8500, stage: 'converting', status: 'converting', prog: 62, speed: 190, step: 'qemu-img convert -f vmdk -O qcow2: 62% done', log: 'qemu-img: Writing target sectors... SHA256 block checks valid' },
    { delay: 11000, stage: 'transferring', status: 'transferring', prog: 78, speed: 210, step: `Rsyncing disk image to ${vm.targetVirtuozzoHost}:${vm.targetStoragePool}`, log: `Network throughput: 210 MB/s. Writing to NVMe pool '${vm.targetStoragePool}'` },
    { delay: 14000, stage: 'virtuozzo_deploy', status: 'virtuozzo_deploy', prog: 88, speed: 50, step: `Registering VM on Virtuozzo via prlctl create`, log: `Executing: prlctl create "${vm.vmName}" --dst ${vm.targetStoragePool} --vcpus ${vm.vcpu} --memsize ${vm.ramGb * 1024}` },
    { delay: 17000, stage: 'guest_tools', status: 'guest_tools', prog: 94, speed: 20, step: 'Injecting Virtuozzo Guest Tools & virtio drivers', log: 'Guest tools driver injection completed for ' + vm.osType },
    { delay: 20000, stage: 'verifying', status: 'verifying', prog: 98, speed: 0, step: 'Starting VM and verifying IP connectivity', log: 'prlctl start: Virtuozzo VM booted. Heartbeat detected on target VLAN.' },
    { delay: 22500, stage: 'completed', status: 'completed', prog: 100, speed: 0, step: 'Migration verified. Workload successfully transferred to Virtuozzo.', log: `🎉 Cutover complete. Workload '${vm.vmName}' is active on Virtuozzo!`, isFinal: true },
  ];

  steps.forEach((s) => {
    const t = setTimeout(() => {
      const current = migrations.find((m) => m.id === id);
      if (!current || current.status === 'not_started') return;

      current.status = s.status as any;
      current.progress = s.prog;
      current.speedMbps = s.speed;
      current.transferredGb = Math.round((diskSize * (s.prog / 100)) * 100) / 100;
      current.currentStep = s.step;
      current.lastHeartbeat = new Date().toISOString();
      if (s.isFinal) {
        current.endTime = new Date().toISOString();
        current.etaSeconds = 0;
      } else {
        current.etaSeconds = Math.max(10, Math.round((100 - s.prog) * 2.5));
      }

      broadcastSSE('migration_updated', current);
      addSimLog(s.log, s.isFinal ? 'success' : 'info');

      if (s.isFinal) {
        simulationTimers.delete(id);
      }
    }, s.delay);
    timers.push(t);
  });

  simulationTimers.set(id, timers);
  res.json({ success: true, message: `Started real-time simulation for ${vm.vmName}` });
});

// ABORT endpoint
app.post('/api/migrations/:id/abort', (req, res) => {
  const { id } = req.params;
  const vm = migrations.find((m) => m.id === id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  if (simulationTimers.has(id)) {
    simulationTimers.get(id)!.forEach(clearTimeout);
    simulationTimers.delete(id);
  }

  vm.status = 'rolled_back';
  vm.speedMbps = 0;
  vm.etaSeconds = null;
  vm.currentStep = 'Migration aborted by administrator. Rolled back.';
  vm.endTime = new Date().toISOString();
  vm.errorMessage = 'Manually stopped or rolled back';

  const entry: MigrationLog = {
    id: `log-abort-${Date.now()}`,
    vmId: vm.id,
    vmName: vm.vmName,
    timestamp: new Date().toISOString(),
    level: 'warn',
    message: `Migration aborted and rolled back for '${vm.vmName}'.`,
    source: 'system',
  };
  logs.push(entry);

  broadcastSSE('migration_updated', vm);
  broadcastSSE('log_added', entry);
  res.json({ success: true, vm });
});

// DOWNLOAD PYTHON SCRIPTS
app.get('/api/scripts/python/:file', (req, res) => {
  const { file } = req.params;
  if (file === 'migrate_vm.py' || file === 'vcenter_virtuozzo_migrator.py') {
    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', 'attachment; filename="vcenter_virtuozzo_migrator.py"');
    return res.send(PYTHON_MIGRATOR_SCRIPT);
  }
  if (file === 'config.yaml') {
    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Content-Disposition', 'attachment; filename="config.yaml"');
    return res.send(PYTHON_CONFIG_YAML);
  }
  if (file === 'requirements.txt') {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="requirements.txt"');
    return res.send(PYTHON_REQUIREMENTS_TXT);
  }
  res.status(404).send('File not found');
});

// EXPORT CURRENT TRACKER TO CSV / XLSX
app.get('/api/migrations/export/xlsx', (req, res) => {
  const rows = migrations.map((vm) => ({
    'VM Name': vm.vmName,
    'Status': vm.status,
    'Progress (%)': vm.progress,
    'Current Stage': vm.currentStep,
    'vCPU': vm.vcpu,
    'RAM (GB)': vm.ramGb,
    'Disk Size (GB)': vm.diskGb,
    'Transferred (GB)': vm.transferredGb,
    'Speed (MB/s)': vm.speedMbps,
    'OS': vm.osType,
    'IP Address': vm.ipAddress || '',
    'Source vCenter Cluster': vm.sourceCluster,
    'Source Datacenter': vm.sourceDatacenter,
    'Source ESXi Host': vm.sourceHost,
    'Source Datastore': vm.sourceDatastore,
    'Target Virtuozzo Host': vm.targetVirtuozzoHost,
    'Target Storage Pool': vm.targetStoragePool,
    'Target VLAN': vm.targetVlan,
    'Migration Wave': vm.wave,
    'Priority': vm.priority,
    'Assigned Admin': vm.assignedAdmin,
    'Scheduled Time': vm.scheduledTime || '',
    'Start Time': vm.startTime || '',
    'End Time': vm.endTime || '',
    'Error Message': vm.errorMessage || '',
    'Agent ID': vm.pythonAgentId || '',
    'Last Heartbeat': vm.lastHeartbeat || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'VM Migrations');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="vcenter_to_virtuozzo_migrations.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// ==========================================
// VITE MIDDLEWARE SETUP
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`vCenter to Virtuozzo Migration Tracker running on port ${PORT}`);
  });
}

startServer();
