/**
 * Anti-Cheat & Screen-Switching Protection Utility
 * 
 * Quy tắc mới:
 * - Chuyển màn hình lần 1, 2: Cảnh báo
 * - Chuyển màn hình lần 3: Tạm dừng chơi 30 giây (thay vì 30 phút)
 * - Chuyển màn hình lần 4 trở đi: Tạm dừng chơi 90 giây
 */

export const MAX_TAB_VIOLATIONS = 3;

export const STORAGE_LOCKOUT_KEY = 'EXAM_ANTI_CHEAT_LOCKOUT';
export const STORAGE_VIOLATIONS_KEY = 'EXAM_ANTI_CHEAT_VIOLATIONS';

export interface LockoutInfo {
  isLocked: boolean;
  remainingSeconds: number;
  reason: string;
  lockedAt: number;
  unlockAt: number;
  violationCount: number;
}

/**
 * Checks if the current user/device is temporarily paused from playing
 */
export function checkExamLockout(): LockoutInfo {
  try {
    const raw = localStorage.getItem(STORAGE_LOCKOUT_KEY);
    if (!raw) {
      return { isLocked: false, remainingSeconds: 0, reason: '', lockedAt: 0, unlockAt: 0, violationCount: 0 };
    }

    const data = JSON.parse(raw);
    const now = Date.now();

    if (now < data.unlockAt) {
      const remaining = Math.max(0, Math.ceil((data.unlockAt - now) / 1000));
      return {
        isLocked: true,
        remainingSeconds: remaining,
        reason: data.reason || 'Đang trong thời gian tạm dừng làm bài',
        lockedAt: data.lockedAt,
        unlockAt: data.unlockAt,
        violationCount: data.violationCount || 3,
      };
    } else {
      // Lockout expired - automatically clear lockout
      localStorage.removeItem(STORAGE_LOCKOUT_KEY);
      return { isLocked: false, remainingSeconds: 0, reason: '', lockedAt: 0, unlockAt: 0, violationCount: data.violationCount || 0 };
    }
  } catch (e) {
    return { isLocked: false, remainingSeconds: 0, reason: '', lockedAt: 0, unlockAt: 0, violationCount: 0 };
  }
}

/**
 * Trigger temporary pause: 30s for 3rd violation, 90s for 4th+ violation
 */
export function triggerExamLockout(violationCountOrReason?: number | string): LockoutInfo {
  const now = Date.now();
  const violationCount = typeof violationCountOrReason === 'number' ? violationCountOrReason : 3;
  // Lần 3: dừng chơi 30 giây. Lần 4 trở đi: dừng chơi 90 giây
  const durationSeconds = violationCount >= 4 ? 90 : 30;
  const durationMs = durationSeconds * 1000;
  const unlockAt = now + durationMs;

  const defaultReason = violationCount >= 4 
    ? `Tạm dừng chơi ${durationSeconds} giây do chuyển màn hình lần thứ ${violationCount}`
    : `Tạm dừng chơi 30 giây do chuyển màn hình lần thứ 3`;

  const reason = typeof violationCountOrReason === 'string' ? violationCountOrReason : defaultReason;

  const data = {
    lockedAt: now,
    unlockAt,
    reason,
    violationCount,
  };

  try {
    localStorage.setItem(STORAGE_LOCKOUT_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to write lockout to localStorage', e);
  }

  return {
    isLocked: true,
    remainingSeconds: durationSeconds,
    reason,
    lockedAt: now,
    unlockAt,
    violationCount,
  };
}

/**
 * Clears lockout when time expires
 */
export function clearExamLockout(): void {
  try {
    localStorage.removeItem(STORAGE_LOCKOUT_KEY);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Format remaining seconds into SSs or MM:SS
 */
export function formatLockoutCountdown(seconds: number): string {
  if (seconds <= 0) return '00s';
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
