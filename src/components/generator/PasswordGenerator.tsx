import React, { useState, useEffect } from 'react';
import { useDb } from '../../hooks/useDb';
import { useClipboard } from '../../hooks/useClipboard';
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Shield,
  Layers,
  Fingerprint,
  Trash2,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';

const WORD_LIST = [
  'apple', 'river', 'stone', 'cloud', 'ocean', 'forest', 'mountain', 'breeze', 'shadow', 'flame',
  'silver', 'bronze', 'copper', 'beacon', 'canyon', 'desert', 'glacier', 'valley', 'meadow', 'geyser',
  'winter', 'spring', 'summer', 'autumn', 'aurora', 'eclipse', 'nebula', 'galaxy', 'planet', 'meteor',
  'timber', 'whisper', 'legend', 'canvas', 'fossil', 'marble', 'granite', 'crystal', 'quartz', 'amber',
  'phoenix', 'falcon', 'griffin', 'panther', 'jaguar', 'leopard', 'cheetah', 'badger', 'otter', 'beaver',
  'castle', 'temple', 'palace', 'bridge', 'tower', 'tunnel', 'harbor', 'cottage', 'cabin', 'villa',
  'ancient', 'silent', 'golden', 'frozen', 'hollow', 'rugged', 'gentle', 'candid', 'daring', 'noble',
  'bright', 'vibrant', 'mellow', 'cosmic', 'stately', 'shadowy', 'fiery', 'frosty', 'stormy', 'breezy',
  'voyage', 'journey', 'flight', 'safari', 'crusade', 'odyssey', 'venture', 'quest', 'path', 'trail',
  'anchor', 'compass', 'rudder', 'beacon', 'helmet', 'shield', 'armor', 'lantern', 'candle', 'torch'
];

