import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cloud, 
  UploadCloud, 
  DownloadCloud, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  FolderPlus, 
  FileText,
  Sparkles,
  Lock
} from 'lucide-react';
import { Quiz } from '../types';
import { 
  ensureDriveAccessToken, 
  saveQuizToGoogleDrive, 
  listQuizzesFromGoogleDrive, 
  downloadQuizFromGoogleDrive,
  getOrCreateDriveFolder
} from '../services/googleDriveService';
import { saveQuizToSystem } from '../utils/quizStorage';

interface GoogleDriveQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  localQuizzes: Quiz[];
  onQuizImported: () => void;
  onToast: (msg: string) => void;
}

export default function GoogleDriveQuizModal({
  isOpen,
  onClose,
  localQuizzes,
  onQuizImported,
  onToast
}: GoogleDriveQuizModalProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; modifiedTime: string; size?: string; webViewLink?: string }>>([]);
  const [isBackingUpAll, setIsBackingUpAll] = useState<boolean>(false);
  const [backupProgress, setBackupProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [importingFileId, setImportingFileId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [folderWebLink, setFolderWebLink] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDriveFiles();
    }
  }, [isOpen]);

  const loadDriveFiles = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = await ensureDriveAccessToken();
      const files = await listQuizzesFromGoogleDrive(token);
      setDriveFiles(files);

      // Attempt to get folder link
      try {
        const rootId = await getOrCreateDriveFolder('KHTN - Đấu trường Tri thức', token);
        const folderId = await getOrCreateDriveFolder('KHTN - Ngân hàng Bộ Đề Thi', token, rootId);
        setFolderWebLink(`https://drive.google.com/drive/folders/${folderId}`);
      } catch (fErr) {
        // Ignored
      }
    } catch (err: any) {
      console.error('Load drive files error:', err);
      setErrorMessage(err?.message || 'Không thể kết nối đến Google Drive. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  // Backup all local quizzes to Google Drive
  const handleBackupAllToDrive = async () => {
    if (localQuizzes.length === 0) {
      setErrorMessage('Chưa có bộ đề nào trong hệ thống để sao lưu lên Google Drive.');
      return;
    }

    setIsBackingUpAll(true);
    setErrorMessage('');
    try {
      const token = await ensureDriveAccessToken();
      let successCount = 0;

      for (let i = 0; i < localQuizzes.length; i++) {
        const quiz = localQuizzes[i];
        setBackupProgress({
          current: i + 1,
          total: localQuizzes.length,
          title: quiz.title
        });
        await saveQuizToGoogleDrive(quiz, token);
        successCount++;
      }

      onToast(`🎉 Đã sao lưu thành công ${successCount} bộ đề lên Google Drive an toàn!`);
      await loadDriveFiles();
    } catch (err: any) {
      console.error('Backup all error:', err);
      setErrorMessage('Lỗi khi sao lưu: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsBackingUpAll(false);
      setBackupProgress(null);
    }
  };

  // Import single quiz from Google Drive into application
  const handleImportQuizFromDrive = async (file: { id: string; name: string }) => {
    setImportingFileId(file.id);
    setErrorMessage('');
    try {
      const token = await ensureDriveAccessToken();
      const downloadedQuiz = await downloadQuizFromGoogleDrive(file.id, token);

      // Save into system storage (IndexedDB + fallback)
      await saveQuizToSystem(downloadedQuiz);
      onToast(`✅ Đã nạp thành công bộ đề "${downloadedQuiz.title}" từ Google Drive!`);
      onQuizImported();
    } catch (err: any) {
      console.error('Import quiz error:', err);
      setErrorMessage('Lỗi khi nạp đề: ' + (err?.message || 'Không thể đọc tệp từ Drive'));
    } finally {
      setImportingFileId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in select-none">
      <div className="w-full max-w-3xl bg-slate-900 border-2 border-teal-400/80 rounded-3xl p-5 sm:p-7 shadow-[0_0_60px_rgba(20,184,166,0.35)] relative overflow-hidden animate-in zoom-in-95 text-slate-100 my-auto flex flex-col max-h-[90vh]">
        
        {/* Accent Glow Header */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/60 flex items-center justify-center text-3xl shadow-sm">
              <Cloud className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white tracking-tight">Google Drive • Lưu Trữ Bộ Đề</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/40 text-[10px] font-black uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Đám mây
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Đồng bộ và cất giữ bộ đề thi an toàn trong thư mục Google Drive của bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="my-3 p-3 bg-rose-500/20 border border-rose-400/50 rounded-2xl text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Banner */}
        <div className="my-4 p-4 rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-950 border border-teal-400/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner flex-shrink-0">
          <div className="text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-300 block mb-0.5">
              THƯ MỤC TRÊN DRIVE: KHTN - Ngân hàng Bộ Đề Thi
            </span>
            <div className="text-xs text-slate-300">
              Hiện có <strong className="text-white font-mono">{localQuizzes.length}</strong> bộ đề trong máy và <strong className="text-teal-300 font-mono">{driveFiles.length}</strong> tệp sao lưu trên Drive.
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {folderWebLink && (
              <a
                href={folderWebLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-xs font-bold border border-white/15 flex items-center gap-1.5 transition-colors"
                title="Mở thư mục trên Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở Drive</span>
              </a>
            )}

            <button
              type="button"
              disabled={isBackingUpAll || localQuizzes.length === 0}
              onClick={handleBackupAllToDrive}
              className="px-4 py-2 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs font-black rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.4)] flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBackingUpAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang sao lưu ({backupProgress?.current}/{backupProgress?.total})...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Sao lưu toàn bộ ({localQuizzes.length}) lên Drive</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Drive Files List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-[220px]">
          <div className="flex items-center justify-between pb-1 text-xs text-slate-400">
            <span className="font-bold uppercase text-[10px] text-teal-300 tracking-wider">
              Danh sách đề thi đã lưu trên Google Drive:
            </span>
            <button
              type="button"
              onClick={loadDriveFiles}
              disabled={loading}
              className="text-[11px] text-slate-400 hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
              <span>Đang kết nối và tải danh sách từ Google Drive...</span>
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-white/10 rounded-2xl space-y-2">
              <Cloud className="w-8 h-8 text-slate-600 mx-auto" />
              <p>Chưa có tệp đề thi nào được lưu trong thư mục Google Drive.</p>
              <p className="text-[11px] text-slate-500">
                Bấm nút <strong>"Sao lưu toàn bộ lên Drive"</strong> ở trên để tạo bản lưu đầu tiên!
              </p>
            </div>
          ) : (
            driveFiles.map((f) => {
              const isImportingThis = importingFileId === f.id;
              const formattedDate = f.modifiedTime ? new Date(f.modifiedTime).toLocaleString('vi-VN') : '';

              return (
                <div
                  key={f.id}
                  className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 hover:border-teal-400/40 transition-colors flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-300 flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate" title={f.name}>
                        {f.name.replace(/\.json$/i, '')}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Cập nhật: {formattedDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {f.webViewLink && (
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors text-xs"
                        title="Xem tệp trên Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={isImportingThis}
                      onClick={() => handleImportQuizFromDrive(f)}
                      className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 hover:text-white border border-teal-400/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                      title="Nạp bộ đề này vào kho đề của ứng dụng"
                    >
                      {isImportingThis ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <DownloadCloud className="w-3.5 h-3.5" />
                      )}
                      <span>Nạp đề này</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
          <span className="italic text-[11px]">
            Tệp được lưu an toàn trong Google Drive cá nhân của bạn
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
