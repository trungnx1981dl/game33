import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX, 
  Plus, 
  Minus,
  Sparkles,
  Atom,
  Flame,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { gameAudio } from '../utils/gameAudio';

interface AtomicCountdownClockProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMinutes?: number;
}

export default function AtomicCountdownClock({
  isOpen,
  onClose,
  defaultMinutes = 5
}: AtomicCountdownClockProps) {
  const [totalSeconds, setTotalSeconds] = useState<number>(defaultMinutes * 60);
  const [initialSeconds, setInitialSeconds] = useState<number>(defaultMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [hasFinished, setHasFinished] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync default minutes when opening
  useEffect(() => {
    if (isOpen) {
      setTotalSeconds(defaultMinutes * 60);
      setInitialSeconds(defaultMinutes * 60);
      setIsRunning(false);
      setHasFinished(false);
    }
  }, [isOpen, defaultMinutes]);

  // Main countdown ticker
  useEffect(() => {
    if (isRunning && totalSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTotalSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            setHasFinished(true);
            if (isAudioEnabled) {
              gameAudio.playVictory();
            }
            return 0;
          }

          // Sound effects during ticking
          if (isAudioEnabled) {
            if (prev <= 11) {
              // Last 10s urgent tick & heartbeat drum
              gameAudio.playTick(true);
              gameAudio.playDrumBeat(1.2);
            } else if (prev % 5 === 0 || prev <= 30) {
              gameAudio.playTick(false);
            }
          }

          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, totalSeconds, isAudioEnabled]);

  if (!isOpen) return null;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Progress percentage (1 -> 0)
  const progress = initialSeconds > 0 ? totalSeconds / initialSeconds : 0;
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference * (1 - progress);

  const toggleRun = () => {
    gameAudio.playClick();
    if (!isRunning && hasFinished) {
      // restart
      setTotalSeconds(initialSeconds);
      setHasFinished(false);
    }
    setIsRunning(!isRunning);
  };

  const handleReset = (newMinutes = 5) => {
    gameAudio.playClick();
    setIsRunning(false);
    setHasFinished(false);
    setTotalSeconds(newMinutes * 60);
    setInitialSeconds(newMinutes * 60);
  };

  const adjustSeconds = (deltaSec: number) => {
    gameAudio.playClick();
    setTotalSeconds(prev => {
      const next = Math.max(10, prev + deltaSec);
      if (next > initialSeconds) setInitialSeconds(next);
      return next;
    });
  };

  // State-based glowing colors based on remaining percentage
  const getPhaseTheme = () => {
    if (totalSeconds <= 10) {
      return {
        glow: 'shadow-[0_0_60px_rgba(244,63,94,0.6)]',
        border: 'border-rose-500',
        gradient: 'from-rose-500 via-pink-500 to-amber-400',
        stroke: '#f43f5e',
        tagText: 'text-rose-400 animate-pulse',
        statusLabel: '⚠️ 10 GIÂY CUỐI CÙNG!'
      };
    }
    if (totalSeconds <= 60) {
      return {
        glow: 'shadow-[0_0_50px_rgba(251,191,36,0.5)]',
        border: 'border-amber-400',
        gradient: 'from-amber-400 via-orange-400 to-pink-500',
        stroke: '#fbbf24',
        tagText: 'text-amber-400',
        statusLabel: '⚡ CHÚ Ý THỜI GIAN!'
      };
    }
    return {
      glow: 'shadow-[0_0_70px_rgba(56,189,248,0.4)]',
      border: 'border-cyan-400/60',
      gradient: 'from-cyan-400 via-indigo-400 to-fuchsia-400',
      stroke: 'url(#atomicGradient)',
      tagText: 'text-cyan-300',
      statusLabel: '🌌 ĐỒNG HỒ NGUYÊN TỬ VŨ TRỤ'
    };
  };

  const theme = getPhaseTheme();

  // Minimized PiP floating widget
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[999] animate-float">
        <div className={`p-4 rounded-3xl bg-slate-950/95 backdrop-blur-2xl border-2 ${theme.border} ${theme.glow} flex items-center gap-3.5 shadow-2xl`}>
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center relative">
            <Atom className={`w-6 h-6 text-cyan-400 ${isRunning ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-black tracking-widest text-cyan-300">Đồng hồ đếm ngược</div>
            <div className={`text-2xl font-black font-mono tracking-wider ${totalSeconds <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
              {formattedTime}
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={toggleRun}
              className={`p-2 rounded-xl font-bold transition-all ${
                isRunning ? 'bg-amber-500/30 hover:bg-amber-500/40 text-amber-300' : 'bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-300'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300"
              title="Phóng to"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-fade-in overflow-y-auto">
      {/* Background stardust particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-[20%] w-72 h-72 bg-cyan-500/15 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[20%] w-80 h-80 bg-fuchsia-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[140px]" />
      </div>

      <div className={`relative w-full max-w-2xl bg-gradient-to-b from-slate-900/95 via-[#0B0F24]/95 to-slate-950/95 border-2 ${theme.border} ${theme.glow} rounded-[2.5rem] p-6 sm:p-10 flex flex-col items-center text-center shadow-2xl backdrop-blur-3xl overflow-hidden`}>
        
        {/* Top bar controls */}
        <div className="w-full flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-cyan-300 flex items-center gap-1.5">
              <Atom className="w-4 h-4 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
              {theme.statusLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`p-2.5 rounded-2xl border transition-all ${
                isAudioEnabled 
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 hover:bg-cyan-500/30' 
                  : 'bg-slate-800/80 text-slate-500 border-slate-700 hover:text-slate-300'
              }`}
              title={isAudioEnabled ? 'Tắt âm thanh tích tắc' : 'Bật âm thanh tích tắc'}
            >
              {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10 transition-all"
              title="Thu nhỏ thành thanh nổi góc dưới"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/40 transition-all"
              title="Đóng đồng hồ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* REVOLVING ATOMIC PLANETARY ORBITS & COUNTDOWN NUCLEUS CORE */}
        {/* ============================================================== */}
        <div className="relative w-72 h-72 sm:w-84 sm:h-84 my-4 flex items-center justify-center">
          
          {/* SVG Circular Progress Track */}
          <svg className="w-full h-full -rotate-90 transform drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">
            <defs>
              <linearGradient id="atomicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="35%" stopColor="#818CF8" />
                <stop offset="70%" stopColor="#C084FC" />
                <stop offset="100%" stopColor="#F472B6" />
              </linearGradient>
            </defs>

            {/* Background muted track */}
            <circle
              cx="50%"
              cy="50%"
              r="140"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Active glowing progress ring */}
            <circle
              cx="50%"
              cy="50%"
              r="140"
              stroke={theme.stroke}
              strokeWidth="12"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          {/* 3D Revolving Atomic Orbital Rings */}
          {/* Orbit 1: 0 deg tilt */}
          <div 
            className="absolute inset-4 rounded-full border border-cyan-400/30 pointer-events-none"
            style={{
              animation: isRunning ? 'spin 8s linear infinite' : 'none',
              boxShadow: '0 0 15px rgba(56,189,248,0.2)'
            }}
          >
            {/* Planet / Electron 1 */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-cyan-300 shadow-[0_0_15px_#38bdf8] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>

          {/* Orbit 2: 60 deg tilt (elliptical) */}
          <div 
            className="absolute inset-4 rounded-[48%] border border-purple-400/35 pointer-events-none transform rotate-[60deg]"
            style={{
              animation: isRunning ? 'spin 12s linear infinite reverse' : 'none',
              boxShadow: '0 0 15px rgba(192,132,252,0.25)'
            }}
          >
            {/* Planet / Electron 2 */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-purple-300 shadow-[0_0_15px_#c084fc] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>

          {/* Orbit 3: 120 deg tilt (elliptical) */}
          <div 
            className="absolute inset-4 rounded-[48%] border border-pink-400/35 pointer-events-none transform rotate-[120deg]"
            style={{
              animation: isRunning ? 'spin 10s linear infinite' : 'none',
              boxShadow: '0 0 15px rgba(244,114,182,0.25)'
            }}
          >
            {/* Planet / Electron 3 */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-pink-300 shadow-[0_0_15px_#f472b6] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>

          {/* Orbit 4: Counter Orbit Amber Planet */}
          <div 
            className="absolute inset-8 rounded-[46%] border border-amber-400/25 pointer-events-none transform -rotate-[45deg]"
            style={{
              animation: isRunning ? 'spin 15s linear infinite' : 'none',
              boxShadow: '0 0 12px rgba(251,191,36,0.2)'
            }}
          >
            {/* Planet / Electron 4 */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-amber-300 shadow-[0_0_12px_#f59e0b] flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white" />
            </div>
          </div>

          {/* Core Nucleus Glowing Ball */}
          <div className="absolute inset-16 rounded-full bg-slate-950/90 border border-white/20 backdrop-blur-md flex flex-col items-center justify-center shadow-inner overflow-hidden">
            {/* Internal plasma shimmer */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${theme.gradient} opacity-20 ${isRunning ? 'animate-pulse' : ''}`} />
            
            {/* Big Countdown Number */}
            <motion.div
              key={totalSeconds}
              initial={{ scale: totalSeconds <= 10 ? 1.15 : 1 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`relative z-10 font-mono font-black text-4xl sm:text-6xl tracking-wider drop-shadow-[0_4px_25px_rgba(0,0,0,0.8)] ${
                totalSeconds <= 10 
                  ? 'text-rose-400 animate-pulse drop-shadow-[0_0_20px_rgba(244,63,94,0.8)]' 
                  : 'text-white'
              }`}
            >
              {formattedTime}
            </motion.div>

            <div className="relative z-10 text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRunning ? 'Đang đếm ngược' : hasFinished ? 'HẾT GIỜ!' : 'Tạm dừng'}</span>
            </div>
          </div>
        </div>

        {/* Fine-tune duration buttons */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => adjustSeconds(-60)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 flex items-center gap-1 active:scale-95"
            title="Trừ 1 phút"
          >
            <Minus className="w-3.5 h-3.5" /> 1 phút
          </button>
          <button
            onClick={() => adjustSeconds(-30)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 flex items-center gap-1 active:scale-95"
            title="Trừ 30 giây"
          >
            <Minus className="w-3.5 h-3.5" /> 30s
          </button>
          <button
            onClick={() => adjustSeconds(30)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 flex items-center gap-1 active:scale-95"
            title="Cộng 30 giây"
          >
            <Plus className="w-3.5 h-3.5" /> 30s
          </button>
          <button
            onClick={() => adjustSeconds(60)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 flex items-center gap-1 active:scale-95"
            title="Cộng 1 phút"
          >
            <Plus className="w-3.5 h-3.5" /> 1 phút
          </button>
        </div>

        {/* Primary Action Buttons (Bắt đầu / Tạm dừng / Đặt lại 5 phút) */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full mb-6">
          <button
            type="button"
            onClick={toggleRun}
            className={`px-8 py-3.5 rounded-2xl font-black text-sm sm:text-base flex items-center gap-2.5 shadow-xl transition-all cursor-pointer active:scale-95 border ${
              isRunning
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.5)]'
                : 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-slate-950 border-cyan-300 shadow-[0_0_35px_rgba(56,189,248,0.6)] hover:brightness-110'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>TẠM DỪNG</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>{hasFinished ? 'CHẠY LẠI' : 'BẮT ĐẦU ĐẾM'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleReset(5)}
            className="px-6 py-3.5 rounded-2xl font-extrabold text-sm sm:text-base bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 flex items-center gap-2 shadow-lg transition-all active:scale-95"
            title="Đặt lại về mặc định 5 phút"
          >
            <RotateCcw className="w-5 h-5 text-cyan-400" />
            <span>ĐẶT LẠI (5 PHÚT)</span>
          </button>
        </div>

        {/* Preset quick times */}
        <div className="w-full pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-slate-400 font-bold uppercase tracking-wider mr-1">Mốc nhanh:</span>
          {[
            { label: '1 Phút', min: 1 },
            { label: '3 Phút', min: 3 },
            { label: '5 Phút (Mặc định)', min: 5, highlight: true },
            { label: '10 Phút', min: 10 },
            { label: '15 Phút', min: 15 }
          ].map(p => (
            <button
              key={p.min}
              onClick={() => handleReset(p.min)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border ${
                p.highlight && initialSeconds === p.min * 60
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                  : initialSeconds === p.min * 60
                  ? 'bg-purple-500/25 border-purple-400 text-purple-300'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
