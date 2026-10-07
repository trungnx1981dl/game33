import React, { useState, useEffect } from 'react';
import { Player, Round2Group } from '../types';
import { shuffleTop18IntoRound2Groups } from '../utils/round2Grouping';
import { gameAudio } from '../utils/gameAudio';
import ConfettiEffect from './ConfettiEffect';
import { 
  Trophy, 
  RotateCcw, 
  X, 
  Sparkles, 
  Users, 
  Check, 
  Save, 
  Share2, 
  Download,
  Flame,
  Award
} from 'lucide-react';

interface Round2ShuffleModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  savedGroups?: Round2Group[];
  onSaveGroups?: (groups: Round2Group[]) => Promise<void>;
}

export default function Round2ShuffleModal({
  isOpen,
  onClose,
  players,
  savedGroups,
  onSaveGroups
}: Round2ShuffleModalProps) {
  const [groups, setGroups] = useState<Round2Group[]>([]);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [confettiKey, setConfettiKey] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveNotice, setSaveNotice] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (savedGroups && savedGroups.length === 6 && savedGroups.some(g => g.members.length > 0)) {
        setGroups(savedGroups);
      } else {
        handleShuffle();
      }
      gameAudio.playVictory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShuffle = () => {
    setIsShuffling(true);
    gameAudio.playClick();
    setSaveNotice('');

    setTimeout(() => {
      const generated = shuffleTop18IntoRound2Groups(players);
      setGroups(generated);
      setIsShuffling(false);
      setConfettiKey(prev => prev + 1);
      gameAudio.playPowerUp();
    }, 400);
  };

  const handleSave = async () => {
    if (!onSaveGroups) return;
    setIsSaving(true);
    setSaveNotice('');
    try {
      await onSaveGroups(groups);
      setSaveNotice('Đã đồng bộ kết quả chia 6 nhóm đến tất cả máy học sinh!');
      gameAudio.playVictory();
    } catch (e: any) {
      setSaveNotice('Lỗi khi lưu: ' + (e?.message || 'Không thể lưu'));
    } finally {
      setIsSaving(false);
    }
  };

  const totalMembers = groups.reduce((acc, g) => acc + g.members.length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-2 sm:p-3 overflow-y-auto animate-in fade-in duration-300 select-none">
      <ConfettiEffect key={confettiKey} />

      {/* Main Container (Ultra Compact & Full Viewport Fitting) */}
      <div className="w-full max-w-7xl bg-slate-900/95 border-2 border-amber-400/50 rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-[0_0_80px_rgba(245,158,11,0.3)] relative overflow-hidden flex flex-col my-auto">
        
        {/* Ambient Top Light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-gradient-to-b from-amber-400/20 via-pink-500/10 to-transparent blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 transition-all cursor-pointer z-20"
          title="Đóng bảng chia nhóm"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Section (Ultra Compact) */}
        <div className="text-center mb-2 relative z-10 pr-8 pl-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-400/20 via-pink-500/20 to-sky-400/20 border border-amber-300/40 text-amber-200 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-300 animate-spin" style={{ animationDuration: '8s' }} />
              <span>VÒNG 2 • 6 NHÓM TRANH TÀI SẢN PHẨM MÔI TRƯỜNG</span>
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-lobster text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-300 to-sky-300 tracking-wide leading-tight">
            Xáo Trộn 6 Nhóm Vòng 2 (Top 18 EXP)
          </h1>
          
          <p className="text-[10px] sm:text-xs text-slate-300 font-medium max-w-2xl mx-auto mt-0.5 leading-snug">
            Chọn 18 học sinh có điểm <strong className="text-amber-300 font-bold">EXP cao nhất Vòng 1</strong> chia thành 6 đội (3 bạn/đội). 3 nhóm có tổng điểm cao nhất sau khi Giám khảo chấm sẽ vào vòng tiếp theo!
          </p>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1.5">
            <button
              onClick={handleShuffle}
              disabled={isShuffling}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer btn-modern-shine btn-modern-glow"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isShuffling ? 'animate-spin' : ''}`} />
              <span>{isShuffling ? 'ĐANG XÁO...' : 'XÁO LẠI 6 NHÓM'}</span>
            </button>

            {onSaveGroups && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3.5 py-1.5 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'ĐANG LƯU...' : 'LƯU & ĐỒNG BỘ 6 NHÓM'}</span>
              </button>
            )}

            <div className="px-3 py-1 bg-slate-950/70 border border-white/10 rounded-xl text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Đã chọn: <strong className="text-amber-300 font-mono text-xs">{totalMembers}</strong> / 18 HS (6 đội)</span>
            </div>
          </div>

          {saveNotice && (
            <div className="mt-1 p-1 px-3 bg-emerald-500/20 border border-emerald-400/50 rounded-lg text-emerald-300 text-[10px] font-bold animate-in fade-in inline-block">
              {saveNotice}
            </div>
          )}
        </div>

        {/* 6 Groups Grid: 3x2 Compact Layout (3 nhóm hàng trên, 3 nhóm hàng dưới) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 relative z-10">
          {groups.map((group, groupIndex) => {
            return (
              <div
                key={group.id}
                className={`bg-gradient-to-b ${group.accentBg} rounded-2xl border-2 ${group.borderColor} p-2 sm:p-2.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-200 group`}
              >
                {/* Team Header */}
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1 pb-1 border-b border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] flex-shrink-0">
                        {group.icon}
                      </span>
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 block">
                          ĐỘI {groupIndex + 1}
                        </span>
                        <h3 className={`text-xs sm:text-sm font-black tracking-wide truncate ${group.textColor}`}>
                          {group.name}
                        </h3>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 bg-slate-950/70 border border-white/10 rounded-lg text-[10px] font-mono font-black text-white flex-shrink-0">
                      {group.members.length}/3 HS
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300 italic mb-1.5 line-clamp-1 leading-tight">
                    &quot;{group.slogan}&quot;
                  </p>

                  {/* Member Slots List: 3 members per group */}
                  <div className="space-y-1">
                    {[0, 1, 2].map(slotIdx => {
                      const member = group.members[slotIdx];

                      if (!member) {
                        return (
                          <div
                            key={slotIdx}
                            className="py-1 px-2 bg-slate-950/40 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-slate-500 text-[10px] font-bold"
                          >
                            <span>(Chờ thành viên #{slotIdx + 1})</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={member.id}
                          className="py-1 px-2 bg-slate-950/80 border border-white/15 rounded-xl flex items-center justify-between gap-1.5 shadow-sm hover:border-white/30 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Member Rank Badge */}
                            <span className="w-5 h-5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] font-mono flex items-center justify-center flex-shrink-0 shadow-sm">
                              #{member.rank}
                            </span>
                            <div className="min-w-0">
                              <span className="text-xs font-black text-white block truncate leading-tight">
                                {member.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="px-1 py-0.2 bg-white/10 text-cyan-300 text-[9px] font-black rounded">
                                  {member.className || 'Chung'}
                                </span>
                                {member.studentCode && (
                                  <span className="text-[9px] font-mono text-slate-400">
                                    {member.studentCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="text-xs font-mono font-black text-amber-300 flex items-center justify-end gap-0.5">
                              ⚡ {member.exp}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team Footer Banner */}
                <div className="mt-1.5 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300 font-bold">
                  <span>Tổng EXP đội:</span>
                  <span className="font-mono font-black text-amber-300 text-xs">
                    ⚡ {group.members.reduce((sum, m) => sum + m.exp, 0)} EXP
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Notice (Compact) */}
        <div className="mt-2 pt-1.5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>6 nhóm (Bye Bye Nhựa, Zero-Waste, Góc Xanh, Tái Sinh, Dĩa sạch, Phố xanh) • 3 nhóm cao điểm nhất vào vòng tiếp theo!</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all border border-white/10 cursor-pointer"
          >
            Đóng bảng
          </button>
        </div>

      </div>
    </div>
  );
}
