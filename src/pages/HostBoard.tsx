import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, onSnapshot, setDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { Quiz, Question, GameSession, Player, GameMode } from '../types';
import { 
  Loader2, 
  Users, 
  Trophy, 
  Clock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Maximize, 
  Minimize, 
  Pause, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  HelpCircle, 
  Home, 
  Search, 
  FileSpreadsheet,
  Volume2,
  VolumeX,
  Zap,
  GraduationCap,
  Layers,
  BookOpen,
  ChevronLeft,
  ListFilter,
  RotateCcw,
  X,
  Megaphone,
  ShieldCheck,
  AlertCircle,
  Atom,
  LogOut,
  Cloud,
  Loader2
} from 'lucide-react';
import ConfettiEffect from '../components/ConfettiEffect';
import ExamSeatingModal from '../components/ExamSeatingModal';
import AtomicCountdownClock from '../components/AtomicCountdownClock';
import { shuffleQuiz } from '../utils/shuffleQuiz';
import { calculateScoreBreakdown, formatTFAnswer, parseTFAnswerList, normalizeTFChar } from '../utils/scoring';
import { exportLeaderboardExcel } from '../services/templateQuizService';
import { exportSessionToGoogleSheets } from '../services/googleSheetsService';
import { ensureDriveAccessToken } from '../services/googleDriveService';
import { gameAudio } from '../utils/gameAudio';
import { getStationForQuestion, calculateLevelData, getPlayerTitle } from '../utils/gamification';
import { CyberSpaceBackground } from '../components/CyberSpaceBackground';
import Round2ShuffleModal from '../components/Round2ShuffleModal';
import Round2HostBoard from '../components/Round2HostBoard';
import { shuffleTop18IntoRound2Groups } from '../utils/round2Grouping';
import TtsVoiceSettingsModal from '../components/TtsVoiceSettingsModal';
import { 
  speakText, 
  buildQuestionSpeechScript, 
  cancelSpeech, 
  getAutoTtsPreference, 
  setAutoTtsPreference,
  getTtsGenderPreference,
  TtsGender
} from '../utils/textToSpeech';
import { Round2Group, StudentRosterItem, SeatingPlan } from '../types';
import { loadRoster } from '../utils/studentRoster';
import { getCachedOpeningAudioUrl } from '../utils/systemConfig';
import { getQuizById } from '../utils/quizStorage';
import { firestoreQuota } from '../utils/firestoreQuota';
import { syncSessionToServer, fetchSessionFromServer } from '../services/serverSync';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

