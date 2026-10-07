import React from 'react';
import { ShieldAlert, AlertTriangle, Clock, Sparkles } from 'lucide-react';
import { formatLockoutCountdown } from '../utils/antiCheat';

interface AntiCheatWarningModalProps {
  isOpen: boolean;
  violationCount: number;
  onAcknowledge: () => void;
  isDisqualified?: boolean;
  remainingSeconds?: number;
  onGoHome?: () => void;
}

export const AntiCheatWarningModal: React.FC<AntiCheatWarningModalProps> = ({
  isOpen,
  violationCount,
  onAcknowledge,
  remainingSeconds = 0,
}) => {
  if (!isOpen) return null;

  const isPauseActive = violationCount >= 3;
  const isTimeUp = remainingSeconds <= 0;
  const pauseDurationLabel = violationCount >= 4 ? '90 Giây' : '30 Giây';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div 
        className={`w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border relative overflow-hidden transition-all text-center ${
          isPauseActive
            ? 'bg-slate-900 border-rose-500/60 shadow-[0_0_60px_rgba(244,63,94,0.35)]' 
            : violationCount === 2
            ? 'bg-slate-900 border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.25)]'
            : 'bg-slate-900 border-yellow-500/40 shadow-[0_0_40px_rgba(234,179,8,0.2)]'
        }`}
      >
        {/* Ambient background glow */}
        <div 
          className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            isPauseActive ? 'bg-rose-500/25' : 'bg-amber-500/20'
          }`} 
        />

        {/* Header Icon */}
        <div className="relative mb-4 flex justify-center">
          <div 
            className={`w-18 h-18 rounded-3xl flex items-center justify-center shadow-lg border ${
              isPauseActive 
                ? 'bg-rose-500/20 border-rose-400/40 text-rose-400 animate-pulse' 
                : violationCount === 2
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-400'
                : 'bg-yellow-500/20 border-yellow-400/40 text-yellow-400'
            }`}
          >
            {isPauseActive ? (
              <Clock className="w-9 h-9" />
            ) : (
              <ShieldAlert className="w-9 h-9" />
            )}
          </div>
        </div>

        {/* Status Tag */}
        <div className="mb-2.5">
          <span 
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
              isPauseActive 
                ? 'bg-rose-500/25 border-rose-400/50 text-rose-300' 
                : violationCount === 2
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {isPauseActive
              ? `TẠM DỪNG CHƠI ${pauseDurationLabel.toUpperCase()} (VI PHẠM LẦN ${violationCount})`
              : `CẢNH BÁO VI PHẠM: LẦN ${violationCount}/2`
            }
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
          {isPauseActive
            ? (violationCount >= 4 ? 'TẠM DỪNG CHƠI 90 GIÂY!' : 'TẠM DỪNG CHƠI 30 GIÂY!')
            : violationCount === 2
            ? 'CẢNH BÁO NGUY CƠ CAO (LẦN 2)!'
            : 'CẢNH BÁO RỜI MÀN HÌNH (LẦN 1)!'
          }
        </h2>

        {/* Description Message */}
        <div className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6 bg-slate-950/60 p-4 rounded-2xl border border-white/10 text-left space-y-2">
          {isPauseActive ? (
            <>
              <p className="font-semibold text-rose-300">
                Bạn vừa rời khỏi màn hình bài thi lần thứ {violationCount}.
              </p>
              <p className="text-xs text-slate-300">
                Theo quy định, bạn bị <strong className="text-rose-400">tạm dừng chơi {pauseDurationLabel}</strong>. Điểm số và tiến trình của bạn vẫn được bảo lưu nguyên vẹn.
              </p>
              {/* Countdown Timer Box */}
              <div className="mt-3 p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
                  <Clock className="w-4 h-4 text-rose-400 animate-spin" />
                  <span>Thời gian tạm dừng còn lại:</span>
                </div>
                <span className="font-mono text-xl font-black text-yellow-300">
                  {formatLockoutCountdown(remainingSeconds)}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold text-amber-200">
                Bạn vừa chuyển sang tab khác hoặc ứng dụng khác!
              </p>
              <p className="text-xs text-slate-300">
                Quy chế yêu cầu làm bài tập trung. Chú ý:
              </p>
              <ul className="text-[11px] text-slate-300 list-disc list-inside space-y-1">
                <li>Chuyển màn hình lần 3: <strong className="text-amber-300">Dừng chơi 30 giây</strong></li>
                <li>Chuyển màn hình lần 4 trở đi: <strong className="text-rose-400">Dừng chơi 90 giây</strong></li>
              </ul>
            </>
          )}
        </div>

        {/* Actions */}
        {isPauseActive ? (
          <div>
            {isTimeUp ? (
              <button
                onClick={onAcknowledge}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-2xl font-black text-sm shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>⚡ HẾT THỜI GIAN TẠM DỪNG • TIẾP TỤC BÀI THI</span>
              </button>
            ) : (
              <button
                disabled
                className="w-full py-3.5 bg-slate-800 text-slate-400 border border-white/10 rounded-2xl font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>Đang tạm dừng chơi (Còn {remainingSeconds}s)...</span>
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onAcknowledge}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 rounded-2xl font-black text-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>Tôi đã hiểu & Tiếp tục làm bài</span>
          </button>
        )}
      </div>
    </div>
  );
};

interface ExamLockoutScreenProps {
  remainingSeconds: number;
  reason?: string;
  onRefresh?: () => void;
}

export const ExamLockoutScreen: React.FC<ExamLockoutScreenProps> = ({
  remainingSeconds,
  reason = 'Đang trong thời gian tạm dừng làm bài',
  onRefresh,
}) => {
  const isTimeUp = remainingSeconds <= 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex items-center justify-center relative overflow-hidden select-none">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/95 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(244,63,94,0.3)] text-center relative z-10 space-y-5">
        <div className="w-18 h-18 rounded-3xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center mx-auto text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.3)]">
          <Clock className="w-9 h-9" />
        </div>

        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 border border-rose-400/40 text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            TẠM DỪNG CHƠI
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Thời Gian Tạm Dừng Làm Bài
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-2xl border border-white/10">
            {reason}
          </p>
        </div>

        {/* Real-time countdown box */}
        <div className="p-4 bg-rose-950/60 border border-rose-500/40 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-center gap-2 text-rose-300 text-xs uppercase tracking-wider font-bold">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>Thời gian mở lại</span>
          </div>
          <div className="text-4xl font-black text-yellow-300 font-mono tracking-wider">
            {formatLockoutCountdown(remainingSeconds)}
          </div>
        </div>

        <div className="pt-2">
          {isTimeUp ? (
            <button
              onClick={onRefresh}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-2xl font-black text-sm shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>⚡ ĐÃ HẾT THỜI GIAN • TIẾP TỤC BÀI THI</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400">
              Vui lòng giữ nguyên màn hình để bộ đếm ngược hoàn tất.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
