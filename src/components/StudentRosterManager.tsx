import React, { useState, useEffect, useRef } from 'react';
import { StudentRosterItem } from '../types';
import { 
  loadRoster, 
  saveRoster, 
  importRosterFromExcel, 
  importRosterFromWord, 
  parseRosterFromText, 
  downloadSampleRosterExcel, 
  DEFAULT_SAMPLE_ROSTER 
} from '../utils/studentRoster';
import { 
  Users, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RotateCcw,
  Sparkles,
  ClipboardPaste,
  Edit2,
  X,
  Check,
  Atom
} from 'lucide-react';
import ExamSeatingModal from './ExamSeatingModal';
import AtomicCountdownClock from './AtomicCountdownClock';

export default function StudentRosterManager() {
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSeatingModal, setShowSeatingModal] = useState<boolean>(false);
  const [showAtomicClock, setShowAtomicClock] = useState<boolean>(false);

  // Quick Paste state
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pasteContent, setPasteContent] = useState<string>('');

  // Add individual student state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newCode, setNewCode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newClass, setNewClass] = useState<string>('6A1');
  const [newNotes, setNewNotes] = useState<string>('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editClass, setEditClass] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRosterData();
  }, []);

  const loadRosterData = async () => {
    setIsLoading(true);
    try {
      const data = await loadRoster();
      setRoster(data);
    } catch (e: any) {
      setErrorMessage('Không thể tải danh sách học sinh: ' + (e?.message || 'Lỗi không xác định'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setSaveSuccess('');
    setIsSaving(true);

    try {
      const fileName = file.name.toLowerCase();
      let imported: StudentRosterItem[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        imported = await importRosterFromExcel(file);
      } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc') || fileName.endsWith('.txt')) {
        imported = await importRosterFromWord(file);
      } else {
        throw new Error('Định dạng file không được hỗ trợ. Vui lòng chọn file Excel (.xlsx, .xls) hoặc Word (.docx, .txt)!');
      }

      if (imported.length === 0) {
        throw new Error('Không đọc được dữ liệu học sinh nào từ file.');
      }

      setRoster(imported);
      await saveRoster(imported);
      setSaveSuccess(`Đã nạp và lưu thành công ${imported.length} học sinh từ file "${file.name}"!`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi đọc file. Vui lòng kiểm tra lại cấu trúc file!');
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyPaste = async () => {
    if (!pasteContent.trim()) {
      setErrorMessage('Vui lòng dán nội dung danh sách học sinh!');
      return;
    }

    try {
      const parsed = parseRosterFromText(pasteContent);
      if (parsed.length === 0) {
        setErrorMessage('Không nhận diện được học sinh nào. Định dạng mẫu: HS01 [Tab] Nguyễn Văn A [Tab] 6A1');
        return;
      }

      setRoster(parsed);
      await saveRoster(parsed);
      setShowPasteModal(false);
      setPasteContent('');
      setSaveSuccess(`Đã nạp thành công ${parsed.length} học sinh từ nội dung sao chép!`);
    } catch (e: any) {
      setErrorMessage('Lỗi xử lý nội dung: ' + e?.message);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) {
      setErrorMessage('Mã HS và Họ tên không được để trống!');
      return;
    }

    const cleanCode = newCode.trim().toUpperCase().replace(/\s+/g, '');
    if (roster.some(s => s.studentCode === cleanCode)) {
      setErrorMessage(`Mã học sinh "${cleanCode}" đã tồn tại! Mỗi học sinh phải có một mã duy nhất.`);
      return;
    }

    const newStudent: StudentRosterItem = {
      id: `std-${cleanCode}-${Date.now()}`,
      studentCode: cleanCode,
      name: newName.trim(),
      className: newClass.trim() || 'Chung',
      notes: newNotes.trim()
    };

    const updated = [newStudent, ...roster];
    setRoster(updated);
    await saveRoster(updated);
    setNewCode('');
    setNewName('');
    setNewNotes('');
    setShowAddForm(false);
    setSaveSuccess(`Đã thêm học sinh ${newStudent.name} (${newStudent.studentCode})!`);
  };

  const handleDelete = async (studentCode: string) => {
    const updated = roster.filter(s => s.studentCode !== studentCode);
    setRoster(updated);
    await saveRoster(updated);
    setSaveSuccess(`Đã xóa học sinh có mã ${studentCode}`);
  };

  const handleResetDefault = async () => {
    if (window.confirm('Khôi phục danh sách 20 học sinh mẫu chuẩn (6A1 - 6A4)? Dữ liệu hiện tại sẽ được thay thế.')) {
      setRoster(DEFAULT_SAMPLE_ROSTER);
      await saveRoster(DEFAULT_SAMPLE_ROSTER);
      setSaveSuccess('Đã khôi phục danh sách 20 học sinh mẫu!');
    }
  };

  const startEdit = (student: StudentRosterItem) => {
    setEditingId(student.studentCode);
    setEditName(student.name);
    setEditClass(student.className);
    setEditNotes(student.notes || '');
  };

  const saveEdit = async (studentCode: string) => {
    const updated = roster.map(s => {
      if (s.studentCode === studentCode) {
        return {
          ...s,
          name: editName.trim() || s.name,
          className: editClass.trim() || s.className,
          notes: editNotes.trim()
        };
      }
      return s;
    });
    setRoster(updated);
    await saveRoster(updated);
    setEditingId(null);
    setSaveSuccess('Đã cập nhật thông tin học sinh!');
  };

  // Filtered by search
  const filtered = roster.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.studentCode.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.className.toLowerCase().includes(q) ||
      (s.notes && s.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-sm flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-black uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>MÃ HÓA NGƯỜI CHƠI • ĐĂNG NHẬP THEO MÃ HS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-lobster text-slate-800 tracking-wide">
              Danh Sách Học Sinh Tham Gia
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Nhập từ file Excel/Word. Khi tham gia thi, học sinh chỉ cần nhập Mã HS, hệ thống sẽ tự nhận diện Họ tên và Lớp.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv,.docx,.doc,.txt"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving}
            className="px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Nạp từ File Excel / Word</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border border-slate-200 transition-all cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4 text-slate-600" />
            <span>Dán dữ liệu</span>
          </button>

          <button
            type="button"
            onClick={downloadSampleRosterExcel}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border border-emerald-200 transition-all cursor-pointer"
            title="Tải file Excel mẫu chuẩn"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Tải file Excel mẫu</span>
          </button>

          {/* Sơ đồ xếp chỗ 30 HS */}
          <button
            type="button"
            onClick={() => setShowSeatingModal(true)}
            className="px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border border-purple-200 transition-all cursor-pointer shadow-sm"
            title="Mở sơ đồ xếp chỗ phòng thi: 6 dãy, mỗi dãy 5 HS (Tổng 30 HS, tự động tránh học sinh cùng lớp cạnh nhau)"
          >
            <Users className="w-4 h-4 text-purple-600" />
            <span>Sơ đồ Xếp chỗ (30 HS)</span>
          </button>

          {/* Đồng hồ nguyên tử 5 phút */}
          <button
            type="button"
            onClick={() => setShowAtomicClock(true)}
            className="px-3.5 py-2.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border border-cyan-200 transition-all cursor-pointer shadow-sm"
            title="Mở đồng hồ đếm ngược hành tinh nguyên tử (Mặc định 5 phút)"
          >
            <Atom className="w-4 h-4 text-cyan-600 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Mở Đồng hồ (5p)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border border-indigo-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm thủ công</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs sm:text-sm font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button onClick={() => setSaveSuccess('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs sm:text-sm font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Student Form */}
      {showAddForm && (
        <form onSubmit={handleAddStudent} className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl mb-6 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" /> Thêm nhanh học sinh mới
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Hủy
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã học sinh (*):</label>
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value.toUpperCase())}
                placeholder="VD: HS21, 6A01"
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Họ và tên (*):</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="VD: Lê Thị Mai"
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Lớp / Chi đội:</label>
              <input
                type="text"
                value={newClass}
                onChange={e => setNewClass(e.target.value)}
                placeholder="VD: 6A1"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Ghi chú:</label>
              <input
                type="text"
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="Tổ trưởng, CLB..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Lưu vào danh sách</span>
            </button>
          </div>
        </form>
      )}

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-teal-600" />
                <h3 className="text-lg font-bold text-slate-800">Dán danh sách từ bảng Word hoặc Excel</h3>
              </div>
              <button onClick={() => setShowPasteModal(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Bạn có thể sao chép trực tiếp từ bảng Word hoặc cột Excel và dán vào ô bên dưới. Mỗi dòng gồm: <br />
              <code className="text-teal-700 bg-teal-50 px-1 py-0.5 rounded font-mono font-bold">Mã HS [Tab] Họ và tên [Tab] Lớp</code>
            </p>

            <textarea
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              rows={8}
              placeholder="HS01	Nguyễn Gia Bảo	6A1
HS02	Trần Quỳnh Anh	6A1
HS03	Lê Minh Khôi	6A2
..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 focus:bg-white focus:border-teal-500 outline-none mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyPaste}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              >
                Áp dụng danh sách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roster Table Filter & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo Mã HS, Họ tên, Lớp..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-teal-500 outline-none"
            />
          </div>
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
            Tổng: <strong className="text-teal-700 font-mono text-sm">{roster.length}</strong> học sinh
          </span>
        </div>

        <button
          type="button"
          onClick={handleResetDefault}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-semibold cursor-pointer"
          title="Khôi phục 20 học sinh mẫu ban đầu"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Đặt lại mẫu mặc định</span>
        </button>
      </div>

      {/* Student List Table */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <span className="text-xs">Đang tải danh sách học sinh...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs sm:text-sm font-bold text-slate-600">Không tìm thấy học sinh nào.</p>
          <p className="text-[11px] text-slate-400 mt-1">Hãy nạp danh sách từ file Excel/Word hoặc thêm học sinh mới.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 w-12 text-center">STT</th>
                <th className="py-3 px-3.5 w-28">Mã HS (Đăng nhập)</th>
                <th className="py-3 px-3.5">Họ và tên học sinh</th>
                <th className="py-3 px-3.5 w-28">Lớp / Chi đội</th>
                <th className="py-3 px-3.5">Ghi chú</th>
                <th className="py-3 px-3.5 w-24 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((student, idx) => {
                const isEditing = editingId === student.studentCode;

                return (
                  <tr key={student.studentCode} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3.5 text-center font-mono text-slate-400 font-bold">
                      {idx + 1}
                    </td>

                    {/* Student Code */}
                    <td className="py-2.5 px-3.5">
                      <span className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 font-mono font-black rounded-lg text-xs tracking-wider">
                        {student.studentCode}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-3.5">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="px-2 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-bold text-slate-900 w-full outline-none"
                        />
                      ) : (
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">
                          {student.name}
                        </span>
                      )}
                    </td>

                    {/* Class */}
                    <td className="py-2.5 px-3.5">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editClass}
                          onChange={e => setEditClass(e.target.value)}
                          className="px-2 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-bold text-slate-900 w-full outline-none"
                        />
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-black rounded-md text-[11px]">
                          {student.className || 'Chung'}
                        </span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-2.5 px-3.5 text-slate-500">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          className="px-2 py-1 bg-white border border-indigo-400 rounded-lg text-xs text-slate-900 w-full outline-none"
                        />
                      ) : (
                        <span>{student.notes || '-'}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => saveEdit(student.studentCode)}
                            className="p-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg"
                            title="Lưu"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg"
                            title="Hủy"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(student)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(student.studentCode)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa học sinh"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sơ đồ xếp chỗ 30 HS */}
      <ExamSeatingModal
        isOpen={showSeatingModal}
        onClose={() => setShowSeatingModal(false)}
        quizTitle="Vòng 1 - Đấu trường Số"
      />

      {/* Đồng hồ nguyên tử 5 phút */}
      <AtomicCountdownClock
        isOpen={showAtomicClock}
        onClose={() => setShowAtomicClock(false)}
        defaultMinutes={5}
      />
    </div>
  );
}
