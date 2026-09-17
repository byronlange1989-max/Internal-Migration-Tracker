import React, { useState } from 'react';
import {
  Server,
  Lock,
  User as UserIcon,
  AlertCircle,
  LogIn,
  Shield,
  ArrowRight,
  Info,
} from 'lucide-react';
import { User } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both your username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Check your username and password.');
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Unable to connect or invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Background Subtle Gradient Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/10 blur-[130px] rounded-full" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[300px] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Portal Header / Brand */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-indigo-500/20 ring-1 ring-white/20 mb-2">
            <Server className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              <span>vCenter</span>
              <span className="text-slate-500 font-light text-xl">→</span>
              <span className="text-indigo-400">Virtuozzo</span>
            </h1>
            <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-widest">
              Internal Migration Tracker &bull; Secure Portal
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Sign In to Your Account</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your authorized credentials to access workload telemetry
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Username</span>
              </label>
              <input
                id="login-username"
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Password</span>
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition shadow-lg shadow-indigo-600/25 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70" />
                </>
              )}
            </button>
          </form>

          {/* Collapsible Info / First-Time Instructions */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-300 transition"
            >
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Default administrative accounts</span>
              </span>
              <span className="text-[10px] underline">{showHint ? 'Hide' : 'View'}</span>
            </button>

            {showHint && (
              <div className="mt-3 p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-[11px] text-slate-400 space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Info className="w-3 h-3 text-indigo-400" />
                  <span>Initial Admin Logins:</span>
                </div>
                <div className="flex items-center justify-between font-mono bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
                  <span className="text-slate-300">admin</span>
                  <span className="text-slate-500">password: <span className="text-indigo-300">admin123</span></span>
                </div>
                <div className="flex items-center justify-between font-mono bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
                  <span className="text-slate-300">ironadmin</span>
                  <span className="text-slate-500">password: <span className="text-indigo-300">admin123</span></span>
                </div>
                <p className="text-[10px] text-slate-500 pt-1">
                  Once logged in, administrators can add new team members from the <strong>Users</strong> menu in the top bar.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-[11px] text-slate-600 mt-6">
          Authorized internal migration personnel only &bull; vCenter to Virtuozzo VHS
        </p>
      </div>
    </div>
  );
};
