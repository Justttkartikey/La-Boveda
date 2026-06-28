import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDb } from '../../hooks/useDb';
import { useClipboard } from '../../hooks/useClipboard';
import {
  Shield,
  Key,
  FileText,
  File,
  Activity,
  Plus,
  Zap,
  CheckCircle,
  AlertTriangle,
  History,
} from 'lucide-react';

interface OperationsCenterProps {
  setActiveTab: (tab: string) => void;
  onOpenCreateModal: (type: 'password' | 'note' | 'file') => void;
}

export const OperationsCenter: React.FC<OperationsCenterProps> = ({ setActiveTab, onOpenCreateModal }) => {
  const { lockVault, autoLockTime, hasBiometrics, recoveryKey } = useAuth();
  const { items, logs, securityScore } = useDb();
  const { clearClipboard } = useClipboard();

  // Instant Panic Button action
  const handlePanic = async () => {
    // 1. Immediately wipe clipboard (overwrite)
    await clearClipboard();
    // 2. Lock the vault instantly (destroys keys, resets screen state to weather camouflage)
    lockVault();
  };

  // Compile statistics
  const totalItems = items.length;
  const passwordCount = items.filter((i) => i.type === 'password').length;
  const noteCount = items.filter((i) => i.type === 'note').length;
  const fileCount = items.filter((i) => i.type === 'file').length;

  // Format time since action
  const formatTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#d4af37]';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="space-y-6 text-left">
      {/* Upper Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Security Score Widget */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col justify-between md:col-span-2 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold font-display text-white">Security Integrity Score</h3>
              <p className="text-xs text-zinc-400 mt-1">Real-time local vault audit check</p>
            </div>
            <Shield className={`h-8 w-8 ${getScoreColor(securityScore)}`} />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 my-2">
            {/* Circular score progress */}
            <div className="relative shrink-0 flex items-center justify-center">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke={securityScore >= 80 ? '#d4af37' : securityScore >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - securityScore / 100)}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <span className={`absolute text-2xl font-extrabold font-display ${getScoreColor(securityScore)}`}>
                {securityScore}
              </span>
            </div>

            {/* Breakdown checklist */}
            <div className="flex-1 grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-zinc-300">
                {recoveryKey ? <CheckCircle size={14} className="text-[#d4af37]" /> : <AlertTriangle size={14} className="text-zinc-500" />}
                <span>Recovery Configured</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                {autoLockTime > 0 ? <CheckCircle size={14} className="text-[#d4af37]" /> : <AlertTriangle size={14} className="text-zinc-500" />}
                <span>Auto-Lock Timer</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                {hasBiometrics ? <CheckCircle size={14} className="text-[#d4af37]" /> : <AlertTriangle size={14} className="text-zinc-500" />}
                <span>Biometric Key Ring</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <CheckCircle size={14} className="text-[#d4af37]" />
                <span>WebCrypto AES-GCM</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                {localStorage.getItem('lbv_last_backup_time') ? (
                  <CheckCircle size={14} className="text-[#d4af37]" />
                ) : (
                  <AlertTriangle size={14} className="text-zinc-500" />
                )}
                <span>
                  Backup: {localStorage.getItem('lbv_last_backup_time') 
                    ? formatTime(Number(localStorage.getItem('lbv_last_backup_time'))) 
                    : 'Never'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <CheckCircle size={14} className="text-[#d4af37]" />
                <span>Clipboard Shield</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-[10px] text-zinc-400 mt-4 border-t border-white/5 pt-3">
            Tip: Shortening auto-lock and replacing weak credentials improves score.
          </div>
        </div>

        {/* Instant Panic Button widget */}
        <div
          onClick={handlePanic}
          className="bg-gradient-to-b from-rose-950/40 to-rose-900/10 border border-rose-500/20 p-6 rounded-3xl flex flex-col justify-between cursor-pointer hover:from-rose-950/60 transition-all select-none group shadow-[0_0_20px_rgba(239,68,68,0.05)] active:scale-98"
        >
          <div className="flex justify-between items-start">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl group-hover:scale-105 transition-all">
              <Zap size={22} className="text-rose-400 fill-rose-400/20 animate-pulse" />
            </div>
            <span className="text-[10px] font-bold text-rose-400/60 uppercase tracking-widest bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
              Instant
            </span>
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-bold font-display text-white">Panic Protocol</h3>
            <p className="text-xs text-rose-300/60 mt-1 leading-relaxed">
              Instantly lock database, overwrite system clipboard, and load weather cover without animations.
            </p>
          </div>
        </div>

      </div>

      {/* Middle Widgets Grid: Statistics & Logs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Vault Stats Widget */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold font-display text-white mb-4">Vault Database</h3>
            
            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Key size={15} />
                  <span>Passwords</span>
                </div>
                <span className="font-semibold text-white">{passwordCount}</span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2 text-zinc-400">
                  <FileText size={15} />
                  <span>Secure Notes</span>
                </div>
                <span className="font-semibold text-white">{noteCount}</span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2 text-zinc-400">
                  <File size={15} />
                  <span>Secure Files</span>
                </div>
                <span className="font-semibold text-white">{fileCount}</span>
              </div>

              <div className="flex justify-between items-center text-sm pb-1">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Shield size={15} />
                  <span>Total Records</span>
                </div>
                <span className="font-semibold text-white">{totalItems}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('passwords')}
            className="w-full text-center py-2 px-4 bg-white/5 border border-white/5 rounded-2xl text-xs font-semibold text-zinc-300 hover:bg-white/10 active:scale-98 transition-all mt-6"
          >
            Manage Vault
          </button>
        </div>

        {/* Recent Activity Log Feed */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 md:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-display text-white">Chamber Activity Log</h3>
              <Activity size={16} className="text-zinc-500" />
            </div>

            <div className="space-y-3.5 max-h-[190px] overflow-y-auto pr-1">
              {logs.slice(0, 4).map((log) => (
                <div key={log.id} className="flex items-start justify-between text-xs border-b border-white/5 pb-2.5">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-white/5 border border-white/5 rounded-lg text-zinc-400 shrink-0 mt-0.5">
                      <History size={12} />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-200">{log.type}</p>
                      <p className="text-zinc-400 text-[10px] mt-0.5">{log.description}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 shrink-0">{formatTime(log.timestamp)}</span>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="text-center py-8 text-xs text-zinc-500">
                  No activity logged yet.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('settings')}
            className="w-full text-center py-2 px-4 bg-white/5 border border-white/5 rounded-2xl text-xs font-semibold text-zinc-300 hover:bg-white/10 active:scale-98 transition-all mt-6"
          >
            Audit Log Configuration
          </button>
        </div>

      </div>

      {/* Quick Action Grid */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3.5">Quick Chamber Ingestion</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <button
            onClick={() => onOpenCreateModal('password')}
            className="flex items-center gap-3 p-4 bg-white/3 border border-white/5 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-all text-left text-sm group focus:outline-none"
          >
            <div className="p-2.5 bg-[#d4af37]/10 rounded-xl group-hover:scale-105 transition-all">
              <Plus size={16} className="text-[#d4af37]" />
            </div>
            <div>
              <p className="font-semibold text-white">Save Password</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Credentials & site login</p>
            </div>
          </button>

          <button
            onClick={() => onOpenCreateModal('note')}
            className="flex items-center gap-3 p-4 bg-white/3 border border-white/5 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-all text-left text-sm group focus:outline-none"
          >
            <div className="p-2.5 bg-blue-500/10 rounded-xl group-hover:scale-105 transition-all">
              <Plus size={16} className="text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Create Note</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Encrypted Markdown document</p>
            </div>
          </button>

          <button
            onClick={() => onOpenCreateModal('file')}
            className="flex items-center gap-3 p-4 bg-white/3 border border-white/5 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-all text-left text-sm group focus:outline-none"
          >
            <div className="p-2.5 bg-teal-500/10 rounded-xl group-hover:scale-105 transition-all">
              <Plus size={16} className="text-teal-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Ingest Secure File</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Upload document limit 2MB</p>
            </div>
          </button>

        </div>
      </div>
    </div>
  );
};