export const PasswordGenerator: React.FC = () => {
  const { items, addLogEntry, addGeneratedPassword, deleteVaultItem } = useDb();
  const { copyToClipboard, copiedText } = useClipboard();

  const [showHistoryMap, setShowHistoryMap] = useState<Record<string, boolean>>({});
  const toggleShowHistory = (id: string) => {
    setShowHistoryMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const historyList = items
    .filter((i) => i.type === 'generated_password')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const handleClearHistory = async () => {
    const ids = historyList.map((item) => item.id);
    for (const id of ids) {
      await deleteVaultItem(id);
    }
    await addLogEntry('Generated Passwords', 'Cleared generated passwords history.');
  };

  const [activeGen, setActiveGen] = useState<'password' | 'pin' | 'passphrase' | 'recovery'>('password');
  const [result, setResult] = useState('');
  
  // Password Config
  const [pwLength, setPwLength] = useState(16);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeLower, setIncludeLower] = useState(true);
  const [includeDigits, setIncludeDigits] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);

  // PIN Config
  const [pinLength, setPinLength] = useState(6);

  // Passphrase Config
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState('-');
  const [capitalize, setCapitalize] = useState(true);

  // Recovery Code Config
  const [recoveryChunks, setRecoveryChunks] = useState(4);

  // Generate on parameters change
  useEffect(() => {
    generate();
  }, [
    activeGen,
    pwLength,
    includeUpper,
    includeLower,
    includeDigits,
    includeSymbols,
    pinLength,
    wordCount,
    separator,
    capitalize,
    recoveryChunks,
  ]);

  const generate = () => {
    switch (activeGen) {
      case 'password':
        generatePassword();
        break;
      case 'pin':
        generatePin();
        break;
      case 'passphrase':
        generatePassphrase();
        break;
      case 'recovery':
        generateRecoveryCode();
        break;
    }
  };

  const generatePassword = () => {
    let charset = '';
    if (includeUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLower) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeDigits) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+~`|}{[]:;?><,./-';

    if (!charset) {
      setResult('');
      return;
    }

    const randomValues = new Uint32Array(pwLength);
    window.crypto.getRandomValues(randomValues);

    let generated = '';
    for (let i = 0; i < pwLength; i++) {
      generated += charset[randomValues[i] % charset.length];
    }
    setResult(generated);
  };

  const generatePin = () => {
    const randomValues = new Uint32Array(pinLength);
    window.crypto.getRandomValues(randomValues);

    let generated = '';
    for (let i = 0; i < pinLength; i++) {
      generated += (randomValues[i] % 10).toString();
    }
    setResult(generated);
  };

  const generatePassphrase = () => {
    const randomValues = new Uint32Array(wordCount);
    window.crypto.getRandomValues(randomValues);

    const words = [];
    for (let i = 0; i < wordCount; i++) {
      let word = WORD_LIST[randomValues[i] % WORD_LIST.length];
      if (capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
      words.push(word);
    }
    setResult(words.join(separator));
  };

  const generateRecoveryCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const chunkSize = 4;
    const totalChars = recoveryChunks * chunkSize;
    const randomValues = new Uint32Array(totalChars);
    window.crypto.getRandomValues(randomValues);

    let generated = '';
    for (let i = 0; i < totalChars; i++) {
      if (i > 0 && i % chunkSize === 0) {
        generated += '-';
      }
      generated += chars[randomValues[i] % chars.length];
    }
    setResult(generated);
  };

  // Estimate entropy/strength of passwords
  const getStrengthPercent = () => {
    if (!result) return 0;
    if (activeGen === 'pin') {
      return Math.min(100, Math.round((pinLength / 12) * 100));
    }
    if (activeGen === 'passphrase') {
      return Math.min(100, Math.round((wordCount / 8) * 100));
    }
    if (activeGen === 'recovery') {
      return 95;
    }
    
    // Password entropy calculation
    let poolSize = 0;
    if (includeUpper) poolSize += 26;
    if (includeLower) poolSize += 26;
    if (includeDigits) poolSize += 10;
    if (includeSymbols) poolSize += 32;

    if (poolSize === 0) return 0;

    const entropy = result.length * Math.log2(poolSize);
    return Math.min(100, Math.round((entropy / 120) * 100));
  };

  const getStrengthLabel = (pct: number) => {
    if (pct >= 80) return 'Highly Secure';
    if (pct >= 55) return 'Moderate';
    return 'Weak / Redundant';
  };

  const getStrengthColor = (pct: number) => {
    if (pct >= 80) return 'bg-[#d4af37]';
    if (pct >= 55) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const handleCopy = async () => {
    if (!result) return;
    // Copy and trigger 30s auto-clear
    await copyToClipboard(result, 30);
    // Add to IndexedDB history
    await addGeneratedPassword(result, activeGen);
    // Add log entry
    await addLogEntry('Generated Passwords', `Generated and copied a secure ${activeGen}.`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left">
      
      {/* Output Panel */}
      <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#d4af37] bg-[#d4af37]/10 px-2.5 py-1 border border-[#d4af37]/20 rounded-full inline-block">
          Output Stream
        </span>

        <div className="flex gap-3 items-center">
          <div className="flex-1 bg-black/40 border border-white/5 px-5 py-4.5 rounded-2xl relative select-text select-text overflow-x-auto min-h-[56px] flex items-center font-mono text-sm tracking-wider text-white">
            {result || 'Choose settings to generate...'}
          </div>

          <button
            onClick={generate}
            className="p-3 bg-white/3 border border-white/5 hover:bg-white/5 rounded-2xl text-zinc-400 hover:text-white transition-all active:scale-95 shrink-0"
            title="Regenerate"
          >
            <RefreshCw size={18} />
          </button>

          <button
            onClick={handleCopy}
            disabled={!result}
            className="p-3 bg-[#d4af37]/15 border border-[#d4af37]/25 hover:bg-[#d4af37]/20 rounded-2xl text-[#d4af37] transition-all flex items-center justify-center active:scale-95 disabled:opacity-50 shrink-0"
            title="Copy and Register to Log"
          >
            {copiedText === result ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>

        {/* Strength Meter */}
        {result && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-zinc-500">
              <span>Entropy Rating</span>
              <span className={getStrengthPercent() >= 80 ? 'text-[#d4af37]' : getStrengthPercent() >= 55 ? 'text-amber-400' : 'text-rose-400'}>
                {getStrengthLabel(getStrengthPercent())} ({getStrengthPercent()}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getStrengthColor(getStrengthPercent())}`}
                style={{ width: `${getStrengthPercent()}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs Selection */}
      <div className="flex border-b border-white/5">
        {[
          { id: 'password', label: 'Password', icon: Key },
          { id: 'pin', label: 'Secure PIN', icon: Fingerprint },
          { id: 'passphrase', label: 'Passphrase', icon: Layers },
          { id: 'recovery', label: 'Recovery Key', icon: Shield },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeGen === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveGen(t.id as any)}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                isActive
                  ? 'border-[#d4af37] text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Configurations panel */}
      <div className="glass-panel p-6 rounded-3xl border border-white/5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
          <Sliders size={12} /> Generator Parameters
        </h3>

        <div className="space-y-6">
          {/* PASSWORD GEN */}
          {activeGen === 'password' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-2">
                  <span>Symmetric Length</span>
                  <span className="text-[#d4af37] font-mono">{pwLength} characters</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={64}
                  value={pwLength}
                  onChange={(e) => setPwLength(Number(e.target.value))}
                  className="w-full accent-[#d4af37] bg-white/5 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeUpper}
                    onChange={(e) => setIncludeUpper(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                  />
                  <span className="text-xs text-zinc-400">Uppercase (A-Z)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeLower}
                    onChange={(e) => setIncludeLower(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                  />
                  <span className="text-xs text-zinc-400">Lowercase (a-z)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeDigits}
                    onChange={(e) => setIncludeDigits(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                  />
                  <span className="text-xs text-zinc-400">Numbers (0-9)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeSymbols}
                    onChange={(e) => setIncludeSymbols(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                  />
                  <span className="text-xs text-zinc-400">Symbols (!@#$%)</span>
                </label>
              </div>
            </div>
          )}

          {/* PIN GEN */}
          {activeGen === 'pin' && (
            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-2">
                <span>Numeric Digit Size</span>
                <span className="text-[#d4af37] font-mono">{pinLength} digits</span>
              </div>
              <input
                type="range"
                min={4}
                max={16}
                value={pinLength}
                onChange={(e) => setPinLength(Number(e.target.value))}
                className="w-full accent-[#d4af37] bg-white/5 rounded-lg appearance-none h-1 cursor-pointer"
              />
            </div>
          )}

          {/* PASSPHRASE GEN */}
          {activeGen === 'passphrase' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-2">
                  <span>Number of Words</span>
                  <span className="text-[#d4af37] font-mono">{wordCount} words</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="w-full accent-[#d4af37] bg-white/5 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                    Word Separator
                  </label>
                  <select
                    value={separator}
                    onChange={(e) => setSeparator(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#d4af37]/40"
                  >
                    <option value="-">Hyphen (-)</option>
                    <option value=".">Dot (.)</option>
                    <option value="_">Underline (_)</option>
                    <option value=" ">Space ( )</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-3 cursor-pointer select-none pb-2">
                    <input
                      type="checkbox"
                      checked={capitalize}
                      onChange={(e) => setCapitalize(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                    />
                    <span className="text-xs text-zinc-400">Capitalize words</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* RECOVERY GEN */}
          {activeGen === 'recovery' && (
            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-2">
                <span>Recovery Segments (4-chars each)</span>
                <span className="text-[#d4af37] font-mono">{recoveryChunks} chunks</span>
              </div>
              <input
                type="range"
                min={4}
                max={8}
                value={recoveryChunks}
                onChange={(e) => setRecoveryChunks(Number(e.target.value))}
                className="w-full accent-[#d4af37] bg-white/5 rounded-lg appearance-none h-1 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {/* History Feed panel */}
      {historyList.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Clock size={12} /> Generation History
            </h3>
            <button
              onClick={handleClearHistory}
              className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-all flex items-center gap-1 py-1 px-2.5 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-full cursor-pointer"
            >
              Clear History
            </button>
          </div>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {historyList.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-black/30 border border-white/5 rounded-2xl text-xs font-mono gap-4 hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37] bg-[#d4af37]/5 px-2 py-0.5 border border-[#d4af37]/10 rounded-md shrink-0">
                    {item.genType === 'recovery' ? 'KEY' : item.genType}
                  </span>
                  <span className="text-zinc-300 truncate">
                    {showHistoryMap[item.id] ? item.passwordStr : '••••••••••••••••'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleShowHistory(item.id)}
                    className="text-zinc-500 hover:text-zinc-300 transition-all p-1 cursor-pointer"
                    title="Toggle Visibility"
                  >
                    {showHistoryMap[item.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(item.passwordStr, 30)}
                    className="text-zinc-500 hover:text-[#d4af37] transition-all p-1 cursor-pointer"
                    title="Copy Password"
                  >
                    {copiedText === item.passwordStr ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  </button>
                  <button
                    onClick={() => deleteVaultItem(item.id)}
                    className="text-zinc-500 hover:text-rose-400 transition-all p-1 cursor-pointer"
                    title="Delete Entry"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
