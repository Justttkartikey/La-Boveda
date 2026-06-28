import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { generateRecoveryKey } from '../../services/crypto';
import {
  Shield,
  CheckCircle,
  Copy,
  ArrowRight,
  Eye,
  EyeOff,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SetupWizard: React.FC = () => {
  const { setupVault } = useAuth();
  
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Recovery key generation
  const [recoveryKey, setRecoveryKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmRecoverySave, setConfirmRecoverySave] = useState(false);

  // Gesture choices
  const [gesture, setGesture] = useState('double-tap-temp');
  const [gestureVerified, setGestureVerified] = useState(false);

  // Load recovery key once when step becomes 3
  useEffect(() => {
    if (step === 3 && !recoveryKey) {
      setRecoveryKey(generateRecoveryKey());
    }
  }, [step, recoveryKey]);

  // Step 1 & 2 validation: PIN Setup
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pin.length < 6) {
      setError('The Master PIN must be at least 6 digits.');
      return;
    }
    if (!/^\d+$/.test(pin)) {
      setError('For maximum device compatibility, the Master PIN must contain only numbers.');
      return;
    }
    
    setStep(2); // Go to confirm PIN
  };

  const handleConfirmPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setStep(3); // Go to Recovery Key
  };

  const copyKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Step 4: Confirm Recovery Key Save
  const handleRecoveryNext = () => {
    if (!confirmRecoverySave) {
      setError('You must confirm that you have safely stored the recovery key.');
      return;
    }
    setError(null);
    setStep(4); // Go to gesture setup
  };

  // Step 5: Test gesture details
  const handleGestureNext = () => {
    setStep(5); // Go to gesture test/verification
  };

  // Simulated Weather components for Gesture Verification
  const lastClickRef = React.useRef(0);
  const longPressTimerRef = React.useRef<number | null>(null);

  const handleVerifyGesture = (type: string) => {
    if (type !== gesture) return;

    if (type === 'tap-icon') {
      completeVerification();
    }
  };

  const handleVerifyTempClick = () => {
    if (gesture !== 'double-tap-temp') return;
    const now = Date.now();
    if (now - lastClickRef.current < 350) {
      completeVerification();
    }
    lastClickRef.current = now;
  };

  const handleVerifyCityMouseDown = () => {
    if (gesture !== 'long-press-city') return;
    longPressTimerRef.current = window.setTimeout(() => {
      completeVerification();
    }, 2000);
  };

  const handleVerifyCityMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const completeVerification = () => {
    setGestureVerified(true);
  };

  const handleFinish = async () => {
    if (!gestureVerified) return;
    try {
      // Calculate PIN strength score (Max: 15 pts)
      let score = 0;
      if (pin.length >= 9) score = 15;
      else if (pin.length >= 7) score = 12;
      else if (pin.length >= 6) score = 8;
      
      const isRepeating = /^(\d)\1+$/.test(pin);
      const isSequentialAsc = '0123456789'.includes(pin);
      const isSequentialDesc = '9876543210'.includes(pin);
      
      if (isRepeating || isSequentialAsc || isSequentialDesc) {
        score -= 8;
      }
      
      const alternatePattern = /^(\d{2})\1+$/.test(pin);
      if (alternatePattern) {
        score -= 4;
      }
      
      localStorage.setItem('lbv_pin_score', Math.max(1, Math.min(15, score)).toString());

      await setupVault(pin, recoveryKey, gesture);
    } catch (err) {
      console.error('Onboarding setup failed:', err);
      setError('Encryption setup failed. Try a different browser or clear storage.');
    }
  };

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

  // Framer Motion variants
  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="relative min-h-screen dark-luxury-bg flex items-center justify-center p-6 text-zinc-100 font-sans selection:bg-[#d4af37]/30 selection:text-white">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
        title="Toggle Theme"
      >
        {isLightTheme ? <Moon size={14} /> : <Sun size={14} />}
      </button>

      {/* Brand Watermark background */}
      <div className="absolute top-10 flex flex-col items-center select-none opacity-40">
        <Shield size={36} className="text-[#d4af37] mb-1" />
        <span className="text-xl font-extrabold tracking-wider font-display text-white">LA BÓVEDA</span>
        <span className="text-[9px] tracking-widest text-[#d4af37] uppercase">Trust No Cloud</span>
      </div>

      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-white/5 relative z-10 shadow-2xl overflow-hidden">
        {/* Progress indicator */}
        <div className="flex justify-between items-center gap-1.5 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? 'gold-gradient-bg opacity-100' : 'bg-white/10 opacity-50'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Enter PIN */}
          {step === 1 && (
            <motion.div
              key="step1"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold tracking-tight font-display mb-2 text-white">
                Create Master PIN
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                Your PIN is the primary key used to derive your local encryption. Choose a code that is easy to remember but hard to guess.
              </p>

              <form onSubmit={handlePinSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                    Master PIN (6 digits min)
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      pattern="\d*"
                      maxLength={12}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full tracking-widest text-xl font-semibold glass-input px-4 py-3 pr-12 focus:outline-none text-center"
                      placeholder="••••••"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-xs font-medium text-rose-500 bg-rose-500/10 px-3.5 py-2 border border-rose-500/20 rounded-xl">{error}</p>}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 text-sm font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans tracking-wide hover:brightness-105 active:scale-98 transition-all"
                >
                  Confirm PIN <ArrowRight size={16} />
                </button>
              </form>
            </motion.div>
          )}

          {/* STEP 2: Confirm PIN */}
          {step === 2 && (
            <motion.div
              key="step2"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold tracking-tight font-display mb-2 text-white">
                Verify Master PIN
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                Re-enter your PIN to ensure there are no typos. Your data cannot be decrypted if this PIN is lost.
              </p>

              <form onSubmit={handleConfirmPinSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                    Verify Master PIN
                  </label>
                  <input
                    type="password"
                    pattern="\d*"
                    maxLength={12}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full tracking-widest text-xl font-semibold glass-input px-4 py-3 focus:outline-none text-center"
                    placeholder="••••••"
                    required
                    autoFocus
                  />
                </div>

                {error && <p className="text-xs font-medium text-rose-500 bg-rose-500/10 px-3.5 py-2 border border-rose-500/20 rounded-xl">{error}</p>}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(null); setConfirmPin(''); }}
                    className="flex-1 py-3 px-4 text-xs font-semibold rounded-2xl border border-white/10 text-zinc-300 hover:bg-white/5 active:scale-98 transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans tracking-wide hover:brightness-105 active:scale-98 transition-all"
                  >
                    Confirm <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* STEP 3: Recovery Key */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold tracking-tight font-display mb-2 text-white">
                Recovery Key
              </h2>
              <p className="text-sm text-zinc-400 mb-5">
                This key is your ONLY backdoor. If you exceed 10 failed PIN entries, this key will be required to restore access. Write it down offline.
              </p>

              <div className="space-y-6">
                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl relative group">
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-[#d4af37] mb-2 text-left">
                    Chamber Key (Write offline)
                  </span>
                  <div className="text-lg font-mono text-center tracking-widest py-2 select-text text-white">
                    {recoveryKey}
                  </div>
                  <button
                    onClick={copyKey}
                    className="absolute right-3.5 top-3 text-zinc-500 hover:text-[#d4af37] transition-all"
                    title="Copy Key"
                  >
                    {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-left text-yellow-300/80">
                  <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                  <p className="text-xs leading-relaxed">
                    <strong>Critical Warning:</strong> This key is generated purely in your browser. We never see it. Store it in a physical notebook.
                  </p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer text-left">
                  <input
                    type="checkbox"
                    checked={confirmRecoverySave}
                    onChange={(e) => setConfirmRecoverySave(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                  />
                  <span className="text-xs text-zinc-400 leading-tight">
                    I have copied this Recovery Key and stored it safely offline.
                  </span>
                </label>

                {error && <p className="text-xs font-medium text-rose-500 bg-rose-500/10 px-3.5 py-2 border border-rose-500/20 rounded-xl">{error}</p>}

                <button
                  onClick={handleRecoveryNext}
                  disabled={!confirmRecoverySave}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 text-sm font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans tracking-wide hover:brightness-105 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Setup Entry Gesture <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Choose Entry Gesture */}
          {step === 4 && (
            <motion.div
              key="step4"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold tracking-tight font-display mb-2 text-white">
                Camouflage Gesture
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                Select the secret trigger you will use on the Weather Camouflage screen to unlock the PIN login interface.
              </p>

              <div className="space-y-3 mb-6">
                <div
                  onClick={() => setGesture('double-tap-temp')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    gesture === 'double-tap-temp'
                      ? 'border-[#d4af37] bg-[#d4af37]/5'
                      : 'border-white/5 bg-white/2 hover:bg-white/5'
                  }`}
                >
                  <h3 className="text-sm font-semibold text-white">Double-Tap Temperature</h3>
                  <p className="text-xs text-zinc-400 mt-1">Tap the large forecast temperature widget twice quickly.</p>
                </div>

                <div
                  onClick={() => setGesture('long-press-city')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    gesture === 'long-press-city'
                      ? 'border-[#d4af37] bg-[#d4af37]/5'
                      : 'border-white/5 bg-white/2 hover:bg-white/5'
                  }`}
                >
                  <h3 className="text-sm font-semibold text-white">Long-Press City</h3>
                  <p className="text-xs text-zinc-400 mt-1">Press and hold the City Name header for 2 seconds.</p>
                </div>

                <div
                  onClick={() => setGesture('tap-icon')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    gesture === 'tap-icon'
                      ? 'border-[#d4af37] bg-[#d4af37]/5'
                      : 'border-white/5 bg-white/2 hover:bg-white/5'
                  }`}
                >
                  <h3 className="text-sm font-semibold text-white">Single-Tap Weather Icon</h3>
                  <p className="text-xs text-zinc-400 mt-1">Tap directly on the central animated weather icon.</p>
                </div>
              </div>

              <button
                onClick={handleGestureNext}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 text-sm font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans tracking-wide hover:brightness-105 active:scale-98 transition-all"
              >
                Verify Gesture <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {/* STEP 5: Verify Entry Gesture */}
          {step === 5 && (
            <motion.div
              key="step5"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold tracking-tight font-display mb-1 text-white">
                Test Trigger
              </h2>
              <p className="text-xs text-zinc-400 mb-6">
                Perform your chosen gesture on the preview card below to confirm the configuration.
              </p>

              <div className="mb-6 relative flex flex-col items-center p-5 bg-black/40 border border-white/5 rounded-3xl select-none select-none touch-none">
                <span className="absolute top-2.5 right-3.5 text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                  Preview Widget
                </span>
                
                {/* City name text */}
                <h3
                  onMouseDown={handleVerifyCityMouseDown}
                  onMouseUp={handleVerifyCityMouseUp}
                  onMouseLeave={handleVerifyCityMouseUp}
                  onTouchStart={handleVerifyCityMouseDown}
                  onTouchEnd={handleVerifyCityMouseUp}
                  className="text-2xl font-bold font-display tracking-tight text-white mt-4 select-none cursor-default active:scale-98"
                >
                  Madrid
                </h3>

                {/* Weather icon */}
                <div
                  onClick={() => handleVerifyGesture('tap-icon')}
                  className="my-5 p-3.5 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 active:scale-95 cursor-pointer"
                >
                  <Sun size={40} className="text-yellow-400 animate-spin-slow" />
                </div>

                {/* Temp text */}
                <div
                  onClick={handleVerifyTempClick}
                  className="text-5xl font-extralight font-display tracking-tighter mb-2 cursor-default select-none active:scale-98"
                >
                  24°
                </div>
                <p className="text-xs text-zinc-500">Soleado</p>
              </div>

              {gestureVerified ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-sm font-medium">
                    <CheckCircle size={16} /> Gesture verified successfully!
                  </div>
                  <button
                    onClick={handleFinish}
                    className="w-full py-3 px-5 text-sm font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans tracking-wide hover:brightness-105 active:scale-98 transition-all animate-bounce"
                  >
                    Finish Vault Setup
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-zinc-800/40 rounded-2xl text-center text-xs text-zinc-400">
                  Waiting for gesture: <strong className="text-white font-medium">{gesture === 'double-tap-temp' ? 'Double-tap the Temperature' : gesture === 'long-press-city' ? 'Long-press the City Header' : 'Tap the Weather Icon'}</strong>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
