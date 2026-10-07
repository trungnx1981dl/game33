import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Quiz, Question, QuestionType } from '../types';
import { 
  BrainCircuit, 
  FileUp, 
  PenLine, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  BookOpen, 
  Eye, 
  EyeOff,
  Play, 
  Users, 
  X,
  Sparkles,
  Lock,
  KeyRound,
  ShieldCheck,
  LogOut,
  AlertCircle,
  Pencil,
  Copy,
  Search,
  Filter,
  CheckSquare,
  Square,
  Check,
  GraduationCap,
  FileText,
  Upload,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Edit3,
  RotateCcw,
  Download,
  UploadCloud,
  Share2,
  Cloud
} from 'lucide-react';
import GoogleDriveQuizModal from '../components/GoogleDriveQuizModal';
import { saveQuizToGoogleDrive, ensureDriveAccessToken } from '../services/googleDriveService';
import { 
  saveQuizToSystem,
  deleteQuizFromSystem,
  deleteMultipleQuizzesFromSystem,
  loadAllQuizzesFromSystem,
  duplicateQuizInSystem,
  exportQuizToJsonFile,
  exportAllQuizzesBackup,
  importQuizzesFromJsonFile
} from '../utils/quizStorage';
import EditQuizModal from '../components/EditQuizModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import ApiKeySettings, { getCustomApiKey } from '../components/ApiKeySettings';
import PracticeStatusManager from '../components/PracticeStatusManager';
import StudentRosterManager from '../components/StudentRosterManager';
import { usePracticeStatus } from '../utils/systemConfig';
import { 
  generateQuizFromFileService, 
  generateQuizFromTextService, 
  extractQuestionsFromFormattedPdfService 
} from '../services/aiQuizService';
import { formatTFAnswer } from '../utils/scoring';
import { getStoredAdminCode, getStoredTeacherCode, saveTeacherCode, DEFAULT_ADMIN_CODE, DEFAULT_TEACHER_CODE } from '../utils/auth';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

