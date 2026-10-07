import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { saveMediaItem, getMediaItem, removeMediaItem } from './mediaStorage';

export interface SystemConfig {
  practiceEnabled: boolean;
  lockMessage?: string;
  openingAudioUrl?: string;
  updatedAt?: number;
  updatedBy?: string;
}

const SETTINGS_DOC_ID = 'app_config';
const LOCAL_STORAGE_KEY = 'khtn_practice_enabled';
const LOCAL_STORAGE_MSG_KEY = 'khtn_practice_lock_message';
const LOCAL_STORAGE_AUDIO_KEY = 'khtn_opening_audio_url';

// Initial state as requested by user: "Tạm khóa" (false)
export const DEFAULT_PRACTICE_ENABLED = false;
export const DEFAULT_LOCK_MESSAGE = 'Tính năng Tự Luyện hiện đang tạm khóa bởi Quản trị viên. Học sinh vui lòng tham gia phòng thi trực tiếp do Giáo viên tổ chức hoặc quay lại sau!';
export const DEFAULT_OPENING_AUDIO_URL = '';

let inMemoryOpeningAudioUrl: string = '';

// Clean up any oversized audio stored in localStorage from earlier versions to free up browser quota
if (typeof window !== 'undefined') {
  try {
    const existingAudio = localStorage.getItem(LOCAL_STORAGE_AUDIO_KEY);
    if (existingAudio && existingAudio.length > 50000) {
      inMemoryOpeningAudioUrl = existingAudio;
      saveMediaItem(LOCAL_STORAGE_AUDIO_KEY, existingAudio).then(() => {
        try {
          localStorage.removeItem(LOCAL_STORAGE_AUDIO_KEY);
        } catch (_) {}
      });
    }
  } catch (_) {}
}

export function getCachedPracticeStatus(): boolean {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached === null) {
      return DEFAULT_PRACTICE_ENABLED;
    }
    return cached === 'true';
  } catch (e) {
    return DEFAULT_PRACTICE_ENABLED;
  }
}

export function getCachedLockMessage(): string {
  try {
    return localStorage.getItem(LOCAL_STORAGE_MSG_KEY) || DEFAULT_LOCK_MESSAGE;
  } catch (e) {
    return DEFAULT_LOCK_MESSAGE;
  }
}

export function getCachedOpeningAudioUrl(): string {
  if (inMemoryOpeningAudioUrl) {
    return inMemoryOpeningAudioUrl;
  }
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_AUDIO_KEY);
    if (cached) {
      inMemoryOpeningAudioUrl = cached;
      return cached;
    }
  } catch (e) {
    console.warn('Could not read audio URL from localStorage:', e);
  }
  return DEFAULT_OPENING_AUDIO_URL;
}

/**
 * Asynchronously loads the opening audio URL from IndexedDB (for large audio files) or localStorage
 */
export async function loadOpeningAudioUrlAsync(): Promise<string> {
  if (inMemoryOpeningAudioUrl) {
    return inMemoryOpeningAudioUrl;
  }
  // Try IndexedDB first (can store multi-megabyte audio files without quota error)
  const fromIndexedDb = await getMediaItem(LOCAL_STORAGE_AUDIO_KEY);
  if (fromIndexedDb) {
    inMemoryOpeningAudioUrl = fromIndexedDb;
    return fromIndexedDb;
  }
  // Fallback to localStorage
  try {
    const fromLocal = localStorage.getItem(LOCAL_STORAGE_AUDIO_KEY);
    if (fromLocal) {
      inMemoryOpeningAudioUrl = fromLocal;
      return fromLocal;
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_OPENING_AUDIO_URL;
}

export async function setOpeningAudioUrlInDb(audioUrl: string): Promise<void> {
  inMemoryOpeningAudioUrl = audioUrl;

  // 1. Always store safely in IndexedDB (handles multi-megabyte audio without quota limits)
  if (audioUrl) {
    await saveMediaItem(LOCAL_STORAGE_AUDIO_KEY, audioUrl);
  } else {
    await removeMediaItem(LOCAL_STORAGE_AUDIO_KEY);
  }

  // 2. Safe localStorage storage: ONLY store short URLs (e.g. web URLs < 50KB) to prevent quota error
  try {
    if (!audioUrl) {
      localStorage.removeItem(LOCAL_STORAGE_AUDIO_KEY);
    } else if (audioUrl.length < 50000) {
      localStorage.setItem(LOCAL_STORAGE_AUDIO_KEY, audioUrl);
    } else {
      // Large base64 data URI: Remove from localStorage so it doesn't exceed 5MB quota
      localStorage.removeItem(LOCAL_STORAGE_AUDIO_KEY);
    }
  } catch (e) {
    // If quota exceeded, ensure the key is removed from localStorage
    try {
      localStorage.removeItem(LOCAL_STORAGE_AUDIO_KEY);
    } catch (_) {}
    console.warn('localStorage quota exceeded, audio saved safely in IndexedDB instead:', e);
  }

  // 3. Sync to Firestore if within 800KB (Firestore has 1MB document limit)
  if (audioUrl.length < 800000) {
    try {
      const configRef = doc(db, 'settings', SETTINGS_DOC_ID);
      await setDoc(configRef, {
        openingAudioUrl: audioUrl,
        updatedAt: Date.now(),
        updatedBy: 'admin'
      }, { merge: true });
    } catch (error) {
      console.warn('Could not sync opening audio to Firestore:', error);
    }
  } else {
    console.info('Audio file is stored locally in IndexedDB (exceeds Firestore 1MB doc limit)');
  }
}

export async function setPracticeEnabledInDb(enabled: boolean, lockMessage?: string): Promise<void> {
  // Update local cache safely
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, String(enabled));
    const finalMessage = lockMessage || (enabled ? '' : getCachedLockMessage());
    if (finalMessage) {
      localStorage.setItem(LOCAL_STORAGE_MSG_KEY, finalMessage);
    }
  } catch (e) {
    console.warn('Could not write practice status to localStorage:', e);
  }

  const finalMessage = lockMessage || (enabled ? '' : getCachedLockMessage());

  try {
    const configRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(configRef, {
      practiceEnabled: enabled,
      lockMessage: finalMessage,
      updatedAt: Date.now(),
      updatedBy: 'admin'
    }, { merge: true });
  } catch (error) {
    console.warn('Could not sync practice status to Firestore (using local fallback):', error);
  }
}

export function usePracticeStatus() {
  const [isPracticeEnabled, setIsPracticeEnabled] = useState<boolean>(() => getCachedPracticeStatus());
  const [lockMessage, setLockMessage] = useState<string>(() => getCachedLockMessage());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Listen for real-time Firestore updates
    const configRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const enabled = typeof data.practiceEnabled === 'boolean' ? data.practiceEnabled : DEFAULT_PRACTICE_ENABLED;
        const msg = data.lockMessage || DEFAULT_LOCK_MESSAGE;
        setIsPracticeEnabled(enabled);
        setLockMessage(msg);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, String(enabled));
          localStorage.setItem(LOCAL_STORAGE_MSG_KEY, msg);
        } catch (e) {
          // ignore quota
        }
      } else {
        // Use default without writing back to Firestore inside onSnapshot (prevents infinite write loops)
        setIsPracticeEnabled(DEFAULT_PRACTICE_ENABLED);
        setLockMessage(DEFAULT_LOCK_MESSAGE);
      }
      setLoading(false);
    }, (err) => {
      console.warn('Firestore onSnapshot error for settings/app_config:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { isPracticeEnabled, lockMessage, loading, setPracticeStatus: setPracticeEnabledInDb };
}
