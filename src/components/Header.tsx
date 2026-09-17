import React from 'react';
import {
  Server,
  RotateCcw,
  Radio,
  Plus,
  Users,
  LogOut,
  LogIn,
  User as UserIcon,
} from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  connected: boolean;
  onOpenSpreadsheetModal?: () => void;
  onOpenPythonHub?: () => void;
  onOpenAddVmModal: () => void;
  onResetData: () => void;
  onExportXlsx?: () => void;
  onDiscardAll?: () => void;
  vmCount?: number;
  currentUser: User | null;
  onOpenUsersModal: () => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connected,
  onOpenAddVmModal,
  onResetData,
  currentUser,
  onOpenUsersModal,
  onLoginClick,
  onLogoutClick,
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
                VM Workload Migration Tracker
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Add VM */}
            <button
              id="btn-add-vm"
              onClick={onOpenAddVmModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add VM</span>
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

            {/* User & Access Controls */}
            <div className="flex items-center gap-2 border-l border-slate-800 pl-2.5 ml-1">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  {/* Manage Users Button (Admin Only) */}
                  {currentUser.role === 'admin' && (
                    <button
                      id="btn-manage-users"
                      onClick={onOpenUsersModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
                      title="Manage Users & Access"
                    >
                      <Users className="w-4 h-4 text-indigo-400" />
                      <span>Users</span>
                    </button>
                  )}

                  {/* User Profile Badge */}
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
                    <div className="w-5 h-5 rounded-md bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                      {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : currentUser.username[0].toUpperCase()}
                    </div>
                    <span className="text-slate-200 font-medium max-w-[120px] truncate">
                      {currentUser.displayName || currentUser.username}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {currentUser.role}
                    </span>
                  </div>

                  {/* Sign Out Button */}
                  <button
                    onClick={onLogoutClick}
                    title="Sign Out"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onLoginClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
