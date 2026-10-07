import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Award, 
  CheckCircle2, 
  ExternalLink, 
  Sparkles, 
  Trophy, 
  ArrowLeft, 
  Save, 
  UserCheck, 
  Loader2, 
  AlertCircle,
  HelpCircle,
  Eye,
  RefreshCw,
  Sliders,
  Lock,
  Unlock,
  Users,
  Clock,
  ShieldCheck,
  LogOut,
  Radio,
  Volume2,
  X,
  Maximize2
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc, deleteField } from 'firebase/firestore';
import { GameSession, Player, Quiz, Question } from '../types';
import { firestoreQuota } from '../utils/firestoreQuota';
import { syncJudgeScoreToServer, fetchSessionFromServer, fetchActiveSessionsFromServer } from '../services/serverSync';
import { 
  ROUND_2_GROUPS_CONFIG, 
  getTeamProducts, 
  openProductInNewTab,
  extractSubmissionsMap,
  extractScoresMap
} from '../utils/round2Grouping';
import { CyberSpaceBackground } from '../components/CyberSpaceBackground';
import { gameAudio } from '../utils/gameAudio';

export const JUDGE_POSITIONS = [
  { id: 'GK01', name: 'Giám Khảo 1', title: 'Giám Khảo 1 (GV chấm chính)', role: 'Trưởng ban / GV chính' },
  { id: 'GK02', name: 'Giám Khảo 2', title: 'Giám Khảo 2 (GK02)', role: 'Thành viên Ban Giám Khảo' },
  { id: 'GK03', name: 'Giám Khảo 3', title: 'Giám Khảo 3 (GK03)', role: 'Thành viên Ban Giám Khảo' },
  { id: 'GK04', name: 'Giám Khảo 4', title: 'Giám Khảo 4 (GK04)', role: 'Thành viên Ban Giám Khảo' },
  { id: 'GK05', name: 'Giám Khảo 5', title: 'Giám Khảo 5 (GK05)', role: 'Thành viên Ban Giám Khảo' }
];

