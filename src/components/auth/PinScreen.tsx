import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Fingerprint, Lock, Key, ArrowRight, AlertTriangle, ArrowLeft, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const PinScreen: React.FC = () => {
  const [isLightTheme, setIsLightTheme] = useState(() => document.documentElement.classList.contains('light'));
  const toggleTheme = () => {
    const nextLight = !isLightTheme;
    setIsLightTheme(nextLight);
    if (nextLight) {
      document.documentElement.classList.add('light');
      localStorage.setItem('lbv_theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('lbv_theme', 'dark');
    }
  };
  const {
    unlockVault,
    unlockWithRecoveryKey,
    incorrectAttempts,
    isLockedOut,
    biometricsSupported,
    hasBiometrics,
    unlockWithBiometrics,
    setScreen,
  } = useAuth();

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Recovery key inputs
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Automatically trigger biometrics if enabled and supported on load
  useEffect(() => {
    if (biometricsSupported && hasBiometrics && !isLockedOut) {
      setTimeout(() => {
        handleBiometricUnlock();
      }, 500);
    }
  }, [biometricsSupported, hasBiometrics, isLockedOut]);

  // Keep track of typed characters for the backdoor trigger
  const pressedKeysRef = useRef<string>('');

  // Listen to physical keyboard events
  useEffect(() => {
    if (isLockedOut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;

      // Track alphabetical keystrokes for secret passphrase trigger
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        pressedKeysRef.current = (pressedKeysRef.current + e.key).toUpperCase();
        if (pressedKeysRef.current.length > 20) {
          pressedKeysRef.current = pressedKeysRef.current.slice(-20);
        }

        if (pressedKeysRef.current.endsWith('BLACKROOM') || pressedKeysRef.current.endsWith('CHAMBER')) {
          pressedKeysRef.current = '';
          setScreen('blackroom');
          return;
        }
      }

      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 12) {
          setPin((prev) => prev + e.key);
          setError(null);
        }
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (pin.length >= 6) {
          handlePinSubmit();
        }
      } else if (e.key === 'Escape') {
        // Go back to weather screen instantly
        setScreen('weather');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isLockedOut, loading, setScreen]);

  // Automatically submit PIN when length reaches 6 (optional, let's submit on enter or when it fits)
  // Let's allow users to submit manually or let it process if they type a standard length.
  // Actually, some users might have 8 or 10 digit PINs, so manual submit via keypad or keyboard is safer,
  // but if they hit 6, let's not force auto-submit in case they have a longer PIN. Manual enter is always standard for security.

  const handleKeypadPress = (num: string) => {
    if (pin.length < 12) {
      setPin((prev) => prev + num);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handlePinSubmit = async () => {
    if (pin.length < 6) {
      setError('PIN must be at least 6 digits.');
      return;
    }

    setLoading(true);
    setError(null);
    
    // Slight artificial delay to prevent timing analysis and look premium
    setTimeout(async () => {
      try {
        const success = await unlockVault(pin);
        if (!success) {
          setError(`Incorrect PIN. ${10 - (incorrectAttempts + 1)} attempts remaining before lockdown.`);
          setPin('');
        }
      } catch (err) {
        setError('Decryption failed. Please try again.');
        setPin('');
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const handleBiometricUnlock = async () => {
    try {
      const success = await unlockWithBiometrics();
      if (!success) {
        setError('Biometric authentication failed.');
      }
    } catch (e) {
      console.warn('WebAuthn prompt error:', e);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setRecoveryError(null);

    setTimeout(async () => {
      const temporaryPin = await unlockWithRecoveryKey(recoveryInput.trim());
      if (temporaryPin) {
        // Success! Screen is moved to app.
        // We will trigger a settings dialogue later to change PIN.
      } else {
        setRecoveryError('Invalid Recovery Key. Please check the spelling.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="relative min-h-screen dark-luxury-bg flex items-center justify-center p-6 text-zinc-100 font-sans selection:bg-[#d4af37]/30 selection:text-white">
      {/* Panic Button like exit */}
      {!isLockedOut && (
        <button
          onClick={() => setScreen('weather')}
          className="absolute top-6 left-6 flex items-center gap-2 py-2 px-3 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 text-xs font-semibold tracking-wide text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Weather
        </button>
      )}

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
        title="Toggle Theme"
      >
        {isLightTheme ? <Moon size={14} /> : <Sun size={14} />}
      </button>

      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-white/5 shadow-2xl relative">
        <AnimatePresence mode="wait">
          {!isLockedOut ? (
            <motion.div
              key="keypad-flow"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              <div className="p-4 bg-[#d4af37]/10 rounded-full mb-4">
                <Lock size={28} className="text-[#d4af37]" />
              </div>
              <h2 className="text-xl font-bold tracking-tight font-display mb-1 text-white">
                Enter Master PIN
              </h2>
              <p className="text-xs text-zinc-500 mb-6 uppercase tracking-wider">
                La Bóveda is Locked
              </p>

              {/* PIN Indicator dots */}
              <div className="flex gap-4 mb-6">
                {[...Array(Math.max(6, pin.length))].map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                      idx < pin.length
                        ? 'gold-gradient-bg border-transparent scale-110 shadow-[0_0_8px_rgba(212,175,55,0.4)]'
                        : 'border-white/20 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {error && (
                <p className="text-xs text-center font-medium text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2 mb-6 w-full">
                  {error}
                </p>
              )}

              {/* 3x4 Keypad Grid */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mb-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeypadPress(num)}
                    disabled={loading}
                    className="w-16 h-16 rounded-full glass-panel border border-white/5 hover:border-white/10 active:scale-95 text-lg font-semibold flex items-center justify-center transition-all focus:outline-none"
                  >
                    {num}
                  </button>
                ))}
                
                {/* Clear Button */}
                <button
                  onClick={handleClear}
                  disabled={loading}
                  className="w-16 h-16 rounded-full text-xs font-semibold text-zinc-500 hover:text-zinc-300 active:scale-95 flex items-center justify-center transition-all focus:outline-none"
                >
                  Clear
                </button>

                {/* 0 Button */}
                <button
                  onClick={() => handleKeypadPress('0')}
                  disabled={loading}
                  className="w-16 h-16 rounded-full glass-panel border border-white/5 hover:border-white/10 active:scale-95 text-lg font-semibold flex items-center justify-center transition-all focus:outline-none"
                >
                  0
                </button>

                {/* Backspace Button */}
                <button
                  onClick={handleBackspace}
                  disabled={loading}
                  className="w-16 h-16 rounded-full text-xs font-semibold text-zinc-500 hover:text-zinc-300 active:scale-95 flex items-center justify-center transition-all focus:outline-none"
                >
                  Delete
                </button>
              </div>

              {/* Submit / WebAuthn Biometric Row */}
              <div className="w-full flex gap-3">
                {biometricsSupported && hasBiometrics && (
                  <button
                    onClick={handleBiometricUnlock}
                    disabled={loading}
                    className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 text-[#d4af37] transition-all flex items-center justify-center active:scale-95"
                    title="Fingerprint Login"
                  >
                    <Fingerprint size={22} />
                  </button>
                )}
                
                <button
                  onClick={handlePinSubmit}
                  disabled={pin.length < 6 || loading}
                  className="flex-1 py-3 px-5 text-sm font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans tracking-wide hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Decrypting...' : 'Unlock Vault'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="lockout-flow"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              <div className="p-4 bg-rose-500/10 rounded-full mb-4">
                <AlertTriangle size={28} className="text-rose-500" />
              </div>
              <h2 className="text-xl font-bold tracking-tight font-display mb-1 text-white text-center">
                Security Lockdown
              </h2>
              <p className="text-xs text-rose-400 font-semibold mb-4 uppercase tracking-widest text-center">
                10 Incorrect Attempts Reached
              </p>
              
              <p className="text-xs text-zinc-400 text-center leading-relaxed mb-6">
                For security, your database access is restricted. Enter your 24-character Recovery Key below to bypass and reset access.
              </p>

              <form onSubmit={handleRecoverySubmit} className="space-y-4 w-full text-left">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    Enter Recovery Key (LBVD-XXXX-...)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={recoveryInput}
                      onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                      className="w-full tracking-wider text-sm font-mono glass-input px-4 py-3 pr-10 focus:outline-none"
                      placeholder="LBVD-XXXX-XXXX-XXXX-XXXX"
                      required
                      autoFocus
                      disabled={loading}
                    />
                    <Key size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  </div>
                </div>

                {recoveryError && (
                  <p className="text-xs font-medium text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2 mb-2 w-full text-center">
                    {recoveryError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !recoveryInput.trim()}
                  className="w-full py-3 px-5 text-sm font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans tracking-wide hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Decrypting Key...' : 'Validate and Unlock'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
