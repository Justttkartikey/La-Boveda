import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Binary,
  Hash,
  RefreshCw,
  Copy,
  Check,
  Code,
  QrCode,
  Cpu,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { useClipboard } from '../../hooks/useClipboard';

export const BlackRoom: React.FC = () => {
  const { copyToClipboard, copiedText } = useClipboard();

  const [activeTool, setActiveTool] = useState<'hasher' | 'base64' | 'checksum' | 'password' | 'json' | 'qr' | 'random'>('hasher');

  // Hasher State
  const [hashInput, setHashInput] = useState('');
  const [hashType, setHashType] = useState<'SHA-256' | 'SHA-512'>('SHA-256');
  const [hashOutput, setHashOutput] = useState('');

  // Base64 State
  const [b64Input, setB64Input] = useState('');
  const [b64Output, setB64Output] = useState('');
  const [b64Mode, setB64Mode] = useState<'encode' | 'decode' | 'url_encode' | 'url_decode'>('encode');

  // File Checksum State
  const [checksumFile, setChecksumFile] = useState<File | null>(null);
  const [checksumOutput, setChecksumOutput] = useState('');
  const [checksumLoading, setChecksumLoading] = useState(false);

  // Password Estimator State
  const [estimatorInput, setEstimatorInput] = useState('');
  const [entropyResult, setEntropyResult] = useState({ entropy: 0, time: '', strength: '' });

  // JSON Formatter State
  const [jsonInput, setJsonInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // QR Code State
  const [qrInput, setQrInput] = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Random Bytes State
  const [randomLength, setRandomLength] = useState(32);
  const [randomFormat, setRandomFormat] = useState<'hex' | 'base64' | 'numbers'>('hex');
  const [randomOutput, setRandomOutput] = useState('');

  // Reset all other inputs/outputs when switching tools in the Black Room
  useEffect(() => {
    if (activeTool !== 'hasher') {
      setHashInput('');
      setHashOutput('');
    }
    if (activeTool !== 'base64') {
      setB64Input('');
      setB64Output('');
    }
    if (activeTool !== 'checksum') {
      setChecksumFile(null);
      setChecksumOutput('');
    }
    if (activeTool !== 'password') {
      setEstimatorInput('');
      setEntropyResult({ entropy: 0, time: 'Instant', strength: 'N/A' });
    }
    if (activeTool !== 'json') {
      setJsonInput('');
      setJsonOutput('');
      setJsonError(null);
    }
    if (activeTool !== 'qr') {
      setQrInput('');
    }
    if (activeTool !== 'random') {
      setRandomOutput('');
    }
  }, [activeTool]);

  // 1. Calculate Hashes
  useEffect(() => {
    const calculateHash = async () => {
      if (!hashInput) {
        setHashOutput('');
        return;
      }
      const encoder = new TextEncoder();
      const data = encoder.encode(hashInput);
      const hashBuffer = await crypto.subtle.digest(hashType, data);
      
      // Convert to hex
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setHashOutput(hashHex);
    };

    calculateHash();
  }, [hashInput, hashType]);

  // 2. Base64 & URL operations
  useEffect(() => {
    if (!b64Input) {
      setB64Output('');
      return;
    }
    try {
      if (b64Mode === 'encode') {
        setB64Output(btoa(b64Input));
      } else if (b64Mode === 'decode') {
        setB64Output(atob(b64Input));
      } else if (b64Mode === 'url_encode') {
        setB64Output(encodeURIComponent(b64Input));
      } else if (b64Mode === 'url_decode') {
        setB64Output(decodeURIComponent(b64Input));
      }
    } catch (e) {
      setB64Output('ERROR: Operation failed. Please check input parameters.');
    }
  }, [b64Input, b64Mode]);

  // 3. Checksum generator (Web Crypto)
  const calculateFileChecksum = async () => {
    if (!checksumFile) return;
    setChecksumLoading(true);
    setChecksumOutput('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target || !e.target.result) return;
      const buffer = e.target.result as ArrayBuffer;

      try {
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        setChecksumOutput(hashHex);
      } catch (err) {
        setChecksumOutput('ERROR: Could not generate hash.');
      } finally {
        setChecksumLoading(false);
      }
    };
    reader.readAsArrayBuffer(checksumFile);
  };

  // 4. Entropy Strength Estimator
  useEffect(() => {
    if (!estimatorInput) {
      setEntropyResult({ entropy: 0, time: 'Instant', strength: 'N/A' });
      return;
    }

    let poolSize = 0;
    if (/[a-z]/.test(estimatorInput)) poolSize += 26;
    if (/[A-Z]/.test(estimatorInput)) poolSize += 26;
    if (/[0-9]/.test(estimatorInput)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(estimatorInput)) poolSize += 32;

    const entropy = Math.round(estimatorInput.length * Math.log2(poolSize));
    
    // Simple crack time estimation
    const guessesPerSec = 10e9; // 10 billion guesses/sec (GPU brute-force benchmark)
    const totalComb = Math.pow(poolSize, estimatorInput.length);
    const timeInSecs = totalComb / (2 * guessesPerSec);

    let time = '';
    if (timeInSecs < 1) time = 'Instant';
    else if (timeInSecs < 60) time = `${Math.round(timeInSecs)} seconds`;
    else if (timeInSecs < 3600) time = `${Math.round(timeInSecs / 60)} minutes`;
    else if (timeInSecs < 86400) time = `${Math.round(timeInSecs / 3600)} hours`;
    else if (timeInSecs < 31536000) time = `${Math.round(timeInSecs / 86400)} days`;
    else if (timeInSecs < 31536000 * 1000) time = `${Math.round(timeInSecs / 31536000)} years`;
    else time = 'Centuries';

    let strength = 'Weak';
    if (entropy >= 80) strength = 'Highly Secure';
    else if (entropy >= 50) strength = 'Moderate';

    setEntropyResult({ entropy, time, strength });
  }, [estimatorInput]);

  // 5. JSON Formatter
  const formatJSON = () => {
    setJsonError(null);
    setJsonOutput('');
    try {
      const obj = JSON.parse(jsonInput);
      setJsonOutput(JSON.stringify(obj, null, 2));
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON syntax.');
    }
  };

  // 6. QR Code Generation
  useEffect(() => {
    if (!qrInput || !qrCanvasRef.current) return;
    try {
      QRCode.toCanvas(
        qrCanvasRef.current,
        qrInput,
        {
          width: 180,
          margin: 1.5,
          color: {
            dark: '#09090b',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('QR generation error:', error);
        }
      );
    } catch (err) {
      console.error('Synchronous QR generation error:', err);
    }
  }, [qrInput, activeTool]);

  // 7. Secure Random Bytes Generator
  const generateRandomBytes = () => {
    const bytes = new Uint8Array(randomLength);
    window.crypto.getRandomValues(bytes);

    if (randomFormat === 'hex') {
      const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      setRandomOutput(hex);
    } else if (randomFormat === 'base64') {
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      setRandomOutput(btoa(binary));
    } else {
      setRandomOutput(Array.from(bytes).join(', '));
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-left font-mono text-zinc-100">
      
      {/* Tools Navigation */}
      <div className="w-full lg:w-56 shrink-0 space-y-1">
        {[
          { id: 'hasher', label: 'Hash Engine', icon: Hash },
          { id: 'base64', label: 'B64 / URL Codec', icon: Binary },
          { id: 'checksum', label: 'File Checksum', icon: FileCheck },
          { id: 'password', label: 'Entropy Checker', icon: Cpu },
          { id: 'json', label: 'JSON Formatter', icon: Code },
          { id: 'qr', label: 'Offline QR Link', icon: QrCode },
          { id: 'random', label: 'Entropy Spawner', icon: RefreshCw },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id as any)}
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

      {/* Tools Content Box */}
      <div className="flex-1 glass-panel border border-white/5 rounded-3xl p-6 min-h-[480px] bg-black/45 relative shadow-[inset_0_0_40px_rgba(0,0,0,0.4)]">
        
        {/* HASHER */}
        {activeTool === 'hasher' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Cryptographic Hash Engine</h3>
              <p className="text-[11px] text-zinc-500">Secure digest calculation running local JS Web Crypto algorithms.</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setHashType('SHA-256')}
                  className={`px-3 py-1.5 text-xs rounded-xl border transition-all ${
                    hashType === 'SHA-256' ? 'border-[#d4af37] bg-[#d4af37]/5 text-[#d4af37]' : 'border-white/5 bg-transparent'
                  }`}
                >
                  SHA-256
                </button>
                <button
                  onClick={() => setHashType('SHA-512')}
                  className={`px-3 py-1.5 text-xs rounded-xl border transition-all ${
                    hashType === 'SHA-512' ? 'border-[#d4af37] bg-[#d4af37]/5 text-[#d4af37]' : 'border-white/5 bg-transparent'
                  }`}
                >
                  SHA-512
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">Input Plaintext</label>
                <textarea
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2.5 text-xs glass-input focus:outline-none resize-none bg-black/40 border-white/5"
                  placeholder="Type or paste payload data here..."
                />
              </div>

              {hashOutput && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>Digest Hex String</span>
                    <button
                      onClick={() => copyToClipboard(hashOutput)}
                      className="text-zinc-400 hover:text-[#d4af37] flex items-center gap-1 transition-all"
                    >
                      {copiedText === hashOutput ? <Check size={11} className="text-green-500" /> : <Copy size={11} />} Copy
                    </button>
                  </div>
                  <div className="p-4 bg-black/60 border border-white/5 text-xs select-text break-all rounded-2xl text-zinc-300 tracking-wider">
                    {hashOutput}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BASE64 / URL */}
        {activeTool === 'base64' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Base64 & URL Translator</h3>
              <p className="text-[11px] text-zinc-500">Standard converters for strings and configurations.</p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'encode', label: 'B64 Encode' },
                  { id: 'decode', label: 'B64 Decode' },
                  { id: 'url_encode', label: 'URL Encode' },
                  { id: 'url_decode', label: 'URL Decode' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setB64Mode(mode.id as any)}
                    className={`px-3 py-1.5 text-xs rounded-xl border transition-all ${
                      b64Mode === mode.id ? 'border-[#d4af37] bg-[#d4af37]/5 text-[#d4af37]' : 'border-white/5 bg-transparent'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">Source Text</label>
                <textarea
                  value={b64Input}
                  onChange={(e) => setB64Input(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2.5 text-xs glass-input focus:outline-none resize-none bg-black/40 border-white/5"
                  placeholder="Type source text..."
                />
              </div>

              {b64Output && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>Result Payload</span>
                    <button
                      onClick={() => copyToClipboard(b64Output)}
                      className="text-zinc-400 hover:text-[#d4af37] flex items-center gap-1 transition-all"
                    >
                      {copiedText === b64Output ? <Check size={11} className="text-green-500" /> : <Copy size={11} />} Copy
                    </button>
                  </div>
                  <div className="p-4 bg-black/60 border border-white/5 text-xs select-text break-all rounded-2xl text-zinc-300 tracking-wider">
                    {b64Output}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FILE CHECKSUM */}
        {activeTool === 'checksum' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Local File Checksum Validator</h3>
              <p className="text-[11px] text-zinc-500">Generates SHA-256 hashes of local files for software integrity confirmation.</p>
            </div>

            <div className="space-y-4">
              <div className="p-6 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3">
                <input
                  type="file"
                  onChange={(e) => setChecksumFile(e.target.files ? e.target.files[0] : null)}
                  className="text-xs text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-semibold file:bg-white/5 file:text-zinc-300 hover:file:bg-white/10 cursor-pointer"
                />
                {checksumFile && (
                  <p className="text-[10px] text-zinc-500">
                    Size: {(checksumFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>

              <button
                onClick={calculateFileChecksum}
                disabled={checksumLoading || !checksumFile}
                className="py-2 px-4 bg-white/5 border border-white/5 hover:bg-white/10 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 active:scale-95 flex items-center gap-2"
              >
                {checksumLoading ? <RefreshCw className="animate-spin" size={12} /> : <FileCheck size={12} />}
                Generate File SHA-256
              </button>

              {checksumOutput && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>Generated File Checksum</span>
                    <button
                      onClick={() => copyToClipboard(checksumOutput)}
                      className="text-zinc-400 hover:text-[#d4af37] flex items-center gap-1 transition-all"
                    >
                      {copiedText === checksumOutput ? <Check size={11} className="text-green-500" /> : <Copy size={11} />} Copy
                    </button>
                  </div>
                  <div className="p-4 bg-black/60 border border-white/5 text-xs select-text break-all rounded-2xl text-zinc-300 tracking-wider">
                    {checksumOutput}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASSWORD ENTROPY CHECKER */}
        {activeTool === 'password' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Password Strength & Entropy Analyzer</h3>
              <p className="text-[11px] text-zinc-500">Real-time bits entropy evaluator using character pool statistics.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">Input Password</label>
                <input
                  type="text"
                  value={estimatorInput}
                  onChange={(e) => setEstimatorInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs glass-input focus:outline-none bg-black/40 border-white/5"
                  placeholder="Type password to evaluate..."
                />
              </div>

              {estimatorInput && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 bg-black/40 border border-white/5 rounded-2xl">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-1">Entropy</p>
                    <p className="text-lg font-bold text-white font-mono">{entropyResult.entropy} bits</p>
                  </div>

                  <div className="p-4 bg-black/40 border border-white/5 rounded-2xl">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-1">Security Rating</p>
                    <p className={`text-lg font-bold ${
                      entropyResult.strength === 'Highly Secure' ? 'text-[#d4af37]' : entropyResult.strength === 'Moderate' ? 'text-amber-400' : 'text-rose-400'
                    }`}>{entropyResult.strength}</p>
                  </div>

                  <div className="p-4 bg-black/40 border border-white/5 rounded-2xl col-span-2 sm:col-span-1">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-1">GPU Crack Time</p>
                    <p className="text-sm font-semibold text-zinc-300 mt-1">{entropyResult.time}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* JSON FORMATTER */}
        {activeTool === 'json' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">JSON Formatter & Validator</h3>
              <p className="text-[11px] text-zinc-500">Format or inspect JSON documents offline.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">Raw JSON Input</label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2.5 text-xs glass-input focus:outline-none resize-none bg-black/40 border-white/5 font-mono"
                  placeholder='{"name": "test", "active": true}'
                />
              </div>

              <button
                onClick={formatJSON}
                disabled={!jsonInput.trim()}
                className="py-2 px-4 bg-white/5 border border-white/5 hover:bg-white/10 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 active:scale-95"
              >
                Format and Validate
              </button>

              {jsonError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">
                  <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                  <span>{jsonError}</span>
                </div>
              )}

              {jsonOutput && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>Formatted Output</span>
                    <button
                      onClick={() => copyToClipboard(jsonOutput)}
                      className="text-zinc-400 hover:text-[#d4af37] flex items-center gap-1 transition-all"
                    >
                      {copiedText === jsonOutput ? <Check size={11} className="text-green-500" /> : <Copy size={11} />} Copy
                    </button>
                  </div>
                  <pre className="p-4 bg-black/60 border border-white/5 text-xs select-text overflow-x-auto rounded-2xl text-zinc-300 tracking-wider font-mono">
                    {jsonOutput}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR GENERATOR */}
        {activeTool === 'qr' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Offline QR Code Linker</h3>
              <p className="text-[11px] text-zinc-500">Transfer passwords or secure notes to mobile devices completely offline.</p>
            </div>

            <div className="space-y-4 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-2">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">QR Payload Text</label>
                  <textarea
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    rows={4}
                    className="w-full px-3.5 py-2.5 text-xs glass-input focus:outline-none resize-none bg-black/40 border-white/5"
                    placeholder="Type link, password or raw string to encode..."
                  />
                </div>
              </div>

              {/* QR Render output */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                <div className="p-4 bg-white rounded-3xl border border-white/10 shadow-2xl flex items-center justify-center min-w-[210px] min-h-[210px]">
                  {qrInput ? (
                    <canvas ref={qrCanvasRef} />
                  ) : (
                    <div className="text-zinc-400 text-xs w-[180px] h-[180px] border border-dashed border-zinc-200 rounded-2xl flex items-center justify-center">
                      Waiting for input...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RANDOM GENERATOR */}
        {activeTool === 'random' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Cryptographic Entropy Spawner</h3>
              <p className="text-[11px] text-zinc-500">Generates high-quality random values via crypto.getRandomValues().</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                    Byte Length
                  </label>
                  <select
                    value={randomLength}
                    onChange={(e) => setRandomLength(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-white/8 rounded-lg text-white focus:outline-none"
                  >
                    <option value="16">16 Bytes (128-bit)</option>
                    <option value="32">32 Bytes (256-bit)</option>
                    <option value="64">64 Bytes (512-bit)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                    Format Representation
                  </label>
                  <select
                    value={randomFormat}
                    onChange={(e) => setRandomFormat(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-white/8 rounded-lg text-white focus:outline-none"
                  >
                    <option value="hex">Hexadecimal</option>
                    <option value="base64">Base64 String</option>
                    <option value="numbers">Comma-separated Ints</option>
                  </select>
                </div>
              </div>

              <button
                onClick={generateRandomBytes}
                className="py-2 px-4 bg-[#d4af37]/15 border border-[#d4af37]/25 hover:bg-[#d4af37]/20 rounded-xl text-xs font-bold text-[#d4af37] transition-all active:scale-95"
              >
                Spawn Random Array
              </button>

              {randomOutput && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>Generated Random Stream</span>
                    <button
                      onClick={() => copyToClipboard(randomOutput)}
                      className="text-zinc-400 hover:text-[#d4af37] flex items-center gap-1 transition-all"
                    >
                      {copiedText === randomOutput ? <Check size={11} className="text-green-500" /> : <Copy size={11} />} Copy
                    </button>
                  </div>
                  <div className="p-4 bg-black/60 border border-white/5 text-xs select-text break-all rounded-2xl text-zinc-300 tracking-wider">
                    {randomOutput}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
