import { StationTheme } from '../types';

export const STATIONS: StationTheme[] = [
  {
    id: 1,
    name: 'TRẠM 1 – KHÁM PHÁ',
    tag: 'Khám phá',
    icon: '🔬',
    colorName: 'Cyan & Xanh dương',
    primaryColor: '#00D9FF',
    secondaryColor: '#3B82F6',
    badgeBg: 'bg-cyan-950/70',
    badgeBorder: 'border-cyan-400/50',
    badgeText: 'text-cyan-300'
  },
  {
    id: 2,
    name: 'TRẠM 2 – THỬ THÁCH',
    tag: 'Thử thách',
    icon: '⚗️',
    colorName: 'Tím & Hồng',
    primaryColor: '#8B5CF6',
    secondaryColor: '#F472B6',
    badgeBg: 'bg-purple-950/70',
    badgeBorder: 'border-purple-400/50',
    badgeText: 'text-purple-300'
  },
  {
    id: 3,
    name: 'TRẠM 3 – BỨT PHÁ',
    tag: 'Bứt phá',
    icon: '🚀',
    colorName: 'Cam & Vàng',
    primaryColor: '#FB923C',
    secondaryColor: '#FACC15',
    badgeBg: 'bg-amber-950/70',
    badgeBorder: 'border-amber-400/50',
    badgeText: 'text-amber-300'
  },
  {
    id: 4,
    name: 'TRẠM CUỐI – CHINH PHỤC',
    tag: 'Chinh phục',
    icon: '👑',
    colorName: 'Xanh tím & Vàng hoàng kim',
    primaryColor: '#6366F1',
    secondaryColor: '#FACC15',
    badgeBg: 'bg-indigo-950/70',
    badgeBorder: 'border-yellow-400/60',
    badgeText: 'text-yellow-300'
  }
];

export function getStationForQuestion(index: number, total: number): StationTheme {
  if (total <= 1) return STATIONS[0];
  const progress = index / Math.max(1, total - 1);
  if (progress < 0.25) return STATIONS[0];
  if (progress < 0.55) return STATIONS[1];
  if (progress < 0.85) return STATIONS[2];
  return STATIONS[3];
}

export const EXP_PER_LEVEL = 500;

export function calculateLevelData(exp: number = 0) {
  const safeExp = Math.max(0, exp);
  const currentLevel = Math.floor(safeExp / EXP_PER_LEVEL) + 1;
  const currentLevelStartExp = (currentLevel - 1) * EXP_PER_LEVEL;
  const nextLevelExp = currentLevel * EXP_PER_LEVEL;
  const currentLevelProgressExp = safeExp - currentLevelStartExp;
  const progressPercent = Math.min(100, Math.round((currentLevelProgressExp / EXP_PER_LEVEL) * 100));

  return {
    level: currentLevel,
    currentExp: safeExp,
    currentLevelProgressExp,
    expToNextLevel: nextLevelExp - safeExp,
    nextLevelExp,
    progressPercent
  };
}

export function calculateEarnedExp(isCorrect: boolean, timeSpentSeconds: number, timeLimitSeconds: number, streak: number = 0) {
  if (!isCorrect) {
    return 15; // Khuyến khích tham gia nỗ lực
  }
  let baseExp = 100;
  // Speed bonus: up to 50 EXP if answered in under 30% of time limit
  const speedRatio = Math.max(0, Math.min(1, 1 - (timeSpentSeconds / (timeLimitSeconds || 30))));
  const speedBonus = Math.round(speedRatio * 50);
  const streakBonus = Math.min(60, streak * 15);
  return baseExp + speedBonus + streakBonus;
}

export type PowerUpType = 'DOUBLE_POINTS' | 'FREEZE_OPTION' | 'SHIELD';

export interface PowerUpDef {
  id: PowerUpType;
  name: string;
  icon: string;
  desc: string;
  costPercent: number;
  unlockedAtExp: number;
  badgeColor: string;
  glowColor: string;
}

export const POWER_UPS: PowerUpDef[] = [
  {
    id: 'DOUBLE_POINTS',
    name: 'NHÂN ĐÔI ĐIỂM',
    icon: '⚡',
    desc: 'Nhân đôi số điểm nhận được ở câu trả lời tiếp theo!',
    costPercent: 20,
    unlockedAtExp: 150,
    badgeColor: 'from-amber-500 to-yellow-400 text-slate-950',
    glowColor: 'shadow-[0_0_20px_rgba(250,204,21,0.5)]'
  },
  {
    id: 'FREEZE_OPTION',
    name: 'KHÓA ĐÁP ÁN',
    icon: '🔮',
    desc: 'Loại bỏ ngay 1 đáp án sai để tăng cơ hội chính xác!',
    costPercent: 40,
    unlockedAtExp: 350,
    badgeColor: 'from-purple-500 to-cyan-400 text-slate-950',
    glowColor: 'shadow-[0_0_20px_rgba(0,217,255,0.5)]'
  },
  {
    id: 'SHIELD',
    name: 'CƯỚP LƯỢT / BẢO VỆ',
    icon: '👑',
    desc: 'Khiên bảo toàn điểm và duy trì chuỗi Streak nếu lỡ trả lời sai!',
    costPercent: 80,
    unlockedAtExp: 700,
    badgeColor: 'from-rose-500 to-amber-400 text-slate-950',
    glowColor: 'shadow-[0_0_20px_rgba(244,63,94,0.5)]'
  }
];

export function getPlayerTitle(rank: number, totalStudents: number): { title: string; badge: string; color: string } {
  if (rank === 1) return { title: 'NGƯỜI DẪN ĐẦU', badge: '🥇', color: 'from-yellow-400 to-amber-500' };
  if (rank === 2) return { title: 'CHIẾN BINH KHOA HỌC', badge: '🥈', color: 'from-slate-200 to-cyan-300' };
  if (rank === 3) return { title: 'NHÀ KHÁM PHÁ', badge: '🥉', color: 'from-amber-600 to-orange-400' };
  if (rank <= 5) return { title: 'TINH ANH PHÒNG THI', badge: '⭐', color: 'from-purple-400 to-pink-400' };
  if (rank <= 10) return { title: 'HIỆP SĨ TRI THỨC', badge: '⚡', color: 'from-teal-400 to-emerald-400' };
  return { title: 'NHÀ KHOA HỌC TRẺ', badge: '🔬', color: 'from-blue-400 to-indigo-400' };
}
