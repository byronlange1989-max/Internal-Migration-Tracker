export type MigrationStatus =
  | 'not_started'
  | 'scheduled'
  | 'preflight'
  | 'snapshot'
  | 'exporting'
  | 'converting'
  | 'transferring'
  | 'virtuozzo_deploy'
  | 'guest_tools'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface MigrationVM {
  id: string;
  vmName: string;
  sourceCluster: string;
  sourceDatacenter: string;
  sourceHost: string;
  sourceDatastore: string;
  vcpu: number;
  ramGb: number;
  diskGb: number;
  osType: string;
  ipAddress?: string;
  targetVirtuozzoHost: string;
  targetStoragePool: string;
  targetVlan: string;
  targetVmType: 'kvm' | 'container';
  wave: string;
  priority: PriorityLevel;
  status: MigrationStatus;
  progress: number; // 0 - 100
  speedMbps: number;
  transferredGb: number;
  etaSeconds: number | null;
  currentStep: string;
  assignedAdmin: string;
  scheduledTime: string | null;
  startTime: string | null;
  endTime: string | null;
  errorMessage: string | null;
  lastHeartbeat: string | null;
  pythonAgentId: string | null;
}

export interface MigrationLog {
  id: string;
  vmId: string;
  vmName: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'cmd';
  message: string;
  source: 'python_agent' | 'system' | 'simulator' | 'admin';
}

export interface MigrationStats {
  totalVms: number;
  completedVms: number;
  vmsNeedingMigration: number; // VMs still needing migration from vCenter to Virtuozzo
  inProgressVms: number;
  failedVms: number;
  notStartedVms: number;
  totalVcpu: number;
  totalRamGb: number;
  remainingVcpu: number;
  remainingRamGb: number;
  totalDiskGb: number;
  migratedDiskGb: number;
  remainingDiskGb: number;
  activeTransferSpeedMbps: number;
  completionPercentage: number;
}

export interface WaveGroup {
  wave: string;
  count: number;
  completed: number;
  inProgress: number;
  failed: number;
  totalDiskGb: number;
  migratedDiskGb: number;
}

export interface ColumnMappingConfig {
  vmName: string;
  sourceCluster?: string;
  sourceDatacenter?: string;
  sourceHost?: string;
  sourceDatastore?: string;
  vcpu?: string;
  ramGb?: string;
  diskGb?: string;
  osType?: string;
  ipAddress?: string;
  targetVirtuozzoHost?: string;
  targetStoragePool?: string;
  targetVlan?: string;
  wave?: string;
  priority?: string;
  assignedAdmin?: string;
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}
