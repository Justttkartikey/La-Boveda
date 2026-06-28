/**
 * La Bóveda Cryptographic Service
 * Powered by Web Crypto API
 * 
 * Provides:
 * - PBKDF2 Key Derivation (600,000 iterations, SHA-256)
 * - AES-GCM 256-bit symmetric encryption and decryption
 * - Recovery key generation & key derivation
 * - Base64 and ArrayBuffer serialization helpers
 */

// Custom helper: Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Custom helper: Convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert string to Uint8Array (UTF-8)
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to string (UTF-8)
export function bytesToString(bytes: ArrayBuffer): string {
  return new TextDecoder().decode(bytes);
}

// Generate cryptographically secure random bytes
export function generateRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length) as Uint8Array<ArrayBuffer>;
  window.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Derives a CryptoKey from a Master PIN and a salt using PBKDF2.
 * High iteration count (600,000) prevents fast dictionary/brute-force attacks.
 */
export async function deriveKeyFromPin(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);

  // Import the PIN as a raw key
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  // Derive a 256-bit AES-GCM key
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000, // Commercially graded PBKDF2 iteration strength
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // Key is non-extractable for safety
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives a CryptoKey from a Recovery Key and a salt.
 */
export async function deriveKeyFromRecoveryKey(recoveryKey: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const cleanKey = recoveryKey.replace(/[^A-Z0-9]/g, '');
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(cleanKey);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 200000, // Slightly lower due to high initial entropy of Recovery Key
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a high-entropy 20-character recovery key grouped in chunks:
 * e.g., LBVD-ABCD-EFGH-IJKL-MNOP
 */
export function generateRecoveryKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomValues = new Uint32Array(16);
  window.crypto.getRandomValues(randomValues);
  
  let key = 'LBVD';
  for (let i = 0; i < 16; i++) {
    if (i % 4 === 0) key += '-';
    const index = randomValues[i] % chars.length;
    key += chars[index];
  }
  return key;
}

/**
 * Encrypt a plaintext string using AES-GCM (256-bit)
 * Returns IV and Ciphertext as Base64 strings.
 */
export async function encryptText(key: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = generateRandomBytes(12); // GCM standard IV length is 12 bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    plaintextBytes
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt a ciphertext string using AES-GCM (256-bit)
 */
export async function decryptText(key: CryptoKey, ciphertext: string, iv: string): Promise<string> {
  const ivBuffer = base64ToArrayBuffer(iv);
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer),
    },
    key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypt a raw file buffer (ArrayBuffer)
 */
export async function encryptFile(key: CryptoKey, fileBuffer: ArrayBuffer): Promise<{ ciphertext: string; iv: string }> {
  const iv = generateRandomBytes(12);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    fileBuffer
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt a raw file buffer
 */
export async function decryptFile(key: CryptoKey, ciphertext: string, iv: string): Promise<ArrayBuffer> {
  const ivBuffer = base64ToArrayBuffer(iv);
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer),
    },
    key,
    ciphertextBuffer
  );

  return decryptedBuffer;
}
