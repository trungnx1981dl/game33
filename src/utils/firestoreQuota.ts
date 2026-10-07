// Utility to detect and handle Firebase Firestore Quota limits gracefully

type QuotaListener = (exceeded: boolean, errorDetails?: string) => void;

class FirestoreQuotaTracker {
  private isExceeded: boolean = false;
  private errorDetails: string = '';
  private listeners: Set<QuotaListener> = new Set();

  public getIsExceeded(): boolean {
    return this.isExceeded;
  }

  public getErrorDetails(): string {
    return this.errorDetails;
  }

  public reportError(err: any): boolean {
    if (!err) return false;
    const msg = String(err?.message || err?.code || err);
    const isQuota = 
      msg.includes('resource-exhausted') || 
      msg.includes('Quota limit exceeded') || 
      msg.includes('Quota exceeded') ||
      err?.code === 'resource-exhausted';

    if (isQuota) {
      this.isExceeded = true;
      this.errorDetails = msg;
      this.notify();
      return true;
    }
    return false;
  }

  public subscribe(listener: QuotaListener): () => void {
    this.listeners.add(listener);
    if (this.isExceeded) {
      listener(true, this.errorDetails);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public clear(): void {
    this.isExceeded = false;
    this.errorDetails = '';
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach(l => {
      try {
        l(this.isExceeded, this.errorDetails);
      } catch (e) {
        console.warn('Quota listener error:', e);
      }
    });
  }
}

export const firestoreQuota = new FirestoreQuotaTracker();

export const checkIsQuotaError = (err: any): boolean => {
  if (!err) return false;
  const msg = String(err?.message || err?.code || err);
  return (
    msg.includes('resource-exhausted') || 
    msg.includes('Quota limit exceeded') || 
    msg.includes('Quota exceeded') ||
    err?.code === 'resource-exhausted'
  );
};

export const FIRESTORE_UPGRADE_URL = "https://console.firebase.google.com/project/genial-blueprint-89brs/firestore/databases/ai-studio-remixremixremixg-fe9433ec-db0b-48ef-b3cb-55795bc99236/data?openUpgradeDialog=true";
export const FIRESTORE_PRICING_URL = "https://firebase.google.com/pricing#cloud-firestore";
