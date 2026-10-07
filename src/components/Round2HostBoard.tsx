import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Trophy, 
  ExternalLink, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Image as ImageIcon, 
  Users, 
  Award,
  Crown,
  Medal,
  RefreshCw,
  Eye,
  Megaphone,
  Atom,
  LogOut,
  Cloud,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';
import { GameSession, Round2Group, Round2Submission, Round2JudgeScores } from '../types';
import { 
  ROUND_2_GROUPS_CONFIG, 
  getTeamProducts, 
  openProductInNewTab,
  extractSubmissionsMap,
  extractScoresMap
} from '../utils/round2Grouping';
import { gameAudio } from '../utils/gameAudio';
import ConfettiEffect from './ConfettiEffect';
import { CyberSpaceBackground } from './CyberSpaceBackground';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { syncJudgeScoreToServer } from '../services/serverSync';
import { firestoreQuota } from '../utils/firestoreQuota';
import { saveSubmissionsBackupToGoogleDrive, ensureDriveAccessToken } from '../services/googleDriveService';
import { exportSessionToGoogleSheets } from '../services/googleSheetsService';

interface Round2HostBoardProps {
  session: GameSession;
  onBackToRound1: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  isMuted: boolean;
  toggleAudio: () => void;
  onOpenShuffleModal?: () => void;
  onOpenSeatingModal?: () => void;
  onOpenAtomicClock?: () => void;
  onOpenAnnouncement?: () => void;
  onExitToHome?: () => void;
  round2Submissions?: Record<string, any>;
}

const JUDGES = [
  { id: 'GK01', name: 'GK 1' },
  { id: 'GK02', name: 'GK 2' },
  { id: 'GK03', name: 'GK 3' },
  { id: 'GK04', name: 'GK 4' },
  { id: 'GK05', name: 'GK 5' }
];

