import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { GameSession, Player as PlayerType, Quiz, Question } from '../types';
import { 
  Loader2, 
  ArrowLeft, 
  Gamepad2, 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  Home, 
  Sparkles, 
  Zap, 
  Shield, 
  Lock, 
  Flame, 
  Volume2, 
  VolumeX,
  Clock,
  Users,
  AlertCircle,
  KeyRound,
  LogOut,
  Play,
  Check,
  ArrowRight,
  AlertTriangle,
  ChevronsUpDown,
  Star,
  Sword,
  Megaphone,
  X,
  Coins,
  ExternalLink,
  RefreshCw,
  Wifi,
  WifiOff,
  Radio
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { calculateScoreBreakdown, gradeQuestion, formatTFAnswer } from '../utils/scoring';
import { gameAudio } from '../utils/gameAudio';
import { 
  getStationForQuestion, 
  calculateLevelData, 
  calculateEarnedExp, 
  POWER_UPS, 
  PowerUpType, 
  getPlayerTitle 
} from '../utils/gamification';
import { CyberSpaceBackground } from '../components/CyberSpaceBackground';
import { checkExamLockout, triggerExamLockout, clearExamLockout, MAX_TAB_VIOLATIONS, LockoutInfo } from '../utils/antiCheat';
import { AntiCheatWarningModal, ExamLockoutScreen } from '../components/AntiCheatWarningModal';
import { shuffleQuiz } from '../utils/shuffleQuiz';
import { loadRoster, findStudentInRoster } from '../utils/studentRoster';
import { StudentRosterItem } from '../types';
import { firestoreQuota } from '../utils/firestoreQuota';
import { getQuizById } from '../utils/quizStorage';
import { syncPlayerToServer, fetchSessionFromServer, fetchActiveSessionsFromServer } from '../services/serverSync';
import Round2StudentSubmitModal from '../components/Round2StudentSubmitModal';
import { 
  ROUND_2_GROUPS_CONFIG, 
  getTeamProducts, 
  openProductInNewTab,
  extractSubmissionsMap,
  extractScoresMap
} from '../utils/round2Grouping';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

export default function Player() {
  const [name, setName] = useState('');
  const [studentCodeInput, setStudentCodeInput] = useState('');
  const [openSession, setOpenSession] = useState<GameSession | null>(null);
  const [rosterList, setRosterList] = useState<StudentRosterItem[]>([]);
  const [detectedStudent, setDetectedStudent] = useState<StudentRosterItem | null>(null);
  const [isWaitingForTeacherSession, setIsWaitingForTeacherSession] = useState(false);
  const [pendingStudent, setPendingStudent] = useState<StudentRosterItem | null>(null);
  const [hasAnnouncedGameOpen, setHasAnnouncedGameOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [showRound2SubmitModal, setShowRound2SubmitModal] = useState(false);

  // Connection State & Watchdog Timeout for robust lobby synchronization
  type ConnectionState = 'idle' | 'connecting' | 'connected' | 'failed';
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [connectingStudent, setConnectingStudent] = useState<{ name: string; studentCode: string; className?: string } | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [joinedSession, setJoinedSession] = useState<GameSession | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerType | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<any>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [allPlayers, setAllPlayers] = useState<PlayerType[]>([]);
  const [answerDuration, setAnswerDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [submissionNotification, setSubmissionNotification] = useState<string | null>(null);
  const [round2Submissions, setRound2Submissions] = useState<Record<string, any>>({});
  const prevSubmissionsRef = useRef<Record<string, any>>({});

  // References for Firestore listener cleanups and seamless state tracking
  const unsubRefs = useRef<(() => void)[]>([]);
  const lastQIndexRef = useRef<number>(-1);
  const sessionStatusRef = useRef<string>('');

  // Active Power-up state for this question
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [hiddenOptionLetter, setHiddenOptionLetter] = useState<string | null>(null);

  // Star of Hope (Active from Question 5, one-time use)
  const [starOfHopeActive, setStarOfHopeActive] = useState<boolean>(false);

  // Steal Points & Defense (Active from Question 10, one-time use)
  const [defenseActive, setDefenseActive] = useState<boolean>(false);
  const [stealTarget, setStealTarget] = useState<{ id: string; name: string } | null>(null);
  const [showStealModal, setShowStealModal] = useState<boolean>(false);
  const [stealResultNotice, setStealResultNotice] = useState<string | null>(null);

  // Wager EXP (Active from Question 15, one-time use)
  const [wagerExpAmount, setWagerExpAmount] = useState<number>(0);
  const [showWagerModal, setShowWagerModal] = useState<boolean>(false);
  const [wagerInput, setWagerInput] = useState<string>('');
  const [wagerResultNotice, setWagerResultNotice] = useState<string | null>(null);

  // Teacher Broadcast Announcement Toast & Menu Modal
  const [showAnnouncementToast, setShowAnnouncementToast] = useState<boolean>(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState<boolean>(false);
  const lastAnnouncementTimestampRef = useRef<number>(0);
  const announcementTimerRef = useRef<NodeJS.Timeout | null>(null);
  const questionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Top 18 Drawer toggle for mobile
  const [showTop18Drawer, setShowTop18Drawer] = useState<boolean>(false);

  // Submission feedback state
  const [lastSubmissionResult, setLastSubmissionResult] = useState<{
    isCorrect: boolean;
    earnedScore: number;
    earnedExp: number;
    didLevelUp: boolean;
    isExamMode?: boolean;
  } | null>(null);

  const navigate = useNavigate();

  // Anti-Cheat & Lockout State
  const [lockoutInfo, setLockoutInfo] = useState<LockoutInfo>(() => checkExamLockout());
  const [violationsCount, setViolationsCount] = useState<number>(0);
  const violationsCountRef = useRef<number>(0);
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);
  const [showViolationModal, setShowViolationModal] = useState<boolean>(false);
  const lastViolationTimeRef = useRef<number>(0);

  // Per-Player Local Shuffled Quiz (For EXAM_AUTO mode)
  const [playerShuffledQuiz, setPlayerShuffledQuiz] = useState<Quiz | null>(null);
  const [selfPacedIdx, setSelfPacedIdx] = useState<number>(0);
  const [isSelfFinished, setIsSelfFinished] = useState<boolean>(false);

  // Auto-detect student code from URL params (e.g. ?studentCode=HS01)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sCode = params.get('studentCode') || params.get('hs') || params.get('sbd') || params.get('id');
    if (sCode) {
      setStudentCodeInput(sCode.trim().toUpperCase());
    }
  }, []);

  // When student entered student code before teacher opened game: auto-join immediately once game opens!
  useEffect(() => {
    if (isWaitingForTeacherSession && pendingStudent && !joinedSession && !isJoining) {
      if (openSession) {
        joinSession(openSession, pendingStudent.name, pendingStudent.studentCode, pendingStudent.className);
      } else {
        const checkSessions = async () => {
          const sessions = await fetchActiveSessionsFromServer();
          if (sessions && sessions.length > 0) {
            const target = sessions[0];
            setOpenSession(target);
            joinSession(target, pendingStudent.name, pendingStudent.studentCode, pendingStudent.className);
          }
        };
        checkSessions();
        const pollInterval = setInterval(checkSessions, 1000);
        return () => clearInterval(pollInterval);
      }
    }
  }, [isWaitingForTeacherSession, pendingStudent, openSession, joinedSession, isJoining]);

  // Load student roster and subscribe in real-time to open game sessions created by Teacher
  useEffect(() => {
    // 1. Load student roster
    loadRoster()
      .then(items => setRosterList(items))
      .catch(err => console.warn('Could not load student roster:', err));

    // 2. Real-time subscription to open sessions in Lobby
    // If the student has already joined a room, DO NOT listen to all open sessions (saves massive Firestore read quota)
    if (joinedSession) return;

    // Immediately fetch from server backup on mount
    fetchActiveSessionsFromServer().then(serverSessions => {
      if (serverSessions && serverSessions.length > 0) {
        setOpenSession(serverSessions[0]);
        if (!hasAnnouncedGameOpen) {
          setHasAnnouncedGameOpen(true);
          gameAudio.playVictory();
        }
      }
    }).catch(() => {});

    const q = query(collection(db, 'sessions'), where('status', 'in', ['WAITING', 'ACTIVE', 'FINISHED', 'ROUND2']));
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      // Filter out finished sessions, closed sessions, and sessions older than 12 hours
      const list = snap.docs
        .map(d => ({ ...d.data(), id: d.id } as GameSession))
        .filter(s => s.status !== 'FINISHED' && s.status !== 'CLOSED' && !s.isClosed && !s.hostLeft && s.createdAt && (now - s.createdAt < 12 * 3600 * 1000));

      // Sort strictly by newest createdAt DESC!
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (list.length > 0) {
        const newest = list[0];
        setOpenSession(newest);
        // Play alert sound once when game is detected as opened
        if (!hasAnnouncedGameOpen) {
          setHasAnnouncedGameOpen(true);
          gameAudio.playVictory();
        }
      } else {
        // If Firestore list is empty (e.g. quota limit reached), check server before wiping openSession!
        fetchActiveSessionsFromServer().then(serverSessions => {
          if (serverSessions && serverSessions.length > 0) {
            setOpenSession(serverSessions[0]);
            if (!hasAnnouncedGameOpen) {
              setHasAnnouncedGameOpen(true);
              gameAudio.playVictory();
            }
          } else {
            setOpenSession(null);
          }
        }).catch(() => setOpenSession(null));
      }
    }, () => {
      // On Firestore error, fallback to server
      fetchActiveSessionsFromServer().then(serverSessions => {
        if (serverSessions && serverSessions.length > 0) {
          setOpenSession(serverSessions[0]);
        }
      }).catch(() => {});
    });

    // Backup server poll to discover session even if Firestore is exhausted
    const backupServerPoll = setInterval(async () => {
      if (joinedSession) return;
      const serverSessions = await fetchActiveSessionsFromServer();
      if (serverSessions && serverSessions.length > 0) {
        setOpenSession(serverSessions[0]);
        if (!hasAnnouncedGameOpen) {
          setHasAnnouncedGameOpen(true);
          gameAudio.playVictory();
        }
      }
    }, 1500);

    return () => {
      unsub();
      clearInterval(backupServerPoll);
    };
  }, [hasAnnouncedGameOpen, joinedSession]);

  // Real-time lookup of student code against roster
  useEffect(() => {
    if (!studentCodeInput.trim()) {
      setDetectedStudent(null);
      return;
    }
    const clean = studentCodeInput.trim().toUpperCase().replace(/\s+/g, '');
    const found = findStudentInRoster(clean, rosterList) || (openSession?.roster ? findStudentInRoster(clean, openSession.roster) : null);
    setDetectedStudent(found);
    if (found && !name.trim()) {
      setName(found.name);
    }
  }, [studentCodeInput, rosterList, openSession, name]);

  // Seamless Auto-Reconnect on refresh
  useEffect(() => {
    if (joinedSession || isJoining || !openSession) return;
    const storedSessionId = localStorage.getItem('reconnect_session_id');
    const storedStudentCode = localStorage.getItem('reconnect_student_code');
    
    if (storedSessionId && storedStudentCode && openSession.id === storedSessionId) {
      // Find the student in the roster
      const effectiveRoster = openSession.roster && openSession.roster.length > 0 ? openSession.roster : rosterList;
      const matched = findStudentInRoster(storedStudentCode, effectiveRoster);
      if (matched) {
        setIsJoining(true);
        joinSession(openSession, matched.name, storedStudentCode, matched.className)
          .catch(err => {
            console.error('Auto-reconnect failed:', err);
            setIsJoining(false);
          });
      }
    }
  }, [openSession, rosterList, joinedSession, isJoining]);

  // Cleanup listeners on component unmount
  useEffect(() => {
    return () => {
      unsubRefs.current.forEach(u => u());
      unsubRefs.current = [];
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = document.getElementById('player-question-container') || document.getElementById('player-question-content');
    if (el) {
      renderMathInElement(el, {
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

  const toggleAudio = () => {
    const muted = gameAudio.toggleMute();
    setIsMuted(muted);
    if (!muted) gameAudio.playClick();
  };

  // Lockout countdown timer effect
  useEffect(() => {
    if (!lockoutInfo.isLocked) return;
    const interval = setInterval(() => {
      const status = checkExamLockout();
      setLockoutInfo(status);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutInfo.isLocked]);

  // Synchronized question audio playback disabled on student devices per teacher request

  // Real-time toast notifications when a group submits a product in Round 2
  useEffect(() => {
    if (!joinedSession || joinedSession.status !== 'ROUND2') return;
    const subs = {
      ...extractSubmissionsMap(joinedSession),
      ...round2Submissions
    };
    
    // Find if any group has a new submission
    Object.keys(subs).forEach(teamId => {
      const sub = subs[teamId];
      const prevSub = prevSubmissionsRef.current[teamId];
      
      // If there was no previous submission, or the submission timestamp is newer
      if (sub && (!prevSub || sub.submittedAt > (prevSub.submittedAt || 0))) {
        // Trigger notification!
        const teamConfig = ROUND_2_GROUPS_CONFIG.find(g => g.id === teamId);
        const teamName = teamConfig?.name || sub.teamName || teamId;
        const teamIcon = teamConfig?.icon || '📦';
        
        const message = `🎉 ${teamIcon} Nhóm [${teamName}] vừa nộp bài thành công: "${sub.title}" (bởi ${sub.submittedBy || 'thành viên'})!`;
        setSubmissionNotification(message);
        try {
          gameAudio.playVictory();
        } catch (e) {}
        
        // Auto dismiss after 6 seconds
        setTimeout(() => {
          setSubmissionNotification(current => current === message ? null : current);
        }, 6000);
      }
    });
    
    prevSubmissionsRef.current = subs;
  }, [joinedSession?.round2Submissions, joinedSession?.status]);

  // Anti-Cheat: Detect Tab Switching, Window Blur, and Window Closing during Active Session
  useEffect(() => {
    if (!joinedSession || joinedSession.status !== 'ACTIVE' || isDisqualified || isSelfFinished) return;

    const handleViolation = (actionName: string) => {
      const now = Date.now();
      // Debounce events within 2 seconds
      if (now - lastViolationTimeRef.current < 2000) return;
      lastViolationTimeRef.current = now;

      const nextCount = violationsCountRef.current + 1;
      violationsCountRef.current = nextCount;
      setViolationsCount(nextCount);

      if (nextCount >= 3) {
        // Lần 3 dừng chơi 30s, lần 4 trở đi dừng chơi 90s (KHÔNG hủy kết quả bài thi)
        const lockout = triggerExamLockout(nextCount);
        setLockoutInfo(lockout);
      }
      setShowViolationModal(true);

      // Throttled update to Firestore outside setState
      if (joinedSession && playerInfo) {
        updateDoc(doc(db, `sessions/${joinedSession.id}/players/${playerInfo.id}`), {
          tabViolations: nextCount
        }).catch(e => firestoreQuota.reportError(e));
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('chuyển tab');
      }
    };

    const handleWindowBlur = () => {
      handleViolation('rời khỏi cửa sổ bài thi');
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Bạn đang trong bài thi. Rời khỏi hoặc đóng tab sẽ bị tính là vi phạm quy chế thi!';
      return e.returnValue;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [joinedSession?.status, joinedSession?.id, isDisqualified, isSelfFinished, playerInfo?.id]);

  // Per-Player Local Shuffled Quiz in EXAM_AUTO mode:
  // Preserves sequence: MC -> TF -> SA. Shuffles questions & options per player/attempt.
  useEffect(() => {
    if (joinedSession?.status === 'ACTIVE' && joinedSession?.gameMode === 'EXAM_AUTO' && quiz && !playerShuffledQuiz) {
      const shuffled = shuffleQuiz(quiz);
      setPlayerShuffledQuiz(shuffled);
      setSelfPacedIdx(0);
    }
  }, [joinedSession?.status, joinedSession?.gameMode, quiz, playerShuffledQuiz]);

  // Leave session / waiting room to return to input form
  const handleLeaveSession = () => {
    gameAudio.playClick();
    localStorage.removeItem('reconnect_session_id');
    localStorage.removeItem('reconnect_student_code');
    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current);
    }
    setShowAnnouncementToast(false);
    unsubRefs.current.forEach(u => u());
    unsubRefs.current = [];
    setJoinedSession(null);
    setPlayerInfo(null);
    setQuiz(null);
    setPlayerShuffledQuiz(null);
    setSelfPacedIdx(0);
    setIsSelfFinished(false);
    setAllPlayers([]);
    setCurrentAnswer(null);
    setIsSubmitted(false);
    setJoinError('');
    setViolationsCount(0);
    violationsCountRef.current = 0;
    setIsDisqualified(false);
    setShowViolationModal(false);
    lastQIndexRef.current = -1;
    sessionStatusRef.current = '';
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    setConnectionState('idle');
    setConnectionError('');
    setConnectingStudent(null);
  };

  // Cancel connecting state and return to login form
  const handleCancelConnecting = () => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    setConnectionState('idle');
    setIsJoining(false);
    setConnectionError('');
    setConnectingStudent(null);
    setIsWaitingForTeacherSession(false);
    setPendingStudent(null);
  };

  // Retry connecting to host lobby
  const handleRetryConnection = async () => {
    if (!connectingStudent) {
      setConnectionState('idle');
      return;
    }
    gameAudio.playClick();
    setConnectionState('connecting');
    setIsJoining(true);
    setConnectionError('');

    try {
      const serverSessions = await fetchActiveSessionsFromServer();
      const targetSession = serverSessions && serverSessions.length > 0 ? serverSessions[0] : openSession;
      if (!targetSession) {
        // Brief retry after 600ms to allow network latency
        await new Promise(r => setTimeout(r, 600));
        const retrySessions = await fetchActiveSessionsFromServer();
        if (retrySessions && retrySessions.length > 0) {
          await joinSession(retrySessions[0], connectingStudent.name, connectingStudent.studentCode, connectingStudent.className);
          return;
        }
        throw new Error('Chưa tìm thấy phòng thi nào đang mở từ Giáo viên. Hãy đảm bảo Giáo viên đã mở bài trên màn hình lớn.');
      }
      await joinSession(targetSession, connectingStudent.name, connectingStudent.studentCode, connectingStudent.className);
    } catch (err: any) {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setConnectionState('failed');
      setIsJoining(false);
      setConnectionError(err?.message || 'Không thể kết nối đến phòng thi.');
    }
  };

  // Prepare for new game after Teacher closed session to return to home
  const handlePrepareForNewGame = () => {
    gameAudio.playClick();
    localStorage.removeItem('reconnect_session_id');
    localStorage.removeItem('reconnect_student_code');
    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current);
    }
    setShowAnnouncementToast(false);
    unsubRefs.current.forEach(u => u());
    unsubRefs.current = [];
    setJoinedSession(null);
    setPlayerInfo(null);
    setQuiz(null);
    setPlayerShuffledQuiz(null);
    setSelfPacedIdx(0);
    setIsSelfFinished(false);
    setAllPlayers([]);
    setCurrentAnswer(null);
    setIsSubmitted(false);
    setJoinError('');
    setViolationsCount(0);
    violationsCountRef.current = 0;
    setIsDisqualified(false);
    setShowViolationModal(false);
    lastQIndexRef.current = -1;
    sessionStatusRef.current = '';
    // Preserve student information & enter ready/waiting state for new game
    setIsWaitingForTeacherSession(true);
    if (detectedStudent) {
      setPendingStudent(detectedStudent);
    }
  };

  // Acknowledge tab-switching violation or unpause when cooldown expires
  const handleAcknowledgeViolation = () => {
    if (violationsCount >= 3 && lockoutInfo.isLocked && lockoutInfo.remainingSeconds > 0) {
      return;
    }
    clearExamLockout();
    setLockoutInfo({
      isLocked: false,
      remainingSeconds: 0,
      reason: '',
      lockedAt: 0,
      unlockAt: 0,
      violationCount: violationsCount
    });
    setShowViolationModal(false);
  };

  // Join session by Student Code (Primary flow: Teacher opens game, Student enters Student Code)
  const handleJoinByCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setJoinError('');

    const currentLockout = checkExamLockout();
    if (currentLockout.isLocked) {
      setLockoutInfo(currentLockout);
      setJoinError(`Bạn đang trong thời gian tạm dừng làm bài (${currentLockout.remainingSeconds} giây còn lại) do chuyển màn hình.`);
      return;
    }

    const cleanStudentCode = studentCodeInput.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanStudentCode) {
      setJoinError('Vui lòng nhập Mã học sinh của bạn (đã được cấp từ Trang Quản Trị)!');
      return;
    }

    // Roster matching: check session roster or system roster
    const effectiveRoster = openSession?.roster && openSession.roster.length > 0 ? openSession.roster : rosterList;
    const matched = findStudentInRoster(cleanStudentCode, effectiveRoster);

    if (!matched) {
      setJoinError(`Mã học sinh "${cleanStudentCode}" không tồn tại trong danh sách đã được thêm từ Trang Quản Trị. Vui lòng liên hệ Thầy/Cô hoặc Quản trị viên để được cấp mã!`);
      return;
    }

    // Successfully recognized student: real student name and class, NOT the code!
    const finalStudentName = matched.name;
    const finalClassName = matched.className;

    if (openSession) {
      setIsJoining(true);
      gameAudio.playClick();
      try {
        await joinSession(openSession, finalStudentName, cleanStudentCode, finalClassName);
      } catch (err: any) {
        setJoinError('Lỗi kết nối: ' + (err?.message || 'Không thể tham gia phòng thi lúc này.'));
        setIsJoining(false);
      }
    } else {
      // Teacher hasn't opened the game yet: put student in waiting lobby
      setPendingStudent(matched);
      setIsWaitingForTeacherSession(true);
      gameAudio.playVictory();
    }
  };

  const joinSession = async (
    s: GameSession, 
    playerName: string, 
    studentCodeStr?: string, 
    classNameStr?: string
  ) => {
    const cleanCode = (studentCodeStr || '').trim().toUpperCase();
    setConnectingStudent({
      name: playerName,
      studentCode: cleanCode,
      className: classNameStr
    });
    setConnectionState('connecting');
    setIsJoining(true);
    setConnectionError('');

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    // Set 8-second watchdog timer for lobby connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      setConnectionState('failed');
      setIsJoining(false);
      setConnectionError('Quá thời gian chờ kết nối (Timeout sau 8s). Phòng thi của Giáo viên chưa phản hồi hoặc kết nối mạng không ổn định.');
    }, 8000);

    try {
      let playerId = `p-${Date.now()}`;
      let activePlayer: PlayerType | null = null;
      try {
        const fetchSnapPromise = getDocs(collection(db, `sessions/${s.id}/players`));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        );
        const snap = await Promise.race([fetchSnapPromise, timeoutPromise]);
        const existing = snap.docs
          .map(d => d.data() as PlayerType)
          .find(p => p.studentCode && p.studentCode.trim().toUpperCase() === cleanCode);
        if (existing) {
          playerId = existing.id;
          activePlayer = existing;
        }
      } catch (e) {
        // Fallback to checking server backup if Firestore times out or quota is exhausted!
        try {
          const serverData = await fetchSessionFromServer(s.id);
          if (serverData?.players) {
            const existing = serverData.players.find(p => p.studentCode && p.studentCode.trim().toUpperCase() === cleanCode);
            if (existing) {
              playerId = existing.id;
              activePlayer = existing;
            }
          }
        } catch (_) {}
      }

      if (!activePlayer) {
        activePlayer = {
          id: playerId,
          sessionId: s.id,
          name: playerName, // Tên hiển thị trên màn hình chính vẫn là tên HS chứ không phải mã
          studentCode: studentCodeStr || '',
          className: classNameStr || 'Chung',
          score: 0,
          correctCount: 0,
          totalTimeSpent: 0,
          lastAnswerTime: Date.now(),
          answers: {},
          exp: 0,
          level: 1,
          streak: 0,
          usedPowerUps: []
        };
        // Always sync player join to server backup (works even when Firestore quota is 100% full!)
        syncPlayerToServer(s.id, activePlayer);

        try {
          await setDoc(doc(db, `sessions/${s.id}/players/${playerId}`), activePlayer);
        } catch (e) {
          firestoreQuota.reportError(e);
          console.warn('Could not write player to Firestore (quota or offline):', e);
        }
      }
      setPlayerInfo(activePlayer);
      
      // Save to localStorage for seamless auto-reconnect on refresh
      localStorage.setItem('reconnect_session_id', s.id);
      localStorage.setItem('reconnect_student_code', cleanCode);
      
      let baseQuiz: Quiz | null = await getQuizById(s.quizId);
      if (!baseQuiz) {
        try {
          const qDoc = await getDoc(doc(db, 'quizzes', s.quizId));
          if (qDoc.exists()) {
            baseQuiz = qDoc.data() as Quiz;
          }
        } catch (_) {}
      }
      if (baseQuiz) {
        if (s.questions && s.questions.length > 0) {
          setQuiz({ ...baseQuiz, questions: s.questions });
        } else {
          setQuiz(baseQuiz);
        }
      } else if (s.questions && s.questions.length > 0) {
        setQuiz({
          id: s.quizId || 'quiz',
          title: 'Đấu trường Tri thức',
          subject: 'KHTN',
          questions: s.questions,
          createdBy: 'admin',
          createdAt: Date.now()
        });
      }
      
      // Determine initial answer state for reconnection
      const isExamMode = s.gameMode === 'EXAM_AUTO';
      const activeQuiz = isExamMode && playerShuffledQuiz ? playerShuffledQuiz : (s.questions && s.questions.length > 0 ? { id: s.quizId, title: '', subject: '', questions: s.questions } : baseQuiz);
      const activeQIdx = isExamMode ? selfPacedIdx : s.currentQuestionIndex;
      const currentQ = activeQuiz?.questions?.[activeQIdx];
      
      if (currentQ && activePlayer.answers && activePlayer.answers[currentQ.id] !== undefined) {
        setIsSubmitted(true);
        const savedAns = activePlayer.answers[currentQ.id];
        if (currentQ.type === 'TF') {
          try {
            setCurrentAnswer(JSON.parse(savedAns));
          } catch {
            setCurrentAnswer(savedAns);
          }
        } else {
          setCurrentAnswer(savedAns);
        }
      } else {
        setIsSubmitted(false);
        setCurrentAnswer(null);
      }
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setConnectionState('connected');
      setJoinedSession(s);
      setIsJoining(false);
      setIsWaitingForTeacherSession(false);
      setPendingStudent(null);
      lastQIndexRef.current = s.currentQuestionIndex;
      sessionStatusRef.current = s.status;

      // Listen to all players in the room for real-time leaderboard and lobby roster
      const unsubPlayers = onSnapshot(collection(db, `sessions/${s.id}/players`), (snap) => {
        const list = snap.docs.map(d => d.data() as PlayerType);
        setAllPlayers(list);
        const me = list.find(p => p.id === playerId);
        if (me) setPlayerInfo(me);
      });

      // Listen to session state (Start game, advance question, end game)
      const unsubSession = onSnapshot(doc(db, 'sessions', s.id), (snap) => {
        if (!snap.exists()) {
          // If Firestore document doesn't exist (e.g. quota limit reached), do NOT kick student out!
          // The backupPoller synchronizes session state from the server.
          return;
        }
        const updated = snap.data() as GameSession;
        
        // If session was closed or teacher left, clean up and return to Home immediately
        if (updated.status === 'CLOSED' || updated.isClosed || updated.hostLeft) {
          localStorage.removeItem('reconnect_session_id');
          localStorage.removeItem('reconnect_student_code');
          sessionStorage.setItem('game_ended_notice', 'true');
          handleLeaveSession();
          navigate('/');
          return;
        }
        
        // When Teacher opens the game (WAITING -> ACTIVE), notify with sound!
        if (sessionStatusRef.current === 'WAITING' && updated.status === 'ACTIVE') {
          gameAudio.playVictory();
        } else if (sessionStatusRef.current !== 'ROUND2' && updated.status === 'ROUND2') {
          // When Teacher transitions to Round 2, notify all student devices with chime!
          gameAudio.playVictory();
        }
        sessionStatusRef.current = updated.status;

        setJoinedSession(updated);

        // Check for teacher broadcast announcement (Real-time synchronization, auto-dismisses after 5s)
        const announcementTime = updated.announcement?.timestamp || 0;
        const announcementMsg = updated.announcement?.message?.trim() || '';

        if (announcementMsg && announcementTime > 0 && announcementTime !== lastAnnouncementTimestampRef.current) {
          lastAnnouncementTimestampRef.current = announcementTime;

          if (announcementTimerRef.current) {
            clearTimeout(announcementTimerRef.current);
            announcementTimerRef.current = null;
          }

          // Real-time sync: Pop up toast immediately on connection or when teacher updates announcement
          setShowAnnouncementToast(true);
          gameAudio.playPowerUp();

          // Auto-dismiss after exactly 5 seconds
          announcementTimerRef.current = setTimeout(() => {
            setShowAnnouncementToast(false);
          }, 5000);
        } else if (!updated.announcement || !announcementMsg) {
          setShowAnnouncementToast(false);
          if (announcementTimerRef.current) {
            clearTimeout(announcementTimerRef.current);
            announcementTimerRef.current = null;
          }
        }

        if (updated?.questions && updated.questions.length > 0) {
          setQuiz(prev => prev ? { ...prev, questions: updated.questions! } : null);
        }

        // When question changes, reset local answer & round power-up states
        if (updated.currentQuestionIndex !== lastQIndexRef.current) {
          lastQIndexRef.current = updated.currentQuestionIndex;
          setCurrentAnswer(null);
          setIsSubmitted(false);
          setAnswerDuration(0);
          setActivePowerUp(null);
          setHiddenOptionLetter(null);
          setLastSubmissionResult(null);
          setStarOfHopeActive(false);
          setDefenseActive(false);
          setStealTarget(null);
          setShowStealModal(false);
          setStealResultNotice(null);
          setWagerExpAmount(0);
          setShowWagerModal(false);
          setWagerResultNotice(null);
        }
      });

      // Listen to Round 2 submissions subcollection for instant real-time synchronization
      const unsubSubmissions = onSnapshot(collection(db, `sessions/${s.id}/submissions`), (snap) => {
        const subsMap: Record<string, any> = {};
        snap.docs.forEach(docSnap => {
          subsMap[docSnap.id] = docSnap.data();
        });
        setRound2Submissions(subsMap);
      });

      // Backup server-side sync poller to guarantee real-time updates when Firestore is exhausted
      const backupPoller = setInterval(async () => {
        const backupData = await fetchSessionFromServer(s.id);
        if (backupData?.session) {
          const sess = backupData.session;
          if (sess.status === 'CLOSED' || sess.isClosed || sess.hostLeft) {
            localStorage.removeItem('reconnect_session_id');
            localStorage.removeItem('reconnect_student_code');
            sessionStorage.setItem('game_ended_notice', 'true');
            handleLeaveSession();
            navigate('/');
            return;
          }

          if (sessionStatusRef.current === 'WAITING' && sess.status === 'ACTIVE') {
            gameAudio.playVictory();
          } else if (sessionStatusRef.current !== 'ROUND2' && sess.status === 'ROUND2') {
            gameAudio.playVictory();
          }
          sessionStatusRef.current = sess.status;

          setJoinedSession(prev => ({ ...(prev || {}), ...sess }));

          if (sess.questions && sess.questions.length > 0) {
            setQuiz(prev => prev ? { ...prev, questions: sess.questions! } : null);
          }

          if (sess.currentQuestionIndex !== lastQIndexRef.current) {
            lastQIndexRef.current = sess.currentQuestionIndex;
            setCurrentAnswer(null);
            setIsSubmitted(false);
            setAnswerDuration(0);
            setActivePowerUp(null);
            setHiddenOptionLetter(null);
            setLastSubmissionResult(null);
            setStarOfHopeActive(false);
            setDefenseActive(false);
            setStealTarget(null);
            setShowStealModal(false);
            setStealResultNotice(null);
            setWagerExpAmount(0);
            setShowWagerModal(false);
            setWagerResultNotice(null);
          }
        }
        if (backupData?.players && backupData.players.length > 0) {
          setAllPlayers(backupData.players);
          const me = backupData.players.find(p => p.id === playerId);
          if (me) setPlayerInfo(me);
        }
        if (backupData?.submissions && backupData.submissions.length > 0) {
          const subsMap: Record<string, any> = {};
          backupData.submissions.forEach(sub => {
            if (sub.teamId) subsMap[sub.teamId] = sub;
          });
          setRound2Submissions(subsMap);
        }
      }, 1000);

      unsubRefs.current = [unsubPlayers, unsubSession, unsubSubmissions, () => clearInterval(backupPoller)];
    } catch (e: any) {
      console.error('joinSession error:', e);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setConnectionState('failed');
      setIsJoining(false);
      setConnectionError(e?.message || 'Không thể thiết lập kết nối đến phòng thi.');
      setJoinError("Lỗi tham gia: " + (e?.message || 'Không thể kết nối.'));
    }
  };

  // Rank calculation strictly based on: EXP desc -> Total time asc (Chỉ dùng exp để tính, không xếp hạng theo điểm số câu đúng)
  const sortedPlayers = useMemo(() => {
    return [...allPlayers].sort((a, b) => {
      const expA = a.exp ?? 0;
      const expB = b.exp ?? 0;
      if (expB !== expA) return expB - expA;
      const tA = a.totalTimeSpent ?? 99999;
      const tB = b.totalTimeSpent ?? 99999;
      return tA - tB;
    });
  }, [allPlayers]);

  // Top 18 Leaderboard sorted strictly by EXP desc, then totalTimeSpent asc (NOT by score, NOT by correct count)
  const top18PlayersByExp = useMemo(() => {
    return [...allPlayers]
      .sort((a, b) => {
        const expA = a.exp ?? 0;
        const expB = b.exp ?? 0;
        if (expB !== expA) return expB - expA;
        const tA = a.totalTimeSpent ?? 99999;
        const tB = b.totalTimeSpent ?? 99999;
        return tA - tB;
      })
      .slice(0, 18);
  }, [allPlayers]);
  const top16PlayersByExp = top18PlayersByExp;

  // Top 10 for Steal mechanic (excluding self)
  const top10ForSteal = useMemo(() => {
    return sortedPlayers
      .filter(p => p.id !== playerInfo?.id)
      .slice(0, 10);
  }, [sortedPlayers, playerInfo?.id]);

  const myRank = playerInfo ? (sortedPlayers.findIndex(p => p.id === playerInfo.id) + 1 || 1) : 1;
  const myExpRank = myRank;
  const totalRoomPlayers = Math.max(allPlayers.length, 1);
  const myLevelData = calculateLevelData(playerInfo?.exp || 0);

  // Current Station Theme
  const currentStation = useMemo(() => {
    const isExamMode = joinedSession?.gameMode === 'EXAM_AUTO';
    const activeQuiz = (isExamMode && playerShuffledQuiz) ? playerShuffledQuiz : quiz;
    const activeQIndex = isExamMode ? selfPacedIdx : (joinedSession?.currentQuestionIndex ?? 0);
    if (!activeQuiz || !joinedSession) return getStationForQuestion(0, 1);
    return getStationForQuestion(activeQIndex, activeQuiz.questions.length);
  }, [quiz, playerShuffledQuiz, joinedSession, selfPacedIdx]);

  // Activate Power-Up
  const handleActivatePowerUp = (powerUpType: PowerUpType) => {
    if (!joinedSession || !quiz || isSubmitted || activePowerUp) return;
    const isExamMode = joinedSession.gameMode === 'EXAM_AUTO';
    const activeQuiz = (isExamMode && playerShuffledQuiz) ? playerShuffledQuiz : quiz;
    const activeQIndex = isExamMode ? selfPacedIdx : joinedSession.currentQuestionIndex;
    const currentQ = activeQuiz.questions[activeQIndex];
    if (!currentQ) return;
    
    gameAudio.playPowerUp();
    setActivePowerUp(powerUpType);

    if (powerUpType === 'FREEZE_OPTION' && currentQ.type === 'MC' && currentQ.options) {
      // Find a wrong option to eliminate
      const correctAns = currentQ.answer.trim().toUpperCase();
      const wrongIndices = [0, 1, 2, 3].filter(idx => {
        const letter = ['A', 'B', 'C', 'D'][idx];
        return letter !== correctAns;
      });
      if (wrongIndices.length > 0) {
        const eliminateIdx = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
        const eliminateLetter = ['A', 'B', 'C', 'D'][eliminateIdx];
        setHiddenOptionLetter(eliminateLetter);
      }
    }
  };

  // Toggle Star of Hope (Active from question 5, single use)
  const handleToggleStarOfHope = () => {
    if (!joinedSession || !playerInfo || playerInfo.usedStarOfHope || isSubmitted) return;
    gameAudio.playPowerUp();
    setStarOfHopeActive(prev => !prev);
  };

  // Activate Defense (Active from question 10, single use)
  const handleActivateDefense = async () => {
    if (!joinedSession || !playerInfo || playerInfo.usedDefense || isSubmitted) return;
    gameAudio.playPowerUp();
    setDefenseActive(true);
    try {
      await updateDoc(doc(db, `sessions/${joinedSession.id}/players/${playerInfo.id}`), {
        currentRoundDefense: true,
        usedDefense: true
      });
      setPlayerInfo(prev => prev ? { ...prev, currentRoundDefense: true, usedDefense: true } : null);
    } catch (e) {
      console.error('Error activating defense:', e);
    }
  };

  // Steal Target Selection (Active from question 10, single use)
  const handleOpenStealModal = () => {
    if (!joinedSession || !playerInfo || playerInfo.usedSteal || isSubmitted) return;
    gameAudio.playClick();
    setShowStealModal(true);
  };

  const handleSelectStealTarget = (target: { id: string; name: string }) => {
    gameAudio.playPowerUp();
    setStealTarget(target);
    setShowStealModal(false);
  };

  // Wager EXP (Active from question 15, single use)
  const handleOpenWagerModal = () => {
    if (!joinedSession || !playerInfo || playerInfo.usedWagerExp || isSubmitted) return;
    gameAudio.playClick();
    setWagerInput(wagerExpAmount > 0 ? String(wagerExpAmount) : '');
    setShowWagerModal(true);
  };

  const handleConfirmWager = () => {
    const parsed = parseInt(wagerInput.trim(), 10);
    const maxExp = Math.max(10, playerInfo?.exp || 0);
    if (isNaN(parsed) || parsed <= 0) {
      alert('Vui lòng nhập số điểm EXP hợp lệ lớn hơn 0!');
      return;
    }
    if (parsed > maxExp) {
      alert(`Số EXP cá cược không được vượt quá số EXP hiện tại (${maxExp} EXP)!`);
      return;
    }
    gameAudio.playPowerUp();
    setWagerExpAmount(parsed);
    setShowWagerModal(false);
  };

  const handleSubmitAnswer = async () => {
    if (!joinedSession || !playerInfo || !quiz || isSubmitted) return;
    
    const isExamMode = joinedSession.gameMode === 'EXAM_AUTO';
    const activeQuiz = (isExamMode && playerShuffledQuiz) ? playerShuffledQuiz : quiz;
    const activeQIndex = isExamMode ? selfPacedIdx : joinedSession.currentQuestionIndex;
    const currentQ = activeQuiz.questions[activeQIndex];
    if (!currentQ) return;

    setIsSubmitted(true);
    
    const breakdown = calculateScoreBreakdown(activeQuiz.questions);
    const grade = gradeQuestion(currentQ, currentAnswer, breakdown);

    let stringAns = '';
    if (currentQ.type === 'TF') {
      stringAns = JSON.stringify(currentAnswer);
    } else {
      stringAns = String(currentAnswer || '');
    }
    
    const now = Date.now();
    const qStartTime = joinedSession.questionStartTime || now;
    const timeSpentOnThisQ = Math.max(1, Math.round((now - qStartTime) / 1000));
    setAnswerDuration(timeSpentOnThisQ);

    const isCorrect = grade.isFullyCorrect;

    const currentStreak = isCorrect ? (playerInfo.streak || 0) + 1 : 0;
    let baseEarnedExp = calculateEarnedExp(isCorrect, timeSpentOnThisQ, currentQ.timeLimit || 30, currentStreak);

    // Apply active power-ups
    if (activePowerUp === 'DOUBLE_POINTS' && isCorrect) {
      baseEarnedExp = baseEarnedExp * 2;
    }

    // Apply Star of Hope ("Ngôi sao hi vọng" - Active from Q5, single use)
    let starOfHopeUsed = false;
    if (starOfHopeActive && !playerInfo.usedStarOfHope) {
      starOfHopeUsed = true;
      if (isCorrect) {
        baseEarnedExp = baseEarnedExp * 2;
      } else {
        baseEarnedExp = 0;
      }
    }

    // Apply Steal EXP mechanic ("Cướp EXP top 10" - Active from Q10, single use)
    let stealUsed = false;
    let stealExpBonus = 0;
    if (stealTarget && !playerInfo.usedSteal) {
      stealUsed = true;
      if (isCorrect) {
        const stealAmount = Math.max(30, Math.round(baseEarnedExp * 0.3));
        const targetDoc = allPlayers.find(p => p.id === stealTarget.id);
        if (targetDoc?.currentRoundDefense) {
          setStealResultNotice(`🛡️ ${stealTarget.name} đã bật Khiên Phòng Thủ! Vụ cướp ${stealAmount} EXP bị chặn đứng, bạn vẫn nhận đủ EXP câu đúng!`);
        } else {
          stealExpBonus = stealAmount;
          setStealResultNotice(`⚔️ Cướp thành công +${stealAmount} EXP từ ${stealTarget.name}!`);

          try {
            const targetRef = doc(db, `sessions/${joinedSession.id}/players/${stealTarget.id}`);
            const newTargetExp = Math.max(0, (targetDoc?.exp || 0) - stealAmount);
            await updateDoc(targetRef, { 
              exp: newTargetExp,
              level: calculateLevelData(newTargetExp).level,
              score: newTargetExp
            });
          } catch (err) {}
        }
      } else {
        setStealResultNotice(`⚔️ Rất tiếc, bạn trả lời chưa đúng nên không thể cướp EXP từ ${stealTarget.name}.`);
      }
    }

    // Apply Wager EXP mechanic ("Cá cược EXP" - Active from Q15, single use)
    let wagerUsed = false;
    let wagerBonusExp = 0;
    let wagerPenaltyExp = 0;
    if (wagerExpAmount > 0 && !playerInfo.usedWagerExp) {
      wagerUsed = true;
      if (isCorrect) {
        // Đúng: nhân đôi điểm đã cá (thưởng thêm đúng số điểm đã cá cược)
        wagerBonusExp = wagerExpAmount;
        setWagerResultNotice(`🎉 Thắng cá cược! Nhân đôi +${wagerExpAmount} EXP thành công!`);
      } else {
        // Sai: bị trừ điểm đã cá cược
        wagerPenaltyExp = wagerExpAmount;
        setWagerResultNotice(`💀 Trả lời chưa đúng: Bị trừ -${wagerExpAmount} EXP đã cá cược!`);
      }
    }

    const earnedExp = baseEarnedExp + wagerBonusExp + stealExpBonus;
    
    const oldExp = playerInfo.exp || 0;
    const newExp = Math.max(0, oldExp + earnedExp - wagerPenaltyExp);
    const oldLevel = calculateLevelData(oldExp).level;
    const newLevel = calculateLevelData(newExp).level;
    const didLevelUp = newLevel > oldLevel;

    // Reset local round power-up activations after submitting
    setStarOfHopeActive(false);
    setStealTarget(null);
    setWagerExpAmount(0);

    // Audio and feedback triggers
    if (!isExamMode) {
      if (isCorrect) {
        gameAudio.playCorrect();
        gameAudio.playExpWhoosh();
      } else {
        gameAudio.playIncorrect();
      }

      if (didLevelUp) {
        setTimeout(() => gameAudio.playLevelUp(), 400);
      }
    } else {
      gameAudio.playClick();
    }

    setLastSubmissionResult({
      isCorrect,
      earnedScore: 0,
      earnedExp,
      didLevelUp,
      isExamMode
    });

    const newCorrectCount = (playerInfo.correctCount || 0) + (isCorrect ? 1 : 0);
    const newTotalTime = (playerInfo.totalTimeSpent || 0) + timeSpentOnThisQ;
    const updatedAnswers = { ...playerInfo.answers, [currentQ.id]: stringAns };
    
    const playerUpdateData: any = {
      answers: updatedAnswers,
      score: newExp,
      correctCount: newCorrectCount,
      totalTimeSpent: newTotalTime,
      lastAnswerTime: now,
      exp: newExp,
      level: newLevel,
      streak: currentStreak
    };
    if (starOfHopeUsed) {
      playerUpdateData.usedStarOfHope = true;
    }
    if (stealUsed) {
      playerUpdateData.usedSteal = true;
    }
    if (wagerUsed) {
      playerUpdateData.usedWagerExp = true;
      playerUpdateData.currentRoundWagerExp = 0;
    }

    // Always sync answer to server backup (guarantees gameplay even when Firestore quota is exhausted!)
    syncPlayerToServer(joinedSession.id, { id: playerInfo.id, ...playerUpdateData });

    try {
      await updateDoc(doc(db, `sessions/${joinedSession.id}/players/${playerInfo.id}`), playerUpdateData);
    } catch (err) {
      firestoreQuota.reportError(err);
      console.warn('Could not update player answer in Firestore (quota or offline):', err);
    }
    
    setPlayerInfo({ 
      ...playerInfo, 
      ...playerUpdateData
    });
  };

  // Move to next question in Exam Mode (Self-paced per student)
  const handleNextExamQuestion = async () => {
    if (!joinedSession || !playerInfo) return;
    const activeQuiz = (joinedSession.gameMode === 'EXAM_AUTO' && playerShuffledQuiz) ? playerShuffledQuiz : quiz;
    if (!activeQuiz) return;

    if (selfPacedIdx < activeQuiz.questions.length - 1) {
      setSelfPacedIdx(prev => prev + 1);
      setCurrentAnswer(null);
      setIsSubmitted(false);
      setAnswerDuration(0);
      setActivePowerUp(null);
      setHiddenOptionLetter(null);
      setLastSubmissionResult(null);
      setStarOfHopeActive(false);
      setDefenseActive(false);
      setStealTarget(null);
      setStealResultNotice(null);
      setWagerExpAmount(0);
      setWagerResultNotice(null);
      if (playerInfo?.currentRoundDefense) {
        updateDoc(doc(db, `sessions/${joinedSession.id}/players/${playerInfo.id}`), {
          currentRoundDefense: false,
          currentRoundWagerExp: 0
        }).catch(() => {});
      }
      gameAudio.playClick();
    } else {
      setIsSelfFinished(true);
      gameAudio.playVictory();
      try {
        await updateDoc(doc(db, `sessions/${joinedSession.id}/players/${playerInfo.id}`), {
          isFinished: true
        });
      } catch (e) {
        console.error('Error updating player finished status:', e);
      }
    }
  };

  // Compact Real-time Teacher Broadcast Announcement Toast (Auto-dismisses after 5s)
  const renderTeacherAnnouncementToast = () => {
    if (!showAnnouncementToast || !joinedSession?.announcement?.message) return null;

    return (
      <div 
        key={`toast_${joinedSession.announcement.timestamp || 'active'}`}
        onClick={() => setShowAnnouncementModal(true)}
        className="fixed top-2.5 left-1/2 -translate-x-1/2 z-[9999] w-[92%] sm:w-auto sm:max-w-md mx-auto p-2 sm:p-2.5 bg-slate-900/98 text-white font-bold rounded-2xl shadow-[0_4px_30px_rgba(251,191,36,0.6)] border-2 border-amber-400 backdrop-blur-xl flex items-center justify-between gap-2 animate-in slide-in-from-top-4 duration-300 overflow-hidden select-none cursor-pointer"
        title="Bấm để xem chi tiết thông báo từ Giáo viên"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center flex-shrink-0 text-amber-300 animate-bounce">
            <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] uppercase tracking-wider text-amber-300 font-black flex items-center gap-1.5 mb-0.5">
              <span>THÔNG BÁO TỪ GV</span>
              <span className="text-[8px] bg-amber-400/20 text-amber-200 border border-amber-400/30 px-1 py-0.2 rounded font-mono font-bold">
                5s
              </span>
            </div>
            <div className="text-xs sm:text-sm font-black text-amber-100 leading-snug line-clamp-2 select-text break-words">
              {joinedSession.announcement.message}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAnnouncementModal(true);
            }}
            className="px-2 py-0.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-[10px] font-black border border-amber-400/30 transition-all cursor-pointer hidden xs:inline-block"
            title="Xem chi tiết thông báo"
          >
            Xem
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
              setShowAnnouncementToast(false);
            }}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer transition-all"
            title="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5-Second Animated Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400"
            style={{
              animation: 'announcementBar5s 5000ms linear forwards'
            }}
          />
        </div>
        <style>{`
          @keyframes announcementBar5s {
            0% { width: 100%; }
            100% { width: 0%; }
          }
        `}</style>
      </div>
    );
  };

  // Full Teacher Announcement Modal
  const renderTeacherAnnouncementModal = () => {
    if (!showAnnouncementModal) return null;

    return (
      <div 
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowAnnouncementModal(false);
        }}
        className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
      >
        <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(251,191,36,0.4)] relative animate-in zoom-in-95 duration-200 text-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2 text-amber-300">
              <Megaphone className="w-5 h-5 animate-bounce" />
              <h3 className="font-black text-sm uppercase tracking-wider">Thông báo từ Giáo viên</h3>
            </div>
            <button
              onClick={() => setShowAnnouncementModal(false)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer transition-all"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-2">
            {joinedSession?.announcement?.message ? (
              <div className="p-4 bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-slate-950/70 border-2 border-amber-400/70 rounded-2xl">
                <div className="text-[10px] font-black uppercase text-amber-300 tracking-wider mb-1.5 flex items-center justify-between">
                  <span>NỘI DUNG NHẮN GỬI:</span>
                  {joinedSession.announcement.timestamp && (
                    <span className="text-[10px] font-mono text-slate-300 font-normal">
                      {new Date(joinedSession.announcement.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="text-sm sm:text-base font-black text-white leading-relaxed select-text break-words">
                  {joinedSession.announcement.message}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs sm:text-sm font-semibold bg-slate-950/50 rounded-2xl border border-white/10">
                <Megaphone className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                Hiện tại chưa có thông báo mới từ Giáo viên. Hãy tập trung làm bài và quan sát tín hiệu trên màn hình chính!
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowAnnouncementModal(false)}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl cursor-pointer shadow-[0_0_15px_rgba(251,191,36,0.4)]"
            >
              ĐÃ HIỂU & QUAY LẠI LÀM BÀI
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 1. JOIN ROOM SCREEN (Nhập mã phòng từ Giáo viên)
  // ==========================================
  if (lockoutInfo.isLocked && !joinedSession) {
    return (
      <ExamLockoutScreen
        remainingSeconds={lockoutInfo.remainingSeconds}
        reason={lockoutInfo.reason}
        onRefresh={() => setLockoutInfo(checkExamLockout())}
      />
    );
  }

  // 1A.0 CONNECTING TO HOST LOBBY STATE (With real-time watchdog & spinner)
  if (connectionState === 'connecting' && !joinedSession) {
    return (
      <CyberSpaceBackground stationColor="#818CF8" className="flex flex-col items-center justify-center p-4 sm:p-6 select-none min-h-[100dvh]">
        <div className="w-full max-w-md glass-pastel-card-glow rounded-[2rem] p-6 sm:p-8 flex flex-col items-center shadow-[0_0_60px_rgba(129,140,248,0.3)] border-2 border-indigo-400/40 relative backdrop-blur-2xl text-center animate-in fade-in duration-200">
          
          {/* Animated Glowing Beacon */}
          <div className="relative mb-5">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-sky-500/20 border-2 border-indigo-300/60 rounded-3xl flex items-center justify-center shadow-[0_0_35px_rgba(129,140,248,0.4)]">
              <Loader2 className="w-10 h-10 text-indigo-300 animate-spin" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span>
            </span>
          </div>

          <span className="px-3.5 py-1 bg-indigo-500/20 border border-indigo-300/40 rounded-full text-indigo-200 font-black text-[11px] uppercase tracking-wider mb-2">
            ĐANG KẾT NỐI VÀO PHÒNG THI...
          </span>

          <h1 className="text-2xl sm:text-3xl font-lobster text-white text-center mb-1 tracking-wide">
            {connectingStudent?.name || name || 'Học sinh'}
          </h1>

          {connectingStudent?.studentCode && (
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="px-3 py-1 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-200 font-mono font-black text-xs shadow-sm">
                MÃ HS: {connectingStudent.studentCode}
              </span>
              {connectingStudent.className && (
                <span className="px-3 py-1 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-200 font-bold text-xs shadow-sm">
                  LỚP: {connectingStudent.className}
                </span>
              )}
            </div>
          )}

          {/* Connection Step Progress Card */}
          <div className="w-full p-4 bg-slate-950/80 rounded-2xl border border-indigo-500/30 text-left mb-6 space-y-2.5 shadow-inner">
            <div className="flex items-center gap-2.5 text-xs text-emerald-300 font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>Xác nhận thông tin học sinh</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-amber-300 font-semibold animate-pulse">
              <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-amber-400" />
              <span>Đang kết nối tới máy chủ phòng thi của Giáo viên...</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <Radio className="w-4 h-4 flex-shrink-0 opacity-40" />
              <span>Sẵn sàng nhận câu hỏi và thi đấu</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancelConnecting}
            className="text-xs text-slate-400 hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
          >
            Hủy kết nối & Đổi mã học sinh ➔
          </button>
        </div>
      </CyberSpaceBackground>
    );
  }

  // 1A.0.1 CONNECTION FAILED / TIMEOUT SCREEN (With Retry Button)
  if (connectionState === 'failed' && !joinedSession) {
    return (
      <CyberSpaceBackground stationColor="#F43F5E" className="flex flex-col items-center justify-center p-4 sm:p-6 select-none min-h-[100dvh]">
        <div className="w-full max-w-md glass-pastel-card-glow rounded-[2rem] p-6 sm:p-8 flex flex-col items-center shadow-[0_0_60px_rgba(244,63,94,0.3)] border-2 border-rose-400/40 relative backdrop-blur-2xl text-center animate-in fade-in duration-200">
          
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-500/20 border-2 border-rose-400/60 rounded-3xl flex items-center justify-center shadow-[0_0_35px_rgba(244,63,94,0.4)] mb-4">
            <WifiOff className="w-8 h-8 sm:w-10 sm:h-10 text-rose-400 animate-pulse" />
          </div>

          <span className="px-3.5 py-1 bg-rose-500/20 border border-rose-300/40 rounded-full text-rose-300 font-black text-[11px] uppercase tracking-wider mb-2">
            KẾT NỐI KHÔNG THÀNH CÔNG
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
            Không thể vào phòng thi
          </h2>

          {connectingStudent && (
            <p className="text-xs text-slate-300 mb-3">
              Thí sinh: <strong className="text-white">{connectingStudent.name}</strong> ({connectingStudent.studentCode})
            </p>
          )}

          <div className="w-full p-4 bg-slate-950/80 rounded-2xl border border-rose-500/40 text-rose-200 text-xs text-left mb-5 shadow-inner">
            <p className="font-semibold mb-1 flex items-center gap-1.5 text-rose-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Chi tiết lỗi:</span>
            </p>
            <p className="text-slate-300 leading-relaxed">
              {connectionError || 'Quá thời gian chờ kết nối (Timeout). Phòng thi của Giáo viên chưa mở hoặc kết nối mạng bị gián đoạn.'}
            </p>
          </div>

          {/* Action Buttons: Retry & Back */}
          <div className="w-full space-y-2.5">
            <button
              type="button"
              onClick={handleRetryConnection}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-sm shadow-[0_0_25px_rgba(52,211,153,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>THỬ KẾT NỐI LẠI (RETRY)</span>
            </button>

            <button
              type="button"
              onClick={handleCancelConnecting}
              className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-bold rounded-2xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại nhập mã học sinh khác</span>
            </button>
          </div>
        </div>
      </CyberSpaceBackground>
    );
  }

  // 1A. WAITING FOR TEACHER TO OPEN GAME (Học sinh đã nhập mã và đang nằm ở phòng chờ)
  if (isWaitingForTeacherSession && pendingStudent && !joinedSession) {
    return (
      <CyberSpaceBackground stationColor="#C084FC" className="flex flex-col items-center justify-center p-4 sm:p-6 select-none min-h-[100dvh]">
        <div className="w-full max-w-lg glass-pastel-card-glow rounded-[2rem] p-6 sm:p-8 flex flex-col items-center shadow-[0_0_60px_rgba(192,132,252,0.25)] border-2 border-purple-400/35 relative backdrop-blur-2xl text-center">
          
          <div className="relative mb-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-pink-400/20 via-purple-400/20 to-sky-400/20 border-2 border-purple-300/50 rounded-3xl flex items-center justify-center shadow-[0_0_35px_rgba(192,132,252,0.4)]">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500"></span>
            </span>
          </div>

          <span className="px-3.5 py-1 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-purple-300/40 rounded-full text-purple-200 font-black text-[11px] uppercase tracking-wider mb-2">
            ĐÃ VÀO PHÒNG CHỜ THÀNH CÔNG
          </span>

          <h1 className="text-2xl sm:text-3xl font-lobster text-white text-center mb-1 tracking-wide">
            {pendingStudent.name}
          </h1>

          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-200 font-mono font-black text-xs shadow-sm">
              MÃ HS: {pendingStudent.studentCode}
            </span>
            <span className="px-3 py-1 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-200 font-bold text-xs shadow-sm">
              LỚP: {pendingStudent.className}
            </span>
          </div>

          {/* Teacher Broadcast Announcement if openSession has one */}
          {openSession?.announcement?.message && (
            <div className="w-full p-4 mb-4 bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/25 border-2 border-amber-300 rounded-2xl flex items-center gap-3 text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.3)] animate-pulse text-left">
              <Megaphone className="w-6 h-6 text-amber-300 flex-shrink-0 animate-bounce" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  THÔNG BÁO TỪ GIÁO VIÊN
                </div>
                <div className="text-sm font-bold text-white leading-snug">
                  {openSession.announcement.message}
                </div>
              </div>
            </div>
          )}

          <div className="w-full p-4 bg-slate-950/80 rounded-2xl border-2 border-amber-400/50 text-amber-200 flex items-start gap-3 text-left mb-5 shadow-inner animate-pulse">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide">
                BẠN ĐANG Ở TRONG PHÒNG CHỜ • ĐỢI GV MỞ GAME
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                Hệ thống đang sẵn sàng. Ngay khi Giáo viên bấm mở game trên màn hình chính, thiết bị của bạn sẽ tự động kết nối và bắt đầu thi đấu đồng loạt theo thời gian thực cùng cả lớp!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setIsJoining(true);
              try {
                const sessions = await fetchActiveSessionsFromServer();
                const target = openSession || (sessions && sessions.length > 0 ? sessions[0] : null);
                if (target && pendingStudent) {
                  await joinSession(target, pendingStudent.name, pendingStudent.studentCode, pendingStudent.className);
                } else {
                  setIsJoining(false);
                  alert('Giáo viên đang chuẩn bị phòng thi. Khi giáo viên mở bài trên màn hình lớn, máy bạn sẽ tự động chuyển vào thi!');
                }
              } catch (e) {
                setIsJoining(false);
              }
            }}
            disabled={isJoining}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-[0_0_25px_rgba(52,211,153,0.35)] transition-all cursor-pointer mb-3 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isJoining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang kết nối vào phòng thi...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>BẤM ĐỂ VÀO PHÒNG THI NGAY</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsWaitingForTeacherSession(false);
              setPendingStudent(null);
            }}
            className="text-xs text-slate-400 hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
          >
            Đổi mã học sinh khác ➔
          </button>
        </div>
      </CyberSpaceBackground>
    );
  }

  // 1B. JOIN ROOM SCREEN (Đăng nhập bằng mã học sinh từ Trang Quản trị)
  if (!joinedSession) {
    return (
      <CyberSpaceBackground stationColor="#C084FC" className="flex flex-col items-center justify-center p-4 sm:p-6 select-none min-h-[100dvh]">
        <div className="w-full max-w-md glass-pastel-card-glow rounded-[2rem] p-6 sm:p-8 shadow-[0_0_60px_rgba(192,132,252,0.25)] relative border-2 border-purple-400/35 backdrop-blur-2xl">
          
          {/* Brand & Title */}
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-400/20 via-purple-400/20 to-sky-400/20 border-2 border-purple-300/40 rounded-3xl flex items-center justify-center shadow-[0_0_25px_rgba(192,132,252,0.4)]">
              <Gamepad2 className="w-9 h-9 text-purple-300" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-lobster text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-pink-300 to-amber-300 mb-1 tracking-wide">
            Vào Phòng Chờ
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm text-center font-medium mb-4">
            Đăng nhập bằng Mã học sinh (được cấp từ Trang Quản Trị)
          </p>

          {/* System Notification Banner */}
          {openSession?.status === 'ROUND2' ? (
            <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/25 via-teal-500/25 to-cyan-500/25 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_35px_rgba(16,185,129,0.4)] flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-400/25 border border-emerald-300 flex items-center justify-center flex-shrink-0 text-xl">
                  🌱
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-200">GIAI ĐOẠN 2 ĐANG DIỄN RA</div>
                  <div className="text-sm sm:text-base font-black text-white">
                    🚀 Vòng 2: Tranh tài sản phẩm môi trường (Top 18 - 6 nhóm)
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-200 text-left">
                Học sinh đăng nhập bằng mã, bắt buộc phải thi đấu Vòng 1. Khi nằm trong Top 18 bạn có điểm EXP cao nhất mới thực hiện được chức năng nộp bài nhóm!
              </p>
            </div>
          ) : openSession ? (
            <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-sky-500/20 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.35)] flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/25 border border-emerald-300 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-300 animate-spin" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-200">THÔNG BÁO TỪ HỆ THỐNG</div>
                <div className="text-sm sm:text-base font-black text-white">
                  🎉 Giáo viên đã mở phòng thi
                </div>
                <div className="text-[11px] text-emerald-200/90 mt-0.5">
                  Nhập mã học sinh để vào phòng chờ sẵn sàng chơi đồng loạt!
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-5 p-3.5 rounded-2xl bg-slate-950/70 border border-purple-400/40 text-purple-200 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />
              <div className="text-left">
                <div className="text-[10px] font-black uppercase tracking-wider text-purple-300">SẴN SÀNG VÀO PHÒNG CHỜ</div>
                <div className="text-xs text-slate-300">
                  Nhập mã học sinh của bạn để vào phòng chờ trước. Khi GV mở game, bạn sẽ bắt đầu thi đấu ngay lập tức!
                </div>
              </div>
            </div>
          )}

          {/* Teacher Broadcast Announcement if openSession has one */}
          {openSession?.announcement?.message && (
            <div className="mb-4 p-3.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border-2 border-amber-400 rounded-2xl flex items-center gap-3 text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.3)] animate-pulse text-left">
              <Megaphone className="w-5 h-5 text-amber-300 flex-shrink-0 animate-bounce" />
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                  THÔNG BÁO TỪ GIÁO VIÊN
                </div>
                <div className="text-xs sm:text-sm font-bold text-white leading-snug">
                  {openSession.announcement.message}
                </div>
              </div>
            </div>
          )}

          {/* Form: Login by Student Code */}
          <form onSubmit={handleJoinByCode} className="space-y-4 mb-5">
            {/* Input Student Code */}
            <div>
              <label className="block text-xs font-black text-purple-200 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-purple-300" />
                  <span>MÃ HỌC SINH CỦA BẠN (MÃ SỐ):</span>
                </span>
                {detectedStudent && (
                  <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Đã nhận diện
                  </span>
                )}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="VD: HS01, HS02, 230101..." 
                  value={studentCodeInput} 
                  maxLength={25}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck="false"
                  autoFocus
                  onChange={e => {
                    setStudentCodeInput(e.target.value.toUpperCase());
                    if (joinError) setJoinError('');
                  }}
                  className="w-full py-4 px-4 bg-slate-950/90 border-2 border-purple-400/50 rounded-2xl font-mono font-black text-center text-xl sm:text-2xl text-sky-200 tracking-[0.2em] uppercase placeholder:tracking-normal placeholder:font-normal placeholder:text-sm placeholder-slate-500 focus:border-pink-400 focus:shadow-[0_0_25px_rgba(244,114,182,0.35)] outline-none transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                Chỉ sử dụng mã học sinh đã được thêm từ Trang Quản Trị.
              </p>
            </div>

            {/* Student Name Verification Card */}
            {detectedStudent ? (
              <div className="p-3.5 bg-gradient-to-br from-teal-500/20 via-emerald-500/15 to-slate-950/80 border-2 border-teal-400/60 rounded-2xl animate-in zoom-in-95 duration-200 shadow-[0_0_20px_rgba(45,212,191,0.2)]">
                <div className="flex items-center justify-between text-xs text-teal-300 font-bold mb-1">
                  <span>THÍ SINH ĐÃ XÁC NHẬN:</span>
                  <span className="px-2 py-0.5 bg-teal-400/20 rounded font-mono font-black text-teal-200">{detectedStudent.studentCode}</span>
                </div>
                <div className="text-lg sm:text-xl font-black text-white">
                  👤 {detectedStudent.name}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300 mt-1.5 pt-1.5 border-t border-teal-400/20">
                  <span>Lớp: <strong className="text-teal-200">{detectedStudent.className}</strong></span>
                  <span className="text-[11px] text-emerald-300 font-semibold">✓ Khớp danh sách Quản trị</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-950/70 border border-purple-400/30 rounded-2xl text-center text-xs text-slate-400">
                {studentCodeInput.trim() ? (
                  <span className="text-amber-300 font-medium">
                    ⚠️ Mã «{studentCodeInput.trim().toUpperCase()}» chưa có trong danh sách từ Trang Quản Trị. Vui lòng kiểm tra lại chính xác mã số!
                  </span>
                ) : (
                  <span>
                    Nhập chính xác Mã học sinh (VD: HS01, HS02...) do Giáo viên hoặc Quản trị viên cấp.
                  </span>
                )}
              </div>
            )}

            {/* Error Message */}
            {joinError && (
              <div className="p-3 bg-rose-500/20 border border-rose-400/50 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs font-semibold animate-in fade-in zoom-in-95 duration-150">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{joinError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isJoining || !detectedStudent}
              className="w-full py-4 px-6 bg-gradient-to-r from-pink-400 via-purple-400 to-sky-400 hover:from-pink-300 hover:via-purple-300 hover:to-sky-300 text-slate-950 font-black text-base sm:text-lg rounded-2xl shadow-[0_0_30px_rgba(192,132,252,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed btn-modern-shine btn-modern-glow"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                  <span>ĐANG KẾT NỐI PHÒNG CHỜ...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>VÀO PHÒNG CHỜ (CHỜ GV MỞ GAME)</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Notice */}
          <div className="p-3 bg-slate-950/60 border border-purple-300/20 rounded-2xl text-[11px] text-slate-300 leading-relaxed text-center mb-4">
            <span className="text-purple-300 font-bold">✨ Quy trình:</span> Học sinh nhập mã số của mình ➔ Vào phòng chờ ➔ GV mở game ➔ Toàn lớp thi đấu đồng loạt theo thời gian thực ➔ Top 18 EXP nộp bài Vòng 2!
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <Link to="/" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Về Trang chủ
            </Link>
            <Link to="/judge" className="text-amber-300 hover:text-yellow-200 font-bold transition-colors">
              ⚖️ Giám khảo / GV chấm thi (Mã: 123) ➔
            </Link>
          </div>
        </div>
      </CyberSpaceBackground>
    );
  }

  // ==========================================
  // 1.5. GAME STOPPED BY TEACHER (GV thoát về trang chủ để chuẩn bị game mới)
  // Màn hình HS lập tức về trang chủ để bắt đầu game mới
  // ==========================================
  if (joinedSession && (joinedSession.status === 'CLOSED' || joinedSession.isClosed || joinedSession.hostLeft)) {
    localStorage.removeItem('reconnect_session_id');
    localStorage.removeItem('reconnect_student_code');
    sessionStorage.setItem('game_ended_notice', 'true');
    handleLeaveSession();
    navigate('/');
    return null;
  }

  // ==========================================
  // 2. WAITING IN LOBBY SCREEN (Phòng chờ thi đấu)
  // Học sinh luôn ở phòng chờ khi: phiên ở WAITING hoặc GV chưa mở câu hỏi (isQuestionOpen !== true)
  // GV là người điều khiển toàn bộ: Chỉ khi GV bấm "MỞ CÂU HỎI", câu hỏi mới hiển thị đồng loạt trên mọi thiết bị
  // ==========================================
  if (joinedSession.status === 'WAITING' || (joinedSession.status === 'ACTIVE' && joinedSession.isQuestionOpen !== true)) {
    const isWaitingQuestion = joinedSession.status === 'ACTIVE' && joinedSession.isQuestionOpen !== true;

    return (
      <CyberSpaceBackground stationColor="#C084FC" className="flex flex-col items-center justify-center p-4 sm:p-6 select-none min-h-[100dvh]">
        {renderTeacherAnnouncementToast()}
        {renderTeacherAnnouncementModal()}
        <div className="w-full max-w-4xl glass-pastel-card-glow rounded-[2rem] p-5 sm:p-8 flex flex-col items-center shadow-[0_0_60px_rgba(192,132,252,0.25)] border-2 border-purple-400/35 relative backdrop-blur-2xl">
          
          {/* Top Bar inside Card */}
          <div className="w-full flex items-center justify-between pb-4 mb-4 border-b border-purple-300/20 text-xs">
            <button
              onClick={handleLeaveSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-400/40 transition-all font-bold cursor-pointer"
              title="Rời phòng và nhập lại"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Rời phòng</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-400/40 rounded-xl font-mono font-black text-purple-200 shadow-sm text-xs">
                MÃ HS: {playerInfo?.studentCode || 'HS'} • LỚP: {playerInfo?.className || 'Chung'}
              </span>
              <button
                onClick={toggleAudio}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-purple-300 cursor-pointer"
                title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Animated Radar Beacon */}
          <div className="relative mb-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-pink-400/20 via-purple-400/20 to-sky-400/20 border-2 border-purple-300/50 rounded-3xl flex items-center justify-center shadow-[0_0_35px_rgba(192,132,252,0.4)]">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500"></span>
            </span>
          </div>

          {/* Welcome & Student Name Prominently Displayed */}
          <span className="px-4 py-1.5 bg-gradient-to-r from-pink-500/25 via-purple-500/25 to-sky-500/25 border border-purple-300/50 rounded-full text-purple-200 font-black text-xs uppercase tracking-wider mb-2 shadow-sm">
            {isWaitingQuestion 
              ? `CHỜ GIÁO VIÊN MỞ CÂU HỎI SỐ ${joinedSession.currentQuestionIndex + 1}` 
              : 'BẠN ĐANG Ở TRONG PHÒNG CHỜ • GV LÀ NGƯỜI ĐIỀU KHIỂN'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-lobster text-white text-center mb-1 tracking-wide drop-shadow-md">
            {playerInfo?.name || 'Học sinh'}
          </h1>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-xl bg-teal-400/20 border border-teal-300/50 text-teal-200 text-xs sm:text-sm font-mono font-black shadow-sm">
              Mã: {playerInfo?.studentCode}
            </span>
            <span className="px-3 py-1 rounded-xl bg-purple-400/20 border border-purple-300/50 text-purple-200 text-xs sm:text-sm font-bold shadow-sm">
              Lớp: {playerInfo?.className}
            </span>
            {playerInfo?.exp !== undefined && playerInfo.exp > 0 && (
              <span className="px-3 py-1 rounded-xl bg-amber-400/20 border border-amber-300/50 text-amber-300 text-xs sm:text-sm font-black shadow-sm">
                ⚡ {playerInfo.exp} EXP
              </span>
            )}
          </div>
          <p className="text-slate-300 text-xs sm:text-sm text-center mb-4 flex flex-wrap items-center justify-center gap-1">
            <span>Đề thi:</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-pink-300 font-bold">{quiz?.title || 'Đấu trường Tri thức'}</span>
            {quiz?.questions && (
              <span className="text-slate-400">({quiz.questions.length} câu hỏi • Chơi đồng loạt)</span>
            )}
          </p>

          {/* TEACHER ANNOUNCEMENT IN LOBBY */}
          {joinedSession.announcement?.message && (
            <div className="w-full p-4 mb-4 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border-2 border-amber-300/60 rounded-2xl flex items-center gap-3 text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.25)] animate-pulse">
              <Megaphone className="w-6 h-6 text-amber-300 flex-shrink-0 animate-bounce" />
              <div className="text-left">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  THÔNG BÁO TỪ GIÁO VIÊN
                </div>
                <div className="text-sm font-bold text-white leading-snug">
                  {joinedSession.announcement.message}
                </div>
              </div>
            </div>
          )}

          {/* Live Teacher Status Banner */}
          <div className="w-full p-3.5 sm:p-4 bg-slate-950/80 rounded-2xl border-2 border-purple-400/40 flex items-center gap-3 mb-5 shadow-inner">
            <Loader2 className="w-7 h-7 text-purple-400 animate-spin flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm sm:text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-200 to-pink-200">
                {isWaitingQuestion
                  ? `Đang chờ Giáo viên bấm MỞ CÂU HỎI số ${joinedSession.currentQuestionIndex + 1}...`
                  : 'Đang chờ Giáo viên bấm mở game để bắt đầu chơi đồng loạt...'}
              </p>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                {isWaitingQuestion
                  ? 'Giáo viên là người điều khiển toàn bộ trận đấu. Ngay khi Giáo viên bấm mở câu hỏi trên máy chủ, đề thi sẽ tự động hiển thị đồng loạt trên toàn bộ thiết bị người chơi!'
                  : 'Không ai vào thẳng câu hỏi trước. Khi Giáo viên mở game, toàn lớp sẽ cùng bắt đầu làm bài thi đấu đồng loạt theo thời gian thực!'}
              </p>
            </div>
          </div>

          {/* Connected Classmates list - Prioritize horizontal full width then wrap */}
          <div className="w-full">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2 px-1">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Chiến binh cùng phòng chờ ({allPlayers.length} học sinh)</span>
              </span>
              <span className="text-[11px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Sẵn sàng thi đấu đồng loạt
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-2.5 p-4 bg-slate-950/70 rounded-2xl border border-cyan-500/30 max-h-56 overflow-y-auto">
              {allPlayers.length === 0 ? (
                <span className="text-slate-500 text-xs italic py-2 mx-auto">Đang tải danh sách người chơi...</span>
              ) : (
                allPlayers.map(p => {
                  const isMe = p.id === playerInfo?.id;
                  return (
                    <span
                      key={p.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        isMe
                          ? 'bg-cyan-400 text-slate-950 font-black shadow-[0_0_15px_rgba(0,217,255,0.6)] ring-2 ring-cyan-200'
                          : 'bg-white/10 text-slate-200 border border-white/10 hover:border-cyan-400/40'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="truncate max-w-[150px]">{p.name}</span>
                      {p.studentCode && (
                        <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-black ${isMe ? 'bg-slate-900 text-cyan-200' : 'bg-white/15 text-slate-300'}`}>
                          {p.studentCode}
                        </span>
                      )}
                      {isMe && <span className="text-[10px] font-black uppercase opacity-90">(Bạn)</span>}
                    </span>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </CyberSpaceBackground>
    );
  }

  // ==========================================
  // 3. DISQUALIFIED OR FINISHED SCREEN
  // ==========================================
  if (isDisqualified || playerInfo?.isDisqualified) {
    return (
      <CyberSpaceBackground stationColor="#F43F5E" className="p-3.5 sm:p-8 flex flex-col items-center justify-center min-h-[100dvh] overflow-y-auto py-8">
        {renderTeacherAnnouncementToast()}
        {renderTeacherAnnouncementModal()}
        <div className="max-w-lg w-full glass-neon-card-glow rounded-[2.5rem] p-6 sm:p-8 text-center shadow-[0_0_70px_rgba(244,63,94,0.4)] border border-rose-500/50">
          <div className="w-20 h-20 bg-rose-500/20 border-2 border-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(244,63,94,0.6)]">
            <AlertTriangle className="w-10 h-10 text-rose-400 animate-pulse" />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-black uppercase tracking-widest mb-2 border border-rose-500/40">
            KẾT QUẢ BỊ HỦY DO VI PHẠM
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
            ĐÃ BỊ HỦY BÀI THI
          </h1>
          <p className="text-slate-300 text-sm mb-4">
            Thí sinh: <strong className="text-white">{playerInfo?.name}</strong>
          </p>

          <div className="p-4 bg-rose-950/50 border border-rose-500/40 rounded-2xl text-left text-xs text-rose-200 mb-5 space-y-2">
            <div className="font-bold text-rose-400 text-sm">Quy chế thi chống gian lận:</div>
            <p>• Bạn đã đóng hoặc chuyển sang tab khác quá <strong>3 lần</strong> trong thời gian làm bài thi.</p>
            <p>• Điểm thi của lượt thi này bị hủy: <strong>0.00 / 10 điểm</strong>.</p>
            <p>• Hệ thống tạm khóa quyền làm bài trong <strong>30 phút</strong>.</p>
          </div>

          {lockoutInfo.isLocked && (
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-rose-500/30 mb-5 text-center">
              <span className="text-xs text-slate-400 block mb-1">Thời gian khóa còn lại:</span>
              <span className="text-2xl font-mono font-black text-rose-400">
                {Math.floor(lockoutInfo.remainingSeconds / 60)} phút {lockoutInfo.remainingSeconds % 60} giây
              </span>
            </div>
          )}

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all border border-white/10"
          >
            <Home className="w-4 h-4" /> Về Trang chủ
          </Link>
        </div>
      </CyberSpaceBackground>
    );
  }

  // ==========================================
  // ROUND 2: TRANH TÀI SẢN PHẨM & DỰ ÁN MÔI TRƯỜNG
  // ==========================================
  if (joinedSession.status === 'ROUND2') {
    const myCode = (playerInfo?.studentCode || studentCodeInput || '').trim().toUpperCase();
    const myName = (playerInfo?.name || name || '').trim().toLowerCase();

    const myTeam = joinedSession.round2Groups?.find(g => 
      g.members?.some(m => 
        (myCode && m.studentCode && m.studentCode.toUpperCase() === myCode) ||
        (myName && m.name.toLowerCase() === myName)
      )
    );

    // 1. Kiểm tra học sinh đã hoàn thành Vòng Kiến thức (Vòng 1) chưa
    const hasPassedKnowledgeRound = Boolean(
      playerInfo && (
        (playerInfo.exp !== undefined && playerInfo.exp > 0) ||
        (playerInfo.correctCount !== undefined && playerInfo.correctCount > 0) ||
        (playerInfo.answers && Object.keys(playerInfo.answers).length > 0)
      )
    );

    // 2. Kiểm tra học sinh có thuộc Top 18 bạn có điểm EXP cao nhất không (Buộc phải hoàn thành Vòng 1 và nằm trong top 18)
    const isTop18 = Boolean(
      hasPassedKnowledgeRound && (
        myTeam || 
        top18PlayersByExp.some(p => 
          p.id === playerInfo?.id ||
          (myCode && p.studentCode && p.studentCode.trim().toUpperCase() === myCode) ||
          (myName && p.name && p.name.trim().toLowerCase() === myName)
        )
      )
    );
    const isTop16 = isTop18;

    const myRank = sortedPlayers.findIndex(p => p.id === playerInfo?.id) + 1;

    const submissions = {
      ...extractSubmissionsMap(joinedSession),
      ...round2Submissions
    };
    const scores = extractScoresMap(joinedSession);

    // Calculate ranked teams by total judge score (only for teams with >= 3 judges)
    const teamTotals = ROUND_2_GROUPS_CONFIG.map(team => {
      const teamScores = scores[team.id] || {};
      let total = 0;
      let ratedJudgesCount = 0;
      ['GK01', 'GK02', 'GK03', 'GK04', 'GK05'].forEach(gk => {
        const val = typeof teamScores[gk] === 'number' ? teamScores[gk] : (gk === 'GK01' && typeof teamScores['GK'] === 'number' ? teamScores['GK'] : undefined);
        if (typeof val === 'number') {
          total += val;
          ratedJudgesCount++;
        }
      });
      return { id: team.id, total, ratedJudgesCount };
    })
    .filter(t => t.ratedJudgesCount >= 3)
    .sort((a, b) => b.total - a.total);

    const handleOpenProductImage = (url: string) => {
      if (!url) return;
      if (url.startsWith('data:image')) {
        const newWin = window.open('', '_blank');
        if (newWin) {
          newWin.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Sản phẩm dự thi - Vòng 2</title>
                <style>
                  body { margin: 0; background: #0B0F1E; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
                  img { max-width: 95vw; max-height: 90vh; border-radius: 16px; box-shadow: 0 0 50px rgba(0,255,200,0.3); border: 2px solid #10B981; }
                  h2 { color: #fff; margin-bottom: 12px; font-weight: 800; }
                </style>
              </head>
              <body>
                <h2>Sản phẩm dự thi Vòng 2 • Từ dĩa ăn sạch đến thành phố sạch</h2>
                <img src="${url}" alt="Sản phẩm dự thi" />
              </body>
            </html>
          `);
          newWin.document.close();
          return;
        }
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
      <CyberSpaceBackground stationColor="#10B981" className="p-3 sm:p-6 min-h-[100dvh] flex flex-col justify-between select-none relative">
        {renderTeacherAnnouncementToast()}
        {renderTeacherAnnouncementModal()}
        {/* Real-time Submissions Toast Notice */}
        {submissionNotification && (
          <div className="fixed top-4 left-4 right-4 z-50 p-4 bg-slate-950 border-2 border-emerald-400 text-white rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.55)] flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl flex-shrink-0 animate-bounce">🔔</span>
              <span className="text-xs sm:text-sm font-black text-emerald-300 truncate">{submissionNotification}</span>
            </div>
            <button
              onClick={() => setSubmissionNotification(null)}
              className="text-[10px] text-slate-400 hover:text-white font-bold px-2.5 py-1 rounded-xl bg-white/10 flex-shrink-0"
            >
              Đóng
            </button>
          </div>
        )}

        <div className="max-w-4xl w-full mx-auto space-y-4 my-auto py-4">
          
          {/* Top Header Card */}
          <div className="glass-neon-card-glow rounded-3xl p-4 sm:p-6 border-2 border-emerald-400/60 shadow-[0_0_50px_rgba(16,185,129,0.25)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-400/20 border-2 border-emerald-400 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                {isTop18 ? '🏆' : '🔭'}
              </div>
              <div className="text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-wider mb-1">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" /> {isTop18 ? 'THI ĐẤU VÒNG 2 • TOP 18 XUẤT SẮC' : 'KHÁN GIẢ THEO DÕI • VÒNG 2 SẢN PHẨM'}
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white">
                  Từ dĩa ăn sạch đến thành phố sạch
                </h1>
                <p className="text-slate-300 text-xs sm:text-sm flex flex-wrap items-center gap-1.5">
                  <span>Thí sinh:</span>
                  <strong className="text-white">{playerInfo?.name}</strong>
                  {playerInfo?.className && <span>({playerInfo.className})</span>}
                  <span>• Điểm EXP:</span>
                  <span className="text-amber-300 font-mono font-bold">⚡ {playerInfo?.exp ?? 0}</span>
                  {myRank > 0 && <span className="text-slate-400 font-mono font-semibold">• Hạng #{myRank}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Teacher Announcement Button */}
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(true)}
                className={`px-3 py-2.5 rounded-2xl border text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  joinedSession?.announcement?.message
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.6)] animate-pulse'
                    : 'bg-white/10 hover:bg-white/20 border-white/15 text-slate-300'
                }`}
                title="Xem thông báo từ Giáo viên"
              >
                <Megaphone className="w-4 h-4" />
                <span>{joinedSession?.announcement?.message ? 'TB Giáo viên' : 'Thông báo'}</span>
              </button>

              {/* Submit button ONLY shown for qualified Top 18 students */}
              {isTop18 ? (
                <button
                  type="button"
                  onClick={() => setShowRound2SubmitModal(true)}
                  className="px-5 py-3 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center gap-2 cursor-pointer active:scale-95 transition-all btn-modern-shine btn-modern-glow"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>NỘP BÀI CHO NHÓM ➔</span>
                </button>
              ) : (
                <div className="px-4 py-2 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-xs">
                  CỔ VŨ TRỰC TIẾP 📣
                </div>
              )}
            </div>
          </div>

          {/* Real-time Teacher Broadcast in Round 2 */}
          {joinedSession?.announcement?.message && (
            <div 
              onClick={() => setShowAnnouncementModal(true)}
              className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/25 border-2 border-amber-300/80 shadow-[0_0_25px_rgba(251,191,36,0.3)] flex items-center justify-between gap-3 text-left cursor-pointer hover:border-amber-200 transition-all animate-pulse"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center flex-shrink-0 text-amber-300 animate-bounce">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                    THÔNG BÁO TỪ GIÁO VIÊN
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {joinedSession.announcement.message}
                  </div>
                </div>
              </div>
              <span className="text-xs text-amber-300 font-bold underline flex-shrink-0 hidden xs:inline">
                Xem chi tiết ➔
              </span>
            </div>
          )}

          {/* Student Status Banner */}
          {isTop18 ? (
            myTeam ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-slate-950 border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl">
                    {myTeam.icon}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-emerald-300">BẠN ĐANG THUỘC NHÓM THI:</div>
                    <div className="text-lg sm:text-xl font-black text-white">{myTeam.name}</div>
                    <div className="text-xs text-slate-300 italic">{myTeam.slogan}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Đồng đội ({myTeam.members.length}):</span>
                  {myTeam.members.map(m => (
                    <span key={m.id} className="px-2 py-0.5 rounded-lg bg-white/10 text-white font-bold text-xs border border-white/10">
                      {m.name} {m.className ? `(${m.className})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-400/40 text-left flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">Bạn thuộc Top 18 thí sinh xuất sắc!</div>
                  <div className="text-xs text-slate-300">
                    Hãy bấm nút &quot;Nộp bài cho nhóm&quot; để chọn nhóm của bạn và gửi hình ảnh/liên kết sản phẩm dự thi!
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRound2SubmitModal(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-md hover:bg-emerald-300 transition-all flex-shrink-0"
                >
                  Chọn nhóm & nộp bài
                </button>
              </div>
            )
          ) : (
            /* Spectator / Outside Top 16 Notice */
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-slate-950 border-2 border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.25)] flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-3xl flex-shrink-0">
                  {hasPassedKnowledgeRound ? '👏' : '⚠️'}
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-amber-300">
                    {hasPassedKnowledgeRound ? 'KẾT QUẢ VÒNG KIẾN THỨC' : 'CHƯA THAM GIA VÒNG KIẾN THỨC'}
                  </div>
                  <div className="text-base sm:text-lg font-black text-white">
                    {hasPassedKnowledgeRound 
                      ? `Thứ hạng: #${myRank > 0 ? myRank : '---'} • Điểm tích luỹ: ⚡ ${playerInfo?.exp ?? 0} EXP`
                      : 'Học sinh phải vượt qua Vòng Kiến thức mới đủ điều kiện vào Vòng 2'}
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Chức năng nộp bài nhóm Vòng 2 chỉ mở cho Top 18 bạn có điểm EXP cao nhất đã thi đấu Vòng 1. Bạn đang ở chế độ Khán giả để theo dõi và cổ vũ 6 nhóm thi đấu!
                  </div>
                </div>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 font-bold text-xs whitespace-nowrap">
                CHẾ ĐỘ CỔ VŨ 📣
              </div>
            </div>
          )}

          {/* 6 Teams Grid Real-time Overview (Compact 3x2: 3 nhóm hàng trên, 3 nhóm hàng dưới) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {ROUND_2_GROUPS_CONFIG.map((team, idx) => {
              const sub = submissions[team.id];
              const hasSub = !!sub;
              const teamScores = scores[team.id] || {};
              let total = 0;
              let ratedJudgesCount = 0;
              ['GK01', 'GK02', 'GK03', 'GK04', 'GK05'].forEach(gk => {
                const val = typeof teamScores[gk] === 'number' ? teamScores[gk] : (gk === 'GK01' && typeof teamScores['GK'] === 'number' ? teamScores['GK'] : undefined);
                if (typeof val === 'number') {
                  total += val;
                  ratedJudgesCount++;
                }
              });

              const isEligible = ratedJudgesCount >= 3;
              const rankIdx = isEligible ? teamTotals.findIndex(t => t.id === team.id) : -1;
              const isRank1 = isEligible && total > 0 && rankIdx === 0;
              const isRank2 = isEligible && total > 0 && rankIdx === 1;
              const isRank3 = isEligible && total > 0 && rankIdx === 2;

              return (
                <div
                  key={team.id}
                  className={`p-3 rounded-2xl border-2 ${team.borderColor} bg-slate-900/90 shadow-md flex flex-col justify-between gap-2 text-left backdrop-blur-xl relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl flex-shrink-0">{team.icon}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1">
                          <h3 className="font-black text-white text-sm sm:text-base leading-tight truncate">{team.name}</h3>
                          {isRank1 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase bg-yellow-400 text-slate-950 border border-yellow-300">
                              👑 TOP 1
                            </span>
                          )}
                          {isRank2 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase bg-cyan-400 text-slate-950 border border-cyan-300">
                              🥈 TOP 2
                            </span>
                          )}
                          {isRank3 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-300">
                              🥉 TOP 3
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">Đội #{idx + 1}</span>
                      </div>
                    </div>
                    {hasSub ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/40 flex items-center gap-0.5 whitespace-nowrap flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Đã nộp
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-400/40 flex items-center gap-0.5 whitespace-nowrap flex-shrink-0">
                        <Clock className="w-3 h-3" /> Chờ nộp
                      </span>
                    )}
                  </div>

                  {/* Team Members List (Hiển thị đầy đủ nhất thành viên 6 nhóm) */}
                  {(() => {
                    const groupInSession = joinedSession.round2Groups?.find(g => g.id === team.id || g.name === team.name);
                    const members = groupInSession?.members || [];
                    if (members.length === 0) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1 my-1 p-1 rounded-lg bg-slate-950/60 border border-white/10 text-[9px]">
                        <span className="text-[8px] font-black uppercase text-slate-400 mr-0.5">
                          Thành viên ({members.length}):
                        </span>
                        {members.map(m => (
                          <span key={m.id} className="px-1.5 py-0.2 rounded bg-white/10 text-white font-bold text-[9px] border border-white/10">
                            {m.name} {m.className && <span className="text-cyan-300 font-mono">({m.className})</span>}
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Submission details (Supports up to 2 products) */}
                  {(() => {
                    const prods = getTeamProducts(sub);
                    if (prods.length === 0) {
                      return (
                        <div className="p-2 rounded-xl bg-slate-950/60 border border-white/10 flex items-center gap-2 text-slate-500 text-[11px] italic">
                          <span>Chưa có sản phẩm nộp...</span>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1.5">
                        {prods.map(prod => (
                          <div 
                            key={prod.id}
                            className="p-1.5 rounded-xl bg-slate-950/80 border border-white/10 flex items-center gap-2 text-left hover:border-emerald-400/40 transition-colors"
                          >
                            {prod.isImage && prod.url ? (
                              <div 
                                onClick={(e) => openProductInNewTab(prod.url, prod.title, e)}
                                className="w-12 h-10 rounded-lg overflow-hidden border border-emerald-400/50 flex-shrink-0 cursor-pointer group"
                                title="Bấm để mở xem ảnh sản phẩm trên tab mới"
                              >
                                <img src={prod.url} alt={prod.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                              </div>
                            ) : prod.isAudio && prod.url ? (
                              <div 
                                onClick={(e) => openProductInNewTab(prod.url, prod.title, e)}
                                className="w-12 h-10 rounded-lg bg-purple-500/20 border border-purple-400/40 flex flex-col items-center justify-center text-purple-300 gap-0.5 flex-shrink-0 cursor-pointer"
                                title="Nghe âm thanh trên tab mới"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                <span className="text-[7px] uppercase font-black">Audio</span>
                              </div>
                            ) : (
                              <div 
                                onClick={(e) => openProductInNewTab(prod.url, prod.title, e)}
                                className="w-12 h-10 rounded-lg bg-emerald-500/10 border border-emerald-400/30 flex flex-col items-center justify-center text-emerald-300 gap-0.5 flex-shrink-0 cursor-pointer"
                                title="Mở trên tab mới"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span className="text-[7px] uppercase font-black">Tệp</span>
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`px-1.5 py-0.2 rounded text-[7px] font-black uppercase ${
                                  prod.index === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'
                                }`}>
                                  SP {prod.index}
                                </span>
                                {prod.url && (
                                  <button
                                    type="button"
                                    onClick={(e) => openProductInNewTab(prod.url, prod.title, e)}
                                    className="text-[9px] text-cyan-300 hover:text-cyan-200 font-bold flex items-center gap-0.5 underline cursor-pointer"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" /> Tab mới
                                  </button>
                                )}
                              </div>
                              <div className="text-xs font-black text-white truncate" title={prod.title}>
                                {prod.title}
                              </div>
                              {prod.description && (
                                <div className="text-[9px] text-slate-400 line-clamp-1" title={prod.description}>
                                  {prod.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 6 Score Boxes */}
                  <div>
                    <div className="text-[9px] font-black uppercase text-amber-300 mb-0.5 flex items-center justify-between">
                      <span>Điểm GK (Thang 100):</span>
                      <span className={`font-mono font-bold ${ratedJudgesCount >= 3 ? 'text-yellow-300' : 'text-amber-400/80'}`}>
                        {ratedJudgesCount >= 3 ? `Tổng: ${total}đ` : `Chờ (${ratedJudgesCount}/3 GK)`}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1 text-center">
                      {['GK01', 'GK02', 'GK03', 'GK04', 'GK05'].map((gk, gIdx) => {
                        const scoreVal = typeof teamScores[gk] === 'number' ? teamScores[gk] : (gk === 'GK01' && typeof teamScores['GK'] === 'number' ? teamScores['GK'] : undefined);
                        const isG = typeof scoreVal === 'number';
                        return (
                          <div key={gk} className={`p-1 rounded-md border text-[9px] font-mono ${isG ? 'bg-slate-950 border-cyan-400 text-cyan-300 font-bold' : 'bg-slate-950/60 border-white/10 text-slate-600'}`}>
                            <div className="text-[7px] text-slate-400 uppercase">{gk === 'GK01' ? 'GK1' : `GK${gIdx + 1}`}</div>
                            <div>{isG ? scoreVal : '-'}</div>
                          </div>
                        );
                      })}
                      {ratedJudgesCount >= 3 ? (
                        <div className="p-1 rounded-md border border-yellow-400 bg-yellow-400/10 text-[9px] font-mono font-black text-yellow-300">
                          <div className="text-[7px] text-yellow-300 uppercase">TỔNG</div>
                          <div>{total}</div>
                        </div>
                      ) : (
                        <div className="p-1 rounded-md border border-dashed border-amber-400/40 bg-slate-950/60 text-[8px] font-mono font-bold text-amber-400/80" title="Cần ít nhất 3 GK chấm để hiện tổng điểm">
                          <div className="text-[7px] text-slate-400 uppercase">TỔNG</div>
                          <div>{ratedJudgesCount}/3</div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <Link to="/" className="hover:text-white transition-colors flex items-center gap-1">
              <Home className="w-3.5 h-3.5" /> Về Trang chủ
            </Link>
            <div className="flex items-center gap-3">
              {isTop16 && (
                <button
                  type="button"
                  onClick={() => setShowRound2SubmitModal(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 font-bold cursor-pointer transition-all"
                >
                  📦 Nộp bài / Cập nhật sản phẩm
                </button>
              )}
              <Link to="/judge" className="text-amber-300 hover:text-yellow-200 font-bold">
                ⚖️ Giám khảo chấm điểm ➔
              </Link>
            </div>
          </div>

        </div>

        {/* Modal Submit - Only accessible to Top 16 students */}
        {isTop16 && (
          <Round2StudentSubmitModal
            isOpen={showRound2SubmitModal}
            onClose={() => setShowRound2SubmitModal(false)}
            sessionId={joinedSession.id}
            playerName={playerInfo?.name || name}
            studentCode={playerInfo?.studentCode || studentCodeInput}
            round2Groups={joinedSession.round2Groups}
            existingSubmissions={extractSubmissionsMap(joinedSession)}
          />
        )}
      </CyberSpaceBackground>
    );
  }

  if (joinedSession.status === 'FINISHED' || isSelfFinished) {
    const titleData = getPlayerTitle(myRank, totalRoomPlayers);
    const isInTop3 = myRank <= 3;
    const isExam = joinedSession.gameMode === 'EXAM_AUTO';

    const myCode = (playerInfo?.studentCode || studentCodeInput || '').trim().toUpperCase();
    const myName = (playerInfo?.name || name || '').trim().toLowerCase();
    const hasCompletedRound1 = Boolean(
      playerInfo && (
        (playerInfo.exp !== undefined && playerInfo.exp > 0) ||
        (playerInfo.correctCount !== undefined && playerInfo.correctCount > 0) ||
        (playerInfo.answers && Object.keys(playerInfo.answers).length > 0)
      )
    );
    const isTop18Eligible = Boolean(
      hasCompletedRound1 && (
        joinedSession.round2Groups?.some(g => 
          g.members?.some(m => 
            (myCode && m.studentCode && m.studentCode.toUpperCase() === myCode) ||
            (myName && m.name.toLowerCase() === myName)
          )
        ) ||
        top18PlayersByExp.some(p => 
          p.id === playerInfo?.id ||
          (myCode && p.studentCode && p.studentCode.trim().toUpperCase() === myCode) ||
          (myName && p.name && p.name.trim().toLowerCase() === myName)
        )
      )
    );

    return (
      <CyberSpaceBackground stationColor="#FACC15" className="p-3.5 sm:p-8 flex flex-col items-center justify-center min-h-[100dvh] overflow-y-auto py-8">
        {renderTeacherAnnouncementToast()}
        {renderTeacherAnnouncementModal()}
        <div className="max-w-lg w-full glass-neon-card-glow rounded-[2.5rem] p-6 sm:p-8 text-center shadow-[0_0_70px_rgba(250,204,21,0.3)]">
          
          <div className="w-20 h-20 bg-yellow-400/20 border-2 border-yellow-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(250,204,21,0.5)] animate-bounce">
            <Trophy className="w-10 h-10 text-yellow-400" />
          </div>
          
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-yellow-400/20 text-yellow-300 text-xs font-black uppercase tracking-widest mb-2 border border-yellow-400/40">
            <Sparkles className="w-4 h-4" /> {isSelfFinished && joinedSession.status !== 'FINISHED' ? 'ĐÃ NỘP BÀI THÀNH CÔNG!' : 'PHIÊN THI ĐÃ KẾT THÚC'}
          </div>

          <h1 className="text-3xl font-black text-white mb-1">
            {isSelfFinished && joinedSession.status !== 'FINISHED' ? 'ĐÃ HOÀN THÀNH BÀI THI' : 'GIÁO VIÊN ĐÃ KẾT THÚC PHIÊN THI'}
          </h1>
          <p className="text-slate-300 text-sm mb-4">Chiến binh: <strong className="text-white">{playerInfo?.name}</strong></p>

          {/* Honor Badge */}
          <div className="mb-5 p-3.5 bg-gradient-to-r from-yellow-500/20 via-purple-500/20 to-cyan-500/20 border-2 border-yellow-400/60 rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(250,204,21,0.25)]">
            <span className="text-2xl">{titleData.badge}</span>
            <span className="font-black text-base text-yellow-300 uppercase tracking-wide">
              {titleData.title} (HẠNG #{myRank})
            </span>
          </div>

          {/* Level & EXP stats */}
          <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-cyan-500/30 mb-4">
            <div className="flex items-center justify-between text-xs font-black mb-1.5">
              <span className="text-cyan-300">LEVEL {myLevelData.level}</span>
              <span className="text-amber-300 font-mono">⚡ {myLevelData.currentExp} EXP</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-cyan-400 to-yellow-400 h-full transition-all duration-500" 
                style={{ width: `${myLevelData.progressPercent}%` }}
              />
            </div>
          </div>

          {/* Performance Summary Grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-0.5">Xếp hạng phòng</span>
              <span className="text-2xl font-black text-white font-mono">#{myRank}</span>
              <span className="text-[10px] text-slate-400 block">/ {totalRoomPlayers} học sinh</span>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Số câu đúng</span>
              <span className="text-2xl font-black text-white font-mono">{playerInfo?.correctCount || 0}</span>
              <span className="text-[10px] text-slate-400 block">/ {quiz?.questions.length || 0} câu</span>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold text-amber-400 block mb-0.5">Điểm số EXP</span>
              <span className="text-2xl font-black text-yellow-300 font-mono">⚡ {playerInfo?.exp || 0}</span>
              <span className="text-[10px] text-slate-400 block">EXP tích lũy</span>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold text-purple-400 block mb-0.5">Tổng thời gian</span>
              <span className="text-2xl font-black text-white font-mono">{playerInfo?.totalTimeSpent || 0}s</span>
              <span className="text-[10px] text-slate-400 block">giây làm bài</span>
            </div>
          </div>

          {/* Reveal Answers Button */}
          <button
            onClick={() => {
              gameAudio.playClick();
              setShowAllAnswers(!showAllAnswers);
            }}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-sm transition-all flex items-center justify-center gap-2 mb-4 cursor-pointer shadow-lg active:scale-98"
          >
            {showAllAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showAllAnswers ? 'Ẩn đáp án đề thi' : 'Xem toàn bộ đáp án đề thi'}</span>
          </button>

          {showAllAnswers && quiz && (
            <div className="space-y-2 text-left max-h-56 overflow-y-auto pr-1 mb-4">
              {quiz.questions.map((q, i) => (
                <div key={i} className="p-3 bg-slate-900/90 border border-white/10 rounded-xl text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-cyan-300">Câu {i + 1} ({q.type})</span>
                  </div>
                  {q.type === 'TF' ? (
                    <div className="font-mono text-yellow-300 text-xs font-bold">
                      {formatTFAnswer(q.answer, i + 1)}
                    </div>
                  ) : q.type === 'MC' ? (
                    <div className="text-slate-200">
                      Đáp án đúng: <strong className="text-emerald-400 font-mono text-sm">{q.answer}</strong>
                    </div>
                  ) : (
                    <div className="text-slate-200">
                      Đáp án: <strong className="text-emerald-400 font-mono">{q.answer}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Round 2 Callout Button on Finished Screen - ONLY FOR QUALIFIED TOP 18 */}
          {isTop18Eligible ? (
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border-2 border-emerald-400 text-left flex flex-col gap-2.5 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🌱</span>
                <div>
                  <div className="text-[10px] font-black uppercase text-emerald-300">BẠN ĐÃ LỌT VÀO TOP 18 XUẤT SẮC!</div>
                  <div className="text-sm font-black text-white">Nộp sản phẩm dự án cho nhóm thi của bạn (Vòng 2)</div>
                </div>
              </div>
              <p className="text-xs text-slate-300">
                Từ dĩa ăn sạch đến thành phố sạch • Chọn nhóm ➔ Tải ảnh/liên kết ➔ Đặt tên ➔ Nộp bài đồng bộ lên máy chiếu!
              </p>
              <button
                type="button"
                onClick={() => setShowRound2SubmitModal(true)}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 text-xs sm:text-sm font-black rounded-xl cursor-pointer shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 btn-modern-shine btn-modern-glow"
              >
                <span>📦 NỘP BÀI DỰ ÁN CHO NHÓM NGAY ➔</span>
              </button>
            </div>
          ) : (
            <div className="mb-4 p-3.5 rounded-2xl bg-slate-950/70 border border-purple-400/30 text-left flex items-start gap-3">
              <span className="text-2xl mt-0.5">🔭</span>
              <div>
                <div className="text-[10px] font-black uppercase text-purple-300">CHẾ ĐỘ KHÁN GIẢ THEO DÕI VÒNG 2</div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Chức năng nộp bài nhóm Vòng 2 chỉ mở cho Top 18 thí sinh xuất sắc nhất đã vượt qua Vòng 1. Bạn đã hoàn thành Vòng 1 với <strong className="text-amber-300 font-mono">{playerInfo?.exp ?? 0} EXP</strong>! Cùng cổ vũ 6 nhóm thi đấu nhé.
                </p>
              </div>
            </div>
          )}

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all border border-white/10"
          >
            <Home className="w-4 h-4" /> Về Trang chủ
          </Link>
        </div>

        {/* Modal Submit for Students on Finished Screen - ONLY FOR QUALIFIED TOP 18 */}
        {isTop18Eligible && (
          <Round2StudentSubmitModal
            isOpen={showRound2SubmitModal}
            onClose={() => setShowRound2SubmitModal(false)}
            sessionId={joinedSession.id}
            playerName={playerInfo?.name || name}
            studentCode={playerInfo?.studentCode || studentCodeInput}
            round2Groups={joinedSession.round2Groups}
            existingSubmissions={extractSubmissionsMap(joinedSession)}
          />
        )}
      </CyberSpaceBackground>
    );
  }

  // ==========================================
  // 4. ACTIVE QUESTION SOLVING SCREEN (GV ĐIỀU KHIỂN ĐỒNG LOẠT)
  // ==========================================
  const activeQuiz = quiz;
  const activeQIndex = joinedSession.currentQuestionIndex;
  const currentQ = activeQuiz?.questions?.[activeQIndex];
  if (!currentQ) {
    return (
      <CyberSpaceBackground stationColor="#818CF8" className="flex flex-col items-center justify-center p-4 min-h-[100dvh]">
        <div className="max-w-md w-full glass-pastel-card-glow rounded-3xl p-6 sm:p-8 text-center border-2 border-indigo-400/40">
          <Loader2 className="w-10 h-10 text-indigo-300 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-black text-white mb-2">Đang tải dữ liệu câu hỏi...</h2>
          <p className="text-xs text-slate-300 mb-5 leading-relaxed">
            Hệ thống đang đồng bộ câu hỏi số {activeQIndex + 1} từ máy chủ phòng thi.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                fetchSessionFromServer(joinedSession.id).then(data => {
                  if (data?.session) {
                    setJoinedSession(prev => ({ ...(prev || {}), ...data.session! }));
                    if (data.session.questions && data.session.questions.length > 0) {
                      setQuiz(prev => prev ? { ...prev, questions: data.session.questions! } : {
                        id: data.session.quizId || 'quiz',
                        title: 'Đấu trường Tri thức',
                        subject: 'KHTN',
                        questions: data.session.questions!,
                        createdBy: 'admin',
                        createdAt: Date.now()
                      });
                    }
                  }
                });
              }}
              className="flex-1 py-2.5 px-4 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử tải lại câu hỏi</span>
            </button>
            <button
              type="button"
              onClick={handleLeaveSession}
              className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Rời phòng
            </button>
          </div>
        </div>
      </CyberSpaceBackground>
    );
  }

  const isExamMode = joinedSession.gameMode === 'EXAM_AUTO';
  const isTF = currentQ.type === 'TF';
  const isMC = currentQ.type === 'MC';
  const isSA = currentQ.type === 'SA' || currentQ.type === 'ESSAY';

  return (
    <CyberSpaceBackground stationColor={currentStation.primaryColor} className="flex flex-col p-2 sm:p-4 min-h-[100dvh] w-full relative overflow-y-auto touch-scroll">
      <AntiCheatWarningModal
        isOpen={showViolationModal}
        violationCount={violationsCount}
        isDisqualified={isDisqualified}
        remainingSeconds={lockoutInfo.remainingSeconds}
        onAcknowledge={handleAcknowledgeViolation}
        onGoHome={() => navigate('/')}
      />

      {/* TEACHER ANNOUNCEMENT: Compact real-time toast (5s auto-dismiss) & Full detail modal */}
      {renderTeacherAnnouncementToast()}
      {renderTeacherAnnouncementModal()}

      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col xl:flex-row gap-3 sm:gap-4 items-start justify-center">
        
        {/* LEFT / CENTER: Active Quiz Area */}
        <div className="max-w-md sm:max-w-xl xl:max-w-2xl mx-auto w-full flex flex-col gap-2 sm:gap-2.5 pb-36 xl:pb-6">
          
          {/* TOP BAR: Player Name | Teacher Announcement | Top 16 | Audio | Rank */}
          <div className="glass-neon-card rounded-2xl p-2 sm:p-2.5 border border-cyan-500/30 flex flex-col gap-1.5 flex-shrink-0">
            <div className="flex items-center justify-between text-xs gap-1">
              {/* Player Name & Mode */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="font-black text-white truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[180px]">👤 {playerInfo?.name}</span>
                {isExamMode ? (
                  <span className="px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-black rounded-lg text-[9px] uppercase flex-shrink-0">
                    KIỂM TRA
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-purple-500/30 border border-purple-400/50 text-purple-300 font-black rounded-lg text-[9px] flex-shrink-0">
                    LV {String(myLevelData.level).padStart(2, '0')}
                  </span>
                )}
                {isExamMode && violationsCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-rose-500/20 border border-rose-400/50 text-rose-300 font-black rounded-lg text-[9px] flex items-center gap-1 animate-pulse flex-shrink-0" title={`Số lần chuyển màn hình: ${violationsCount}`}>
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    Lần {violationsCount}
                  </span>
                )}
              </div>

              {/* ACTION BUTTONS ON TOP MENU BAR */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                {/* 1. TEACHER ANNOUNCEMENT BUTTON ON TOP MENU (Accessible anytime) */}
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(true)}
                  className={`px-2 py-1 rounded-xl border text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 relative ${
                    joinedSession?.announcement?.message
                      ? 'bg-amber-500/30 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)] animate-pulse'
                      : 'bg-white/10 hover:bg-white/20 border-white/15 text-slate-300'
                  }`}
                  title="Xem thông báo từ Giáo viên (Bấm xem bất cứ lúc nào)"
                >
                  <Megaphone className={`w-3.5 h-3.5 ${joinedSession?.announcement?.message ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
                  <span className="text-[10px]">GV</span>
                  {joinedSession?.announcement?.message && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5 animate-ping" />
                  )}
                </button>

                {/* 2. Top 18 Drawer Button */}
                {!isExamMode && (
                  <button
                    type="button"
                    onClick={() => setShowTop18Drawer(true)}
                    className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-bold rounded-xl text-[11px] flex items-center gap-1 cursor-pointer transition-all xl:hidden"
                    title="Xem Bảng xếp hạng Top 18"
                  >
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span>Top 18</span>
                  </button>
                )}

                {/* 3. Rank & Score / Questions */}
                {isExamMode ? (
                  <span className="text-cyan-300 font-mono font-bold text-xs">
                    {activeQIndex + 1}/{activeQuiz.questions.length}
                  </span>
                ) : (
                  <>
                    <span className="text-amber-300 font-mono font-bold text-xs flex items-center gap-0.5">
                      <Zap className="w-3 h-3 fill-current text-yellow-400" /> {myLevelData.currentExp}
                    </span>
                    <span className="px-1.5 py-0.5 bg-yellow-400 text-slate-950 font-black rounded-lg text-xs font-mono">
                      #{myRank}
                    </span>
                  </>
                )}

                {/* 4. Audio Toggle */}
                <button
                  onClick={toggleAudio}
                  className="p-1 bg-white/10 hover:bg-white/20 rounded-lg text-cyan-300 cursor-pointer"
                  title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Station Indicator */}
            <div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <span>{currentStation.icon}</span>
                <span className={`text-[10px] sm:text-xs font-black uppercase ${currentStation.badgeText}`}>
                  {currentStation.name}
                </span>
              </div>
              <span className="text-slate-400 text-[10px] sm:text-[11px] font-mono">
                {isExamMode ? 'Đề thi tự đảo câu & đáp án' : `${myLevelData.currentLevelProgressExp} / 500 EXP`}
              </span>
            </div>

            {/* Level or Quiz Progress Bar */}
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 h-full transition-all duration-300"
                style={{ width: `${isExamMode ? ((activeQIndex + 1) / activeQuiz.questions.length) * 100 : myLevelData.progressPercent}%` }}
              />
            </div>
          </div>

          {/* STEAL & WAGER RESULT NOTICES */}
          {stealResultNotice && (
            <div className="p-2.5 bg-rose-500/20 border border-rose-400/50 rounded-2xl text-center text-xs font-black text-rose-200 flex items-center justify-center gap-2 shadow-md flex-shrink-0 animate-in fade-in">
              <span>{stealResultNotice}</span>
            </div>
          )}
          {wagerResultNotice && (
            <div className="p-2.5 bg-amber-500/20 border border-amber-400/50 rounded-2xl text-center text-xs font-black text-amber-200 flex items-center justify-center gap-2 shadow-md flex-shrink-0 animate-in fade-in">
              <span>{wagerResultNotice}</span>
            </div>
          )}

          {/* COMPACT POWER-UPS & SPECIAL BUFFS BAR (Nhỏ gọn phía trên câu hỏi) */}
          {!isSubmitted && !isExamMode && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1 flex-shrink-0 touch-pan-x select-none bg-slate-950/40 rounded-2xl border border-white/5">
              {/* 1. Ngôi sao may mắn (hi vọng): Từ câu 5 */}
              {activeQIndex >= 4 && !playerInfo?.usedStarOfHope && (
                <button
                  type="button"
                  onClick={handleToggleStarOfHope}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 active:scale-95 ${
                    starOfHopeActive
                      ? 'bg-amber-400 border-yellow-200 text-slate-950 ring-2 ring-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/50 text-amber-300'
                  }`}
                  title="Ngôi sao hi vọng: Đúng nhân đôi điểm câu này (Dùng 1 lần duy nhất)"
                >
                  <Star className={`w-3.5 h-3.5 ${starOfHopeActive ? 'fill-slate-950 text-slate-950' : 'fill-amber-400 text-amber-400'}`} />
                  <span>{starOfHopeActive ? '🌟 Đã bật x2 điểm' : '⭐ Sao hi vọng'}</span>
                </button>
              )}

              {/* 2. Cướp điểm Top 10: Từ câu 10 */}
              {activeQIndex >= 9 && !playerInfo?.usedSteal && (
                <button
                  type="button"
                  onClick={handleOpenStealModal}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 active:scale-95 ${
                    stealTarget
                      ? 'bg-rose-500 border-rose-300 text-white ring-2 ring-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
                      : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/50 text-rose-300'
                  }`}
                  title="Cướp điểm Top 10: Đúng cướp 30% điểm câu này của đối thủ (Dùng 1 lần duy nhất)"
                >
                  <Sword className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[120px]">{stealTarget ? `⚔️ ${stealTarget.name}` : '⚔️ Cướp điểm'}</span>
                </button>
              )}

              {/* 3. Phòng thủ: Từ câu 10 */}
              {activeQIndex >= 9 && !playerInfo?.usedDefense && (
                <button
                  type="button"
                  onClick={handleActivateDefense}
                  disabled={defenseActive || playerInfo?.currentRoundDefense}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 active:scale-95 ${
                    defenseActive || playerInfo?.currentRoundDefense
                      ? 'bg-sky-500 border-sky-300 text-slate-950 ring-2 ring-sky-300 shadow-[0_0_15px_rgba(14,165,233,0.6)]'
                      : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/50 text-sky-300'
                  }`}
                  title="Phòng thủ: Chống bị đối thủ cướp điểm ở câu này (Dùng 1 lần duy nhất)"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{defenseActive || playerInfo?.currentRoundDefense ? '🛡️ Đã bật Khiên' : '🛡️ Phòng thủ'}</span>
                </button>
              )}

              {/* 4. Cá cược EXP: Từ câu 15 */}
              {activeQIndex >= 14 && !playerInfo?.usedWagerExp && (
                <button
                  type="button"
                  onClick={handleOpenWagerModal}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 active:scale-95 ${
                    wagerExpAmount > 0
                      ? 'bg-amber-400 border-yellow-200 text-slate-950 ring-2 ring-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/50 text-amber-300'
                  }`}
                  title="Cá cược EXP: Đúng nhân đôi số EXP cược, sai bị trừ điểm (Dùng 1 lần duy nhất)"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>{wagerExpAmount > 0 ? `🎲 Cược ${wagerExpAmount} EXP` : '🎲 Cá cược EXP'}</span>
                </button>
              )}

              {/* 4. Level Buffs (x2 EXP, Loại 50:50, Khiên điểm) */}
              {POWER_UPS.map(pw => {
                const isUnlocked = myLevelData.currentExp >= pw.unlockedAtExp;
                const isActive = activePowerUp === pw.id;

                return (
                  <button
                    key={pw.id}
                    type="button"
                    onClick={() => handleActivatePowerUp(pw.id)}
                    disabled={!isUnlocked || isActive || !!activePowerUp}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 active:scale-95 ${
                      isActive 
                        ? 'bg-amber-400 border-yellow-300 text-slate-950 ring-2 ring-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.5)] font-black' 
                        : isUnlocked 
                        ? 'bg-slate-900/80 border-cyan-400/50 text-slate-200 hover:border-cyan-300' 
                        : 'bg-slate-950/40 border-white/5 text-slate-600 opacity-40 cursor-not-allowed'
                    }`}
                    title={`${pw.name}: ${pw.desc} (Yêu cầu ${pw.unlockedAtExp} EXP)`}
                  >
                    <span>{pw.icon}</span>
                    <span>{pw.name}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />}
                  </button>
                );
              })}
            </div>
          )}

        {/* MAIN QUESTION CARD (Glassmorphism + Neon) */}
        <div className="glass-neon-card-glow rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-[0_0_40px_rgba(0,217,255,0.15)] flex flex-col justify-between border border-cyan-500/35 relative">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-2 sm:pb-2.5 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 font-black px-2.5 py-0.5 sm:py-1 rounded-xl text-xs sm:text-sm">
                CÂU {String(activeQIndex + 1).padStart(2, '0')} / {String(activeQuiz.questions.length).padStart(2, '0')}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase">
                {isMC ? 'Trắc nghiệm' : isTF ? 'Đúng - Sai' : 'Trả lời ngắn'}
              </span>
            </div>
            <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2 sm:px-2.5 py-0.5 rounded-lg border border-amber-400/40">
              {isTF ? '1.0 đ' : isSA ? '0.5 đ' : 'Trắc nghiệm'}
            </span>
          </div>

          {/* ACTIVE POWER-UP NOTIFICATION */}
          {activePowerUp && !isSubmitted && !isExamMode && (
            <div className="mt-2 p-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-400/60 rounded-xl text-center text-xs font-bold text-yellow-300 flex items-center justify-center gap-2 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" />
              <span>Đang kích hoạt: {activePowerUp === 'DOUBLE_POINTS' ? '⚡ NHÂN ĐÔI ĐIỂM KHI ĐÚNG' : activePowerUp === 'FREEZE_OPTION' ? '🔮 ĐÃ KHÓA BỚT 1 ĐÁP ÁN SAI' : '👑 KHIÊN BẢO TOÀN ĐIỂM'}</span>
            </div>
          )}

          {/* ACTIVE SPECIAL MECHANICS NOTIFICATION */}
          {!isSubmitted && !isExamMode && (starOfHopeActive || stealTarget || defenseActive || playerInfo?.currentRoundDefense || wagerExpAmount > 0) && (
            <div className="mt-2 p-1.5 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-cyan-500/20 border border-amber-400/60 rounded-xl text-center text-xs font-bold text-yellow-300 flex items-center justify-center gap-2 flex-wrap flex-shrink-0">
              {starOfHopeActive && <span>🌟 Đang bật Ngôi sao hi vọng (x2 điểm khi đúng)</span>}
              {stealTarget && <span>⚔️ Mục tiêu cướp: {stealTarget.name} (30% điểm câu)</span>}
              {(defenseActive || playerInfo?.currentRoundDefense) && <span>🛡️ Đang bật Khiên phòng thủ</span>}
              {wagerExpAmount > 0 && <span>🎲 Đang cược {wagerExpAmount} EXP (Đúng x2, Sai bị trừ)</span>}
            </div>
          )}

          {/* SUBMITTED STATE: NO FEEDBACK IN EXAM MODE */}
          {isSubmitted ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4 min-h-0 overflow-y-auto">
              {isExamMode || lastSubmissionResult?.isExamMode ? (
                <div className="space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-cyan-500/20 border-2 border-cyan-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,217,255,0.4)]">
                    <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 text-cyan-400" />
                  </div>
                  <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                    ĐÃ GHI NHẬN CÂU TRẢ LỜI
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm max-w-sm mx-auto">
                    Hệ thống đã lưu bài làm của bạn thành công. Hãy bấm nút bên dưới để chuyển câu!
                  </p>
                  {answerDuration > 0 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-cyan-500/30 rounded-full text-cyan-300 font-mono text-xs">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Thời gian làm câu này: {answerDuration} giây</span>
                    </div>
                  )}

                  <div className="pt-3">
                    <button
                      onClick={handleNextExamQuestion}
                      className="px-6 py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-black rounded-xl transition-all flex items-center gap-2 mx-auto shadow-[0_0_20px_rgba(0,217,255,0.4)] cursor-pointer text-sm active:scale-98"
                    >
                      <span>{activeQIndex >= activeQuiz.questions.length - 1 ? 'Nộp bài & Hoàn thành' : 'Sang câu tiếp theo'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : lastSubmissionResult?.isCorrect ? (
                <div className="space-y-2 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.5)]">
                    <CheckCircle2 className="w-9 h-9 text-emerald-400" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                    ✨ CHÍNH XÁC TUYỆT VỜI!
                  </h2>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-400/20 border border-yellow-400/50 rounded-full text-yellow-300 font-mono font-black text-sm shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                    <span>⚡ +{lastSubmissionResult.earnedExp} EXP</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 animate-shake">
                  <div className="w-16 h-16 bg-rose-500/20 border-2 border-rose-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                    <Sparkles className="w-8 h-8 text-rose-400" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-rose-300">
                    Chưa chính xác!
                  </h2>
                  <p className="text-slate-300 text-xs max-w-xs">
                    💡 Đừng lo lắng, hãy quan sát giải thích trên máy chiếu và bứt phá ở câu tiếp theo nhé!
                  </p>
                </div>
              )}

              {/* TEACHER REVEALED ANSWER ON STUDENT DEVICE */}
              {joinedSession.showAnswer && (
                <div className="w-full max-w-md p-3 bg-emerald-500/20 border-2 border-emerald-400/70 rounded-2xl animate-in zoom-in-95 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2.5 text-left">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-black text-white">ĐÁP ÁN ĐÚNG TỪ GIÁO VIÊN: </span>
                    <span className="font-mono text-emerald-200 uppercase bg-emerald-950/70 px-2 py-0.5 rounded-lg border border-emerald-500/40 ml-1 font-black">
                      {currentQ.type === 'TF' ? 'Xem các mệnh đề đúng/sai' : currentQ.answer}
                    </span>
                  </div>
                </div>
              )}

              {/* TEACHER REVEALED EXPLANATION ON STUDENT DEVICE */}
              {joinedSession.showExplanation && currentQ.explanation && (
                <div className="w-full max-w-md p-3 bg-cyan-950/80 border border-cyan-500/40 rounded-2xl animate-in zoom-in-95 text-xs sm:text-sm text-cyan-200 leading-relaxed shadow-lg text-left">
                  <span className="font-black text-cyan-300 block mb-1">💡 GIẢI THÍCH CHI TIẾT:</span>
                  {currentQ.explanation}
                </div>
              )}

              {!isExamMode && lastSubmissionResult?.didLevelUp && (
                <div className="mt-3 px-4 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl text-white font-black text-xs uppercase tracking-wider animate-bounce shadow-[0_0_20px_rgba(244,114,182,0.5)]">
                  🎉 CHÚC MỪNG BẠN ĐÃ THĂNG CẤP LÊN LEVEL {myLevelData.level}!
                </div>
              )}

              <p className="text-slate-400 text-[11px] sm:text-xs mt-3">
                {isExamMode ? 'Chế độ thi tự động đảo câu và đáp án cho từng học sinh.' : 'Đang theo dõi màn hình máy chiếu để chuyển câu hỏi tiếp theo...'}
              </p>
            </div>
          ) : (
            /* ACTIVE QUESTION & OPTIONS */
            <div className="flex flex-col justify-between pt-2">
              
              {/* SCROLLABLE QUESTION CONTENT & OPTIONS AREA */}
              <div id="player-question-container" className="space-y-2.5 sm:space-y-3 focus:outline-none touch-pan-y pb-28 sm:pb-8">
                
                {/* Mobile portrait reading cue */}
                <div className="flex sm:hidden items-center justify-between px-2.5 py-1 bg-cyan-950/40 border border-cyan-500/20 rounded-xl text-[10px] font-bold text-cyan-200">
                  <span className="flex items-center gap-1.5">
                    <ChevronsUpDown className="w-3.5 h-3.5 text-cyan-400 animate-bounce flex-shrink-0" />
                    <span>Vuốt nhẹ để xem trọn vẹn câu hỏi & đáp án bên dưới</span>
                  </span>
                  <span className="text-slate-400 font-mono">#{activeQIndex + 1}</span>
                </div>

                {/* Full Question Text (Không giới hạn dòng, hiển thị trọn vẹn 100%) */}
                <div id="player-question-content" className="p-3.5 sm:p-4 bg-slate-900/85 rounded-2xl border border-cyan-500/35 text-sm sm:text-base font-bold text-white leading-relaxed break-words whitespace-pre-wrap max-w-full shadow-inner select-text">
                  {currentQ.content}
                </div>

                {/* TEACHER REVEALED ANSWER ON STUDENT DEVICE */}
                {joinedSession.showAnswer && (
                  <div className="p-3 bg-emerald-500/20 border-2 border-emerald-400/70 rounded-2xl animate-in zoom-in-95 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="font-black text-white">ĐÁP ÁN ĐÚNG TỪ GIÁO VIÊN: </span>
                      <span className="font-mono text-emerald-200 uppercase bg-emerald-950/70 px-2 py-0.5 rounded-lg border border-emerald-500/40 ml-1 font-black">
                        {currentQ.type === 'TF' ? 'Xem các mệnh đề đúng/sai' : currentQ.answer}
                      </span>
                    </div>
                  </div>
                )}

                {/* TEACHER REVEALED EXPLANATION ON STUDENT DEVICE */}
                {joinedSession.showExplanation && currentQ.explanation && (
                  <div className="p-3 bg-cyan-950/80 border border-cyan-500/40 rounded-2xl animate-in zoom-in-95 text-xs sm:text-sm text-cyan-200 leading-relaxed shadow-lg">
                    <span className="font-black text-cyan-300 block mb-1">💡 GIẢI THÍCH CHI TIẾT:</span>
                    {currentQ.explanation}
                  </div>
                )}

                {/* Multiple Choice Options (MC) - Chữ cái A, B, C, D nhỏ gọn & hiển thị đầy đủ phương án */}
                {isMC && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                    {['A', 'B', 'C', 'D'].map((opt, i) => {
                      const isHidden = hiddenOptionLetter === opt;
                      const isSelected = currentAnswer === opt;
                      
                      const neonStyles = [
                        { border: 'border-cyan-500/35 hover:border-cyan-400', badge: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' },
                        { border: 'border-purple-500/35 hover:border-purple-400', badge: 'bg-purple-500/20 border-purple-400/40 text-purple-300' },
                        { border: 'border-pink-500/35 hover:border-pink-400', badge: 'bg-pink-500/20 border-pink-400/40 text-pink-300' },
                        { border: 'border-emerald-500/35 hover:border-emerald-400', badge: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' },
                      ];
                      const style = neonStyles[i] || neonStyles[0];

                      if (isHidden) {
                        return (
                          <div 
                            key={opt}
                            className="w-full p-2.5 sm:p-3 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 flex items-center gap-2.5 opacity-35 cursor-not-allowed"
                          >
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center flex-shrink-0 border border-white/10 bg-slate-900 text-slate-500">
                              {opt}
                            </span>
                            <span className="text-xs text-slate-500 font-bold flex items-center gap-1.5 flex-1">
                              <Lock className="w-3.5 h-3.5" /> Đã loại trừ phương án sai
                            </span>
                          </div>
                        );
                      }

                      const optionText = currentQ.options && currentQ.options[i] ? currentQ.options[i] : `Lựa chọn ${opt}`;

                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            gameAudio.playPop();
                            setCurrentAnswer(opt);
                          }}
                          className={`w-full min-h-[50px] p-2.5 sm:p-3 rounded-2xl border-2 transition-all flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.99] ${
                            isSelected 
                              ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 border-white ring-2 ring-cyan-400/60 shadow-[0_0_20px_rgba(0,217,255,0.4)]' 
                              : `bg-slate-900/85 hover:bg-slate-800/90 text-white ${style.border}`
                          }`}
                        >
                          {/* Chữ cái A, B, C, D nhỏ, sắc nét */}
                          <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center flex-shrink-0 border transition-all ${
                            isSelected 
                              ? 'bg-slate-950 text-cyan-300 border-slate-950 shadow-sm' 
                              : style.badge
                          }`}>
                            {opt}
                          </span>

                          {/* Nội dung đầy đủ của phương án trả lời */}
                          <div className={`flex-1 text-xs sm:text-sm font-semibold leading-relaxed break-words whitespace-pre-wrap ${
                            isSelected ? 'text-slate-950 font-bold' : 'text-slate-100'
                          }`}>
                            {optionText}
                          </div>

                          {/* Nút check chọn */}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
                            isSelected 
                              ? 'bg-slate-950 text-cyan-400 border-slate-950 shadow-sm' 
                              : 'border-white/20 bg-slate-950/30'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* True - False Options (TF) - Hiển thị đầy đủ nội dung các ý a, b, c, d */}
                {isTF && (
                  <div className="space-y-2">
                    <p className="text-cyan-300 text-xs font-bold flex items-center gap-1.5 mb-1">
                      <span>ℹ️</span> Chọn Đúng hoặc Sai cho từng ý a, b, c, d:
                    </p>
                    {['a', 'b', 'c', 'd'].map((letter, i) => {
                      const currentAnsArr = currentAnswer || ['', '', '', ''];
                      const optText = currentQ.options ? currentQ.options[i] : '';
                      const isDung = currentAnsArr[i] === 'Đúng';
                      const isSai = currentAnsArr[i] === 'Sai';

                      return (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/80 border border-cyan-500/25 p-2.5 sm:p-3 rounded-2xl">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            {/* Chữ cái a, b, c, d nhỏ */}
                            <span className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center font-black text-xs flex-shrink-0 mt-0.5">
                              {letter})
                            </span>
                            {/* Hiển thị đầy đủ nội dung ý a, b, c, d */}
                            <span className="text-xs sm:text-sm font-semibold text-slate-100 leading-relaxed break-words whitespace-pre-wrap flex-1">
                              {optText || `Nội dung ý ${letter.toUpperCase()}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 pt-0.5 sm:pt-0">
                            <button 
                              type="button"
                              onClick={() => {
                                gameAudio.playPop();
                                const newAns = [...currentAnsArr];
                                newAns[i] = 'Đúng';
                                setCurrentAnswer(newAns);
                              }}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer min-w-[58px] text-center ${
                                isDung 
                                  ? 'bg-emerald-400 text-slate-950 font-black ring-2 ring-emerald-400/50 shadow-[0_0_12px_rgba(34,197,94,0.5)]' 
                                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-white/10'
                              }`}
                            >
                              Đúng
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                gameAudio.playPop();
                                const newAns = [...currentAnsArr];
                                newAns[i] = 'Sai';
                                setCurrentAnswer(newAns);
                              }}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer min-w-[58px] text-center ${
                                isSai 
                                  ? 'bg-rose-500 text-white font-black ring-2 ring-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.5)]' 
                                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-white/10'
                              }`}
                            >
                              Sai
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Short Answer (SA / ESSAY) */}
                {isSA && (
                  <div className="space-y-2 py-1">
                    <label className="block text-xs font-bold text-cyan-300">
                      Gõ câu trả lời ngắn của bạn:
                    </label>
                    <textarea
                      value={currentAnswer || ''}
                      onChange={e => setCurrentAnswer(e.target.value)}
                      placeholder="Gõ đáp án ngắn của bạn tại đây..."
                      className="w-full h-24 sm:h-28 p-3 bg-slate-900/90 border-2 border-cyan-500/40 rounded-2xl text-sm sm:text-base font-bold text-white placeholder-slate-500 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(0,217,255,0.3)] outline-none resize-none shadow-inner"
                    />
                  </div>
                )}

              </div>

              {/* FIXED SUBMIT BUTTON DOCKED AT BOTTOM OF SCREEN ON MOBILE (9:16 OPTIMIZATION), STATIC ON DESKTOP */}
              <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-cyan-500/40 p-2.5 sm:p-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom,12px))] shadow-[0_-12px_30px_rgba(0,0,0,0.95)] max-w-md sm:max-w-xl xl:max-w-2xl mx-auto xl:static xl:p-0 xl:bg-transparent xl:border-0 xl:shadow-none xl:mt-4">
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={
                    currentQ.type === 'TF' ? (!currentAnswer || currentAnswer.length !== 4 || currentAnswer.includes('')) : !currentAnswer
                  }
                  className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:via-teal-300 hover:to-emerald-300 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-slate-950 font-black text-xs sm:text-base rounded-2xl transition-all cursor-pointer shadow-[0_0_25px_rgba(0,217,255,0.4)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>
                    {currentQ.type === 'TF' 
                      ? (!currentAnswer || currentAnswer.length !== 4 || currentAnswer.includes('') 
                          ? 'CHỌN ĐỦ 4 Ý ĐÚNG/SAI ĐỂ NỘP BÀI' 
                          : 'XÁC NHẬN NỘP BÀI CÂU NÀY')
                      : !currentAnswer 
                      ? 'CHỌN ĐÁP ÁN ĐỂ NỘP BÀI' 
                      : 'XÁC NHẬN NỘP BÀI CÂU NÀY'}
                  </span>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: TOP 18 LEADERBOARD (Desktop/Laptop xl+) - XẾP THEO EXP */}
      {!isExamMode && (
        <div className="hidden xl:flex flex-col w-72 flex-shrink-0 bg-slate-950/85 border border-cyan-500/35 rounded-3xl p-3.5 backdrop-blur-xl shadow-[0_0_30px_rgba(0,217,255,0.15)] max-h-[85vh] sticky top-3">
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-cyan-500/30">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-black text-xs uppercase tracking-wider text-amber-300">
                TOP 18 (EXP)
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-cyan-300">
              Hạng #{myExpRank}/{totalRoomPlayers}
            </span>
          </div>

          <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
            {top18PlayersByExp.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-4">Đang cập nhật EXP...</div>
            ) : (
              top18PlayersByExp.map((p, idx) => {
                const isMe = p.id === playerInfo?.id;
                const rankColor = idx === 0 
                  ? 'bg-amber-400 text-slate-950 font-black ring-1 ring-amber-300' 
                  : idx === 1 
                  ? 'bg-slate-300 text-slate-950 font-black' 
                  : idx === 2 
                  ? 'bg-amber-700 text-white font-black' 
                  : 'bg-slate-800 text-slate-300';

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                      isMe
                        ? 'bg-cyan-500/25 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,217,255,0.3)]'
                        : 'bg-slate-900/60 border border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono flex-shrink-0 ${rankColor}`}>
                        {idx + 1}
                      </span>
                      <span className={`font-bold truncate ${isMe ? 'text-cyan-300 font-black' : 'text-white'}`}>
                        {p.name} {isMe && '(Bạn)'}
                      </span>
                    </div>
                    <span className="font-mono font-black text-amber-300 ml-2 flex-shrink-0">
                      {p.exp ?? 0} EXP
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>

    {/* MOBILE TOP 18 MODAL - XẾP THEO EXP */}
    {showTop18Drawer && (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-3xl p-5 max-w-sm w-full shadow-[0_0_40px_rgba(0,217,255,0.3)] flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="font-black text-sm text-white">TOP 18 BẢNG ĐẤU (EXP)</span>
            </div>
            <button
              onClick={() => setShowTop18Drawer(false)}
              className="p-1 rounded-xl bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
            {top18PlayersByExp.map((p, idx) => {
              const isMe = p.id === playerInfo?.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs ${
                    isMe ? 'bg-cyan-500/25 border border-cyan-400 font-bold' : 'bg-slate-950/60 border border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono text-cyan-300">
                      {idx + 1}
                    </span>
                    <span className="text-white truncate font-bold">{p.name} {isMe && '(Bạn)'}</span>
                  </div>
                  <span className="font-mono font-black text-amber-300">{p.exp ?? 0} EXP</span>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setShowTop18Drawer(false)}
            className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    )}

    {/* WAGER EXP MODAL */}
    {showWagerModal && (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-5 max-w-sm w-full shadow-[0_0_40px_rgba(250,204,21,0.3)] flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-300 font-black text-sm">
              <Coins className="w-5 h-5 text-amber-400" />
              <span>CÁ CƯỢC EXP (CÂU 15+)</span>
            </div>
            <button
              onClick={() => setShowWagerModal(false)}
              className="p-1 rounded-xl bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Nhập số điểm EXP bạn muốn cá cược cho câu này. Nếu trả lời <span className="text-emerald-400 font-bold">ĐÚNG</span>, bạn được <span className="text-amber-400 font-bold">nhân đôi</span> số EXP đã cược. Nếu trả lời <span className="text-rose-400 font-bold">SAI</span>, bạn sẽ bị <span className="text-rose-400 font-bold">trừ</span> số EXP đã cược. Dùng 1 lần duy nhất trong cả trận!
            </p>

            <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">EXP hiện tại của bạn:</span>
              <span className="font-mono font-bold text-cyan-300">{playerInfo?.exp || 0} EXP</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Số điểm EXP muốn cược:</label>
              <input
                type="number"
                min="1"
                max={Math.max(10, playerInfo?.exp || 0)}
                value={wagerInput}
                onChange={(e) => setWagerInput(e.target.value)}
                placeholder="Nhập số EXP..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-amber-400/50 rounded-xl text-white font-mono font-bold text-base focus:border-amber-400 outline-none"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              {[20, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setWagerInput(String(Math.min(preset, Math.max(10, playerInfo?.exp || 0))))}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold cursor-pointer transition-all"
                >
                  +{preset} EXP
                </button>
              ))}
              <button
                type="button"
                onClick={() => setWagerInput(String(Math.max(10, playerInfo?.exp || 0)))}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer transition-all ml-auto"
              >
                Tất tay
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowWagerModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmWager}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-[0_0_15px_rgba(250,204,21,0.4)]"
              >
                Xác nhận cược
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* STEAL TARGET SELECTOR MODAL */}
    {showStealModal && (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-5 max-w-md w-full shadow-[0_0_40px_rgba(244,63,94,0.4)] flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-rose-500/30">
            <div className="flex items-center gap-2 text-rose-400 font-black text-sm">
              <Sword className="w-5 h-5" />
              <span>CHỌN MỤC TIÊU CƯỚP ĐIỂM (TOP 10)</span>
            </div>
            <button
              onClick={() => setShowStealModal(false)}
              className="p-1 rounded-xl bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-300 mb-3 leading-relaxed">
            Nếu trả lời đúng câu này, bạn sẽ cướp được <span className="text-emerald-400 font-bold">30% số điểm</span> của câu hỏi từ người bạn chọn (trừ khi họ đã bật Khiên Phòng Thủ). Dùng 1 lần duy nhất trong cả trận!
          </p>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {top10ForSteal.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">Chưa có người chơi nào khác trong phòng</p>
            ) : (
              top10ForSteal.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectStealTarget({ id: p.id, name: p.name })}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-rose-950/40 border border-white/10 hover:border-rose-400/60 transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/40 flex items-center justify-center font-mono text-xs font-black">
                      {idx + 1}
                    </span>
                    <span className="text-white font-bold text-sm group-hover:text-rose-300 transition-colors">
                      {p.name}
                    </span>
                  </div>
                  <span className="font-mono font-black text-amber-300 text-xs">
                    ⚡ {p.exp ?? 0} EXP
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            onClick={() => setShowStealModal(false)}
            className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    )}
    </CyberSpaceBackground>
  );
}
