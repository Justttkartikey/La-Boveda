import { useState, useEffect, useRef } from 'react';

/**
 * Hook to manage copying values to the clipboard.
 * Automatically clears the clipboard after a specified duration to prevent exposure.
 */
export function useClipboard() {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearClipboard = async () => {
    try {
      // Overwrite the clipboard with empty text
      await navigator.clipboard.writeText('');
      setCopiedText(null);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {
      console.warn('Failed to clear clipboard. Device may have blocked background clipboard access.', err);
    }
  };

  const copyToClipboard = async (text: string, clearDelaySeconds: number = 30) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);

      // Reset any existing clear timers
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      // Schedule auto-clear
      if (clearDelaySeconds > 0) {
        timerRef.current = window.setTimeout(() => {
          clearClipboard();
        }, clearDelaySeconds * 1000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    copiedText,
    copyToClipboard,
    clearClipboard,
  };
}
