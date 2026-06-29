import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDb } from '../../hooks/useDb';
import {
  Shield,
  Database,
  Eye,
  Info,
  Key,
  Clock,
  Fingerprint,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ControlRoomProps {
  onVersionClick?: () => void;
}

export const ControlRoom: React.FC<ControlRoomProps> = ({ onVersionClick }) => {
  const {
    autoLockTime,
    setAutoLockTime,
    entryGesture,
    setEntryGesture,
    defaultCity,
    setDefaultCity,
    changePin,
    setupBiometricsWithPin, // WebAuthn custom setup
    biometricsSupported,
    hasBiometrics,
    resetVault,
  } = useAuth();

  const { exportBackup, importBackup, items, logs } = useDb();

  const [activeSec, setActiveSec] = useState<'security' | 'camouflage' | 'storage' | 'about'>('security');

  // Change PIN state
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Biometrics setup state
  const [biometricPin, setBiometricPin] = useState('');
  const [biometricMsg, setBiometricMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricPromptOpen, setBiometricPromptOpen] = useState(false);

  // Backup checkboxes
  const [backupPasswords, setBackupPasswords] = useState(true);
  const [backupNotes, setBackupNotes] = useState(true);
  const [backupSettings, setBackupSettings] = useState(true);
  const [backupLogs, setBackupLogs] = useState(true);
  const [backupHistory, setBackupHistory] = useState(true);
  const [backupPinInput, setBackupPinInput] = useState('');
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePinInput, setRestorePinInput] = useState('');
  const [restoreMsg, setRestoreMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Wipe confirmation
  const [wipeConfirmInput, setWipeConfirmInput] = useState('');
  const [wipeError, setWipeError] = useState<string | null>(null);

  // Handle PIN change submission
  const handlePinChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);

    if (newPin.length < 6) {
      setPinChangeMsg({ text: 'PIN must be at least 6 digits.', error: true });
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinChangeMsg({ text: 'New PIN and Confirmation do not match.', error: true });
      return;
    }

    setPinLoading(true);
    // Slight delay to prevent brute-forcing checks
    setTimeout(async () => {
      try {
        const success = await changePin(oldPin, newPin);
        if (success) {
          // Calculate PIN strength score (Max: 15 pts)
          let score = 0;
          if (newPin.length >= 9) score = 15;
          else if (newPin.length >= 7) score = 12;
          else if (newPin.length >= 6) score = 8;
          
          const isRepeating = /^(\d)\1+$/.test(newPin);
          const isSequentialAsc = '0123456789'.includes(newPin);
          const isSequentialDesc = '9876543210'.includes(newPin);
          
          if (isRepeating || isSequentialAsc || isSequentialDesc) {
            score -= 8;
          }
          
          const alternatePattern = /^(\d{2})\1+$/.test(newPin);
          if (alternatePattern) {
            score -= 4;
          }
          
          localStorage.setItem('lbv_pin_score', Math.max(1, Math.min(15, score)).toString());

          setPinChangeMsg({ text: 'Master PIN changed successfully. Recovery key updated in activity logs.', error: false });
          setOldPin('');
          setNewPin('');
          setConfirmNewPin('');
        } else {
          setPinChangeMsg({ text: 'Verification failed. Old PIN is incorrect.', error: true });
        }
      } catch (err) {
        setPinChangeMsg({ text: 'Error changing PIN. Database connection failed.', error: true });
      } finally {
        setPinLoading(false);
      }
    }, 1000);
  };

  // Enrolling biometric lock with PIN confirmation
  const handleEnrollBiometrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setBiometricMsg(null);
    setBiometricLoading(true);

    try {
      const success = await setupBiometricsWithPin(biometricPin);
      if (success) {
        setBiometricMsg({ text: 'Biometrics enrolled successfully. Fingerprint unlock active.', error: false });
        setBiometricPromptOpen(false);
        setBiometricPin('');
      } else {
        setBiometricMsg({ text: 'Verification failed or biometrics prompt cancelled.', error: true });
      }
    } catch (err) {
      setBiometricMsg({ text: 'An error occurred during enrollment.', error: true });
    } finally {
      setBiometricLoading(false);
    }
  };

  // Export encrypted backup
  const handleExportBackup = async () => {
    setBackupSuccessMsg(null);
    try {
      const payload = await exportBackup({
        passwords: backupPasswords,
        notes: backupNotes,
        settings: backupSettings,
        logs: backupLogs,
        history: backupHistory,
      }, backupPinInput.trim() || undefined);

      // Save last backup time
      localStorage.setItem('lbv_last_backup_time', Date.now().toString());

      // Create download blob
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `la_boveda_backup_${Date.now()}.lbv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupSuccessMsg('Encrypted backup download started.');
      setBackupPinInput('');
      setTimeout(() => setBackupSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Restore backup
  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreMsg(null);

    if (!restoreFile) {
      setRestoreMsg({ text: 'Please select a backup file (.lbv)', error: true });
      return;
    }

    setRestoreLoading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      if (!evt.target || !evt.target.result) return;
      const backupStr = evt.target.result as string;

      try {
        const res = await importBackup(backupStr, restorePinInput.trim() || undefined);
        if (res.success) {
          setRestoreMsg({ text: `Backup restored successfully! Imported ${res.count} records.`, error: false });
          setRestoreFile(null);
          setRestorePinInput('');
        } else {
          if (res.error === 'BACKUP_PIN_REQUIRED') {
            setRestoreMsg({ text: 'This backup is encrypted with a PIN. Please provide the PIN below.', error: true });
          } else {
            setRestoreMsg({ text: 'Failed to restore backup. Invalid PIN or corrupted data.', error: true });
          }
        }
      } catch (err) {
        setRestoreMsg({ text: 'An unexpected error occurred during import.', error: true });
      } finally {
        setRestoreLoading(false);
      }
    };

    reader.readAsText(restoreFile);
  };

  // Wipe Vault
  const handleWipeVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setWipeError(null);

    if (wipeConfirmInput !== 'ELIMINAR TODO') {
      setWipeError('Confirmation text is incorrect.');
      return;
    }

    try {
      await resetVault();
    } catch (err) {
      setWipeError('Failed to wipe database.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-left">
      
      {/* Settings Navigation */}
      <div className="w-full lg:w-56 shrink-0 space-y-1">
        {[
          { id: 'security', label: 'Security & Biometrics', icon: Shield },
          { id: 'camouflage', label: 'Cover Camouflage', icon: Eye },
          { id: 'storage', label: 'Storage & Backup', icon: Database },
          { id: 'about', label: 'Chamber Metadata', icon: Info },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeSec === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSec(t.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                isActive
                  ? 'gold-gradient-bg text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/3'
              }`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings Panel */}
      <div className="flex-1 glass-panel border border-white/5 rounded-3xl p-6 min-h-[480px]">
        <AnimatePresence mode="wait">
          
          {/* 1. SECURITY SECTION */}
          {activeSec === 'security' && (
            <motion.div
              key="sec-security"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Security & Access Settings</h3>
                <p className="text-xs text-zinc-500">Configure key management, biometric entry, and lockout details.</p>
              </div>

              {/* Autolock & Clipboard timeouts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Clock size={11} /> Auto-Lock Chamber Timer
                  </label>
                  <select
                    value={autoLockTime}
                    onChange={(e) => setAutoLockTime(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#d4af37]/45"
                  >
                    <option value="60">1 Minute</option>
                    <option value="300">5 Minutes</option>
                    <option value="900">15 Minutes</option>
                    <option value="1800">30 Minutes</option>
                    <option value="0">Never Lock (Not Recommended)</option>
                  </select>
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  {biometricsSupported && (
                    <div className="flex items-center justify-between p-3.5 bg-black/20 border border-white/5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Fingerprint size={16} className={hasBiometrics ? 'text-green-400' : 'text-zinc-500'} />
                        <div>
                          <p className="text-xs font-semibold text-white">Biometric Login</p>
                          <p className="text-[9px] text-zinc-500 mt-0.5">
                            {hasBiometrics ? 'Active fingerprint unlock' : 'Offered on mobile'}
                          </p>
                        </div>
                      </div>
                      
                      {!hasBiometrics ? (
                        <button
                          onClick={() => {
                            setBiometricMsg(null);
                            setBiometricPromptOpen(true);
                          }}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[10px] font-semibold text-zinc-300 transition-all active:scale-95"
                        >
                          Enroll
                        </button>
                      ) : (
                        <span className="text-[9px] text-green-400 font-semibold bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                          Enrolled
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Master PIN Reset form */}
              <div className="border-t border-white/5 pt-5 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                  <Key size={12} /> Rotate Master PIN
                </h4>
                
                <form onSubmit={handlePinChangeSubmit} className="space-y-4 max-w-md">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                        Current Master PIN
                      </label>
                      <input
                        type="password"
                        pattern="\d*"
                        maxLength={12}
                        value={oldPin}
                        onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-1.5 text-xs glass-input focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                        New Master PIN
                      </label>
                      <input
                        type="password"
                        pattern="\d*"
                        maxLength={12}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-1.5 text-xs glass-input focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                        Confirm New PIN
                      </label>
                      <input
                        type="password"
                        pattern="\d*"
                        maxLength={12}
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-1.5 text-xs glass-input focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  {pinChangeMsg && (
                    <p className={`text-xs font-medium px-4 py-2 border rounded-xl ${
                      pinChangeMsg.error
                        ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                        : 'text-green-500 bg-green-500/10 border-green-500/20'
                    }`}>
                      {pinChangeMsg.text}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={pinLoading}
                    className="py-2 px-4 text-xs font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans hover:brightness-105 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {pinLoading ? <RefreshCw className="animate-spin" size={12} /> : null}
                    Update Access PIN
                  </button>
                </form>
              </div>

            </motion.div>
          )}

          {/* 2. CAMOUFLAGE SECTION */}
          {activeSec === 'camouflage' && (
            <motion.div
              key="sec-camouflage"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Cover Camouflage Configuration</h3>
                <p className="text-xs text-zinc-500">Customize the fake weather app behavior and the secret entry gesture.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-white/5 pt-5">
                
                {/* City select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    Default Cover City
                  </label>
                  <input
                    type="text"
                    value={defaultCity}
                    onChange={(e) => setDefaultCity(e.target.value)}
                    className="w-full px-3.5 py-1.5 text-xs glass-input focus:outline-none"
                    placeholder="e.g. Madrid, London..."
                  />
                  <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
                    Determines what weather is fetched by default when opening the page.
                  </p>
                </div>

                {/* Gesture Select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    Secret Trigger Gesture
                  </label>
                  <select
                    value={entryGesture}
                    onChange={(e) => setEntryGesture(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#d4af37]/45"
                  >
                    <option value="double-tap-temp">Double-Tap Temperature</option>
                    <option value="long-press-city">Long-Press City (2s)</option>
                    <option value="tap-icon">Single-Tap Weather Icon</option>
                  </select>
                  <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
                    How you switch from the weather screen to the PIN authentication vault.
                  </p>
                </div>

              </div>
            </motion.div>
          )}

          {/* 3. STORAGE & BACKUPS SECTION */}
          {activeSec === 'storage' && (
            <motion.div
              key="sec-storage"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Local Storage & Encrypted Backups</h3>
                <p className="text-xs text-zinc-500">Maintain database records, compile local backups (.lbv files), or reset the device storage.</p>
              </div>

              {/* Backup block */}
              <div className="border-t border-white/5 pt-5 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                  <Download size={13} /> Export Encrypted Chamber Backup (.lbv)
                </h4>

                <div className="space-y-3.5">
                  <div className="flex flex-wrap gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                      <input
                        type="checkbox"
                        checked={backupPasswords}
                        onChange={(e) => setBackupPasswords(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                      />
                      <span>Passwords ({items.filter((i) => i.type === 'password').length})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                      <input
                        type="checkbox"
                        checked={backupNotes}
                        onChange={(e) => setBackupNotes(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                      />
                      <span>Notes & Files ({items.filter((i) => i.type === 'note' || i.type === 'file').length})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                      <input
                        type="checkbox"
                        checked={backupSettings}
                        onChange={(e) => setBackupSettings(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                      />
                      <span>Settings & Preferences</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                      <input
                        type="checkbox"
                        checked={backupLogs}
                        onChange={(e) => setBackupLogs(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                      />
                      <span>Chamber Logs ({logs.length})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                      <input
                        type="checkbox"
                        checked={backupHistory}
                        onChange={(e) => setBackupHistory(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                      />
                      <span>Entropy History ({items.filter((i) => i.type === 'generated_password').length})</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                        Optional Backup PIN (Custom Password)
                      </label>
                      <input
                        type="password"
                        value={backupPinInput}
                        onChange={(e) => setBackupPinInput(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs glass-input focus:outline-none"
                        placeholder="Encrypted with Master PIN if blank"
                      />
                    </div>
                  </div>

                  {backupSuccessMsg && (
                    <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs font-semibold">
                      <CheckCircle size={14} /> {backupSuccessMsg}
                    </div>
                  )}

                  <button
                    onClick={handleExportBackup}
                    className="py-2 px-4 bg-white/5 border border-white/5 hover:bg-white/10 rounded-2xl text-xs font-semibold text-zinc-300 hover:text-white transition-all active:scale-98"
                  >
                    Generate & Download Backup File
                  </button>
                </div>
              </div>

              {/* Restore Block */}
              <div className="border-t border-white/5 pt-5 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                  <Upload size={13} /> Restore Chamber Backup (.lbv)
                </h4>

                <form onSubmit={handleRestoreBackup} className="space-y-4 max-w-md">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                        Select Backup File
                      </label>
                      <input
                        type="file"
                        accept=".lbv"
                        onChange={(e) => setRestoreFile(e.target.files ? e.target.files[0] : null)}
                        className="text-xs text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-semibold file:bg-white/5 file:text-zinc-300 hover:file:bg-white/10 cursor-pointer"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                        Custom Backup PIN (if applicable)
                      </label>
                      <input
                        type="password"
                        value={restorePinInput}
                        onChange={(e) => setRestorePinInput(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs glass-input focus:outline-none"
                      />
                    </div>
                  </div>

                  {restoreMsg && (
                    <p className={`text-xs font-medium px-4 py-2 border rounded-xl ${
                      restoreMsg.error
                        ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                        : 'text-green-500 bg-green-500/10 border-green-500/20'
                    }`}>
                      {restoreMsg.text}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={restoreLoading || !restoreFile}
                    className="py-2 px-4 bg-[#d4af37]/15 border border-[#d4af37]/25 hover:bg-[#d4af37]/20 rounded-2xl text-xs font-semibold text-[#d4af37] transition-all disabled:opacity-50 active:scale-98"
                  >
                    {restoreLoading ? 'Decrypting and Restoring...' : 'Validate and Restore Backup'}
                  </button>
                </form>
              </div>

              {/* Wipe Vault block */}
              <div className="border-t border-rose-900/20 pt-5 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                  <Trash2 size={13} /> Emergency Wipe Chamber
                </h4>

                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-300 flex items-start gap-3">
                  <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="font-bold">Dangerous Action:</p>
                    <p className="mt-1 leading-relaxed">
                      Wiping the database deletes all passwords, notes, attachments, configuration details, and activity logs. Your data cannot be recovered unless you possess an encrypted backup file.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleWipeVault} className="space-y-3.5 max-w-md">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                      Type "ELIMINAR TODO" to authorize wipe
                    </label>
                    <input
                      type="text"
                      value={wipeConfirmInput}
                      onChange={(e) => setWipeConfirmInput(e.target.value)}
                      className="w-full px-3.5 py-1.5 text-xs glass-input focus:outline-none border-rose-500/20"
                      placeholder="ELIMINAR TODO"
                      required
                    />
                  </div>

                  {wipeError && (
                    <p className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-3 py-1.5 border border-rose-500/20 rounded-xl">
                      {wipeError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={wipeConfirmInput !== 'ELIMINAR TODO'}
                    className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 rounded-2xl text-xs font-bold text-white transition-all disabled:opacity-50 active:scale-98"
                  >
                    Wipe Database and Re-initialize App
                  </button>
                </form>
              </div>

            </motion.div>
          )}

          {/* 4. ABOUT SECTION */}
          {activeSec === 'about' && (
            <motion.div
              key="sec-about"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Chamber Metadata & Declarations</h3>
                <p className="text-xs text-zinc-500">Legal structure, license boundaries, and application integrity details.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5 text-xs">
                <div className="space-y-1">
                  <p className="text-zinc-500 uppercase font-semibold text-[9px] tracking-wider">Application Name</p>
                  <p className="text-white font-bold">La Bóveda</p>
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-500 uppercase font-semibold text-[9px] tracking-wider">Tagline</p>
                  <p className="text-white font-bold italic">Trust No Cloud.</p>
                </div>
                <div className="space-y-1 cursor-pointer select-none active:scale-98" onClick={onVersionClick}>
                  <p className="text-zinc-500 uppercase font-semibold text-[9px] tracking-wider">Software Version</p>
                  <p className="text-white font-bold font-mono hover:text-[#d4af37] transition-all">1.0.0 (Premium Release)</p>
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-500 uppercase font-semibold text-[9px] tracking-wider">Developer / Architect</p>
                  <p className="text-white font-bold">Made By Origin Labs</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-zinc-500 uppercase font-semibold text-[9px] tracking-wider">License Boundary</p>
                  <p className="text-zinc-300 leading-relaxed">
                    Proprietary Commercial Offline License. Restricts any cloud serialization or remote replication. Single-Device Vault.
                  </p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-zinc-500 uppercase font-semibold text-[9px] tracking-wider">Chamber Privacy Agreement</p>
                  <p className="text-zinc-300 leading-relaxed">
                    Zero database servers. Zero analytics tags. Zero diagnostic telemetry. All credentials and file assets are stored locally and encrypted under AES-GCM (256-bit) using your derived PBKDF2 Master key. No cloud backdoors.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Biometrics Setup Overlay modal */}
      <AnimatePresence>
        {biometricPromptOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl text-center"
            >
              <div className="p-3 bg-[#d4af37]/15 rounded-full inline-block mb-3">
                <Fingerprint size={24} className="text-[#d4af37]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Verify PIN for Biometrics Setup</h3>
              <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                Confirm your current Master PIN to create a WebAuthn signature wrapper.
              </p>

              <form onSubmit={handleEnrollBiometrics} className="space-y-4">
                <input
                  type="password"
                  pattern="\d*"
                  maxLength={12}
                  value={biometricPin}
                  onChange={(e) => setBiometricPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full tracking-widest text-center text-lg font-bold glass-input px-4 py-2.5 focus:outline-none"
                  placeholder="••••••"
                  required
                  autoFocus
                />

                {biometricMsg && biometricMsg.error && (
                  <p className="text-[11px] text-rose-500 font-semibold bg-rose-500/10 px-3 py-1.5 border border-rose-500/20 rounded-xl">
                    {biometricMsg.text}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBiometricPromptOpen(false);
                      setBiometricPin('');
                    }}
                    className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={biometricLoading}
                    className="flex-1 py-2 px-3 gold-gradient-bg text-zinc-950 rounded-xl text-xs font-bold hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    {biometricLoading ? <RefreshCw className="animate-spin" size={12} /> : null}
                    Confirm PIN
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
