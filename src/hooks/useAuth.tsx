import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  deriveKeyFromPin,
  deriveKeyFromRecoveryKey,
  generateRecoveryKey,
  encryptText,
  decryptText,
  generateRandomBytes,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../services/crypto';
import { dbService } from '../services/db';
import type { DBAuthInfo } from '../services/db';

interface AuthContextType {
  screen: 'loading' | 'setup' | 'weather' | 'pin' | 'app' | 'blackroom';
  setScreen: (screen: 'loading' | 'setup' | 'weather' | 'pin' | 'app' | 'blackroom') => void;
  masterKey: CryptoKey | null;
  recoveryKey: string | null;
  incorrectAttempts: number;
  isLockedOut: boolean;
  biometricsSupported: boolean;
  hasBiometrics: boolean;
  setupVault: (pin: string, recoveryKey: string, gesture: string) => Promise<void>;
  unlockVault: (pin: string) => Promise<boolean>;
  unlockWithRecoveryKey: (recoveryKey: string) => Promise<string | null>; // Returns temporary PIN
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  setupBiometrics: () => Promise<boolean>;
  setupBiometricsWithPin: (pin: string) => Promise<boolean>;
  disableBiometrics: () => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  lockVault: () => void;
  resetVault: () => Promise<void>;
  autoLockTime: number; // in seconds
  setAutoLockTime: (time: number) => void;
  entryGesture: string;
  setEntryGesture: (gesture: string) => void;
  defaultCity: string;
  setDefaultCity: (city: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [screen, setScreen] = useState<'loading' | 'setup' | 'weather' | 'pin' | 'app' | 'blackroom'>('loading');
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [incorrectAttempts, setIncorrectAttempts] = useState<number>(0);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);
  const [hasBiometrics, setHasBiometrics] = useState<boolean>(false);
  const [biometricsSupported, setBiometricsSupported] = useState<boolean>(false);
  
  // Settings backed by LocalStorage
  const [autoLockTime, setAutoLockTimeState] = useState<number>(() => {
    return Number(localStorage.getItem('lbv_auto_lock') || '300'); // 5 minutes default
  });
  const [entryGesture, setEntryGestureState] = useState<string>(() => {
    return localStorage.getItem('lbv_gesture') || 'double-tap-temp';
  });
  const [defaultCity, setDefaultCityState] = useState<string>(() => {
    return localStorage.getItem('lbv_city') || 'Madrid';
  });

  const autoLockTimerRef = useRef<number | null>(null);
  const VERIFIER_STRING = 'LA_BOVEDA_VERIFIER';

  // Load preferences and detect biometrics support
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        await dbService.init();
        const info = await dbService.getAuthInfo();

