import React, { useState, useRef } from 'react';
import { useDb } from '../../hooks/useDb';
import type { DecryptedItem } from '../../hooks/useDb';
import {
  UploadCloud,
  FileText,
  FileImage,
  FileCode,
  Download,
  Trash2,
  AlertTriangle,
  Search,
  CheckCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileStorageProps {
  createModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  createModalType: 'password' | 'note' | 'file' | null;
  setCreateModalType: (type: 'password' | 'note' | 'file' | null) => void;
}

export const FileStorage: React.FC<FileStorageProps> = ({
  createModalOpen,
  setCreateModalOpen,
  createModalType,
  setCreateModalType,
}) => {
  const { items, addFile, deleteVaultItem, decryptFileAttachment } = useDb();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  
  // Custom categories / tags for files
  const [fileCategory, setFileCategory] = useState('Documents');
  const [fileTags, setFileTags] = useState('');

  const filesList = items.filter((i) => i.type === 'file') as Extract<DecryptedItem, { type: 'file' }>[];


  // Open modal handler
  React.useEffect(() => {
    if (createModalOpen && createModalType === 'file') {
      setUploadError(null);
      setUploadSuccess(null);
      setFileTags('');
      setFileCategory('Documents');
    }
  }, [createModalOpen, createModalType]);

  const validateFile = (file: File): boolean => {
    // Strict 10 MB limit check
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds the maximum size limit of 10 MB.');
      return false;
    }

    return true;
  };

  const handleUpload = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    if (!validateFile(file)) return;

    setLoading(true);

    try {
      const reader = new FileReader();

      // Read file as ArrayBuffer for binary encryption
      reader.onload = async (e) => {
        if (!e.target || !e.target.result) return;
        const arrayBuffer = e.target.result as ArrayBuffer;

        const tags = fileTags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        try {
          await addFile(file.name, file.type || `application/octet-stream`, file.size, arrayBuffer, fileCategory, tags);
          setUploadSuccess(`"${file.name}" encrypted and stored successfully.`);
          
          // Clear file upload input
          if (fileInputRef.current) fileInputRef.current.value = '';
          
          setTimeout(() => {
            setCreateModalOpen(false);
            setCreateModalType(null);
          }, 1500);
        } catch (err: any) {
          setUploadError(err.message || 'Encryption and database storage failed.');
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setUploadError('Failed to read file.');
        setLoading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      setUploadError('Upload failed.');
      setLoading(false);
    }
  };

  // Drag and Drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleUpload(e.target.files[0]);
    }
  };

  // On-demand decryption and trigger download
  const handleDownload = async (fileItem: Extract<DecryptedItem, { type: 'file' }>) => {
    try {
      const res = await decryptFileAttachment(fileItem.id);
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
      console.error('File decryption failed:', err);
    }
  };

  const getFileIcon = (mimeType: string, size = 20) => {
    if (mimeType.startsWith('image/')) {
      return <FileImage className="text-blue-400" size={size} />;
    }
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('markdown')) {
      return <FileCode className="text-amber-400" size={size} />;
    }
    return <FileText className="text-teal-400" size={size} />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = 2;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const filteredFiles = filesList.filter((f) => {
    return f.filename.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 text-left">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search filenames..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white/2 border border-white/5 rounded-2xl focus:outline-none focus:border-white/10 placeholder-zinc-500 text-white font-sans"
          />
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        </div>

        <button
          onClick={() => {
            setUploadError(null);
            setUploadSuccess(null);
            setCreateModalType('file');
            setCreateModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-2xl gold-gradient-bg text-zinc-950 hover:brightness-105 active:scale-98 transition-all shrink-0"
        >
          <UploadCloud size={14} /> Ingest File
        </button>
      </div>

      {/* Files Grid list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFiles.map((file) => (
          <div
            key={file.id}
            className="glass-panel p-4.5 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all gap-4"
          >
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="p-3 bg-white/5 border border-white/5 rounded-2xl shrink-0">
                {getFileIcon(file.mimeType, 24)}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white tracking-wide truncate mt-0.5" title={file.filename}>
                  {file.filename}
                </h4>
                <p className="text-[9px] text-zinc-500 mt-1 uppercase font-mono tracking-wider">
                  {file.category} • {formatFileSize(file.size)}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {file.tags.map((t) => (
                    <span key={t} className="text-[8px] bg-white/2 border border-white/5 rounded px-1 text-zinc-500">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-3">
              <button
                onClick={() => handleDownload(file)}
                className="flex items-center gap-1 py-1.5 px-3 bg-white/3 border border-white/5 hover:bg-white/5 rounded-xl text-[10px] font-bold text-zinc-300 hover:text-white transition-all active:scale-95"
                title="Download Decrypted File"
              >
                <Download size={11} /> Download
              </button>
              <button
                onClick={() => deleteVaultItem(file.id)}
                className="p-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl text-rose-400 hover:text-rose-300 transition-all"
                title="Secure Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {filteredFiles.length === 0 && (
          <div className="col-span-full text-center py-16 text-zinc-500 text-xs">
            No secure files registered in this chamber.
          </div>
        )}
      </div>

      {/* Upload File Modal Overlay */}
      <AnimatePresence>
        {createModalOpen && createModalType === 'file' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl relative"
            >
              <h2 className="text-lg font-bold font-display text-white mb-1.5">
                Ingest Secure File
              </h2>
              <p className="text-[11px] text-zinc-500 mb-6">
                Encrypts and bundles your document inside the browser. Limit: 2 MB.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                      File Category
                    </label>
                    <select
                      value={fileCategory}
                      onChange={(e) => setFileCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#d4af37]/40"
                    >
                      <option value="Documents">Documents</option>
                      <option value="Images">Images</option>
                      <option value="Certificates">Certificates</option>
                      <option value="Keys">Keys</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                      Tags (Comma separated)
                    </label>
                    <input
                      type="text"
                      value={fileTags}
                      onChange={(e) => setFileTags(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs glass-input focus:outline-none"
                      placeholder="e.g. backup, key"
                    />
                  </div>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all select-none ${
                    dragActive
                      ? 'border-[#d4af37] bg-[#d4af37]/5'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/2'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.json,.md"
                  />
                  
                  {loading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-zinc-400 font-semibold tracking-wider uppercase">Encrypting Payload...</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={32} className="text-zinc-500" />
                      <div className="text-center">
                        <p className="text-xs text-zinc-300 font-semibold">Drag and drop file here</p>
                        <p className="text-[10px] text-zinc-500 mt-1">or click to browse local files</p>
                      </div>
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-white/5 border border-white/5 rounded-md px-2 py-0.5 mt-2">
                        PDF, PNG, JPG, JPEG, TXT, JSON, MD (Max 2MB)
                      </span>
                    </>
                  )}
                </div>

                {uploadError && (
                  <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">
                    <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-xs font-semibold justify-center">
                    <CheckCircle size={14} /> {uploadSuccess}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateModalType(null);
                  }}
                  className="w-full py-2.5 px-4 text-xs font-semibold rounded-2xl border border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white transition-all focus:outline-none mt-2"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
