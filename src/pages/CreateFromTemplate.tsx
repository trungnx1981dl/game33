import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Quiz, Question } from '../types';
import { 
  ArrowLeft, 
  Download, 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Play, 
  Save, 
  Trash2, 
  Sparkles, 
  Layers, 
  FileText,
  Info
} from 'lucide-react';
import { 
  exportTemplateExcel, 
  exportTemplateCsv, 
  parseQuizFromTemplateFile, 
  ParseTemplateResult 
} from '../services/templateQuizService';
import { formatTFAnswer } from '../utils/scoring';
import { saveQuizToSystem } from '../utils/quizStorage';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

export default function CreateFromTemplate() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseTemplateResult | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [subject, setSubject] = useState('KHTN');
  const [isSaving, setIsSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const el = document.getElementById('template-preview-container');
    if (el) {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false,
      });
    }
  });

  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    try {
      const result = await parseQuizFromTemplateFile(selectedFile);
      setParseResult(result);
      if (!quizTitle) {
        const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '');
        setQuizTitle(cleanName.replace(/^mau_/i, 'Đề thi: '));
      }
    } catch (err: any) {
      alert('Lỗi đọc file: ' + err.message);
      setFile(null);
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteQuestion = (idx: number) => {
    if (!parseResult) return;
    const updated = parseResult.questions.filter((_, i) => i !== idx);
    const mc = updated.filter(q => q.type === 'MC').length;
    const tf = updated.filter(q => q.type === 'TF').length;
    const sa = updated.filter(q => q.type === 'SA').length;
    const essay = updated.filter(q => q.type === 'ESSAY').length;

    setParseResult({
      questions: updated,
      total: updated.length,
      mcCount: mc,
      tfCount: tf,
      saCount: sa,
      essayCount: essay,
      warnings: parseResult.warnings
    });
  };

  const handleSaveAndUse = async (startDirectly = false) => {
    if (!quizTitle.trim()) {
      return alert('Vui lòng nhập tên bộ đề!');
    }
    if (!parseResult || parseResult.questions.length === 0) {
      return alert('Chưa có câu hỏi nào để lưu!');
    }

    setIsSaving(true);
    try {
      const savedQuiz = await saveQuizToSystem({
        title: quizTitle.trim(),
        subject: subject.trim() || 'KHTN',
        createdBy: 'admin',
        createdAt: Date.now(),
        questions: parseResult.questions
      });

      if (startDirectly) {
        // Đưa vào dùng ngay: mở phòng chiếu toàn lớp cho 100 HS tham gia
        navigate(`/host/board/${savedQuiz.id}`);
      } else {
        alert(`Đã lưu bộ đề "${savedQuiz.title}" vào hệ thống thành công! Có thể sử dụng nhiều lần.`);
        navigate('/admin');
      }
    } catch (e: any) {
      alert('Lỗi lưu đề thi: ' + (e.message || 'Lỗi không xác định'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="p-2.5 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              Tạo đề từ File Mẫu (Excel / CSV)
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-0.5">
              Hệ thống tự động nhận dạng 4 dạng câu hỏi GDPT 2018 & đưa vào dùng ngay
            </p>
          </div>
        </div>

        {/* Template download buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => exportTemplateExcel()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            title="Tải file mẫu Excel chuẩn có sẵn câu hỏi mẫu và sheet hướng dẫn"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất file mẫu (.xlsx)</span>
          </button>
          <button
            onClick={() => exportTemplateCsv()}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            title="Tải file mẫu CSV tiếng Việt UTF-8"
          >
            <Download className="w-4 h-4" />
            <span>Xuất file mẫu (.csv)</span>
          </button>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors cursor-pointer"
            title="Xem hướng dẫn định dạng file mẫu"
          >
            <Info className="w-5 h-5 text-teal-600" />
          </button>
        </div>
      </div>

      {/* Guide Card (Collapsible) */}
      {showGuide && (
        <div className="bg-teal-50 border-2 border-teal-200 p-6 rounded-3xl space-y-3 animate-in fade-in duration-200">
          <h4 className="font-black text-teal-900 text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            Cấu trúc chuẩn của File Mẫu (Hệ thống tự nhận dạng thông minh):
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-teal-950">
            <div className="bg-white/80 p-3.5 rounded-xl border border-teal-100 space-y-1">
              <strong className="text-teal-800 block text-sm">1. Trắc nghiệm 4 lựa chọn (MC):</strong>
              <p>• Cột Loại: điền <strong>MC</strong> hoặc <strong>Trắc nghiệm</strong></p>
              <p>• Điền 4 phương án vào các cột Phương án A, B, C, D</p>
              <p>• Cột Đáp án: điền chữ cái <strong>A</strong>, <strong>B</strong>, <strong>C</strong> hoặc <strong>D</strong></p>
            </div>
            <div className="bg-white/80 p-3.5 rounded-xl border border-teal-100 space-y-1">
              <strong className="text-teal-800 block text-sm">2. Đúng - Sai 4 ý (TF):</strong>
              <p>• Cột Loại: điền <strong>TF</strong> hoặc <strong>Đúng - Sai</strong></p>
              <p>• Điền 4 nhận định a, b, c, d vào cột Phương án A, B, C, D</p>
              <p>• Cột Đáp án: điền <strong>Đúng, Sai, Đúng, Sai</strong> (hoặc <strong>Đ, S, Đ, S</strong>)</p>
            </div>
            <div className="bg-white/80 p-3.5 rounded-xl border border-teal-100 space-y-1">
              <strong className="text-teal-800 block text-sm">3. Trả lời ngắn / Điền khuyết (SA):</strong>
              <p>• Cột Loại: điền <strong>SA</strong> hoặc <strong>Trả lời ngắn</strong></p>
              <p>• Cột Đáp án: gõ từ khóa, số liệu hoặc công thức cần điền</p>
            </div>
            <div className="bg-white/80 p-3.5 rounded-xl border border-teal-100 space-y-1">
              <strong className="text-teal-800 block text-sm">4. Tự luận giải thích (ESSAY):</strong>
              <p>• Cột Loại: điền <strong>ESSAY</strong> hoặc <strong>Tự luận</strong></p>
              <p>• Cột Đáp án: đáp án mẫu hoặc gợi ý chấm điểm cho giáo viên</p>
            </div>
          </div>
          <p className="text-xs text-teal-700 italic">
            💡 Gợi ý: Bấm nút "Xuất file mẫu (.xlsx)" ở trên để tải file đã định dạng sẵn về điền và nạp lại vào đây.
          </p>
        </div>
      )}

      {/* Upload Box */}
      {!parseResult && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="bg-white border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-3xl p-10 sm:p-14 text-center transition-all bg-gradient-to-b from-slate-50 to-white shadow-sm group"
        >
          <input
            type="file"
            id="template-upload-input"
            accept=".xlsx,.xls,.csv,.tsv,.txt"
            onChange={e => e.target.files && e.target.files[0] && handleFile(e.target.files[0])}
            className="hidden"
          />
          <label
            htmlFor="template-upload-input"
            className="cursor-pointer flex flex-col items-center justify-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-inner">
              {isParsing ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : (
                <UploadCloud className="w-10 h-10" />
              )}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1">
              {isParsing ? 'Đang đọc và phân loại dữ liệu câu hỏi...' : 'Kéo thả file mẫu hoặc Bấm để chọn tệp'}
            </h3>
            <p className="text-slate-500 text-sm max-w-md mb-4">
              Hỗ trợ định dạng Excel (.xlsx, .xls) và CSV. Hệ thống tự động nhận dạng cột, phân loại và chuẩn hóa công thức KaTeX.
            </p>
            <span className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm shadow-md transition-all">
              Chọn tệp từ máy tính
            </span>
          </label>
        </div>
      )}

      {/* Parsing Summary & Ready to Use Controls */}
      {parseResult && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Recognition Banner */}
          <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-teal-700/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider text-teal-100">
                <CheckCircle2 className="w-4 h-4 text-teal-200" /> Tự động nhận dạng thành công
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Đã phân loại {parseResult.total} câu hỏi chuẩn hóa
              </h3>
              <div className="flex flex-wrap gap-2 pt-1 text-xs sm:text-sm font-bold">
                <span className="px-3 py-1 bg-white/20 rounded-lg">
                  🎯 Trắc nghiệm: {parseResult.mcCount} câu
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-lg">
                  ⚖️ Đúng - Sai: {parseResult.tfCount} câu
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-lg">
                  ✍️ Trả lời ngắn: {parseResult.saCount} câu
                </span>
                {parseResult.essayCount > 0 && (
                  <span className="px-3 py-1 bg-white/20 rounded-lg">
                    📝 Tự luận: {parseResult.essayCount} câu
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleSaveAndUse(true)}
                disabled={isSaving}
                className="px-6 py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black rounded-2xl text-base shadow-xl flex items-center justify-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                title="Lưu ngay và mở phòng chiếu cho 100 học sinh tham gia trả lời trực tiếp"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                <span>DÙNG NGAY: MỞ PHÒNG THI (100 HS)</span>
              </button>
              <button
                onClick={() => handleSaveAndUse(false)}
                disabled={isSaving}
                className="px-5 py-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                title="Lưu đề vào cơ sở dữ liệu để dùng sau"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span>Lưu vào kho đề</span>
              </button>
            </div>
          </div>

          {/* Quiz Metadata Box */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Tên bộ đề thi
              </label>
              <input
                type="text"
                value={quizTitle}
                onChange={e => setQuizTitle(e.target.value)}
                placeholder="Nhập tên bộ đề..."
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Môn học / Khối lớp
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Ví dụ: KHTN 8, Hóa học..."
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Warnings (if any) */}
          {parseResult.warnings && parseResult.warnings.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Lưu ý khi tự động nhận diện:
              </div>
              {parseResult.warnings.map((w, idx) => (
                <p key={idx}>• {w}</p>
              ))}
            </div>
          )}

          {/* Questions Preview List */}
          <div className="space-y-4" id="template-preview-container">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-lg font-bold text-slate-800">
                Xem trước & Rà soát câu hỏi ({parseResult.questions.length}):
              </h4>
              <button
                onClick={() => {
                  setParseResult(null);
                  setFile(null);
                }}
                className="text-xs font-bold text-slate-500 hover:text-red-600 transition-colors"
              >
                Nhập file khác
              </button>
            </div>

            <div className="space-y-3">
              {parseResult.questions.map((q, idx) => {
                const isTF = q.type === 'TF';
                const isMC = q.type === 'MC';
                const isSA = q.type === 'SA';
                const isEssay = q.type === 'ESSAY';

                return (
                  <div
                    key={q.id || idx}
                    className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start justify-between gap-4 group"
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 font-mono font-black text-sm flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase ${
                          isMC ? 'bg-blue-100 text-blue-800' :
                          isTF ? 'bg-amber-100 text-amber-800' :
                          isSA ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isMC ? 'Trắc nghiệm' : isTF ? 'Đúng - Sai' : isSA ? 'Trả lời ngắn' : 'Tự luận'}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          ⏱ {q.timeLimit || 30}s
                        </span>
                      </div>

                      {/* Content */}
                      <p className="text-slate-800 font-semibold text-sm sm:text-base whitespace-pre-wrap leading-relaxed">
                        {q.content}
                      </p>

                      {/* MC Options */}
                      {isMC && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                          {q.options.map((opt, oIdx) => {
                            const letter = ['A', 'B', 'C', 'D'][oIdx];
                            const isCorrect = q.answer === letter;
                            return (
                              <div
                                key={oIdx}
                                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                                  isCorrect
                                    ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900 ring-2 ring-emerald-300/40'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {letter}
                                </span>
                                <span className="flex-1">{opt}</span>
                                {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* TF Options */}
                      {isTF && q.options && (
                        <div className="space-y-1.5 pl-2">
                          {q.options.map((opt, oIdx) => {
                            const letter = ['a', 'b', 'c', 'd'][oIdx];
                            let tfArr: string[] = [];
                            try {
                              tfArr = JSON.parse(q.answer);
                            } catch {
                              tfArr = [];
                            }
                            const val = tfArr[oIdx] || '';
                            const isTrue = val === 'Đúng';

                            return (
                              <div
                                key={oIdx}
                                className="flex items-center justify-between gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="font-bold text-slate-600">{letter})</span>
                                  <span className="text-slate-800 font-medium">{opt}</span>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs ${
                                  isTrue ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {val || 'Chưa đặt'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* SA / ESSAY */}
                      {(isSA || isEssay) && (
                        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 font-medium flex items-center gap-2">
                          <strong className="text-teal-950 font-bold">Đáp án chuẩn:</strong>
                          <span className="font-mono text-teal-800 font-bold">{q.answer}</span>
                        </div>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteQuestion(idx)}
                      className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Xóa câu hỏi này"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={() => handleSaveAndUse(false)}
                disabled={isSaving}
                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Lưu vào kho đề
              </button>
              <button
                onClick={() => handleSaveAndUse(true)}
                disabled={isSaving}
                className="px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Đưa Vào Dùng Ngay (Mở phòng chiếu toàn lớp)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