export default function Judge() {
  // Unique device identifier to ensure "vị trí đã vào không được vào nữa"
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('khtn_judge_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      localStorage.setItem('khtn_judge_device_id', id);
    }
    return id;
  });

  const [judgeId, setJudgeId] = useState<string>(() => {
    return localStorage.getItem('khtn_judge_id') || '';
  });

  const [selectedSlotForLogin, setSelectedSlotForLogin] = useState<string>('GK01');
  const [passcode, setPasscode] = useState<string>('123');
  const [passcodeError, setPasscodeError] = useState<string>('');
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState<Record<string, string>>({}); // teamId -> message
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);

  // Round 1 live data for judge viewing
  const [players, setPlayers] = useState<Player[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  // Local draft scores: teamId -> score (0 - 100)
  const [draftScores, setDraftScores] = useState<Record<string, number | ''>>({});
  const [round2Submissions, setRound2Submissions] = useState<Record<string, any>>({});

  // 4-Criteria Grader Modal: teamId & current criteria scores
  const [evaluatingTeam, setEvaluatingTeam] = useState<{ id: string; name: string } | null>(null);
  const [criteriaScores, setCriteriaScores] = useState<{ c1: number; c2: number; c3: number; c4: number }>({
    c1: 20,
    c2: 20,
    c3: 20,
    c4: 20
  });

  // Lightbox / Product Preview modal for Judges to inspect submissions with (X) return button
  const [viewingProduct, setViewingProduct] = useState<{
    teamId: string;
    teamName: string;
    teamIcon?: string;
    product: {
      id: string;
      index: number;
      title: string;
      url: string;
      isImage: boolean;
      isAudio: boolean;
      isDrive: boolean;
      description?: string;
    };
  } | null>(null);

  // Keyboard shortcut: Esc to close product preview modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewingProduct(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigate = useNavigate();

  // Listen to active sessions with status ROUND2 or FINISHED or ACTIVE or WAITING
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const targetSessionId = searchParams.get('session') || searchParams.get('id');

    if (targetSessionId) {
      // Direct session ID provided in URL - listen directly to this specific session!
      const unsubDirect = onSnapshot(doc(db, 'sessions', targetSessionId), (docSnap) => {
        if (docSnap.exists()) {
          setActiveSession({ ...docSnap.data(), id: docSnap.id } as GameSession);
        } else {
          setActiveSession(null);
        }
        setLoading(false);
      }, (err) => {
        console.error('Error listening to direct judge session:', err);
        setLoading(false);
      });
      return () => unsubDirect();
    }

    const q = query(collection(db, 'sessions'), where('status', 'in', ['ROUND2', 'FINISHED', 'ACTIVE', 'WAITING']));
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      // Filter sessions created in the last 24 hours and exclude closed sessions
      const list = snap.docs
        .map(d => ({ ...d.data(), id: d.id } as GameSession))
        .filter(s => !s.isClosed && s.status !== 'CLOSED' && !s.hostLeft && (!s.createdAt || (now - s.createdAt < 24 * 3600 * 1000)));

      // Prioritize ROUND2 sessions first, then newest createdAt
      list.sort((a, b) => {
        if (a.status === 'ROUND2' && b.status !== 'ROUND2') return -1;
        if (b.status === 'ROUND2' && a.status !== 'ROUND2') return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      if (list.length > 0) {
        setActiveSession(list[0]);
      } else {
        setActiveSession(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error querying sessions for judge:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Listen to Round 2 submissions subcollection for instant real-time synchronization in Judge
  useEffect(() => {
    if (!activeSession?.id) {
      setRound2Submissions({});
      return;
    }
    const unsub = onSnapshot(collection(db, `sessions/${activeSession.id}/submissions`), (snap) => {
      const subsMap: Record<string, any> = {};
      snap.docs.forEach(docSnap => {
        subsMap[docSnap.id] = docSnap.data();
      });
      setRound2Submissions(subsMap);
    }, (err) => {
      console.warn('Real-time submissions listener error in Judge:', err);
    });
    return () => unsub();
  }, [activeSession?.id]);

  // Listen to players in active session for Round 1 live spectator view
  useEffect(() => {
    if (!activeSession?.id) {
      setPlayers([]);
      return;
    }
    const unsub = onSnapshot(collection(db, `sessions/${activeSession.id}/players`), snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Player));
      setPlayers(list);
    });
    return () => unsub();
  }, [activeSession?.id]);

  // Load quiz details for Round 1 question display
  useEffect(() => {
    if (!activeSession?.quizId) {
      setQuiz(null);
      return;
    }
    const loadQuiz = async () => {
      try {
        const qDoc = await getDoc(doc(db, 'quizzes', activeSession.quizId));
        if (qDoc.exists()) {
          const qData = qDoc.data() as Quiz;
          if (activeSession.questions && activeSession.questions.length > 0) {
            setQuiz({ ...qData, questions: activeSession.questions });
          } else {
            setQuiz(qData);
          }
        }
      } catch (err) {
        console.error('Error loading quiz for judge:', err);
      }
    };
    loadQuiz();
  }, [activeSession?.quizId, activeSession?.questions]);

  // Keep alive heartbeat for claimed judge slot (throttled to 90s to conserve Firestore write quota)
  useEffect(() => {
    if (!activeSession?.id || !judgeId) return;
    if (firestoreQuota.getIsExceeded()) return;

    const interval = setInterval(async () => {
      if (firestoreQuota.getIsExceeded()) return;
      try {
        await updateDoc(doc(db, 'sessions', activeSession.id), {
          [`judgeSlots.${judgeId}.lastActiveAt`]: Date.now()
        });
      } catch (e) {
        firestoreQuota.reportError(e);
      }
    }, 90000);
    return () => clearInterval(interval);
  }, [activeSession?.id, judgeId]);

  // Synchronize current saved scores into local draft inputs when session or judgeId changes
  useEffect(() => {
    if (!activeSession || !judgeId) return;
    const scores = extractScoresMap(activeSession);
    const initialDrafts: Record<string, number | ''> = {};

    ROUND_2_GROUPS_CONFIG.forEach(team => {
      const teamScoreMap = scores[team.id];
      if (teamScoreMap && typeof teamScoreMap[judgeId] === 'number') {
        initialDrafts[team.id] = teamScoreMap[judgeId];
      } else if (judgeId === 'GK01' && teamScoreMap && typeof teamScoreMap['GK'] === 'number') {
        initialDrafts[team.id] = teamScoreMap['GK'];
      } else {
        initialDrafts[team.id] = '';
      }
    });

    setDraftScores(initialDrafts);
  }, [activeSession?.round2Scores, activeSession?.lastRound2Update, judgeId, activeSession?.id]);

  // Check validity of claimed slot
  const currentSlots = activeSession?.judgeSlots || {};

  // Handle claiming a judge position
  const handleClaimPosition = async (slotIdToClaim: string) => {
    if (!activeSession) {
      setPasscodeError('Chưa có phòng thi nào đang mở. Vui lòng đợi giáo viên tạo phòng thi!');
      return;
    }

    const trimmedPass = passcode.trim();
    if (trimmedPass !== '123') {
      gameAudio.playIncorrect();
      setPasscodeError('Mã xác thực không đúng! Vui lòng nhập mã: 123');
      return;
    }

    const slotInfo = currentSlots[slotIdToClaim];
    // Check if occupied by another device within 3 hours
    if (slotInfo && slotInfo.deviceId && slotInfo.deviceId !== deviceId) {
      const isStillFresh = Date.now() - (slotInfo.lastActiveAt || slotInfo.claimedAt || 0) < 3 * 3600 * 1000;
      if (isStillFresh) {
        gameAudio.playIncorrect();
        setPasscodeError(`Vị trí ${slotIdToClaim} đã có người vào! Vui lòng chọn vị trí khác.`);
        return;
      }
    }

    setIsClaiming(true);
    try {
      const posObj = JUDGE_POSITIONS.find(p => p.id === slotIdToClaim);
      await updateDoc(doc(db, 'sessions', activeSession.id), {
        [`judgeSlots.${slotIdToClaim}`]: {
          judgeId: slotIdToClaim,
          name: posObj?.name || slotIdToClaim,
          deviceId: deviceId,
          claimedAt: Date.now(),
          lastActiveAt: Date.now()
        }
      });

      gameAudio.playVictory();
      setJudgeId(slotIdToClaim);
      localStorage.setItem('khtn_judge_id', slotIdToClaim);
      setPasscodeError('');
    } catch (err: any) {
      console.error('Error claiming judge position:', err);
      setPasscodeError('Lỗi khi vào vị trí: ' + (err?.message || 'Không thể kết nối'));
    } finally {
      setIsClaiming(false);
    }
  };

  // Release/leave currently claimed slot
  const handleReleasePosition = async () => {
    gameAudio.playClick();
    if (activeSession && judgeId) {
      try {
        await updateDoc(doc(db, 'sessions', activeSession.id), {
          [`judgeSlots.${judgeId}`]: deleteField()
        });
      } catch (err) {
        console.error('Error releasing slot:', err);
      }
    }
    setJudgeId('');
    localStorage.removeItem('khtn_judge_id');
  };

  const handleScoreChange = (teamId: string, val: string) => {
    if (val === '') {
      setDraftScores(prev => ({ ...prev, [teamId]: '' }));
      return;
    }
    const num = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
    setDraftScores(prev => ({ ...prev, [teamId]: num }));
  };

  const handleQuickScore = (teamId: string, num: number) => {
    gameAudio.playClick();
    setDraftScores(prev => ({ ...prev, [teamId]: num }));
  };

  const handleSaveScore = async (teamId: string, teamName: string, directScore?: number) => {
    if (!activeSession || !judgeId) return;
    if (activeSession.status !== 'ROUND2') {
      setSaveFeedback(prev => ({
        ...prev,
        [teamId]: '⚠️ Vòng 2 chưa bắt đầu! Hãy đợi Giáo viên mở Vòng 2.'
      }));
      setTimeout(() => {
        setSaveFeedback(prev => {
          const next = { ...prev };
          delete next[teamId];
          return next;
        });
      }, 3500);
      return;
    }

    const rawVal = directScore !== undefined ? directScore : draftScores[teamId];
    if (rawVal === '' || rawVal === undefined || isNaN(Number(rawVal))) {
      setSaveFeedback(prev => ({
        ...prev,
        [teamId]: '⚠️ Vui lòng nhập hoặc chọn điểm số từ 0 đến 100!'
      }));
      setTimeout(() => {
        setSaveFeedback(prev => {
          const next = { ...prev };
          delete next[teamId];
          return next;
        });
      }, 3000);
      return;
    }

    const scoreNum = Math.min(100, Math.max(0, Number(rawVal)));
    setSavingTeamId(teamId);

    // 1. Optimistically update local activeSession state for 0ms instant UI response
    const existingScores = extractScoresMap(activeSession);
    const teamScores = {
      ...(existingScores[teamId] || {}),
      [judgeId]: scoreNum
    };
    if (judgeId === 'GK01') {
      teamScores.GK = scoreNum;
    }

    setActiveSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        round2Scores: {
          ...(prev.round2Scores || {}),
          [teamId]: teamScores
        }
      };
    });

    // 2. Play sound & show feedback immediately
    gameAudio.playVictory();
    setSaveFeedback(prev => ({
      ...prev,
      [teamId]: `✅ Đã lưu ${scoreNum} điểm lên màn hình lớn!`
    }));

    setTimeout(() => {
      setSaveFeedback(prev => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
    }, 3500);

    // 3. Sync to server backup immediately (always reliable, 0ms lag)
    syncJudgeScoreToServer(activeSession.id, teamId, judgeId, scoreNum);

    // 4. Background fire-and-forget sync to Firestore
    try {
      const updatePayload: Record<string, any> = {
        round2Scores: {
          ...existingScores,
          [teamId]: teamScores
        },
        [`round2Scores.${teamId}.${judgeId}`]: scoreNum,
        lastRound2Update: Date.now()
      };
      if (judgeId === 'GK01') {
        updatePayload[`round2Scores.${teamId}.GK`] = scoreNum;
      }

      setDoc(doc(db, 'sessions', activeSession.id), updatePayload, { merge: true })
        .catch(err => {
          firestoreQuota.reportError(err);
          console.warn('Firestore judge score sync warning:', err);
        })
        .finally(() => {
          setSavingTeamId(null);
        });
    } catch (err: any) {
      console.warn('Judge score sync notice:', err);
      setSavingTeamId(null);
    }
  };

  const handleOpenProduct = (url: string) => {
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

  // Rank players by EXP for Round 1 observation
  const rankedPlayers = [...players].sort((a, b) => {
    const expDiff = (b.exp ?? 0) - (a.exp ?? 0);
    if (expDiff !== 0) return expDiff;
    return (a.totalTimeSpent ?? 99999) - (b.totalTimeSpent ?? 99999);
  });
  const top18Players = rankedPlayers.slice(0, 18);

  // =========================================================================
  // GATE 0: PHIÊN THI ĐẤU ĐÃ KẾT THÚC / GV THOÁT VỀ TRANG CHỦ CHUẨN BỊ GAME MỚI
  // =========================================================================
  if (activeSession && (activeSession.status === 'CLOSED' || activeSession.isClosed || activeSession.hostLeft)) {
    navigate('/');
    return null;
  }

  // =========================================================================
  // GATE 1: GK BUỘC PHẢI CHỌN VỊ TRÍ CỦA MÌNH (VỊ TRÍ ĐÃ VÀO KHÔNG ĐƯỢC VÀO NỮA)
  // =========================================================================
  if (!judgeId) {
    return (
      <CyberSpaceBackground stationColor="#F59E0B" className="min-h-screen flex flex-col items-center justify-center p-3 sm:p-6 select-none">
        <div className="w-full max-w-2xl bg-slate-900/95 border-2 border-amber-400/80 rounded-[2.5rem] p-5 sm:p-8 shadow-[0_0_70px_rgba(245,158,11,0.35)] text-center relative overflow-hidden backdrop-blur-2xl my-auto">
          
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto mb-3 text-3xl shadow-[0_0_25px_rgba(245,158,11,0.4)]">
            ⚖️
          </div>

          <span className="px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-black uppercase tracking-wider mb-2 inline-block border border-amber-400/40">
            HỘI ĐỒNG GIÁM KHẢO • CHỌN VỊ TRÍ
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-white mb-1.5">
            Chọn Vị Trí Giám Khảo
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-lg mx-auto mb-4 leading-relaxed">
            Mỗi Giám khảo <strong className="text-amber-300">buộc phải chọn 1 vị trí</strong> của mình. Vị trí đã có người vào sẽ <strong className="text-rose-400">bị khóa và không được vào nữa</strong>.
          </p>

          {/* Passcode 123 verification box */}
          <div className="p-3.5 bg-slate-950/80 border border-amber-400/40 rounded-2xl mb-5 text-left max-w-md mx-auto">
            <label className="block text-[11px] font-black text-amber-300 uppercase tracking-wider mb-1">
              MÃ XÁC THỰC GIÁM KHẢO (MẶC ĐỊNH: 123):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (passcodeError) setPasscodeError('');
                }}
                placeholder="Nhập 123..."
                className="flex-1 py-2 px-3 bg-slate-900 border-2 border-amber-400/60 rounded-xl font-mono font-black text-xl text-yellow-300 outline-none text-center"
              />
              <button
                type="button"
                onClick={() => setPasscode('123')}
                className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold cursor-pointer"
              >
                Mã 123
              </button>
            </div>
            {passcodeError && (
              <div className="mt-2 p-2 bg-rose-500/20 border border-rose-400/50 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passcodeError}</span>
              </div>
            )}
          </div>

          {/* 5 Judge Positions List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left mb-6">
            {JUDGE_POSITIONS.map(pos => {
              const slot = currentSlots[pos.id];
              // Occupied by other device
              const isOccupiedByOther = Boolean(
                slot &&
                slot.deviceId &&
                slot.deviceId !== deviceId &&
                (Date.now() - (slot.lastActiveAt || slot.claimedAt || 0) < 3 * 3600 * 1000)
              );
              const isClaimedByMe = Boolean(slot && slot.deviceId === deviceId);

              return (
                <div
                  key={pos.id}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 ${
                    isOccupiedByOther
                      ? 'bg-slate-950/40 border-slate-700/60 opacity-60'
                      : isClaimedByMe
                        ? 'bg-emerald-950/40 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                        : 'bg-slate-950 border-amber-400/50 hover:border-amber-300 shadow-md'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-black text-sm text-white">
                        {pos.id}
                      </span>
                      {isOccupiedByOther ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-300 text-[10px] font-black uppercase flex items-center gap-1">
                          <Lock className="w-3 h-3" /> ĐÃ CÓ NGƯỜI
                        </span>
                      ) : isClaimedByMe ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-black uppercase flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> CỦA BẠN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase flex items-center gap-1">
                          <Unlock className="w-3 h-3" /> ĐANG TRỐNG
                        </span>
                      )}
                    </div>
                    <h3 className="font-black text-sm text-white">{pos.title}</h3>
                    <p className="text-[11px] text-slate-400">{pos.role}</p>
                  </div>

                  <div>
                    {isOccupiedByOther ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 px-3 bg-slate-800 text-slate-500 text-xs font-bold rounded-xl cursor-not-allowed border border-white/5"
                      >
                        🔒 Không được vào nữa
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isClaiming}
                        onClick={() => handleClaimPosition(pos.id)}
                        className={`w-full py-2 px-3 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md ${
                          isClaimedByMe
                            ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                            : 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                        }`}
                      >
                        {isClaiming ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <span>{isClaimedByMe ? 'TIẾP TỤC VỊ TRÍ NÀY' : 'CHỌN VỊ TRÍ NÀY'}</span>
                            <span>➔</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <Link to="/" className="hover:text-amber-300 transition-colors flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Về Trang chủ
            </Link>
            <span className="italic text-[11px]">
              Thiết bị ID: {deviceId.slice(0, 14)}...
            </span>
          </div>

        </div>
      </CyberSpaceBackground>
    );
  }

  // =========================================================================
  // VIEW A: GK XEM TOÀN BỘ VÒNG 1 (CHẾ ĐỘ QUAN SÁT - KHÔNG TƯƠNG TÁC ĐƯỢC)
  // =========================================================================
  const isRound1Active = activeSession?.status !== 'ROUND2';

  if (isRound1Active) {
    const isWaiting = activeSession?.status === 'WAITING';
    const isFinishedR1 = activeSession?.status === 'FINISHED';
    const isPlaying = activeSession?.status === 'ACTIVE';

    const currentQIdx = activeSession?.currentQuestionIndex ?? 0;
    const currentQ = quiz?.questions?.[currentQIdx];

    return (
      <CyberSpaceBackground stationColor="#38BDF8" className="min-h-screen p-3 sm:p-5 md:p-8 flex flex-col justify-between select-none">
        <div className="w-full max-w-6xl mx-auto space-y-4">
          
          {/* Top Bar with GK Identity & Status */}
          <div className="glass-neon-card-glow rounded-3xl p-4 sm:p-5 border-2 border-sky-400/60 shadow-[0_0_50px_rgba(56,189,248,0.25)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(56,189,248,0.4)]">
                👁️
              </div>
              <div className="text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-black uppercase tracking-wider mb-1">
                  <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" /> CHẾ ĐỘ QUAN SÁT GIÁM KHẢO • VÒNG 1
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  Đấu Trường Khoa Học • Vòng Kiến Thức
                </h1>
                <p className="text-slate-300 text-xs sm:text-sm">
                  Theo dõi trực tiếp diễn biến câu hỏi và bảng xếp hạng • <strong>Không thể tương tác cho đến khi Vòng 2 mở</strong>
                </p>
              </div>
            </div>

            {/* GK badge & leave action */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md">
                <UserCheck className="w-4 h-4" />
                <span>{judgeId}</span>
              </div>

              <button
                type="button"
                onClick={handleReleasePosition}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-bold border border-white/10 transition-all cursor-pointer flex items-center gap-1"
                title="Rời vị trí để người khác có thể chọn"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đổi / Rời vị trí</span>
              </button>

              <Link
                to="/"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 transition-all"
                title="Về trang chủ"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Locked Notice Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-slate-950 border-2 border-amber-400 text-left flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400 flex items-center justify-center flex-shrink-0 text-xl">
                🔒
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-amber-300">BẢNG CHẤM ĐIỂM ĐANG KHÓA</div>
                <div className="text-sm font-black text-white">
                  Giám khảo quan sát toàn bộ Vòng 1 nhưng chưa được phép tương tác hay chấm điểm
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Bảng chấm điểm 6 nhóm sẽ tự động mở ngay trên màn hình này khi Giáo viên bấm <strong>"Bắt đầu Vòng 2"</strong> trên máy chiếu!
                </div>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono font-black text-xs whitespace-nowrap">
              CHỜ VÒNG 2...
            </span>
          </div>

          {/* MAIN ROUND 1 LIVE VIEWER */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Left 2 Cols: Question / Status live display */}
            <div className="lg:col-span-2 space-y-4">
              {isWaiting && (
                <div className="p-8 rounded-3xl bg-slate-900/90 border-2 border-sky-400/40 text-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-sky-400/20 border-2 border-sky-400 flex items-center justify-center mx-auto text-3xl animate-pulse">
                    ⏳
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">PHÒNG THI ĐANG Ở CHẾ ĐỘ CHỜ</h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                    Học sinh đang vào phòng thi bằng mã số. Giáo viên sẽ sớm bấm bắt đầu thi đấu Vòng 1.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 border border-sky-400/50 rounded-2xl font-mono font-bold text-sky-300 text-sm">
                    <Users className="w-4 h-4" /> Đã có {players.length} thí sinh tham gia
                  </div>
                </div>
              )}

              {isPlaying && currentQ && (
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border-2 border-sky-400/50 space-y-4 text-left shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <span className="px-3 py-1 rounded-xl bg-sky-500/20 text-sky-300 text-xs font-black uppercase">
                      CÂU {currentQIdx + 1} / {quiz?.questions?.length || 0} ({currentQ.type})
                    </span>
                    <span className="text-xs text-slate-400">
                      Thời gian: {currentQ.timeLimit || 30}s
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-white leading-relaxed">
                    {currentQ.content}
                  </h3>

                  {/* Options with answer revealed for Judge */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      CÁC PHƯƠNG ÁN (ĐÁP ÁN ĐÚNG ĐƯỢC ĐÁNH DẤU CHO GK):
                    </span>
                    {currentQ.type === 'MC' && currentQ.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentQ.options.map((opt, oIdx) => {
                          const optKey = ['A', 'B', 'C', 'D'][oIdx] || '';
                          const isCorrect = currentQ.answer?.trim().toUpperCase() === optKey;
                          return (
                            <div
                              key={oIdx}
                              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold ${
                                isCorrect
                                  ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 font-black'
                                  : 'bg-slate-950 border-white/10 text-slate-300'
                              }`}
                            >
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs ${
                                isCorrect ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-400'
                              }`}>
                                {optKey}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {currentQ.type === 'TF' && currentQ.options && (
                      <div className="space-y-1.5">
                        {currentQ.options.map((opt, sIdx) => {
                          const ansChar = currentQ.answer?.[sIdx] || '';
                          const optLabel = ['a)', 'b)', 'c)', 'd)'][sIdx] || `ý ${sIdx + 1}:`;
                          return (
                            <div key={sIdx} className="p-2.5 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between text-xs gap-3">
                              <span className="text-slate-200">
                                <strong className="text-cyan-400 mr-1.5">{optLabel}</strong>
                                {opt}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded font-mono font-black text-xs ${
                                ansChar === 'T' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                              }`}>
                                {ansChar === 'T' ? 'ĐÚNG' : 'SAI'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Scientific Explanation for Judge */}
                  {currentQ.explanation && (
                    <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-400/30 text-xs text-indigo-200">
                      <span className="font-black text-indigo-300 block mb-0.5 uppercase text-[10px]">
                        💡 GIẢI THÍCH KHOA HỌC:
                      </span>
                      {currentQ.explanation}
                    </div>
                  )}
                </div>
              )}

              {isFinishedR1 && (
                <div className="p-6 rounded-3xl bg-slate-900/90 border-2 border-emerald-400/50 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-400/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-3xl">
                    🏁
                  </div>
                  <h2 className="text-xl font-black text-white">VÒNG 1 ĐÃ HOÀN TẤT!</h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                    Giáo viên đang chuẩn bị xáo nhóm và chuyển sang Vòng 2. Vui lòng giữ màn hình này, giao diện chấm điểm 6 nhóm sẽ tự động xuất hiện.
                  </p>
                </div>
              )}
            </div>

            {/* Right Col: Top 18 EXP Live Leaderboard */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border-2 border-sky-400/40 flex flex-col justify-between text-left h-[480px]">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h3 className="font-black text-sm text-white uppercase tracking-wider">
                      TOP 18 DẪN ĐẦU (EXP)
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 font-mono text-xs font-bold">
                    {players.length} HS
                  </span>
                </div>

                <div className="space-y-1.5 overflow-y-auto max-h-[380px] pr-1 scrollbar-thin">
                  {top18Players.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs italic">
                      Chưa có điểm EXP
                    </div>
                  ) : (
                    top18Players.map((p, idx) => {
                      const isTop3 = idx < 3;
                      return (
                        <div
                          key={p.id}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            isTop3
                              ? 'bg-amber-500/10 border-amber-400/40 text-amber-200'
                              : 'bg-slate-950 border-white/5 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-black text-[10px] ${
                              idx === 0 ? 'bg-yellow-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-slate-400'
                            }`}>
                              #{idx + 1}
                            </span>
                            <span className="font-bold truncate text-white">
                              {p.name}
                            </span>
                            {p.className && (
                              <span className="text-[10px] text-slate-400">
                                ({p.className})
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-black text-amber-300 text-xs flex-shrink-0">
                            ⚡ {p.exp ?? 0}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 italic text-center">
                Top 18 bạn dẫn đầu sẽ đại diện chia vào 6 nhóm Vòng 2
              </div>
            </div>

          </div>

        </div>
      </CyberSpaceBackground>
    );
  }

  // =========================================================================
  // VIEW B: VÒNG 2 MỞ - GK TƯƠNG TÁC CHẤM ĐIỂM 6 NHÓM
  // =========================================================================
  const submissions = {
    ...extractSubmissionsMap(activeSession),
    ...round2Submissions
  };
  const currentScores = extractScoresMap(activeSession);

  // Count how many of the 6 teams have been graded by this judge
  const gradedTeamsCount = ROUND_2_GROUPS_CONFIG.filter(t => {
    const s = currentScores[t.id];
    return s && typeof s[judgeId] === 'number';
  }).length;

  return (
    <CyberSpaceBackground stationColor="#F59E0B" className="min-h-screen p-3 sm:p-5 md:p-8 flex flex-col justify-between select-none">
      <div className="w-full max-w-6xl mx-auto space-y-5">
        
        {/* Top Header Card */}
        <div className="glass-neon-card-glow rounded-3xl p-4 sm:p-6 border-2 border-amber-400/60 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(245,158,11,0.4)]">
              ⚖️
            </div>
            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-black uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5 animate-spin" /> BAN GIÁM KHẢO • CHẤM ĐIỂM VÒNG 2 (6 NHÓM)
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white">
                Từ dĩa ăn sạch đến thành phố sạch
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm">
                Giám khảo chấm điểm (0 - 100) cho 6 nhóm • <strong>3 nhóm điểm cao nhất sẽ vào vòng tiếp theo</strong>
              </p>
            </div>
          </div>

          {/* Judge Badge & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-2xl bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md">
              <UserCheck className="w-4 h-4" />
              <span>{judgeId}</span>
            </div>

            <div className="px-3.5 py-2 rounded-2xl bg-slate-900 border border-amber-400/40 text-amber-300 font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-inner">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Đã chấm: <strong className="text-white">{gradedTeamsCount}</strong> / 6 nhóm</span>
            </div>

            <button
              onClick={handleReleasePosition}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-bold border border-white/10 transition-all cursor-pointer flex items-center gap-1"
              title="Đổi mã số / Thoát vị trí chấm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đổi vị trí</span>
            </button>

            <Link
              to="/"
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 transition-all"
              title="Về trang chủ"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 6 Teams Graded Completion Alert */}
        {gradedTeamsCount === 6 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/25 via-teal-500/25 to-yellow-500/25 border-2 border-emerald-400 text-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div className="text-left">
                <h3 className="font-black text-white text-sm sm:text-base">BẠN ĐÃ HOÀN TẤT CHẤM ĐIỂM CẢ 6 NHÓM THI!</h3>
                <p className="text-xs text-emerald-300">Điểm số đồng bộ theo thời gian thực lên màn hình máy chiếu GV. 3 nhóm có điểm cao nhất sẽ bước tiếp vào vòng sau.</p>
              </div>
            </div>
            <span className="px-3.5 py-1.5 rounded-xl bg-emerald-400 text-slate-950 font-black text-xs shadow-md whitespace-nowrap">
              6/6 HOÀN THÀNH 🏆
            </span>
          </div>
        )}

        {/* 6 TEAMS SCORING LIST */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {ROUND_2_GROUPS_CONFIG.map((team, idx) => {
            const submission = submissions[team.id];
            const hasSubmission = !!submission;
            const teamScores = currentScores[team.id] || {};
            const myCurrentSavedScore = teamScores[judgeId];
            const isSavingThis = savingTeamId === team.id;
            const feedback = saveFeedback[team.id];

            // Other judges overview
            const judgesGraded = Object.keys(teamScores);

            // Members in this team
            const groupInSession = activeSession?.round2Groups?.find(g => g.id === team.id || g.name === team.name);
            const members = groupInSession?.members || [];

            return (
              <div
                key={team.id}
                className={`rounded-[2rem] p-5 border-2 ${team.borderColor} bg-slate-900/90 shadow-[0_0_40px_rgba(0,0,0,0.4)] flex flex-col justify-between gap-4 backdrop-blur-xl relative overflow-hidden`}
              >
                {/* Ambient Card Background Gradient */}
                <div className={`absolute top-0 right-0 w-80 h-80 bg-gradient-to-br ${team.accentBg} rounded-full blur-3xl opacity-25 pointer-events-none`} />

                {/* Team Info Header */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-sm">
                        {team.icon}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-black text-white">{team.name}</h2>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/10 text-slate-300 border border-white/10">
                            ĐỘI #{idx + 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 italic">{team.slogan}</p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {hasSubmission ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[11px] font-black flex items-center gap-1.5 whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>ĐÃ NỘP BÀI</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[11px] font-bold flex items-center gap-1.5 animate-pulse whitespace-nowrap">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>CHƯA NỘP</span>
                      </span>
                    )}
                  </div>

                  {/* Members list if available */}
                  {members.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap items-center gap-1 text-[11px]">
                      <span className="text-slate-400 font-bold mr-1">Thành viên:</span>
                      {members.map(m => (
                        <span key={m.id} className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200 border border-white/10 text-[10px] font-semibold">
                          {m.name} {m.className ? `(${m.className})` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Submission details (Supports up to 2 products) */}
                  {(() => {
                    const prods = getTeamProducts(submission);
                    if (prods.length === 0) {
                      return (
                        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-center gap-2 text-slate-500 text-xs italic">
                          Đang chờ nhóm nộp sản phẩm (tối đa 2 sản phẩm)...
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {prods.map(prod => (
                          <div 
                            key={prod.id} 
                            className="p-2.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center gap-3 hover:border-emerald-400/50 transition-colors"
                          >
                            {prod.isImage && prod.url ? (
                              <div 
                                onClick={() => setViewingProduct({ teamId: team.id, teamName: team.name, teamIcon: team.icon, product: prod })}
                                className="relative w-20 sm:w-24 h-16 sm:h-18 rounded-xl overflow-hidden cursor-pointer border border-emerald-400/60 flex-shrink-0 group shadow-md"
                                title="Bấm để xem sản phẩm chi tiết (có nút tắt X quay về)"
                              >
                                <img 
                                  src={prod.url} 
                                  alt={prod.title} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-black gap-1">
                                  <Eye className="w-3.5 h-3.5 text-emerald-300" />
                                </div>
                              </div>
                            ) : prod.isAudio && prod.url ? (
                              <div 
                                onClick={() => setViewingProduct({ teamId: team.id, teamName: team.name, teamIcon: team.icon, product: prod })}
                                className="w-20 sm:w-24 h-16 sm:h-18 rounded-xl bg-purple-500/20 border border-purple-400/50 hover:border-purple-300 text-purple-300 flex flex-col items-center justify-center gap-1 text-[10px] font-black cursor-pointer flex-shrink-0 shadow-md group"
                                title="Bấm để mở trình phát âm thanh (có nút tắt X quay về)"
                              >
                                <Volume2 className="w-6 h-6 text-purple-300 group-hover:scale-110 transition-transform" />
                                <span className="uppercase text-[8px] font-black tracking-wider">ÂM THANH</span>
                              </div>
                            ) : (
                              <div 
                                onClick={() => setViewingProduct({ teamId: team.id, teamName: team.name, teamIcon: team.icon, product: prod })}
                                className="w-20 sm:w-24 h-16 sm:h-18 rounded-xl bg-emerald-500/10 border border-emerald-400/40 hover:border-emerald-300 text-emerald-300 flex flex-col items-center justify-center gap-1 text-[10px] font-black cursor-pointer flex-shrink-0"
                                title="Bấm để xem file sản phẩm (có nút tắt X quay về)"
                              >
                                <ExternalLink className="w-5 h-5" />
                                <span className="uppercase text-[8px]">Xem file</span>
                              </div>
                            )}

                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  prod.index === 1 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                                }`}>
                                  Sản phẩm {prod.index} {prod.isAudio ? '• Âm thanh' : '• Ảnh'}
                                </span>
                                {prod.url && (
                                  <button
                                    type="button"
                                    onClick={() => setViewingProduct({ teamId: team.id, teamName: team.name, teamIcon: team.icon, product: prod })}
                                    className="text-[10px] text-cyan-300 hover:text-cyan-200 font-bold flex items-center gap-1 underline cursor-pointer"
                                    title="Xem chi tiết sản phẩm và chấm điểm (có nút tắt X quay về)"
                                  >
                                    <Eye className="w-3 h-3" /> Xem & Chấm
                                  </button>
                                )}
                              </div>
                              <h4 
                                onClick={() => setViewingProduct({ teamId: team.id, teamName: team.name, teamIcon: team.icon, product: prod })}
                                className="text-sm font-black text-white truncate cursor-pointer hover:text-cyan-300 transition-colors" 
                                title="Bấm để xem chi tiết sản phẩm"
                              >
                                {prod.title}
                              </h4>
                              {prod.isAudio && prod.url && (
                                <audio controls src={prod.url} className="w-full h-7 mt-1 rounded-lg" preload="none" />
                              )}
                              {prod.description && (
                                <p className="text-xs text-slate-300 mt-0.5 line-clamp-1" title={prod.description}>
                                  {prod.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* SCORING INPUT FORM */}
                <div className="p-4 rounded-2xl bg-slate-950 border-2 border-amber-400/40 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-amber-300 uppercase flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>{judgeId} CHẤM ĐIỂM (THANG 100):</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const currentVal = Number(draftScores[team.id]) || myCurrentSavedScore || 80;
                        const share = Math.round(currentVal / 4);
                        setCriteriaScores({
                          c1: share,
                          c2: share,
                          c3: share,
                          c4: currentVal - (share * 3)
                        });
                        setEvaluatingTeam({ id: team.id, name: team.name });
                      }}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-lg text-[11px] font-black cursor-pointer flex items-center gap-1"
                      title="Mở bảng tính điểm chi tiết theo 4 tiêu chí (Sáng tạo, Khả thi, Thẩm mỹ, Lan tỏa)"
                    >
                      <Sliders className="w-3 h-3 text-amber-400" />
                      <span>Chấm 4 tiêu chí (25đ x 4)</span>
                    </button>
                  </div>

                  {typeof myCurrentSavedScore === 'number' && (
                    <div className="text-[11px] text-emerald-400 font-mono font-bold mb-2 flex items-center justify-between">
                      <span>Điểm đã lưu trên màn hình:</span>
                      <strong className="text-white bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-400/40">{myCurrentSavedScore} điểm</strong>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Nhập 0 - 100..."
                      value={draftScores[team.id] ?? ''}
                      onChange={e => handleScoreChange(team.id, e.target.value)}
                      className="w-28 py-2 px-3 bg-slate-900 border-2 border-amber-400 rounded-xl text-center font-mono font-black text-xl text-yellow-300 outline-none focus:shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                    />

                    {/* Quick score buttons */}
                    <div className="flex flex-wrap gap-1 flex-1">
                      {[70, 75, 80, 85, 90, 95, 100].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleQuickScore(team.id, val)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-black font-mono transition-all cursor-pointer ${
                            draftScores[team.id] === val
                              ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                              : 'bg-white/10 hover:bg-white/20 text-slate-300'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Smooth Range Slider */}
                  <div className="mb-3 px-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Number(draftScores[team.id]) || (typeof myCurrentSavedScore === 'number' ? myCurrentSavedScore : 75)}
                      onChange={e => handleScoreChange(team.id, e.target.value)}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                      <span>0đ</span>
                      <span>50đ</span>
                      <span>75đ</span>
                      <span>100đ</span>
                    </div>
                  </div>

                  {/* Feedback Message */}
                  {feedback && (
                    <div className="text-xs font-black text-emerald-300 mb-2 animate-in fade-in">
                      {feedback}
                    </div>
                  )}

                  {/* Save Button */}
                  <button
                    type="button"
                    disabled={isSavingThis || !activeSession}
                    onClick={() => handleSaveScore(team.id, team.name)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.4)] active:scale-98 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingThis ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>ĐANG GỬI ĐIỂM LÊN MÀN HÌNH CHÍNH...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>LƯU ĐIỂM CHO {team.name.toUpperCase()}</span>
                      </>
                    )}
                  </button>

                  {/* Other judges status */}
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Các GK đã chấm ({judgesGraded.length}/5):</span>
                    <span className="font-mono text-cyan-300 font-bold">
                      {judgesGraded.length > 0 ? judgesGraded.join(', ') : 'Chưa có GK nào'}
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>

      <div className="w-full max-w-6xl mx-auto mt-6 text-center text-xs text-slate-500">
        Cổng Chấm Điểm Ban Giám Khảo (GK01 - GK05) • Kết nối Firebase Real-time • Tự động đồng bộ lên Màn hình máy chiếu của Giáo viên
      </div>

      {/* IN-APP PRODUCT VIEWER MODAL FOR JUDGES WITH CORNER (X) CLOSE BUTTON */}
      {viewingProduct && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingProduct(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 select-none"
        >
          <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border-2 border-emerald-400/80 rounded-3xl shadow-[0_0_80px_rgba(16,185,129,0.35)] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-200 text-slate-100">
            
            {/* Top Accent Gradient Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 z-10" />

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-slate-950/80 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl sm:text-2xl shadow-sm flex-shrink-0">
                  {viewingProduct.teamIcon || '📦'}
                </div>
                <div className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className="text-xs sm:text-sm font-black text-white">{viewingProduct.teamName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      Sản phẩm {viewingProduct.product.index} • {viewingProduct.product.isAudio ? 'Âm thanh' : viewingProduct.product.isImage ? 'Hình ảnh' : 'Tài liệu'}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-cyan-300 truncate" title={viewingProduct.product.title}>
                    {viewingProduct.product.title}
                  </h3>
                </div>
              </div>

              {/* NÚT TẮT (X) Ở GÓC SẢN PHẨM ĐỂ QUAY VỀ MÀN HÌNH CHẤM */}
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                className="px-3 sm:px-4 py-2 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-400/50 flex items-center gap-1.5 transition-all cursor-pointer font-black text-xs sm:text-sm active:scale-95 shadow-lg group flex-shrink-0"
                title="Đóng xem sản phẩm • Quay về màn hình chấm điểm (Phím Esc)"
              >
                <X className="w-5 h-5 text-rose-400 group-hover:rotate-90 transition-transform" />
                <span className="hidden sm:inline">Quay về màn hình chấm</span>
                <span className="sm:hidden">Đóng (x)</span>
              </button>
            </div>

            {/* Modal Body / Product Showcase */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 touch-scroll text-center bg-slate-900/60">
              
              {/* Image Display */}
              {viewingProduct.product.isImage && viewingProduct.product.url && (
                <div className="flex flex-col items-center">
                  <div className="relative rounded-2xl overflow-hidden bg-black/80 border-2 border-emerald-400/40 p-2 shadow-2xl max-h-[58vh] flex items-center justify-center w-full group">
                    {/* Nút tắt (X) ở góc sản phẩm */}
                    <button
                      type="button"
                      onClick={() => setViewingProduct(null)}
                      className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-slate-900/90 hover:bg-rose-600 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95"
                      title="Tắt xem sản phẩm • Quay về màn hình chấm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <img
                      src={viewingProduct.product.url}
                      alt={viewingProduct.product.title}
                      className="max-h-[54vh] w-auto max-w-full object-contain rounded-xl shadow-lg"
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>💡 Ảnh hiển thị chuẩn sắc nét cho giám khảo chấm điểm</span>
                    <button
                      type="button"
                      onClick={() => openProductInNewTab(viewingProduct.product.url, viewingProduct.product.title)}
                      className="text-cyan-300 hover:text-cyan-200 underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Mở toàn màn hình tab mới
                    </button>
                  </div>
                </div>
              )}

              {/* Audio Display */}
              {viewingProduct.product.isAudio && viewingProduct.product.url && (
                <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-purple-950/50 via-slate-900 to-slate-950 border-2 border-purple-500/40 flex flex-col items-center justify-center text-center shadow-inner">
                  {/* Nút tắt (X) ở góc sản phẩm */}
                  <button
                    type="button"
                    onClick={() => setViewingProduct(null)}
                    className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-900/90 hover:bg-rose-600 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95"
                    title="Tắt xem sản phẩm • Quay về màn hình chấm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="w-20 h-20 rounded-3xl bg-purple-500/20 border-2 border-purple-400/50 flex items-center justify-center text-purple-300 mb-4 shadow-[0_0_35px_rgba(168,85,247,0.4)] animate-pulse">
                    <Volume2 className="w-10 h-10" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/40 text-xs font-black uppercase tracking-wider mb-2">
                    BÀI THUYẾT TRÌNH ÂM THANH
                  </span>
                  <h4 className="text-lg sm:text-xl font-black text-white mb-1">
                    {viewingProduct.product.title}
                  </h4>
                  <p className="text-xs text-slate-300 mb-5">
                    Đội thi: <strong className="text-cyan-300">{viewingProduct.teamName}</strong>
                  </p>
                  
                  <audio
                    controls
                    autoPlay
                    src={viewingProduct.product.url}
                    className="w-full max-w-lg h-12 shadow-xl rounded-2xl border border-purple-400/30 bg-purple-950/30"
                  />
                </div>
              )}

              {/* Other Document / Drive Link */}
              {!viewingProduct.product.isImage && !viewingProduct.product.isAudio && (
                <div className="p-8 rounded-3xl bg-slate-950/80 border-2 border-emerald-400/40 flex flex-col items-center justify-center text-center">
                  <ExternalLink className="w-12 h-12 text-emerald-400 mb-3" />
                  <h4 className="text-base sm:text-lg font-bold text-white mb-1">
                    {viewingProduct.product.title}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mb-4 truncate">
                    {viewingProduct.product.url}
                  </p>
                  <a
                    href={viewingProduct.product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg"
                  >
                    <ExternalLink className="w-4 h-4" /> Mở tài liệu trên tab mới
                  </a>
                </div>
              )}

              {/* Description */}
              {viewingProduct.product.description && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 text-left">
                  <span className="text-[10px] font-black uppercase text-amber-300 block mb-1">
                    Mô tả / Thuyết minh sản phẩm từ học sinh:
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {viewingProduct.product.description}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Scoring Bar at the Bottom */}
            <div className="p-3.5 sm:p-4 bg-slate-950/95 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-left">
                <span className="text-xs font-black text-amber-300 uppercase flex items-center gap-1.5 whitespace-nowrap">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>{judgeId} chấm điểm:</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0 - 100"
                  value={draftScores[viewingProduct.teamId] ?? ''}
                  onChange={e => handleScoreChange(viewingProduct.teamId, e.target.value)}
                  className="w-24 py-1.5 px-3 bg-slate-900 border-2 border-amber-400 rounded-xl text-center font-mono font-black text-lg text-yellow-300 outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleSaveScore(viewingProduct.teamId, viewingProduct.teamName);
                    setTimeout(() => setViewingProduct(null), 500);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                >
                  Lưu điểm & Đóng
                </button>
              </div>

              {/* Bottom Return Button */}
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ml-auto border border-white/15"
              >
                <X className="w-4 h-4 text-rose-400" />
                <span>Quay về màn hình chấm</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </CyberSpaceBackground>
  );
}
