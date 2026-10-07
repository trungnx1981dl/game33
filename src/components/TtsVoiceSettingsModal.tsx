import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Check, 
  Sparkles, 
  X, 
  Settings, 
  Play, 
  Square,
  UserCheck
} from 'lucide-react';
import { 
  TtsGender,
  getAutoTtsPreference,
  setAutoTtsPreference,
  getTtsGenderPreference,
  setTtsGenderPreference,
  getTtsRatePreference,
  setTtsRatePreference,
  getTtsVoiceUriPreference,
  setTtsVoiceUriPreference,
  getVietnameseVoices,
  testVoice,
  cancelSpeech,
  isSpeechSupported
} from '../utils/textToSpeech';
import { gameAudio } from '../utils/gameAudio';

interface TtsVoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: (settings: { enabled: boolean; gender: TtsGender; rate: number }) => void;
}

export default function TtsVoiceSettingsModal({
  isOpen,
  onClose,
  onSettingsChanged
}: TtsVoiceSettingsModalProps) {
  const [enabled, setEnabled] = useState<boolean>(() => getAutoTtsPreference());
  const [gender, setGender] = useState<TtsGender>(() => getTtsGenderPreference());
  const [rate, setRate] = useState<number>(() => getTtsRatePreference());
  const [voiceUri, setVoiceUri] = useState<string>(() => getTtsVoiceUriPreference());
  const [availableViVoices, setAvailableViVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingTest, setIsPlayingTest] = useState<boolean>(false);

  // Load available voices (handling async voice loading in browsers)
  useEffect(() => {
    if (!isSpeechSupported()) return;

    const updateVoices = () => {
      const vi = getVietnameseVoices();
      setAvailableViVoices(vi);
    };

    updateVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleToggleEnabled = (val: boolean) => {
    gameAudio.playClick();
    setEnabled(val);
    setAutoTtsPreference(val);
    if (!val) cancelSpeech();
    onSettingsChanged?.({ enabled: val, gender, rate });
  };

  const handleSelectGender = (newGender: TtsGender) => {
    gameAudio.playClick();
    setGender(newGender);
    setTtsGenderPreference(newGender);
    onSettingsChanged?.({ enabled, gender: newGender, rate });
  };

  const handleSelectRate = (newRate: number) => {
    gameAudio.playClick();
    setRate(newRate);
    setTtsRatePreference(newRate);
    onSettingsChanged?.({ enabled, gender, rate: newRate });
  };

  const handleSelectVoiceUri = (uri: string) => {
    gameAudio.playClick();
    setVoiceUri(uri);
    setTtsVoiceUriPreference(uri);
  };

  const handleTestVoice = () => {
    if (isPlayingTest) {
      cancelSpeech();
      setIsPlayingTest(false);
      return;
    }

    cancelSpeech();
    setIsPlayingTest(true);
    testVoice(gender, voiceUri || undefined, () => {
      setIsPlayingTest(false);
    });
  };

  const handleClose = () => {
    cancelSpeech();
    setIsPlayingTest(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-400/70 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(251,191,36,0.3)] relative overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100">
        
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-rose-400" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-amber-400/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
              <Settings className="w-5 h-5 animate-spin" style={{ animationDuration: '12s' }} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>CÀI ĐẶT GIỌNG ĐỌC CÂU HỎI</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-400/30">
                  GIỌNG NỮ
                </span>
              </h2>
              <p className="text-xs text-amber-300/80">
                Tự động đọc câu hỏi và các phương án khi chuyển câu
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 transition-all cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Body */}
        <div className="space-y-4">
          
          {/* 1. Toggle Auto Read */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-xs sm:text-sm font-black text-white block">
                Tự động đọc khi chuyển câu
              </span>
              <span className="text-[11px] text-slate-400">
                Hệ thống tự phát âm khi sang câu hỏi mới
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleEnabled(!enabled)}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                enabled
                  ? 'bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(52,211,153,0.4)]'
                  : 'bg-slate-800 text-slate-400 border border-white/10'
              }`}
            >
              {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{enabled ? 'BẬT' : 'TẮT'}</span>
            </button>
          </div>

          {/* 2. Choose Voice Gender: Female vs Male */}
          <div>
            <label className="block text-xs font-black text-amber-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>CHỌN TÔNG GIỌNG ĐỌC:</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Giọng Nữ (Default / Recommended) */}
              <button
                type="button"
                onClick={() => handleSelectGender('female')}
                className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 cursor-pointer text-left relative ${
                  gender === 'female'
                    ? 'bg-gradient-to-br from-rose-500/25 to-pink-900/30 border-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)] ring-2 ring-rose-400/40'
                    : 'bg-slate-950/40 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                  gender === 'female' ? 'bg-rose-500/30 border border-rose-400' : 'bg-white/5'
                }`}>
                  👩
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                    <span>GIỌNG NỮ</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-400 text-slate-950 font-bold">
                      Ưu tiên
                    </span>
                  </div>
                  <div className="text-[11px] text-rose-200/80 leading-tight mt-0.5">
                    Truyền cảm, thanh thoát & tự nhiên
                  </div>
                </div>
                {gender === 'female' && (
                  <Check className="w-4 h-4 text-rose-300 flex-shrink-0" />
                )}
              </button>

              {/* Giọng Nam */}
              <button
                type="button"
                onClick={() => handleSelectGender('male')}
                className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 cursor-pointer text-left relative ${
                  gender === 'male'
                    ? 'bg-gradient-to-br from-sky-500/25 to-blue-900/30 border-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.35)] ring-2 ring-sky-400/40'
                    : 'bg-slate-950/40 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                  gender === 'male' ? 'bg-sky-500/30 border border-sky-400' : 'bg-white/5'
                }`}>
                  👨
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-black">
                    GIỌNG NAM
                  </div>
                  <div className="text-[11px] text-sky-200/80 leading-tight mt-0.5">
                    Trầm ấm, đĩnh đạc & rõ ràng
                  </div>
                </div>
                {gender === 'male' && (
                  <Check className="w-4 h-4 text-sky-300 flex-shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* 3. Choose Speed Rate */}
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-2">
              TỐC ĐỘ ĐỌC:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '0.85x (Chậm)', val: 0.85 },
                { label: '1.0x (Chuẩn)', val: 1.0 },
                { label: '1.15x (Nhanh)', val: 1.15 }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => handleSelectRate(opt.val)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    Math.abs(rate - opt.val) < 0.05
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                      : 'bg-slate-950/50 text-slate-400 border-white/10 hover:border-white/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Detected Vietnamese Voices List on this Device */}
          {availableViVoices.length > 1 && (
            <div>
              <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>DANH SÁCH GIỌNG VIỆT TRÊN MÁY BẠN:</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {availableViVoices.length} giọng khả dụng
                </span>
              </label>
              <select
                value={voiceUri}
                onChange={e => handleSelectVoiceUri(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-950 border border-white/15 rounded-xl text-xs text-slate-200 outline-none focus:border-amber-400 transition-all font-mono"
              >
                <option value="">-- Tự động chọn giọng nữ tốt nhất (Khuyên dùng) --</option>
                {availableViVoices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} {/hoaimy|linh|mai|lan|female|nữ/i.test(v.name) ? '(Nữ)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Live Audio Preview Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTestVoice}
              className={`w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 border-2 ${
                isPlayingTest
                  ? 'bg-rose-500 hover:bg-rose-400 text-white border-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.4)] animate-pulse'
                  : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 border-yellow-200 shadow-[0_0_25px_rgba(251,191,36,0.35)]'
              }`}
            >
              {isPlayingTest ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>DỪNG PHÁT THỬ NGHIỆM</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>NGHE THỬ GIỌNG ĐỌC {gender === 'female' ? 'NỮ 👩' : 'NAM 👨'}</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-1.5">
              Bấm để nghe phát âm mẫu câu hỏi chào mừng bằng giọng {gender === 'female' ? 'nữ' : 'nam'}.
            </p>
          </div>

        </div>

        {/* Footer actions */}
        <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
          >
            HOÀN TẤT & ĐÓNG
          </button>
        </div>

      </div>
    </div>
  );
}
