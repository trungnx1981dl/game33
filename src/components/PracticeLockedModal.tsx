import React from 'react';
import { Lock, ShieldAlert, Rocket, ArrowRight, X, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface PracticeLockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function PracticeLockedModal({ isOpen, onClose, message }: PracticeLockedModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(245,158,11,0.25)] relative overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center mx-auto mb-3 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <Lock className="w-8 h-8" />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Thông báo từ Quản trị viên</span>
          </div>

          <h3 className="text-2xl font-black text-white tracking-tight">
            Tính Năng Đang Tạm Khóa
          </h3>
        </div>

        {/* Content */}
        <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-4 mb-6 text-sm text-slate-300 leading-relaxed text-center">
          <p className="font-medium text-amber-200 mb-2">
            {message || 'Tính năng Tự Luyện Kiến Thức hiện đang tạm khóa theo chỉ định của Quản trị viên.'}
          </p>
          <p className="text-xs text-slate-400">
            Học sinh vui lòng tham gia phòng thi trực tiếp do Thầy/Cô tổ chức bằng Mã học sinh của mình hoặc quay lại sau khi kết thúc giờ kiểm tra.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/player');
            }}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm rounded-2xl shadow-[0_0_25px_rgba(0,217,255,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Rocket className="w-4 h-4" />
            <span>Đến phòng thi trực tiếp (Học sinh)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Đóng thông báo
          </button>
        </div>

        {/* Admin hint */}
        <div className="mt-4 pt-3 border-t border-white/10 text-center">
          <Link
            to="/admin"
            className="text-[11px] text-slate-400 hover:text-teal-300 transition-colors inline-flex items-center gap-1 font-medium"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-teal-400" />
            <span>Bạn là Quản trị viên? Bấm vào đây để mở lại tính năng</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
