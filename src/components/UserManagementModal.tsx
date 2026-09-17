import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  Shield,
  Trash2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  User as UserIcon,
  RefreshCw,
} from 'lucide-react';
import { User, UserRole } from '../types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  token: string | null;
  onUserListChanged?: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  token,
  onUserListChanged,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New User Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');
  const [newPassword, setNewPassword] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Reset Password State
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [savingReset, setSavingReset] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load users');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching user list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setShowAddForm(false);
      setResetUserId(null);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      setError('Username and password are required');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters long');
      return;
    }

    setSavingUser(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          displayName: newDisplayName.trim() || newUsername.trim(),
          email: newEmail.trim() || undefined,
          role: newRole,
          password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccessMsg(`User account '${data.username}' created successfully.`);
      setNewUsername('');
      setNewDisplayName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('operator');
      setShowAddForm(false);
      fetchUsers();
      onUserListChanged?.();
    } catch (err: any) {
      setError(err.message || 'Error creating user');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to permanently delete user '${user.username}'?`)) {
      return;
    }

    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setSuccessMsg(`User '${user.username}' removed.`);
      fetchUsers();
      onUserListChanged?.();
    } catch (err: any) {
      setError(err.message || 'Error deleting user');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!resetPasswordVal || resetPasswordVal.length < 4) {
      setError('New password must be at least 4 characters');
      return;
    }

    setSavingReset(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ password: resetPasswordVal }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccessMsg(`Password for '${data.username}' updated successfully.`);
      setResetUserId(null);
      setResetPasswordVal('');
    } catch (err: any) {
      setError(err.message || 'Error resetting password');
    } finally {
      setSavingReset(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change role');
      }

      setSuccessMsg(`Updated role for '${data.username}' to ${newRole}.`);
      fetchUsers();
      onUserListChanged?.();
    } catch (err: any) {
      setError(err.message || 'Error changing role');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>User Management &amp; Access Control</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {users.length} Users
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Manage accounts, grant administrative access, and reset credentials for migration team members
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Notifications */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Logged in as <strong className="text-slate-200 font-semibold">{currentUser?.displayName || currentUser?.username || 'Admin'}</strong>{' '}
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] uppercase font-mono ml-1">
                {currentUser?.role || 'admin'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition"
                title="Refresh user list"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>{showAddForm ? 'Cancel New User' : 'Add New User'}</span>
              </button>
            </div>
          </div>

          {/* Add New User Panel */}
          {showAddForm && (
            <form
              onSubmit={handleCreateUser}
              className="p-4 rounded-xl bg-slate-800/60 border border-indigo-500/30 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Team Member Account</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    placeholder="e.g. jsmith"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Full Name / Display Name
                  </label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 4 characters"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Role &amp; Permissions
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="admin">Admin (Full Control, Add/Delete Users &amp; VMs)</option>
                    <option value="operator">Operator (Track, Mark Migrations &amp; Edit VMs)</option>
                    <option value="viewer">Viewer (Read-Only Live Status &amp; Telemetry)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. jsmith@company.com"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm disabled:opacity-50"
                >
                  {savingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          {/* User List Table */}
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Created</th>
                  <th className="px-4 py-3 hidden md:table-cell">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id || currentUser?.username === u.username;
                  const isResetting = resetUserId === u.id;

                  return (
                    <React.Fragment key={u.id}>
                      <tr className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                              <UserIcon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                <span>{u.displayName || u.username}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">@{u.username}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold border focus:outline-none ${
                              u.role === 'admin'
                                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40'
                                : u.role === 'operator'
                                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            <option value="admin">Admin</option>
                            <option value="operator">Operator</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </td>

                        <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>

                        <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                          {u.lastLogin ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{new Date(u.lastLogin).toLocaleDateString()}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">Never</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setResetUserId(isResetting ? null : u.id)}
                              title="Reset user password"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                title="Delete user"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* In-line password reset box */}
                      {isResetting && (
                        <tr className="bg-slate-800/70 border-t border-slate-700/60">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex items-center gap-2 max-w-md">
                              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                              <input
                                type="password"
                                placeholder={`New password for ${u.username}`}
                                value={resetPasswordVal}
                                onChange={(e) => setResetPasswordVal(e.target.value)}
                                className="flex-1 px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                              />
                              <button
                                onClick={() => handleResetPassword(u.id)}
                                disabled={savingReset}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
                              >
                                {savingReset ? 'Saving...' : 'Set Password'}
                              </button>
                              <button
                                onClick={() => {
                                  setResetUserId(null);
                                  setResetPasswordVal('');
                                }}
                                className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quick Info Box */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Default Credentials &amp; Role Permissions</span>
            </div>
            <p>
              • <strong>Admin</strong>: Can create/delete accounts, change user roles, trigger workload migrations, and modify VMs.
            </p>
            <p>
              • <strong>Operator / Viewer</strong>: Can view live telemetry, search workloads, and track cutover statuses.
            </p>
            <p className="text-slate-500">
              Default administrator accounts initialized: <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">admin</code> / <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">admin123</code> and <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">ironadmin</code> / <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">admin123</code>.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
