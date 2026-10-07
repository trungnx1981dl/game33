import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Sparkles, 
  RotateCcw, 
  X, 
  Shuffle, 
  Tv, 
  FileSpreadsheet,
  Atom,
  Zap,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentRosterItem, SeatingPlan, SeatingAssignment } from '../types';
import { loadRoster, ensure30Students } from '../utils/studentRoster';
import { 
  createEmptySeatingPlan, 
  generateSmartSeatingPlan, 
  exportSeatingPlanToExcel, 
  saveSeatingPlanToSession,
  formatAbbreviatedName,
  EXAM_HALL_COLS,
  EXAM_HALL_ROWS,
  TOTAL_EXAM_SEATS
} from '../utils/seatingArrangement';
import { gameAudio } from '../utils/gameAudio';
import ConfettiEffect from './ConfettiEffect';

interface ExamSeatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  quizTitle?: string;
  initialPlan?: SeatingPlan | null;
  onSavePlan?: (plan: SeatingPlan) => void;
}

// Color theme for classes with ultra-high contrast for classroom projectors
const CLASS_THEMES: Record<string, { 
  border: string; 
  badgeBg: string; 
  badgeText: string; 
  nameColor: string; 
  glow: string;
  dotColor: string;
}> = {
  '6A1': { 
    border: 'border-cyan-400', 
    badgeBg: 'bg-cyan-500/25 border-cyan-400/60', 
    badgeText: 'text-cyan-300', 
    nameColor: 'text-white', 
    glow: 'shadow-[0_0_22px_rgba(56,189,248,0.4)]',
    dotColor: '#38BDF8'
  },
  '6A2': { 
    border: 'border-purple-400', 
    badgeBg: 'bg-purple-500/25 border-purple-400/60', 
    badgeText: 'text-purple-300', 
    nameColor: 'text-white', 
    glow: 'shadow-[0_0_22px_rgba(192,132,252,0.4)]',
    dotColor: '#C084FC'
  },
  '6A3': { 
    border: 'border-emerald-400', 
    badgeBg: 'bg-emerald-500/25 border-emerald-400/60', 
    badgeText: 'text-emerald-300', 
    nameColor: 'text-white', 
    glow: 'shadow-[0_0_22px_rgba(52,211,153,0.4)]',
    dotColor: '#34D399'
  },
  '6A4': { 
    border: 'border-amber-400', 
    badgeBg: 'bg-amber-500/25 border-amber-400/60', 
    badgeText: 'text-amber-300', 
    nameColor: 'text-white', 
    glow: 'shadow-[0_0_22px_rgba(251,191,36,0.4)]',
    dotColor: '#FBBF24'
  },
  '6A5': { 
    border: 'border-pink-400', 
    badgeBg: 'bg-pink-500/25 border-pink-400/60', 
    badgeText: 'text-pink-300', 
    nameColor: 'text-white', 
    glow: 'shadow-[0_0_22px_rgba(244,114,182,0.4)]',
    dotColor: '#F472B6'
  },
  'DEFAULT': { 
    border: 'border-indigo-400', 
    badgeBg: 'bg-indigo-500/25 border-indigo-400/60', 
    badgeText: 'text-indigo-300', 
    nameColor: 'text-white', 
    glow: 'shadow-[0_0_22px_rgba(99,102,241,0.4)]',
    dotColor: '#818CF8'
  }
};

type AnimationStage = 'IDLE' | 'STAGE_1_NUCLEUS' | 'STAGE_2_ELECTRONS' | 'STAGE_3_LOCKED';

// Seeded pseudo-random offsets for each seat so chaotic trajectory is lively and varied
const SEAT_CHAOS_TRAJECTORIES = Array.from({ length: 30 }, (_, i) => {
  const angle = (i * 137.5) * (Math.PI / 180); // golden angle distribution
  const dist = 18 + (i % 6) * 14;
  const dx1 = Math.round(Math.cos(angle) * dist);
  const dy1 = Math.round(Math.sin(angle) * dist);
  const dx2 = Math.round(Math.sin(angle * 1.5) * (dist * 1.4));
  const dy2 = Math.round(Math.cos(angle * 1.5) * (dist * 1.4));
  const rot1 = Math.round(((i % 5) - 2) * 12);
  const rot2 = Math.round(((i % 7) - 3) * 15);
  return {
    x: [0, dx1, -dx2, Math.round(dx1 * 0.5), 0],
    y: [0, dy1, -dy2, Math.round(-dy1 * 0.5), 0],
    rotate: [0, rot1, -rot2, Math.round(rot1 * 0.6), 0],
    scale: [1, 1.15, 0.88, 1.08, 1]
  };
});

