import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Quiz } from '../types';
import { 
  Loader2, 
  ArrowLeft, 
  Play, 
  LayoutGrid, 
  Sparkles, 
  BookOpen, 
  GraduationCap, 
  KeyRound, 
  Eye, 
  EyeOff, 
  AlertCircle,
  LogOut,
  Users,
  Atom
} from 'lucide-react';
import { CyberSpaceBackground } from '../components/CyberSpaceBackground';
import { gameAudio } from '../utils/gameAudio';
import { isTeacherAuthenticated, setTeacherAuthenticated, verifyTeacherPassword } from '../utils/auth';
import TtsVoiceSettingsModal from '../components/TtsVoiceSettingsModal';
import ExamSeatingModal from '../components/ExamSeatingModal';
import AtomicCountdownClock from '../components/AtomicCountdownClock';
import { getTtsGenderPreference, TtsGender } from '../utils/textToSpeech';
import { loadAllQuizzesFromSystem, getLocalQuizzes } from '../utils/quizStorage';

export default function Host() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isTeacherAuthenticated());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showTtsModal, setShowTtsModal] = useState(false);
  const [showSeatingModal, setShowSeatingModal] = useState(false);
  const [showAtomicClock, setShowAtomicClock] = useState(false);
  const [ttsGender, setTtsGender] = useState<TtsGender>(() => getTtsGenderPreference());

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchQuizzes = async () => {
      try {
        const list = await loadAllQuizzesFromSystem();
        setQuizzes(list);
      } catch (e) {
        console.error('Error fetching quizzes:', e);
        setQuizzes(getLocalQuizzes());
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setLoginError('Vui lòng nhập mật khẩu Giáo viên');
      return;
    }

    if (verifyTeacherPassword(password)) {
      setTeacherAuthenticated(true);
      setIsAuthenticated(true);
      setLoginError('');
      gameAudio.playVictory();
    } else {
      setLoginError('Mật khẩu Giáo viên không đúng. Mật khẩu mặc định: gv123');
      gameAudio.playIncorrect();
    }
  };

  const handleLogout = () => {
    setTeacherAuthenticated(false);
    setIsAuthenticated(false);
    setPassword('');
    setLoginError('');
  };

  const handleStartGame = (quiz: Quiz) => {
    gameAudio.playClick();
    sessionStorage.removeItem(`active_host_session_${quiz.id}`);
    navigate(`/host/board/${quiz.id}`);
  };

  // If not authenticated as teacher, show Teacher Access Gate
  if (!isAuthenticated) {
    return (
      <CyberSpaceBackground stationColor="#6366F1" className="p-4 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md bg-slate-900/90 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(99,102,241,0.25)] border border-indigo-500/40 relative overflow-hidden backdrop-blur-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400/20 via-purple-400/20 to-sky-400/20 border-2 border-purple-400/40 flex items-center justify-center mx-auto mb-4 text-purple-300 shadow-[0_0_25px_rgba(192,132,252,0.4)]">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-lobster text-white tracking-wide">Xác Thực Giáo Viên</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Vui lòng nhập mật khẩu để mở phòng thi đấu toàn lớp
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
                    if (loginError) setLoginError('');
                  }}
                  autoFocus
                  placeholder="Nhập mật khẩu (mặc định: gv123)..."
                  className="w-full pl-4 pr-11 py-3 bg-slate-950/80 border border-indigo-500/30 rounded-2xl text-white font-medium text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 outline-none transition-all placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Mật khẩu mặc định: <code className="text-indigo-400 font-bold">gv123</code>
              </p>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-pink-400 via-purple-400 to-sky-400 hover:from-pink-300 hover:via-purple-300 hover:to-sky-300 text-slate-950 rounded-2xl font-black text-sm shadow-[0_0_25px_rgba(192,132,252,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer btn-modern-shine btn-modern-glow"
            >
              <KeyRound className="w-4 h-4" />
              <span>Xác nhận & Mở phòng</span>
            </button>

            <div className="pt-2 text-center">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại Trang chủ</span>
              </Link>
            </div>
          </form>
        </div>
      </CyberSpaceBackground>
    );
  }

  return (
    <CyberSpaceBackground stationColor="#C084FC" className="p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="p-3 bg-slate-900/80 border-2 border-purple-400/35 rounded-2xl text-purple-300 hover:text-white hover:border-pink-300 transition-all shadow-[0_0_20px_rgba(192,132,252,0.25)]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-sky-500/20 border border-purple-300/40 text-purple-200 text-xs font-black uppercase tracking-wider mb-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-pink-300" /> KHOA HỌC TỰ NHIÊN • PHÒNG THI TOÀN LỚP
              </div>
              <h1 className="text-3xl sm:text-5xl font-lobster text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-pink-300 to-amber-300 tracking-wide">
                Mở Thử Thách Toàn Lớp
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Seating Arrangement Button (30 HS) */}
            <button
              onClick={() => {
                gameAudio.playClick();
                setShowSeatingModal(true);
              }}
              className="px-3.5 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border-2 border-indigo-400/40 hover:border-indigo-300 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Mở sơ đồ xếp chỗ phòng thi: 6 dãy, mỗi dãy 5 HS (Tổng 30 HS)"
            >
              <Users className="w-4 h-4 text-indigo-300" />
              <span>Xếp chỗ HS (30)</span>
            </button>

            {/* Atomic Planetary Clock Button (5 phút) */}
            <button
              onClick={() => {
                gameAudio.playClick();
                setShowAtomicClock(true);
              }}
              className="px-3.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border-2 border-cyan-400/40 hover:border-cyan-300 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Mở đồng hồ đếm ngược hành tinh nguyên tử (Mặc định 5 phút)"
            >
              <Atom className="w-4 h-4 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Mở đồng hồ (5p)</span>
            </button>

            <button
              onClick={() => setShowTtsModal(true)}
              className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-2 border-rose-400/40 hover:border-rose-300 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Cài đặt giọng đọc (Giọng Nữ)"
            >
              <span>👩 {ttsGender === 'female' ? 'Giọng Nữ' : 'Giọng Nam'}</span>
            </button>
            <Link
              to="/admin"
              className="px-3.5 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border-2 border-teal-400/40 hover:border-teal-300 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Users className="w-4 h-4 text-teal-300" />
              <span>Danh sách học sinh</span>
            </Link>
            <Link
              to="/admin"
              className="px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 text-purple-200 border-2 border-purple-400/30 hover:border-purple-400/60 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm btn-modern-shine btn-modern-glow"
            >
              Quản trị bộ đề
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-400/40 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Đăng xuất quyền Giáo viên"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Khóa GV</span>
            </button>
          </div>
        </header>

        <div className="glass-pastel-card-glow rounded-[2.5rem] p-6 sm:p-8">
          <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-purple-300/20">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-400/20 via-purple-400/20 to-sky-400/20 border border-purple-300/40 flex items-center justify-center text-purple-300 shadow-sm">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-lobster text-white tracking-wide">Chọn Bộ Đề Để Bắt Đầu</h2>
              <p className="text-xs text-slate-300">Sau khi chọn, bạn có thể lựa chọn Chế độ Kiểm tra (Tự động) hoặc Chế độ Giáo viên (Chủ động).</p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
              <p className="text-xs text-purple-200">Đang tải danh sách bộ đề...</p>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="text-center p-12 bg-slate-950/40 rounded-3xl border-2 border-dashed border-purple-400/30">
              <p className="text-slate-300 text-base font-semibold">Chưa có bộ đề nào.</p>
              <p className="text-slate-400 text-xs mt-1">Vui lòng vào trang Quản trị để tạo hoặc nhập bộ đề trắc nghiệm.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {quizzes.map((quiz, index) => {
                const pastelAccents = [
                  { border: 'border-pink-400/35 hover:border-pink-400', badge: 'bg-pink-400/20 text-pink-200 border-pink-300/40', icon: 'bg-pink-400/15 text-pink-300 border-pink-300/40', glow: 'hover:shadow-[0_0_30px_rgba(244,114,182,0.25)]' },
                  { border: 'border-purple-400/35 hover:border-purple-400', badge: 'bg-purple-400/20 text-purple-200 border-purple-300/40', icon: 'bg-purple-400/15 text-purple-300 border-purple-300/40', glow: 'hover:shadow-[0_0_30px_rgba(192,132,252,0.25)]' },
                  { border: 'border-sky-400/35 hover:border-sky-400', badge: 'bg-sky-400/20 text-sky-200 border-sky-300/40', icon: 'bg-sky-400/15 text-sky-300 border-sky-300/40', glow: 'hover:shadow-[0_0_30px_rgba(56,189,248,0.25)]' },
                  { border: 'border-teal-400/35 hover:border-teal-400', badge: 'bg-teal-400/20 text-teal-200 border-teal-300/40', icon: 'bg-teal-400/15 text-teal-300 border-teal-300/40', glow: 'hover:shadow-[0_0_30px_rgba(45,212,191,0.25)]' },
                  { border: 'border-amber-400/35 hover:border-amber-400', badge: 'bg-amber-400/20 text-amber-200 border-amber-300/40', icon: 'bg-amber-400/15 text-amber-300 border-amber-300/40', glow: 'hover:shadow-[0_0_30px_rgba(251,191,36,0.25)]' },
                ];
                const theme = pastelAccents[index % pastelAccents.length];

                return (
                  <div 
                    key={quiz.id} 
                    className={`group relative bg-slate-900/85 backdrop-blur-xl rounded-3xl border-2 ${theme.border} p-5 sm:p-6 ${theme.glow} transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className={`w-11 h-11 rounded-2xl ${theme.icon} border flex items-center justify-center font-bold flex-shrink-0 shadow-sm`}>
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <span className={`px-3 py-1 rounded-xl border ${theme.badge} text-xs font-black tracking-wide`}>
                        {quiz.subject || 'Khoa học'}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white group-hover:text-pink-300 transition-colors line-clamp-2 mb-4">
                      {quiz.title}
                    </h3>

                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-semibold">
                        <strong className="text-white font-mono text-sm">{quiz.questions?.length || 0}</strong> câu hỏi
                      </span>

                      <button 
                        onClick={() => handleStartGame(quiz)}
                        className="px-4 py-2.5 bg-gradient-to-r from-pink-400 via-purple-400 to-sky-400 hover:from-pink-300 hover:via-purple-300 hover:to-sky-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer btn-modern-shine btn-modern-glow"
                        title="Chọn bộ đề và mở phòng chờ thi đấu"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Mở phòng thi</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TtsVoiceSettingsModal
        isOpen={showTtsModal}
        onClose={() => setShowTtsModal(false)}
        onSettingsChanged={({ gender }) => setTtsGender(gender)}
      />

      {/* Sơ đồ xếp chỗ 30 HS */}
      <ExamSeatingModal
        isOpen={showSeatingModal}
        onClose={() => setShowSeatingModal(false)}
        quizTitle="Vòng 1 - Đấu trường Số"
      />

      {/* Đồng hồ nguyên tử đếm ngược 5 phút */}
      <AtomicCountdownClock
        isOpen={showAtomicClock}
        onClose={() => setShowAtomicClock(false)}
        defaultMinutes={5}
      />
    </CyberSpaceBackground>
  );
}
