import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { DbProvider } from './hooks/useDb';
import { useClipboard } from './hooks/useClipboard';
import { WeatherCamouflage } from './components/weather/WeatherCamouflage';
import { SetupWizard } from './components/auth/SetupWizard';
import { PinScreen } from './components/auth/PinScreen';
import { OperationsCenter } from './components/dashboard/OperationsCenter';
import { PasswordVault } from './components/vault/PasswordVault';
import { SecureNotes } from './components/vault/SecureNotes';
import { FileStorage } from './components/vault/FileStorage';
import { PasswordGenerator } from './components/generator/PasswordGenerator';
import { ControlRoom } from './components/controlroom/ControlRoom';
import { BlackRoom } from './components/blackroom/BlackRoom';

import {
  Shield,
  LayoutDashboard,
  Key,
  FileText,
  File,
  Sliders,
  Cpu,
  Lock,
  Zap,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Main App Controller
const AppContent: React.FC = () => {
  const { screen, setScreen, lockVault } = useAuth();
  const { clearClipboard } = useClipboard();

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('lbv_theme') || 'dark';
    if (saved === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    return saved as 'dark' | 'light';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('lbv_theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  // Navigation tab state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hidden dev chamber state (Black Room easter egg)
  const [blackRoomUnlocked, setBlackRoomUnlocked] = useState(false);
  const [settingsClicks, setSettingsClicks] = useState(0);

  // Modals manager for creation
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<'password' | 'note' | 'file' | null>(null);

  const handleOpenCreateModal = (type: 'password' | 'note' | 'file') => {
    setCreateModalType(type);
    setCreateModalOpen(true);
    if (type === 'password') {
      setActiveTab('passwords');
    } else if (type === 'note') {
      setActiveTab('notes');
    } else if (type === 'file') {
      setActiveTab('files');
    }
  };

  // Instant Panic Button action
  const handlePanic = async () => {
    await clearClipboard();
    lockVault();
  };

  // Easter egg trigger: triple click on version in Settings
  const handleSettingsClickTrigger = () => {
    const nextClicks = settingsClicks + 1;
    setSettingsClicks(nextClicks);
    if (nextClicks >= 3) {
      setBlackRoomUnlocked(true);
      setSettingsClicks(0);
      // Automatically switch to Black Room
      setActiveTab('blackroom');
    }
  };

  if (screen === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b] text-white font-sans">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Shield size={40} className="text-[#d4af37]" />
          <span className="text-sm font-bold tracking-widest text-[#d4af37]">VERIFICANDO CÁMARA...</span>
        </div>
      </div>
    );
  }

  if (screen === 'setup') {
    return <SetupWizard />;
  }

  if (screen === 'weather') {
    return <WeatherCamouflage />;
  }

  if (screen === 'pin') {
    return <PinScreen />;
  }

  if (screen === 'blackroom') {
    return (
      <div className="min-h-screen dark-luxury-bg text-zinc-100 flex flex-col font-sans relative select-none">
        <header className="glass-panel border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Cpu size={20} className="text-rose-500 animate-pulse" />
            <span className="text-sm font-extrabold tracking-widest font-display text-white">BLACK ROOM DECK</span>
            <span className="text-[9px] font-semibold text-rose-500 border border-rose-500/20 bg-rose-500/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Offline Cryptotools
            </span>
          </div>
          <button
            onClick={() => setScreen('pin')}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-full text-[10px] font-bold tracking-wide text-zinc-300 transition-all select-none active:scale-95 cursor-pointer"
          >
            Exit Backdoor
          </button>
        </header>
        <main className="flex-1 p-6 overflow-y-auto w-full max-w-7xl mx-auto z-10 relative">
          <BlackRoom />
        </main>
      </div>
    );
  }

  // --- APP DASHBOARD OPERATIONS LAYOUT ---
  return (
    <div className="min-h-screen dark-luxury-bg text-zinc-100 flex flex-col font-sans relative select-none">
      
      {/* Upper Navigation Header */}
      <header className="glass-panel border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}Logo.png`} alt="Logo" className="w-5 h-5 object-contain" />
          <span className="text-sm font-extrabold tracking-widest font-display text-white">LA BÓVEDA</span>
          <span className="hidden sm:inline text-[9px] font-semibold text-[#d4af37] border border-[#d4af37]/20 bg-[#d4af37]/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Trust No Cloud
          </span>
        </div>

        {/* Header Right Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-1.5 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all select-none active:scale-95 cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          
          <button
            onClick={handlePanic}
            className="flex items-center gap-2 py-1.5 px-3 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 rounded-full text-[10px] font-bold tracking-wide text-rose-400 transition-all select-none active:scale-95 shrink-0"
            title="Instant Lock Panic"
          >
            <Zap size={11} className="fill-rose-400/20 animate-pulse" /> Panic
          </button>
          <button
            onClick={handlePanic}
            className="p-1.5 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all select-none active:scale-95 cursor-pointer"
            title="Lock Vault"
          >
            <Lock size={13} />
          </button>
          
          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 bg-white/5 border border-white/5 rounded-full text-zinc-400 hover:text-white"
          >
            {mobileMenuOpen ? <X size={14} /> : <Menu size={14} />}
          </button>
        </div>
      </header>

      {/* Main Core Layout Grid */}
      <div className="flex-1 flex flex-col lg:flex-row relative">
        
        {/* SIDEBAR NAVIGATION (Desktop) */}
        <aside className="hidden lg:flex w-64 border-r border-white/5 p-6 flex-col justify-between shrink-0 bg-black/10 select-none">
          <div className="space-y-6">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Menú Principal</span>
              <div className="space-y-1 mt-2">
                {[
                  { id: 'dashboard', label: 'Operations Center', icon: LayoutDashboard },
                  { id: 'passwords', label: 'Credentials', icon: Key },
                  { id: 'notes', label: 'Secure Notes', icon: FileText },
                  { id: 'files', label: 'Secure Files', icon: File },
                  { id: 'generator', label: 'Entropy Generator', icon: Sliders },
                  { id: 'settings', label: 'Control Room', icon: Sliders }, // Settings
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                      }}
                      className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                        isActive
                          ? 'gold-gradient-bg text-zinc-950 font-bold'
                          : 'text-zinc-400 hover:text-white hover:bg-white/3'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hidden Black Room Tab */}
            {blackRoomUnlocked && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="pt-4 border-t border-rose-900/10"
              >
                <button
                  onClick={() => setActiveTab('blackroom')}
                  className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-xs font-semibold rounded-xl border border-rose-500/20 transition-all ${
                    activeTab === 'blackroom'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-rose-400 bg-rose-500/5 hover:bg-rose-500/10'
                  }`}
                >
                  <Cpu size={14} className="animate-pulse" />
                  <span>Black Room</span>
                </button>
              </motion.div>
            )}
          </div>

          {/* Footer watermark */}
          <div className="flex flex-col gap-1 text-[9px] text-zinc-500 font-mono tracking-widest border-t border-white/5 pt-4">
            <p>LOCK: AES-GCM-256</p>
            <p>STATE: OFFLINE LOCAL</p>
          </div>
        </aside>

        {/* MOBILE SIDEBAR OVERLAY */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="fixed inset-y-0 left-0 w-64 glass-panel border-r border-white/10 z-40 p-6 flex flex-col justify-between lg:hidden pt-20"
            >
              <div className="space-y-6">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Navigation</span>
                  <div className="space-y-1 mt-2">
                    {[
                      { id: 'dashboard', label: 'Operations Center', icon: LayoutDashboard },
                      { id: 'passwords', label: 'Credentials', icon: Key },
                      { id: 'notes', label: 'Secure Notes', icon: FileText },
                      { id: 'files', label: 'Secure Files', icon: File },
                      { id: 'generator', label: 'Entropy Generator', icon: Sliders },
                      { id: 'settings', label: 'Control Room', icon: Sliders },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                            isActive
                              ? 'gold-gradient-bg text-zinc-950 font-bold'
                              : 'text-zinc-400 hover:text-white hover:bg-white/3'
                          }`}
                        >
                          <Icon size={14} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {blackRoomUnlocked && (
                  <div className="pt-4 border-t border-rose-900/10">
                    <button
                      onClick={() => {
                        setActiveTab('blackroom');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-xs font-semibold rounded-xl border border-rose-500/20 transition-all ${
                        activeTab === 'blackroom'
                          ? 'bg-rose-600 text-white font-bold'
                          : 'text-rose-400 bg-rose-500/5 hover:bg-rose-500/10'
                      }`}
                    >
                      <Cpu size={14} className="animate-pulse" />
                      <span>Black Room</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 text-[9px] text-zinc-500 font-mono tracking-widest border-t border-white/5 pt-4">
                <p>LOCK: AES-GCM-256</p>
                <p>STATE: OFFLINE LOCAL</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CORE WORKSPACE CONTENT VIEW */}
        <main className="flex-1 p-6 overflow-y-auto w-full max-w-7xl mx-auto z-10 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'dashboard' && (
                <OperationsCenter
                  setActiveTab={setActiveTab}
                  onOpenCreateModal={handleOpenCreateModal}
                />
              )}

              {activeTab === 'passwords' && (
                <PasswordVault
                  createModalOpen={createModalOpen}
                  setCreateModalOpen={setCreateModalOpen}
                  createModalType={createModalType}
                  setCreateModalType={setCreateModalType}
                />
              )}

              {activeTab === 'notes' && (
                <SecureNotes
                  createModalOpen={createModalOpen}
                  setCreateModalOpen={setCreateModalOpen}
                  createModalType={createModalType}
                  setCreateModalType={setCreateModalType}
                />
              )}

              {activeTab === 'files' && (
                <FileStorage
                  createModalOpen={createModalOpen}
                  setCreateModalOpen={setCreateModalOpen}
                  createModalType={createModalType}
                  setCreateModalType={setCreateModalType}
                />
              )}

              {activeTab === 'generator' && <PasswordGenerator />}

              {activeTab === 'settings' && (
                <ControlRoom onVersionClick={handleSettingsClickTrigger} />
              )}

              {activeTab === 'blackroom' && blackRoomUnlocked && <BlackRoom />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

// Wrap content inside DB & Auth context providers
export default function App() {
  return (
    <AuthProvider>
      <DbProvider>
        <AppContent />
      </DbProvider>
    </AuthProvider>
  );
}