export default function Admin() {
  const { isPracticeEnabled } = usePracticeStatus();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('khtn_admin_session_auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showChangeCodeModal, setShowChangeCodeModal] = useState(false);

  const getStoredAdminCode = () => {
    return localStorage.getItem('khtn_admin_passcode') || DEFAULT_ADMIN_CODE;
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentCode = getStoredAdminCode();
    const trimmed = passcode.trim();

    // Support current code, or 'admin123' and 'admin' if default
    const isValid = 
      trimmed === currentCode || 
      (currentCode === DEFAULT_ADMIN_CODE && (trimmed.toLowerCase() === 'admin' || trimmed === DEFAULT_ADMIN_CODE));

    if (isValid) {
      sessionStorage.setItem('khtn_admin_session_auth', 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Mã Admin không chính xác. Vui lòng kiểm tra lại!');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('khtn_admin_session_auth');
    setIsAuthenticated(false);
    setPasscode('');
    setError('');
  };

  // If not authenticated, render Admin Access Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 selection:bg-teal-200">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative overflow-hidden">
          {/* Subtle decoration */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-teal-100/60 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-emerald-100/60 rounded-full blur-2xl pointer-events-none" />

          <div className="text-center relative z-10 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center mx-auto mb-4 shadow-sm text-teal-600">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-lobster text-slate-800 tracking-wide">Xác thực Quản trị viên</h2>
            <p className="text-sm text-slate-500 mt-1">
              Khu vực tạo và quản lý đề thi yêu cầu nhập mã bảo mật Admin.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Mã bảo mật Admin
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus
                  placeholder="Nhập mã Admin..."
                  className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-mono text-base focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? 'Ẩn mã' : 'Hiện mã'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 btn-modern-shine btn-modern-glow"
            >
              <KeyRound className="w-5 h-5" />
              <span>Xác nhận truy cập</span>
            </button>

            <div className="pt-2 text-center">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại Trang chủ</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
              title="Quay lại Trang chủ"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-lobster text-slate-800 tracking-wide">Quản trị Hệ thống Đề thi</h1>
              <p className="text-xs text-slate-500">Tạo, quản lý và lưu trữ bộ đề ôn luyện KHTN</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Practice Mode Indicator */}
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold hidden md:flex items-center gap-1.5 border shadow-2xs ${
              isPracticeEnabled 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              {isPracticeEnabled ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Tự luyện: Đang mở</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Tự luyện: Tạm khóa</span>
                </>
              )}
            </span>

            <span className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Quản trị viên</span>
            </span>
            <button
              onClick={() => setShowChangeCodeModal(true)}
              className="text-xs font-semibold text-slate-600 hover:text-teal-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer border border-transparent hover:border-slate-200"
              title="Đổi mã bảo mật Admin"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đổi mã Admin</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1.5 cursor-pointer border border-transparent hover:border-rose-100"
              title="Khóa quyền quản trị"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Khóa</span>
            </button>
            <Link 
              to="/" 
              className="text-sm font-medium text-slate-600 hover:text-teal-600 px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Trang chủ
            </Link>
          </div>
        </div>
      </header>

      {/* Change Admin Code Modal */}
      {showChangeCodeModal && (
        <ChangeAdminCodeModal 
          onClose={() => setShowChangeCodeModal(false)} 
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/create-manual" element={<CreateManual />} />
          <Route path="/create-ai" element={<CreateAI />} />
          <Route path="/create-file" element={<CreateFile />} />
        </Routes>
      </main>
    </div>
  );
}

function ChangeAdminCodeModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'admin' | 'teacher'>('admin');

  // Admin passcode fields
  const [currentCodeInput, setCurrentCodeInput] = useState('');
  const [newCodeInput, setNewCodeInput] = useState('');
  const [confirmCodeInput, setConfirmCodeInput] = useState('');

  // Teacher password fields
  const [newTeacherPassInput, setNewTeacherPassInput] = useState('');
  const [confirmTeacherPassInput, setConfirmTeacherPassInput] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const activeCode = getStoredAdminCode();
    const isCurrentValid = 
      currentCodeInput.trim() === activeCode ||
      (activeCode === DEFAULT_ADMIN_CODE && (currentCodeInput.trim().toLowerCase() === 'admin' || currentCodeInput.trim() === DEFAULT_ADMIN_CODE));

    if (!isCurrentValid) {
      setError('Mã Admin hiện tại không đúng!');
      return;
    }

    if (newCodeInput.trim().length < 4) {
      setError('Mã Admin mới phải có ít nhất 4 ký tự!');
      return;
    }

    if (newCodeInput.trim() !== confirmCodeInput.trim()) {
      setError('Xác nhận mã Admin mới không khớp!');
      return;
    }

    localStorage.setItem('khtn_admin_passcode', newCodeInput.trim());
    setSuccess('Đổi mã Admin thành công!');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newTeacherPassInput.trim().length < 3) {
      setError('Mật khẩu Giáo viên mới phải có ít nhất 3 ký tự!');
      return;
    }

    if (newTeacherPassInput.trim() !== confirmTeacherPassInput.trim()) {
      setError('Xác nhận mật khẩu Giáo viên không khớp!');
      return;
    }

    saveTeacherCode(newTeacherPassInput.trim());
    setSuccess('Cập nhật mật khẩu Giáo viên thành công!');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Cài đặt mật mã</h3>
            <p className="text-xs text-slate-500">Quản lý mã Admin & mật khẩu Giáo viên</p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
          <button
            type="button"
            onClick={() => { setActiveTab('admin'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'admin' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Mã Admin</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('teacher'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'teacher' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Mật khẩu GV</span>
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-emerald-700 font-bold text-base">{success}</p>
            <p className="text-xs text-slate-500">Mã mới đã được lưu trên thiết bị.</p>
          </div>
        ) : activeTab === 'admin' ? (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mã Admin hiện tại</label>
              <input
                type="password"
                required
                value={currentCodeInput}
                onChange={(e) => setCurrentCodeInput(e.target.value)}
                placeholder="Nhập mã Admin hiện tại..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-sm focus:bg-white focus:border-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mã Admin mới</label>
              <input
                type="password"
                required
                value={newCodeInput}
                onChange={(e) => setNewCodeInput(e.target.value)}
                placeholder="Nhập mã mới (tối thiểu 4 ký tự)"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-sm focus:bg-white focus:border-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Xác nhận mã Admin mới</label>
              <input
                type="password"
                required
                value={confirmCodeInput}
                onChange={(e) => setConfirmCodeInput(e.target.value)}
                placeholder="Nhập lại mã mới"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-sm focus:bg-white focus:border-teal-500 outline-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-600/20 transition-all cursor-pointer"
              >
                Lưu mã mới
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTeacherSubmit} className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 text-xs leading-relaxed">
              Mật khẩu này dùng khi Giáo viên bấm <strong>"GV Đăng nhập"</strong> để mở phòng thi. Hiện tại: <code className="font-bold">{getStoredTeacherCode()}</code>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mật khẩu Giáo viên mới</label>
              <input
                type="password"
                required
                value={newTeacherPassInput}
                onChange={(e) => setNewTeacherPassInput(e.target.value)}
                placeholder="Nhập mật khẩu GV mới..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-sm focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Xác nhận mật khẩu Giáo viên</label>
              <input
                type="password"
                required
                value={confirmTeacherPassInput}
                onChange={(e) => setConfirmTeacherPassInput(e.target.value)}
                placeholder="Nhập lại mật khẩu GV..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-sm focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                Lưu mật khẩu GV
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreviewQuiz, setSelectedPreviewQuiz] = useState<Quiz | null>(null);
  const [showPreviewAnswers, setShowPreviewAnswers] = useState(false);

  // Edit and Delete Modal states
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ quiz: Quiz | null; isBatch: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Multi-selection & Batch Delete
  const [selectedQuizIds, setSelectedQuizIds] = useState<Set<string>>(new Set());

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');

  // Main Dashboard Tab: 'QUIZZES' or 'STUDENTS'
  const [dashboardTab, setDashboardTab] = useState<'QUIZZES' | 'STUDENTS'>('QUIZZES');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Google Drive Modal & Status
  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [savingToDriveId, setSavingToDriveId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Save single quiz to Google Drive
  const handleSaveSingleQuizToDrive = async (quiz: Quiz) => {
    setSavingToDriveId(quiz.id);
    try {
      const token = await ensureDriveAccessToken();
      await saveQuizToGoogleDrive(quiz, token);
      showToast(`🎉 Đã lưu bộ đề "${quiz.title}" lên Google Drive an toàn!`);
    } catch (err: any) {
      console.error('Save quiz to drive error:', err);
      alert('Không thể lưu lên Google Drive: ' + (err?.message || 'Vui lòng cấp quyền truy cập.'));
    } finally {
      setSavingToDriveId(null);
    }
  };

  const [isImporting, setIsImporting] = useState(false);
  const jsonImportInputRef = React.useRef<HTMLInputElement>(null);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const data = await loadAllQuizzesFromSystem();
      setQuizzes(data);
    } catch (e) {
      console.error('Error fetching quizzes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Export all quizzes backup
  const handleExportAllQuizzes = () => {
    if (quizzes.length === 0) {
      return alert('Chưa có bộ đề nào trong hệ thống để sao lưu!');
    }
    exportAllQuizzesBackup(quizzes);
    showToast(`Đã tải tệp sao lưu toàn bộ ${quizzes.length} bộ đề về máy tính!`);
  };

  // Export single quiz
  const handleExportSingleQuiz = (quiz: Quiz) => {
    exportQuizToJsonFile(quiz);
    showToast(`Đã tải tệp sao lưu bộ đề "${quiz.title}" (.json) về máy tính!`);
  };

  // Import quizzes from json file
  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await importQuizzesFromJsonFile(file);
      showToast(`Đã nạp thành công ${result.count} bộ đề vào kho dữ liệu!`);
      await fetchQuizzes();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi nạp file bộ đề');
    } finally {
      setIsImporting(false);
      if (jsonImportInputRef.current) jsonImportInputRef.current.value = '';
    }
  };

  // Filtered quizzes list
  const filteredQuizzes = quizzes.filter(q => {
    const matchesSearch = 
      q.title.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      (q.subject || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
    const matchesSubject = 
      selectedSubjectFilter === 'ALL' || 
      (q.subject || 'KHTN').toLowerCase() === selectedSubjectFilter.toLowerCase();
    return matchesSearch && matchesSubject;
  });

  // Unique subjects for filter
  const availableSubjects = Array.from(
    new Set(quizzes.map(q => q.subject || 'KHTN').filter(Boolean))
  );

  // Toggle selection
  const handleToggleSelectQuiz = (quizId: string) => {
    setSelectedQuizIds(prev => {
      const next = new Set(prev);
      if (next.has(quizId)) {
        next.delete(quizId);
      } else {
        next.add(quizId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedQuizIds.size === filteredQuizzes.length && filteredQuizzes.length > 0) {
      setSelectedQuizIds(new Set());
    } else {
      setSelectedQuizIds(new Set(filteredQuizzes.map(q => q.id)));
    }
  };

  // Open Delete Modal for Single Quiz
  const handleOpenDeleteSingle = (quiz: Quiz) => {
    setDeleteTarget({ quiz, isBatch: false });
  };

  // Open Delete Modal for Batch
  const handleOpenBatchDelete = () => {
    if (selectedQuizIds.size === 0) return;
    setDeleteTarget({ quiz: null, isBatch: true });
  };

  // Confirm Delete Handler (Single & Batch)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteTarget.isBatch) {
        const idsToDelete = Array.from(selectedQuizIds);
        await deleteMultipleQuizzesFromSystem(idsToDelete);
        setQuizzes(prev => prev.filter(q => !selectedQuizIds.has(q.id)));
        if (selectedPreviewQuiz && selectedQuizIds.has(selectedPreviewQuiz.id)) {
          setSelectedPreviewQuiz(null);
        }
        showToast(`Đã xóa thành công ${idsToDelete.length} bộ đề khỏi hệ thống!`);
        setSelectedQuizIds(new Set());
      } else if (deleteTarget.quiz) {
        const idToDelete = deleteTarget.quiz.id;
        const deletedTitle = deleteTarget.quiz.title;
        await deleteQuizFromSystem(idToDelete);
        setQuizzes(prev => prev.filter(q => q.id !== idToDelete));
        if (selectedPreviewQuiz?.id === idToDelete) {
          setSelectedPreviewQuiz(null);
        }
        setSelectedQuizIds(prev => {
          const next = new Set(prev);
          next.delete(idToDelete);
          return next;
        });
        showToast(`Đã xóa bộ đề "${deletedTitle}" thành công!`);
      }
      setDeleteTarget(null);
    } catch (e: any) {
      console.error('Lỗi khi xóa bộ đề:', e);
      alert('Không thể xóa đề: ' + (e.message || 'Lỗi không xác định'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Duplicate Quiz Handler
  const handleDuplicateQuiz = async (quiz: Quiz) => {
    setDuplicatingId(quiz.id);
    try {
      const newQuiz = await duplicateQuizInSystem(quiz);
      setQuizzes(prev => [newQuiz, ...prev]);
      showToast(`Đã nhân bản bộ đề "${quiz.title}" thành công!`);
    } catch (e: any) {
      console.error('Lỗi nhân bản đề:', e);
      alert('Không thể nhân bản bộ đề: ' + (e.message || 'Lỗi không xác định'));
    } finally {
      setDuplicatingId(null);
    }
  };

  // Edit Quiz Save Handler
  const handleSaveEditedQuizSuccess = (updatedQuiz: Quiz) => {
    setQuizzes(prev => prev.map(q => q.id === updatedQuiz.id ? updatedQuiz : q));
    if (selectedPreviewQuiz?.id === updatedQuiz.id) {
      setSelectedPreviewQuiz(updatedQuiz);
    }
    showToast(`Đã cập nhật bộ đề "${updatedQuiz.title}" thành công!`);
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Primary Dashboard Navigation Tabs */}
      <div className="flex rounded-2xl bg-slate-200/90 p-1.5 shadow-inner">
        <button
          type="button"
          onClick={() => setDashboardTab('QUIZZES')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            dashboardTab === 'QUIZZES'
              ? 'bg-white text-teal-800 shadow-md ring-1 ring-slate-200/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4 text-teal-600" />
          <span>QUẢN LÝ BỘ ĐỀ ({quizzes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardTab('STUDENTS')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            dashboardTab === 'STUDENTS'
              ? 'bg-white text-teal-800 shadow-md ring-1 ring-slate-200/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-teal-600" />
          <span>DANH SÁCH HỌC SINH (MÃ HÓA NGƯỜI CHƠI)</span>
        </button>
      </div>

      {dashboardTab === 'STUDENTS' ? (
        <StudentRosterManager />
      ) : (
        <>
          {/* Practice Mode Lock/Unlock Administrator Panel */}
          <PracticeStatusManager onToast={showToast} />

      {/* Custom Gemini API Key Settings Panel */}
      <ApiKeySettings />

      {/* Creation Navigation Card */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tạo đề mới</h2>
          <p className="text-slate-500 mt-1">Chọn phương thức tạo đề thi phù hợp với nhu cầu giảng dạy của bạn.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link 
            to="create-manual" 
            className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 hover:border-teal-500 hover:text-teal-600 text-slate-700 font-semibold rounded-2xl transition-all"
          >
            <PenLine className="w-5 h-5 text-teal-600" />
            Thủ công
          </Link>
          <Link 
            to="create-file" 
            className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-700 font-semibold rounded-2xl transition-all"
          >
            <FileUp className="w-5 h-5 text-blue-600" />
            Từ File (PDF / Ảnh)
          </Link>
          <Link 
            to="create-ai" 
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-md font-semibold rounded-2xl transition-all"
          >
            <BrainCircuit className="w-5 h-5" />
            Tạo bằng AI (Chuẩn GDPT)
          </Link>
        </div>
      </div>

      {/* Quizzes List & Management Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-teal-600" />
              Kho đề lưu trữ ({quizzes.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Quản lý, chỉnh sửa chi tiết từng câu hỏi, nhân bản hoặc xóa đề thi
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Input file ẩn cho nạp file JSON */}
            <input 
              type="file" 
              ref={jsonImportInputRef} 
              onChange={handleImportJsonFile} 
              accept=".json" 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => jsonImportInputRef.current?.click()}
              disabled={isImporting}
              className="text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold px-3 py-2 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Nạp bộ đề từ tệp sao lưu .json trên máy tính vào hệ thống"
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />}
              <span>Nạp từ file (.json)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGoogleDriveModal(true)}
              className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold px-3 py-2 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Đồng bộ, sao lưu và nạp bộ đề từ Google Drive cá nhân của bạn"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              <span>Google Drive</span>
            </button>

            <button
              type="button"
              onClick={handleExportAllQuizzes}
              disabled={quizzes.length === 0}
              className="text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold px-3 py-2 border border-teal-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Sao lưu toàn bộ kho đề ra tệp .json về máy tính để cất giữ an toàn"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" />
              <span>Sao lưu kho đề</span>
            </button>

            <button
              type="button"
              onClick={fetchQuizzes}
              className="text-xs text-slate-600 hover:text-teal-700 font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Search, Filter & Bulk Selection Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm bộ đề theo tên hoặc môn học..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-teal-500 outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Subject filter dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-teal-500"
              >
                <option value="ALL">Tất cả môn học ({quizzes.length})</option>
                {availableSubjects.map(subj => (
                  <option key={subj} value={subj}>
                    {subj} ({quizzes.filter(q => (q.subject || 'KHTN').toLowerCase() === subj.toLowerCase()).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bulk Selection Bar (when items selected) */}
          {selectedQuizIds.size > 0 && (
            <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
                <CheckSquare className="w-4 h-4 text-teal-600" />
                <span>Đã chọn {selectedQuizIds.size} / {filteredQuizzes.length} bộ đề</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedQuizIds(new Set())}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-white/60 rounded-lg transition-colors cursor-pointer"
                >
                  Bỏ chọn tất cả
                </button>
                <button
                  onClick={handleOpenBatchDelete}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa {selectedQuizIds.size} bộ đề đã chọn</span>
                </button>
              </div>
            </div>
          )}

          {/* Sub-header with select-all helper */}
          {filteredQuizzes.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
              <button
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 hover:text-teal-700 font-semibold cursor-pointer"
              >
                {selectedQuizIds.size === filteredQuizzes.length && filteredQuizzes.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Chọn tất cả {filteredQuizzes.length} bộ đề trong danh sách</span>
              </button>

              <span>
                Hiển thị {filteredQuizzes.length} / {quizzes.length} bộ đề
              </span>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mb-2" />
            <span className="text-sm text-slate-500">Đang tải kho đề thi...</span>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-slate-200 border-dashed">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 text-lg font-medium">
              {quizzes.length === 0 ? 'Chưa có bộ đề nào trong cơ sở dữ liệu.' : 'Không tìm thấy bộ đề phù hợp với bộ lọc.'}
            </p>
            <p className="text-slate-400 text-sm mt-1 mb-6">
              {quizzes.length === 0 ? 'Hãy tạo đề thi đầu tiên bằng AI hoặc từ file tài liệu.' : 'Thử đổi từ khóa tìm kiếm hoặc môn học.'}
            </p>
            {quizzes.length === 0 ? (
              <Link 
                to="create-ai" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors shadow-sm"
              >
                <BrainCircuit className="w-5 h-5" /> Tạo đề ngay bằng AI
              </Link>
            ) : (
              <button
                onClick={() => { setSearchTerm(''); setSelectedSubjectFilter('ALL'); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map(quiz => {
              const isSelected = selectedQuizIds.has(quiz.id);

              return (
                <div 
                  key={quiz.id} 
                  className={`bg-white p-5 rounded-3xl shadow-xs border transition-all flex flex-col justify-between relative group ${
                    isSelected ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md' : 'border-slate-200 hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Card Top: Checkbox, Subject Badge, Date */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectQuiz(quiz.id)}
                          className="p-1 text-slate-400 hover:text-teal-600 cursor-pointer"
                          title={isSelected ? 'Bỏ chọn bộ đề này' : 'Chọn bộ đề này để xóa hàng loạt'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-teal-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                          )}
                        </button>
                        <span className="px-2.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold">
                          {quiz.subject || 'KHTN'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    {/* Quiz Title */}
                    <h4 className="font-bold text-base text-slate-800 mb-2 line-clamp-2 leading-snug" title={quiz.title}>
                      {quiz.title}
                    </h4>
                    
                    {/* Meta stats */}
                    <div className="text-xs text-slate-500 mb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>Tổng số: <strong className="text-slate-800 font-bold">{quiz.questions?.length || 0} câu</strong></span>
                        </span>
                        {quiz.description && (
                          <span className="text-[11px] text-slate-400 italic line-clamp-1 max-w-[120px]" title={quiz.description}>
                            {quiz.description}
                          </span>
                        )}
                      </div>

                      {/* Question type pill counts */}
                      <div className="flex flex-wrap gap-1">
                        {quiz.questions && quiz.questions.length > 0 ? (
                          <>
                            {quiz.questions.filter(q => q.type === 'MC').length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                                {quiz.questions.filter(q => q.type === 'MC').length} Trắc nghiệm
                              </span>
                            )}
                            {quiz.questions.filter(q => q.type === 'TF').length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded font-medium">
                                {quiz.questions.filter(q => q.type === 'TF').length} Đúng/Sai
                              </span>
                            )}
                            {quiz.questions.filter(q => q.type === 'SA' || q.type === 'ESSAY').length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded font-medium">
                                {quiz.questions.filter(q => q.type === 'SA' || q.type === 'ESSAY').length} Trả lời ngắn
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Chưa có câu hỏi</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    {/* Play Modes */}
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to="/practice"
                        className="py-2 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                        title="Mở chế độ tự luyện cho học sinh"
                      >
                        <Play className="w-3.5 h-3.5 fill-blue-700" /> Tự luyện
                      </Link>
                      <Link
                        to={`/host/board/${quiz.id}`}
                        className="py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                        title="Tổ chức thi đấu trực tiếp cả lớp"
                      >
                        <Users className="w-3.5 h-3.5" /> Chơi cả lớp
                      </Link>
                    </div>

                    {/* Management Toolbar: Preview, Edit, Duplicate, Google Drive, Export JSON, Delete */}
                    <div className="grid grid-cols-6 gap-1 pt-1">
                      <button 
                        onClick={() => setSelectedPreviewQuiz(quiz)}
                        className="py-2 px-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors text-xs flex items-center justify-center gap-1 cursor-pointer"
                        title="Xem chi tiết các câu hỏi trong đề"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Xem</span>
                      </button>

                      <button 
                        onClick={() => setEditingQuiz(quiz)}
                        className="py-2 px-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl font-bold transition-colors text-xs flex items-center justify-center gap-1 cursor-pointer"
                        title="Chỉnh sửa nội dung câu hỏi, đáp án, tiêu đề"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Sửa</span>
                      </button>

                      <button 
                        onClick={() => handleDuplicateQuiz(quiz)}
                        disabled={duplicatingId === quiz.id}
                        className="py-2 px-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl font-medium transition-colors text-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Nhân bản bộ đề này thành bản sao mới"
                      >
                        {duplicatingId === quiz.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Nhân bản</span>
                      </button>

                      <button 
                        onClick={() => handleSaveSingleQuizToDrive(quiz)}
                        disabled={savingToDriveId === quiz.id}
                        className="py-2 px-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl font-bold transition-colors text-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Lưu bộ đề này vào Google Drive của bạn để bảo toàn lâu dài"
                      >
                        {savingToDriveId === quiz.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="hidden sm:inline">Drive</span>
                      </button>

                      <button 
                        onClick={() => handleExportSingleQuiz(quiz)}
                        className="py-2 px-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-medium transition-colors text-xs flex items-center justify-center gap-1 cursor-pointer"
                        title="Tải tệp .json để sao lưu riêng bộ đề này về máy tính"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">JSON</span>
                      </button>

                      <button 
                        onClick={() => handleOpenDeleteSingle(quiz)}
                        className="py-2 px-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-semibold transition-colors text-xs flex items-center justify-center gap-1 cursor-pointer"
                        title="Xóa bộ đề khỏi hệ thống"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Xóa</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Google Drive Modal */}
      <GoogleDriveQuizModal
        isOpen={showGoogleDriveModal}
        onClose={() => setShowGoogleDriveModal(false)}
        localQuizzes={quizzes}
        onQuizImported={fetchQuizzes}
        onToast={showToast}
      />

      {/* Edit Quiz Modal */}
      <EditQuizModal
        isOpen={Boolean(editingQuiz)}
        quiz={editingQuiz}
        onClose={() => setEditingQuiz(null)}
        onSaveSuccess={handleSaveEditedQuizSuccess}
      />

      {/* Delete Confirmation Modal (Single & Batch) */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        quiz={deleteTarget?.quiz}
        selectedCount={deleteTarget?.isBatch ? selectedQuizIds.size : 1}
      />

      {/* Preview Modal */}
      {selectedPreviewQuiz && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {selectedPreviewQuiz.subject || 'KHTN'}
                </span>
                <h3 className="text-xl font-bold text-slate-800 mt-1">{selectedPreviewQuiz.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tổng cộng {selectedPreviewQuiz.questions?.length || 0} câu hỏi • Thang điểm 10 (Đúng-Sai: 1.0 đ • Trả lời ngắn: 0.5 đ • Trắc nghiệm: chia đều)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const qToEdit = selectedPreviewQuiz;
                    setSelectedPreviewQuiz(null);
                    setEditingQuiz(qToEdit);
                  }}
                  className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Mở trình chỉnh sửa bộ đề này"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Sửa đề này</span>
                </button>
                <button
                  onClick={() => {
                    const qToDelete = selectedPreviewQuiz;
                    setSelectedPreviewQuiz(null);
                    handleOpenDeleteSingle(qToDelete);
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Xóa bộ đề này khỏi hệ thống"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa</span>
                </button>
                <button
                  onClick={() => setShowPreviewAnswers(!showPreviewAnswers)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Mở hoặc ẩn đáp án"
                >
                  {showPreviewAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showPreviewAnswers ? 'Ẩn đáp án' : 'Hiển thị đáp án'}</span>
                </button>
                <button
                  onClick={() => setSelectedPreviewQuiz(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {selectedPreviewQuiz.questions?.map((q, idx) => (
                <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-bold rounded-md">
                        Câu {idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        {q.type === 'MC' ? 'Trắc nghiệm 4 lựa chọn' : q.type === 'TF' ? 'Đúng - Sai (4 ý)' : q.type === 'SA' ? 'Trả lời ngắn' : 'Tự luận'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {q.type === 'TF' ? '1.0 điểm (0.25 đ/ý)' : q.type === 'SA' ? '0.5 điểm' : 'Trắc nghiệm'}
                    </span>
                  </div>

                  <p className="font-medium text-slate-800 whitespace-pre-wrap mb-3">{q.content}</p>

                  {/* Multiple Choice (MC) */}
                  {q.type === 'MC' && q.options && (
                    <div className="space-y-2 mb-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => {
                          const letter = ['A','B','C','D'][oIdx];
                          const isCorrect = showPreviewAnswers && (q.answer === letter || opt.trim().toLowerCase() === (q.answer || '').trim().toLowerCase());

                          return (
                            <div 
                              key={oIdx} 
                              className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-400 font-semibold text-emerald-800'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {letter}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            </div>
                          );
                        })}
                      </div>
                      {showPreviewAnswers && (
                        <div className="text-xs font-semibold text-emerald-700">
                          Đáp án đúng: <strong className="font-mono text-sm">{q.answer}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* True - False (TF) */}
                  {q.type === 'TF' && q.options && (
                    <div className="space-y-2 mb-3">
                      {showPreviewAnswers && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800">
                          Đáp án: <span className="font-mono text-teal-800 text-sm sm:text-base">{formatTFAnswer(q.answer, idx + 1)}</span>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {q.options.map((opt, oIdx) => {
                          let ansArr: string[] = [];
                          try { 
                            ansArr = Array.isArray(q.answer) ? q.answer : JSON.parse(q.answer); 
                          } catch {}
                          const isTrue = ansArr[oIdx] === 'Đúng';

                          return (
                            <div key={oIdx} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-sm">
                              <span><strong className="font-mono">{['a','b','c','d'][oIdx]})</strong> {opt}</span>
                              {showPreviewAnswers ? (
                                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${isTrue ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {isTrue ? 'Đúng' : 'Sai'}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">Đúng/Sai</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Short Answer / Essay */}
                  {(q.type === 'SA' || q.type === 'ESSAY') && (
                    showPreviewAnswers ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                        <strong>Đáp án chính xác:</strong> <span className="font-mono">{q.answer}</span>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-xs italic">
                        (Đáp án đang được ẩn)
                      </div>
                    )
                  )}

                  {/* Explanation if available */}
                  {showPreviewAnswers && q.explanation && (
                    <div className="mt-3 p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs sm:text-sm text-teal-900">
                      <strong className="text-teal-800 font-bold block mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        <span>Lời giải chi tiết:</span>
                      </strong>
                      <div className="whitespace-pre-wrap leading-relaxed">{q.explanation}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedPreviewQuiz(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function CreateManual() {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('KHTN');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [titleError, setTitleError] = useState('');
  const navigate = useNavigate();

  // Reference to form for auto-scroll when editing
  const formRef = React.useRef<HTMLDivElement>(null);
  const questionsListRef = React.useRef<HTMLDivElement>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // PDF Upload & Extraction State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfInstructions, setPdfInstructions] = useState('');
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('append');

  // Editing state: null = creating new question, number = editing question at index
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Question form state
  const [qType, setQType] = useState<QuestionType>('MC');
  const [qContent, setQContent] = useState('');
  const [mcOptions, setMcOptions] = useState(['', '', '', '']);
  const [mcAnswer, setMcAnswer] = useState('A');
  const [tfOptions, setTfOptions] = useState(['', '', '', '']);
  const [tfAnswers, setTfAnswers] = useState(['Đúng', 'Sai', 'Đúng', 'Sai']);
  const [saAnswer, setSaAnswer] = useState('');
  const [qExplanation, setQExplanation] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);

  // Render KaTeX math in questions list
  useEffect(() => {
    if (questionsListRef.current) {
      try {
        renderMathInElement(questionsListRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (e) {
        console.warn('Math rendering error:', e);
      }
    }
  }, [questions, editingIndex]);

  // Handle PDF file selection
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setPdfMessage({ type: 'error', text: 'Vui lòng chọn tệp định dạng PDF (.pdf)!' });
        return;
      }
      setPdfFile(file);
      setPdfMessage(null);
      // Auto-suggest title if empty
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      if (!title.trim()) {
        setTitle(cleanName);
        if (titleError) setTitleError('');
      }
      // Auto-detect subject if matching keywords
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes('khtn 6')) setSubject('KHTN 6');
      else if (lowerName.includes('khtn 7')) setSubject('KHTN 7');
      else if (lowerName.includes('khtn 8')) setSubject('KHTN 8');
      else if (lowerName.includes('khtn 9')) setSubject('KHTN 9');
      else if (lowerName.includes('hóa') || lowerName.includes('hoa hoc') || lowerName.includes('chemistry')) setSubject('Hóa học');
      else if (lowerName.includes('vật lí') || lowerName.includes('vat ly') || lowerName.includes('physics')) setSubject('Vật lí');
      else if (lowerName.includes('sinh') || lowerName.includes('sinh hoc') || lowerName.includes('biology')) setSubject('Sinh học');
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Trigger PDF parsing and load questions into form template
  const handleExtractFromPdf = async () => {
    if (!pdfFile) {
      setPdfMessage({ type: 'error', text: 'Vui lòng chọn file PDF trước khi phân tích!' });
      return;
    }

    setIsParsingPdf(true);
    setPdfMessage(null);

    try {
      const fileData = await fileToBase64(pdfFile);
      const rawQuestions = await extractQuestionsFromFormattedPdfService(
        fileData,
        pdfFile.type || 'application/pdf',
        pdfInstructions
      );

      if (!rawQuestions || rawQuestions.length === 0) {
        throw new Error('AI không tìm thấy câu hỏi nào trong file PDF. Vui lòng kiểm tra lại nội dung file.');
      }

      // Format raw questions into Question objects
      const formatted: Question[] = rawQuestions.map((raw, idx) => {
        const baseId = `q-${Date.now()}-${idx}`;
        let parsedAnswer = raw.answer || '';
        
        // Handle TF answer format normalization
        if (raw.type === 'TF') {
          if (Array.isArray(parsedAnswer)) {
            parsedAnswer = JSON.stringify(parsedAnswer);
          } else if (typeof parsedAnswer === 'string' && !parsedAnswer.startsWith('[')) {
            parsedAnswer = JSON.stringify(['Đúng', 'Sai', 'Đúng', 'Sai']);
          }
        }

        return {
          id: baseId,
          type: raw.type,
          content: raw.content || `Câu hỏi ${idx + 1}`,
          options: (raw.type === 'MC' || raw.type === 'TF') 
            ? (raw.options && raw.options.length === 4 ? raw.options : ['', '', '', '']) 
            : undefined,
          answer: parsedAnswer,
          explanation: raw.explanation || '',
          timeLimit: raw.timeLimit || (raw.type === 'MC' ? 30 : 60)
        };
      });

      if (importMode === 'replace' || questions.length === 0) {
        setQuestions(formatted);
      } else {
        setQuestions(prev => [...prev, ...formatted]);
      }

      setPdfMessage({
        type: 'success',
        text: `Đã nạp thành công ${formatted.length} câu hỏi từ file PDF vào danh sách! Thầy/cô có thể nhấn "Điều chỉnh" ở bất kỳ câu nào để chỉnh sửa chi tiết rồi lưu đề.`
      });

      // Clear pdf file after successful import
      setPdfFile(null);

      // Scroll to questions list to see imported questions
      setTimeout(() => {
        questionsListRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);

    } catch (err: any) {
      console.error('PDF Extraction error:', err);
      setPdfMessage({
        type: 'error',
        text: err.message || 'Lỗi khi phân tích file PDF. Vui lòng kiểm tra lại API Key hoặc định dạng file.'
      });
    } finally {
      setIsParsingPdf(false);
    }
  };

  // Load a question into form template for adjusting (editing)
  const handleStartEdit = (index: number) => {
    const q = questions[index];
    if (!q) return;

    setEditingIndex(index);
    setQType(q.type);
    setQContent(q.content);
    setTimeLimit(q.timeLimit || 30);
    setQExplanation(q.explanation || '');

    if (q.type === 'MC') {
      setMcOptions(q.options && q.options.length === 4 ? [...q.options] : ['', '', '', '']);
      setMcAnswer(q.answer || 'A');
    } else if (q.type === 'TF') {
      setTfOptions(q.options && q.options.length === 4 ? [...q.options] : ['', '', '', '']);
      try {
        const parsed = JSON.parse(q.answer);
        if (Array.isArray(parsed) && parsed.length === 4) {
          setTfAnswers(parsed);
        } else {
          setTfAnswers(['Đúng', 'Sai', 'Đúng', 'Sai']);
        }
      } catch {
        setTfAnswers(['Đúng', 'Sai', 'Đúng', 'Sai']);
      }
    } else {
      setSaAnswer(q.answer || '');
    }

    // Smooth scroll to the form template
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Cancel edit mode and reset form
  const handleCancelEdit = () => {
    setEditingIndex(null);
    resetForm();
  };

  const resetForm = () => {
    setQContent('');
    setMcOptions(['', '', '', '']);
    setMcAnswer('A');
    setTfOptions(['', '', '', '']);
    setTfAnswers(['Đúng', 'Sai', 'Đúng', 'Sai']);
    setSaAnswer('');
    setQExplanation('');
    setTimeLimit(30);
  };

  // Save question (either update existing or add new)
  const handleSaveQuestion = () => {
    if (!qContent.trim()) return alert('Vui lòng nhập nội dung câu hỏi!');

    let targetQuestion: Question;
    const currentId = editingIndex !== null ? questions[editingIndex].id : `q-${Date.now()}-${questions.length}`;

    if (qType === 'MC') {
      if (mcOptions.some(opt => !opt.trim())) {
        return alert('Vui lòng nhập đủ 4 lựa chọn A, B, C, D!');
      }
      targetQuestion = {
        id: currentId,
        type: 'MC',
        content: qContent.trim(),
        options: mcOptions.map(o => o.trim()),
        answer: mcAnswer,
        explanation: qExplanation.trim(),
        timeLimit: timeLimit || 30
      };
    } else if (qType === 'TF') {
      if (tfOptions.some(opt => !opt.trim())) {
        return alert('Vui lòng nhập đủ 4 nhận định a, b, c, d!');
      }
      targetQuestion = {
        id: currentId,
        type: 'TF',
        content: qContent.trim(),
        options: tfOptions.map(o => o.trim()),
        answer: JSON.stringify(tfAnswers),
        explanation: qExplanation.trim(),
        timeLimit: timeLimit || 60
      };
    } else {
      if (!saAnswer.trim()) return alert('Vui lòng nhập đáp án cho câu hỏi!');
      targetQuestion = {
        id: currentId,
        type: qType,
        content: qContent.trim(),
        answer: saAnswer.trim(),
        explanation: qExplanation.trim(),
        timeLimit: timeLimit || 60
      };
    }

    if (editingIndex !== null) {
      // Update existing question
      setQuestions(prev => prev.map((q, idx) => idx === editingIndex ? targetQuestion : q));
      alert(`Đã cập nhật câu hỏi số ${editingIndex + 1} thành công!`);
      setEditingIndex(null);
    } else {
      // Add new question
      setQuestions(prev => [...prev, targetQuestion]);
    }

    resetForm();
  };

  // Duplicate a question
  const handleDuplicate = (index: number) => {
    const q = questions[index];
    if (!q) return;
    const duplicated: Question = {
      ...q,
      id: `q-${Date.now()}-${questions.length}`,
      content: `${q.content} (Bản sao)`
    };
    const next = [...questions];
    next.splice(index + 1, 0, duplicated);
    setQuestions(next);
  };

  // Move question up / down
  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const next = [...questions];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setQuestions(next);
  };

  // Save full quiz to System (Firestore + LocalStorage dual storage)
  const handleSaveQuiz = async (openHostDirectly = false, downloadBackup = false) => {
    if (!title.trim()) {
      setTitleError('Vui lòng nhập tên bộ đề!');
      titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      titleInputRef.current?.focus();
      return alert('Vui lòng nhập tên bộ đề trước khi lưu!');
    }
    setTitleError('');

    if (questions.length === 0) {
      return alert('Vui lòng thêm hoặc nạp ít nhất 1 câu hỏi từ PDF trước khi lưu!');
    }

    setIsSaving(true);
    try {
      const savedQuiz = await saveQuizToSystem({
        title: title.trim(),
        subject: subject.trim() || 'KHTN',
        createdBy: 'admin',
        createdAt: Date.now(),
        questions
      });

      if (downloadBackup) {
        exportQuizToJsonFile(savedQuiz);
      }

      if (openHostDirectly) {
        alert(`Đã lưu thành công bộ đề "${savedQuiz.title}"! Đang chuyển sang phòng thi đấu cả lớp...`);
        navigate(`/host/board/${savedQuiz.id}`);
      } else {
        alert(`Đã lưu thành công bộ đề "${savedQuiz.title}" (${savedQuiz.subject}) gồm ${savedQuiz.questions.length} câu hỏi vào hệ thống! Bộ đề đã sẵn sàng để sử dụng nhiều lần.`);
        navigate('/admin');
      }
    } catch (e: any) {
      console.error('Lỗi lưu đề:', e);
      alert('Lỗi lưu đề: ' + (e.message || 'Lỗi không xác định'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Soạn đề thủ công & Nhập từ PDF</h2>
            <p className="text-slate-500 text-sm">Upload file PDF đã định dạng câu hỏi hoặc nhập trực tiếp từng câu vào form mẫu.</p>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSaveQuiz(false, true)}
              disabled={isSaving}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs sm:text-sm border border-indigo-200 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Lưu vào hệ thống và tự động tải 1 bản sao lưu .json về máy tính"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Lưu &</span> Tải file
            </button>

            <button
              type="button"
              onClick={() => handleSaveQuiz(true, false)}
              disabled={isSaving}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Lưu và mở ngay phòng thi đấu cho cả lớp cùng tham gia"
            >
              <Users className="w-4 h-4" />
              <span>Chiếu lớp</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveQuiz(false, false)}
              disabled={isSaving}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Lưu Vào Kho ({questions.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Thông tin bộ đề */}
      <div className={`bg-white p-6 rounded-3xl shadow-sm border transition-all space-y-4 ${titleError ? 'border-rose-400 ring-4 ring-rose-100' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <span>Thông tin bộ đề</span>
          </h3>
          {questions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleSaveQuiz(false, false)}
                disabled={isSaving}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Lưu Kho ({questions.length} câu)</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>Tên bộ đề</span>
                <span className="text-rose-500 font-black">*</span>
              </span>
              {titleError && <span className="text-rose-600 font-bold text-xs">{titleError}</span>}
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              placeholder="Ví dụ: Ôn tập Chương 1 - Nguyên tử và Bảng tuần hoàn"
              className={`w-full p-3.5 bg-white border-2 rounded-xl text-slate-900 font-bold text-base outline-none transition-all placeholder:text-slate-400 placeholder:font-normal ${
                titleError ? 'border-rose-500 focus:ring-4 focus:ring-rose-500/20' : 'border-slate-300 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20'
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              <span>Môn học / Khối lớp</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="KHTN / Hóa học / Vật lí..."
              className="w-full p-3.5 bg-white border-2 border-slate-300 text-slate-900 font-bold text-base rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>
        </div>

        {/* Quick Suggestion Chips for Subject */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs font-semibold text-slate-500 mr-1">Gợi ý nhanh môn học:</span>
          {['KHTN 6', 'KHTN 7', 'KHTN 8', 'KHTN 9', 'KHTN', 'Vật lí', 'Hóa học', 'Sinh học'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subject === s 
                  ? 'bg-teal-600 text-white shadow-xs' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* FEATURE: Upload PDF đã định dạng câu hỏi -> Nhập vào form mẫu */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-teal-50/40 to-slate-50 p-6 rounded-3xl border-2 border-dashed border-indigo-200 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span>Tạo câu hỏi từ file PDF đã định dạng</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-full">Gemini 3.5 Flash</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Quy trình: <strong>Upload file PDF</strong> ➔ AI tự động trích xuất & <strong>nhập vào form mẫu</strong> ➔ Thầy cô <strong>điều chỉnh</strong> ➔ <strong>Lưu đề</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Box */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <label className="flex-1 w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200 rounded-xl cursor-pointer transition-colors text-indigo-700 font-semibold text-sm">
              <FileUp className="w-4 h-4" />
              <span>{pdfFile ? pdfFile.name : 'Chọn file PDF đề thi (.pdf)...'}</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfFileChange}
                className="hidden"
                disabled={isParsingPdf}
              />
            </label>

            {pdfFile && (
              <button
                type="button"
                onClick={() => setPdfFile(null)}
                className="p-3 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
                title="Hủy chọn file"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {pdfFile && (
            <div className="text-xs text-slate-500 flex items-center justify-between px-1">
              <span>Kích thước: {(pdfFile.size / 1024).toFixed(1)} KB</span>
              <span>Định dạng hỗ trợ: Trắc nghiệm A,B,C,D; Đúng-Sai a,b,c,d; Trả lời ngắn; Tự luận</span>
            </div>
          )}

          {/* Optional instructions */}
          <div>
            <input
              type="text"
              value={pdfInstructions}
              onChange={e => setPdfInstructions(e.target.value)}
              placeholder="Ghi chú thêm cho AI khi đọc PDF (Tùy chọn: VD: Lấy trọn vẹn tất cả câu hỏi, giữ nguyên đáp án...)"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 text-slate-900 font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Mode choice if questions already exist */}
          {questions.length > 0 && (
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 pt-1">
              <span>Khi nạp câu hỏi:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="text-indigo-600"
                />
                <span>Nối tiếp vào danh sách ({questions.length} câu hiện có)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="text-indigo-600"
                />
                <span>Thay thế toàn bộ</span>
              </label>
            </div>
          )}

          {/* Action button */}
          <button
            type="button"
            onClick={handleExtractFromPdf}
            disabled={!pdfFile || isParsingPdf}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {isParsingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang phân tích PDF & nạp câu hỏi vào form mẫu (Gemini 3.5 Flash)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Phân tích PDF & Nhập vào form mẫu</span>
              </>
            )}
          </button>
        </div>

        {/* Message Banner */}
        {pdfMessage && (
          <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-start gap-2.5 ${
            pdfMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {pdfMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">{pdfMessage.text}</div>
          </div>
        )}
      </div>

      {/* FORM MẪU CÂU HỎI (Dùng cho cả Thêm mới và Điều chỉnh câu từ PDF) */}
      <div 
        ref={formRef}
        className={`bg-white p-6 rounded-3xl shadow-sm border transition-all space-y-5 ${
          editingIndex !== null ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
        }`}
      >
        {/* Status banner if adjusting */}
        {editingIndex !== null ? (
          <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
              <Pencil className="w-4 h-4 text-amber-600" />
              <span>Đang điều chỉnh Câu số {editingIndex + 1} ({qType === 'MC' ? 'Trắc nghiệm 4 lựa chọn' : qType === 'TF' ? 'Đúng-Sai' : qType === 'SA' ? 'Trả lời ngắn' : 'Tự luận'})</span>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs font-semibold px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors"
            >
              Hủy điều chỉnh
            </button>
          </div>
        ) : (
          <h3 className="font-bold text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-teal-600" />
              <span>Form mẫu câu hỏi</span>
            </span>
            <span className="text-xs font-normal text-slate-400">Nhập thủ công hoặc bấm "Điều chỉnh" câu hỏi bên dưới</span>
          </h3>
        )}

        {/* Question Type Switcher */}
        <div className="flex flex-wrap gap-2 pt-1">
          {(['MC', 'TF', 'SA', 'ESSAY'] as QuestionType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setQType(t)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                qType === t
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'MC' ? '1. Trắc nghiệm (4 lựa chọn)' : t === 'TF' ? '2. Đúng - Sai (a,b,c,d)' : t === 'SA' ? '3. Trả lời ngắn' : '4. Tự luận'}
            </button>
          ))}
        </div>

        {/* Question Content Input */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            {'Nội dung câu hỏi (Hỗ trợ công thức Toán/Lý/Hóa KaTeX kẹp giữa $...$, VD: $H_2SO_4$, $\\frac{a}{b}$)'}
          </label>
          <textarea
            value={qContent}
            onChange={e => setQContent(e.target.value)}
            placeholder="Nhập nội dung câu hỏi..."
            className="w-full p-3.5 bg-white border border-slate-200 text-slate-900 font-medium rounded-xl focus:ring-2 focus:ring-teal-500 outline-none min-h-[90px] text-sm leading-relaxed placeholder:text-slate-400"
          />
        </div>

        {/* MC Options */}
        {qType === 'MC' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-600">
                4 Lựa chọn A, B, C, D (Nhấp nút tròn để chọn đáp án đúng)
              </label>
              <span className="text-xs text-teal-700 font-bold">Đáp án đúng: {mcAnswer}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['A', 'B', 'C', 'D'].map((letter, i) => {
                const isSelected = mcAnswer === letter;
                return (
                  <div 
                    key={letter} 
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                      isSelected ? 'bg-teal-50/80 border-teal-300 ring-1 ring-teal-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      isSelected ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {letter}
                    </span>
                    <input
                      type="text"
                      value={mcOptions[i]}
                      onChange={e => {
                        const next = [...mcOptions];
                        next[i] = e.target.value;
                        setMcOptions(next);
                      }}
                      placeholder={`Nội dung lựa chọn ${letter}...`}
                      className="flex-1 p-2 bg-white border border-slate-200 text-slate-900 font-medium rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none placeholder:text-slate-400"
                    />
                    <input
                      type="radio"
                      name="correct-mc"
                      checked={isSelected}
                      onChange={() => setMcAnswer(letter)}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      title={`Chọn ${letter} là đáp án đúng`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TF Options */}
        {qType === 'TF' && (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-600">4 Nhận định Đúng - Sai (a, b, c, d)</label>
            <div className="space-y-2.5">
              {['a', 'b', 'c', 'd'].map((letter, i) => (
                <div key={letter} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm flex-shrink-0 uppercase">
                    {letter}
                  </span>
                  <input
                    type="text"
                    value={tfOptions[i]}
                    onChange={e => {
                      const next = [...tfOptions];
                      next[i] = e.target.value;
                      setTfOptions(next);
                    }}
                    placeholder={`Nội dung nhận định ${letter}...`}
                    className="flex-1 p-2 bg-white border border-slate-200 text-slate-900 font-medium rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none placeholder:text-slate-400"
                  />
                  <select
                    value={tfAnswers[i]}
                    onChange={e => {
                      const next = [...tfAnswers];
                      next[i] = e.target.value;
                      setTfAnswers(next);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                      tfAnswers[i] === 'Đúng' 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    <option value="Đúng">Đúng</option>
                    <option value="Sai">Sai</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Short Answer / Essay */}
        {(qType === 'SA' || qType === 'ESSAY') && (
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              {qType === 'SA' ? 'Đáp án ngắn chính xác (Ví dụ: 4, Oxi, 12.5)' : 'Đáp án mẫu / Hướng dẫn chấm điểm'}
            </label>
            <input
              type="text"
              value={saAnswer}
              onChange={e => setSaAnswer(e.target.value)}
              placeholder="Nhập đáp án..."
              className="w-full p-3 bg-white border border-slate-200 text-slate-900 font-medium rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none placeholder:text-slate-400"
            />
          </div>
        )}

        {/* Explanation & Time Limit */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Lời giải chi tiết / Hướng dẫn giải (Tùy chọn)
            </label>
            <input
              type="text"
              value={qExplanation}
              onChange={e => setQExplanation(e.target.value)}
              placeholder="Giải thích vì sao chọn đáp án này..."
              className="w-full p-2.5 bg-white border border-slate-200 text-slate-900 font-medium rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Thời gian (giây)</label>
            <select
              value={timeLimit}
              onChange={e => setTimeLimit(Number(e.target.value))}
              className="w-full p-2.5 bg-white border border-slate-200 text-slate-900 font-semibold rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value={15}>15 giây</option>
              <option value={30}>30 giây</option>
              <option value={45}>45 giây</option>
              <option value={60}>60 giây</option>
              <option value={90}>90 giây</option>
              <option value={120}>120 giây</option>
            </select>
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="flex gap-3 pt-2">
          {editingIndex !== null ? (
            <>
              <button
                type="button"
                onClick={handleSaveQuestion}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Check className="w-4 h-4" /> Cập nhật câu hỏi số {editingIndex + 1}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                Hủy
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSaveQuestion}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Thêm câu hỏi vào danh sách
            </button>
          )}
        </div>
      </div>

      {/* DANH SÁCH CÂU HỎI ĐÃ NẠP / THÊM (Có nút "Điều chỉnh", "Nhân bản", "Xóa") */}
      <div ref={questionsListRef} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-lg">Danh sách câu hỏi ({questions.length})</h3>
            {questions.length > 0 && (
              <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 text-xs font-bold rounded-full">
                Sẵn sàng lưu
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {questions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ các câu hỏi trong danh sách này?')) {
                    setQuestions([]);
                    setEditingIndex(null);
                  }
                }}
                className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-semibold"
              >
                Xóa tất cả
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSaveQuiz(false, false)}
              disabled={isSaving || questions.length === 0}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Lưu Bộ Đề Vào Hệ Thống</span>
            </button>
          </div>
        </div>

        {/* Sync Title & Subject directly above/with question list for instant saving */}
        {questions.length > 0 && (
          <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-teal-900 mb-1 flex items-center gap-1">
                  <span>Tên bộ đề</span>
                  <span className="text-rose-500 font-black">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    if (titleError) setTitleError('');
                  }}
                  placeholder="Nhập tên bộ đề..."
                  className="w-full p-2.5 bg-white border border-teal-300 text-slate-900 font-bold text-sm rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-teal-900 mb-1">Môn học / Khối lớp</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="KHTN / Hóa học / Vật lí..."
                  className="w-full p-2.5 bg-white border border-teal-300 text-slate-900 font-bold text-sm rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
            <div className="flex-shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => handleSaveQuiz(false, false)}
                disabled={isSaving}
                className="w-full md:w-auto px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>Lưu Bộ Đề ({questions.length} câu)</span>
              </button>
            </div>
          </div>
        )}

        {questions.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium">Chưa có câu hỏi nào trong danh sách.</p>
            <p className="text-xs text-slate-400">
              Hãy <strong>tải file PDF lên ở phía trên</strong> để AI trích xuất tự động vào form mẫu, hoặc nhập thủ công vào form mẫu bên trên.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, i) => {
              const isBeingEdited = editingIndex === i;
              return (
                <div 
                  key={q.id || i} 
                  className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    isBeingEdited 
                      ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-200' 
                      : 'bg-slate-50 hover:bg-white border-slate-200 hover:shadow-xs'
                  }`}
                >
                  {/* Question Card Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-teal-600 text-white text-xs font-bold rounded-lg shadow-xs">
                        Câu {i + 1}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs font-bold rounded">
                        {q.type === 'MC' ? 'Trắc nghiệm' : q.type === 'TF' ? 'Đúng-Sai' : q.type === 'SA' ? 'Trả lời ngắn' : 'Tự luận'}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        ⏱ {q.timeLimit || 30}s
                      </span>
                    </div>

                    {/* Action buttons: Điều chỉnh, Nhân bản, Lên, Xuống, Xóa */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(i)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          isBeingEdited 
                            ? 'bg-amber-500 text-white' 
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300'
                        }`}
                        title="Nạp câu hỏi này vào form mẫu bên trên để điều chỉnh"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{isBeingEdited ? 'Đang điều chỉnh' : 'Điều chỉnh'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(i)}
                        className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Nhân bản câu này"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMove(i, 'up')}
                        disabled={i === 0}
                        className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Di chuyển lên trên"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMove(i, 'down')}
                        disabled={i === questions.length - 1}
                        className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Di chuyển xuống dưới"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Bạn có chắc muốn xóa Câu ${i + 1}?`)) {
                            if (editingIndex === i) setEditingIndex(null);
                            setQuestions(prev => prev.filter((_, idx) => idx !== i));
                          }
                        }}
                        className="p-1.5 bg-white border border-slate-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                        title="Xóa câu hỏi này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="font-semibold text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                    {q.content}
                  </div>

                  {/* Question Options Preview */}
                  {q.type === 'MC' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const letter = ['A', 'B', 'C', 'D'][oIdx];
                        const isCorrect = q.answer === letter;
                        return (
                          <div 
                            key={oIdx} 
                            className={`p-2.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2 ${
                              isCorrect 
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' 
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {letter}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && (
                              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'TF' && q.options && (
                    <div className="space-y-1.5 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const letter = ['a', 'b', 'c', 'd'][oIdx];
                        let isTrue = false;
                        try {
                          const parsed = JSON.parse(q.answer);
                          isTrue = parsed[oIdx] === 'Đúng';
                        } catch {
                          isTrue = false;
                        }
                        return (
                          <div key={oIdx} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm">
                            <span className="font-medium text-slate-800">
                              <strong className="font-mono text-slate-500 mr-1">{letter})</strong> {opt}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                              isTrue ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {isTrue ? 'Đúng' : 'Sai'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(q.type === 'SA' || q.type === 'ESSAY') && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-800">
                      <strong>Đáp án chính xác:</strong> <span className="font-mono">{q.answer}</span>
                    </div>
                  )}

                  {/* Explanation preview if available */}
                  {q.explanation && (
                    <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Lời giải:</strong> {q.explanation}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bottom Save Action Bar */}
            <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/10 p-6 rounded-3xl border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              <div>
                <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                  <span>Sẵn sàng lưu bộ đề ({questions.length} câu hỏi)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bộ đề sẽ được lưu trữ đa tầng vào cơ sở dữ liệu và bộ nhớ máy để sẵn sàng sử dụng nhiều lần.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveQuiz(false, true)}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-white hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl text-xs sm:text-sm border border-indigo-200 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Lưu vào hệ thống và tải 1 file sao lưu .json về máy"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Lưu & Tải file (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveQuiz(true, false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  title="Lưu và chiếu trực tiếp cho cả lớp thi đấu"
                >
                  <Users className="w-4 h-4" />
                  <span>Lưu & Chiếu cả lớp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveQuiz(false, false)}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Lưu Vào Kho Đề</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateFile() {
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [subject, setSubject] = useState('KHTN');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!file) return alert("Vui lòng chọn một tệp tài liệu!");
    setIsGenerating(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const fileData = reader.result as string;
        try {
          const questions = await generateQuizFromFileService(
            fileData,
            file.type,
            instructions
          );
          
          const parsedQuestions = questions.map((q: any, i: number) => ({
            id: `q-${Date.now()}-${i}`,
            type: q.type,
            content: q.content,
            options: q.options || [],
            answer: q.answer,
            timeLimit: q.type === 'MC' ? 30 : 60
          }));
          setGeneratedQuestions(parsedQuestions);
          if (!quizTitle) {
            setQuizTitle(`Bộ đề từ tài liệu: ${file.name.replace(/\.[^/.]+$/, "")}`);
          }
        } catch (err: any) {
          alert("Lỗi tạo đề từ file: " + err.message);
        } finally {
          setIsGenerating(false);
        }
      };
    } catch (e: any) {
      alert("Lỗi đọc file: " + e.message);
      setIsGenerating(false);
    }
  };

  const handleSave = async (openHost = false, downloadBackup = false) => {
    if (!quizTitle.trim()) return alert("Vui lòng nhập tên đề!");
    if (generatedQuestions.length === 0) return alert("Chưa có câu hỏi nào!");
    setIsSaving(true);
    try {
      const savedQuiz = await saveQuizToSystem({
        title: quizTitle.trim(),
        subject: subject.trim() || 'KHTN',
        createdBy: 'admin',
        createdAt: Date.now(),
        questions: generatedQuestions
      });

      if (downloadBackup) {
        exportQuizToJsonFile(savedQuiz);
      }

      if (openHost) {
        alert("Lưu bộ đề thành công! Đang chuyển đến màn hình thi đấu cả lớp.");
        navigate(`/host/board/${savedQuiz.id}`);
      } else {
        alert(`Lưu bộ đề "${savedQuiz.title}" vào hệ thống thành công! Có thể sử dụng nhiều lần.`);
        navigate('/admin');
      }
    } catch (e: any) {
      alert("Lỗi lưu đề: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin" className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tạo đề từ File tài liệu</h2>
          <p className="text-slate-500 text-sm">Hỗ trợ nhận diện tự động từ PDF, tài liệu hoặc ảnh chụp đề thi.</p>
        </div>
      </div>

      {/* API Key Panel */}
      <ApiKeySettings />

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        {generatedQuestions.length === 0 ? (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors bg-slate-50">
              <input 
                type="file" 
                accept=".pdf,image/png,image/jpeg,image/webp" 
                onChange={handleFileChange} 
                className="hidden" 
                id="file-upload" 
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
                <FileUp className="w-12 h-12 text-blue-400 mb-4" />
                <span className="text-lg font-semibold text-slate-700">
                  {file ? file.name : "Nhấn để chọn file tài liệu (PDF, PNG, JPG)"}
                </span>
                <span className="text-sm text-slate-500 mt-2">Hỗ trợ nhận diện đề thi từ ảnh chụp hoặc file PDF</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Lưu ý bổ sung cho AI (Tùy chọn)</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow min-h-[100px] resize-y"
                placeholder="Ví dụ: Lấy 10 câu trắc nghiệm và 2 câu đúng sai bám sát file, chuẩn bị KaTeX cho các công thức..."
              />
            </div>
            
            <div className="pt-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !file}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <BrainCircuit className="w-6 h-6" />}
                {isGenerating ? 'AI đang phân tích file và tạo đề...' : 'Phân tích file & Tạo bộ đề'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Tên bộ đề</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={e => setQuizTitle(e.target.value)}
                    placeholder="Nhập tên bộ đề..."
                    className="w-full p-3 bg-white border border-blue-200 text-slate-900 font-bold rounded-xl focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Danh mục / Môn học</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Môn học..."
                    className="w-full p-3 bg-white border border-blue-200 text-slate-900 font-bold rounded-xl focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => handleSave(false, true)}
                  disabled={isSaving || !quizTitle}
                  className="px-4 py-3 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs text-xs cursor-pointer disabled:opacity-50"
                  title="Lưu và tải 1 file sao lưu .json về máy tính"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Lưu & Tải file</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(true, false)}
                  disabled={isSaving || !quizTitle}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs text-xs cursor-pointer disabled:opacity-50"
                  title="Lưu và mở phòng thi đấu ngay cho cả lớp"
                >
                  <Users className="w-4 h-4" />
                  <span>Lưu & Chiếu lớp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(false, false)}
                  disabled={isSaving || !quizTitle}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md text-xs sm:text-sm cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Lưu Vào Kho Đề</span>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="font-bold text-lg text-slate-800 flex items-center justify-between">
                <span>Xem trước câu hỏi ({generatedQuestions.length})</span>
                <button onClick={() => setGeneratedQuestions([])} className="text-sm font-normal text-red-500 hover:underline">Tạo lại</button>
              </h3>
              
              {generatedQuestions.map((q, idx) => (
                <div key={q.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex gap-2 items-start mb-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 font-bold rounded-lg">
                      {idx + 1}
                    </span>
                    <div className="flex-1 text-slate-800 font-medium pt-1 whitespace-pre-wrap">
                      {q.content}
                    </div>
                  </div>
                  
                  {q.type === 'MC' && q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-10 mb-4">
                      {q.options.map((opt, i) => (
                        <div key={i} className={`p-3 rounded-xl border ${q.answer === ['A','B','C','D'][i] ? 'bg-indigo-50 border-indigo-300 font-semibold text-indigo-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                          {['A','B','C','D'][i]}. {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'TF' && q.options && (
                    <div className="space-y-2 pl-10 mb-4">
                      {q.options.map((opt, i) => {
                        let ansArr = [];
                        try { ansArr = JSON.parse(q.answer); } catch(e) {}
                        const isTrue = ansArr[i] === 'Đúng';
                        return (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                            <div className="flex-1">{['A','B','C','D'][i]}) {opt}</div>
                            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${isTrue ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                              {isTrue ? 'Đúng' : 'Sai'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {(q.type === 'SA' || q.type === 'ESSAY') && (
                    <div className="pl-10">
                      <div className="p-4 bg-white border border-indigo-200 rounded-xl text-indigo-700 font-medium">
                        Đáp án: {q.answer}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateAI() {
  const [reqs, setReqs] = useState('');
  const [mcqCount, setMcqCount] = useState(6);
  const [tfCount, setTfCount] = useState(2);
  const [blankCount, setBlankCount] = useState(2);
  const [essayCount, setEssayCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [subject, setSubject] = useState('KHTN');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!reqs.trim()) return alert("Vui lòng nhập yêu cầu cần đạt hoặc chủ đề kiến thức!");
    setIsGenerating(true);
    try {
      const questions = await generateQuizFromTextService(
        reqs,
        mcqCount,
        tfCount,
        blankCount,
        essayCount
      );
      
      const parsedQuestions = questions.map((q: any, i: number) => ({
        id: `q-${Date.now()}-${i}`,
        type: q.type,
        content: q.content,
        options: q.options || [],
        answer: q.answer,
        timeLimit: q.type === 'MC' ? 30 : 60
      }));
      setGeneratedQuestions(parsedQuestions);
      if (!quizTitle) {
        setQuizTitle(`Bộ đề ôn tập KHTN: ${reqs.slice(0, 40)}...`);
      }
    } catch (e: any) {
      alert("Lỗi tạo đề AI: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (openHost = false, downloadBackup = false) => {
    if (!quizTitle.trim()) return alert("Vui lòng nhập tên đề!");
    if (generatedQuestions.length === 0) return alert("Chưa có câu hỏi nào!");
    setIsSaving(true);
    try {
      const savedQuiz = await saveQuizToSystem({
        title: quizTitle.trim(),
        subject: subject.trim() || 'KHTN',
        createdBy: 'admin',
        createdAt: Date.now(),
        questions: generatedQuestions
      });

      if (downloadBackup) {
        exportQuizToJsonFile(savedQuiz);
      }

      if (openHost) {
        alert("Lưu bộ đề thành công! Đang chuyển đến màn hình thi đấu cả lớp.");
        navigate(`/host/board/${savedQuiz.id}`);
      } else {
        alert(`Đã lưu bộ đề "${savedQuiz.title}" vào hệ thống thành công! Bạn có thể sử dụng nhiều lần.`);
        navigate('/admin');
      }
    } catch (e: any) {
      alert("Lỗi lưu đề: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin" className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tạo đề tự động bằng AI</h2>
          <p className="text-slate-500 text-sm">Bám sát chương trình GDPT 2018, cấu trúc 4 phần chuẩn khoa học.</p>
        </div>
      </div>

      {/* Free API Key Panel */}
      <ApiKeySettings />

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        {generatedQuestions.length === 0 ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Yêu cầu cần đạt / Nội dung kiến thức ôn tập
              </label>
              <textarea
                value={reqs}
                onChange={e => setReqs(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow min-h-[120px] resize-y text-slate-800"
                placeholder="Ví dụ: Ôn tập về Kim loại, phản ứng của kim loại với phi kim, axit. Viết phương trình hóa học và công thức tính toán. Bám sát SGK KHTN Kết nối tri thức..."
              />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">Trắc nghiệm 4 lựa chọn</label>
                <input 
                  type="number" 
                  min="0" 
                  max="40"
                  value={mcqCount} 
                  onChange={e => setMcqCount(Number(e.target.value))} 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-teal-700" 
                />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">Đúng - Sai (4 ý)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={tfCount} 
                  onChange={e => setTfCount(Number(e.target.value))} 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-teal-700" 
                />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">Trả lời ngắn / Điền khuyết</label>
                <input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={blankCount} 
                  onChange={e => setBlankCount(Number(e.target.value))} 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-teal-700" 
                />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">Tự luận giải thích</label>
                <input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={essayCount} 
                  onChange={e => setEssayCount(Number(e.target.value))} 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-teal-700" 
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                {isGenerating ? 'AI đang phân tích và tạo bộ đề theo chuẩn...' : 'Bắt đầu tạo bộ đề bằng AI'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-teal-50 border border-teal-100 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <label className="block text-sm font-semibold text-teal-900 mb-1">Tên bộ đề</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={e => setQuizTitle(e.target.value)}
                    placeholder="Nhập tên bộ đề..."
                    className="w-full p-3 bg-white border border-teal-200 text-slate-900 font-bold rounded-xl focus:ring-2 focus:ring-teal-500 outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-teal-900 mb-1">Danh mục / Môn học</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Môn học..."
                    className="w-full p-3 bg-white border border-teal-200 text-slate-900 font-bold rounded-xl focus:ring-2 focus:ring-teal-500 outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => handleSave(false, true)}
                  disabled={isSaving || !quizTitle}
                  className="px-4 py-3 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs text-xs cursor-pointer disabled:opacity-50"
                  title="Lưu vào hệ thống và tải 1 file sao lưu .json về máy tính"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Lưu & Tải file</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(true, false)}
                  disabled={isSaving || !quizTitle}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs text-xs cursor-pointer disabled:opacity-50"
                  title="Lưu và mở phòng thi đấu ngay cho cả lớp"
                >
                  <Users className="w-4 h-4" />
                  <span>Lưu & Chiếu lớp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(false, false)}
                  disabled={isSaving || !quizTitle}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md text-xs sm:text-sm cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Lưu Vào Kho Đề</span>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-800">
                  Xem trước câu hỏi ({generatedQuestions.length})
                </h3>
                <button 
                  onClick={() => setGeneratedQuestions([])} 
                  className="text-sm font-semibold text-red-500 hover:underline"
                >
                  Tạo lại
                </button>
              </div>
              
              {generatedQuestions.map((q, idx) => (
                <div key={q.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex gap-2 items-start mb-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-teal-100 text-teal-700 font-bold rounded-lg">
                      {idx + 1}
                    </span>
                    <div className="flex-1 text-slate-800 font-medium pt-1 whitespace-pre-wrap">
                      {q.content}
                    </div>
                  </div>
                  
                  {q.type === 'MC' && q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-10 mb-4">
                      {q.options.map((opt, i) => (
                        <div key={i} className={`p-3 rounded-xl border ${q.answer === ['A','B','C','D'][i] ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                          {['A','B','C','D'][i]}. {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'TF' && q.options && (
                    <div className="space-y-2 pl-10 mb-4">
                      {q.options.map((opt, i) => {
                        let ansArr = [];
                        try { ansArr = JSON.parse(q.answer); } catch(e) {}
                        const isTrue = ansArr[i] === 'Đúng';
                        return (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                            <div className="flex-1">{['A','B','C','D'][i]}) {opt}</div>
                            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${isTrue ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {isTrue ? 'Đúng' : 'Sai'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {(q.type === 'SA' || q.type === 'ESSAY') && (
                    <div className="pl-10">
                      <div className="p-4 bg-white border border-emerald-200 rounded-xl text-emerald-700 font-medium">
                        Đáp án: {q.answer}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
