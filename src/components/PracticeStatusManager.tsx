import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  MessageSquare, 
  Info,
  ShieldCheck
} from 'lucide-react';
import { usePracticeStatus, DEFAULT_LOCK_MESSAGE } from '../utils/systemConfig';

export default function PracticeStatusManager({ onToast }: { onToast?: (msg: string) => void }) {
  const { isPracticeEnabled, lockMessage, loading, setPracticeStatus } = usePracticeStatus();
  const [customMsg, setCustomMsg] = useState(lockMessage || DEFAULT_LOCK_MESSAGE);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMsgInput, setShowMsgInput] = useState(false);

  useEffect(() => {
    if (lockMessage) {
      setCustomMsg(lockMessage);
    }
  }, [lockMessage]);

  const handleToggle = async () => {
    setIsUpdating(true);
    const nextState = !isPracticeEnabled;
    try {
      await setPracticeStatus(nextState, customMsg.trim() || DEFAULT_LOCK_MESSAGE);
      if (onToast) {
        onToast(nextState ? 'Đã MỞ tính năng Tự Luyện cho học sinh!' : 'Đã TẠM KHÓA tính năng Tự Luyện thành công!');
      }
    } catch (e: any) {
      alert('Lỗi cập nhật trạng thái: ' + (e?.message || 'Không thể đồng bộ'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveMessage = async () => {
    setIsUpdating(true);
    try {
      await setPracticeStatus(isPracticeEnabled, customMsg.trim() || DEFAULT_LOCK_MESSAGE);
      if (onToast) {
        onToast('Đã lưu thông báo hiển thị cho học sinh khi tự luyện bị khóa!');
      }
      setShowMsgInput(false);
    } catch (e: any) {
      alert('Lỗi lưu thông báo: ' + (e?.message || 'Không thể đồng bộ'));
    } finally {
      setIsUpdating(false);
    }
  };

  const setPresetMessage = (msg: string) => {
    setCustomMsg(msg);
  };

  return (
    <div className={`p-6 rounded-3xl border transition-all duration-300 shadow-sm ${
      isPracticeEnabled 
        ? 'bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/50 border-emerald-200' 
        : 'bg-gradient-to-r from-amber-50/80 via-white to-orange-50/50 border-amber-300'
    }`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        
        {/* Left Side: Status Info & Explanation */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs text-slate-700">
              <SlidersHorizontal className="w-5 h-5 text-teal-600" />
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              Quản trị Tính Năng Tự Luyện
            </h3>

            {/* Live State Badge */}
            {isPracticeEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black uppercase tracking-wide animate-in fade-in">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>🟢 Đang Mở (Học sinh tự do ôn tập)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black uppercase tracking-wide animate-in fade-in">
                <Lock className="w-3 h-3 text-amber-700" />
                <span>🔴 Tạm Khóa (Học sinh không thể tự luyện)</span>
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            {isPracticeEnabled 
              ? 'Học sinh đang có thể truy cập chế độ Tự Luyện để làm đề độc lập. Bạn có thể tạm khóa tính năng này khi muốn tập trung toàn bộ học sinh vào phòng thi trực tiếp của lớp.' 
              : 'Tính năng Tự Luyện hiện đang bị tạm khóa. Khi học sinh bấm vào Tự Luyện, hệ thống sẽ hiển thị thông báo khóa và hướng dẫn tham gia phòng thi của Giáo viên.'}
          </p>

          {!isPracticeEnabled && customMsg && (
            <div className="inline-flex items-center gap-2 text-xs text-amber-800 bg-amber-100/60 border border-amber-200 px-3 py-1.5 rounded-xl font-medium">
              <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
              <span className="truncate max-w-xl">Thông báo khóa đang hiện: "{customMsg}"</span>
            </div>
          )}
        </div>

        {/* Right Side: Primary Toggle Switch & Quick Action */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowMsgInput(!showMsgInput)}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Tùy chỉnh câu thông báo khóa hiển thị cho học sinh"
          >
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <span>{showMsgInput ? 'Đóng tùy chỉnh' : 'Sửa thông báo khóa'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggle}
            disabled={isUpdating || loading}
            className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-98 disabled:opacity-50 ${
              isPracticeEnabled
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
            }`}
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang đồng bộ...</span>
              </>
            ) : isPracticeEnabled ? (
              <>
                <Lock className="w-4 h-4" />
                <span>TẠM KHÓA TỰ LUYỆN</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>MỞ TÍNH NĂNG TỰ LUYỆN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Custom Lock Message Editor */}
      {showMsgInput && (
        <div className="mt-5 pt-5 border-t border-slate-200/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Nội dung thông báo gửi tới học sinh khi tính năng bị tạm khóa:
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              placeholder="Nhập thông báo gửi tới học sinh..."
              className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none font-medium"
            />
            <button
              type="button"
              onClick={handleSaveMessage}
              disabled={isUpdating}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex-shrink-0"
            >
              Lưu thông báo
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Gợi ý nhanh:</span>
            <button
              type="button"
              onClick={() => setPresetMessage('Đang trong giờ kiểm tra trực tiếp toàn lớp. Các em hãy vào phòng thi bằng Mã học sinh của mình!')}
              className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 transition-colors cursor-pointer text-[11px]"
            >
              🕒 Giờ thi toàn lớp
            </button>
            <button
              type="button"
              onClick={() => setPresetMessage('Tính năng Tự Luyện đang được tạm dừng để cập nhật ngân hàng câu hỏi chuẩn GDPT 2018.')}
              className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 transition-colors cursor-pointer text-[11px]"
            >
              🛠️ Cập nhật ngân hàng đề
            </button>
            <button
              type="button"
              onClick={() => setPresetMessage(DEFAULT_LOCK_MESSAGE)}
              className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 transition-colors cursor-pointer text-[11px]"
            >
              🔄 Mặc định
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
