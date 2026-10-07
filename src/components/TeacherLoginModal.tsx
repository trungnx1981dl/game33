import React, { useState } from 'react';
import { GraduationCap, KeyRound, Eye, EyeOff, AlertCircle, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { verifyTeacherPassword, setTeacherAuthenticated } from '../utils/auth';

interface TeacherLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TeacherLoginModal({ isOpen, onClose, onSuccess }: TeacherLoginModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu Giáo viên');
      return;
    }

    if (verifyTeacherPassword(password)) {
      setTeacherAuthenticated(true);
      setError('');
      setPassword('');
      onSuccess();
    } else {
      setError('Mật khẩu Giáo viên không chính xác. Mặc định là: gv123');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900/95 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(192,132,252,0.3)] border-2 border-purple-400/35 relative overflow-hidden backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative pastel glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-sky-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-purple-300/40 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(192,132,252,0.3)] text-purple-300">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-pink-300 to-amber-300 tracking-tight">
            Giáo Viên Đăng Nhập
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Nhập mật khẩu để mở phòng thi và điều khiển phiên chơi toàn lớp
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Mật khẩu Giáo viên
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
                placeholder="Nhập mật khẩu (mặc định: gv123)..."
                className="w-full pl-4 pr-11 py-3 bg-slate-950/80 border-2 border-purple-400/30 focus:border-pink-400 rounded-2xl text-white font-medium text-sm focus:shadow-[0_0_20px_rgba(244,114,182,0.25)] outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                tabIndex={-1}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[11px] text-slate-400 font-medium">
                Mật khẩu mặc định: <code className="text-purple-300 font-bold">gv123</code>
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/15 border border-rose-400/40 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-pink-400 via-purple-400 to-sky-400 hover:from-pink-300 hover:via-purple-300 hover:to-sky-300 text-slate-950 rounded-2xl font-black text-sm shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <KeyRound className="w-4 h-4" />
              <span>Xác nhận & Mở phòng</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
