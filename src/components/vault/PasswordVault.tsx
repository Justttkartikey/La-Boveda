import React, { useState } from 'react';
import { useDb } from '../../hooks/useDb';
import type { DecryptedItem } from '../../hooks/useDb';
import { useClipboard } from '../../hooks/useClipboard';
import {
  Search,
  Star,
  Copy,
  ExternalLink,
  Edit2,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PasswordVaultProps {
  createModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  createModalType: 'password' | 'note' | 'file' | null;
  setCreateModalType: (type: 'password' | 'note' | 'file' | null) => void;
}

export const PasswordVault: React.FC<PasswordVaultProps> = ({
  createModalOpen,
  setCreateModalOpen,
  createModalType,
  setCreateModalType,
}) => {
  const { items, addPassword, updatePassword, deleteVaultItem, toggleFavorite } = useDb();
  const { copyToClipboard, copiedText } = useClipboard();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState('All');

  // Edit / Details panel state
  const [selectedItem, setSelectedItem] = useState<DecryptedItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Form states for creating/editing
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [passwordStr, setPasswordStr] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Login');
  const [tagsInput, setTagsInput] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = ['All', 'Login', 'Finance', 'Social', 'Work', 'Other'];

  // Handle open create modal
  React.useEffect(() => {
    if (createModalOpen && createModalType === 'password') {
      resetForm();
      setIsEditing(false);
      setSelectedItem(null);
    }
  }, [createModalOpen, createModalType]);

  const resetForm = () => {
    setTitle('');
    setUsername('');
    setPasswordStr('');
    setUrl('');
    setNotes('');
    setCategory('Login');
    setTagsInput('');
    setFavorite(false);
    setError(null);
  };

  const handleEditClick = (item: Extract<DecryptedItem, { type: 'password' }>) => {
    setSelectedItem(item);
    setTitle(item.title);
    setUsername(item.username);
    setPasswordStr(item.passwordStr);
    setUrl(item.url);
    setNotes(item.notes);
    setCategory(item.category);
    setTagsInput(item.tags.join(', '));
    setFavorite(item.favorite);
    setIsEditing(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !passwordStr.trim()) {
      setError('Title and Password fields are required.');
      return;
    }

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload = {
      type: 'password' as const,
      title,
      username,
      passwordStr,
      url,
      notes,
      category,
      tags: parsedTags,
      favorite,
    };

    try {
      if (isEditing && selectedItem) {
        await updatePassword(selectedItem.id, payload);
        setIsEditing(false);
        setSelectedItem(null);
      } else {
        await addPassword(payload);
        setCreateModalOpen(false);
        setCreateModalType(null);
      }
      resetForm();
    } catch (err) {
      setError('Failed to save password item.');
    }
  };

  // Filter logic
  const passwordItems = items.filter((i) => i.type === 'password') as Extract<
    DecryptedItem,
    { type: 'password' }
  >[];

  // Extract all unique tags
  const allTags = ['All', ...new Set(passwordItems.flatMap((i) => i.tags))];

  const filteredItems = passwordItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.username.toLowerCase().includes(search.toLowerCase()) ||
      item.url.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesTag = selectedTag === 'All' || item.tags.includes(selectedTag);
    return matchesSearch && matchesCategory && matchesTag;
  });

  const toggleShowPassword = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Generate strong password inside form
  const handleGenerateInForm = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-';
    const len = 16;
    const array = new Uint32Array(len);
    window.crypto.getRandomValues(array);
    let generated = '';
    for (let i = 0; i < len; i++) {
      generated += chars[array[i] % chars.length];
    }
    setPasswordStr(generated);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-left min-h-[500px]">
      {/* Sidebar Filters */}
      <div className="w-full lg:w-56 shrink-0 space-y-5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2.5">Categorías</h3>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  selectedCategory === cat
                    ? 'gold-gradient-bg text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/3'
                }`}
              >
                <span>{cat === 'All' ? 'Todas' : cat}</span>
                {cat === 'All' ? null : (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    selectedCategory === cat ? 'bg-zinc-950/20 text-zinc-950' : 'bg-white/5 text-zinc-500'
                  }`}>
                    {passwordItems.filter((i) => i.category === cat).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2.5">Etiquetas</h3>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-all ${
                  selectedTag === tag
                    ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]'
                    : 'border-white/5 bg-white/2 text-zinc-400 hover:text-white hover:border-white/10'
                }`}
              >
                {tag === 'All' ? 'Todas' : `#${tag}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 space-y-4">
        {/* Search header */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search Title, Username or Website URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-white/2 border border-white/5 rounded-2xl focus:outline-none focus:border-white/10 transition-all placeholder-zinc-500 text-white"
            />
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>

          <button
            onClick={() => {
              resetForm();
              setIsEditing(false);
              setSelectedItem(null);
              setCreateModalType('password');
              setCreateModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-2xl gold-gradient-bg text-zinc-950 hover:brightness-105 active:scale-98 transition-all shrink-0"
          >
            <Plus size={14} /> Add Password
          </button>
        </div>

        {/* Password Cards list */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/10 transition-all"
              >
                {/* Information Area */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-bold text-white tracking-wide truncate">{item.title}</span>
                    <button
                      onClick={() => toggleFavorite(item.id)}
                      className="text-zinc-500 hover:text-amber-400 transition-all"
                    >
                      <Star
                        size={12}
                        className={item.favorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'}
                      />
                    </button>
                    <span className="text-[10px] font-bold uppercase bg-white/5 text-zinc-400 px-2 py-0.5 rounded-md border border-white/5">
                      {item.category}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-zinc-600 font-medium">Username:</span>
                      <span className="truncate text-zinc-300 font-mono">{item.username || 'None'}</span>
                      {item.username && (
                        <button
                          onClick={() => copyToClipboard(item.username)}
                          className="text-zinc-600 hover:text-[#d4af37] transition-all ml-0.5"
                          title="Copy Username"
                        >
                          {copiedText === item.username ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-600 font-medium">Password:</span>
                      <span className="font-mono text-zinc-300">
                        {showPasswordMap[item.id] ? item.passwordStr : '••••••••'}
                      </span>
                      <button
                        onClick={() => toggleShowPassword(item.id)}
                        className="text-zinc-600 hover:text-zinc-400 transition-all"
                      >
                        {showPasswordMap[item.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(item.passwordStr)}
                        className="text-zinc-600 hover:text-[#d4af37] transition-all"
                        title="Copy Password"
                      >
                        {copiedText === item.passwordStr ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Badges and Actions */}
                <div className="flex items-center justify-end gap-3 shrink-0 border-t border-white/5 sm:border-0 pt-3 sm:pt-0">
                  {/* Tag Badges */}
                  <div className="hidden md:flex items-center gap-1">
                    {item.tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-[9px] bg-white/2 border border-white/5 rounded-md px-1.5 py-0.5 text-zinc-500 font-mono">
                        #{t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.url && (
                      <a
                        href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-white/3 border border-white/5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                        title="Open Website"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <button
                      onClick={() => handleEditClick(item)}
                      className="p-1.5 bg-white/3 border border-white/5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                      title="Edit Item"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => deleteVaultItem(item.id)}
                      className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
                      title="Secure Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-zinc-500 text-xs">
              No matching credentials found in this chamber.
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal Overlay */}
      <AnimatePresence>
        {(createModalOpen && createModalType === 'password') || isEditing ? (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-lg font-bold font-display text-white mb-1.5">
                {isEditing ? 'Modify Vault Record' : 'Add Secure Credential'}
              </h2>
              <p className="text-[11px] text-zinc-500 mb-6">
                All information is locally encrypted before IndexedDB storage.
              </p>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                      Record Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs glass-input focus:outline-none"
                      placeholder="e.g. GitHub Account"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                      Vault Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#d4af37]/40"
                    >
                      <option value="Login">Login</option>
                      <option value="Finance">Finance</option>
                      <option value="Social">Social</option>
                      <option value="Work">Work</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                      Username / Email
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs glass-input focus:outline-none"
                      placeholder="e.g. user@gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordMap['form'] ? 'text' : 'password'}
                        value={passwordStr}
                        onChange={(e) => setPasswordStr(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs glass-input pr-20 focus:outline-none"
                        placeholder="••••••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword('form')}
                        className="absolute right-10 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPasswordMap['form'] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateInForm}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#d4af37] font-semibold text-[10px] uppercase tracking-wider"
                        title="Generate Password"
                      >
                        GEN
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs glass-input focus:outline-none"
                    placeholder="e.g. github.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                    Etiquetas (Separadas por comas)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs glass-input focus:outline-none"
                    placeholder="e.g. developer, server, internal"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                    Chamber Notes (Encrypted)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2 text-xs glass-input focus:outline-none resize-none"
                    placeholder="Secret questions, recovery tokens, custom parameters..."
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={favorite}
                      onChange={(e) => setFavorite(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                    />
                    <span className="text-zinc-400">Add to Favorites</span>
                  </label>
                </div>

                {error && (
                  <p className="text-xs font-medium text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl text-center">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateModalOpen(false);
                      setCreateModalType(null);
                      setIsEditing(false);
                      setSelectedItem(null);
                    }}
                    className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-2xl border border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white transition-all focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans tracking-wide hover:brightness-105 active:scale-98 transition-all focus:outline-none"
                  >
                    {isEditing ? 'Save Changes' : 'Store Credential'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
