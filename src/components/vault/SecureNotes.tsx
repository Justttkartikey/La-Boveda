import React, { useState } from 'react';
import { useDb } from '../../hooks/useDb';
import type { DecryptedItem } from '../../hooks/useDb';
import { useAuth } from '../../hooks/useAuth';
import { decryptText, deriveKeyFromPin, base64ToArrayBuffer } from '../../services/crypto';
import { dbService } from '../../services/db';
import {
  Search,
  Star,
  Plus,
  FileText,
  Lock,
  Unlock,
  Trash2,
  Edit2,
  Paperclip,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SecureNotesProps {
  createModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  createModalType: 'password' | 'note' | 'file' | null;
  setCreateModalType: (type: 'password' | 'note' | 'file' | null) => void;
}

export const SecureNotes: React.FC<SecureNotesProps> = ({
  createModalOpen,
  setCreateModalOpen,
  createModalType,
  setCreateModalType,
}) => {
  const { items, addNote, updateNote, deleteVaultItem, toggleFavorite, decryptFileAttachment } = useDb();
  useAuth(); // context consumed for DB provider chain

  // Search/Filters
  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<DecryptedItem | null>(null);
  
  // Note details & authorization
  const [authorizedNoteId, setAuthorizedNoteId] = useState<string | null>(null);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [promptNote, setPromptNote] = useState<DecryptedItem | null>(null);
  const [reentryPin, setReentryPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinRequired, setPinRequired] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [category, setCategory] = useState('Personal');
  const [tagsInput, setTagsInput] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notesList = items.filter((i) => i.type === 'note') as Extract<DecryptedItem, { type: 'note' }>[];
  const fileAttachments = items.filter((i) => i.type === 'file') as Extract<DecryptedItem, { type: 'file' }>[];

  // Open modal handler
  React.useEffect(() => {
    if (createModalOpen && createModalType === 'note') {
      resetForm();
      setIsEditing(false);
      setSelectedNote(null);
    }
  }, [createModalOpen, createModalType]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setPinRequired(false);
    setSelectedAttachments([]);
    setCategory('Personal');
    setTagsInput('');
    setFavorite(false);
    setError(null);
  };

  const handleEditClick = (note: Extract<DecryptedItem, { type: 'note' }>) => {
    setTitle(note.title);
    setContent(note.content);
    setPinRequired(note.pinRequired);
    setSelectedAttachments(note.fileIds || []);
    setCategory(note.category);
    setTagsInput(note.tags.join(', '));
    setFavorite(note.favorite);
    setIsEditing(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload = {
      type: 'note' as const,
      title,
      content,
      pinRequired,
      fileIds: selectedAttachments,
      category,
      tags: parsedTags,
      favorite,
    };

    try {
      if (isEditing && selectedNote) {
        await updateNote(selectedNote.id, payload);
        setIsEditing(false);
        // Refresh selected note representation in view panel
        setSelectedNote({ ...selectedNote, ...payload } as any);
      } else {
        await addNote(payload);
        setCreateModalOpen(false);
        setCreateModalType(null);
      }
      resetForm();
    } catch (err) {
      setError('Failed to save secure note.');
    }
  };

  // Check pin to unlock sensitive notes
  const handlePinReentrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (!promptNote) return;

    try {
      const authInfo = await dbService.getAuthInfo();
      if (!authInfo) return;

      // Re-derive key with entered PIN
      const saltBytes = new Uint8Array(base64ToArrayBuffer(authInfo.salt));
      const testKey = await deriveKeyFromPin(reentryPin, saltBytes);

      // Verify PIN against PIN verifier
      const pinTestObj = JSON.parse((authInfo as any).encryptedPinTest || authInfo.encryptedRecoveryTest);
      const decrypted = await decryptText(testKey, pinTestObj.ciphertext, pinTestObj.iv);

      if (decrypted === 'LA_BOVEDA_VERIFIER') {
        // PIN is correct, authorize this note session
        setAuthorizedNoteId(promptNote.id);
        setPinPromptOpen(false);
        setSelectedNote(promptNote);
        setReentryPin('');
      } else {
        setPinError('Incorrect PIN. Authorization denied.');
        setReentryPin('');
      }
    } catch (err) {
      setPinError('Verification failed. Try again.');
      setReentryPin('');
    }
  };

  const handleSelectNote = (note: Extract<DecryptedItem, { type: 'note' }>) => {
    if (note.pinRequired && authorizedNoteId !== note.id) {
      setPromptNote(note);
      setPinPromptOpen(true);
      setPinError(null);
    } else {
      setSelectedNote(note);
    }
  };

  const toggleAttachment = (fileId: string) => {
    setSelectedAttachments((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  // Download attachment
  const handleDownloadAttachment = async (fileId: string) => {
    try {
      const res = await decryptFileAttachment(fileId);
      if (!res) return;

      const blob = new Blob([res.data], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  // Simple Markdown Parser
  const parseMarkdown = (md: string) => {
    if (!md) return <span className="text-zinc-500 italic">Empty note.</span>;
    
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-xl font-bold font-display text-white mt-4 mb-2 border-b border-white/5 pb-1">{line.slice(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-lg font-bold font-display text-white mt-3 mb-1.5">{line.slice(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-sm font-semibold text-white mt-2 mb-1">{line.slice(4)}</h3>;
      }
      
      // List items
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <ul key={idx} className="list-disc list-inside text-xs text-zinc-300 ml-4 my-1">
            <li>{line.slice(2)}</li>
          </ul>
        );
      }

      // Code blocks (simple check)
      if (line.startsWith('```')) {
        return null; // treat simply or filter
      }

      // Check bold **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      if (boldRegex.test(line)) {
        const parts = line.split(boldRegex);
        return (
          <p key={idx} className="text-xs text-zinc-300 my-1.5 leading-relaxed">
            {parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="text-[#d4af37] font-semibold">{p}</strong> : p))}
          </p>
        );
      }

      return (
        <p key={idx} className="text-xs text-zinc-300 my-1.5 leading-relaxed min-h-[1rem]">
          {line}
        </p>
      );
    });
  };

  const filteredNotes = notesList.filter((note) => {
    return (
      note.title.toLowerCase().includes(search.toLowerCase()) ||
      note.content.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="flex flex-col md:flex-row gap-6 text-left min-h-[500px]">
      
      {/* Notes List Column */}
      <div className="w-full md:w-80 shrink-0 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-white/2 border border-white/5 rounded-2xl focus:outline-none focus:border-white/10 placeholder-zinc-500 text-white"
            />
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>

          <button
            onClick={() => {
              resetForm();
              setIsEditing(false);
              setSelectedNote(null);
              setCreateModalType('note');
              setCreateModalOpen(true);
            }}
            className="p-2.5 bg-[#d4af37]/15 border border-[#d4af37]/20 rounded-2xl text-[#d4af37] hover:bg-[#d4af37]/20 active:scale-95 transition-all"
            title="Create Note"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
          {filteredNotes.map((note) => {
            const isSelected = selectedNote?.id === note.id;
            const isAuthorized = !note.pinRequired || authorizedNoteId === note.id;

            return (
              <div
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'border-[#d4af37] bg-[#d4af37]/5'
                    : 'border-white/5 bg-white/2 hover:bg-white/4'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xs font-bold text-white tracking-wide truncate">{note.title}</h4>
                    {note.favorite && <Star size={10} className="fill-amber-400 text-amber-400" />}
                  </div>
                  <p className="text-[10px] text-zinc-500 truncate leading-relaxed">
                    {!isAuthorized ? '••••••••••••••••' : note.content || 'Empty note.'}
                  </p>
                </div>
                
                <div className="shrink-0 flex flex-col items-end gap-1 text-[10px] text-zinc-500">
                  {note.pinRequired ? (
                    isAuthorized ? (
                      <Unlock size={11} className="text-green-500" />
                    ) : (
                      <Lock size={11} className="text-[#d4af37]" />
                    )
                  ) : null}
                  {note.fileIds && note.fileIds.length > 0 && (
                    <div className="flex items-center gap-0.5 text-zinc-600">
                      <Paperclip size={10} />
                      <span>{note.fileIds.length}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredNotes.length === 0 && (
            <div className="text-center py-12 text-zinc-500 text-xs">
              No secure notes found in this chamber.
            </div>
          )}
        </div>
      </div>

      {/* Note View Panel */}
      <div className="flex-1 glass-panel border border-white/5 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[350px]">
        {selectedNote ? (
          <div className="space-y-6 flex-1 flex flex-col justify-between">
            <div>
              {/* Note Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold font-display text-white">{('title' in selectedNote) ? selectedNote.title : ''}</h2>
                    <button
                      onClick={() => toggleFavorite(selectedNote.id)}
                      className="text-zinc-500 hover:text-amber-400 transition-all"
                    >
                      <Star size={14} className={selectedNote.favorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'} />
                    </button>
                  </div>
                  <div className="flex gap-2 items-center text-[10px] text-zinc-500 mt-1">
                    <span>{selectedNote.category}</span>
                    <span>•</span>
                    <span>Modificado: {new Date(selectedNote.updatedAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditClick(selectedNote as any)}
                    className="p-2 bg-white/5 border border-white/5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                    title="Edit Note"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => {
                      deleteVaultItem(selectedNote.id);
                      setSelectedNote(null);
                    }}
                    className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
                    title="Secure Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Note Body (Markdown Rendered) */}
              <div className="py-4 overflow-y-auto max-h-[320px] select-text">
                {parseMarkdown((selectedNote as any).content)}
              </div>
            </div>

            {/* Note Attachments */}
            {selectedNote.type === 'note' && (selectedNote as any).fileIds && (selectedNote as any).fileIds.length > 0 && (
              <div className="border-t border-white/5 pt-4">
                <h5 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                  <Paperclip size={10} /> Attachments & References
                </h5>
                <div className="flex flex-wrap gap-2">
                  {(selectedNote as any).fileIds.map((fileId: string) => {
                    const fMeta = fileAttachments.find((f) => f.id === fileId);
                    if (!fMeta) return null;

                    return (
                      <button
                        key={fileId}
                        onClick={() => handleDownloadAttachment(fileId)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/2 border border-white/5 rounded-xl hover:bg-white/5 text-[11px] text-zinc-300 transition-all group"
                      >
                        <FileText size={12} className="text-teal-400 shrink-0" />
                        <span className="truncate max-w-[120px] group-hover:underline text-left">
                          {fMeta.filename}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono">
                          ({(fMeta.size / 1024).toFixed(1)} KB)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <FileText size={48} className="text-zinc-600 mb-3" />
            <p className="text-xs text-zinc-500 font-medium">
              Select a note from the panel to view its encrypted contents.
            </p>
          </div>
        )}
      </div>

      {/* Editor Modal Overlay */}
      <AnimatePresence>
        {(createModalOpen && createModalType === 'note') || isEditing ? (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-lg font-bold font-display text-white mb-1.5">
                {isEditing ? 'Modify Secure Note' : 'Add Secure Note'}
              </h2>
              <p className="text-[11px] text-zinc-500 mb-6">
                Supports simple markdown style `# Header`, `- bullet`, and `**bold**`.
              </p>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                      Note Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs glass-input focus:outline-none"
                      placeholder="e.g. Server Access Backups"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                      Note Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#d4af37]/40"
                    >
                      <option value="Personal">Personal</option>
                      <option value="Work">Work</option>
                      <option value="Finance">Finance</option>
                      <option value="Server">Server</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                    Note Content (Encrypted)
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className="w-full px-3.5 py-2 text-xs glass-input focus:outline-none font-mono"
                    placeholder="Write secret details here..."
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
                    placeholder="e.g. system, config, keyfile"
                  />
                </div>

                {/* Attachments Selection */}
                {fileAttachments.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                      Attach Ingested Files
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto p-1 border border-white/5 rounded-xl bg-black/20">
                      {fileAttachments.map((file) => {
                        const isAttached = selectedAttachments.includes(file.id);
                        return (
                          <button
                            type="button"
                            key={file.id}
                            onClick={() => toggleAttachment(file.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-lg border transition-all ${
                              isAttached
                                ? 'border-[#d4af37] bg-[#d4af37]/5 text-white'
                                : 'border-white/5 bg-transparent text-zinc-500 hover:border-white/10'
                            }`}
                          >
                            <Paperclip size={10} />
                            <span>{file.filename}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Security settings inside note */}
                <div className="flex flex-col gap-2 bg-black/20 p-3.5 border border-white/5 rounded-2xl">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pinRequired}
                      onChange={(e) => setPinRequired(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white">Require PIN Re-entry to view</span>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Shields contents behind verification to block local observers.</p>
                    </div>
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
                    }}
                    className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-2xl border border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white transition-all focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-2xl gold-gradient-bg text-zinc-950 font-sans tracking-wide hover:brightness-105 active:scale-98 transition-all focus:outline-none"
                  >
                    {isEditing ? 'Save Changes' : 'Store Secure Note'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* PIN Reentry Overlay prompt */}
      <AnimatePresence>
        {pinPromptOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-6 z-55">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl text-center"
            >
              <div className="p-3 bg-[#d4af37]/15 rounded-full inline-block mb-3.5">
                <Lock size={20} className="text-[#d4af37]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">Note Authorization Required</h3>
              <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                This note contains highly sensitive elements. Please re-enter your Master PIN to decrypt and display.
              </p>

              <form onSubmit={handlePinReentrySubmit} className="space-y-4">
                <input
                  type="password"
                  pattern="\d*"
                  maxLength={12}
                  value={reentryPin}
                  onChange={(e) => setReentryPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full tracking-widest text-center text-lg font-bold glass-input px-4 py-2.5 focus:outline-none"
                  placeholder="••••••"
                  required
                  autoFocus
                />

                {pinError && (
                  <p className="text-[11px] text-rose-500 font-semibold bg-rose-500/10 px-3 py-1.5 border border-rose-500/20 rounded-xl">
                    {pinError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPinPromptOpen(false);
                      setPromptNote(null);
                      setReentryPin('');
                    }}
                    className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 gold-gradient-bg text-zinc-950 rounded-xl text-xs font-bold hover:brightness-105 active:scale-95 transition-all"
                  >
                    Verify PIN
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
