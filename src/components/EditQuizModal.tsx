import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Quiz, Question, QuestionType } from '../types';
import { updateQuizInSystem } from '../utils/quizStorage';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Copy, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Clock, 
  Check, 
  HelpCircle,
  Loader2,
  Sparkles,
  BookOpen,
  Edit3,
  Volume2
} from 'lucide-react';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';

interface EditQuizModalProps {
  quiz: Quiz | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedQuiz: Quiz) => void;
}

const SUBJECT_SUGGESTIONS = [
  'KHTN 6',
  'KHTN 7',
  'KHTN 8',
  'KHTN 9',
  'Vật lí',
  'Hóa học',
  'Sinh học'
];

export default function EditQuizModal({
  quiz,
  isOpen,
  onClose,
  onSaveSuccess
}: EditQuizModalProps) {
  const [title, setTitle] = useState(quiz?.title || '');
  const [subject, setSubject] = useState(quiz?.subject || 'KHTN');
  const [questions, setQuestions] = useState<Question[]>(() => {
    return JSON.parse(JSON.stringify(quiz?.questions || []));
  });
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [questionToDeleteIndex, setQuestionToDeleteIndex] = useState<number | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  const previewContentRef = useRef<HTMLDivElement>(null);

  // Sync state when quiz prop changes
  useEffect(() => {
    if (quiz) {
      setTitle(quiz.title || '');
      setSubject(quiz.subject || 'KHTN');
      setQuestions(JSON.parse(JSON.stringify(quiz.questions || [])));
      setActiveQuestionIndex(0);
      setError('');
      setSaveSuccessNotice(false);
      setQuestionToDeleteIndex(null);
      setShowUnsavedPrompt(false);
    }
  }, [quiz]);

  // Track if modifications were made
  const isDirty = useMemo(() => {
    if (!quiz) return false;
    if (title.trim() !== (quiz.title || '').trim()) return true;
    if (subject.trim() !== (quiz.subject || 'KHTN').trim()) return true;
    return JSON.stringify(questions) !== JSON.stringify(quiz.questions || []);
  }, [title, subject, questions, quiz]);

  // Helper to validate completeness of a question
  const isQuestionComplete = (q: Question): boolean => {
    if (!q.content?.trim()) return false;
    if (q.type === 'MC' || q.type === 'TF') {
      if (!q.options || q.options.length < 4 || q.options.some(opt => !opt.trim())) return false;
    }
    if (!q.answer?.trim()) return false;
    return true;
  };

  const handleRequestClose = () => {
    if (isDirty && !saveSuccessNotice) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  };

  // Current active question
  const currentQ: Question | undefined = questions[activeQuestionIndex];

  // Render KaTeX in preview element
  useEffect(() => {
    if (previewContentRef.current && currentQ?.content) {
      try {
        renderMathInElement(previewContentRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX render error:', err);
      }
    }
  }, [currentQ?.content]);

  // Update specific field of the active question
  const updateActiveQuestion = (patch: Partial<Question>) => {
    if (activeQuestionIndex < 0 || activeQuestionIndex >= questions.length) return;
    setQuestions(prev => {
      const updated = [...prev];
      updated[activeQuestionIndex] = {
        ...updated[activeQuestionIndex],
        ...patch
      };
      return updated;
    });
  };

  // Question manipulation actions
  const handleAddQuestion = () => {
    const newQ: Question = {
      id: `q-${Date.now()}-${questions.length + 1}`,
      type: 'MC',
      content: 'Nhập nội dung câu hỏi mới...',
      options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      answer: 'A',
      timeLimit: 30
    };
    setQuestions(prev => [...prev, newQ]);
    setActiveQuestionIndex(questions.length);
  };

  const handleDuplicateQuestion = () => {
    if (!currentQ) return;
    const duplicated: Question = {
      ...JSON.parse(JSON.stringify(currentQ)),
      id: `q-${Date.now()}-${questions.length + 1}`,
      content: `${currentQ.content} (Bản sao)`
    };
    setQuestions(prev => {
      const next = [...prev];
      next.splice(activeQuestionIndex + 1, 0, duplicated);
      return next;
    });
    setActiveQuestionIndex(prev => prev + 1);
  };

  const confirmDeleteQuestion = (indexToDelete: number) => {
    if (questions.length <= 1) {
      setError('Bộ đề phải có ít nhất 1 câu hỏi. Không thể xóa câu cuối cùng!');
      setQuestionToDeleteIndex(null);
      return;
    }
    setQuestions(prev => prev.filter((_, idx) => idx !== indexToDelete));
    if (activeQuestionIndex >= questions.length - 1) {
      setActiveQuestionIndex(Math.max(0, questions.length - 2));
    }
    setQuestionToDeleteIndex(null);
  };

  const handleMoveQuestion = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= questions.length) return;

    setQuestions(prev => {
      const copy = [...prev];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return copy;
    });
    setActiveQuestionIndex(toIndex);
  };

  // Change question type handler
  const handleChangeQuestionType = (newType: QuestionType) => {
    if (!currentQ) return;
    if (currentQ.type === newType) return;

    let updatedOptions = currentQ.options;
    let updatedAnswer = currentQ.answer;

    if (newType === 'MC') {
      updatedOptions = (currentQ.options && currentQ.options.length === 4) 
        ? currentQ.options 
        : ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'];
      updatedAnswer = 'A';
    } else if (newType === 'TF') {
      updatedOptions = (currentQ.options && currentQ.options.length === 4) 
        ? currentQ.options 
        : ['Nhận định a', 'Nhận định b', 'Nhận định c', 'Nhận định d'];
      updatedAnswer = JSON.stringify(['Đúng', 'Sai', 'Đúng', 'Sai']);
    } else {
      updatedOptions = undefined;
      updatedAnswer = currentQ.answer || 'Đáp án mẫu';
    }

    updateActiveQuestion({
      type: newType,
      options: updatedOptions,
      answer: updatedAnswer
    });
  };

  // Handle saving the edited quiz to Firestore
  const handleSave = async () => {
    setError('');

    if (!title.trim()) {
      setError('Vui lòng nhập tên bộ đề!');
      return;
    }

    if (questions.length === 0) {
      setError('Bộ đề phải có ít nhất 1 câu hỏi!');
      return;
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.content?.trim()) {
        setError(`Câu hỏi số ${i + 1} chưa có nội dung!`);
        setActiveQuestionIndex(i);
        return;
      }

      if (q.type === 'MC') {
        if (!q.options || q.options.length < 4 || q.options.some(opt => !opt.trim())) {
          setError(`Câu hỏi số ${i + 1} phải có đủ 4 phương án A, B, C, D!`);
          setActiveQuestionIndex(i);
          return;
        }
      } else if (q.type === 'TF') {
        if (!q.options || q.options.length < 4 || q.options.some(opt => !opt.trim())) {
          setError(`Câu hỏi số ${i + 1} phải có đủ 4 nhận định a, b, c, d!`);
          setActiveQuestionIndex(i);
          return;
        }
      } else if (q.type === 'SA') {
        if (!q.answer?.trim()) {
          setError(`Câu hỏi số ${i + 1} chưa có đáp án ngắn!`);
          setActiveQuestionIndex(i);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const updatedData = {
        title: title.trim(),
        subject: subject.trim() || 'KHTN',
        createdAt: quiz.createdAt || Date.now(),
        createdBy: quiz.createdBy || 'admin',
        questions: questions
      };

      const fullUpdatedQuiz = await updateQuizInSystem(quiz.id, updatedData);

      setSaveSuccessNotice(true);
      setTimeout(() => {
        onSaveSuccess(fullUpdatedQuiz);
        onClose();
      }, 1000);
    } catch (e: any) {
      console.error('Error updating quiz:', e);
      setError('Không thể cập nhật bộ đề: ' + (e.message || 'Lỗi không xác định'));
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for TF answers array
  const getParsedTFAnswers = (ansStr: string): string[] => {
    try {
      const parsed = JSON.parse(ansStr);
      if (Array.isArray(parsed) && parsed.length === 4) return parsed;
    } catch {
      // fallback
    }
    return ['Đúng', 'Sai', 'Đúng', 'Sai'];
  };

  const updateTFAnswer = (optIndex: number, val: 'Đúng' | 'Sai') => {
    if (!currentQ) return;
    const currentList = getParsedTFAnswers(currentQ.answer);
    currentList[optIndex] = val;
    updateActiveQuestion({ answer: JSON.stringify(currentList) });
  };

  // Keyboard shortcut Ctrl+S / Cmd+S to quickly save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, subject, questions, isDirty, saveSuccessNotice]);

  if (!isOpen || !quiz) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">Chỉnh sửa bộ đề thi</h2>
                {isDirty && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                    Có thay đổi chưa lưu
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Cập nhật nội dung câu hỏi, đáp án và thông số bộ đề (Ctrl + S để lưu nhanh)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRequestClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* General Quiz Information Card */}
          <div className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Thông tin chung bộ đề</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Tên bộ đề</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tên bộ đề..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Môn học / Lớp</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ví dụ: KHTN 7"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                />
              </div>
            </div>

            {/* Quick Pick Subject Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Gợi ý nhanh:</span>
              {SUBJECT_SUGGESTIONS.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setSubject(chip)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    subject === chip 
                      ? 'bg-teal-600 text-white shadow-xs' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Question Navigator Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-teal-600" />
                  <span>Danh sách câu hỏi ({questions.length})</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm câu hỏi</span>
              </button>
            </div>

            {/* Questions Tabs / Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
              {questions.map((q, idx) => {
                const isActive = idx === activeQuestionIndex;
                const isComplete = isQuestionComplete(q);
                return (
                  <button
                    key={q.id || idx}
                    type="button"
                    onClick={() => setActiveQuestionIndex(idx)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20 scale-102'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Câu {idx + 1}</span>
                    <span className={`text-[10px] px-1 rounded ${
                      isActive ? 'bg-teal-700/60 text-teal-100' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {q.type}
                    </span>
                    {!isComplete ? (
                      <span 
                        className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white animate-pulse" 
                        title="Câu hỏi này chưa hoàn thiện đầy đủ nội dung hoặc phương án"
                      />
                    ) : (
                      <span 
                        className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-teal-200' : 'bg-emerald-500'}`}
                        title="Câu hỏi đã đầy đủ thông tin"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Editor Card */}
          {currentQ && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
              
              {/* Question Control Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-teal-100 text-teal-800 text-xs font-black rounded-lg">
                    Câu {activeQuestionIndex + 1} / {questions.length}
                  </span>
                  <span className="text-xs text-slate-400">
                    ID: {currentQ.id}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={activeQuestionIndex === 0}
                    onClick={() => handleMoveQuestion(activeQuestionIndex, 'up')}
                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                    title="Di chuyển câu lên trước"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={activeQuestionIndex === questions.length - 1}
                    onClick={() => handleMoveQuestion(activeQuestionIndex, 'down')}
                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                    title="Di chuyển câu xuống sau"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateQuestion}
                    className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg cursor-pointer"
                    title="Nhân bản câu hỏi này"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={questions.length <= 1}
                    onClick={() => setQuestionToDeleteIndex(activeQuestionIndex)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 cursor-pointer"
                    title="Xóa câu hỏi này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Question Config: Type & Time limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Loại câu hỏi</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleChangeQuestionType('MC')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        currentQ.type === 'MC'
                          ? 'bg-teal-50 border-teal-500 text-teal-800 ring-2 ring-teal-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      Trắc nghiệm (MC)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeQuestionType('TF')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        currentQ.type === 'TF'
                          ? 'bg-teal-50 border-teal-500 text-teal-800 ring-2 ring-teal-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      Đúng - Sai (TF)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeQuestionType('SA')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        currentQ.type === 'SA'
                          ? 'bg-teal-50 border-teal-500 text-teal-800 ring-2 ring-teal-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      Trả lời ngắn (SA)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Thời gian làm bài (giây)</span>
                  </label>
                  <select
                    value={currentQ.timeLimit || 30}
                    onChange={(e) => updateActiveQuestion({ timeLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-teal-500 outline-none"
                  >
                    <option value={15}>15 giây</option>
                    <option value={20}>20 giây</option>
                    <option value={30}>30 giây (Chuẩn trắc nghiệm)</option>
                    <option value={45}>45 giây</option>
                    <option value={60}>60 giây (Chuẩn Đúng-Sai / Tự luận)</option>
                    <option value={90}>90 giây</option>
                    <option value={120}>120 giây (2 phút)</option>
                    <option value={180}>180 giây (3 phút)</option>
                  </select>
                </div>
              </div>

              {/* Question Content Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Nội dung câu hỏi <span className="text-slate-400 font-normal">(Hỗ trợ KaTeX: $công_thức$)</span>
                </label>
                <textarea
                  rows={3}
                  value={currentQ.content}
                  onChange={(e) => updateActiveQuestion({ content: e.target.value })}
                  placeholder="Nhập nội dung câu hỏi..."
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                />

                {/* KaTeX Live Preview Box */}
                {currentQ.content && (
                  <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-700">
                    <span className="font-bold text-slate-500 block mb-1 text-[11px] uppercase">Bản xem trước hiển thị:</span>
                    <div ref={previewContentRef} className="font-serif leading-relaxed text-slate-800">
                      {currentQ.content}
                    </div>
                  </div>
                )}
              </div>

              {/* Question Audio File Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Tải file Audio câu hỏi (Định dạng MP3, WAV,...)</span>
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        alert('Kích thước file audio quá lớn (tối đa 5MB). Vui lòng chọn file âm thanh ngắn hoặc định dạng nén.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (uploadEvent) => {
                        const base64Result = uploadEvent.target?.result as string;
                        if (base64Result) {
                          updateActiveQuestion({ audioUrl: base64Result });
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                  />
                  {currentQ.audioUrl && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const audio = new Audio(currentQ.audioUrl);
                            audio.play().catch(err => alert('Không thể phát audio: ' + err.message));
                          } catch (err: any) {
                            alert('Lỗi phát audio: ' + err.message);
                          }
                        }}
                        className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Nghe thử audio"
                      >
                        <span>▶ Nghe</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateActiveQuestion({ audioUrl: undefined })}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold cursor-pointer"
                        title="Xóa audio"
                      >
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Tải file âm thanh trực tiếp (.mp3, .wav,...). Khi trình chiếu và bật audio câu hỏi, tệp sẽ tự động phát.
                </p>
              </div>

              {/* Dynamic Answer Section based on Question Type */}
              
              {/* 1. Multiple Choice (MC) */}
              {currentQ.type === 'MC' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      4 Lựa chọn A, B, C, D <span className="text-emerald-600 font-normal">(Click vào chữ cái A/B/C/D để chọn đáp án đúng)</span>
                    </label>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Đáp án đúng hiện tại: {currentQ.answer}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                      const optValue = currentQ.options?.[optIdx] || '';
                      const isCorrect = currentQ.answer === letter;

                      return (
                        <div
                          key={letter}
                          className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all ${
                            isCorrect 
                              ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20' 
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => updateActiveQuestion({ answer: letter })}
                            className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                              isCorrect 
                                ? 'bg-emerald-600 text-white shadow-sm' 
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                            title={`Đặt ${letter} làm đáp án đúng`}
                          >
                            {letter}
                          </button>

                          <input
                            type="text"
                            value={optValue}
                            onChange={(e) => {
                              const newOpts = [...(currentQ.options || ['', '', '', ''])];
                              newOpts[optIdx] = e.target.value;
                              updateActiveQuestion({ options: newOpts });
                            }}
                            placeholder={`Nội dung lựa chọn ${letter}...`}
                            className="flex-1 bg-transparent border-none text-xs sm:text-sm text-slate-800 font-medium outline-none"
                          />

                          {isCorrect && (
                            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mr-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. True / False (TF) */}
              {currentQ.type === 'TF' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      4 Nhận định a, b, c, d <span className="text-slate-400 font-normal">(Chọn Đúng hoặc Sai cho mỗi nhận định)</span>
                    </label>
                    <span className="text-xs text-slate-500 font-medium">Thang điểm 1.0 đ theo format GDPT</span>
                  </div>

                  <div className="space-y-2.5">
                    {['a', 'b', 'c', 'd'].map((letter, optIdx) => {
                      const optValue = currentQ.options?.[optIdx] || '';
                      const tfAnswers = getParsedTFAnswers(currentQ.answer);
                      const currentVal = tfAnswers[optIdx] || 'Đúng';

                      return (
                        <div
                          key={letter}
                          className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-black text-xs flex items-center justify-center flex-shrink-0">
                              {letter}
                            </span>
                            <input
                              type="text"
                              value={optValue}
                              onChange={(e) => {
                                const newOpts = [...(currentQ.options || ['', '', '', ''])];
                                newOpts[optIdx] = e.target.value;
                                updateActiveQuestion({ options: newOpts });
                              }}
                              placeholder={`Nội dung nhận định ${letter}...`}
                              className="flex-1 bg-white px-3 py-1.5 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-medium outline-none focus:border-teal-500"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => updateTFAnswer(optIdx, 'Đúng')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                currentVal === 'Đúng'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Đúng
                            </button>
                            <button
                              type="button"
                              onClick={() => updateTFAnswer(optIdx, 'Sai')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                currentVal === 'Sai'
                                  ? 'bg-rose-600 text-white shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Sai
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Short Answer (SA) */}
              {(currentQ.type === 'SA' || currentQ.type === 'ESSAY') && (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Đáp án chính xác / Từ khóa chấm chuẩn
                  </label>
                  <input
                    type="text"
                    value={currentQ.answer || ''}
                    onChange={(e) => updateActiveQuestion({ answer: e.target.value })}
                    placeholder="Ví dụ: 12 hoặc Oxi hoặc BaCl2..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:border-teal-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    Hệ thống sẽ so khớp câu trả lời của học sinh với đáp án này (không phân biệt hoa thường và khoảng trắng thừa).
                  </p>
                </div>
              )}

              {/* 4. Question Explanation / Detailed Solution (Optional) */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Lời giải chi tiết / Hướng dẫn giải (Tùy chọn)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Hỗ trợ công thức toán/hóa: $công_thức$</span>
                </div>
                <textarea
                  rows={2}
                  value={currentQ.explanation || ''}
                  onChange={(e) => updateActiveQuestion({ explanation: e.target.value })}
                  placeholder="Nhập lời giải hoặc kiến thức trọng tâm giải thích cho câu hỏi này..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                />
              </div>

            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Notice */}
          {saveSuccessNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Đã lưu các thay đổi của bộ đề thành công vào cơ sở dữ liệu!</span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 hidden sm:block">
            Tổng cộng: <strong className="text-slate-700">{questions.length} câu hỏi</strong>
            {isDirty && (
              <span className="ml-2 text-amber-600 font-semibold">• Có thay đổi chưa lưu</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-teal-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 active:scale-98"
              title="Nhấn Ctrl + S để lưu nhanh"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu cập nhật...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Lưu thay đổi bộ đề</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Unsaved Changes Confirmation Prompt Modal */}
      {showUnsavedPrompt && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Thoát mà không lưu?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Bạn có các thay đổi chưa được lưu vào cơ sở dữ liệu. Nếu thoát bây giờ, các thay đổi sẽ bị mất.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowUnsavedPrompt(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Tiếp tục sửa
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedPrompt(false);
                  onClose();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Rời khỏi không lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Question Confirmation Modal */}
      {questionToDeleteIndex !== null && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Xóa câu hỏi {questionToDeleteIndex + 1}?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Bạn có chắc muốn xóa câu hỏi này khỏi danh sách? Thao tác này sẽ có hiệu lực sau khi bạn nhấn "Lưu thay đổi bộ đề".
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setQuestionToDeleteIndex(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteQuestion(questionToDeleteIndex)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Xác nhận xóa câu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
