import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  CheckCircle2, 
  X, 
  Sparkles, 
  Image as ImageIcon, 
  Loader2, 
  Camera, 
  AlertCircle,
  Send,
  Plus,
  Trash2,
  Volume2,
  Play,
  Pause,
  Music,
  FileAudio
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { Round2Group, Round2Submission, Round2SubmissionsMap, Round2Product } from '../types';
import { ROUND_2_GROUPS_CONFIG } from '../utils/round2Grouping';
import { gameAudio } from '../utils/gameAudio';
import { firestoreQuota } from '../utils/firestoreQuota';
import { saveMediaItem } from '../utils/mediaStorage';
import { syncSubmissionToServer } from '../services/serverSync';

interface Round2StudentSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  playerName: string;
  studentCode?: string;
  round2Groups?: Round2Group[];
  existingSubmissions?: Round2SubmissionsMap;
}

interface ProductDraft {
  title: string;
  mediaType: 'image' | 'audio' | '';
  dataUrl: string;
  fileName: string;
  fileSize: number;
  description: string;
}

// Convert AudioBuffer to standard PCM 16-bit Mono WAV Blob
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const channelData = buffer.getChannelData(0); // mono
  const dataLength = channelData.length * (bitDepth / 8);
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * (bitDepth / 8), true);
  view.setUint16(32, bitDepth / 8, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export default function Round2StudentSubmitModal({
  isOpen,
  onClose,
  sessionId,
  playerName,
  studentCode,
  round2Groups,
  existingSubmissions
}: Round2StudentSubmitModalProps) {
  // Step 1: Chọn nhóm (Tự động nhận diện theo phân công)
  const [selectedTeamId, setSelectedTeamId] = useState<string>('team-bye-bye-nhua');
  const [submitterName, setSubmitterName] = useState(playerName || '');

  // Product 1 state
  const [p1, setP1] = useState<ProductDraft>({
    title: '',
    mediaType: '',
    dataUrl: '',
    fileName: '',
    fileSize: 0,
    description: ''
  });

  // Product 2 state (Optional)
  const [hasProduct2, setHasProduct2] = useState(false);
  const [p2, setP2] = useState<ProductDraft>({
    title: '',
    mediaType: '',
    dataUrl: '',
    fileName: '',
    fileSize: 0,
    description: ''
  });

  const [isProcessingFile1, setIsProcessingFile1] = useState(false);
  const [isProcessingFile2, setIsProcessingFile2] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [isPlayingP1Audio, setIsPlayingP1Audio] = useState(false);
  const [isPlayingP2Audio, setIsPlayingP2Audio] = useState(false);
  const audioP1Ref = useRef<HTMLAudioElement | null>(null);
  const audioP2Ref = useRef<HTMLAudioElement | null>(null);

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // Auto-detect student's group if available
  const assignedTeam = React.useMemo(() => {
    if (!round2Groups || round2Groups.length === 0) return null;
    const cleanCode = (studentCode || '').trim().toUpperCase();
    const cleanName = (playerName || '').trim().toLowerCase();

    for (const group of round2Groups) {
      const match = group.members.some(m => 
        (cleanCode && m.studentCode && m.studentCode.toUpperCase() === cleanCode) ||
        (cleanName && m.name.toLowerCase() === cleanName)
      );
      if (match) return group;
    }
    return null;
  }, [round2Groups, studentCode, playerName]);

  useEffect(() => {
    if (assignedTeam) {
      setSelectedTeamId(assignedTeam.id);
    }
  }, [assignedTeam]);

  const selectedTeamConfig = ROUND_2_GROUPS_CONFIG.find(g => g.id === selectedTeamId) || ROUND_2_GROUPS_CONFIG[0];

  // Set default title based on selected team
  useEffect(() => {
    if (!p1.title) {
      setP1(prev => ({
        ...prev,
        title: `Sản phẩm ${selectedTeamConfig.name}`
      }));
    }
  }, [selectedTeamId, selectedTeamConfig.name]);

  // Load existing submission if any for selected team
  useEffect(() => {
    if (existingSubmissions && existingSubmissions[selectedTeamId]) {
      const exist = existingSubmissions[selectedTeamId];
      const prod1 = exist.product1 || {
        title: exist.title || `Sản phẩm ${selectedTeamConfig.name}`,
        imageUrl: exist.imageUrl,
        audioUrl: exist.audioUrl,
        mediaType: exist.mediaType || (exist.imageUrl ? 'image' : exist.audioUrl ? 'audio' : ''),
        description: exist.description || ''
      };

      const p1Media = prod1.imageUrl ? 'image' : prod1.audioUrl ? 'audio' : '';
      const p1Url = prod1.imageUrl || prod1.audioUrl || '';
      setP1({
        title: prod1.title || `Sản phẩm ${selectedTeamConfig.name}`,
        mediaType: p1Media as any,
        dataUrl: p1Url,
        fileName: (prod1 as any).fileName || (p1Media === 'image' ? 'anh-bai-lam.jpg' : 'am-thanh-thuyet-trinh.mp3'),
        fileSize: (prod1 as any).fileSize || 0,
        description: prod1.description || ''
      });

      if (exist.product2) {
        setHasProduct2(true);
        const p2Media = exist.product2.imageUrl ? 'image' : exist.product2.audioUrl ? 'audio' : '';
        const p2Url = exist.product2.imageUrl || exist.product2.audioUrl || '';
        setP2({
          title: exist.product2.title || `Sản phẩm 2 - ${selectedTeamConfig.name}`,
          mediaType: p2Media as any,
          dataUrl: p2Url,
          fileName: exist.product2.fileName || (p2Media === 'image' ? 'anh-bai-lam-2.jpg' : 'am-thanh-2.mp3'),
          fileSize: exist.product2.fileSize || 0,
          description: exist.product2.description || ''
        });
      } else {
        setHasProduct2(false);
      }

      if (exist.submittedBy) setSubmitterName(exist.submittedBy);
    }
  }, [selectedTeamId, existingSubmissions]);

  // Cleanup audio players on unmount
  useEffect(() => {
    return () => {
      if (audioP1Ref.current) {
        audioP1Ref.current.pause();
        audioP1Ref.current = null;
      }
      if (audioP2Ref.current) {
        audioP2Ref.current.pause();
        audioP2Ref.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  // Process ANY file (Image: JPG, PNG, WEBP, HEIC, GIF... or Audio: MP3, WAV, M4A, OGG, AAC...)
  const handleProcessFile = async (file: File, productSlot: 1 | 2) => {
    setErrorMessage('');
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg|heic|heif)$/i.test(file.name);
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|webm|flac|wma)$/i.test(file.name);

    if (!isImage && !isAudio) {
      setErrorMessage('Vui lòng chọn file hình ảnh (JPG, PNG, WEBP,...) hoặc file âm thanh (MP3, WAV, M4A,...)!');
      return;
    }

    if (productSlot === 1) setIsProcessingFile1(true);
    else setIsProcessingFile2(true);

    try {
      if (isImage) {
        // Image Processing: Auto-compress using HTML5 Canvas
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1280; // Sharp HD resolution for projectors

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.80);
              const approxSize = Math.round((compressedBase64.length * 3) / 4);

              const draft: ProductDraft = {
                title: productSlot === 1 
                  ? (p1.title || `Sản phẩm ${selectedTeamConfig.name}`)
                  : (p2.title || `Sản phẩm 2 - ${selectedTeamConfig.name}`),
                mediaType: 'image',
                dataUrl: compressedBase64,
                fileName: file.name,
                fileSize: approxSize,
                description: productSlot === 1 ? p1.description : p2.description
              };

              if (productSlot === 1) setP1(draft);
              else setP2(draft);

              gameAudio.playClick();
              if (productSlot === 1) setIsProcessingFile1(false);
              else setIsProcessingFile2(false);
            }
          };
          img.onerror = () => {
            setErrorMessage('Không thể đọc file ảnh này. Vui lòng thử ảnh khác!');
            if (productSlot === 1) setIsProcessingFile1(false);
            else setIsProcessingFile2(false);
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        // Audio Processing: Read & downsample if > 750KB
        if (file.size <= 750 * 1024) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            const draft: ProductDraft = {
              title: productSlot === 1 
                ? (p1.title || `Âm thanh thuyết trình - ${selectedTeamConfig.name}`)
                : (p2.title || `Âm thanh 2 - ${selectedTeamConfig.name}`),
              mediaType: 'audio',
              dataUrl: base64,
              fileName: file.name,
              fileSize: file.size,
              description: productSlot === 1 ? p1.description : p2.description
            };
            if (productSlot === 1) setP1(draft);
            else setP2(draft);
            gameAudio.playClick();
            if (productSlot === 1) setIsProcessingFile1(false);
            else setIsProcessingFile2(false);
          };
          reader.readAsDataURL(file);
        } else {
          // Downsample large audio to 22.05kHz mono WAV
          try {
            const arrayBuffer = await file.arrayBuffer();
            const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtxClass();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            const targetSampleRate = 22050;
            const duration = audioBuffer.duration;
            const offlineCtx = new OfflineAudioContext(1, Math.round(duration * targetSampleRate), targetSampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineCtx.destination);
            source.start(0);

            const renderedBuffer = await offlineCtx.startRendering();
            const wavBlob = audioBufferToWavBlob(renderedBuffer);

            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              const draft: ProductDraft = {
                title: productSlot === 1 
                  ? (p1.title || `Âm thanh thuyết trình - ${selectedTeamConfig.name}`)
                  : (p2.title || `Âm thanh 2 - ${selectedTeamConfig.name}`),
                mediaType: 'audio',
                dataUrl: base64,
                fileName: file.name.replace(/\.[^/.]+$/, '') + '.wav',
                fileSize: wavBlob.size,
                description: productSlot === 1 ? p1.description : p2.description
              };
              if (productSlot === 1) setP1(draft);
              else setP2(draft);
              gameAudio.playClick();
              if (productSlot === 1) setIsProcessingFile1(false);
              else setIsProcessingFile2(false);
            };
            reader.readAsDataURL(wavBlob);
          } catch (audioErr) {
            console.warn('Audio downsampling fallback:', audioErr);
            // Fallback direct read
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              const draft: ProductDraft = {
                title: productSlot === 1 
                  ? (p1.title || `Âm thanh thuyết trình - ${selectedTeamConfig.name}`)
                  : (p2.title || `Âm thanh 2 - ${selectedTeamConfig.name}`),
                mediaType: 'audio',
                dataUrl: base64,
                fileName: file.name,
                fileSize: file.size,
                description: productSlot === 1 ? p1.description : p2.description
              };
              if (productSlot === 1) setP1(draft);
              else setP2(draft);
              gameAudio.playClick();
              if (productSlot === 1) setIsProcessingFile1(false);
              else setIsProcessingFile2(false);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    } catch (err: any) {
      console.error('Error processing media file:', err);
      setErrorMessage('Lỗi xử lý tệp: ' + (err?.message || 'Vui lòng chọn file khác.'));
      if (productSlot === 1) setIsProcessingFile1(false);
      else setIsProcessingFile2(false);
    }
  };

  const togglePlayAudio = (slot: 1 | 2) => {
    if (slot === 1) {
      if (!p1.dataUrl) return;
      if (isPlayingP1Audio) {
        audioP1Ref.current?.pause();
        setIsPlayingP1Audio(false);
      } else {
        if (audioP1Ref.current) audioP1Ref.current.pause();
        const audio = new Audio(p1.dataUrl);
        audioP1Ref.current = audio;
        audio.play().then(() => setIsPlayingP1Audio(true)).catch(() => setIsPlayingP1Audio(false));
        audio.onended = () => setIsPlayingP1Audio(false);
      }
    } else {
      if (!p2.dataUrl) return;
      if (isPlayingP2Audio) {
        audioP2Ref.current?.pause();
        setIsPlayingP2Audio(false);
      } else {
        if (audioP2Ref.current) audioP2Ref.current.pause();
        const audio = new Audio(p2.dataUrl);
        audioP2Ref.current = audio;
        audio.play().then(() => setIsPlayingP2Audio(true)).catch(() => setIsPlayingP2Audio(false));
        audio.onended = () => setIsPlayingP2Audio(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!p1.dataUrl) {
      setErrorMessage('Vui lòng chọn file Ảnh chụp hoặc file Âm thanh cho Sản phẩm 1!');
      return;
    }

    if (!p1.title.trim()) {
      setErrorMessage('Vui lòng nhập Tên Sản phẩm 1!');
      return;
    }

    if (hasProduct2 && !p2.dataUrl) {
      setErrorMessage('Vui lòng chọn file cho Sản phẩm 2 (hoặc bỏ chọn Sản phẩm 2)!');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = Date.now();

      // Product 1
      const product1Data: Round2Product = {
        title: p1.title.trim(),
        description: p1.description.trim() || '',
        imageUrl: p1.mediaType === 'image' ? p1.dataUrl : '',
        audioUrl: p1.mediaType === 'audio' ? p1.dataUrl : '',
        mediaType: p1.mediaType || 'image',
        fileName: p1.fileName,
        fileSize: p1.fileSize,
        submittedAt: now,
        submittedBy: submitterName.trim() || playerName
      };

      const productsList: Round2Product[] = [product1Data];
      let product2Data: Round2Product | null = null;

      if (hasProduct2 && p2.dataUrl) {
        product2Data = {
          title: (p2.title.trim()) || `Sản phẩm 2 - ${selectedTeamConfig.name}`,
          description: p2.description.trim() || '',
          imageUrl: p2.mediaType === 'image' ? p2.dataUrl : '',
          audioUrl: p2.mediaType === 'audio' ? p2.dataUrl : '',
          mediaType: p2.mediaType || 'image',
          fileName: p2.fileName,
          fileSize: p2.fileSize,
          submittedAt: now,
          submittedBy: submitterName.trim() || playerName
        };
        productsList.push(product2Data);
      }

      const submissionData: Round2Submission = {
        teamId: selectedTeamId,
        teamName: selectedTeamConfig.name,
        title: p1.title.trim(),
        description: p1.description.trim() || '',
        imageUrl: p1.mediaType === 'image' ? p1.dataUrl : '',
        audioUrl: p1.mediaType === 'audio' ? p1.dataUrl : '',
        mediaType: p1.mediaType || 'image',
        product1: product1Data,
        products: productsList,
        submittedBy: submitterName.trim() || playerName,
        submittedAt: now
      };

      if (product2Data) {
        submissionData.product2 = product2Data;
      }

      // 1. Cache to IndexedDB locally on this device
      saveMediaItem(`submission_${sessionId}_${selectedTeamId}`, JSON.stringify(submissionData)).catch(() => {});

      // 2. Always sync submission to server backup (works even when Firestore quota is 100% full!)
      await syncSubmissionToServer(sessionId, submissionData).catch(err => {
        console.warn('Server sync warning:', err);
      });

      // 3. Write to Firestore subcollection `sessions/{sessionId}/submissions/{selectedTeamId}` (tolerant to quota limits)
      try {
        const submissionRef = doc(db, 'sessions', sessionId, 'submissions', selectedTeamId);
        await setDoc(submissionRef, submissionData);

        await updateDoc(doc(db, 'sessions', sessionId), {
          lastRound2Update: Date.now()
        }).catch(err => console.warn('Signal parent update skipped:', err));
      } catch (fErr: any) {
        firestoreQuota.reportError(fErr);
        console.warn('Firestore submission sync fallback to server sync:', fErr);
      }

      gameAudio.playVictory();
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting round 2 product:', err);
      setErrorMessage('Lỗi khi nộp bài: ' + (err?.message || 'Không thể lưu lên hệ thống.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-2xl bg-slate-900 border-2 border-emerald-400/80 rounded-3xl p-5 sm:p-7 shadow-[0_0_60px_rgba(16,185,129,0.35)] relative overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100 my-auto max-h-[94vh] flex flex-col">
        
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-2xl shadow-sm">
              🚀
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">Nộp Bài Dự Thi Vòng 2</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black uppercase">
                  Trực tiếp
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Tải trực tiếp ảnh hoặc file âm thanh từ máy tính/điện thoại (chấp nhận mọi định dạng)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 mt-4 space-y-4 touch-scroll text-left">
          
          {/* TEAM SELECTION BANNER */}
          <div className={`p-3.5 rounded-2xl border-2 ${selectedTeamConfig.borderColor} bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedTeamConfig.icon}</span>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Đội thi của em:</div>
                <div className="text-base font-black text-white">{selectedTeamConfig.name}</div>
                <div className="text-xs text-slate-300 italic">{selectedTeamConfig.slogan}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">Người nộp:</span>
              <input
                type="text"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="Họ tên học sinh"
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/20 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* SẢN PHẨM 1 (CHÍNH) */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border-2 border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-xs flex items-center justify-center border border-emerald-400/40">
                  1
                </span>
                <span className="text-sm font-black text-white uppercase tracking-wider">
                  Sản phẩm 1 (Ảnh bài làm hoặc Âm thanh) *
                </span>
              </div>
              {p1.dataUrl && (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đã chọn {p1.mediaType === 'image' ? 'ảnh' : 'audio'}
                </span>
              )}
            </div>

            {/* Tên sản phẩm 1 */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Tên sản phẩm 1:
              </label>
              <input
                type="text"
                value={p1.title}
                onChange={(e) => setP1(prev => ({ ...prev, title: e.target.value }))}
                placeholder="VD: Poster tuyên truyền giảm rác thải nhựa"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
              />
            </div>

            {/* Upload Box for Product 1 */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Tải lên Ảnh chụp hoặc File Âm thanh:
              </label>
              
              <input
                ref={fileInputRef1}
                type="file"
                accept="image/*,audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleProcessFile(file, 1);
                }}
                className="hidden"
              />

              {!p1.dataUrl ? (
                <div
                  onClick={() => fileInputRef1.current?.click()}
                  className="w-full border-2 border-dashed border-emerald-400/40 hover:border-emerald-400 rounded-2xl p-5 sm:p-6 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
                >
                  {isProcessingFile1 ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                      <span className="text-xs font-bold text-emerald-300">Đang tối ưu dung lượng tệp...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mb-2.5 text-emerald-300 group-hover:scale-110 transition-transform">
                        <Upload className="w-7 h-7" />
                      </div>
                      <div className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors">
                        Chạm vào đây để chọn tệp Ảnh hoặc Âm thanh
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 max-w-sm">
                        Chấp nhận mọi loại ảnh (JPG, PNG, ảnh chụp...) & âm thanh (MP3, WAV, ghi âm...). Tự động tối ưu dung lượng.
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="px-2.5 py-1 rounded-xl bg-white/10 text-slate-300 text-[10px] font-bold flex items-center gap-1 border border-white/10">
                          <Camera className="w-3 h-3 text-cyan-300" /> Chụp ảnh / Chọn ảnh
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-white/10 text-slate-300 text-[10px] font-bold flex items-center gap-1 border border-white/10">
                          <Music className="w-3 h-3 text-purple-300" /> Ghi âm / Chọn file audio
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Preview Box */
                <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-400/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                    {p1.mediaType === 'image' ? (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-emerald-400/60 bg-black flex-shrink-0 relative group">
                        <img src={p1.dataUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-purple-500/20 border border-purple-400/50 flex flex-col items-center justify-center text-purple-300 flex-shrink-0">
                        <FileAudio className="w-7 h-7" />
                        <span className="text-[8px] font-black uppercase mt-0.5">AUDIO</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-white truncate">{p1.fileName || 'Tệp đã tải'}</div>
                      <div className="text-[11px] text-emerald-400 font-bold mt-0.5">
                        {p1.mediaType === 'image' ? '🖼️ Hình ảnh bài làm' : '🎵 File âm thanh thuyết trình'}
                        {p1.fileSize > 0 && ` • ${(p1.fileSize / 1024).toFixed(0)} KB`}
                      </div>
                    </div>
                  </div>

                  {/* Actions for P1 */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                    {p1.mediaType === 'audio' && (
                      <button
                        type="button"
                        onClick={() => togglePlayAudio(1)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isPlayingP1Audio ? 'bg-amber-500 text-slate-950' : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }`}
                      >
                        {isPlayingP1Audio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        <span>{isPlayingP1Audio ? 'Tạm dừng' : 'Nghe thử'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef1.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Đổi tệp
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (audioP1Ref.current) audioP1Ref.current.pause();
                        setIsPlayingP1Audio(false);
                        setP1(prev => ({ ...prev, dataUrl: '', mediaType: '', fileName: '', fileSize: 0 }));
                      }}
                      className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer"
                      title="Xóa tệp"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SẢN PHẨM 2 (TÙY CHỌN BỔ SUNG) */}
          {!hasProduct2 ? (
            <button
              type="button"
              onClick={() => setHasProduct2(true)}
              className="w-full py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-cyan-400 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nộp thêm Sản phẩm 2 (nếu nhóm có 2 sản phẩm, VD: Thêm file ghi âm hoặc thêm ảnh)</span>
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950/80 border-2 border-cyan-500/40 space-y-3 relative">
              <button
                type="button"
                onClick={() => {
                  if (audioP2Ref.current) audioP2Ref.current.pause();
                  setIsPlayingP2Audio(false);
                  setHasProduct2(false);
                  setP2({ title: '', mediaType: '', dataUrl: '', fileName: '', fileSize: 0, description: '' });
                }}
                className="absolute top-3 right-3 text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Bỏ sản phẩm 2
              </button>

              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 font-black text-xs flex items-center justify-center border border-cyan-400/40">
                  2
                </span>
                <span className="text-sm font-black text-white uppercase tracking-wider">
                  Sản phẩm 2 (Tùy chọn)
                </span>
              </div>

              {/* Tên sản phẩm 2 */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Tên sản phẩm 2:
                </label>
                <input
                  type="text"
                  value={p2.title}
                  onChange={(e) => setP2(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="VD: File ghi âm thuyết trình sản phẩm"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              {/* Upload Box for Product 2 */}
              <div>
                <input
                  ref={fileInputRef2}
                  type="file"
                  accept="image/*,audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessFile(file, 2);
                  }}
                  className="hidden"
                />

                {!p2.dataUrl ? (
                  <div
                    onClick={() => fileInputRef2.current?.click()}
                    className="w-full border-2 border-dashed border-cyan-400/40 hover:border-cyan-400 rounded-2xl p-4 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
                  >
                    {isProcessingFile2 ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                        <span className="text-xs font-bold text-cyan-300">Đang xử lý tệp...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center mb-1.5 text-cyan-300">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="text-xs font-black text-white group-hover:text-cyan-300 transition-colors">
                          Chạm để chọn Ảnh hoặc Âm thanh cho Sản phẩm 2
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* Preview Box for Product 2 */
                  <div className="p-3 rounded-2xl bg-slate-900 border border-cyan-400/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      {p2.mediaType === 'image' ? (
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-cyan-400/60 bg-black flex-shrink-0 relative group">
                          <img src={p2.dataUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-purple-500/20 border border-purple-400/50 flex flex-col items-center justify-center text-purple-300 flex-shrink-0">
                          <FileAudio className="w-6 h-6" />
                          <span className="text-[8px] font-black uppercase mt-0.5">AUDIO</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-white truncate">{p2.fileName || 'Tệp đã tải'}</div>
                        <div className="text-[11px] text-cyan-400 font-bold mt-0.5">
                          {p2.mediaType === 'image' ? '🖼️ Hình ảnh' : '🎵 File âm thanh'}
                          {p2.fileSize > 0 && ` • ${(p2.fileSize / 1024).toFixed(0)} KB`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                      {p2.mediaType === 'audio' && (
                        <button
                          type="button"
                          onClick={() => togglePlayAudio(2)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isPlayingP2Audio ? 'bg-amber-500 text-slate-950' : 'bg-purple-600 hover:bg-purple-500 text-white'
                          }`}
                        >
                          {isPlayingP2Audio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                          <span>{isPlayingP2Audio ? 'Tạm dừng' : 'Nghe thử'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef2.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Đổi tệp
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (audioP2Ref.current) audioP2Ref.current.pause();
                          setIsPlayingP2Audio(false);
                          setP2(prev => ({ ...prev, dataUrl: '', mediaType: '', fileName: '', fileSize: 0 }));
                        }}
                        className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer"
                        title="Xóa tệp"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/20 border-2 border-rose-400 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-bold animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {submitSuccess && (
            <div className="p-3.5 bg-emerald-500/20 border-2 border-emerald-400 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-black animate-bounce">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <span>🎉 NỘP BÀI THÀNH CÔNG! Giám khảo và Giáo viên đã nhận được sản phẩm của nhóm.</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !p1.dataUrl}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-sm shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang gửi bài lên hệ thống...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>🚀 NỘP BÀI DỰ THI NGAY</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
