/**
 * La Bóveda Local Storage Service (IndexedDB)
 * 
 * Manages native database tables for:
 * - auth_info: Master key salts and WebAuthn credentials
 * - items: Encrypted vault entries (passwords, notes, attachments)
 * - activity_logs: Encrypted logs (immutable, auto-cleans > 30 days)
 * 
 * Works with zero server backend.
 */

const DB_NAME = 'LaBovedaDB';
const DB_VERSION = 1;

export interface DBAuthInfo {
  id: 'master_config';
  salt: string;          // Base64 encoded master PBKDF2 salt
  recoverySalt: string;  // Base64 salt used for recovery key derivation
  encryptedPin: string;  // PIN encrypted with Recovery Key derived key
  encryptedRecoveryTest: string; // Verifier ciphertext to check if Recovery Key is correct
  hasBiometrics: boolean;
  webauthnCredentialId?: string;
  webauthnPublicKey?: string;
}

export interface DBVaultItem {
  id: string;            // UUID or unique timestamp ID
  type: 'password' | 'note' | 'file' | 'generated_password';
  category: string;      // Non-sensitive indexable categories (e.g. login, finance, work)
  favorite: number;      // 0 or 1 for indexing
  tags: string[];        // Non-sensitive tags for grouping
  encryptedData: string; // JSON string of { ciphertext, iv } representing secret fields
  updatedAt: number;     // Timestamp
}

export interface DBActivityLog {
  id: string;
  timestamp: number;
  encryptedData: string; // JSON string of { ciphertext, iv } representing event details
}

class LaBovedaDatabase {
  private db: IDBDatabase | null = null;

  init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (_event) => {
        const db = request.result;
        
        // Auth Info Store (Salt, Recovery Key configuration)
        if (!db.objectStoreNames.contains('auth_info')) {
          db.createObjectStore('auth_info', { keyPath: 'id' });
        }

        // Vault Items Store (Encrypted)
        if (!db.objectStoreNames.contains('items')) {
          const itemsStore = db.createObjectStore('items', { keyPath: 'id' });
          itemsStore.createIndex('type', 'type', { unique: false });
          itemsStore.createIndex('category', 'category', { unique: false });
          itemsStore.createIndex('favorite', 'favorite', { unique: false });
        }

        // File Payloads Store (Encrypted payload binaries separated to keep metadata retrieval light)
        if (!db.objectStoreNames.contains('file_payloads')) {
          db.createObjectStore('file_payloads', { keyPath: 'id' });
        }

        // Activity Logs Store
        if (!db.objectStoreNames.contains('activity_logs')) {
          const logsStore = db.createObjectStore('activity_logs', { keyPath: 'id' });
          logsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Generic helper for transaction
  private async getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.init();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- Auth Info Operations ---
  async getAuthInfo(): Promise<DBAuthInfo | null> {
    const store = await this.getStore('auth_info', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get('master_config');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveAuthInfo(info: DBAuthInfo): Promise<void> {
    const store = await this.getStore('auth_info', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(info);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- File Payloads Operations ---
  async saveFilePayload(_id: string, payload: { id: string; encryptedPayload: string }): Promise<void> {
    const store = await this.getStore('file_payloads', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(payload);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFilePayload(id: string): Promise<{ id: string; encryptedPayload: string } | null> {
    const store = await this.getStore('file_payloads', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFilePayload(id: string): Promise<void> {
    const store = await this.getStore('file_payloads', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Vault Items Operations ---
  async saveItem(item: DBVaultItem): Promise<void> {
    const store = await this.getStore('items', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteItem(id: string): Promise<void> {
    const store = await this.getStore('items', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllItems(): Promise<DBVaultItem[]> {
    const store = await this.getStore('items', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Activity Log Operations ---
  async addLog(log: DBActivityLog): Promise<void> {
    const store = await this.getStore('activity_logs', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLogs(): Promise<DBActivityLog[]> {
    const store = await this.getStore('activity_logs', 'readonly');
    return new Promise((resolve, reject) => {
      const index = store.index('timestamp');
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Automatically clears activity logs older than 30 days.
   * Runs on app initialization/login to prevent log bloating.
   */
  async autoCleanLogs(): Promise<number> {
    const db = await this.init();
    const transaction = db.transaction('activity_logs', 'readwrite');
    const store = transaction.objectStore('activity_logs');
    const index = store.index('timestamp');

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    // Query logs where timestamp is less than 30 days ago
    const range = IDBKeyRange.upperBound(thirtyDaysAgo);
    
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      request.onsuccess = (_event) => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Completely wipe the vault
  async wipeDatabase(): Promise<void> {
    const db = await this.init();
    db.close();
    this.db = null;
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const dbService = new LaBovedaDatabase();