export default function HostBoard() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [systemRoster, setSystemRoster] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Game Mode: 'TEACHER_CONTROL' (GV điều khiển mở câu hỏi và tốc độ) or 'EXAM_AUTO'
  const [gameMode, setGameMode] = useState<GameMode>('TEACHER_CONTROL');

  // Timer & Host Controls
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Auto transition state for Exam mode
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  // Top 5 & Full Leaderboard States
  const [showTop5Modal, setShowTop5Modal] = useState(false);
  const [summaryTab, setSummaryTab] = useState<'LEADERBOARD' | 'ANSWERS'>('LEADERBOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllAnswersInSummary, setShowAllAnswersInSummary] = useState(false);

  // Teacher Control Mode Features: Jump to question & Explanation modal/toggle
  const [showExplanation, setShowExplanation] = useState(false);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [confettiKey, setConfettiKey] = useState<number>(1);

  // Auto Text-to-Speech (TTS) for reading questions and answers automatically
  const [isAutoTtsEnabled, setIsAutoTtsEnabled] = useState<boolean>(() => getAutoTtsPreference());
  const [ttsGender, setTtsGender] = useState<TtsGender>(() => getTtsGenderPreference());
  const [showTtsSettingsModal, setShowTtsSettingsModal] = useState<boolean>(false);

  // Round 2 Shuffle Modal state
  const [showRound2Modal, setShowRound2Modal] = useState<boolean>(false);
  const [round2Submissions, setRound2Submissions] = useState<Record<string, any>>({});

  // Teacher Broadcast Announcement states
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);

  // Exam Seating Modal (5 Dãy x 6 HS = 30 Chỗ)
  const [showSeatingModal, setShowSeatingModal] = useState<boolean>(false);
  // Atomic Planetary Countdown Clock (5 Phút)
  const [showAtomicClock, setShowAtomicClock] = useState<boolean>(false);

  // Question Audio & Opening Audio States
  const [isQuestionAudioEnabled, setIsQuestionAudioEnabled] = useState<boolean>(false); // default OFF ("mặc định tắt")
  const [isExportingSheets, setIsExportingSheets] = useState<boolean>(false);
  const [sheetsNotice, setSheetsNotice] = useState<string | null>(null);

  const handleExportGoogleSheets = async () => {
    if (!session) return;
    setIsExportingSheets(true);
    try {
      const token = await ensureDriveAccessToken();
      const res = await exportSessionToGoogleSheets(session, token);
      gameAudio.playVictory();
      setSheetsNotice('📊 Đã xuất Bảng điểm sang Google Sheets thành công!');
      window.open(res.spreadsheetUrl, '_blank');
      setTimeout(() => setSheetsNotice(null), 5000);
    } catch (err: any) {
      console.error('Export sheets error:', err);
      alert('Không thể xuất Google Sheets: ' + (err?.message || 'Vui lòng kiểm tra quyền truy cập.'));
    } finally {
      setIsExportingSheets(false);
    }
  };
  const openingAudioRef = useRef<HTMLAudioElement | null>(null);
  const questionAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayOpeningAudio = () => {
    const url = getCachedOpeningAudioUrl();
    if (url && (url.startsWith('data:audio') || url.startsWith('blob:'))) {
      try {
        if (openingAudioRef.current) {
          openingAudioRef.current.pause();
        }
        const audio = new Audio(url);
        openingAudioRef.current = audio;
        audio.play().catch(() => {
          gameAudio.playOpeningFanfare();
        });
      } catch {
        gameAudio.playOpeningFanfare();
      }
    } else {
      // Procedural synthesizer fanfare - 100% offline, zero network requests
      gameAudio.playOpeningFanfare();
    }
  };

  // Helper to reliably stop any currently playing question audio
  const stopQuestionAudio = () => {
    if (questionAudioRef.current) {
      try {
        questionAudioRef.current.pause();
        questionAudioRef.current.currentTime = 0;
        questionAudioRef.current.src = '';
      } catch (e) {}
      questionAudioRef.current = null;
    }
  };

  const handlePlayCurrentQuestionAudio = () => {
    if (!quiz || !session) return;
    const q = quiz.questions[session.currentQuestionIndex];
    if (!q?.audioUrl) {
      alert('Câu hỏi này chưa được gắn đường dẫn Audio.');
      return;
    }
    try {
      stopQuestionAudio();
      cancelSpeech();
      const audio = new Audio(q.audioUrl);
      questionAudioRef.current = audio;
      audio.play().catch(err => alert('Không thể phát audio câu hỏi: ' + err.message));
    } catch (err: any) {
      alert('Lỗi phát audio: ' + err.message);
    }
  };

  // Auto play question audio ONLY when the question is actively opened/activated
  // When question changes, previous audio is automatically stopped to play current question's audio
  useEffect(() => {
    if (!quiz || !session) {
      stopQuestionAudio();
      return;
    }
    
    const isExamMode = session.gameMode === 'EXAM_AUTO';
    const isVisible = (isExamMode || session.isQuestionOpen === true) && session.status === 'ACTIVE';
    
    if (!isVisible) {
      stopQuestionAudio();
      return;
    }

    const q = quiz.questions[session.currentQuestionIndex];
    if (q?.audioUrl) {
      try {
        stopQuestionAudio();
        cancelSpeech();
        const audio = new Audio(q.audioUrl);
        questionAudioRef.current = audio;
        audio.play().catch(err => console.warn('Could not auto-play question audio on Host:', err));
      } catch (err) {
        console.warn('Error playing question audio automatically:', err);
      }
    } else {
      // No audio file for this question, ensure previous question audio is stopped
      stopQuestionAudio();
    }

    return () => {
      stopQuestionAudio();
    };
  }, [session?.currentQuestionIndex, session?.isQuestionOpen, session?.gameMode, session?.status, quiz]);


  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoNextRef = useRef<NodeJS.Timeout | null>(null);
  const isAdvancingRef = useRef<boolean>(false);

  // Ranked players sorted strictly by EXP desc -> totalTimeSpent asc (Chỉ dùng exp để tính, không xếp hạng theo điểm số câu đúng)
  const rankedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const expDiff = (b.exp ?? 0) - (a.exp ?? 0);
      if (expDiff !== 0) return expDiff;

      const tA = a.totalTimeSpent ?? 99999;
      const tB = b.totalTimeSpent ?? 99999;
      return tA - tB;
    });
  }, [players]);

  const top5Players = useMemo(() => {
    return rankedPlayers.slice(0, 5);
  }, [rankedPlayers]);

  const filteredRankedPlayers = useMemo(() => {
    if (!searchQuery.trim()) return rankedPlayers;
    const q = searchQuery.trim().toLowerCase();
    return rankedPlayers.filter(p => p.name.toLowerCase().includes(q));
  }, [rankedPlayers, searchQuery]);

  // Score breakdown calculated according to rules
  const breakdown = useMemo(() => {
    return quiz ? calculateScoreBreakdown(quiz.questions) : null;
  }, [quiz]);

  // Current Station Theme
  const currentStation = useMemo(() => {
    if (!quiz || !session) return getStationForQuestion(0, 1);
    return getStationForQuestion(session.currentQuestionIndex, quiz.questions.length);
  }, [quiz, session]);

  // Top 18 Leaderboard sorted strictly by EXP desc, then correctCount desc, totalTimeSpent asc (NOT by score)
  const top18Players = useMemo(() => {
    return [...players]
      .sort((a, b) => {
        const expDiff = (b.exp ?? 0) - (a.exp ?? 0);
        if (expDiff !== 0) return expDiff;
        const corDiff = (b.correctCount ?? 0) - (a.correctCount ?? 0);
        if (corDiff !== 0) return corDiff;
        return (a.totalTimeSpent ?? 99999) - (b.totalTimeSpent ?? 99999);
      })
      .slice(0, 18);
  }, [players]);
  const top16Players = top18Players;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    gameAudio.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const toggleAudio = () => {
    const muted = gameAudio.toggleMute();
    setIsMuted(muted);
    if (!muted) gameAudio.playClick();
  };

  // Initialize Session Instantly
  useEffect(() => {
    let unsubPlayers: (() => void) | null = null;
    let unsubSession: (() => void) | null = null;
    let unsubSubmissions: (() => void) | null = null;

    const init = async () => {
      if (!quizId) return;
      try {
        // 1. Load quiz instantly from cache / storage
        const qData = await getQuizById(quizId);
        if (!qData) {
          setLoading(false);
          alert('Không tìm thấy bộ đề!');
          navigate('/host');
          return;
        }

        setQuiz(qData);
        setLoading(false); // INSTANT RENDER!

        // Load roster in background
        loadRoster().then(r => setSystemRoster(r)).catch(() => {});

        const searchParams = new URLSearchParams(window.location.search);
        const paramSessionId = searchParams.get('session');

        let targetSessionId = paramSessionId || `ses-${Date.now()}`;
        const pin = targetSessionId.slice(-6).toUpperCase();

        const newSession: GameSession = {
          id: targetSessionId,
          pin,
          quizId,
          hostId: 'host',
          status: 'WAITING',
          gameMode: 'TEACHER_CONTROL',
          currentQuestionIndex: 0,
          questionStartTime: 0,
          createdAt: Date.now(),
          questions: qData.questions,
          roster: [],
          isQuestionOpen: false,
          round2Submissions: {},
          round2Scores: {},
          round2Groups: [],
        };

        setSession(newSession);

        // Always sync immediately to server backup (works even when Firestore quota is 100% full!)
        syncSessionToServer(newSession);

        // Background sync to Firestore without blocking UI
        setDoc(doc(db, 'sessions', targetSessionId), newSession).catch(err => {
          firestoreQuota.reportError(err);
          console.warn('Background setDoc err:', err);
        });

        sessionStorage.setItem(`active_host_session_${quizId}`, targetSessionId);
        const newUrl = `${window.location.pathname}?session=${targetSessionId}`;
        window.history.replaceState(null, '', newUrl);

        // Real-time listeners
        unsubSession = onSnapshot(doc(db, 'sessions', targetSessionId), (snap) => {
          if (snap.exists()) {
            const sData = snap.data() as GameSession;
            setSession(prev => ({
              ...prev,
              ...sData,
              id: snap.id,
              round2Submissions: sData.round2Submissions || {},
              round2Scores: sData.round2Scores || {},
              round2Groups: sData.round2Groups || prev?.round2Groups || [],
              status: sData.status || prev?.status || 'WAITING',
              judgeSlots: sData.judgeSlots || prev?.judgeSlots,
              announcement: sData.announcement ?? prev?.announcement,
              isQuestionOpen: sData.isQuestionOpen ?? prev?.isQuestionOpen,
              currentQuestionIndex: sData.currentQuestionIndex ?? prev?.currentQuestionIndex,
              lastRound2Update: sData.lastRound2Update ?? prev?.lastRound2Update
            }));
          }
        }, () => {});

        unsubPlayers = onSnapshot(collection(db, `sessions/${targetSessionId}/players`), (snap) => {
          setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
        }, () => {});

        unsubSubmissions = onSnapshot(collection(db, `sessions/${targetSessionId}/submissions`), (snap) => {
          const subsMap: Record<string, any> = {};
          snap.docs.forEach(docSnap => {
            subsMap[docSnap.id] = docSnap.data();
          });
          setRound2Submissions(subsMap);
        }, () => {});

        // Backup server-side sync poller to guarantee real-time updates when Firestore write quota is exhausted
        const backupInterval = setInterval(async () => {
          const backupData = await fetchSessionFromServer(targetSessionId);
          if (backupData) {
            if (backupData.players && backupData.players.length > 0) {
              setPlayers(prev => {
                const map = new Map<string, Player>();
                prev.forEach(p => map.set(p.id, p));
                backupData.players.forEach(p => map.set(p.id, p));
                return Array.from(map.values());
              });
            }
            if (backupData.submissions && backupData.submissions.length > 0) {
              setRound2Submissions(prev => {
                const updated = { ...prev };
                backupData.submissions.forEach(sub => {
                  if (sub.teamId) updated[sub.teamId] = sub;
                });
                return updated;
              });
            }
            if (backupData.session?.round2Scores) {
              setSession(prev => prev ? { ...prev, round2Scores: backupData.session!.round2Scores } : prev);
            }
          }
        }, 1500);

        return () => {
          clearInterval(backupInterval);
          if (unsubSession) unsubSession();
          if (unsubPlayers) unsubPlayers();
          if (unsubSubmissions) unsubSubmissions();
        };

      } catch (e) {
        console.error('Failed to init session on HostBoard:', e);
        setLoading(false);
      }
    };

    init();

    return () => {
      if (unsubSession) unsubSession();
      if (unsubPlayers) unsubPlayers();
      if (unsubSubmissions) unsubSubmissions();
    };
  }, [quizId]);

  // Next Question or End Game handler
  const handleNextQuestion = async () => {
    if (!session || !quiz || isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    stopQuestionAudio();
    cancelSpeech();
    setShowAnswer(false);
    setAutoNextCountdown(null);
    if (autoNextRef.current) clearInterval(autoNextRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    // In Exam Mode, no click or fanfare sounds between test questions
    if (session.gameMode !== 'EXAM_AUTO') {
      gameAudio.playClick();
    }

    if (session.currentQuestionIndex < quiz.questions.length - 1) {
      const nextIdx = session.currentQuestionIndex + 1;
      const updates = { 
        currentQuestionIndex: nextIdx, 
        questionStartTime: Date.now(),
        isQuestionOpen: true,
        showAnswer: false,
        showExplanation: false
      };
      syncSessionToServer({ ...session, ...updates });
      await updateDoc(doc(db, 'sessions', session.id), updates).catch(err => firestoreQuota.reportError(err));
      setSession({ 
        ...session, 
        ...updates
      });
    } else {
      // Quiz Finished!
      gameAudio.playVictory();
      syncSessionToServer({ ...session, status: 'FINISHED', endedAt: Date.now() });
      await updateDoc(doc(db, 'sessions', session.id), { status: 'FINISHED', endedAt: Date.now() }).catch(err => firestoreQuota.reportError(err));
      setSession({ ...session, status: 'FINISHED' });
    }
  };

  // End Game and Return to Home (GV thoát về trang chủ, toàn bộ đều dừng game để chuẩn bị game mới)
  const handleEndGameToHome = () => {
    gameAudio.playClick();
    stopQuestionAudio();
    cancelSpeech();

    const targetSessionId = session?.id;

    // Clear all stored host session IDs immediately
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('active_host_session_')) {
        sessionStorage.removeItem(key);
      }
    }

    sessionStorage.setItem('game_ended_notice', 'true');

    const closeUpdates = {
      status: 'CLOSED' as const,
      isClosed: true,
      hostLeft: true,
      endedAt: Date.now(),
      announcement: {
        message: '🔔 Giáo viên đã kết thúc phiên thi đấu và quay về trang chủ để chuẩn bị game mới.',
        type: 'info' as const,
        timestamp: Date.now()
      }
    };

    if (session) {
      syncSessionToServer({ ...session, ...closeUpdates });
    }

    if (targetSessionId) {
      updateDoc(doc(db, 'sessions', targetSessionId), closeUpdates).catch(e => {
        firestoreQuota.reportError(e);
        console.warn('Error closing session on Host:', e);
      });
    }

    // Immediately navigate Teacher back to Home
    navigate('/');
  };

  // Toggle Question Open/Closed for students
  const handleToggleQuestionOpen = async () => {
    if (!session) return;
    const currentOpen = session.isQuestionOpen === true;
    const nextVal = !currentOpen;
    gameAudio.playClick();
    const updates = {
      isQuestionOpen: nextVal,
      questionStartTime: nextVal ? Date.now() : (session.questionStartTime || Date.now())
    };
    syncSessionToServer({ ...session, ...updates });
    await updateDoc(doc(db, 'sessions', session.id), updates).catch(err => firestoreQuota.reportError(err));
    setSession({
      ...session,
      ...updates
    });
  };

  // Previous Question handler (for Teacher Control Mode)
  const handlePrevQuestion = async () => {
    if (!session || !quiz || isAdvancingRef.current) return;
    if (session.currentQuestionIndex <= 0) return;
    isAdvancingRef.current = true;
    stopQuestionAudio();
    cancelSpeech();
    setShowAnswer(false);
    setShowExplanation(false);
    setAutoNextCountdown(null);
    if (autoNextRef.current) clearInterval(autoNextRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    gameAudio.playClick();
    const prevIdx = session.currentQuestionIndex - 1;
    const updates = { 
      currentQuestionIndex: prevIdx, 
      questionStartTime: Date.now(),
      showAnswer: false,
      showExplanation: false
    };
    syncSessionToServer({ ...session, ...updates });
    await updateDoc(doc(db, 'sessions', session.id), updates).catch(err => firestoreQuota.reportError(err));
    setSession({ ...session, ...updates });
  };

  // Direct Jump to a specific question (for Teacher Control Mode)
  const handleJumpToQuestion = async (targetIdx: number) => {
    if (!session || !quiz || isAdvancingRef.current) return;
    if (targetIdx < 0 || targetIdx >= quiz.questions.length) return;
    if (targetIdx === session.currentQuestionIndex) {
      setShowQuestionPicker(false);
      return;
    }

    isAdvancingRef.current = true;
    stopQuestionAudio();
    cancelSpeech();
    setShowAnswer(false);
    setShowExplanation(false);
    setShowQuestionPicker(false);
    setAutoNextCountdown(null);
    if (autoNextRef.current) clearInterval(autoNextRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    gameAudio.playClick();
    const updates = { 
      currentQuestionIndex: targetIdx, 
      questionStartTime: Date.now(),
      showAnswer: false,
      showExplanation: false
    };
    syncSessionToServer({ ...session, ...updates });
    await updateDoc(doc(db, 'sessions', session.id), updates).catch(err => firestoreQuota.reportError(err));
    setSession({ ...session, ...updates });
  };

  // Teacher Answer and Explanation toggle helpers with Firestore sync
  const toggleShowAnswer = async () => {
    gameAudio.playClick();
    const nextVal = !showAnswer;
    setShowAnswer(nextVal);
    if (session?.id) {
      syncSessionToServer({ ...session, showAnswer: nextVal });
      await updateDoc(doc(db, 'sessions', session.id), { showAnswer: nextVal }).catch(e => firestoreQuota.reportError(e));
    }
  };

  const toggleShowExplanation = async () => {
    gameAudio.playClick();
    const nextVal = !showExplanation;
    setShowExplanation(nextVal);
    if (session?.id) {
      syncSessionToServer({ ...session, showExplanation: nextVal });
      await updateDoc(doc(db, 'sessions', session.id), { showExplanation: nextVal }).catch(e => firestoreQuota.reportError(e));
    }
  };

  // Teacher Broadcast Announcement Handlers
  const handleSendAnnouncement = async (customMsg?: string) => {
    const textToSend = (customMsg !== undefined ? customMsg : announcementInput).trim();
    if (!session || !textToSend) return;
    setIsSendingAnnouncement(true);
    try {
      const announcementData = {
        message: textToSend,
        type: 'info' as const,
        timestamp: Date.now()
      };
      syncSessionToServer({ ...session, announcement: announcementData });
      await updateDoc(doc(db, 'sessions', session.id), {
        announcement: announcementData
      }).catch(e => firestoreQuota.reportError(e));
      gameAudio.playVictory();
      setAnnouncementInput('');
      setShowAnnouncementModal(false);
    } catch (e) {
      console.error('Lỗi phát thông báo:', e);
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  const handleClearAnnouncement = async () => {
    if (!session) return;
    try {
      syncSessionToServer({ ...session, announcement: null as any });
      await updateDoc(doc(db, 'sessions', session.id), {
        announcement: null
      }).catch(e => firestoreQuota.reportError(e));
      gameAudio.playClick();
      setShowAnnouncementModal(false);
    } catch (e) {
      console.error('Lỗi thu hồi thông báo:', e);
    }
  };

  // Render Announcement Modal Helper
  const renderAnnouncementModal = () => {
    if (!showAnnouncementModal || !session) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
        <div className="w-full max-w-xl glass-neon-card-glow border-2 border-amber-400/80 rounded-3xl p-5 sm:p-7 flex flex-col gap-4 shadow-[0_0_70px_rgba(251,191,36,0.35)] relative text-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)]">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">Phát Thông Báo Cho Toàn Bộ Học Sinh</h3>
                <p className="text-xs text-slate-300">Nội dung sẽ lập tức hiển thị trên tất cả thiết bị học sinh</p>
              </div>
            </div>
            <button
              onClick={() => setShowAnnouncementModal(false)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Currently active announcement notice */}
          {session.announcement?.message && (
            <div className="p-3 bg-amber-500/15 border border-amber-400/40 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
                <span className="truncate"><strong>Đang hiển thị:</strong> {session.announcement.message}</span>
              </div>
              <button
                onClick={handleClearAnnouncement}
                className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-xl text-xs font-bold border border-rose-400/40 cursor-pointer flex-shrink-0"
              >
                Thu hồi
              </button>
            </div>
          )}

          {/* Quick Suggestion Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Chọn nhanh mẫu thông báo:
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {[
                '⭐ Tới câu 5 sẽ có thêm Ngôi sao may mắn, các em chú ý để bứt phá nhé',
                '⚔️ Đến câu 10 các em có thể cướp điểm từ các bạn trong top 10 nếu trả lời đúng. Top 10 hãy phòng thủ',
                '🎯 Câu 15 có thêm phần cược điểm, chú ý để bứt phá',
                '👀 Hãy chú ý',
                '🤫 Hãy tập trung',
                '🔍 Hãy chú ý: Đọc thật kỹ câu hỏi và các phương án trước khi chọn nhé!',
                '🎯 Hãy tập trung: Giữ trật tự và tập trung làm bài nghiêm túc!',
                '⏳ Chú ý: Sắp hết thời gian làm bài, hãy nhanh tay!',
                '🚀 Cố lên các em, tăng tốc bứt phá điểm số!',
                '👏 Rất xuất sắc! Chúc mừng các bạn đang dẫn đầu!'
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAnnouncementInput(preset)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400/50 text-slate-300 hover:text-amber-200 text-xs font-semibold transition-all cursor-pointer text-left"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Input textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Hoặc tự nhập nội dung thông báo:
            </label>
            <textarea
              value={announcementInput}
              onChange={(e) => setAnnouncementInput(e.target.value)}
              placeholder="Nhập lời nhắc, thông báo hoặc chỉ dẫn của giáo viên gửi đến học sinh..."
              rows={3}
              className="w-full p-3 bg-slate-950/80 border-2 border-slate-700 focus:border-amber-400 rounded-2xl text-sm font-medium text-white placeholder-slate-500 outline-none transition-all resize-none shadow-inner"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              onClick={() => setShowAnnouncementModal(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
            >
              Đóng
            </button>
            <button
              onClick={() => handleSendAnnouncement()}
              disabled={!announcementInput.trim() || isSendingAnnouncement}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
            >
              {isSendingAnnouncement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
              <span>Phát thông báo tới tất cả máy học sinh</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Trigger Automatic Next (Only used in Teacher Control Mode if desired)
  const triggerAutoTransition = (delaySeconds: number = 4) => {
    setShowAnswer(true);
    gameAudio.playCorrect();
    setAutoNextCountdown(delaySeconds);

    if (autoNextRef.current) clearInterval(autoNextRef.current);
    autoNextRef.current = setInterval(() => {
      setAutoNextCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (autoNextRef.current) clearInterval(autoNextRef.current);
          handleNextQuestion();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Auto TTS and Round 2 Group Handlers
  const handleToggleAutoTts = () => {
    setIsAutoTtsEnabled(prev => {
      const next = !prev;
      setAutoTtsPreference(next);
      if (!next) cancelSpeech();
      return next;
    });
  };

  const handleReplayTts = () => {
    if (!quiz || !session) return;
    const q = quiz.questions[session.currentQuestionIndex];
    if (q) {
      cancelSpeech();
      const script = buildQuestionSpeechScript(q, session.currentQuestionIndex + 1);
      speakText(script, { gender: ttsGender });
    }
  };

  const handleSaveRound2Groups = async (round2Groups: Round2Group[]) => {
    if (!session) return;
    const updates = { 
      round2Groups, 
      lastRound2Update: Date.now() 
    };
    syncSessionToServer({ ...session, ...updates });
    await updateDoc(doc(db, 'sessions', session.id), updates).catch(err => firestoreQuota.reportError(err));
    setSession(prev => prev ? { ...prev, ...updates } : null);
  };

  const handleSwitchToRound2 = async () => {
    if (!session) return;
    try {
      gameAudio.playVictory();
      // Ensure round 2 groups are populated
      let groups = session.round2Groups;
      if (!groups || groups.length === 0) {
        groups = shuffleTop18IntoRound2Groups(rankedPlayers);
      }
      const round2Updates = {
        status: 'ROUND2' as const,
        currentRound: 2,
        round2Groups: groups,
        lastRound2Update: Date.now()
      };
      syncSessionToServer({ ...session, ...round2Updates });
      await updateDoc(doc(db, 'sessions', session.id), round2Updates).catch(err => firestoreQuota.reportError(err));
      setSession(prev => prev ? { ...prev, ...round2Updates } : null);
    } catch (err: any) {
      console.error('Error switching to Round 2:', err);
      alert('Không thể chuyển Vòng 2: ' + (err?.message || ''));
    }
  };

  const handleBackToRound1 = async () => {
    if (!session) return;
    try {
      await updateDoc(doc(db, 'sessions', session.id), {
        status: 'FINISHED',
        currentRound: 1
      });
      setSession(prev => prev ? { ...prev, status: 'FINISHED', currentRound: 1 } : null);
    } catch (err: any) {
      console.error('Error switching back to Round 1:', err);
    }
  };

  const renderTtsVoiceModal = () => (
    <TtsVoiceSettingsModal
      isOpen={showTtsSettingsModal}
      onClose={() => setShowTtsSettingsModal(false)}
      onSettingsChanged={({ enabled, gender }) => {
        setIsAutoTtsEnabled(enabled);
        setTtsGender(gender);
      }}
    />
  );

  // Timer loop & Auto TTS question reader
  useEffect(() => {
    if (session?.status === 'ACTIVE' && quiz) {
      isAdvancingRef.current = false;
      const q = quiz.questions[session.currentQuestionIndex];
      const limit = q.timeLimit || (q.type === 'MC' ? 30 : 60);
      setTimeLeft(limit);
      setShowAnswer(false);
      setShowExplanation(false);
      setIsTimerPaused(false);
      setAutoNextCountdown(null);
      if (autoNextRef.current) clearInterval(autoNextRef.current);

      // Fallback to TTS only if enabled and no audio file is attached to this question
      if (isAutoTtsEnabled && q && !q.audioUrl) {
        cancelSpeech();
        const script = buildQuestionSpeechScript(q, session.currentQuestionIndex + 1);
        speakText(script, { gender: ttsGender });
      }
      
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (isTimerPaused) return prev;
          if (prev <= 10 && prev > 1) {
            gameAudio.playTick(prev <= 5);
          }
          if (prev <= 1) {
            // TIME'S UP!
            if (session.gameMode === 'EXAM_AUTO') {
              // Chế độ Kiểm tra: LẬP TỨC chuyển câu hỏi tiếp theo không cần thông báo hay hiệu ứng đúng/sai
              handleNextQuestion();
            } else {
              // Chế độ Giáo viên: Dừng ở 0 và hiện đáp án để GV phân tích
              setShowAnswer(true);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      cancelSpeech();
      stopQuestionAudio();
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoNextRef.current) clearInterval(autoNextRef.current);
    };
  }, [session?.status, session?.currentQuestionIndex, session?.gameMode, quiz, isAutoTtsEnabled, ttsGender]);

  // In Exam Mode: If all players in the room have answered early, LẬP TỨC chuyển câu hỏi tiếp theo không cần thông báo!
  useEffect(() => {
    if (session?.status === 'ACTIVE' && session.gameMode === 'EXAM_AUTO' && quiz && players.length > 0) {
      const currentQ = quiz.questions[session.currentQuestionIndex];
      const answeredCount = players.filter(p => p.answers && currentQ.id && p.answers[currentQ.id] !== undefined).length;
      
      // Tất cả học sinh đã nộp câu này: lập tức chuyển câu hỏi kế tiếp
      if (answeredCount === players.length && !isAdvancingRef.current) {
        handleNextQuestion();
      }
    }
  }, [players, session?.status, session?.gameMode, session?.currentQuestionIndex, quiz]);

  // KaTeX rendering for math & formulas
  useEffect(() => {
    const container = document.getElementById('question-content');
    if (container) {
      renderMathInElement(container, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
      });
    }

    const answerBox = document.getElementById('revealed-answer-box');
    if (answerBox) {
      renderMathInElement(answerBox, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
      });
    }
  });

  const handleStart = async () => {
    if (!session) return;
    gameAudio.playVictory();
    const activeQuestions = quiz?.questions || session.questions;
    const startUpdates = { 
      status: 'ACTIVE' as const, 
      gameMode: gameMode || 'TEACHER_CONTROL',
      isQuestionOpen: true,
      questionStartTime: Date.now(),
      questions: activeQuestions
    };

    // CRITICAL: Always sync to server backup so students receive status ACTIVE immediately!
    syncSessionToServer({ ...session, ...startUpdates });

    await updateDoc(doc(db, 'sessions', session.id), startUpdates).catch(err => {
      firestoreQuota.reportError(err);
    });

    setSession({ 
      ...session, 
      ...startUpdates
    });
  };

  const handleToggleGameMode = async (newMode: GameMode) => {
    setGameMode(newMode);
    gameAudio.playClick();
    if (session) {
      syncSessionToServer({ ...session, gameMode: newMode });
      await updateDoc(doc(db, 'sessions', session.id), { gameMode: newMode }).catch(err => {
        firestoreQuota.reportError(err);
      });
      setSession({ ...session, gameMode: newMode });
    }
  };

  if (loading || !quiz || !session) {
    return (
      <CyberSpaceBackground className="flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-14 h-14 text-cyan-400 animate-spin" />
        <p className="text-xl font-bold tracking-wide text-slate-300">
          Khởi tạo không gian số Science Adventure...
        </p>
      </CyberSpaceBackground>
    );
  }

  // ==========================================
  // ROUND 2: TRANH TÀI SẢN PHẨM & CHẤM ĐIỂM GIÁM KHẢO
  // ==========================================
  if (session.status === 'ROUND2') {
    return (
      <>
        <Round2HostBoard
          session={session}
          onBackToRound1={handleBackToRound1}
          isFullscreen={isFullscreen}
          toggleFullscreen={toggleFullscreen}
          isMuted={isMuted}
          toggleAudio={toggleAudio}
          round2Submissions={round2Submissions}
          onExitToHome={handleEndGameToHome}
          onOpenShuffleModal={() => {
            gameAudio.playVictory();
            setShowRound2Modal(true);
          }}
          onOpenSeatingModal={() => {
            gameAudio.playClick();
            setShowSeatingModal(true);
          }}
          onOpenAtomicClock={() => {
            gameAudio.playClick();
            setShowAtomicClock(true);
          }}
          onOpenAnnouncement={() => {
            gameAudio.playClick();
            setShowAnnouncementModal(true);
          }}
        />

        {/* Modals available in Round 2 */}
        {renderAnnouncementModal()}
        <ExamSeatingModal
          isOpen={showSeatingModal}
          onClose={() => setShowSeatingModal(false)}
          sessionId={session.id}
          quizTitle={quiz?.title}
          initialPlan={session.seatingPlan}
          onSavePlan={(plan) => setSession(prev => prev ? { ...prev, seatingPlan: plan } : null)}
        />

        <AtomicCountdownClock
          isOpen={showAtomicClock}
          onClose={() => setShowAtomicClock(false)}
          defaultMinutes={5}
        />

        <Round2ShuffleModal
          isOpen={showRound2Modal}
          onClose={() => setShowRound2Modal(false)}
          players={players}
          savedGroups={session.round2Groups}
          onSaveGroups={handleSaveRound2Groups}
        />
      </>
    );
  }

  // ==========================================
  // 1. WAITING LOBBY SCREEN (CHỌN CHẾ ĐỘ & CHỜ HS)
  // ==========================================
  if (session.status === 'WAITING') {
    return (
      <CyberSpaceBackground stationColor="#00D9FF" className="flex flex-col items-center justify-center p-4 md:p-8 select-none">
        {/* Top Control Bar */}
        <div className="absolute top-5 right-6 flex items-center gap-2.5 sm:gap-3 z-30">
          {/* Seating Arrangement Button (5 Dãy x 6 HS = 30 Chỗ) */}
          <button
            onClick={() => {
              gameAudio.playClick();
              setShowSeatingModal(true);
            }}
            className="px-3.5 py-3 bg-gradient-to-r from-indigo-500/25 via-purple-500/25 to-pink-500/25 hover:from-indigo-500/35 hover:to-pink-500/35 text-indigo-200 border border-indigo-400/50 rounded-2xl backdrop-blur-md transition-all flex items-center gap-2 text-xs md:text-sm font-black shadow-[0_0_20px_rgba(99,102,241,0.35)] cursor-pointer active:scale-95"
            title="Mở sơ đồ xếp chỗ phòng thi: 6 dãy, mỗi dãy 5 HS (Tổng 30 HS, tự động xếp không cùng lớp cạnh nhau)"
          >
            <Users className="w-4 h-4 text-cyan-300" />
            <span className="hidden sm:inline">Xếp chỗ HS (30)</span>
            <span className="sm:hidden">Xếp chỗ</span>
          </button>

          {/* Atomic Planetary Countdown Clock Button (5 Phút) */}
          <button
            onClick={() => {
              gameAudio.playClick();
              setShowAtomicClock(true);
            }}
            className="px-3.5 py-3 bg-gradient-to-r from-cyan-500/25 via-teal-500/25 to-emerald-500/25 hover:from-cyan-500/35 hover:to-emerald-500/35 text-cyan-200 border border-cyan-400/50 rounded-2xl backdrop-blur-md transition-all flex items-center gap-2 text-xs md:text-sm font-black shadow-[0_0_20px_rgba(56,189,248,0.35)] cursor-pointer active:scale-95"
            title="Mở đồng hồ đếm ngược hành tinh nguyên tử vũ trụ (Mặc định 5 phút)"
          >
            <Atom className="w-4 h-4 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="hidden sm:inline">Mở đồng hồ (5p)</span>
            <span className="sm:hidden">Đồng hồ</span>
          </button>

          {/* Phát âm thanh mở chương trình */}
          <button
            onClick={() => {
              gameAudio.playClick();
              handlePlayOpeningAudio();
            }}
            className="px-3.5 py-3 bg-gradient-to-r from-pink-500/25 to-rose-500/25 hover:from-pink-500/35 hover:to-rose-500/35 text-pink-200 border border-pink-400/50 rounded-2xl backdrop-blur-md transition-all flex items-center gap-2 text-xs md:text-sm font-black shadow-[0_0_20px_rgba(244,114,182,0.35)] cursor-pointer active:scale-95"
            title="Phát âm thanh mở chương trình đã lưu từ màn hình chính"
          >
            <Volume2 className="w-4 h-4 text-pink-300" />
            <span className="hidden sm:inline">Phát âm thanh mở</span>
            <span className="sm:hidden">Mở audio</span>
          </button>

          {/* TTS Female Voice Settings */}
          <button
            onClick={() => {
              gameAudio.playClick();
              setShowTtsSettingsModal(true);
            }}
            className="px-3.5 py-3 bg-slate-900/80 hover:bg-slate-800 text-rose-300 border border-rose-400/40 rounded-2xl backdrop-blur-md transition-all flex items-center gap-2 text-xs md:text-sm font-black shadow-[0_0_15px_rgba(244,63,94,0.25)] cursor-pointer"
            title="Cài đặt giọng đọc câu hỏi (Ưu tiên giọng Nữ)"
          >
            <span>{ttsGender === 'female' ? '👩 Giọng Nữ' : '👨 Giọng Nam'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 hidden sm:inline">
              {isAutoTtsEnabled ? 'Bật đọc' : 'Tắt'}
            </span>
          </button>
          <button
            onClick={() => {
              gameAudio.playClick();
              setShowAnnouncementModal(true);
            }}
            className={`px-3.5 py-3 rounded-2xl backdrop-blur-md transition-all flex items-center gap-2 text-xs md:text-sm font-black shadow-md cursor-pointer active:scale-95 border ${
              session.announcement?.message
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/40'
            }`}
            title="Phát thông báo hoặc lời nhắc đến tất cả thiết bị học sinh"
          >
            <Megaphone className="w-4 h-4" />
            <span className="hidden sm:inline">{session.announcement?.message ? 'Đang phát TB' : 'Phát thông báo'}</span>
          </button>
          <button
            onClick={toggleAudio}
            className="p-3 bg-slate-900/80 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 rounded-2xl backdrop-blur-md transition-all shadow-[0_0_15px_rgba(0,217,255,0.2)] cursor-pointer"
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-4 py-3 bg-slate-900/80 hover:bg-slate-800 text-white border border-cyan-500/30 rounded-2xl backdrop-blur-md transition-all flex items-center gap-2 text-xs md:text-sm font-bold shadow-[0_0_15px_rgba(0,217,255,0.2)] cursor-pointer"
            title="Chuyển chế độ Toàn màn hình máy chiếu"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình (16:9)'}</span>
          </button>
          <Link
            to="/admin"
            className="px-4 py-3 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10 rounded-2xl backdrop-blur-md text-xs md:text-sm font-bold transition-all"
          >
            Quản trị
          </Link>
          <button
            onClick={handleEndGameToHome}
            className="px-4 py-3 bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 hover:text-white border border-rose-400/50 rounded-2xl backdrop-blur-md transition-all flex items-center gap-2 text-xs md:text-sm font-black shadow-[0_0_20px_rgba(244,63,94,0.35)] cursor-pointer active:scale-95"
            title="Thoát phòng chờ và quay về trang chủ (toàn bộ học sinh sẽ dừng phòng để chuẩn bị game mới)"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Về trang chủ • Hủy phòng</span>
            <span className="sm:hidden">Hủy phòng</span>
          </button>
        </div>

        {/* 16:9 Scaled Lobby Container */}
        <div className="w-full max-w-6xl glass-neon-card-glow rounded-[2.5rem] p-6 md:p-10 flex flex-col justify-between items-center text-center shadow-[0_0_80px_rgba(0,217,255,0.2)] relative">
          
          {/* Header Title */}
          <div>
            <div className="inline-flex items-center gap-2 px-5 py-1.5 bg-cyan-500/15 border border-cyan-400/40 rounded-full text-cyan-300 font-extrabold text-xs md:text-sm uppercase tracking-widest mb-3 shadow-[0_0_20px_rgba(0,217,255,0.3)]">
              <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" /> SCIENCE ADVENTURE • HÀNH TRÌNH KHÁM PHÁ
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-[0_4px_30px_rgba(0,217,255,0.6)]">
              {quiz.title}
            </h1>
            <p className="text-slate-300 text-sm md:text-base font-medium mt-2">
              Môn: <strong className="text-cyan-300">{quiz.subject || 'KHTN'}</strong> • Tổng số: <strong className="text-purple-300">{quiz.questions.length} câu hỏi</strong> • Hệ thống điểm EXP
            </p>
          </div>

          {/* MODE SELECTION CARDS (CHẾ ĐỘ KIỂM TRA vs CHẾ ĐỘ GV) */}
          <div className="w-full max-w-3xl my-5">
            <span className="text-xs uppercase tracking-widest text-cyan-300 font-extrabold block mb-2.5">
              Chọn 1 trong 2 chế độ mở câu hỏi toàn lớp:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
              {/* Option 1: Chế độ Kiểm Tra (Tự động) */}
              <button
                type="button"
                onClick={() => handleToggleGameMode('EXAM_AUTO')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  gameMode === 'EXAM_AUTO'
                    ? 'bg-gradient-to-br from-cyan-950/80 via-slate-900 to-purple-950/80 border-cyan-400 shadow-[0_0_30px_rgba(0,217,255,0.4)] ring-2 ring-cyan-400/40'
                    : 'bg-slate-900/60 border-slate-700/80 opacity-70 hover:opacity-100 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center font-black">
                      <Zap className="w-5 h-5 fill-current" />
                    </div>
                    <span className="font-black text-base text-white">Chế độ Kiểm tra</span>
                  </div>
                  {gameMode === 'EXAM_AUTO' && (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-400 text-slate-950 text-[10px] font-black uppercase">
                      Đang chọn
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ⚡ <strong>Tự động 100%:</strong> Câu hỏi chạy từ đầu đến hết theo thời gian. Hết giờ/hết câu tự động chuyển tiếp và tự động mở bảng xếp hạng chung cuộc!
                </p>
              </button>

              {/* Option 2: Chế độ Giáo Viên (Chủ động) */}
              <button
                type="button"
                onClick={() => handleToggleGameMode('TEACHER_CONTROL')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  gameMode === 'TEACHER_CONTROL'
                    ? 'bg-gradient-to-br from-purple-950/80 via-slate-900 to-pink-950/80 border-purple-400 shadow-[0_0_30px_rgba(139,92,246,0.4)] ring-2 ring-purple-400/40'
                    : 'bg-slate-900/60 border-slate-700/80 opacity-70 hover:opacity-100 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-400 text-slate-950 flex items-center justify-center font-black">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <span className="font-black text-base text-white">Chế độ Giáo viên</span>
                  </div>
                  {gameMode === 'TEACHER_CONTROL' && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-400 text-slate-950 text-[10px] font-black uppercase">
                      Đang chọn
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  🎓 <strong>Chủ động tốc độ:</strong> GV toàn quyền dừng đếm ngược, phân tích bài giảng, mở/ẩn đáp án và bấm chuyển câu khi học sinh đã hiểu bài.
                </p>
              </button>
            </div>
          </div>

          {/* Student Code Lobby Instructions - No PIN code */}
          <div className="bg-gradient-to-br from-slate-900/95 via-indigo-950/70 to-slate-900/95 border-2 border-cyan-400/50 rounded-3xl p-5 md:p-6 flex flex-col items-center gap-3 w-full max-w-2xl shadow-[0_0_45px_rgba(0,217,255,0.25)]">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-400/15 border border-cyan-300/40 text-cyan-200 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-cyan-300" />
              <span>HỆ THỐNG VÀO THI THEO MÃ HỌC SINH</span>
            </div>
            
            <div className="text-xl md:text-2xl font-black text-white text-center leading-snug">
              Học sinh đăng nhập bằng <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-pink-300">Mã Học Sinh</span> để vào Phòng Chờ
            </div>

            <p className="text-xs sm:text-sm text-slate-300 text-center max-w-xl leading-relaxed">
              Không dùng mã PIN. Học sinh đăng nhập bằng mã số được cấp từ <strong>Trang Quản Trị</strong> và sẽ nằm ở <strong>Phòng chờ</strong>. Khi Giáo viên bấm nút <strong>"KHỞI HÀNH THỬ THÁCH"</strong>, toàn lớp sẽ cùng bắt đầu làm bài đồng loạt theo thời gian thực!
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs">
              <div className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="flex items-center gap-1">
                  <span>Đã có mặt:</span>
                  <strong className="text-white text-sm">{players.length}</strong>
                  {systemRoster.length > 0 ? (
                    <span>/ {systemRoster.length} HS theo danh sách</span>
                  ) : (
                    <span>học sinh</span>
                  )}
                </span>
              </div>
              <Link 
                to="/admin" 
                target="_blank"
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 hover:text-white font-bold flex items-center gap-1.5 transition-colors"
                title="Mở Trang Quản Trị để xem hoặc thêm mã học sinh mới"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Quản lý mã học sinh (Trang Quản trị) ➔</span>
              </Link>
            </div>
          </div>

          {/* Joined Players Roster - Full width horizontal priority with wrap */}
          <div className="w-full my-4 max-w-6xl">
            <div className="flex flex-col items-center justify-center gap-1.5 text-slate-300 text-sm font-bold mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>Chiến binh đang ở trong phòng chờ ({players.length} học sinh):</span>
              </div>
              <div className="w-full max-w-md bg-slate-900/80 rounded-full h-2 overflow-hidden border border-cyan-500/30">
                <div 
                  className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (players.length / Math.max(1, systemRoster.length || 20)) * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2.5 sm:gap-3 w-full p-4 bg-slate-950/70 rounded-3xl border border-cyan-500/30 min-h-[120px] max-h-[35vh] overflow-y-auto">
              {players.length === 0 ? (
                <p className="text-slate-500 italic text-xs mx-auto py-4">Đang quét tìm tín hiệu học sinh kết nối vào phòng...</p>
              ) : (
                players.map(p => (
                  <span 
                    key={p.id} 
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-cyan-500/15 border border-cyan-400/40 rounded-2xl font-bold text-white text-xs sm:text-sm shadow-[0_0_12px_rgba(0,217,255,0.2)] animate-in zoom-in-75 duration-200 hover:border-cyan-300 transition-all"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>{p.name}</span>
                    {p.studentCode && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-200 font-black">
                        {p.studentCode}
                      </span>
                    )}
                    {p.className && (
                      <span className="text-[10px] text-slate-300 font-semibold">
                        ({p.className})
                      </span>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Lobby Action Buttons: Start Mission and Teacher Broadcast */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <button 
              onClick={handleStart} 
              className="px-8 sm:px-10 py-3.5 sm:py-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 hover:from-cyan-300 hover:to-pink-400 text-slate-950 text-lg sm:text-2xl font-black rounded-2xl shadow-[0_0_40px_rgba(0,217,255,0.6)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 cursor-pointer"
            >
              <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
              <span>MỞ PHÒNG THI (BẮT ĐẦU)</span>
            </button>

            <button
              onClick={() => {
                gameAudio.playClick();
                setShowAnnouncementModal(true);
              }}
              className={`px-5 py-3.5 sm:py-4 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 border ${
                session.announcement?.message
                  ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/60 animate-pulse'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/50'
              }`}
              title="Phát thông báo hoặc lời nhắc đến tất cả học sinh đang chờ"
            >
              <Megaphone className="w-5 h-5" />
              <span>{session.announcement?.message ? 'Đang có thông báo' : 'Phát thông báo cho HS'}</span>
            </button>
          </div>

          {/* Active Announcement Preview in Lobby */}
          {session.announcement?.message && (
            <div className="w-full max-w-2xl mt-3 p-3 bg-amber-500/20 border border-amber-400/60 rounded-2xl flex items-center justify-between gap-3 text-amber-200 text-xs sm:text-sm font-bold animate-pulse">
              <div className="flex items-center gap-2 min-w-0">
                <Megaphone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="truncate"><strong className="text-amber-300">Thông báo phòng chờ:</strong> {session.announcement.message}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowAnnouncementModal(true)}
                  className="text-xs text-amber-300 hover:underline cursor-pointer"
                >
                  Đổi
                </button>
                <button
                  onClick={handleClearAnnouncement}
                  className="px-2.5 py-1 bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 rounded-xl text-xs font-bold border border-rose-400/40 cursor-pointer"
                >
                  Thu hồi
                </button>
              </div>
            </div>
          )}
        </div>
        {renderAnnouncementModal()}
        {renderTtsVoiceModal()}
      </CyberSpaceBackground>
    );
  }

  // ==========================================
  // 2. ACTIVE QUESTION SCREEN (CHẾ ĐỘ THI ĐẤU TRỰC TIẾP)
  // ==========================================
  const currentQ = quiz.questions[session.currentQuestionIndex];
  const isTF = currentQ.type === 'TF';
  const isMC = currentQ.type === 'MC';
  const isSA = currentQ.type === 'SA' || currentQ.type === 'ESSAY';

  const currentQPoints = isTF 
    ? '1.0 điểm (0.25 đ/ý)' 
    : isSA 
    ? '0.5 điểm' 
    : `${breakdown?.mcScorePerQ.toFixed(2) || '0.5'} điểm`;

  const tfCorrectList = isTF ? parseTFAnswerList(currentQ.answer) : [];
  const answeredCount = players.filter(p => p.answers && currentQ.id && p.answers[currentQ.id] !== undefined).length;

  if (session.status === 'ACTIVE') {
    const isExamMode = session.gameMode === 'EXAM_AUTO';

    return (
      <CyberSpaceBackground stationColor={currentStation.primaryColor} className="flex flex-col items-center justify-center p-1 sm:p-3 md:p-4 select-none min-h-[100dvh] h-[100dvh] overflow-hidden">
        {/* Adaptive Screen Container: 16:9 Landscape (TV/Projector) & 9:16 Portrait (Mobile/Vertical Display) */}
        <div className="w-full landscape:max-w-[177.78vh] landscape:aspect-video landscape:max-h-[96vh] portrait:w-full portrait:max-w-md portrait:h-[98dvh] portrait:aspect-auto portrait:max-h-none glass-neon-card-glow rounded-[1.5rem] md:rounded-[2rem] shadow-[0_0_70px_rgba(0,217,255,0.25)] flex flex-col overflow-hidden relative">
          
          {/* Top Header Bar */}
          <div className="h-14 sm:h-16 md:h-18 bg-slate-950/70 border-b border-cyan-500/25 flex items-center justify-between px-3 sm:px-6 md:px-8 flex-shrink-0">
            {/* Left: Station Identifier */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Station Badge (Mục 8: Mỗi trạm có màu riêng) */}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border ${currentStation.badgeBg} ${currentStation.badgeBorder} ${currentStation.badgeText} text-xs font-black uppercase tracking-wider shadow-[0_0_15px_currentColor]`}>
                <span>{currentStation.icon}</span>
                <span>{currentStation.name}</span>
              </div>
            </div>

            {/* Center: Mode Indicator & Switcher */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => handleToggleGameMode(isExamMode ? 'TEACHER_CONTROL' : 'EXAM_AUTO')}
                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all cursor-pointer ${
                  isExamMode
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,217,255,0.3)]'
                    : 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                }`}
                title="Nhấn để đổi chế độ giữa Tự động kiểm tra và GV điều khiển"
              >
                {isExamMode ? <Zap className="w-3.5 h-3.5 fill-current" /> : <GraduationCap className="w-3.5 h-3.5" />}
                <span>{isExamMode ? 'Chế độ: Kiểm tra Tự động' : 'Chế độ: GV Điều khiển'}</span>
              </button>
            </div>

            {/* Right: Actions, Top 5, Timer */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              {/* Auto Text-to-Speech (TTS) Toggle */}
              <button
                onClick={handleToggleAutoTts}
                className={`px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isAutoTtsEnabled
                    ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
                title={isAutoTtsEnabled ? 'Tự động đọc câu hỏi & đáp án: Đang BẬT (Bấm để tắt)' : 'Tự động đọc câu hỏi: Đang TẮT (Bấm để bật)'}
              >
                <span>{isAutoTtsEnabled ? '🔊 Đọc: BẬT' : '🔇 Đọc: TẮT'}</span>
              </button>

              {/* Top 5 Leaderboard Button (Hidden in Exam Mode to avoid spoilers) */}
              {!isExamMode && (
                <button
                  onClick={() => {
                    gameAudio.playClick();
                    setShowTop5Modal(true);
                  }}
                  className="px-2.5 py-1.5 md:px-3.5 md:py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs md:text-sm flex items-center gap-1.5 transition-all shadow-[0_0_20px_rgba(250,204,21,0.4)] cursor-pointer active:scale-95"
                  title="Xem Top 5 dẫn đầu sau câu này"
                >
                  <Trophy className="w-4 h-4 text-slate-950" />
                  <span className="hidden sm:inline">Top 5</span>
                </button>
              )}

              {/* Question Picker Button (Teacher Control Mode) */}
              {!isExamMode && (
                <button
                  onClick={() => {
                    gameAudio.playClick();
                    setShowQuestionPicker(!showQuestionPicker);
                  }}
                  className={`px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
                    showQuestionPicker
                      ? 'bg-purple-500 text-white ring-2 ring-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                      : 'bg-white/10 hover:bg-white/20 text-purple-300 border border-purple-400/40'
                  }`}
                  title="Chọn danh sách câu hỏi"
                >
                  <ListFilter className="w-4 h-4" />
                  <span className="hidden md:inline">Chọn câu</span>
                </button>
              )}

              {/* Question Audio Autoplay Toggle (Default OFF) */}
              <button
                onClick={() => {
                  gameAudio.playClick();
                  setIsQuestionAudioEnabled(!isQuestionAudioEnabled);
                }}
                className={`px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                  isQuestionAudioEnabled
                    ? 'bg-pink-500 text-white ring-2 ring-pink-400/40 shadow-[0_0_15px_rgba(244,114,182,0.4)]'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
                title="Bật/tắt tự động phát audio khi chuyển câu hỏi (Mặc định tắt)"
              >
                <Volume2 className="w-4 h-4" />
                <span className="hidden sm:inline">Audio câu hỏi: {isQuestionAudioEnabled ? 'Bật' : 'Tắt'}</span>
              </button>

              {/* Manual Play Question Audio Button if current question has audioUrl */}
              {currentQ.audioUrl && (
                <button
                  onClick={handlePlayCurrentQuestionAudio}
                  className="px-2.5 py-1.5 md:px-3 md:py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-md cursor-pointer animate-pulse"
                  title="Nghe audio câu hỏi này ngay"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Nghe Audio Câu</span>
                </button>
              )}

              {/* Previous Question Button (Teacher Control Mode) */}
              {!isExamMode && session.currentQuestionIndex > 0 && (
                <button
                  onClick={handlePrevQuestion}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 md:px-3 md:py-2 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl font-bold text-xs md:text-sm flex items-center gap-1 transition-all border border-white/15 cursor-pointer active:scale-95"
                  title="Quay lại câu trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden lg:inline">Câu trước</span>
                </button>
              )}

              {/* Question Open/Closed for Students (GV toàn quyền mở/đóng câu hỏi) */}
              <button
                onClick={handleToggleQuestionOpen}
                className={`px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl font-black text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
                  session.isQuestionOpen !== false
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                    : 'bg-rose-500 hover:bg-rose-400 text-white ring-2 ring-rose-400/60 shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse'
                }`}
                title={session.isQuestionOpen !== false ? "Câu hỏi đang mở trên thiết bị học sinh. Bấm để tạm đóng / chuyển HS về phòng chờ" : "Bấm để mở câu hỏi này trên máy tất cả học sinh"}
              >
                {session.isQuestionOpen !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>{session.isQuestionOpen !== false ? 'Đang mở cho HS' : '🔒 Đang đóng (Bấm mở)'}</span>
              </button>

              {/* Reveal Answer Button (Only in Teacher Mode - Hidden in Exam Mode) */}
              {!isExamMode && (
                <button
                  onClick={toggleShowAnswer}
                  className={`px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
                    showAnswer 
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-400/40' 
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 ring-2 ring-cyan-500/40'
                  }`}
                  title="Mở hoặc ẩn đáp án câu hỏi"
                >
                  {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showAnswer ? 'Ẩn đáp án' : 'Hiện đáp án'}</span>
                </button>
              )}

              {/* Explanation Button (Only in Teacher Mode when question has explanation) */}
              {!isExamMode && currentQ.explanation && (
                <button
                  onClick={toggleShowExplanation}
                  className={`px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
                    showExplanation 
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 ring-2 ring-emerald-400/40' 
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                  }`}
                  title="Chiếu giải thích chi tiết câu hỏi cho cả lớp"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">{showExplanation ? 'Ẩn giải thích' : 'Giải thích'}</span>
                </button>
              )}

              {/* Teacher Broadcast Announcement Button */}
              <button
                onClick={() => {
                  gameAudio.playClick();
                  setShowAnnouncementModal(true);
                }}
                className={`px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
                  session.announcement?.message
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40'
                }`}
                title="Phát thông báo hoặc lời nhắc đến tất cả thiết bị học sinh"
              >
                <Megaphone className="w-4 h-4" />
                <span className="hidden sm:inline">{session.announcement?.message ? 'Đang phát TB' : 'Thông báo'}</span>
              </button>

              {/* Next question (Always available for teacher) */}
              <button
                onClick={handleNextQuestion}
                className="px-2.5 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-95 cursor-pointer"
              >
                <span>{session.currentQuestionIndex < quiz.questions.length - 1 ? 'Câu tiếp' : 'Tổng kết'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Timer Countdown Display */}
              <div 
                onClick={() => {
                  gameAudio.playClick();
                  setIsTimerPaused(!isTimerPaused);
                }}
                className={`flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2.5 py-1 md:px-4 md:py-1.5 rounded-xl font-black text-base sm:text-lg md:text-2xl border-2 cursor-pointer transition-all ${
                  timeLeft <= 5 
                    ? 'bg-rose-500/30 text-rose-400 border-rose-500 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.6)]' 
                    : 'bg-slate-900/80 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(0,217,255,0.2)]'
                }`}
                title="Nhấn để tạm dừng / tiếp tục đếm giờ"
              >
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                <span className="w-6 sm:w-7 md:w-9 text-center font-mono font-black">{timeLeft}</span>
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 sm:p-2 md:p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/15 transition-all"
                title="Toàn màn hình máy chiếu"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>

              {/* End Game & Return Home Button (GV kết thúc game về trang chủ toàn bộ người chơi dừng theo) */}
              <button
                onClick={handleEndGameToHome}
                className="px-2.5 py-1.5 md:px-3 md:py-2 bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 hover:text-white rounded-xl border border-rose-400/40 transition-all flex items-center gap-1.5 font-bold text-xs md:text-sm cursor-pointer shadow-md active:scale-95"
                title="Kết thúc game và về trang chủ (toàn bộ học sinh cũng sẽ dừng theo)"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Kết thúc</span>
              </button>
            </div>
          </div>

          {/* Auto Next Countdown Banner (Only in Teacher Mode if manually triggered, completely hidden in Exam Mode) */}
          {!isExamMode && autoNextCountdown !== null && (
            <div className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-slate-950 px-4 py-1.5 flex items-center justify-between text-xs md:text-sm font-black animate-in slide-in-from-top-2 duration-300 shadow-[0_0_25px_rgba(0,217,255,0.6)]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 fill-current animate-spin" />
                <span>Đang hiển thị kết quả đáp án...</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span>Chuyển câu tiếp theo sau:</span>
                <span className="px-2 py-0.5 bg-slate-950 text-cyan-300 rounded-md font-black text-sm">
                  {autoNextCountdown}s
                </span>
              </div>
            </div>
          )}

          {/* Question Closed Notice Banner */}
          {session.isQuestionOpen !== true && (
            <div className="bg-gradient-to-r from-amber-500 via-rose-600 to-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-xs md:text-sm font-black shadow-[0_0_25px_rgba(244,63,94,0.6)] z-20 border-b-2 border-white/20">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 animate-bounce text-yellow-200" />
                <span>Câu hỏi số {session.currentQuestionIndex + 1} đang KHÓA (Học sinh đang ở phòng chờ). Bấm nút để MỞ CÂU HỎI hiển thị đồng loạt lên toàn bộ thiết bị người chơi!</span>
              </div>
              <button
                onClick={handleToggleQuestionOpen}
                className="px-4 py-1.5 bg-white hover:bg-yellow-300 text-slate-950 rounded-xl text-xs sm:text-sm font-black cursor-pointer shadow-lg flex items-center gap-1.5 flex-shrink-0 transition-all hover:scale-105"
              >
                <Eye className="w-4 h-4 text-emerald-600" />
                <span>MỞ CÂU HỎI CHO CẢ LỚP ➔</span>
              </button>
            </div>
          )}

          {/* Main Question & Leaderboard Row */}
          <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
            
            {/* Live Broadcast Announcement Toast if any */}
            {session.announcement?.message && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 max-w-2xl px-4 py-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 rounded-2xl shadow-[0_0_35px_rgba(251,191,36,0.6)] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-between gap-3 animate-in slide-in-from-top-3 duration-300 border-2 border-white">
                <div className="flex items-center gap-2 min-w-0">
                  <Megaphone className="w-4 h-4 text-slate-950 animate-bounce flex-shrink-0" />
                  <span className="truncate"><strong>Đang phát tới HS:</strong> {session.announcement.message}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowAnnouncementModal(true)}
                    className="px-2 py-0.5 rounded-lg bg-slate-950/20 hover:bg-slate-950/30 text-slate-950 font-bold text-[11px] cursor-pointer"
                  >
                    Đổi lời nhắn
                  </button>
                  <button
                    onClick={handleClearAnnouncement}
                    className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                    title="Thu hồi thông báo"
                  >
                    Tắt
                  </button>
                </div>
              </div>
            )}

            {/* Main Question & Answer Area - Balanced 16:9 layout bringing question & options close together */}
            <div className="flex-1 min-h-0 px-3 sm:px-6 md:px-8 py-3 sm:py-5 flex flex-col justify-center items-center overflow-y-auto">
              <div className="w-full max-w-6xl flex flex-col justify-center gap-3 sm:gap-3.5 md:gap-4 my-auto">
                {/* Centered Small Eye-Catching Question Number Pill (Đưa số câu ra giữa, trên câu dẫn, nhỏ, điểm nhấn) */}
                <div className="flex items-center justify-center">
                  <div className="inline-flex items-center gap-2.5 px-4 py-1 rounded-full bg-slate-900/90 border border-cyan-400/60 shadow-[0_0_20px_rgba(0,217,255,0.35)] backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-xs sm:text-sm font-black tracking-widest text-cyan-200 uppercase font-mono">
                      CÂU {session.currentQuestionIndex + 1} / {quiz.questions.length}
                    </span>
                    <span className="text-slate-500 text-xs">•</span>
                    <span className="text-xs sm:text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                      {isMC ? 'TRẮC NGHIỆM' : isTF ? 'ĐÚNG - SAI' : 'TRẢ LỜI NGẮN'}
                    </span>
                  </div>
                </div>

                {/* Question Text Box with Glassmorphism + Neon Aura */}
                <div className="space-y-3">
                  <div className="relative rounded-2xl md:rounded-3xl border-2 border-cyan-400/90 bg-slate-950/90 p-5 sm:p-6 md:p-8 shadow-[0_0_35px_rgba(0,217,255,0.3)] backdrop-blur-xl">
                    <div 
                      id="question-content" 
                      className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-[2.5rem] font-black text-white leading-snug tracking-tight whitespace-pre-wrap drop-shadow-lg text-center sm:text-left"
                    >
                      {currentQ.content}
                    </div>
                  </div>

                  {/* Official Answer Banner when Revealed (NEVER shown in Exam Mode) */}
                  {!isExamMode && showAnswer && isTF && (
                    <div 
                      id="revealed-answer-box" 
                      className="p-3 md:p-5 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-emerald-500/20 border-2 border-yellow-400 rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.35)] animate-in fade-in zoom-in-95 duration-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-yellow-400 text-slate-950 font-black rounded-lg text-xs uppercase shadow-md">
                            ĐÁP ÁN CHÍNH THỨC
                          </span>
                          <span className="font-mono text-xl md:text-3xl font-black text-yellow-300 tracking-wider">
                            {formatTFAnswer(currentQ.answer, session.currentQuestionIndex + 1)}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-300">
                          Mỗi ý đúng: 0.25 điểm • Đạt tối đa: 1.0 điểm
                        </span>
                      </div>
                    </div>
                  )}

                  {!isExamMode && showAnswer && (isSA || isMC) && (
                    <div 
                      id="revealed-answer-box" 
                      className="p-3 md:p-5 bg-emerald-500/20 border-2 border-emerald-400 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.35)] animate-in fade-in zoom-in-95 duration-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-7 h-7 md:w-8 md:h-8 text-emerald-400 flex-shrink-0" />
                        <div>
                          <span className="text-[11px] font-bold uppercase text-emerald-300 tracking-wider">
                            ĐÁP ÁN ĐÚNG
                          </span>
                          <div className="text-lg md:text-3xl font-black text-white font-mono">
                            {isMC ? `LỰA CHỌN ${currentQ.answer}` : currentQ.answer}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detailed Explanation Banner (Teacher Control Mode) */}
                  {!isExamMode && showExplanation && currentQ.explanation && (
                    <div 
                      id="revealed-explanation-box" 
                      className="p-3 sm:p-4 md:p-5 bg-gradient-to-r from-emerald-950/80 via-teal-950/70 to-slate-950/90 border-2 border-emerald-400 rounded-2xl shadow-[0_0_35px_rgba(52,211,153,0.3)] animate-in fade-in zoom-in-95 duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center flex-shrink-0 text-emerald-300">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                              GIẢI THÍCH CHI TIẾT CÂU {session.currentQuestionIndex + 1}
                            </span>
                            <button
                              onClick={() => setShowExplanation(false)}
                              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                              title="Ẩn giải thích"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-white text-xs sm:text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">
                            {currentQ.explanation}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4 Large Options for Multiple Choice (MC) - Adaptive for 16:9 & 9:16 */}
                {isMC && currentQ.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                    {currentQ.options.map((opt, i) => {
                      const letter = ['A', 'B', 'C', 'D'][i];
                      const isCorrect = !isExamMode && showAnswer && (currentQ.answer === letter || opt.trim().toLowerCase() === (currentQ.answer || '').trim().toLowerCase());
                      const isOther = !isExamMode && showAnswer && !isCorrect;

                      const neonColors = [
                        { border: 'border-cyan-500/50', badge: 'bg-cyan-400 text-slate-950', hover: 'hover:border-cyan-300 hover:shadow-[0_0_25px_rgba(0,217,255,0.35)]' },
                        { border: 'border-purple-500/50', badge: 'bg-purple-400 text-slate-950', hover: 'hover:border-purple-300 hover:shadow-[0_0_25px_rgba(139,92,246,0.35)]' },
                        { border: 'border-pink-500/50', badge: 'bg-pink-400 text-slate-950', hover: 'hover:border-pink-300 hover:shadow-[0_0_25px_rgba(244,114,182,0.35)]' },
                        { border: 'border-emerald-500/50', badge: 'bg-emerald-400 text-slate-950', hover: 'hover:border-emerald-300 hover:shadow-[0_0_25px_rgba(34,197,94,0.35)]' },
                      ];
                      const color = neonColors[i] || neonColors[0];

                      return (
                        <div 
                          key={i} 
                          className={`rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 border-2 transition-all flex items-center gap-3.5 sm:gap-4 md:gap-5 shadow-xl relative overflow-hidden backdrop-blur-md ${
                            isCorrect 
                              ? 'bg-gradient-to-r from-emerald-600/90 to-green-700/90 border-yellow-300 ring-4 ring-yellow-300/60 scale-[1.02] shadow-[0_0_40px_rgba(34,197,94,0.6)] z-10' 
                              : isOther 
                              ? 'bg-slate-950/40 border-white/5 opacity-30 grayscale-[50%]' 
                              : `bg-slate-900/90 ${color.border} ${color.hover}`
                          }`}
                        >
                          {/* Letter badge */}
                          <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center font-black text-2xl sm:text-3xl md:text-4xl flex-shrink-0 shadow-lg ${
                            isCorrect ? 'bg-yellow-300 text-slate-950' : color.badge
                          }`}>
                            {letter}
                          </div>

                          {/* Option text */}
                          <div className="flex-1 text-base sm:text-lg md:text-2xl lg:text-[1.65rem] font-bold leading-snug text-white">
                            {opt}
                          </div>

                          {/* Correct tag (Only in teacher mode when answer shown) */}
                          {isCorrect && (
                            <div className="flex-shrink-0 px-3 py-1.5 bg-yellow-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> ĐÚNG
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* True - False (TF) Statements */}
                {isTF && currentQ.options && (
                  <div className="space-y-2.5 sm:space-y-3">
                    {currentQ.options.map((opt, i) => {
                      const letter = ['a', 'b', 'c', 'd'][i];
                      const correctVal = tfCorrectList[i] ? normalizeTFChar(tfCorrectList[i]) : 'Đ';
                      const isTrue = correctVal === 'Đ';
                      const showTFAnswer = !isExamMode && showAnswer;

                      return (
                        <div 
                          key={i} 
                          className={`rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 border-2 transition-all flex items-center justify-between gap-3 sm:gap-4 shadow-md backdrop-blur-md ${
                            showTFAnswer 
                              ? isTrue 
                                ? 'bg-emerald-950/70 border-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
                                : 'bg-rose-950/70 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                              : 'bg-slate-900/90 border-slate-700/80 hover:border-cyan-500/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 flex-1">
                            <span className={`w-10 h-10 sm:w-11 sm:h-11 md:w-13 md:h-13 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl md:text-2xl flex-shrink-0 shadow-md ${
                              showTFAnswer 
                                ? isTrue 
                                  ? 'bg-emerald-500 text-slate-950' 
                                  : 'bg-rose-500 text-white' 
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            }`}>
                              {letter}
                            </span>
                            <span className="text-base sm:text-lg md:text-2xl font-bold text-white leading-snug">
                              {opt}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {showTFAnswer ? (
                              <div className={`px-3 py-1 sm:px-4 sm:py-1.5 md:px-5 md:py-2 rounded-xl font-black text-xs sm:text-sm md:text-lg uppercase tracking-wider shadow-lg flex items-center gap-1.5 ${
                                isTrue 
                                  ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/40' 
                                  : 'bg-rose-600 text-white ring-2 ring-rose-500/40'
                              }`}>
                                {isTrue ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : <XCircle className="w-4 h-4 md:w-5 md:h-5" />}
                                <span>{letter}) {correctVal} ({isTrue ? 'ĐÚNG' : 'SAI'})</span>
                              </div>
                            ) : (
                              <div className="flex gap-1.5 sm:gap-2">
                                <span className="px-3 py-1 sm:px-3.5 sm:py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm font-bold text-slate-300">
                                  Đúng
                                </span>
                                <span className="px-3 py-1 sm:px-3.5 sm:py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm font-bold text-slate-300">
                                  Sai
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Short Answer / Essay (SA) */}
                {isSA && (
                  <div className="p-6 sm:p-8 md:p-10 bg-slate-950/70 border-2 border-dashed border-cyan-500/40 rounded-3xl text-center">
                    <p className="text-slate-100 text-base sm:text-lg md:text-2xl font-bold">
                      Học sinh đang nhập câu trả lời trực tiếp trên thiết bị cá nhân...
                    </p>
                    {!isExamMode && !showAnswer && (
                      <p className="text-cyan-400 text-sm md:text-base font-bold mt-2.5">
                        Nhấn "Hiện đáp án" ở góc trên để chiếu đáp án mẫu cho cả lớp.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

          {/* Right Top 16 Leaderboard Column - Real-time during game */}
          <div className="w-56 sm:w-64 md:w-72 lg:w-80 flex-shrink-0 bg-slate-950/90 border-l border-cyan-500/30 flex flex-col overflow-hidden backdrop-blur-md">
            <div className="p-3 border-b border-cyan-500/30 bg-slate-900/90 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider">
                    TOP 18 (EXP)
                  </h3>
                  <p className="text-[10px] text-slate-400">Xếp theo điểm EXP</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-mono font-bold text-xs">
                {top18Players.length} HS
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              {top18Players.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs italic">
                  Chưa có EXP ghi nhận
                </div>
              ) : (
                top18Players.map((p, idx) => {
                  const isTop3 = idx < 3;
                  const rankColors = [
                    'bg-amber-400 text-slate-950 ring-2 ring-amber-300',
                    'bg-slate-300 text-slate-950 ring-2 ring-white',
                    'bg-amber-700 text-white ring-2 ring-amber-600'
                  ];
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                        isTop3
                          ? 'bg-slate-900/90 border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.1)]'
                          : 'bg-slate-900/50 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] flex-shrink-0 ${
                            isTop3 ? rankColors[idx] : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {p.name}
                        </span>
                      </div>
                      <span className="font-mono font-black text-xs text-amber-300 ml-2 flex-shrink-0">
                        {p.exp ?? 0} EXP
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

          {/* Bottom Live Submission Ticker */}
          <div className="h-10 sm:h-11 bg-slate-950/80 border-t border-cyan-500/20 px-4 sm:px-6 flex items-center justify-between text-[11px] sm:text-xs text-slate-400 flex-shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Chiến binh: <strong className="text-white font-mono">{players.length}</strong></span>
              </div>
              <span className="text-white/20">•</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Đã nộp câu này: <strong className="text-emerald-300 font-mono">{answeredCount}</strong> / {players.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <span>Phòng: <strong className="text-cyan-300 font-mono font-bold">{session.id.slice(-6).toUpperCase()}</strong></span>
              <span className="hidden sm:inline">{isExamMode ? 'Chế độ: Kiểm tra Tự động' : 'Chế độ: GV Điều khiển'} • Tự động xếp hạng</span>
            </div>
          </div>
        </div>

        {/* TOP 5 POPUP MODAL */}
        {showTop5Modal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
            <div className="w-full max-w-3xl glass-neon-card-glow border-2 border-amber-400/80 rounded-[2rem] shadow-[0_0_80px_rgba(251,191,36,0.3)] p-6 md:p-8 flex flex-col gap-5 relative">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 px-4 py-1 bg-yellow-400/20 border border-yellow-400/40 rounded-full text-yellow-300 font-black text-xs uppercase tracking-widest">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  TOP 5 CHIẾN BINH DẪN ĐẦU
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white">
                  Xếp Hạng Sau Câu {session.currentQuestionIndex + 1} / {quiz.questions.length}
                </h2>
              </div>

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {top5Players.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 italic text-sm">
                    Chưa có học sinh nào nộp câu trả lời...
                  </div>
                ) : (
                  top5Players.map((p, idx) => {
                    const isFirst = idx === 0;
                    const correct = p.correctCount ?? 0;
                    const score = Number((p.score ?? 0).toFixed(2));
                    const time = p.totalTimeSpent ?? 0;
                    const titleInfo = getPlayerTitle(idx + 1, players.length);

                    return (
                      <div
                        key={p.id || idx}
                        className={`p-3.5 md:p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                          isFirst
                            ? 'bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-slate-900 border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.25)]'
                            : 'bg-slate-900/80 border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-md ${
                            isFirst ? 'bg-yellow-400 text-slate-950' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          }`}>
                            {isFirst ? '🥇 1' : `#${idx + 1}`}
                          </div>
                          <div>
                            <h4 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                              {p.name}
                              {isFirst && <span className="text-yellow-400 text-xs">👑 Dẫn đầu</span>}
                            </h4>
                            <span className="text-[11px] text-cyan-300 font-semibold">
                              {titleInfo.title}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-right font-mono">
                          <div className="text-center bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-emerald-400 block">Đúng</span>
                            <span className="text-sm font-black text-emerald-300">{correct} câu</span>
                          </div>
                          <div className="text-center bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-amber-400 block">EXP</span>
                            <span className="text-sm font-black text-amber-300">⚡ {p.exp ?? 0}</span>
                          </div>
                          <div className="text-center bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-cyan-400 block">Thời gian</span>
                            <span className="text-sm font-bold text-cyan-300">{time}s</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <button
                  onClick={() => setShowTop5Modal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    setShowTop5Modal(false);
                    handleNextQuestion();
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>{session.currentQuestionIndex < quiz.questions.length - 1 ? 'Sang câu tiếp' : 'Xem tổng kết'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TEACHER QUESTION PICKER MODAL */}
        {showQuestionPicker && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
            <div className="w-full max-w-4xl max-h-[90vh] glass-neon-card-glow border-2 border-purple-500/80 rounded-[2rem] shadow-[0_0_80px_rgba(168,85,247,0.35)] p-5 md:p-7 flex flex-col gap-4 relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400 flex items-center justify-center text-purple-300">
                    <ListFilter className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-white">
                      DANH SÁCH CÂU HỎI TRONG ĐỀ
                    </h3>
                    <p className="text-slate-400 text-xs">
                      Chế độ GV Điều khiển: Chọn nhanh câu hỏi bất kỳ để chiếu lên bảng
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQuestionPicker(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Question Grid */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[60vh]">
                {quiz.questions.map((q, idx) => {
                  const isCurrent = idx === session.currentQuestionIndex;
                  const qStation = getStationForQuestion(idx, quiz.questions.length);

                  return (
                    <div
                      key={q.id || idx}
                      onClick={() => handleJumpToQuestion(idx)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-gradient-to-r from-purple-600/30 via-cyan-500/20 to-slate-900 border-purple-400 ring-2 ring-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                          : 'bg-slate-900/70 border-white/10 hover:border-purple-400/40 hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center font-black text-sm md:text-base flex-shrink-0 shadow-md ${
                          isCurrent 
                            ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' 
                            : 'bg-slate-800 text-slate-300 border border-white/10'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-slate-300 uppercase">
                              {q.type === 'MC' ? 'Trắc nghiệm' : q.type === 'TF' ? 'Đúng-Sai' : 'Điền khuyết'}
                            </span>
                            <span className="text-[10px] text-slate-400 hidden sm:inline">
                              Trạm: {qStation.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 animate-pulse">
                                ĐANG CHIẾU
                              </span>
                            )}
                          </div>
                          <p className="text-white text-xs sm:text-sm font-medium line-clamp-1">
                            {q.content}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {q.explanation && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                            <BookOpen className="w-3 h-3" /> Có giải thích
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJumpToQuestion(idx);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            isCurrent
                              ? 'bg-purple-500 text-white shadow-md'
                              : 'bg-white/10 hover:bg-purple-500 hover:text-white text-slate-200'
                          }`}
                        >
                          {isCurrent ? 'Đang chọn' : 'Chiếu câu này'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-xs text-slate-400 font-semibold">
                  Tổng số: <strong className="text-purple-300 font-mono">{quiz.questions.length}</strong> câu hỏi
                </span>
                <button
                  onClick={() => setShowQuestionPicker(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {renderAnnouncementModal()}
        {renderTtsVoiceModal()}
      </CyberSpaceBackground>
    );
  }

  // ==========================================
  // 3. FINISHED SCREEN - LEADERBOARD & PODIUM
  // ==========================================
  const totalStudents = players.length;
  const totalQ = quiz.questions.length;
  const avgExp = totalStudents > 0 ? Math.round(players.reduce((a, b) => a + (b.exp || 0), 0) / totalStudents) : 0;
  const avgCorrect = totalStudents > 0 ? players.reduce((a, b) => a + (b.correctCount || 0), 0) / totalStudents : 0;
  const fastestPlayer = rankedPlayers.length > 0 
    ? [...rankedPlayers].sort((a, b) => (a.totalTimeSpent ?? 99999) - (b.totalTimeSpent ?? 99999))[0]
    : null;

  return (
    <CyberSpaceBackground stationColor="#FACC15" className="p-3 sm:p-5 md:p-8 flex flex-col justify-between select-none">
      {/* Sheets Notice */}
      {sheetsNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 p-4 rounded-3xl shadow-[0_0_50px_rgba(20,184,166,0.8)] border-2 border-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-6 duration-300">
          <div className="flex items-center gap-3">
            <Cloud className="w-8 h-8 text-slate-950 animate-bounce flex-shrink-0" />
            <div className="text-xs sm:text-sm font-black text-slate-950">{sheetsNotice}</div>
          </div>
          <button
            onClick={() => setSheetsNotice(null)}
            className="px-3 py-1 bg-slate-950/20 hover:bg-slate-950/30 rounded-xl text-xs font-black cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Grand Confetti & Fireworks celebration effect */}
      <ConfettiEffect key={confettiKey} duration={9000} particleCount={160} />

      <div className="w-full max-w-[177.78vh] mx-auto space-y-5">
        
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 glass-neon-card-glow rounded-3xl p-5 md:p-6 shadow-[0_0_50px_rgba(250,204,21,0.25)]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-yellow-400/20 border-2 border-yellow-400 flex items-center justify-center flex-shrink-0 shadow-[0_0_30px_rgba(250,204,21,0.4)]">
              <Trophy className="w-8 h-8 text-yellow-400 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-black uppercase mb-1">
                <Sparkles className="w-3.5 h-3.5" /> MISSION COMPLETE • HOÀN THÀNH NHIỆM VỤ
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {summaryTab === 'LEADERBOARD' ? 'BẢNG VINH DANH CHUNG CUỘC' : 'BẢNG ĐÁP ÁN TOÀN BỘ ĐỀ THI'}
              </h1>
              <p className="text-slate-300 text-xs md:text-sm">
                {quiz.title} • {totalStudents} học sinh tham gia • {totalQ} câu hỏi
              </p>
            </div>
          </div>

          {/* View Switchers and Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Replay Confetti Button */}
            <button
              onClick={() => {
                gameAudio.playVictory();
                setConfettiKey(prev => prev + 1);
              }}
              className="px-3.5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white rounded-2xl font-black text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(244,63,94,0.4)] active:scale-95"
              title="Bắn pháo hoa & tung bông giấy chúc mừng"
            >
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Bắn pháo hoa 🎉</span>
            </button>

            {/* Chuyển sang Vòng 2 Button (Nút nhấn chuyển vòng 2 ở bảng vinh danh chung cuộc) */}
            <button
              onClick={handleSwitchToRound2}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:via-teal-300 hover:to-cyan-300 text-slate-950 font-black text-xs md:text-sm rounded-2xl flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.7)] cursor-pointer active:scale-95 border-2 border-emerald-200 btn-modern-shine btn-modern-glow animate-pulse"
              title="Chuyển sang Vòng 2: Tranh tài sản phẩm môi trường & Chấm điểm Ban Giám Khảo GK01-GK05"
            >
              <Sparkles className="w-4 h-4 fill-slate-950 animate-spin" />
              <span>🏆 CHUYỂN VÒNG 2 (SẢN PHẨM) ➔</span>
            </button>

            {/* Round 2 Group Shuffle Button */}
            <button
              onClick={() => {
                gameAudio.playVictory();
                setShowRound2Modal(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-xs md:text-sm rounded-2xl flex items-center gap-2 shadow-[0_0_25px_rgba(251,191,36,0.6)] cursor-pointer active:scale-95 border-2 border-yellow-200 btn-modern-shine btn-modern-glow"
              title="Chia ngẫu nhiên Top 18 học sinh điểm EXP cao nhất vào 6 nhóm Vòng 2"
            >
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>🎲 XÁO TRỘN 6 NHÓM VÒNG 2 (TOP 18)</span>
            </button>

            <button
              onClick={() => {
                gameAudio.playClick();
                setSummaryTab('LEADERBOARD');
              }}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                summaryTab === 'LEADERBOARD'
                  ? 'bg-yellow-400 text-slate-950 ring-4 ring-yellow-400/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Bảng xếp hạng ({totalStudents} HS)</span>
            </button>

            <button
              onClick={() => {
                gameAudio.playClick();
                setSummaryTab('ANSWERS');
              }}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                summaryTab === 'ANSWERS'
                  ? 'bg-cyan-400 text-slate-950 ring-4 ring-cyan-400/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Đáp án 5 cột</span>
            </button>

            <button
              onClick={() => {
                gameAudio.playClick();
                exportLeaderboardExcel(quiz.title, rankedPlayers, totalQ);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold text-xs md:text-sm flex items-center gap-2 transition-colors border border-emerald-400/40 shadow-lg cursor-pointer"
              title="Xuất bảng điểm Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Xuất Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => {
                gameAudio.playClick();
                handleExportGoogleSheets();
              }}
              disabled={isExportingSheets}
              className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-2xl font-bold text-xs md:text-sm flex items-center gap-2 transition-colors border border-teal-400/40 shadow-lg cursor-pointer disabled:opacity-50"
              title="Xuất bảng điểm lên Google Sheets trực tuyến"
            >
              {isExportingSheets ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Cloud className="w-4 h-4 text-cyan-200" />}
              <span className="hidden sm:inline">{isExportingSheets ? 'Đang xuất Sheets...' : 'Lưu Google Sheets'}</span>
            </button>

            {/* Teacher Announcement Button in Finished Screen */}
            <button
              onClick={() => {
                gameAudio.playClick();
                setShowAnnouncementModal(true);
              }}
              className={`px-3.5 py-2.5 rounded-2xl font-black text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 border ${
                session.announcement?.message
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/40'
              }`}
              title="Phát thông báo hoặc gửi lời dặn dò chung cuộc đến học sinh"
            >
              <Megaphone className="w-4 h-4" />
              <span className="hidden sm:inline">{session.announcement?.message ? 'Đang phát TB' : 'Thông báo lớp'}</span>
            </button>

            {/* Atomic Planetary Clock Button (5 phút) */}
            <button
              onClick={() => {
                gameAudio.playClick();
                setShowAtomicClock(true);
              }}
              className="px-3 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all border border-cyan-400/40 shadow-[0_0_15px_rgba(56,189,248,0.25)]"
              title="Mở đồng hồ đếm ngược hành tinh nguyên tử (Mặc định 5 phút)"
            >
              <Atom className="w-4 h-4 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="hidden sm:inline">Đồng hồ 5p</span>
            </button>

            {/* Seating Arrangement Button (30 HS) */}
            <button
              onClick={() => {
                gameAudio.playClick();
                setShowSeatingModal(true);
              }}
              className="px-3 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all border border-indigo-400/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]"
              title="Xem sơ đồ xếp chỗ phòng thi (6 dãy x 5 HS = 30 chỗ)"
            >
              <Users className="w-4 h-4 text-indigo-300" />
              <span className="hidden sm:inline">Xếp chỗ (30)</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold border border-white/10 transition-colors"
              title="Toàn màn hình máy chiếu"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            <Link
              to="/admin"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs md:text-sm flex items-center gap-2 transition-colors border border-white/10"
            >
              <Home className="w-4 h-4" /> Quản trị
            </Link>

            <button
              onClick={handleEndGameToHome}
              className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 hover:text-white rounded-2xl font-black text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 border border-rose-400/50"
              title="Đóng game và về trang chủ để chuẩn bị game mới (toàn bộ học sinh sẽ dừng game để vào game mới)"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Về trang chủ • Đóng game</span>
            </button>
          </div>
        </div>

        {/* TAB 1: LEADERBOARD PODIUM & RANKINGS */}
        {summaryTab === 'LEADERBOARD' && (
          <div className="space-y-5">
            {/* Round 2 Callout Banner */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border-2 border-emerald-400/80 shadow-[0_0_40px_rgba(16,185,129,0.3)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-400/25 border-2 border-emerald-400 flex items-center justify-center text-2xl flex-shrink-0 animate-bounce shadow-md">
                  🌱
                </div>
                <div className="text-left">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 fill-current" /> GIAI ĐOẠN 2 SẴN SÀNG: TỪ DĨA ĂN SẠCH ĐẾN THÀNH PHỐ SẠCH
                  </div>
                  <div className="text-base sm:text-lg font-black text-white">
                    Vòng 2: Tranh tài sản phẩm môi trường của 6 nhóm thi đấu (Top 18 EXP)
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Học sinh nộp bài từ máy tính/điện thoại • Máy chiếu nhận bài và phát thông báo âm thanh • Giám khảo chấm 6 nhóm theo thời gian thực • 3 nhóm điểm cao nhất vào vòng tiếp theo
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 flex-shrink-0 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    gameAudio.playVictory();
                    setShowRound2Modal(true);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-white/20 cursor-pointer transition-all"
                >
                  🎲 Xáo nhóm (Top 18)
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToRound2}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center gap-2 cursor-pointer active:scale-95 transition-all btn-modern-shine btn-modern-glow"
                >
                  <span>CHUYỂN VÒNG 2 NGAY ➔</span>
                </button>
              </div>
            </div>

            {/* TOP 3 PODIUM */}
            {rankedPlayers.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* Rank 2 - Á Quân */}
                {rankedPlayers[1] ? (
                  <div className="order-2 md:order-1 p-5 rounded-3xl bg-slate-900/80 border-2 border-cyan-400/60 flex flex-col items-center text-center shadow-[0_0_30px_rgba(0,217,255,0.2)] relative">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-300 text-slate-950 font-black text-2xl flex items-center justify-center mb-2 shadow-lg">
                      🥈
                    </div>
                    <span className="px-3 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 text-[11px] font-black uppercase tracking-wider mb-1">
                      CHIẾN BINH KHOA HỌC (HẠNG 2)
                    </span>
                    <h3 className="text-xl md:text-2xl font-black text-white truncate max-w-full">
                      {rankedPlayers[1].name}
                    </h3>
                    {rankedPlayers[1].className && (
                      <span className="px-2 py-0.5 mt-1 bg-white/10 text-cyan-300 rounded-md text-xs font-bold">
                        {rankedPlayers[1].className}
                      </span>
                    )}
                    <div className="mt-2 text-center">
                      <span className="text-amber-300 font-mono font-black text-xl flex items-center justify-center gap-1 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]">
                        ⚡ {rankedPlayers[1].exp ?? 0} EXP
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-3 text-xs font-semibold text-slate-300">
                      <span className="text-emerald-400 font-bold">{rankedPlayers[1].correctCount || 0} câu đúng</span>
                      <span className="text-slate-400 font-mono">{rankedPlayers[1].totalTimeSpent || 0}s</span>
                    </div>
                  </div>
                ) : <div className="hidden md:block order-1" />}

                {/* Rank 1 - Quán Quân */}
                {rankedPlayers[0] && (
                  <div className="order-1 md:order-2 p-6 md:p-7 rounded-[2.5rem] bg-gradient-to-b from-yellow-500/20 via-amber-500/10 to-slate-950 border-2 border-yellow-400 flex flex-col items-center text-center shadow-[0_0_60px_rgba(250,204,21,0.45)] ring-4 ring-yellow-400/30 relative">
                    <div className="w-18 h-18 rounded-3xl bg-gradient-to-br from-yellow-300 to-amber-500 text-slate-950 font-black text-3xl flex items-center justify-center mb-2 shadow-[0_0_30px_rgba(250,204,21,0.6)] animate-bounce">
                      👑
                    </div>
                    <span className="px-4 py-1 rounded-full bg-yellow-400 text-slate-950 text-xs font-black uppercase tracking-wider mb-1 shadow-md">
                      NGƯỜI DẪN ĐẦU (QUÁN QUÂN)
                    </span>
                    <h3 className="text-2xl md:text-3xl font-black text-yellow-300 truncate max-w-full">
                      {rankedPlayers[0].name}
                    </h3>
                    {rankedPlayers[0].className && (
                      <span className="px-2.5 py-0.5 mt-1 bg-yellow-400/20 text-yellow-200 border border-yellow-400/40 rounded-md text-xs font-bold">
                        {rankedPlayers[0].className}
                      </span>
                    )}
                    <div className="mt-2.5 text-center">
                      <span className="text-amber-300 font-mono font-black text-2xl md:text-3xl flex items-center justify-center gap-1.5 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]">
                        ⚡ {rankedPlayers[0].exp ?? 0} EXP
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-4 text-sm font-semibold">
                      <span className="text-emerald-400 font-black">{rankedPlayers[0].correctCount || 0} / {totalQ} câu đúng</span>
                      <span className="text-cyan-300 font-mono font-bold">{rankedPlayers[0].totalTimeSpent || 0}s</span>
                    </div>
                  </div>
                )}

                {/* Rank 3 - Quý Quân */}
                {rankedPlayers[2] ? (
                  <div className="order-3 p-5 rounded-3xl bg-slate-900/80 border-2 border-purple-400/60 flex flex-col items-center text-center shadow-[0_0_30px_rgba(139,92,246,0.2)] relative">
                    <div className="w-14 h-14 rounded-2xl bg-purple-400 text-slate-950 font-black text-2xl flex items-center justify-center mb-2 shadow-lg">
                      🥉
                    </div>
                    <span className="px-3 py-0.5 rounded-full bg-purple-400/20 text-purple-300 text-[11px] font-black uppercase tracking-wider mb-1">
                      NHÀ KHÁM PHÁ (HẠNG 3)
                    </span>
                    <h3 className="text-xl md:text-2xl font-black text-white truncate max-w-full">
                      {rankedPlayers[2].name}
                    </h3>
                    {rankedPlayers[2].className && (
                      <span className="px-2 py-0.5 mt-1 bg-white/10 text-purple-300 rounded-md text-xs font-bold">
                        {rankedPlayers[2].className}
                      </span>
                    )}
                    <div className="mt-2 text-center">
                      <span className="text-amber-300 font-mono font-black text-xl flex items-center justify-center gap-1 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]">
                        ⚡ {rankedPlayers[2].exp ?? 0} EXP
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-3 text-xs font-semibold text-slate-300">
                      <span className="text-emerald-400 font-bold">{rankedPlayers[2].correctCount || 0} câu đúng</span>
                      <span className="text-slate-400 font-mono">{rankedPlayers[2].totalTimeSpent || 0}s</span>
                    </div>
                  </div>
                ) : <div className="hidden md:block order-3" />}
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 glass-neon-card rounded-2xl">
                <span className="text-xs text-slate-400 font-bold uppercase block">Chiến binh kết nối</span>
                <span className="text-2xl font-black text-white font-mono">{totalStudents} <span className="text-sm font-sans font-normal text-slate-400">/ 100 HS</span></span>
              </div>
              <div className="p-4 glass-neon-card rounded-2xl">
                <span className="text-xs text-slate-400 font-bold uppercase block">EXP trung bình lớp</span>
                <span className="text-2xl font-black text-amber-300 font-mono">⚡ {avgExp} <span className="text-sm font-sans font-normal text-slate-400">EXP</span></span>
              </div>
              <div className="p-4 glass-neon-card rounded-2xl">
                <span className="text-xs text-slate-400 font-bold uppercase block">Số câu đúng TB</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">{avgCorrect.toFixed(1)} <span className="text-sm font-sans font-normal text-slate-400">/ {totalQ} câu</span></span>
              </div>
              <div className="p-4 glass-neon-card rounded-2xl">
                <span className="text-xs text-slate-400 font-bold uppercase block">Giải quyết nhanh nhất</span>
                <span className="text-xl font-black text-cyan-300 truncate block">
                  {fastestPlayer ? `${fastestPlayer.name} (${fastestPlayer.totalTimeSpent || 0}s)` : '---'}
                </span>
              </div>
            </div>

            {/* FULL RANKING TABLE */}
            <div className="glass-neon-card-glow rounded-3xl p-4 md:p-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span className="text-base font-black text-white">
                    BẢNG XẾP HẠNG TOÀN BỘ NGƯỜI CHƠI
                  </span>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm tên học sinh..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-cyan-500/30 rounded-xl text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-[50vh] overflow-y-auto pr-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="py-3 px-3">Hạng</th>
                      <th className="py-3 px-4">Họ và tên học sinh</th>
                      <th className="py-3 px-3 text-center text-amber-300">ĐIỂM EXP (XẾP HẠNG)</th>
                      <th className="py-3 px-3 text-center">Danh hiệu</th>
                      <th className="py-3 px-3 text-center">Số câu đúng</th>
                      <th className="py-3 px-3 text-center">Thời gian</th>
                      <th className="py-3 px-3 text-center">Tỷ lệ đúng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {filteredRankedPlayers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                          Không tìm thấy học sinh nào...
                        </td>
                      </tr>
                    ) : (
                      filteredRankedPlayers.map((p, idx) => {
                        const realRank = rankedPlayers.findIndex(orig => orig.id === p.id) + 1;
                        const isTop1 = realRank === 1;
                        const isTop2 = realRank === 2;
                        const isTop3 = realRank === 3;
                        const correct = p.correctCount ?? 0;
                        const time = p.totalTimeSpent ?? 0;
                        const pct = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
                        const titleData = getPlayerTitle(realRank, totalStudents);

                        return (
                          <tr 
                            key={p.id || idx}
                            className={`hover:bg-white/5 transition-colors ${
                              isTop1 ? 'bg-yellow-500/10 font-bold' : isTop2 ? 'bg-cyan-500/10' : isTop3 ? 'bg-purple-500/10' : ''
                            }`}
                          >
                            <td className="py-3 px-3">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                                isTop1 ? 'bg-yellow-400 text-slate-950' : isTop2 ? 'bg-cyan-300 text-slate-950' : isTop3 ? 'bg-purple-400 text-slate-950' : 'bg-white/5 border border-white/10 text-slate-400 font-mono'
                              }`}>
                                {isTop1 ? '🥇 1' : isTop2 ? '🥈 2' : isTop3 ? '🥉 3' : `#${realRank}`}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                              <span>{p.name}</span>
                              {p.className && (
                                <span className="px-1.5 py-0.5 bg-white/10 text-cyan-300 rounded text-[10px] font-bold">
                                  {p.className}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-amber-300 text-sm">
                              ⚡ {p.exp ?? 0}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2.5 py-0.5 rounded-md bg-white/5 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                                {titleData.title}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                              {correct} / {totalQ}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-slate-300">
                              {time}s
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-xs">
                              <span className={`px-2 py-0.5 rounded font-bold ${
                                pct >= 80 ? 'bg-emerald-500/20 text-emerald-300' : pct >= 50 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-rose-500/20 text-rose-300'
                              }`}>
                                {pct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 5-COLUMN ANSWER KEY */}
        {summaryTab === 'ANSWERS' && (
          <div className="space-y-4">
            <div className="glass-neon-card rounded-2xl p-3.5 text-center text-xs md:text-sm text-amber-200 font-semibold shadow-inner">
              ⭐ <strong>Hệ thống tính điểm EXP:</strong> Tính điểm theo độ chính xác, tốc độ và chuỗi streak để tích luỹ EXP • Bảng xếp hạng và Top 18 xét chọn hoàn toàn theo EXP.
            </div>

            <div className="glass-neon-card-glow rounded-3xl p-4 md:p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,217,255,0.8)]" />
                  <span className="text-sm md:text-base font-bold text-slate-300">
                    Toàn bộ {quiz.questions.length} câu hỏi hiển thị theo lưới 5 cột:
                  </span>
                </div>
                <button
                  onClick={() => setShowAllAnswersInSummary(!showAllAnswersInSummary)}
                  className={`px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                    showAllAnswersInSummary ? 'bg-amber-400 text-slate-950' : 'bg-cyan-400 text-slate-950'
                  }`}
                >
                  {showAllAnswersInSummary ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showAllAnswersInSummary ? 'Ẩn đáp án' : 'Hiển thị đáp án'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3 max-h-[60vh] overflow-y-auto pr-1">
                {quiz.questions.map((q, i) => {
                  const isTF = q.type === 'TF';
                  const isMC = q.type === 'MC';
                  const isSA = q.type === 'SA' || q.type === 'ESSAY';
                  const pts = isTF ? '1.0đ' : isSA ? '0.5đ' : `${breakdown?.mcScorePerQ.toFixed(2) || '0.5'}đ`;

                  return (
                    <div
                      key={q.id || i}
                      className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                        showAllAnswersInSummary
                          ? isTF
                            ? 'bg-amber-950/40 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                            : 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                          : 'bg-slate-900/80 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-xs font-mono">
                          Câu {i + 1}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                          {pts}
                        </span>
                      </div>

                      <div className="min-h-[2.5rem] flex items-center">
                        {!showAllAnswersInSummary ? (
                          <div className="w-full py-1 px-2 rounded-lg bg-white/5 border border-dashed border-white/10 flex items-center justify-center gap-1 text-slate-500 text-xs font-mono">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>[Ẩn]</span>
                          </div>
                        ) : isTF ? (
                          <div className="font-mono text-xs font-black text-amber-300 tracking-wider">
                            {formatTFAnswer(q.answer, i + 1)}
                          </div>
                        ) : isMC ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Đáp án:</span>
                            <span className="w-7 h-7 rounded-lg bg-emerald-400 text-slate-950 font-black font-mono text-base flex items-center justify-center shadow-md">
                              {q.answer}
                            </span>
                          </div>
                        ) : (
                          <div className="font-mono text-xs font-bold text-emerald-300 truncate" title={q.answer}>
                            {q.answer}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-[177.78vh] mx-auto mt-4 text-center text-xs text-slate-500">
        Science Adventure • Khung hình 16:9 • Tiêu chí: Xếp hạng theo điểm EXP • Vòng 2 phân bổ 6 nhóm • 3 nhóm vào vòng tiếp theo
      </div>

      {/* Round 2 Group Shuffle Modal */}
      <Round2ShuffleModal
        isOpen={showRound2Modal}
        onClose={() => setShowRound2Modal(false)}
        players={players}
        savedGroups={session.round2Groups}
        onSaveGroups={handleSaveRound2Groups}
      />

      {/* Exam Seating Modal (5 Dãy x 6 HS = 30 Chỗ, không cùng lớp cạnh nhau) */}
      <ExamSeatingModal
        isOpen={showSeatingModal}
        onClose={() => setShowSeatingModal(false)}
        sessionId={session.id}
        quizTitle={quiz?.title}
        initialPlan={session.seatingPlan}
        onSavePlan={(plan) => setSession(prev => prev ? { ...prev, seatingPlan: plan } : null)}
      />

      {/* Atomic Planetary Countdown Clock (Mặc định 5 phút) */}
      <AtomicCountdownClock
        isOpen={showAtomicClock}
        onClose={() => setShowAtomicClock(false)}
        defaultMinutes={5}
      />

      {renderAnnouncementModal()}
      {renderTtsVoiceModal()}
    </CyberSpaceBackground>
  );
}
