import React, { useState, useEffect } from 'react';
import { ShieldCheck, ExternalLink, X, Zap } from 'lucide-react';
import { firestoreQuota, FIRESTORE_UPGRADE_URL } from '../utils/firestoreQuota';

export default function FirestoreQuotaBanner() {
  const [isExceeded, setIsExceeded] = useState<boolean>(firestoreQuota.getIsExceeded());
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem('quota_banner_dismissed') === 'true';
  });

  useEffect(() => {
    const unsub = firestoreQuota.subscribe((exceeded) => {
      setIsExceeded(exceeded);
    });
    return () => unsub();
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('quota_banner_dismissed', 'true');
  };

  if (!isExceeded || isDismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-emerald-700 via-teal-700 to-sky-700 text-white shadow-2xl border-b-2 border-emerald-400 animate-in slide-in-from-top-4 duration-300">
      <div className="max-w-7xl mx-auto p-2.5 sm:p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-black/25 flex items-center justify-center flex-shrink-0 text-xl border border-white/30 text-emerald-300">
            <Zap className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="font-black text-amber-200 uppercase tracking-wider text-[11px] sm:text-xs flex items-center gap-1.5">
              <span>ĐÃ TỰ ĐỘNG KÍCH HOẠT MÁY CHỦ DỰ PHÒNG (SERVER SYNC BACKUP)</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/40 text-emerald-200 text-[10px] font-mono">ĐANG HOẠT ĐỘNG</span>
            </div>
            <p className="text-white/95 mt-0.5 leading-snug text-xs">
              Hạn mức Firestore trong ngày đã đầy. Hệ thống đã tự động chuyển sang chế độ Đồng bộ Máy chủ để thầy cô và học sinh tiếp tục thi đấu, nộp bài và chấm điểm bình thường!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end">
          <button
            onClick={handleDismiss}
            className="px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Đã hiểu • Tiếp tục chơi</span>
          </button>
          <a
            href={FIRESTORE_UPGRADE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white/90 font-bold rounded-xl text-xs flex items-center gap-1 transition-all"
            title="Xem hạn mức Firestore trên Google Cloud Console"
          >
            <span>Firebase Console</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
