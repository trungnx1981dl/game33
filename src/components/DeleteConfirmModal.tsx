import React from 'react';
import { AlertTriangle, Trash2, X, Loader2, BookOpen } from 'lucide-react';
import { Quiz } from '../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  quiz?: Quiz | null;
  selectedCount?: number;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  quiz,
  selectedCount
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  const isBatch = Boolean(selectedCount && selectedCount > 1);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 flex-shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              {isBatch ? `Xác nhận xóa ${selectedCount} bộ đề` : 'Xác nhận xóa bộ đề'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Thao tác này không thể hoàn tác</p>
          </div>
        </div>

        {/* Content detail */}
        {isBatch ? (
          <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl text-xs text-rose-800 space-y-1.5 mb-5">
            <p className="font-semibold text-sm">
              Bạn có chắc chắn muốn xóa vĩnh viễn <span className="underline font-black">{selectedCount}</span> bộ đề đã chọn?
            </p>
            <p className="text-rose-600/90 leading-relaxed">
              Tất cả các câu hỏi và dữ liệu liên quan sẽ bị xóa khỏi cơ sở dữ liệu và không thể khôi phục lại.
            </p>
          </div>
        ) : quiz ? (
          <div className="space-y-3 mb-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 rounded text-[11px] font-bold">
                  {quiz.subject || 'KHTN'}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
                {quiz.title}
              </h4>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                <span>Số lượng: <strong className="text-slate-700">{quiz.questions?.length || 0} câu hỏi</strong></span>
              </p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Bộ đề này sẽ bị xóa vĩnh viễn khỏi kho lưu trữ và các buổi học sẽ không thể chọn bộ đề này nữa.
            </p>
          </div>
        ) : null}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 active:scale-98"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{isBatch ? `Xóa ${selectedCount} bộ đề` : 'Xác nhận xóa'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
