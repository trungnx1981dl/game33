import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, AlertCircle, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { firestoreQuota } from '../utils/firestoreQuota';

export default function GlobalHomeButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  // Không hiển thị ở trang chủ
  if (location.pathname === '/') {
    return null;
  }

  // Các trang nhạy cảm cần xác nhận trước khi thoát (đang làm bài hoặc đang làm host)
  const isSensitivePage = 
    location.pathname.startsWith('/player') || 
    location.pathname.startsWith('/practice') || 
    location.pathname.startsWith('/host');

  const handleHomeClick = () => {
    if (isSensitivePage) {
      setShowConfirm(true);
    } else {
      navigate('/');
    }
  };

  const handleConfirmExit = async () => {
    setShowConfirm(false);
    
    // Nếu là Giáo viên đang thoát khỏi phiên thi đấu, cập nhật status: CLOSED, isClosed: true để toàn bộ học sinh và giám khảo dừng lại ngay và chuẩn bị game mới
    if (location.pathname.startsWith('/host')) {
      const searchParams = new URLSearchParams(location.search);
      let targetSessionId = searchParams.get('session');
      if (!targetSessionId) {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('active_host_session_')) {
            targetSessionId = sessionStorage.getItem(key);
            break;
          }
        }
      }
      if (targetSessionId) {
        try {
          await updateDoc(doc(db, 'sessions', targetSessionId), {
            status: 'CLOSED',
            isClosed: true,
            hostLeft: true,
            endedAt: Date.now(),
            announcement: {
              message: '🔔 Giáo viên đã kết thúc phiên game và quay về trang chủ để chuẩn bị game mới.',
              type: 'info',
              timestamp: Date.now()
            }
          });
        } catch (e) {
          firestoreQuota.reportError(e);
          console.warn('Could not close session on exit:', e);
        }
      }
      // Xóa toàn bộ session host đã lưu trong sessionStorage
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('active_host_session_')) {
          sessionStorage.removeItem(key);
        }
      }
    }

    navigate('/');
  };

  return (
    <>
      {/* Floating Home Button */}
      <div className="fixed top-3 left-3 sm:top-4 sm:left-4 z-50 pointer-events-auto">
        <button
          id="global-home-button"
          onClick={handleHomeClick}
          title="Về trang chủ"
          aria-label="Về trang chủ"
          className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-slate-900/85 hover:bg-slate-900 text-sky-200 hover:text-white border-2 border-purple-400/35 hover:border-pink-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.4),0_0_20px_rgba(192,132,252,0.25)] backdrop-blur-xl transition-all duration-200 active:scale-95 group cursor-pointer"
        >
          <Home className="w-4 h-4 sm:w-5 sm:h-5 text-pink-300 group-hover:scale-110 transition-transform flex-shrink-0" />
          <span className="hidden sm:inline font-bold text-xs tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-pink-200 to-sky-200">Trang chủ</span>
        </button>
      </div>

      {/* Confirmation Modal when in game/practice/host */}
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-md p-6 sm:p-7 bg-slate-900/95 border-2 border-purple-400/35 rounded-3xl shadow-[0_0_50px_rgba(192,132,252,0.25)] text-white backdrop-blur-2xl">
            <button
              onClick={() => setShowConfirm(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-400/15 border border-amber-300/40 rounded-2xl text-amber-300 shadow-sm">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-pink-300">Về trang chủ?</h3>
                <p className="text-xs text-slate-300">Bạn đang trong phiên học tập / thi đấu</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Bạn có chắc chắn muốn rời khỏi màn hình hiện tại để quay về trang chủ không? Tiến trình hiện tại có thể bị gián đoạn.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
              >
                Tiếp tục ở lại
              </button>
              <button
                onClick={handleConfirmExit}
                className="px-5 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white shadow-lg shadow-rose-500/25 transition-all active:scale-95 cursor-pointer"
              >
                Xác nhận về Trang Chủ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