export default function Round2HostBoard({
  session,
  onBackToRound1,
  isFullscreen,
  toggleFullscreen,
  isMuted,
  toggleAudio,
  onOpenShuffleModal,
  onOpenSeatingModal,
  onOpenAtomicClock,
  onOpenAnnouncement,
  onExitToHome,
  round2Submissions
}: Round2HostBoardProps) {
  // Submission toast notice
  const [submissionNotice, setSubmissionNotice] = useState<{
    teamName: string;
    productTitle: string;
    timestamp: number;
  } | null>(null);

  // Score toast notice when a judge evaluates
  const [scoreNotice, setScoreNotice] = useState<{
    teamName: string;
    judgeName: string;
    score: number;
    timestamp: number;
  } | null>(null);

  // Recently updated score cell for pulse glow animation
  const [recentlyUpdatedCell, setRecentlyUpdatedCell] = useState<{
    teamId: string;
    judgeId: string;
  } | null>(null);

  // Quick interactive Host / Judge scoring modal (Chấm chung)
  const [gradingCell, setGradingCell] = useState<{
    teamId: string;
    teamName: string;
    teamIcon?: string;
    judgeId: string;
    score: number | '';
  } | null>(null);
  const [isSavingHostScore, setIsSavingHostScore] = useState(false);

  // Google Drive Submissions Backup state
  const [isBackingUpDrive, setIsBackingUpDrive] = useState(false);
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [driveBackupNotice, setDriveBackupNotice] = useState<string | null>(null);

  // Grand Awards Modal for Top 2 teams
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [confettiKey, setConfettiKey] = useState<number>(1);

  // Enlarged Image Lightbox modal (if teacher wants to inspect directly on projector)
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    teamName: string;
  } | null>(null);

  // Track submissions to trigger audio chime whenever a new product arrives from student device
  const isInitialLoadRef = useRef<boolean>(true);
  const prevSubmissionsMapRef = useRef<Record<string, number>>({});
  const hasAutoAnnouncedAwardsRef = useRef<boolean>(false);

  // Track judge scores to trigger celebration chime and visual notification immediately on host board
  const isInitialScoresLoadRef = useRef<boolean>(true);
  const prevScoresMapRef = useRef<Record<string, Record<string, number>>>({});

  const submissions = {
    ...extractSubmissionsMap(session),
    ...(round2Submissions || {})
  };
  const scores = extractScoresMap(session);

  // Detect new submissions and play sound immediately on host board
  useEffect(() => {
    const currentSubmissions = {
      ...extractSubmissionsMap(session),
      ...(round2Submissions || {})
    };
    const teamIds = Object.keys(currentSubmissions);

    if (isInitialLoadRef.current) {
      const initialMap: Record<string, number> = {};
      for (const tId of teamIds) {
        if (currentSubmissions[tId]?.submittedAt) {
          initialMap[tId] = currentSubmissions[tId].submittedAt;
        }
      }
      prevSubmissionsMapRef.current = initialMap;
      isInitialLoadRef.current = false;
      return;
    }

    // Check if any submission is new or updated
    for (const tId of teamIds) {
      const sub = currentSubmissions[tId];
      if (sub && sub.submittedAt) {
        const prevTime = prevSubmissionsMapRef.current[tId] || 0;
        if (sub.submittedAt > prevTime) {
          // New submission arrived from a student device!
          gameAudio.playVictory();
          setSubmissionNotice({
            teamName: sub.teamName,
            productTitle: sub.title,
            timestamp: Date.now()
          });
          break;
        }
      }
    }

    // Update tracked timestamps
    const newMap: Record<string, number> = {};
    for (const tId of teamIds) {
      if (currentSubmissions[tId]?.submittedAt) {
        newMap[tId] = currentSubmissions[tId].submittedAt;
      }
    }
    prevSubmissionsMapRef.current = newMap;
  }, [session.round2Submissions, session.lastRound2Update, round2Submissions]);

  // Auto-dismiss submission banner after 7s
  useEffect(() => {
    if (!submissionNotice) return;
    const timer = setTimeout(() => {
      setSubmissionNotice(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [submissionNotice]);

  // Detect judge score updates and trigger chime sound and banner on host board
  useEffect(() => {
    const currentScores = extractScoresMap(session);
    const teamIds = ROUND_2_GROUPS_CONFIG.map(t => t.id);

    if (isInitialScoresLoadRef.current) {
      const initialMap: Record<string, Record<string, number>> = {};
      for (const tId of teamIds) {
        initialMap[tId] = { ...(currentScores[tId] || {}) };
      }
      prevScoresMapRef.current = initialMap;
      isInitialScoresLoadRef.current = false;
      return;
    }

    // Check for any judge score change
    for (const tId of teamIds) {
      const teamCfg = ROUND_2_GROUPS_CONFIG.find(c => c.id === tId);
      const teamName = teamCfg?.name || tId;
      const teamScoreMap = currentScores[tId] || {};
      const prevTeamScoreMap = prevScoresMapRef.current[tId] || {};

      for (const j of JUDGES) {
        const newScore = teamScoreMap[j.id];
        const oldScore = prevTeamScoreMap[j.id];

        if (typeof newScore === 'number' && newScore !== oldScore) {
          // A judge just scored or updated score!
          gameAudio.playVictory();
          setScoreNotice({
            teamName,
            judgeName: j.name,
            score: newScore,
            timestamp: Date.now()
          });
          setRecentlyUpdatedCell({
            teamId: tId,
            judgeId: j.id
          });
          break;
        }
      }
    }

    // Update tracked map
    const newMap: Record<string, Record<string, number>> = {};
    for (const tId of teamIds) {
      newMap[tId] = { ...(currentScores[tId] || {}) };
    }
    prevScoresMapRef.current = newMap;
  }, [session.round2Scores, session.lastRound2Update]);

  // Auto-dismiss score notice banner after 5s
  useEffect(() => {
    if (!scoreNotice) return;
    const timer = setTimeout(() => {
      setScoreNotice(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [scoreNotice]);

  // Auto-clear cell glow after 3s
  useEffect(() => {
    if (!recentlyUpdatedCell) return;
    const timer = setTimeout(() => {
      setRecentlyUpdatedCell(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [recentlyUpdatedCell]);

  // Combined teams data: config + members from session.round2Groups + submissions + scores
  const teamsData = useMemo(() => {
    return ROUND_2_GROUPS_CONFIG.map(cfg => {
      // Find matching group in session.round2Groups
      const groupInSession = session.round2Groups?.find(g => g.id === cfg.id || g.name === cfg.name);
      const members = groupInSession?.members || [];
      const submission = submissions[cfg.id];
      const teamScores = scores[cfg.id] || {};

      // Calculate total score from GK01 to GK05
      let totalScore = 0;
      let ratedJudgesCount = 0;
      JUDGES.forEach(j => {
        const val = typeof teamScores[j.id] === 'number' 
          ? teamScores[j.id] 
          : (j.id === 'GK01' && typeof teamScores['GK'] === 'number' ? teamScores['GK'] : undefined);
        if (typeof val === 'number') {
          totalScore += val;
          ratedJudgesCount++;
        }
      });

      const avgScore = ratedJudgesCount > 0 ? (totalScore / ratedJudgesCount).toFixed(1) : '0';

      return {
        ...cfg,
        members,
        submission,
        scores: {
          ...teamScores,
          GK01: teamScores.GK01 ?? teamScores.GK
        },
        totalScore,
        avgScore,
        ratedJudgesCount
      };
    });
  }, [session.round2Groups, submissions, scores]);

  // Sort teams by total score descending to determine top 3 (only for teams with >= 3 judges)
  const rankedTeams = useMemo(() => {
    return [...teamsData]
      .filter(t => t.ratedJudgesCount >= 3)
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [teamsData]);

  // Check if all 6 teams have at least 3 judges graded
  const allTeamsCompletedGrading = useMemo(() => {
    return teamsData.length === 6 && teamsData.every(t => t.ratedJudgesCount >= 3);
  }, [teamsData]);

  // Auto-trigger celebration when all 6 teams complete their scores with at least 3 judges
  useEffect(() => {
    if (allTeamsCompletedGrading && !hasAutoAnnouncedAwardsRef.current) {
      hasAutoAnnouncedAwardsRef.current = true;
      gameAudio.playVictory();
      setConfettiKey(prev => prev + 1);
      setShowResultModal(true);
    }
  }, [allTeamsCompletedGrading]);

  // Handler to open product image or link in a new tab (supports both URLs and data URIs)
  const handleOpenProductInNewTab = (productUrl: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!productUrl) return;

    if (productUrl.startsWith('data:image')) {
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
              <img src="${productUrl}" alt="Sản phẩm dự thi" />
            </body>
          </html>
        `);
        newWin.document.close();
        return;
      }
    }

    window.open(productUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenAwards = () => {
    gameAudio.playVictory();
    setConfettiKey(prev => prev + 1);
    setShowResultModal(true);
  };

  const handleSaveHostScore = async () => {
    if (!gradingCell || !session) return;
    const rawVal = gradingCell.score;
    if (rawVal === '' || rawVal === undefined || isNaN(Number(rawVal))) return;
    const scoreNum = Math.min(100, Math.max(0, Number(rawVal)));
    setIsSavingHostScore(true);

    // 1. Audio and pulse glow feedback
    gameAudio.playVictory();
    setRecentlyUpdatedCell({
      teamId: gradingCell.teamId,
      judgeId: gradingCell.judgeId
    });

    // 2. Immediate server sync (0ms lag)
    syncJudgeScoreToServer(session.id, gradingCell.teamId, gradingCell.judgeId, scoreNum);

    // 3. Save to Firestore background merge
    try {
      const existingScores = extractScoresMap(session);
      const teamScores = {
        ...(existingScores[gradingCell.teamId] || {}),
        [gradingCell.judgeId]: scoreNum
      };
      if (gradingCell.judgeId === 'GK01') {
        teamScores.GK = scoreNum;
      }
      const updatePayload: Record<string, any> = {
        round2Scores: {
          ...existingScores,
          [gradingCell.teamId]: teamScores
        },
        [`round2Scores.${gradingCell.teamId}.${gradingCell.judgeId}`]: scoreNum,
        lastRound2Update: Date.now()
      };
      if (gradingCell.judgeId === 'GK01') {
        updatePayload[`round2Scores.${gradingCell.teamId}.GK`] = scoreNum;
      }

      await setDoc(doc(db, 'sessions', session.id), updatePayload, { merge: true }).catch(err => {
        firestoreQuota.reportError(err);
        console.warn('Firestore judge score sync notice:', err);
      });
    } catch (err) {
      console.warn('Error saving host score to Firestore:', err);
    } finally {
      setIsSavingHostScore(false);
      setGradingCell(null);
    }
  };

  const handleBackupSubmissionsToDrive = async () => {
    setIsBackingUpDrive(true);
    try {
      const token = await ensureDriveAccessToken();
      const currentSubmissions = {
        ...extractSubmissionsMap(session),
        ...(round2Submissions || {})
      };
      const res = await saveSubmissionsBackupToGoogleDrive(session.id, currentSubmissions, token);
      gameAudio.playVictory();
      setDriveBackupNotice(`🎉 Đã lưu ${res.uploadedCount} tệp sản phẩm lên Google Drive thành công!`);
      setTimeout(() => setDriveBackupNotice(null), 5000);
    } catch (err: any) {
      console.error('Backup to drive error:', err);
      alert('Không thể lưu lên Google Drive: ' + (err?.message || 'Vui lòng kiểm tra quyền truy cập.'));
    } finally {
      setIsBackingUpDrive(false);
    }
  };

  const handleExportGoogleSheets = async () => {
    setIsExportingSheets(true);
    try {
      const token = await ensureDriveAccessToken();
      const res = await exportSessionToGoogleSheets(session, token);
      gameAudio.playVictory();
      setDriveBackupNotice(`📊 Đã xuất Bảng điểm sang Google Sheets thành công! Đang mở...`);
      window.open(res.spreadsheetUrl, '_blank');
      setTimeout(() => setDriveBackupNotice(null), 6000);
    } catch (err: any) {
      console.error('Export sheets error:', err);
      alert('Không thể xuất Google Sheets: ' + (err?.message || 'Vui lòng kiểm tra quyền truy cập.'));
    } finally {
      setIsExportingSheets(false);
    }
  };

  return (
    <CyberSpaceBackground stationColor="#10B981" className="p-3 sm:p-5 md:p-6 flex flex-col justify-between min-h-screen select-none">
      {/* Drive Backup Notice */}
      {driveBackupNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 p-4 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.8)] border-2 border-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-6 duration-300">
          <div className="flex items-center gap-3">
            <Cloud className="w-8 h-8 text-slate-950 animate-bounce flex-shrink-0" />
            <div className="text-xs sm:text-sm font-black text-slate-950">{driveBackupNotice}</div>
          </div>
          <button
            onClick={() => setDriveBackupNotice(null)}
            className="px-3 py-1 bg-slate-950/20 hover:bg-slate-950/30 rounded-xl text-xs font-black cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Top Banner Notice when a team submits */}
      {submissionNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[90%] bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 p-4 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.7)] border-2 border-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-6 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/30 flex items-center justify-center text-2xl flex-shrink-0 animate-bounce">
              📦
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 fill-current" /> ĐỘI VỪA NỘP SẢN PHẨM MỚI!
              </div>
              <div className="text-base font-black text-slate-950 leading-tight">
                {submissionNotice.teamName}
              </div>
              <div className="text-xs font-bold text-slate-900 truncate max-w-sm mt-0.5">
                Sản phẩm: {submissionNotice.productTitle}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSubmissionNotice(null)}
            className="px-3 py-1.5 bg-slate-950/20 hover:bg-slate-950/30 rounded-xl text-xs font-black cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Top Banner Notice when a judge saves a score */}
      {scoreNotice && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-[90%] bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 text-slate-950 p-4 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.8)] border-2 border-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-6 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/40 flex items-center justify-center text-2xl flex-shrink-0 animate-bounce shadow-md">
              ⚖️
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 fill-current" /> GIÁM KHẢO VỪA CHẤM ĐIỂM!
              </div>
              <div className="text-sm font-black text-slate-950 leading-tight">
                {scoreNotice.judgeName} ➔ <span className="underline">{scoreNotice.teamName}</span>
              </div>
              <div className="text-xs font-black text-slate-900 mt-0.5">
                Điểm chấm: <span className="text-sm font-extrabold text-slate-950 bg-white/50 px-2 py-0.5 rounded-lg border border-slate-950/20">{scoreNotice.score} / 100</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setScoreNotice(null)}
            className="px-3 py-1.5 bg-slate-950/20 hover:bg-slate-950/30 rounded-xl text-xs font-black cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Lightbox Modal for enlarged product viewing */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="max-w-4xl max-h-[90vh] bg-slate-900 border-2 border-emerald-400 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.4)] flex flex-col cursor-default"
          >
            <div className="p-4 bg-slate-950 border-b border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400 block">{lightboxImage.teamName}</span>
                <h3 className="text-lg font-black text-white">{lightboxImage.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenProductInNewTab(lightboxImage.url)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Mở tab mới
                </button>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
              <img 
                src={lightboxImage.url} 
                alt={lightboxImage.title} 
                className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl" 
              />
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="w-full max-w-[177.78vh] mx-auto space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 glass-neon-card-glow rounded-3xl p-4 sm:p-5 shadow-[0_0_50px_rgba(16,185,129,0.25)] border-2 border-emerald-400/40">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-teal-500/20 border-2 border-emerald-400 flex items-center justify-center flex-shrink-0 shadow-[0_0_30px_rgba(16,185,129,0.4)] text-3xl">
              🌱
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5 animate-spin" /> VÒNG 2: TRANH TÀI SẢN PHẨM & DỰ ÁN MÔI TRƯỜNG (6 NHÓM)
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                Từ dĩa ăn sạch đến thành phố sạch • Chấm điểm Giám khảo
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm">
                6 Đội thi nộp sản phẩm trực tiếp từ thiết bị • Giám khảo chấm điểm thời gian thực • <strong>3 nhóm điểm cao nhất sẽ vào vòng tiếp theo</strong>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Award Ceremony Button: Chỉ hiển thị khi cả 6 nhóm đều được ít nhất 3 giám khảo chấm */}
            {allTeamsCompletedGrading ? (
              <button
                onClick={handleOpenAwards}
                className="px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-[0_0_40px_rgba(251,191,36,0.95)] cursor-pointer active:scale-95 border-2 border-yellow-200 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-slate-950 font-black text-xs md:text-sm ring-4 ring-yellow-400/50 animate-pulse btn-modern-shine btn-modern-glow"
                title="Đã đủ ít nhất 3 Giám khảo chấm cho cả 6 nhóm • Bấm để xem kết quả và công bố Top 3"
              >
                <Trophy className="w-4 h-4 text-slate-950 animate-bounce" />
                <span>👑 XEM KẾT QUẢ VÒNG 2 • CÔNG BỐ TOP 3</span>
              </button>
            ) : (
              <div 
                className="px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-sm"
                title="Nút xem kết quả sẽ tự động hiển thị khi cả 6 nhóm đều có ít nhất 3 Giám khảo chấm điểm"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>
                  Chờ GK chấm: <strong className="text-white font-mono">{teamsData.filter(t => t.ratedJudgesCount >= 3).length}/6 nhóm</strong> đủ ≥3 GK
                </span>
              </div>
            )}

            {/* Group Shuffle Button for teacher */}
            {onOpenShuffleModal && (
              <button
                onClick={onOpenShuffleModal}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 hover:from-cyan-300 hover:to-pink-400 text-slate-950 font-black text-xs md:text-sm rounded-2xl flex items-center gap-1.5 shadow-[0_0_25px_rgba(0,217,255,0.5)] cursor-pointer active:scale-95 border-2 border-cyan-200"
                title="Xáo trộn Top 18 vào 6 nhóm và đồng bộ tất cả máy"
              >
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>🎲 XÁO TRỘN 6 NHÓM</span>
              </button>
            )}

            {/* Direct Judge Portal Link */}
            <a
              href={`/judge?session=${session.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all border border-amber-400/40"
              title="Mở Cổng chấm điểm Ban Giám khảo (GK01 - GK05) trên tab hoặc thiết bị khác"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>⚖️ Cổng Giám Khảo</span>
            </a>

            {/* Google Drive Submissions Backup */}
            <button
              onClick={handleBackupSubmissionsToDrive}
              disabled={isBackingUpDrive}
              className="px-3.5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all border border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.25)] cursor-pointer active:scale-95 disabled:opacity-50"
              title="Sao lưu tất cả bài nộp và ảnh sản phẩm lên Google Drive"
            >
              {isBackingUpDrive ? <Loader2 className="w-4 h-4 animate-spin text-emerald-300" /> : <Cloud className="w-4 h-4 text-emerald-300" />}
              <span className="hidden sm:inline">{isBackingUpDrive ? 'Đang lưu Drive...' : 'Lưu Drive'}</span>
              <span className="sm:hidden">Drive</span>
            </button>

            {/* Google Sheets Export */}
            <button
              onClick={handleExportGoogleSheets}
              disabled={isExportingSheets}
              className="px-3.5 py-2.5 bg-teal-500/20 hover:bg-teal-500/35 text-teal-300 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all border border-teal-400/40 shadow-[0_0_15px_rgba(20,184,166,0.25)] cursor-pointer active:scale-95 disabled:opacity-50"
              title="Xuất bảng điểm tổng hợp Vòng 1 và Vòng 2 sang Google Sheets trực tuyến"
            >
              {isExportingSheets ? <Loader2 className="w-4 h-4 animate-spin text-teal-300" /> : <FileSpreadsheet className="w-4 h-4 text-teal-300" />}
              <span className="hidden sm:inline">{isExportingSheets ? 'Đang xuất Sheets...' : 'Xuất Sheets'}</span>
              <span className="sm:hidden">Sheets</span>
            </button>

            {/* Seating Arrangement Button (30 HS) */}
            {onOpenSeatingModal && (
              <button
                onClick={onOpenSeatingModal}
                className="px-3.5 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all border border-indigo-400/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                title="Mở sơ đồ xếp chỗ phòng thi: 6 dãy, mỗi dãy 5 HS (Tổng 30 HS)"
              >
                <Users className="w-4 h-4 text-indigo-300" />
                <span className="hidden sm:inline">Xếp chỗ HS (30)</span>
                <span className="sm:hidden">Xếp chỗ</span>
              </button>
            )}

            {/* Atomic Planetary Clock Button (5 phút) */}
            {onOpenAtomicClock && (
              <button
                onClick={onOpenAtomicClock}
                className="px-3.5 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all border border-cyan-400/40 shadow-[0_0_15px_rgba(56,189,248,0.25)]"
                title="Mở đồng hồ đếm ngược hành tinh nguyên tử (Mặc định 5 phút)"
              >
                <Atom className="w-4 h-4 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
                <span className="hidden sm:inline">Đồng hồ (5p)</span>
                <span className="sm:hidden">Đồng hồ</span>
              </button>
            )}

            {/* Teacher Announcement Button */}
            {onOpenAnnouncement && (
              <button
                onClick={onOpenAnnouncement}
                className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 border ${
                  session.announcement?.message
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/40'
                }`}
                title="Phát thông báo hoặc gửi lời nhắc trực tiếp theo thời gian thực tới tất cả máy học sinh"
              >
                <Megaphone className="w-4 h-4" />
                <span className="hidden sm:inline">{session.announcement?.message ? 'Đang phát TB' : 'Thông báo HS'}</span>
                <span className="sm:hidden">TB</span>
              </button>
            )}

            {/* Back to Round 1 button */}
            <button
              onClick={onBackToRound1}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer border border-white/15"
              title="Quay lại Bảng xếp hạng Vòng 1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Vòng 1 (Đấu trường Số)</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={toggleAudio}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-cyan-300 rounded-2xl border border-white/15 cursor-pointer"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold border border-white/15 cursor-pointer"
              title="Toàn màn hình máy chiếu"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* Exit to Home / End Game Button */}
            {onExitToHome && (
              <button
                onClick={onExitToHome}
                className="px-3.5 py-2.5 bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 hover:text-white rounded-2xl font-black text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 border border-rose-400/50"
                title="Đóng game và về trang chủ để chuẩn bị game mới (toàn bộ học sinh và giám khảo sẽ dừng lại)"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Về trang chủ • Đóng game</span>
                <span className="sm:hidden">Đóng game</span>
              </button>
            )}
          </div>
        </div>

        {/* 6 TEAMS GRID (Compact 3x2: 3 nhóm hàng trên, 3 nhóm hàng dưới) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {teamsData.map((team, index) => {
            const hasSubmission = !!team.submission;
            const isEligible = team.ratedJudgesCount >= 3;
            const rankIndex = isEligible ? rankedTeams.findIndex(t => t.id === team.id) : -1;
            const isRank1 = isEligible && team.totalScore > 0 && rankIndex === 0;
            const isRank2 = isEligible && team.totalScore > 0 && rankIndex === 1;
            const isRank3 = isEligible && team.totalScore > 0 && rankIndex === 2;

            return (
              <div
                key={team.id}
                className={`rounded-2xl p-2.5 sm:p-3 border-2 ${team.borderColor} bg-slate-900/90 shadow-md flex flex-col justify-between gap-2 backdrop-blur-xl relative overflow-hidden transition-all duration-300 hover:shadow-[0_0_35px_rgba(16,185,129,0.2)] ${
                  isRank1 ? 'ring-2 ring-yellow-400/70 shadow-[0_0_25px_rgba(250,204,21,0.3)]' : isRank2 ? 'ring-2 ring-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.25)]' : isRank3 ? 'ring-2 ring-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)]' : ''
                }`}
              >
                {/* Ambient Card Background Gradient */}
                <div className={`absolute top-0 right-0 w-60 h-60 bg-gradient-to-br ${team.accentBg} rounded-full blur-3xl opacity-20 pointer-events-none`} />

                {/* Team Header & Members */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shadow-md flex-shrink-0">
                        {team.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1">
                          <h2 className="text-sm sm:text-base font-black text-white truncate">
                            {team.name}
                          </h2>
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-slate-300 border border-white/10 flex-shrink-0">
                            #{index + 1}
                          </span>
                          {isRank1 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase bg-yellow-400 text-slate-950 border border-yellow-300 animate-pulse flex-shrink-0">
                              👑 TOP 1
                            </span>
                          )}
                          {isRank2 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase bg-cyan-400 text-slate-950 border border-cyan-300 flex-shrink-0">
                              🥈 TOP 2
                            </span>
                          )}
                          {isRank3 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-300 flex-shrink-0">
                              🥉 TOP 3
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-300 italic truncate">
                          {team.slogan}
                        </p>
                      </div>
                    </div>

                    {/* Submission status pill */}
                    {hasSubmission ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[10px] font-black flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>ĐÃ NỘP</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold flex items-center gap-1 animate-pulse whitespace-nowrap flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>CHỜ NỘP</span>
                      </span>
                    )}
                  </div>

                  {/* Team Members List */}
                  <div className="flex flex-wrap items-center gap-1 mb-1.5 p-1.5 rounded-lg bg-slate-950/60 border border-white/10 text-[10px]">
                    <span className="text-[9px] font-black uppercase text-slate-400 mr-0.5 flex items-center gap-0.5">
                      <Users className="w-2.5 h-2.5 text-cyan-400" /> ({team.members.length}):
                    </span>
                    {team.members.length === 0 ? (
                      <span className="text-[10px] text-slate-500 italic">Chưa xáo trộn</span>
                    ) : (
                      team.members.map(m => (
                        <span 
                          key={m.id} 
                          className="px-1.5 py-0.2 rounded bg-white/10 text-white font-bold text-[10px] flex items-center gap-0.5 border border-white/10"
                        >
                          <span>{m.name}</span>
                          {m.className && (
                            <span className="text-[8px] text-cyan-300 font-mono">({m.className})</span>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* PRODUCT SHOWCASE AREA (Supports up to 2 products) */}
                {(() => {
                  const prods = getTeamProducts(team.submission);
                  if (prods.length === 0) {
                    return (
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10 flex items-center gap-2 text-slate-500 text-xs">
                        <ImageIcon className="w-5 h-5 opacity-40 animate-pulse flex-shrink-0" />
                        <span className="text-[10px] italic">Chưa nộp sản phẩm. Học sinh nộp tối đa 2 sản phẩm (Google Drive/Ảnh) trên máy cá nhân.</span>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5">
                      {prods.map((prod) => (
                        <div 
                          key={prod.id}
                          className="p-1.5 rounded-xl bg-slate-950/90 border border-white/15 flex items-center gap-2 text-left hover:border-emerald-400/50 transition-colors"
                        >
                          {/* Thumbnail / Audio / File icon */}
                          {prod.isImage && prod.url ? (
                            <div 
                              onClick={(e) => openProductInNewTab(prod.url, prod.title, e)}
                              className="relative w-14 h-12 rounded-lg overflow-hidden group cursor-pointer border border-emerald-400/60 flex-shrink-0 bg-slate-900 shadow-sm"
                              title="Bấm để mở sản phẩm trên tab mới"
                            >
                              <img 
                                src={prod.url} 
                                alt={prod.title} 
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                              />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-black">
                                <ExternalLink className="w-3 h-3 text-emerald-300" />
                              </div>
                            </div>
                          ) : prod.isAudio && prod.url ? (
                            <div 
                              onClick={(e) => openProductInNewTab(prod.url, prod.title, e)}
                              className="w-14 h-12 rounded-lg bg-purple-500/20 border border-purple-400/50 hover:border-purple-300 flex flex-col items-center justify-center text-purple-300 gap-0.5 cursor-pointer flex-shrink-0 shadow-sm"
                              title="Bấm để nghe/mở âm thanh trên tab mới"
                            >
                              <Volume2 className="w-4 h-4 text-purple-300" />
                              <span className="text-[7px] font-black uppercase tracking-wider">Audio</span>
                            </div>
                          ) : (
                            <div 
                              onClick={(e) => openProductInNewTab(prod.url, prod.title, e)}
                              className="w-14 h-12 rounded-lg bg-emerald-500/10 border border-emerald-400/40 hover:border-emerald-300 flex flex-col items-center justify-center text-emerald-300 gap-0.5 cursor-pointer flex-shrink-0"
                              title="Bấm để mở tệp trên tab mới"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span className="text-[8px] font-black uppercase">Tệp</span>
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase ${
                                prod.index === 1 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
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
                            <h4 className="text-xs font-black text-white truncate mt-0.5 leading-tight" title={prod.title}>
                              {prod.title}
                            </h4>
                            {prod.description && (
                              <p className="text-[9px] text-slate-300 truncate mt-0.5" title={prod.description}>
                                {prod.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* 6 SCORE BOXES (GK 1 -> 5 + TỔNG ĐIỂM) */}
                <div className="pt-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-400" /> ĐIỂM GIÁM KHẢO (THANG 100):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setGradingCell({
                            teamId: team.id,
                            teamName: team.name,
                            teamIcon: team.icon,
                            judgeId: 'GK01',
                            score: typeof team.scores['GK01'] === 'number' ? team.scores['GK01'] : ''
                          });
                        }}
                        className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white border border-amber-400/40 text-[9px] font-bold cursor-pointer transition-colors"
                        title="Chấm điểm trực tiếp cho nhóm này"
                      >
                        ⚖️ Chấm điểm
                      </button>
                      <span className={`text-[9px] font-bold ${team.ratedJudgesCount >= 3 ? 'text-emerald-400' : 'text-amber-300'}`}>
                        {team.ratedJudgesCount >= 3 ? `✓ Đủ ${team.ratedJudgesCount} GK` : `Chờ (${team.ratedJudgesCount}/3 GK)`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-1 text-center">
                    {/* 5 Judge Boxes - Clickable for Teacher/Judges to edit directly */}
                    {JUDGES.map(j => {
                      const scoreVal = team.scores[j.id];
                      const isGraded = typeof scoreVal === 'number';
                      const isRecentlyUpdated = recentlyUpdatedCell?.teamId === team.id && recentlyUpdatedCell?.judgeId === j.id;

                      return (
                        <div
                          key={j.id}
                          onClick={() => {
                            setGradingCell({
                              teamId: team.id,
                              teamName: team.name,
                              teamIcon: team.icon,
                              judgeId: j.id,
                              score: typeof scoreVal === 'number' ? scoreVal : ''
                            });
                          }}
                          className={`p-1 sm:p-1.5 rounded-lg border flex flex-col items-center justify-center transition-all duration-300 cursor-pointer hover:border-amber-400 hover:scale-105 active:scale-95 ${
                            isRecentlyUpdated
                              ? 'bg-amber-500/40 border-amber-300 ring-4 ring-amber-400 scale-110 shadow-[0_0_25px_rgba(251,191,36,0.9)] animate-pulse z-10'
                              : isGraded
                              ? 'bg-slate-950 border-cyan-400/60 shadow-sm ring-1 ring-cyan-400/30 hover:bg-slate-900'
                              : 'bg-slate-950/60 border-white/10 text-slate-500 hover:border-amber-400/40'
                          }`}
                          title={`Bấm để chấm / sửa điểm cho ${j.name}`}
                        >
                          <span className={`text-[8px] sm:text-[9px] font-black block uppercase ${isRecentlyUpdated ? 'text-amber-200' : 'text-slate-400'}`}>
                            {j.id === 'GK01' ? 'GK1' : j.id}
                          </span>
                          <span className={`text-xs sm:text-sm font-black font-mono mt-0.5 ${
                            isRecentlyUpdated ? 'text-amber-200 font-extrabold text-base' : isGraded ? 'text-cyan-300' : 'text-slate-600'
                          }`}>
                            {isGraded ? scoreVal : '-'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Box 6: TỔNG ĐIỂM (Chỉ hiển thị khi có ít nhất 3 GK chấm) */}
                    {(() => {
                      const isTeamRecentlyUpdated = recentlyUpdatedCell?.teamId === team.id;
                      const hasAtLeast3Judges = team.ratedJudgesCount >= 3;

                      if (hasAtLeast3Judges) {
                        return (
                          <div className={`p-1 sm:p-1.5 rounded-lg border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-amber-500/30 flex flex-col items-center justify-center shadow-sm transition-all duration-300 ${
                            isTeamRecentlyUpdated
                              ? 'ring-4 ring-yellow-300 scale-105 shadow-[0_0_30px_rgba(250,204,21,1)] animate-bounce'
                              : 'ring-1 ring-yellow-400/40'
                          }`}>
                            <span className="text-[8px] sm:text-[9px] font-black text-yellow-300 block uppercase tracking-wider">
                              TỔNG
                            </span>
                            <span className="text-xs sm:text-base font-black font-mono text-yellow-300 mt-0.5">
                              {team.totalScore}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div 
                          className="p-1 sm:p-1.5 rounded-lg border border-dashed border-amber-400/40 bg-slate-950/80 flex flex-col items-center justify-center text-slate-400"
                          title={`Cần ít nhất 3 Giám khảo chấm để hiển thị tổng điểm (Hiện có: ${team.ratedJudgesCount}/3 GK)`}
                        >
                          <span className="text-[7px] sm:text-[8px] font-black text-slate-400 block uppercase">
                            TỔNG
                          </span>
                          <span className="text-[10px] sm:text-xs font-black font-mono text-amber-300 mt-0.5" title="Chờ đủ 3 Giám khảo chấm">
                            {team.ratedJudgesCount}/3 GK
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-[177.78vh] mx-auto mt-4 text-center text-xs text-slate-500">
        Đấu trường Vòng 2 • 6 Đội thi • Giám khảo GK01 - GK05 • Tự động xếp hạng theo Tổng điểm tối đa 500
      </div>

      {/* INTERACTIVE HOST / JUDGE QUICK SCORING MODAL (CHẤM CHUNG) */}
      {gradingCell && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in select-none">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 max-w-md w-full shadow-[0_0_50px_rgba(245,158,11,0.4)] text-white relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{gradingCell.teamIcon || '⚖️'}</span>
                <div>
                  <h3 className="font-black text-base text-white">Chấm Điểm • {gradingCell.teamName}</h3>
                  <span className="text-xs text-amber-300 font-bold">Vị trí: {JUDGES.find(j => j.id === gradingCell.judgeId)?.name || gradingCell.judgeId}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGradingCell(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Chọn Vị trí Giám khảo chấm:
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {JUDGES.map(j => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => {
                        const currentTeam = teamsData.find(t => t.id === gradingCell.teamId);
                        const curScore = currentTeam?.scores[j.id];
                        setGradingCell({
                          ...gradingCell,
                          judgeId: j.id,
                          score: typeof curScore === 'number' ? curScore : ''
                        });
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        gradingCell.judgeId === j.id
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md ring-2 ring-amber-300/60'
                          : 'bg-slate-950/70 border-white/10 text-slate-300 hover:border-amber-400/40'
                      }`}
                    >
                      {j.id === 'GK01' ? 'GK1' : j.id}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Điểm số (Thang 0 - 100):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={gradingCell.score}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value)));
                    setGradingCell({ ...gradingCell, score: val });
                  }}
                  placeholder="Nhập 0 - 100..."
                  className="w-full py-3 px-4 bg-slate-950 border-2 border-amber-400/60 rounded-2xl text-2xl font-mono font-black text-center text-yellow-300 outline-none focus:border-amber-300"
                  autoFocus
                />
              </div>

              {/* Quick score buttons */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Điểm nhanh:</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[75, 80, 85, 90, 95].map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setGradingCell({ ...gradingCell, score: pt })}
                      className="py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30 text-xs font-bold cursor-pointer"
                    >
                      {pt}đ
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGradingCell(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSavingHostScore || gradingCell.score === ''}
                  onClick={handleSaveHostScore}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-[0_0_20px_rgba(251,191,36,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSavingHostScore ? 'Đang lưu...' : 'Lưu điểm ngay ➔'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRAND AWARDS MODAL FOR TOP 2 TEAMS */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300 select-none">
          <ConfettiEffect key={confettiKey} duration={9000} particleCount={200} />

          <div className="w-full max-w-5xl bg-slate-900/95 border-2 border-yellow-400/80 rounded-[2.5rem] p-6 sm:p-10 shadow-[0_0_100px_rgba(250,204,21,0.4)] relative flex flex-col items-center my-auto overflow-hidden">
            {/* Ambient Lighting */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-yellow-400/20 blur-3xl pointer-events-none" />

            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-yellow-400/25 via-amber-400/20 to-yellow-400/25 border-2 border-yellow-400 text-yellow-300 text-xs sm:text-sm font-black uppercase tracking-widest mb-3 shadow-[0_0_30px_rgba(250,204,21,0.4)]">
              <Crown className="w-5 h-5 text-yellow-300 animate-bounce" />
              <span>VINH DANH CHUNG CUỘC VÒNG 2</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-lobster text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 mb-2 tracking-wide drop-shadow-[0_0_30px_rgba(250,204,21,0.6)]">
              Top 3 Đội Xuất Sắc Nhất Vào Vòng Tiếp Theo
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm text-center max-w-2xl mb-8">
              Chúc mừng 3 nhóm có điểm số cao nhất sau khi Ban Giám Khảo chấm đã xuất sắc giành vé bước tiếp vào vòng tiếp theo!
            </p>

            {/* TOP 3 PODIUM CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full mb-8">
              {/* RANK 1: QUÁN QUÂN (GOLD) */}
              {rankedTeams[0] && (
                <div className="p-5 sm:p-6 rounded-[2rem] bg-gradient-to-b from-yellow-500/20 via-amber-500/10 to-slate-950 border-3 border-yellow-400 flex flex-col items-center text-center shadow-[0_0_60px_rgba(250,204,21,0.45)] ring-4 ring-yellow-400/30 relative">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-yellow-300 to-amber-500 text-slate-950 font-black text-3xl flex items-center justify-center mb-2 shadow-[0_0_40px_rgba(250,204,21,0.6)] animate-bounce">
                    👑
                  </div>
                  <span className="px-3.5 py-1 rounded-full bg-yellow-400 text-slate-950 text-xs font-black uppercase tracking-wider mb-2 shadow-md">
                    QUÁN QUÂN • VÀO VÒNG TIẾP THEO
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-yellow-300 mb-1">
                    {rankedTeams[0].name}
                  </h3>
                  <p className="text-xs text-slate-300 italic mb-3 line-clamp-1">
                    {rankedTeams[0].submission?.title || rankedTeams[0].slogan}
                  </p>

                  <div className="text-2xl sm:text-3xl font-mono font-black text-yellow-300 flex items-center justify-center gap-1.5 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)] mb-3">
                    <span>⚡ {rankedTeams[0].totalScore}</span>
                    <span className="text-xs font-normal text-yellow-200/80">điểm</span>
                  </div>

                  {/* Members list */}
                  <div className="w-full p-2.5 rounded-2xl bg-black/40 border border-yellow-400/30 text-left mt-auto">
                    <span className="text-[10px] font-black uppercase text-yellow-300 block mb-1">
                      Thành viên đội:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {rankedTeams[0].members.map(m => (
                        <span key={m.id} className="px-2 py-0.5 rounded-lg bg-yellow-400/20 text-yellow-200 text-[11px] font-bold border border-yellow-400/30">
                          {m.name} {m.className ? `(${m.className})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* RANK 2: Á QUÂN (SILVER) */}
              {rankedTeams[1] && (
                <div className="p-5 sm:p-6 rounded-[2rem] bg-gradient-to-b from-cyan-500/20 via-sky-500/10 to-slate-950 border-3 border-cyan-400 flex flex-col items-center text-center shadow-[0_0_50px_rgba(6,182,212,0.35)] ring-4 ring-cyan-400/30 relative">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-300 to-sky-500 text-slate-950 font-black text-3xl flex items-center justify-center mb-2 shadow-[0_0_30px_rgba(6,182,212,0.5)]">
                    🥈
                  </div>
                  <span className="px-3.5 py-1 rounded-full bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-wider mb-2 shadow-md">
                    Á QUÂN • VÀO VÒNG TIẾP THEO
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-cyan-300 mb-1">
                    {rankedTeams[1].name}
                  </h3>
                  <p className="text-xs text-slate-300 italic mb-3 line-clamp-1">
                    {rankedTeams[1].submission?.title || rankedTeams[1].slogan}
                  </p>

                  <div className="text-2xl sm:text-3xl font-mono font-black text-cyan-300 flex items-center justify-center gap-1.5 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)] mb-3">
                    <span>⚡ {rankedTeams[1].totalScore}</span>
                    <span className="text-xs font-normal text-cyan-200/80">điểm</span>
                  </div>

                  {/* Members list */}
                  <div className="w-full p-2.5 rounded-2xl bg-black/40 border border-cyan-400/30 text-left mt-auto">
                    <span className="text-[10px] font-black uppercase text-cyan-300 block mb-1">
                      Thành viên đội:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {rankedTeams[1].members.map(m => (
                        <span key={m.id} className="px-2 py-0.5 rounded-lg bg-cyan-400/20 text-cyan-200 text-[11px] font-bold border border-cyan-400/30">
                          {m.name} {m.className ? `(${m.className})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* RANK 3: QUÝ QUÂN (BRONZE) */}
              {rankedTeams[2] && (
                <div className="p-5 sm:p-6 rounded-[2rem] bg-gradient-to-b from-amber-500/20 via-orange-500/10 to-slate-950 border-3 border-amber-500 flex flex-col items-center text-center shadow-[0_0_50px_rgba(245,158,11,0.3)] ring-4 ring-amber-500/30 relative">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-black text-3xl flex items-center justify-center mb-2 shadow-[0_0_30px_rgba(245,158,11,0.4)]">
                    🥉
                  </div>
                  <span className="px-3.5 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider mb-2 shadow-md">
                    QUÝ QUÂN • VÀO VÒNG TIẾP THEO
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-amber-300 mb-1">
                    {rankedTeams[2].name}
                  </h3>
                  <p className="text-xs text-slate-300 italic mb-3 line-clamp-1">
                    {rankedTeams[2].submission?.title || rankedTeams[2].slogan}
                  </p>

                  <div className="text-2xl sm:text-3xl font-mono font-black text-amber-300 flex items-center justify-center gap-1.5 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)] mb-3">
                    <span>⚡ {rankedTeams[2].totalScore}</span>
                    <span className="text-xs font-normal text-amber-200/80">điểm</span>
                  </div>

                  {/* Members list */}
                  <div className="w-full p-2.5 rounded-2xl bg-black/40 border border-amber-500/30 text-left mt-auto">
                    <span className="text-[10px] font-black uppercase text-amber-300 block mb-1">
                      Thành viên đội:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {rankedTeams[2].members.map(m => (
                        <span key={m.id} className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-200 text-[11px] font-bold border border-amber-500/30">
                          {m.name} {m.className ? `(${m.className})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  gameAudio.playVictory();
                  setConfettiKey(prev => prev + 1);
                }}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-sm flex items-center gap-2 shadow-lg cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 animate-spin" /> Bắn pháo hoa ăn mừng 🎉
              </button>

              <button
                onClick={() => setShowResultModal(false)}
                className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer border border-white/20 transition-all"
              >
                Đóng kết quả
              </button>
            </div>
          </div>
        </div>
      )}
    </CyberSpaceBackground>
  );
}
