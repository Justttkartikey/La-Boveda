import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  encryptText,
  decryptText,
  encryptFile,
  decryptFile,
  generateRandomBytes,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deriveKeyFromPin,
} from '../services/crypto';
import { dbService } from '../services/db';
import type { DBVaultItem, DBActivityLog } from '../services/db';

export type DecryptedItem =
  | {
      id: string;
      type: 'password';
      category: string;
      favorite: boolean;
      tags: string[];
      title: string;
      username: string;
      passwordStr: string;
      url: string;
      notes: string;
      updatedAt: number;
    }
  | {
      id: string;
      type: 'note';
      category: string;
      favorite: boolean;
      tags: string[];
      title: string;
      content: string;
      pinRequired: boolean;
      fileIds: string[];
      updatedAt: number;
    }
  | {
      id: string;
      type: 'file';
      category: string;
      favorite: boolean;
      tags: string[];
      filename: string;
      mimeType: string;
      size: number;
      updatedAt: number;
    }
  | {
      id: string;
      type: 'generated_password';
      passwordStr: string;
      genType: string;
      category: string;
      favorite: boolean;
      tags: string[];
      updatedAt: number;
    };

export interface DecryptedLog {
  id: string;
  timestamp: number;
  type: string;
  description: string;
}

interface DbContextType {
  items: DecryptedItem[];
  logs: DecryptedLog[];
  loading: boolean;
  securityScore: number;
  addPassword: (item: Omit<DecryptedItem & { type: 'password' }, 'id' | 'updatedAt'>) => Promise<void>;
  updatePassword: (id: string, item: Omit<DecryptedItem & { type: 'password' }, 'id' | 'updatedAt'>) => Promise<void>;
  addNote: (item: Omit<DecryptedItem & { type: 'note' }, 'id' | 'updatedAt'>) => Promise<void>;
  updateNote: (id: string, item: Omit<DecryptedItem & { type: 'note' }, 'id' | 'updatedAt'>) => Promise<void>;
  addFile: (filename: string, mimeType: string, size: number, buffer: ArrayBuffer, category: string, tags: string[]) => Promise<void>;
  addGeneratedPassword: (password: string, genType: string) => Promise<void>;
  deleteVaultItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  decryptFileAttachment: (id: string) => Promise<{ filename: string; mimeType: string; data: ArrayBuffer } | null>;
  addLogEntry: (type: string, description: string) => Promise<void>;
  exportBackup: (selections: { passwords: boolean; notes: boolean; settings: boolean; logs: boolean; history: boolean }, backupPin?: string) => Promise<string>;
  importBackup: (backupData: string, backupPin?: string) => Promise<{ success: boolean; count: number; error?: string }>;
}

const DbContext = createContext<DbContextType | undefined>(undefined);

