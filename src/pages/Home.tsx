import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  FlaskConical, 
  Atom, 
  Dna, 
  Rocket, 
  Lock, 
  GraduationCap, 
  Sparkles, 
  ArrowRight, 
  Zap, 
  KeyRound,
  ShieldCheck,
  Trophy,
  Star,
  Swords,
  Shield,
  Clock,
  CheckCircle2,
  Users,
  Volume2,
  X
} from 'lucide-react';
import TeacherLoginModal from '../components/TeacherLoginModal';
import ExamSeatingModal from '../components/ExamSeatingModal';
import AtomicCountdownClock from '../components/AtomicCountdownClock';
import { isTeacherAuthenticated } from '../utils/auth';
import { getCachedOpeningAudioUrl, setOpeningAudioUrlInDb, loadOpeningAudioUrlAsync } from '../utils/systemConfig';
import { gameAudio } from '../utils/gameAudio';

export default function Home() {
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showSeatingModal, setShowSeatingModal] = useState(false);
  const [showAtomicClock, setShowAtomicClock] = useState(false);
  const [showOpeningAudioModal, setShowOpeningAudioModal] = useState(false);
  const [quickCode, setQuickCode] = useState('');
  
  const [showGameEndedNotice, setShowGameEndedNotice] = useState(() => {
    const val = sessionStorage.getItem('game_ended_notice');
    if (val === 'true') {
      sessionStorage.removeItem('game_ended_notice');
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (showGameEndedNotice) {
      const timer = setTimeout(() => {
        setShowGameEndedNotice(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [showGameEndedNotice]);

  const [openingAudioUrl, setOpeningAudioUrl] = useState(() => getCachedOpeningAudioUrl());
  const [isPlayingOpeningAudio, setIsPlayingOpeningAudio] = useState(false);
  const openingAudioRef = useRef<HTMLAudioElement | null>(null);

  // Asynchronously load media from IndexedDB if saved as large audio file
  useEffect(() => {
    loadOpeningAudioUrlAsync().then((url) => {
      if (url) {
        setOpeningAudioUrl(url);
      }
    });
  }, []);

  const navigate = useNavigate();

  const handleTeacherClick = () => {
    if (isTeacherAuthenticated()) {
      navigate('/host');
    } else {
      setShowTeacherModal(true);
    }
  };

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickCode.trim()) {
      navigate(`/player?studentCode=${encodeURIComponent(quickCode.trim().toUpperCase())}`);
    } else {
      navigate('/player');
    }
  };

  const handleSaveOpeningAudio = async () => {
    try {
      await setOpeningAudioUrlInDb(openingAudioUrl.trim());
      setShowOpeningAudioModal(false);
      alert('Đã lưu âm thanh mở chương trình thành công!');
    } catch (err: any) {
      console.error('Error saving audio:', err);
      alert('Lỗi lưu âm thanh: ' + (err?.message || 'Không thể lưu file.'));
    }
  };

  const togglePlayOpeningAudio = () => {
    if (isPlayingOpeningAudio) {
      if (openingAudioRef.current) {
        openingAudioRef.current.pause();
        openingAudioRef.current.currentTime = 0;
      }
      gameAudio.stopOpeningFanfare();
      setIsPlayingOpeningAudio(false);
      return;
    }

    // If user provided a local uploaded base64 / blob audio, play it; otherwise play procedural fanfare
    const cleanUrl = openingAudioUrl.trim();
    if (cleanUrl && (cleanUrl.startsWith('data:audio') || cleanUrl.startsWith('blob:'))) {
      try {
        if (openingAudioRef.current) {
          openingAudioRef.current.pause();
        }
        const audio = new Audio(cleanUrl);
        openingAudioRef.current = audio;
        audio.play().then(() => {
          setIsPlayingOpeningAudio(true);
        }).catch(() => {
          // Fallback to offline procedural fanfare
          const played = gameAudio.playOpeningFanfare(() => setIsPlayingOpeningAudio(false));
          setIsPlayingOpeningAudio(played);
        });
        audio.onended = () => setIsPlayingOpeningAudio(false);
      } catch {
        const played = gameAudio.playOpeningFanfare(() => setIsPlayingOpeningAudio(false));
        setIsPlayingOpeningAudio(played);
      }
    } else {
      // 100% Offline Procedural Web Audio API Fanfare (No external network requests)
      const played = gameAudio.playOpeningFanfare(() => setIsPlayingOpeningAudio(false));
      setIsPlayingOpeningAudio(played);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 sm:p-8 relative overflow-hidden bg-gradient-to-b from-[#060814] via-[#0B0F28] via-[#12163B] to-[#181233] text-slate-100 selection:bg-pink-400 selection:text-slate-950">
      
      {/* Toast Notice when returning from an ended game */}
      {showGameEndedNotice && (
        <div className="fixed top-4 z-50 max-w-lg w-[90%] mx-auto bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.5)] border-2 border-emerald-300 flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎮</span>
            <div>
              <div className="font-black text-xs sm:text-sm uppercase tracking-wider">Phiên game đã kết thúc!</div>
              <div className="text-[11px] sm:text-xs text-white/90">Toàn bộ Giáo viên và Học sinh đã quay về trang chủ để bắt đầu game mới.</div>
            </div>
          </div>
          <button
            onClick={() => setShowGameEndedNotice(false)}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Mystical Starry Night Sky Canvas */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Cosmic Nebula Auroras */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[15%] -left-[10%] w-[65%] h-[65%] bg-gradient-to-br from-pink-400/20 via-purple-400/20 to-sky-400/20 rounded-full blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1.2, 0.95, 1.2], rotate: [0, -90, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] -right-[15%] w-[65%] h-[65%] bg-gradient-to-tl from-indigo-500/25 via-sky-400/20 to-teal-400/15 rounded-full blur-[150px]"
        />
        <motion.div
          animate={{ scale: [1.1, 1.3, 1.1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[15%] left-[20%] w-[60%] h-[55%] bg-gradient-to-tr from-amber-300/15 via-rose-400/15 to-violet-500/20 rounded-full blur-[130px]"
        />

        {/* Realistic Shooting Stars (Sao Băng) */}
        <div className="absolute top-[10%] right-[15%] w-40 h-[2px] bg-gradient-to-r from-transparent via-pink-200 to-white animate-shooting-star-1 opacity-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
        <div className="absolute top-[32%] right-[30%] w-48 h-[2px] bg-gradient-to-r from-transparent via-sky-200 to-white animate-shooting-star-2 opacity-0 drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
        <div className="absolute top-[15%] left-[40%] w-36 h-[1.5px] bg-gradient-to-r from-transparent via-amber-200 to-white animate-shooting-star-3 opacity-0 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]" />

        {/* Twinkling Stars in the Mysterious Sky */}
        {[
          { top: '8%', left: '10%', size: '3px', color: '#BAE6FD', dur: '3.2s', delay: '0.2s' },
          { top: '18%', left: '25%', size: '2px', color: '#DDD6FE', dur: '4.5s', delay: '1.5s' },
          { top: '12%', left: '75%', size: '3px', color: '#FEF08A', dur: '5.0s', delay: '0.5s' },
          { top: '26%', left: '88%', size: '2px', color: '#FBCFE8', dur: '3.8s', delay: '2.1s' },
          { top: '45%', left: '8%', size: '2px', color: '#99F6E4', dur: '4.2s', delay: '1.1s' },
          { top: '65%', left: '14%', size: '3px', color: '#FED7AA', dur: '3.6s', delay: '2.8s' },
          { top: '78%', left: '82%', size: '2.5px', color: '#E9D5FF', dur: '4.0s', delay: '0.9s' },
          { top: '85%', left: '35%', size: '2px', color: '#BAE6FD', dur: '3.4s', delay: '2.3s' },
          { top: '55%', left: '92%', size: '2.5px', color: '#FDE68A', dur: '4.8s', delay: '1.7s' },
          { top: '38%', left: '50%', size: '1.5px', color: '#DDD6FE', dur: '3.1s', delay: '3.0s' },
        ].map((s, idx) => (
          <div
            key={idx}
            className="absolute rounded-full"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              backgroundColor: s.color,
              boxShadow: `0 0 8px ${s.color}`,
              animation: `twinkle-star ${s.dur} ease-in-out infinite ${s.delay}`
            }}
          />
        ))}

        {/* Mystical 4-Point Sparkling Star Icons */}
        <div className="absolute top-[14%] left-[18%] text-amber-200 text-sm animate-pulse drop-shadow-[0_0_10px_rgba(253,224,71,0.8)]">✦</div>
        <div className="absolute top-[22%] right-[18%] text-pink-300 text-xs animate-pulse drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]" style={{ animationDelay: '1.3s' }}>✦</div>
        <div className="absolute top-[70%] left-[22%] text-sky-300 text-sm animate-pulse drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" style={{ animationDelay: '2.1s' }}>✦</div>
        <div className="absolute top-[80%] right-[15%] text-purple-300 text-xs animate-pulse drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]" style={{ animationDelay: '0.7s' }}>✦</div>

        {/* Subtle Starlight Texture */}
        <div 
          className="absolute inset-0 opacity-[0.14]" 
          style={{
            backgroundImage: `radial-gradient(circle at center, rgba(255, 255, 255, 0.25) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, #000 40%, transparent 95%)',
            WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, #000 40%, transparent 95%)'
          }}
        />
      </div>

      {/* HEADER: Title & Cute Science Icons */}
      <motion.div
        initial={{ opacity: 0, y: -25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-center mt-3 sm:mt-6 mb-6 sm:mb-8 relative z-10 max-w-5xl"
      >
        <div className="flex justify-center items-center gap-3.5 sm:gap-6 mb-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-teal-400/20 to-emerald-400/10 border border-teal-300/40 shadow-[0_0_25px_rgba(45,212,191,0.3)] backdrop-blur-md hover:scale-115 transition-transform duration-300 cursor-default">
            <FlaskConical className="w-6 h-6 sm:w-8 sm:h-8 text-teal-300 drop-shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
          </div>
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-400/20 to-violet-400/10 border border-purple-300/40 shadow-[0_0_25px_rgba(192,132,252,0.3)] backdrop-blur-md hover:scale-115 transition-transform duration-300 cursor-default">
            <Atom className="w-6 h-6 sm:w-8 sm:h-8 text-purple-300 animate-spin drop-shadow-[0_0_8px_rgba(192,132,252,0.6)]" style={{ animationDuration: '18s' }} />
          </div>
          <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-400/20 to-pink-400/10 border border-rose-300/40 shadow-[0_0_25px_rgba(244,114,182,0.3)] backdrop-blur-md hover:scale-115 transition-transform duration-300 cursor-default">
            <Dna className="w-6 h-6 sm:w-8 sm:h-8 text-rose-300 drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-sky-500/15 border border-purple-300/40 text-purple-200 text-xs sm:text-sm font-black uppercase tracking-widest mb-3 shadow-[0_0_25px_rgba(192,132,252,0.25)]">
          <Sparkles className="w-4 h-4 text-pink-300 animate-pulse" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-200 to-sky-300">
            KHOA HỌC TỰ NHIÊN • ĐẤU TRƯỜNG TRI THỨC
          </span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-lobster tracking-wide leading-tight mb-3 drop-shadow-[0_0_40px_rgba(192,132,252,0.45)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#67E8F9] via-[#F472B6] to-[#FDE047] filter drop-shadow-[0_2px_15px_rgba(244,114,182,0.35)]">
            Vòng 1: Đấu trường Số
          </span>
          <span className="block text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-lobster mt-2 text-transparent bg-clip-text bg-gradient-to-r from-[#DDD6FE] via-[#BAE6FD] to-[#A7F3D0] filter drop-shadow-[0_2px_15px_rgba(186,230,253,0.35)]">
            Từ dĩa ăn sạch đến thành phố sạch
          </span>
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-slate-300 font-medium max-w-3xl mx-auto leading-relaxed">
          Đấu trường thi đấu trực tiếp theo nhịp điệu giáo viên • Ngôi sao hi vọng nhân đôi điểm • Cướp điểm & Phòng thủ kịch tính • Bảng xếp hạng Top 18 vinh danh
        </p>
      </motion.div>

      {/* HERO ARENA INTERACTIVE CARD */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="w-full max-w-4xl relative z-10 my-auto"
      >
        <div className="rounded-[2.5rem] bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-indigo-950/80 border-2 border-purple-400/35 hover:border-pink-400/50 shadow-[0_0_60px_rgba(192,132,252,0.25)] p-6 sm:p-10 relative overflow-hidden backdrop-blur-2xl transition-all duration-300">
          
          {/* Ambient Lighting Accents */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-[110px] pointer-events-none" />

          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
            
            {/* Left Column: Mission Description & Special Rules */}
            <div className="flex-1 text-left space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal-400/20 to-sky-400/20 border border-teal-300/40 text-teal-200 text-xs font-black uppercase tracking-wider shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-300 animate-ping" />
                <span>🔥 THI ĐẤU TOÀN LỚP THEO NHỊP ĐIỆU GV</span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-lobster text-white leading-snug tracking-wide">
                Sẵn sàng bước vào{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-pink-300 to-amber-300">
                  Đấu trường Số
                </span>
              </h2>

              <p className="text-slate-300 text-xs sm:text-sm md:text-base leading-relaxed">
                Học sinh đăng nhập bằng mã học sinh đã được thêm từ Trang Quản Trị để vào Phòng Chờ. Khi Giáo viên mở game, toàn lớp sẽ cùng bắt đầu thi đấu đồng loạt theo thời gian thực!
              </p>

              {/* Special Game Features Grid with Pastel Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-400/15 via-yellow-400/10 to-orange-400/10 border border-amber-300/40 flex items-center gap-3 hover:border-amber-300/70 transition-colors shadow-[0_0_15px_rgba(251,191,36,0.1)]">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/25 text-amber-300 flex items-center justify-center flex-shrink-0 font-bold shadow-sm">
                    <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-amber-200">Ngôi Sao Hi Vọng</div>
                    <div className="text-[10px] text-amber-200/70">Từ câu 5 • Nhân đôi hoặc trừ điểm</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-400/15 via-pink-400/10 to-red-400/10 border border-rose-300/40 flex items-center gap-3 hover:border-rose-300/70 transition-colors shadow-[0_0_15px_rgba(244,114,182,0.1)]">
                  <div className="w-9 h-9 rounded-xl bg-rose-400/25 text-rose-300 flex items-center justify-center flex-shrink-0 font-bold shadow-sm">
                    <Swords className="w-4 h-4 text-rose-300" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-rose-200">Cướp Điểm Top 10</div>
                    <div className="text-[10px] text-rose-200/70">Từ câu 7 • Nhận thêm 50% điểm</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-gradient-to-br from-teal-400/15 via-emerald-400/10 to-cyan-400/10 border border-teal-300/40 flex items-center gap-3 hover:border-teal-300/70 transition-colors shadow-[0_0_15px_rgba(45,212,191,0.1)]">
                  <div className="w-9 h-9 rounded-xl bg-teal-400/25 text-teal-300 flex items-center justify-center flex-shrink-0 font-bold shadow-sm">
                    <Shield className="w-4 h-4 text-teal-300" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-teal-200">Khiên Phòng Thủ</div>
                    <div className="text-[10px] text-teal-200/70">Từ câu 7 • Chống bị cướp điểm</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-400/15 via-indigo-400/10 to-sky-400/10 border border-purple-300/40 flex items-center gap-3 hover:border-purple-300/70 transition-colors shadow-[0_0_15px_rgba(192,132,252,0.1)]">
                  <div className="w-9 h-9 rounded-xl bg-purple-400/25 text-purple-300 flex items-center justify-center flex-shrink-0 font-bold shadow-sm">
                    <Trophy className="w-4 h-4 text-purple-300" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-purple-200">Bảng Vàng Top 18</div>
                    <div className="text-[10px] text-purple-200/70">Phân 6 nhóm thi Vòng 2</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Quick Student Code Input & Entry CTA */}
            <div className="w-full lg:w-84 flex flex-col gap-3.5 p-5 sm:p-7 bg-slate-900/95 rounded-3xl border-2 border-purple-400/35 shadow-[0_0_40px_rgba(192,132,252,0.2)]">
              <div className="text-center space-y-1.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-400/20 via-purple-400/20 to-sky-400/20 border border-purple-300/40 flex items-center justify-center mx-auto text-purple-300 shadow-[0_0_20px_rgba(192,132,252,0.35)]">
                  <Rocket className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-lobster text-white tracking-wide">Vào Phòng Chờ</h3>
                <p className="text-xs text-slate-400">Chỉ dùng Mã Học Sinh (từ Quản trị)</p>
              </div>

              <form onSubmit={handleQuickJoin} className="space-y-3.5">
                <div className="relative">
                  <input
                    type="text"
                    value={quickCode}
                    onChange={e => setQuickCode(e.target.value.toUpperCase())}
                    placeholder="MÃ HỌC SINH (VD: HS01)"
                    maxLength={15}
                    className="w-full py-3.5 px-4 bg-slate-950/90 border-2 border-purple-400/40 focus:border-pink-400 rounded-2xl font-mono font-black text-center text-xl text-sky-200 tracking-widest placeholder:tracking-normal placeholder:font-normal placeholder:text-xs placeholder-slate-500 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] focus:shadow-[0_0_25px_rgba(244,114,182,0.35)] outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-pink-400 via-purple-400 to-sky-400 hover:from-pink-300 hover:via-purple-300 hover:to-sky-300 text-slate-950 font-black text-sm sm:text-base rounded-2xl transition-all shadow-[0_0_30px_rgba(192,132,252,0.4)] active:scale-95 flex items-center justify-center gap-2 cursor-pointer btn-modern-shine btn-modern-glow"
                >
                  <span>VÀO PHÒNG CHỜ THI ĐẤU</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </form>

              <Link
                to="/player"
                className="text-center text-xs text-sky-300 hover:text-pink-300 transition-colors underline underline-offset-4 font-semibold"
              >
                Chuyển thẳng sang trang Học sinh vào phòng chờ ➔
              </Link>

              <Link
                to="/judge"
                className="text-center text-xs text-amber-300 hover:text-yellow-200 transition-colors font-bold flex items-center justify-center gap-1.5 pt-1 border-t border-white/10"
              >
                <span>⚖️ Cổng Giám Khảo / GV chấm thi (Mã: 123) ➔</span>
              </Link>
            </div>

          </div>

        </div>
      </motion.div>

      {/* FOOTER BAR: GV ĐĂNG NHẬP, ADMIN & GIÁM KHẢO */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
        className="mt-6 sm:mt-10 relative z-10 flex flex-col items-center gap-2.5"
      >
        <div className="inline-flex flex-wrap items-center justify-center p-1.5 sm:p-2 bg-slate-900/90 hover:bg-slate-900 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] gap-2 sm:gap-2.5">
          
          {/* Nút Giáo viên đăng nhập */}
          <button
            type="button"
            onClick={handleTeacherClick}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/35 hover:to-purple-500/35 border border-indigo-300/40 text-indigo-200 hover:text-white text-xs sm:text-sm font-bold transition-all cursor-pointer group shadow-sm btn-modern-shine btn-modern-glow"
            title="Dành cho Giáo viên: Nhập mật khẩu để mở phòng thi đấu và điều khiển nhịp điệu"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-400/25 text-indigo-200 flex items-center justify-center group-hover:scale-115 transition-transform">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span>Giáo Viên (Mở phòng thi)</span>
            <KeyRound className="w-3.5 h-3.5 text-indigo-300/70 group-hover:text-indigo-200" />
          </button>

          {/* Dấu phân cách */}
          <span className="w-px h-5 bg-white/15 hidden sm:inline" />

          {/* Nút Giáo viên / Ban Giám Khảo (Mã 123) */}
          <Link
            to="/judge"
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/35 hover:to-yellow-500/35 border border-amber-300/40 text-amber-200 hover:text-white text-xs sm:text-sm font-bold transition-all group shadow-sm btn-modern-shine btn-modern-glow"
            title="Dành cho Giáo viên / Giám khảo (Mã 123): Chấm điểm 6 nhóm thi Vòng 2"
          >
            <div className="w-6 h-6 rounded-lg bg-amber-400/25 text-amber-200 flex items-center justify-center group-hover:scale-115 transition-transform text-xs">
              ⚖️
            </div>
            <span>Giám Khảo (Mã 123)</span>
          </Link>

          {/* Dấu phân cách */}
          <span className="w-px h-5 bg-white/15 hidden sm:inline" />

          {/* Nút Quản trị viên (Admin) */}
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/35 hover:to-emerald-500/35 border border-teal-300/40 text-teal-200 hover:text-white text-xs sm:text-sm font-bold transition-all group shadow-sm btn-modern-shine btn-modern-glow"
            title="Dành cho Quản trị viên: Quản lý ngân hàng đề thi KHTN"
          >
            <div className="w-6 h-6 rounded-lg bg-teal-400/25 text-teal-200 flex items-center justify-center group-hover:scale-115 transition-transform">
              <Lock className="w-4 h-4" />
            </div>
            <span>Quản trị viên</span>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-300/70 group-hover:text-teal-200" />
          </Link>

          {/* Dấu phân cách */}
          <span className="w-px h-5 bg-white/15 hidden sm:inline" />

          {/* Nút Sơ đồ Xếp chỗ 30 HS */}
          <button
            type="button"
            onClick={() => setShowSeatingModal(true)}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/35 hover:to-pink-500/35 border border-purple-300/40 text-purple-200 hover:text-white text-xs sm:text-sm font-bold transition-all group shadow-sm btn-modern-shine btn-modern-glow cursor-pointer"
            title="Mở sơ đồ xếp chỗ phòng thi: 6 dãy, mỗi dãy 5 HS (Tổng 30 HS)"
          >
            <div className="w-6 h-6 rounded-lg bg-purple-400/25 text-purple-200 flex items-center justify-center group-hover:scale-115 transition-transform text-xs">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span>Xếp chỗ HS (30)</span>
          </button>

          {/* Dấu phân cách */}
          <span className="w-px h-5 bg-white/15 hidden sm:inline" />

          {/* Nút Đồng hồ nguyên tử 5 phút */}
          <button
            type="button"
            onClick={() => setShowAtomicClock(true)}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-teal-500/20 hover:from-cyan-500/35 hover:to-teal-500/35 border border-cyan-300/40 text-cyan-200 hover:text-white text-xs sm:text-sm font-bold transition-all group shadow-sm btn-modern-shine btn-modern-glow cursor-pointer"
            title="Mở đồng hồ đếm ngược hành tinh nguyên tử (Mặc định 5 phút)"
          >
            <div className="w-6 h-6 rounded-lg bg-cyan-400/25 text-cyan-200 flex items-center justify-center group-hover:scale-115 transition-transform text-xs">
              <Atom className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <span>Mở đồng hồ (5p)</span>
          </button>

          {/* Dấu phân cách */}
          <span className="w-px h-5 bg-white/15 hidden sm:inline" />

          {/* Nút Âm thanh mở chương trình */}
          <button
            type="button"
            onClick={() => setShowOpeningAudioModal(true)}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 hover:from-pink-500/35 hover:to-rose-500/35 border border-pink-300/40 text-pink-200 hover:text-white text-xs sm:text-sm font-bold transition-all group shadow-sm btn-modern-shine btn-modern-glow cursor-pointer"
            title="Đưa âm thanh mở chương trình vào trước, ghi nhận vào dữ liệu để phát khi trình chiếu"
          >
            <div className="w-6 h-6 rounded-lg bg-pink-400/25 text-pink-200 flex items-center justify-center group-hover:scale-115 transition-transform text-xs">
              <Volume2 className="w-3.5 h-3.5" />
            </div>
            <span>Âm thanh mở (Audio)</span>
          </button>

          {openingAudioUrl.trim() && (
            <button
              type="button"
              onClick={togglePlayOpeningAudio}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isPlayingOpeningAudio
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-pink-600/30 border border-pink-400/40 text-pink-200 hover:bg-pink-600/50'
              }`}
              title={isPlayingOpeningAudio ? 'Dừng phát âm thanh mở' : 'Phát âm thanh mở chương trình'}
            >
              <span>{isPlayingOpeningAudio ? '⏹ Dừng' : '▶ Phát Audio Mở'}</span>
            </button>
          )}

        </div>
        <p className="text-xs text-slate-400">
          Hệ thống Đấu trường Khoa Học Tự Nhiên • Dành cho Giáo viên, Học sinh & Ban Giám Khảo
        </p>
      </motion.div>

      {/* MODAL CÀI ĐẶT ÂM THANH MỞ CHƯƠNG TRÌNH */}
      {showOpeningAudioModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-pink-400/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-pink-300">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Âm thanh Mở Chương Trình</h3>
                  <p className="text-xs text-slate-300">Đưa vào trước, ghi nhận vào dữ liệu. Phát dễ dàng khi mở/trình chiếu.</p>
                </div>
              </div>
              <button
                onClick={() => setShowOpeningAudioModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Tải file Audio mở chương trình (MP3, WAV,...)
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    alert('Kích thước file audio quá lớn (tối đa 10MB).');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (uploadEvent) => {
                    const base64Result = uploadEvent.target?.result as string;
                    if (base64Result) {
                      setOpeningAudioUrl(base64Result);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
                className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-pink-500/20 file:text-pink-200 hover:file:bg-pink-500/30 cursor-pointer"
              />
              {openingAudioUrl && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-emerald-400 font-semibold">✓ Đã tải file audio thành công</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOpeningAudioUrl('');
                      setOpeningAudioUrlInDb('');
                    }}
                    className="text-xs text-rose-400 underline cursor-pointer"
                  >
                    Xóa file
                  </button>
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                Chọn file âm thanh (.mp3, .wav,...) từ máy tính để lưu vào hệ thống và phát khi trình chiếu.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowOpeningAudioModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSaveOpeningAudio}
                className="px-5 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-slate-950 rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                Lưu vào dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SƠ ĐỒ XẾP CHỖ 30 THÍ SINH (5 DÃY X 6 HS) */}
      <ExamSeatingModal
        isOpen={showSeatingModal}
        onClose={() => setShowSeatingModal(false)}
        quizTitle="Vòng 1 - Đấu trường Số"
      />

      {/* ĐỒNG HỒ NGUYÊN TỬ ĐẾM NGƯỢC (MẶC ĐỊNH 5 PHÚT) */}
      <AtomicCountdownClock
        isOpen={showAtomicClock}
        onClose={() => setShowAtomicClock(false)}
        defaultMinutes={5}
      />

      {/* MODAL ĐĂNG NHẬP GIÁO VIÊN */}
      <TeacherLoginModal
        isOpen={showTeacherModal}
        onClose={() => setShowTeacherModal(false)}
        onSuccess={() => {
          setShowTeacherModal(false);
          navigate('/host');
        }}
      />

    </div>
  );
}