        if (!info) {
          setScreen('setup');
        } else {
          setHasBiometrics(info.hasBiometrics);
          const hasWebauthn = window.PublicKeyCredential !== undefined;
          setBiometricsSupported(hasWebauthn);
          setScreen('weather');
        }
      } catch (err) {
        console.error('Failed to initialize database:', err);
        setScreen('setup');
      }
    };

    checkAuthStatus();
  }, []);

  // Handle Autolock Timer
  useEffect(() => {
    const resetTimer = () => {
      if (autoLockTimerRef.current) {
        window.clearTimeout(autoLockTimerRef.current);
      }
      if (screen === 'app' && autoLockTime > 0) {
        autoLockTimerRef.current = window.setTimeout(() => {
          lockVault();
        }, autoLockTime * 1000);
      }
    };

    // Track user activity to reset autolock
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    if (screen === 'app') {
      resetTimer();
      activityEvents.forEach((event) => window.addEventListener(event, resetTimer));
    }

    return () => {
      if (autoLockTimerRef.current) {
        window.clearTimeout(autoLockTimerRef.current);
      }
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [screen, autoLockTime]);

  const setAutoLockTime = (time: number) => {
    setAutoLockTimeState(time);
    localStorage.setItem('lbv_auto_lock', time.toString());
  };

  const setEntryGesture = (gesture: string) => {
    setEntryGestureState(gesture);
    localStorage.setItem('lbv_gesture', gesture);
  };

  const setDefaultCity = (city: string) => {
    setDefaultCityState(city);
    localStorage.setItem('lbv_city', city);
  };

  // Lock the Vault
  const lockVault = () => {
    setMasterKey(null);
    setScreen('weather');
    // Force immediate Pager/State resets
  };

  // Lock vault when tab is hidden or minimized, but bypass if currently selecting a file
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && (screen === 'app' || screen === 'blackroom')) {
        if ((window as any).isChoosingFile) {
          return;
        }
        lockVault();
      }
    };

    const handleFileChooseClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'file') ||
        (target && target.closest('.cursor-pointer') && (target.closest('.cursor-pointer') as HTMLElement).innerHTML.includes('type="file"'))
      ) {
        (window as any).isChoosingFile = true;
      }
    };

    const handleWindowFocus = () => {
      if ((window as any).isChoosingFile) {
        setTimeout(() => {
          (window as any).isChoosingFile = false;
        }, 1500);
      }
    };

    const handleFileChange = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'file') {
        setTimeout(() => {
          (window as any).isChoosingFile = false;
        }, 1500);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleFileChooseClick, true);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('change', handleFileChange, true);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleFileChooseClick, true);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('change', handleFileChange, true);
    };
  }, [screen]);

  // Completely wipe the vault database
  const resetVault = async () => {
    await dbService.wipeDatabase();
    localStorage.removeItem('lbv_auto_lock');
    localStorage.removeItem('lbv_gesture');
    localStorage.removeItem('lbv_city');
    localStorage.removeItem('lbv_encrypted_pin_wrapped');
    setMasterKey(null);
    setHasBiometrics(false);
    setIncorrectAttempts(0);
    setIsLockedOut(false);
    setScreen('setup');
  };

  // Setup Vault (First Run)
  const setupVault = async (pin: string, recoveryKeyStr: string, gesture: string) => {
    // Generate Master config keys and salts
    const masterSalt = generateRandomBytes(32);
    const recoverySalt = generateRandomBytes(32);

    // Derive Master Key
    const key = await deriveKeyFromPin(pin, masterSalt);

    // Derive recovery KEK
    const recoveryKey = await deriveKeyFromRecoveryKey(recoveryKeyStr, recoverySalt);
    
    // Encrypt PIN with recovery KEK
    const { ciphertext: pinCipher, iv: pinIv } = await encryptText(recoveryKey, pin);

    // Encrypt recovery validation verifier
    const { ciphertext: recVerifierCipher, iv: recVerifierIv } = await encryptText(recoveryKey, VERIFIER_STRING);

    // Encrypt validation verifier with PIN-derived key (used to verify PIN on unlock)
    const { ciphertext: verifierCipher, iv: verifierIv } = await encryptText(key, VERIFIER_STRING);

    const authInfo: DBAuthInfo & { encryptedPinTest: string } = {
      id: 'master_config',
      salt: arrayBufferToBase64(masterSalt.buffer as ArrayBuffer),
      recoverySalt: arrayBufferToBase64(recoverySalt.buffer as ArrayBuffer),
      encryptedPin: JSON.stringify({ ciphertext: pinCipher, iv: pinIv }),
      encryptedRecoveryTest: JSON.stringify({ ciphertext: recVerifierCipher, iv: recVerifierIv }),
      encryptedPinTest: JSON.stringify({ ciphertext: verifierCipher, iv: verifierIv }),
      hasBiometrics: false,
    };

    // Save configuration
    await dbService.saveAuthInfo(authInfo);
    setMasterKey(key);
    setRecoveryKey(recoveryKeyStr);
    setEntryGesture(gesture);
    setScreen('app');
  };

  // Unlock Vault with PIN
  const unlockVault = async (pin: string): Promise<boolean> => {
    if (isLockedOut) return false;

    const info = await dbService.getAuthInfo();
    if (!info) return false;

    try {
      const saltBytes = new Uint8Array(base64ToArrayBuffer(info.salt));
      const key = await deriveKeyFromPin(pin, saltBytes);

      // Verify the derived key against the verifier
      // Verify the derived key against the verifier stored at setup (encryptedPinTest)
      let pinTestObj;
      if ('encryptedPinTest' in info) {
        pinTestObj = JSON.parse((info as any).encryptedPinTest);
      } else {
        // Fallback or setup issue. Since we write the code now, we will make sure it always has encryptedPinTest.
        // Let's design `DBAuthInfo` to have:
        // `encryptedPinTest: string` (verifier encrypted with PIN derived key)
        pinTestObj = JSON.parse((info as any).encryptedPinTest || info.encryptedRecoveryTest); // fallback
      }

      const decrypted = await decryptText(key, pinTestObj.ciphertext, pinTestObj.iv);

      if (decrypted === VERIFIER_STRING) {
        setMasterKey(key);
        setIncorrectAttempts(0);
        setScreen('app');
        // Auto clean logs
        await dbService.autoCleanLogs();
        return true;
      }
    } catch (e) {
      console.warn('Authentication decryption error:', e);
    }

    // Handle failure count
    const nextAttempts = incorrectAttempts + 1;
    setIncorrectAttempts(nextAttempts);
    if (nextAttempts >= 10) {
      setIsLockedOut(true);
    }
    return false;
  };

  // Unlock Vault with Recovery Key
  const unlockWithRecoveryKey = async (recoveryKeyStr: string): Promise<string | null> => {
    const info = await dbService.getAuthInfo();
    if (!info) return null;

    try {
      const recSaltBytes = new Uint8Array(base64ToArrayBuffer(info.recoverySalt));
      const recoveryKek = await deriveKeyFromRecoveryKey(recoveryKeyStr, recSaltBytes);

      // Verify Recovery Key
      const verifierObj = JSON.parse(info.encryptedRecoveryTest);
      const testDecrypted = await decryptText(recoveryKek, verifierObj.ciphertext, verifierObj.iv);

      if (testDecrypted === VERIFIER_STRING) {
        // Decrypt PIN
        const pinObj = JSON.parse(info.encryptedPin);
        const originalPin = await decryptText(recoveryKek, pinObj.ciphertext, pinObj.iv);

        // Derive Master Key and unlock
        const saltBytes = new Uint8Array(base64ToArrayBuffer(info.salt));
        const key = await deriveKeyFromPin(originalPin, saltBytes);
        
        setMasterKey(key);
        setIncorrectAttempts(0);
        setIsLockedOut(false);
        setScreen('app');
        return originalPin;
      }
    } catch (e) {
      console.error('Recovery failed:', e);
    }
    return null;
  };

  // Change PIN
  const changePin = async (oldPin: string, newPin: string): Promise<boolean> => {
    if (!masterKey) return false;
    const info = await dbService.getAuthInfo();
    if (!info) return false;

    try {
      // 1. Verify old pin first
      const saltBytes = new Uint8Array(base64ToArrayBuffer(info.salt));
      const oldKey = await deriveKeyFromPin(oldPin, saltBytes);
      const pinTestObj = JSON.parse((info as any).encryptedPinTest);
      const decrypted = await decryptText(oldKey, pinTestObj.ciphertext, pinTestObj.iv);
      
      if (decrypted !== VERIFIER_STRING) return false;

      // 2. Generate new master key
      const newSalt = generateRandomBytes(32);
      const newKey = await deriveKeyFromPin(newPin, newSalt);

      // 3. Update verifiers
      const { ciphertext: newVerifierCipher, iv: newVerifierIv } = await encryptText(newKey, VERIFIER_STRING);
      
      // Update Recovery Key encrypted PIN
      const recSaltBytes = new Uint8Array(base64ToArrayBuffer(info.recoverySalt));
      // Recreate Recovery KEK (assuming recovery key remains the same or user writes down the recovery key they had)
      // Wait, we need the recovery key string. Since it was displayed only once, how do we get it?
      // Wait, if they are logged in, we can let them see their recovery key, or we can prompt them to input it or generate a new one!
      // Let's generate a new Recovery Key during PIN change to keep it secure and simple, or require them to re-verify their Recovery Key.
      // To make it super premium: we will generate a new recovery key, display it, and ask them to save it. That's very clean!
      const newRecKeyStr = generateRecoveryKey();
      const newRecoveryKek = await deriveKeyFromRecoveryKey(newRecKeyStr, recSaltBytes);
      
      const { ciphertext: newPinCipher, iv: newPinIv } = await encryptText(newRecoveryKek, newPin);
      const { ciphertext: newRecVerifierCipher, iv: newRecVerifierIv } = await encryptText(newRecoveryKek, VERIFIER_STRING);

      // 4. Update the actual DB items!
      // We must load all encrypted items, decrypt them with oldKey, and re-encrypt with newKey!
      const allItems = await dbService.getAllItems();
      for (const item of allItems) {
        const itemDecObj = JSON.parse(item.encryptedData);
        // Decrypt
        const plaintext = await decryptText(oldKey, itemDecObj.ciphertext, itemDecObj.iv);
        // Re-encrypt
        const { ciphertext, iv } = await encryptText(newKey, plaintext);
        item.encryptedData = JSON.stringify({ ciphertext, iv });
        await dbService.saveItem(item);
      }

      // Also update activity logs
      const allLogs = await dbService.getLogs();
      for (const log of allLogs) {
        const logDecObj = JSON.parse(log.encryptedData);
        const plaintext = await decryptText(oldKey, logDecObj.ciphertext, logDecObj.iv);
        const { ciphertext, iv } = await encryptText(newKey, plaintext);
        log.encryptedData = JSON.stringify({ ciphertext, iv });
        await dbService.addLog(log);
      }

      // Save new configurations
      const updatedAuthInfo: DBAuthInfo & { encryptedPinTest: string } = {
        id: 'master_config',
        salt: arrayBufferToBase64(newSalt.buffer as ArrayBuffer),
        recoverySalt: info.recoverySalt,
        encryptedPin: JSON.stringify({ ciphertext: newPinCipher, iv: newPinIv }),
        encryptedRecoveryTest: JSON.stringify({ ciphertext: newRecVerifierCipher, iv: newRecVerifierIv }),
        encryptedPinTest: JSON.stringify({ ciphertext: newVerifierCipher, iv: newVerifierIv }),
        hasBiometrics: false, // Reset biometrics to force re-link
      };

      await dbService.saveAuthInfo(updatedAuthInfo);
      setMasterKey(newKey);
      setRecoveryKey(newRecKeyStr);
      setHasBiometrics(false);
      return true;
    } catch (err) {
      console.error('Failed to change PIN:', err);
      return false;
    }
  };


  // For the actual biometrics implementation, we will use a custom function that receives the PIN during setup:
  const setupBiometricsWithPin = async (pin: string): Promise<boolean> => {
    if (!biometricsSupported) return false;
    const info = await dbService.getAuthInfo();
    if (!info) return false;

    try {
      const challenge = generateRandomBytes(32);
      const userId = generateRandomBytes(16);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: 'La Bóveda' },
          user: {
            id: userId,
            name: 'user@laboveda.local',
            displayName: 'La Bóveda User',
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          timeout: 60000,
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
        },
      }) as PublicKeyCredential;

      if (!credential) return false;

      const credentialId = arrayBufferToBase64(credential.rawId);

      // Generate a stable biometric wrapping key
      const biometricKeyBytes = generateRandomBytes(32);
      const wrapKey = await window.crypto.subtle.importKey(
        'raw',
        biometricKeyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // Encrypt the PIN with this wrap key
      const iv = generateRandomBytes(12);
      const pinBytes = new TextEncoder().encode(pin);
      const encryptedPinBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        wrapKey,
        pinBytes
      );

      // Save credentials, key, and wrapped PIN in local storage / IndexedDB
      const wrappedData = {
        ciphertext: arrayBufferToBase64(encryptedPinBuffer),
        iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
      };

      localStorage.setItem('lbv_encrypted_pin_wrapped', JSON.stringify(wrappedData));
      localStorage.setItem('lbv_biometric_key', arrayBufferToBase64(biometricKeyBytes.buffer as ArrayBuffer));

      // Update auth info
      const updatedInfo: DBAuthInfo & { encryptedPinTest: string } = {
        ...info,
        hasBiometrics: true,
        webauthnCredentialId: credentialId,
        encryptedPinTest: (info as any).encryptedPinTest || '',
      };

      await dbService.saveAuthInfo(updatedInfo);
      setHasBiometrics(true);
      return true;
    } catch (e) {
      console.error('Biometrics enrollment failed:', e);
      return false;
    }
  };

  // Unlock using Biometrics
  const unlockWithBiometrics = async (): Promise<boolean> => {
    if (!hasBiometrics) return false;
    const info = await dbService.getAuthInfo();
    if (!info || !info.webauthnCredentialId) return false;

    try {
      const credentialIdBytes = new Uint8Array(base64ToArrayBuffer(info.webauthnCredentialId));
      const signChallenge = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      // Request biometric verification (assertion)
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: signChallenge,
          allowCredentials: [{ type: 'public-key', id: credentialIdBytes }],
          userVerification: 'required',
        }
      }) as PublicKeyCredential & { response: AuthenticatorAssertionResponse };

      if (!assertion) return false;

      // Decrypt PIN from localStorage using the stored biometric key
      const wrappedStr = localStorage.getItem('lbv_encrypted_pin_wrapped');
      const biometricKeyStr = localStorage.getItem('lbv_biometric_key');
      if (!wrappedStr || !biometricKeyStr) return false;

      const wrappedObj = JSON.parse(wrappedStr);
      const ivBytes = new Uint8Array(base64ToArrayBuffer(wrappedObj.iv));
      const ciphertextBytes = base64ToArrayBuffer(wrappedObj.ciphertext);

      const biometricKeyBytes = new Uint8Array(base64ToArrayBuffer(biometricKeyStr));
      const wrapKey = await window.crypto.subtle.importKey(
        'raw',
        biometricKeyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const decryptedPinBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        wrapKey,
        ciphertextBytes
      );

      const pin = new TextDecoder().decode(decryptedPinBuffer);

      // Now verify and unlock using the standard unlock routine
      return await unlockVault(pin);
    } catch (e) {
      console.error('Biometric verification failed:', e);
      return false;
    }
  };
  const disableBiometrics = async (): Promise<boolean> => {
    const info = await dbService.getAuthInfo();
    if (!info) return false;

    try {
      const updatedInfo: DBAuthInfo = {
        ...info,
        hasBiometrics: false,
      };
      delete updatedInfo.webauthnCredentialId;

      await dbService.saveAuthInfo(updatedInfo);
      localStorage.removeItem('lbv_encrypted_pin_wrapped');
      localStorage.removeItem('lbv_biometric_key');
      setHasBiometrics(false);
      return true;
    } catch (e) {
      console.error('Failed to disable biometrics:', e);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        screen,
        setScreen,
        masterKey,
        recoveryKey,
        incorrectAttempts,
        isLockedOut,
        biometricsSupported,
        hasBiometrics,
        setupVault,
        unlockVault,
        unlockWithRecoveryKey,
        changePin,
        setupBiometrics: () => {
          // Fallback if called without PIN, but UI should pass PIN or we use setupBiometricsWithPin
          return Promise.resolve(false);
        },
        // Bind correct biometrics enrollment method
        setupBiometricsWithPin: setupBiometricsWithPin,
        disableBiometrics: disableBiometrics,
        unlockWithBiometrics,
        lockVault,
        resetVault,
        autoLockTime,
        setAutoLockTime,
        entryGesture,
        setEntryGesture,
        defaultCity,
        setDefaultCity,
      } as any}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