export default function ExamSeatingModal({
  isOpen,
  onClose,
  sessionId,
  quizTitle,
  initialPlan,
  onSavePlan
}: ExamSeatingModalProps) {
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [seatingPlan, setSeatingPlan] = useState<SeatingPlan>(() => initialPlan || createEmptySeatingPlan(sessionId));
  const [animStage, setAnimStage] = useState<AnimationStage>('IDLE');
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [lockedSeatIndices, setLockedSeatIndices] = useState<Set<number>>(new Set());
  const [swirlingNames, setSwirlingNames] = useState<Record<number, string>>({});

  const animTimerRef = useRef<NodeJS.Timeout | null>(null);
  const vortexIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and ensure all 30 students are loaded and displayed when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRoster().then(items => {
        const full30 = ensure30Students(items);
        setRoster(full30);

        // If an initialPlan with students exists, load it; otherwise generate initial populated plan so all 30 students show immediately
        if (initialPlan && initialPlan.seats && initialPlan.seats.some(s => s.student)) {
          setSeatingPlan(initialPlan);
          const allIndices = new Set<number>();
          initialPlan.seats.forEach((_, idx) => allIndices.add(idx));
          setLockedSeatIndices(allIndices);
        } else {
          // Immediately populate all 30 students so they are fully displayed upon opening
          const readyPlan = generateSmartSeatingPlan(full30, sessionId);
          setSeatingPlan(readyPlan);
          const allIndices = new Set<number>();
          readyPlan.seats.forEach((_, idx) => allIndices.add(idx));
          setLockedSeatIndices(allIndices);
        }
      });
      setShowConfetti(false);
      setAnimStage('IDLE');
    }
  }, [isOpen, initialPlan, sessionId]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      if (vortexIntervalRef.current) clearInterval(vortexIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // 3-STAGE QUANTUM ATOMIC SEATING ARRANGEMENT ANIMATION
  // -------------------------------------------------------------
  const handleStartAtomicSeating = () => {
    if (animStage !== 'IDLE') return;

    gameAudio.playClick();
    gameAudio.playSciFiWarp();
    setShowConfetti(false);
    setLockedSeatIndices(new Set());

    const fullStudents = ensure30Students(roster);
    // Pre-calculate target plan to be locked into
    const targetPlan = generateSmartSeatingPlan(fullStudents, sessionId);

    // ==========================================
    // GIAI ĐOẠN 1: MỞ MÀN (0s - 2.5s)
    // Hạt nhân nguyên tử 3D, proton, neutron, quỹ đạo cyan/tím
    // ==========================================
    setAnimStage('STAGE_1_NUCLEUS');
    setCountdownSeconds(10);
    gameAudio.playDrumBeat(1.2);

    // Vortex name animation loop
    vortexIntervalRef.current = setInterval(() => {
      const swirl: Record<number, string> = {};
      for (let i = 0; i < TOTAL_EXAM_SEATS; i++) {
        const randStd = fullStudents[Math.floor(Math.random() * fullStudents.length)];
        const { fullAbbreviated } = formatAbbreviatedName(randStd.name);
        swirl[i] = fullAbbreviated;
      }
      setSwirlingNames(swirl);
    }, 110);

    // Countdown timer across the 10 seconds
    let currentCount = 10;
    animTimerRef.current = setInterval(() => {
      currentCount -= 1;
      setCountdownSeconds(currentCount);

      if (currentCount === 7) {
        // ==========================================
        // GIAI ĐOẠN 2: ELECTRON XUẤT HIỆN (2.5s - 6s)
        // Electron phát sáng bay theo đường cong, để lại vệt sáng plasma
        // ==========================================
        setAnimStage('STAGE_2_ELECTRONS');
        gameAudio.playPlasmaSwoosh();
        gameAudio.playSciFiWarp();
      } else if (currentCount === 4) {
        // ==========================================
        // GIAI ĐOẠN 3: XẾP ĐÚNG VỊ TRÍ & KHÓA QUỸ ĐẠO (6s - 10s)
        // Vòng tròn năng lượng lan tỏa, tăng sáng 0.5s, tiếng "ting" điện tử
        // ==========================================
        setAnimStage('STAGE_3_LOCKED');
        // Progressively lock seats with electronic ting
        let seatCounter = 0;
        const lockInterval = setInterval(() => {
          if (seatCounter < TOTAL_EXAM_SEATS) {
            setLockedSeatIndices(prev => new Set([...prev, seatCounter]));
            const pitchFactor = 0.8 + (seatCounter % 6) * 0.15;
            gameAudio.playElectronicTing(pitchFactor);
            seatCounter++;
          } else {
            clearInterval(lockInterval);
          }
        }, 80);
      } else if (currentCount > 0) {
        // Rhythm heartbeat drum
        const intensity = 1.0 + (10 - currentCount) * 0.08;
        gameAudio.playDrumBeat(intensity);
      } else {
        // Complete!
        if (animTimerRef.current) clearInterval(animTimerRef.current);
        if (vortexIntervalRef.current) clearInterval(vortexIntervalRef.current);

        // Lock all seats into final plan
        setSeatingPlan(targetPlan);
        const allIndices = new Set<number>();
        targetPlan.seats.forEach((_, idx) => allIndices.add(idx));
        setLockedSeatIndices(allIndices);

        setAnimStage('IDLE');
        setShowConfetti(true);
        gameAudio.playFanfareFinish();

        if (sessionId) {
          saveSeatingPlanToSession(sessionId, targetPlan);
        }
        if (onSavePlan) {
          onSavePlan(targetPlan);
        }
      }
    }, 1000);
  };

  // Reset back to empty seats
  const handleResetToEmpty = () => {
    gameAudio.playClick();
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    if (vortexIntervalRef.current) clearInterval(vortexIntervalRef.current);
    setAnimStage('IDLE');
    setShowConfetti(false);
    setLockedSeatIndices(new Set());
    const empty = createEmptySeatingPlan(sessionId);
    setSeatingPlan(empty);
    if (sessionId) {
      saveSeatingPlanToSession(sessionId, empty);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    gameAudio.playClick();
    exportSeatingPlanToExcel(seatingPlan, quizTitle);
  };

  const getTheme = (className?: string) => {
    if (!className) return CLASS_THEMES['DEFAULT'];
    const norm = className.trim().toUpperCase().replace(/\s+/g, '');
    return CLASS_THEMES[norm] || CLASS_THEMES['DEFAULT'];
  };

  return (
    <div className="fixed inset-0 z-[998] flex items-center justify-center p-1 sm:p-3 bg-slate-950/95 backdrop-blur-3xl overflow-hidden animate-fade-in select-none">
      {showConfetti && <ConfettiEffect />}

      {/* ============================================================== */}
      {/* 3-STAGE QUANTUM ATOMIC TRANSFORMATION OVERLAY (10S) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {animStage !== 'IDLE' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] pointer-events-none flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-md overflow-hidden"
          >
            {/* GIAI ĐOẠN 1: HẠT NHÂN NGUYÊN TỬ 3D & CÁC QUỸ ĐẠO PHÁT SÁNG */}
            {animStage === 'STAGE_1_NUCLEUS' && (
              <div className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center">
                {/* Orbital Ring 1: Cyan Orbit */}
                <div 
                  className="absolute inset-2 rounded-full border-2 border-cyan-400/60 shadow-[0_0_30px_#38bdf8]"
                  style={{ animation: 'spin 4s linear infinite' }}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-cyan-300 shadow-[0_0_20px_#38bdf8] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                  </div>
                </div>

                {/* Orbital Ring 2: Purple Orbit at 60 deg */}
                <div 
                  className="absolute inset-2 rounded-[48%] border-2 border-purple-400/60 shadow-[0_0_30px_#c084fc] transform rotate-[60deg]"
                  style={{ animation: 'spin 5s linear infinite reverse' }}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-purple-300 shadow-[0_0_20px_#c084fc] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>

                {/* Orbital Ring 3: Pink Orbit at 120 deg */}
                <div 
                  className="absolute inset-2 rounded-[48%] border-2 border-pink-400/60 shadow-[0_0_30px_#f472b6] transform rotate-[120deg]"
                  style={{ animation: 'spin 4.5s linear infinite' }}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-pink-300 shadow-[0_0_20px_#f472b6]" />
                </div>

                {/* 3D NUCLEUS CORE (Proton: Rose / Neutron: Cyan) */}
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-950 border-2 border-cyan-400/80 shadow-[0_0_50px_rgba(56,189,248,0.8)] flex items-center justify-center relative animate-pulse">
                  <div className="absolute w-8 h-8 rounded-full bg-rose-500 shadow-[0_0_15px_#f43f5e] -translate-x-3 -translate-y-2" />
                  <div className="absolute w-7 h-7 rounded-full bg-cyan-400 shadow-[0_0_15px_#38bdf8] translate-x-3 -translate-y-2" />
                  <div className="absolute w-8 h-8 rounded-full bg-amber-400 shadow-[0_0_15px_#fbbf24] -translate-x-2 translate-y-3" />
                  <div className="absolute w-7 h-7 rounded-full bg-purple-400 shadow-[0_0_15px_#c084fc] translate-x-3 translate-y-2" />
                  <span className="relative z-10 text-xs font-black text-white tracking-widest uppercase">HẠT NHÂN</span>
                </div>
              </div>
            )}

            {/* GIAI ĐOẠN 2 & 3: VÒNG XOÁY NĂNG LƯỢNG PLASMA & COUNTDOWN */}
            <motion.div
              key={`cnt-${countdownSeconds}`}
              initial={{ scale: 1.4, opacity: 0.9 }}
              animate={{ scale: [1.3, 0.96, 1], opacity: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="text-7xl sm:text-9xl md:text-[11rem] font-black font-mono tracking-tighter drop-shadow-[0_0_60px_rgba(56,189,248,0.95)] text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-rose-400 to-cyan-300 select-none"
            >
              {countdownSeconds}
            </motion.div>

            {/* Banner status */}
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              className="mt-4 px-6 py-2 rounded-full bg-slate-900/90 border-2 border-cyan-400/80 shadow-[0_0_35px_rgba(56,189,248,0.7)] text-cyan-300 font-black text-xs sm:text-base uppercase tracking-widest flex items-center gap-2.5"
            >
              <Atom className="w-5 h-5 text-cyan-300 animate-spin" style={{ animationDuration: '3s' }} />
              <span>
                {animStage === 'STAGE_1_NUCLEUS' && '1. KÍCH HOẠT QUỸ ĐẠO NGUYÊN TỬ VŨ TRỤ...'}
                {animStage === 'STAGE_2_ELECTRONS' && '2. CÁC ELECTRON HỌC SINH ĐANG TIẾN VÀO VỊ TRÍ...'}
                {animStage === 'STAGE_3_LOCKED' && '3. ĐANG KHÓA QUỸ ĐẠO • KHÔNG CÙNG LỚP CẠNH NHAU!'}
              </span>
              <Sparkles className="w-5 h-5 text-amber-300" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MAIN MODAL CONTAINER */}
      {/* ============================================================== */}
      <div className="relative w-full max-w-[98vw] h-[98vh] flex flex-col bg-slate-950 border-2 border-indigo-500/50 rounded-3xl shadow-[0_0_80px_rgba(99,102,241,0.3)] overflow-hidden">
        
        {/* COMPACT TOP BAR */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 border-b border-white/10 flex items-center justify-between gap-3 bg-slate-900/80 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-400/50 flex items-center justify-center text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.4)]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>SƠ ĐỒ XẾP CHỖ 30 THÍ SINH</span>
                <span className="text-[11px] sm:text-xs font-extrabold text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-400/30">
                  6 Dãy • 5 Bàn • 30 Ghế
                </span>
              </h2>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={animStage !== 'IDLE'}
              onClick={handleStartAtomicSeating}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl transition-all border active:scale-95 cursor-pointer ${
                animStage !== 'IDLE'
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:brightness-110 text-slate-950 border-cyan-300 shadow-[0_0_25px_rgba(56,189,248,0.5)]'
              }`}
            >
              <Shuffle className={`w-4 h-4 ${animStage !== 'IDLE' ? 'animate-spin' : ''}`} />
              <span>{animStage !== 'IDLE' ? 'ĐANG XẾP CHỖ (10S)...' : 'BẮT ĐẦU XẾP CHỖ'}</span>
            </button>

            <button
              type="button"
              disabled={animStage !== 'IDLE'}
              onClick={handleResetToEmpty}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Đặt lại về ghế trống"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Ghế trống</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Xuất Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/40 transition-all cursor-pointer"
              title="Đóng sơ đồ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* ONLY THE STAGE BANNER AT TOP: "SÂN KHẤU THI ĐẤU TRUNG TÂM" */}
        {/* ============================================================== */}
        <div className="w-full flex items-center justify-center pt-2 pb-1.5 flex-shrink-0">
          <div className="px-8 py-1.5 rounded-full bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-indigo-900/90 border-2 border-indigo-400/60 shadow-[0_0_35px_rgba(99,102,241,0.5)] flex items-center gap-2.5 text-xs sm:text-sm font-black text-cyan-200 uppercase tracking-widest">
            <Tv className="w-4 h-4 text-cyan-300 animate-pulse" />
            <span>🎪 SÂN KHẤU THI ĐẤU TRUNG TÂM</span>
            <Tv className="w-4 h-4 text-cyan-300 animate-pulse" />
          </div>
        </div>

        {/* ============================================================== */}
        {/* 6 DÃY x 5 BÀN (30 THÍ SINH) - TOÀN BỘ HIỂN THỊ ĐỦ TRÊN MÀN HÌNH */}
        {/* ============================================================== */}
        <div className="flex-1 px-2 sm:px-4 pb-2 pt-1 flex flex-col justify-between overflow-hidden">
          
          {/* Header Row: 6 Dãy (Dãy 1 đến Dãy 6) */}
          <div className="grid grid-cols-6 gap-2 sm:gap-3 mb-1.5 text-center flex-shrink-0">
            {[1, 2, 3, 4, 5, 6].map(colNum => (
              <div 
                key={`day-${colNum}`}
                className="py-1 px-1 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-cyan-300 font-black text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-1"
              >
                <span>DÃY {colNum}</span>
              </div>
            ))}
          </div>

          {/* 5 Rows (Bàn 1 đến Bàn 5): 6 Columns each = 30 Seats */}
          <div className="flex-1 grid grid-rows-5 gap-2 sm:gap-2.5">
            {[1, 2, 3, 4, 5].map(rowNum => (
              <div key={`row-${rowNum}`} className="grid grid-cols-6 gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5, 6].map(colNum => {
                  const seat = seatingPlan.seats.find(s => s.row === rowNum && s.col === colNum);
                  const seatIndex = seat ? seat.seatIndex : (rowNum - 1) * EXAM_HALL_COLS + (colNum - 1);
                  const isLocked = lockedSeatIndices.has(seatIndex);
                  const isSwirling = animStage !== 'IDLE' && !isLocked;
                  const currentStudent = seat?.student;
                  const theme = getTheme(currentStudent?.className);

                  const { initials, mainName } = formatAbbreviatedName(currentStudent?.name);
                  const swirlingText = swirlingNames[seatIndex];
                  const chaos = SEAT_CHAOS_TRAJECTORIES[seatIndex % SEAT_CHAOS_TRAJECTORIES.length];

                  // Animation configuration:
                  // When swirling/stage 1 & 2: Chaotic spatial orbit trajectory in 2D/3D space with offsets, rotation, and scaling
                  // When locking (Stage 3): Elastic snap to [0,0] with glowing energy pulse
                  // When idle/locked: Stable seated card position
                  let cardAnimate: any = { x: 0, y: 0, scale: 1, rotate: 0, filter: 'brightness(1)' };
                  let cardTransition: any = { duration: 0.4 };

                  if (isSwirling) {
                    cardAnimate = {
                      x: chaos.x,
                      y: chaos.y,
                      rotate: chaos.rotate,
                      scale: chaos.scale,
                      filter: ['brightness(1)', 'brightness(1.35)', 'brightness(1)']
                    };
                    cardTransition = {
                      duration: 2.2,
                      repeat: Infinity,
                      repeatType: "mirror",
                      ease: "easeInOut"
                    };
                  } else if (isLocked && animStage === 'STAGE_3_LOCKED') {
                    cardAnimate = {
                      x: [chaos.x[1] || 15, 0],
                      y: [chaos.y[1] || 15, 0],
                      scale: [1.25, 0.95, 1],
                      rotate: [chaos.rotate[1] || 8, 0],
                      filter: ['brightness(1.9)', 'brightness(1.2)', 'brightness(1)']
                    };
                    cardTransition = {
                      duration: 0.5,
                      ease: [0.175, 0.885, 0.32, 1.275] // custom spring-like cubic bezier supporting multi-keyframes
                    };
                  }

                  return (
                    <motion.div
                      key={`seat-${rowNum}-${colNum}`}
                      animate={cardAnimate}
                      transition={cardTransition}
                      className={`relative rounded-2xl p-1.5 sm:p-2.5 transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                        currentStudent && isLocked
                          ? `bg-slate-950/95 border-2 ${theme.border} ${theme.glow}`
                          : isSwirling
                          ? 'bg-slate-900 border-2 border-cyan-400 shadow-[0_0_25px_rgba(56,189,248,0.6)] z-20'
                          : 'bg-slate-950/60 border-2 border-dashed border-slate-800'
                      }`}
                    >
                      {/* VÒNG XOÁY NỀN & PLASMA SHIMMER WHEN SHUFFLING */}
                      {isSwirling && (
                        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/25 via-purple-500/25 to-pink-500/25 animate-pulse pointer-events-none" />
                      )}

                      {/* TOP BAR IN SEAT CARD: MÃ HS Ở GÓC TRÊN THAY VÌ D1-B1 */}
                      <div className="flex items-center justify-between gap-1 mb-1 relative z-10 flex-shrink-0">
                        {currentStudent ? (
                          <>
                            {/* Mã HS ở góc nhỏ phía trên */}
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-black tracking-wide border ${theme.badgeBg} ${theme.badgeText}`}>
                              {currentStudent.studentCode}
                            </span>
                            {/* Lớp */}
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-black border ${theme.badgeBg} ${theme.badgeText}`}>
                              {currentStudent.className}
                            </span>
                          </>
                        ) : isSwirling ? (
                          <>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-cyan-500/30 text-cyan-300 border border-cyan-400/50 animate-pulse">
                              HS--
                            </span>
                            <span className="text-[10px] font-mono text-cyan-400 animate-spin">⚡</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold text-slate-600">Trống</span>
                            <span className="text-[10px] font-mono text-slate-600">#{seatIndex + 1}</span>
                          </>
                        )}
                      </div>

                      {/* CENTER: TÊN HỌC SINH TO HƠN 20%, MÀU TRẮNG NỔI BẬT */}
                      <div className="flex-1 flex flex-col justify-center items-center text-center relative z-10 my-0.5">
                        {currentStudent && isLocked ? (
                          <div className="w-full px-0.5">
                            {/* Viết tắt Họ - tên đệm */}
                            {initials && (
                              <div className="text-[11px] sm:text-xs font-black text-amber-200/90 uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                                {initials}
                              </div>
                            )}
                            {/* Tên chính hiển thị TO HƠN 20%, MÀU TRẮNG NGUYÊN BẢN NỔI BẬT */}
                            <div className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-none drop-shadow-[0_3px_15px_rgba(0,0,0,0.95)] drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]">
                              {mainName}
                            </div>
                          </div>
                        ) : isSwirling && swirlingText ? (
                          <div className="text-sm sm:text-base font-black text-white animate-pulse truncate px-1 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">
                            {swirlingText}
                          </div>
                        ) : (
                          <div className="text-[10px] sm:text-xs text-slate-600 font-bold">
                            Chưa xếp
                          </div>
                        )}
                      </div>

                      {/* BOTTOM SUBTLE FOOTER: BÀN & DÃY HOẶC TRẠNG THÁI */}
                      <div className="flex items-center justify-between text-[9px] font-semibold text-slate-500 relative z-10 pt-0.5 border-t border-white/5 flex-shrink-0">
                        <span>Bàn {rowNum}</span>
                        {currentStudent && isLocked && (
                          <span className="text-emerald-400 font-black flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Chuẩn
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