export const DbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { masterKey, screen, autoLockTime, hasBiometrics, biometricsSupported, defaultCity, entryGesture } = useAuth();
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [logs, setLogs] = useState<DecryptedLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [securityScore, setSecurityScore] = useState<number>(100);

  // Helper to add activity log entries (encrypted)
  const addLogEntry = useCallback(async (type: string, description: string) => {
    if (!masterKey) return;
    try {
      const logPayload = JSON.stringify({ type, description });
      const { ciphertext, iv } = await encryptText(masterKey, logPayload);
      
      const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const dbLog: DBActivityLog = {
        id: logId,
        timestamp: Date.now(),
        encryptedData: JSON.stringify({ ciphertext, iv }),
      };

      await dbService.addLog(dbLog);
      
      // Update in-memory log state
      setLogs((prev) => [{ id: logId, timestamp: dbLog.timestamp, type, description }, ...prev]);
    } catch (err) {
      console.error('Failed to save activity log:', err);
    }
  }, [masterKey]);

  // Load and decrypt vault items and logs
  useEffect(() => {
    const decryptVault = async () => {
      if (screen !== 'app' || !masterKey) {
        setItems([]);
        setLogs([]);
        return;
      }

      setLoading(true);
      try {
        // Load items
        const encryptedItems = await dbService.getAllItems();
        const decryptedItems: DecryptedItem[] = [];

        for (const item of encryptedItems) {
          try {
            const dataObj = JSON.parse(item.encryptedData);
            const plaintext = await decryptText(masterKey, dataObj.ciphertext, dataObj.iv);
            const rawFields = JSON.parse(plaintext);

            decryptedItems.push({
              id: item.id,
              type: item.type,
              category: item.category,
              favorite: item.favorite === 1,
              tags: item.tags,
              ...rawFields,
              updatedAt: item.updatedAt,
            });
          } catch (e) {
            console.error('Error decrypting vault item:', item.id, e);
          }
        }
        setItems(decryptedItems);

        // Load logs
        const dbLogs = await dbService.getLogs();
        const decryptedLogs: DecryptedLog[] = [];
        for (const log of dbLogs) {
          try {
            const dataObj = JSON.parse(log.encryptedData);
            const plaintext = await decryptText(masterKey, dataObj.ciphertext, dataObj.iv);
            const rawFields = JSON.parse(plaintext);
            
            decryptedLogs.push({
              id: log.id,
              timestamp: log.timestamp,
              type: rawFields.type,
              description: rawFields.description,
            });
          } catch (e) {
            console.error('Error decrypting log entry:', log.id, e);
          }
        }
        // Sort logs newest first
        decryptedLogs.sort((a, b) => b.timestamp - a.timestamp);
        setLogs(decryptedLogs);

        // Auto log successful vault load
        // Avoid infinite loop by only logging if it's the initial load (logs state empty)
        if (decryptedLogs.length === 0 || !decryptedLogs.some(l => l.type === 'Login' && Date.now() - l.timestamp < 10000)) {
          // Wrap in timeout or run once
          setTimeout(() => {
            addLogEntry('Login', 'Vault decrypted and unlocked successfully.');
          }, 100);
        }
      } catch (err) {
        console.error('Error fetching vault items:', err);
      } finally {
        setLoading(false);
      }
    };

    decryptVault();
  }, [screen, masterKey, addLogEntry]);

  // Compute security score
  useEffect(() => {
    if (screen !== 'app') return;

    let score = 0;

    // 1. PIN Strength (Max: 15 pts)
    const pinScore = Number(localStorage.getItem('lbv_pin_score') || '10');
    score += pinScore;

    // 2. Recovery Key (Max: 15 pts)
    // Setup always requires a recovery key, so if setup is finished, recovery key is active
    score += 15;

    // 3. Auto Lock (Max: 10 pts)
    if (autoLockTime > 0 && autoLockTime <= 300) {
      score += 10; // 5 min or less
    } else if (autoLockTime > 0 && autoLockTime <= 900) {
      score += 7; // 15 min or less
    } else if (autoLockTime > 0) {
      score += 4; // greater than 15m
    }

    // 4. Encryption (Max: 10 pts)
    score += 10; // AES-GCM 256 is default (100% compliant)

    // 5. Backups (Max: 15 pts)
    const lastBackupStr = localStorage.getItem('lbv_last_backup_time');
    if (lastBackupStr) {
      const lastBackup = Number(lastBackupStr);
      const daysSinceBackup = (Date.now() - lastBackup) / (24 * 60 * 60 * 1000);
      if (daysSinceBackup <= 7) {
        score += 15;
      } else if (daysSinceBackup <= 30) {
        score += 10;
      } else {
        score += 5;
      }
    } else {
      score += 0; // Never backed up
    }

    // 6. Clipboard Protection (Max: 10 pts)
    score += 10; // Clipboard auto-clear is default in hook

    // 7. Biometrics (Max: 10 pts)
    if (hasBiometrics) {
      score += 10;
    } else if (!biometricsSupported) {
      score += 10; // Don't penalize desktop devices
    } else {
      score += 0; // Supported but not enabled
    }

    // 8. Vault Health (Max: 10 pts)
    const passwords = items.filter((i) => i.type === 'password') as Extract<DecryptedItem, { type: 'password' }>[];
    if (passwords.length === 0) {
      score += 10; // default empty vault is secure
    } else {
      let reusedCount = 0;
      let weakCount = 0;
      const seenPasswords = new Set<string>();

      passwords.forEach((p) => {
        const pw = p.passwordStr;
        if (seenPasswords.has(pw)) {
          reusedCount++;
        }
        seenPasswords.add(pw);

        // Weak passwords check (under 12 characters or simple digits)
        const hasUpper = /[A-Z]/.test(pw);
        const hasLower = /[a-z]/.test(pw);
        const hasDigit = /[0-9]/.test(pw);
        const hasSpecial = /[^A-Za-z0-9]/.test(pw);

        if (pw.length < 12 || !(hasUpper && hasLower && (hasDigit || hasSpecial))) {
          weakCount++;
        }
      });

      const reuseRatio = reusedCount / passwords.length;
      const weakRatio = weakCount / passwords.length;

      score += Math.max(0, Math.floor(5 * (1 - reuseRatio)));
      score += Math.max(0, Math.floor(5 * (1 - weakRatio)));
    }

    // 9. Storage & DB Health (Max: 5 pts)
    const files = items.filter((i) => i.type === 'file') as Extract<DecryptedItem, { type: 'file' }>[];
    const totalFileSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalFileSize < 5 * 1024 * 1024) {
      score += 3;
    } else if (totalFileSize < 15 * 1024 * 1024) {
      score += 1;
    }

    if (logs.length < 100) {
      score += 2;
    } else if (logs.length < 250) {
      score += 1;
    }

    setSecurityScore(Math.min(100, Math.max(0, score)));
  }, [items, logs, screen, autoLockTime, hasBiometrics, biometricsSupported]);

  // --- Password Methods ---
  const addPassword = async (item: Omit<DecryptedItem & { type: 'password' }, 'id' | 'updatedAt'>) => {
    if (!masterKey) return;
    const id = 'pw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const secretPayload = JSON.stringify({
      title: item.title,
      username: item.username,
      passwordStr: item.passwordStr,
      url: item.url,
      notes: item.notes,
    });

    const { ciphertext, iv } = await encryptText(masterKey, secretPayload);
    const dbItem: DBVaultItem = {
      id,
      type: 'password',
      category: item.category,
      favorite: item.favorite ? 1 : 0,
      tags: item.tags,
      encryptedData: JSON.stringify({ ciphertext, iv }),
      updatedAt: Date.now(),
    };

    await dbService.saveItem(dbItem);
    
    // Add to state
    setItems((prev) => [...prev, { ...item, id, updatedAt: dbItem.updatedAt } as DecryptedItem]);
    await addLogEntry('Vault Changes', `Created password entry: ${item.title}`);
  };

  const updatePassword = async (id: string, item: Omit<DecryptedItem & { type: 'password' }, 'id' | 'updatedAt'>) => {
    if (!masterKey) return;
    const secretPayload = JSON.stringify({
      title: item.title,
      username: item.username,
      passwordStr: item.passwordStr,
      url: item.url,
      notes: item.notes,
    });

    const { ciphertext, iv } = await encryptText(masterKey, secretPayload);
    const dbItem: DBVaultItem = {
      id,
      type: 'password',
      category: item.category,
      favorite: item.favorite ? 1 : 0,
      tags: item.tags,
      encryptedData: JSON.stringify({ ciphertext, iv }),
      updatedAt: Date.now(),
    };

    await dbService.saveItem(dbItem);
    
    // Update state
    setItems((prev) => prev.map((i) => (i.id === id ? ({ ...item, id, updatedAt: dbItem.updatedAt } as DecryptedItem) : i)));
    await addLogEntry('Vault Changes', `Updated password entry: ${item.title}`);
  };

  // --- Note Methods ---
  const addNote = async (item: Omit<DecryptedItem & { type: 'note' }, 'id' | 'updatedAt'>) => {
    if (!masterKey) return;
    const id = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const secretPayload = JSON.stringify({
      title: item.title,
      content: item.content,
      pinRequired: item.pinRequired,
      fileIds: item.fileIds,
    });

    const { ciphertext, iv } = await encryptText(masterKey, secretPayload);
    const dbItem: DBVaultItem = {
      id,
      type: 'note',
      category: item.category,
      favorite: item.favorite ? 1 : 0,
      tags: item.tags,
      encryptedData: JSON.stringify({ ciphertext, iv }),
      updatedAt: Date.now(),
    };

    await dbService.saveItem(dbItem);

    setItems((prev) => [...prev, { ...item, id, updatedAt: dbItem.updatedAt } as DecryptedItem]);
    await addLogEntry('Vault Changes', `Created secure note: ${item.title}`);
  };

  const updateNote = async (id: string, item: Omit<DecryptedItem & { type: 'note' }, 'id' | 'updatedAt'>) => {
    if (!masterKey) return;
    const secretPayload = JSON.stringify({
      title: item.title,
      content: item.content,
      pinRequired: item.pinRequired,
      fileIds: item.fileIds,
    });

    const { ciphertext, iv } = await encryptText(masterKey, secretPayload);
    const dbItem: DBVaultItem = {
      id,
      type: 'note',
      category: item.category,
      favorite: item.favorite ? 1 : 0,
      tags: item.tags,
      encryptedData: JSON.stringify({ ciphertext, iv }),
      updatedAt: Date.now(),
    };

    await dbService.saveItem(dbItem);

    setItems((prev) => prev.map((i) => (i.id === id ? ({ ...item, id, updatedAt: dbItem.updatedAt } as DecryptedItem) : i)));
    await addLogEntry('Vault Changes', `Updated secure note: ${item.title}`);
  };

  // --- File Upload Methods ---
  const addFile = async (
    filename: string,
    mimeType: string,
    size: number,
    buffer: ArrayBuffer,
    category: string,
    tags: string[]
  ) => {
    if (!masterKey) return;

    // Validate size limit (strict 2MB limit as specified)
    if (size > 2 * 1024 * 1024) {
      throw new Error('File exceeds the maximum size limit of 2 MB.');
    }

    const id = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Encrypt file metadata
    const metaPayload = JSON.stringify({ filename, mimeType, size });
    const { ciphertext: metaCipher, iv: metaIv } = await encryptText(masterKey, metaPayload);
    
    const dbMeta: DBVaultItem = {
      id,
      type: 'file',
      category,
      favorite: 0,
      tags,
      encryptedData: JSON.stringify({ ciphertext: metaCipher, iv: metaIv }),
      updatedAt: Date.now(),
    };

    // Encrypt file binary buffer
    const { ciphertext: fileCipher, iv: fileIv } = await encryptFile(masterKey, buffer);
    const dbPayload = {
      id: `payload:${id}`,
      encryptedPayload: JSON.stringify({ ciphertext: fileCipher, iv: fileIv }),
    };

    // Save metadata and payload in separate stores
    await dbService.saveItem(dbMeta);
    await dbService.saveFilePayload(dbPayload.id, dbPayload);

    // Update in-memory state
    setItems((prev) => [
      ...prev,
      {
        id,
        type: 'file',
        category,
        favorite: false,
        tags,
        filename,
        mimeType,
        size,
        updatedAt: dbMeta.updatedAt,
      } as DecryptedItem,
    ]);

    await addLogEntry('Vault Changes', `Uploaded secure file: ${filename}`);
  };

  const addGeneratedPassword = async (password: string, genType: string) => {
    if (!masterKey) return;
    const id = 'genpw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const secretPayload = JSON.stringify({
      passwordStr: password,
      genType: genType,
    });

    const { ciphertext, iv } = await encryptText(masterKey, secretPayload);
    const dbItem: DBVaultItem = {
      id,
      type: 'generated_password',
      category: 'generator',
      favorite: 0,
      tags: [],
      encryptedData: JSON.stringify({ ciphertext, iv }),
      updatedAt: Date.now(),
    };

    await dbService.saveItem(dbItem);

    setItems((prev) => [
      ...prev,
      {
        id,
        type: 'generated_password',
        passwordStr: password,
        genType: genType,
        category: 'generator',
        favorite: false,
        tags: [],
        updatedAt: dbItem.updatedAt,
      } as DecryptedItem,
    ]);
  };

  // --- General Deletion ---
  const deleteVaultItem = async (id: string) => {
    const targetItem = items.find((i) => i.id === id);
    if (!targetItem) return;

    await dbService.deleteItem(id);

    // If it's a file, delete the payload too
    if (targetItem.type === 'file') {
      await dbService.deleteFilePayload(`payload:${id}`);
    }

    setItems((prev) => prev.filter((i) => i.id !== id));
    await addLogEntry('Vault Changes', `Deleted ${targetItem.type} entry: ${targetItem.type === 'file' ? (targetItem as any).filename : (targetItem as any).title}`);
  };

  // --- Toggle Favorite ---
  const toggleFavorite = async (id: string) => {
    const targetItem = items.find((i) => i.id === id);
    if (!targetItem) return;

    const itemsList = await dbService.getAllItems();
    const dbItem = itemsList.find((i) => i.id === id) || null;

    if (!dbItem) return;
    
    dbItem.favorite = dbItem.favorite === 1 ? 0 : 1;
    dbItem.updatedAt = Date.now();
    await dbService.saveItem(dbItem);

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, favorite: dbItem.favorite === 1 } : i))
    );
  };

  // --- Decrypt File On-Demand ---
  const decryptFileAttachment = async (id: string): Promise<{ filename: string; mimeType: string; data: ArrayBuffer } | null> => {
    if (!masterKey) return null;
    const targetMeta = items.find((i) => i.id === id && i.type === 'file') as Extract<DecryptedItem, { type: 'file' }>;
    if (!targetMeta) return null;

    try {
      const payloadRecord = await dbService.getFilePayload(`payload:${id}`);
      if (!payloadRecord) return null;

      const payloadObj = JSON.parse(payloadRecord.encryptedPayload);
      const fileData = await decryptFile(masterKey, payloadObj.ciphertext, payloadObj.iv);

      return {
        filename: targetMeta.filename,
        mimeType: targetMeta.mimeType,
        data: fileData,
      };
    } catch (e) {
      console.error('File decryption failed:', e);
      return null;
    }
  };

  // --- Export Encrypted Backup (.lbv) ---
  const exportBackup = async (
    selections: { passwords: boolean; notes: boolean; settings: boolean; logs: boolean; history: boolean },
    backupPin?: string
  ): Promise<string> => {
    if (!masterKey) throw new Error('Vault is locked.');

    // 1. Gather selected items
    const exportData: any = {
      version: '1.0.0',
      timestamp: Date.now(),
      exportedComponents: selections,
    };

    if (selections.passwords) {
      exportData.passwords = items.filter((i) => i.type === 'password');
    }
    if (selections.notes) {
      exportData.notes = items.filter((i) => i.type === 'note');
      // Include payloads of files attached to notes
      const fileIdsAttached = (exportData.notes as any[]).flatMap((note) => note.fileIds || []);
      const attachedFilesMeta = items.filter((i) => i.type === 'file' && fileIdsAttached.includes(i.id));
      exportData.attachedFilesMeta = attachedFilesMeta;
      
      const filePayloads: Record<string, string> = {};
      for (const f of attachedFilesMeta) {
        const payloadRecord = await dbService.getFilePayload(`payload:${f.id}`);
        if (payloadRecord) {
          filePayloads[f.id] = payloadRecord.encryptedPayload;
        }
      }
      exportData.attachedFilesPayloads = filePayloads;
    }
    if (selections.logs) {
      exportData.logs = logs;
    }
    if (selections.history) {
      exportData.history = items.filter((i) => i.type === 'generated_password');
    }
    if (selections.settings) {
      exportData.settings = {
        autoLockTime,
        defaultCity,
        entryGesture,
      };
    }

    const payloadString = JSON.stringify(exportData);
    
    // 2. Encrypt the backup
    if (backupPin) {
      // If a custom backup PIN/password is specified, derive a new key for it
      const tempSalt = generateRandomBytes(32);
      const tempKey = await deriveKeyFromPin(backupPin, tempSalt);
      const { ciphertext, iv } = await encryptText(tempKey, payloadString);
      
      const containerObj = {
        salt: arrayBufferToBase64(tempSalt.buffer as ArrayBuffer),
        ciphertext,
        iv,
        isCustomPin: true,
      };
      
      await addLogEntry('Backup', 'Encrypted vault backup exported with custom PIN.');
      return JSON.stringify(containerObj);
    } else {
      // Default: Encrypted with current Master Key
      const { ciphertext, iv } = await encryptText(masterKey, payloadString);
      
      const info = await dbService.getAuthInfo();
      const salt = info ? info.salt : '';

      const containerObj = {
        ciphertext,
        iv,
        isCustomPin: false,
        salt,
      };
      
      await addLogEntry('Backup', 'Encrypted vault backup exported with master PIN.');
      return JSON.stringify(containerObj);
    }
  };

  // --- Import Encrypted Backup ---
  const importBackup = async (
    backupDataStr: string,
    backupPin?: string
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!masterKey) return { success: false, count: 0, error: 'Vault is locked.' };

    try {
      const container = JSON.parse(backupDataStr);
      let plaintext = '';

      if (container.isCustomPin) {
        if (!backupPin) {
          return { success: false, count: 0, error: 'BACKUP_PIN_REQUIRED' };
        }
        const tempSaltBytes = new Uint8Array(base64ToArrayBuffer(container.salt));
        const tempKey = await deriveKeyFromPin(backupPin, tempSaltBytes);
        plaintext = await decryptText(tempKey, container.ciphertext, container.iv);
      } else {
        try {
          plaintext = await decryptText(masterKey, container.ciphertext, container.iv);
        } catch (e) {
          if (container.salt && backupPin) {
            const tempSaltBytes = new Uint8Array(base64ToArrayBuffer(container.salt));
            const tempKey = await deriveKeyFromPin(backupPin, tempSaltBytes);
            plaintext = await decryptText(tempKey, container.ciphertext, container.iv);
          } else if (container.salt && !backupPin) {
            return { success: false, count: 0, error: 'BACKUP_PIN_REQUIRED' };
          } else {
            throw e;
          }
        }
      }

      const imported = JSON.parse(plaintext);
      let importCount = 0;

      // Restore passwords
      if (imported.passwords) {
        for (const item of imported.passwords) {
          // Re-encrypt under our current masterKey
          const secretPayload = JSON.stringify({
            title: item.title,
            username: item.username,
            passwordStr: item.passwordStr,
            url: item.url,
            notes: item.notes,
          });
          const { ciphertext, iv } = await encryptText(masterKey, secretPayload);
          const dbItem: DBVaultItem = {
            id: item.id || 'pw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: 'password',
            category: item.category || 'imported',
            favorite: item.favorite ? 1 : 0,
            tags: item.tags || [],
            encryptedData: JSON.stringify({ ciphertext, iv }),
            updatedAt: item.updatedAt || Date.now(),
          };
          await dbService.saveItem(dbItem);
          importCount++;
        }
      }

      // Restore generated passwords history
      if (imported.history) {
        for (const item of imported.history) {
          const secretPayload = JSON.stringify({
            passwordStr: item.passwordStr,
            genType: item.genType,
          });
          const { ciphertext, iv } = await encryptText(masterKey, secretPayload);
          const dbItem: DBVaultItem = {
            id: item.id || 'genpw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: 'generated_password',
            category: 'generator',
            favorite: 0,
            tags: [],
            encryptedData: JSON.stringify({ ciphertext, iv }),
            updatedAt: item.updatedAt || Date.now(),
          };
          await dbService.saveItem(dbItem);
          importCount++;
        }
      }

      // Restore notes and file attachments
      if (imported.notes) {
        for (const item of imported.notes) {
          const secretPayload = JSON.stringify({
            title: item.title,
            content: item.content,
            pinRequired: item.pinRequired || false,
            fileIds: item.fileIds || [],
          });
          const { ciphertext, iv } = await encryptText(masterKey, secretPayload);
          const dbItem: DBVaultItem = {
            id: item.id || 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: 'note',
            category: item.category || 'imported',
            favorite: item.favorite ? 1 : 0,
            tags: item.tags || [],
            encryptedData: JSON.stringify({ ciphertext, iv }),
            updatedAt: item.updatedAt || Date.now(),
          };
          await dbService.saveItem(dbItem);
          importCount++;
        }

        // Restore file payloads
        if (imported.attachedFilesMeta && imported.attachedFilesPayloads) {
          for (const f of imported.attachedFilesMeta) {
            // Save file meta
            const metaPayload = JSON.stringify({ filename: f.filename, mimeType: f.mimeType, size: f.size });
            const { ciphertext: metaCipher, iv: metaIv } = await encryptText(masterKey, metaPayload);
            const dbMeta: DBVaultItem = {
              id: f.id,
              type: 'file',
              category: f.category || 'imported',
              favorite: f.favorite ? 1 : 0,
              tags: f.tags || [],
              encryptedData: JSON.stringify({ ciphertext: metaCipher, iv: metaIv }),
              updatedAt: f.updatedAt || Date.now(),
            };
            await dbService.saveItem(dbMeta);

            // Re-save file payload (already encrypted, we extract and re-save)
            const rawPayload = imported.attachedFilesPayloads[f.id];
            if (rawPayload) {
              await dbService.saveFilePayload(`payload:${f.id}`, {
                id: `payload:${f.id}`,
                encryptedPayload: rawPayload,
              });
            }
          }
        }
      }

      // Trigger state reload by updating items list
      const encryptedItems = await dbService.getAllItems();
      const loadedItems: DecryptedItem[] = [];
      for (const item of encryptedItems) {
        try {
          const dataObj = JSON.parse(item.encryptedData);
          const rawPlain = await decryptText(masterKey, dataObj.ciphertext, dataObj.iv);
          const rawFields = JSON.parse(rawPlain);
          loadedItems.push({
            id: item.id,
            type: item.type,
            category: item.category,
            favorite: item.favorite === 1,
            tags: item.tags,
            ...rawFields,
            updatedAt: item.updatedAt,
          });
        } catch (e) {
          // ignore
        }
      }
      setItems(loadedItems);

      await addLogEntry('Restore', `Successfully restored ${importCount} items from backup.`);
      return { success: true, count: importCount };
    } catch (err) {
      console.error('Backup import failed:', err);
      return { success: false, count: 0, error: 'FAILED_TO_DECRYPT' };
    }
  };

  return (
    <DbContext.Provider
      value={{
        items,
        logs,
        loading,
        securityScore,
        addPassword,
        updatePassword,
        addNote,
        updateNote,
        addFile,
        deleteVaultItem,
        toggleFavorite,
        decryptFileAttachment,
        addLogEntry,
        exportBackup,
        importBackup,
        addGeneratedPassword,
      }}
    >
      {children}
    </DbContext.Provider>
  );
};

export const useDb = () => {
  const context = useContext(DbContext);
  if (!context) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return context;
};
