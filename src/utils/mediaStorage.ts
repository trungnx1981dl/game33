/**
 * IndexedDB Media Storage Utility
 * 
 * Safely stores large media assets (Audio files, Base64 audio/video data)
 * without hitting the strict 5MB quota of browser localStorage.
 */

const DB_NAME = 'khtn_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_store';

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveMediaItem(key: string, value: string): Promise<boolean> {
  try {
    const db = await openMediaDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => {
        console.warn('IndexedDB put error:', e);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('Could not save media item to IndexedDB:', err);
    return false;
  }
}

export async function getMediaItem(key: string): Promise<string | null> {
  try {
    const db = await openMediaDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

export async function removeMediaItem(key: string): Promise<void> {
  try {
    const db = await openMediaDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    // silent
  }
}
